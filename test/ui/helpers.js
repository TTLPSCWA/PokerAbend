import { test as base, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDomPresentationCapture } from './dom-presentation-capture.js';
import { bindPresentation, installRoomViewAudit, isLivePeer, ServerViewLedger } from './server-view-audit.js';
import { fakeDiscord, CLIENT, SECRET } from '../discord-fake.js';
import { freePort } from '../free-port.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const password = 'BlockA-Testpasswort';

// Jeder Test erhält einen eigenen Server, freien Port und temporäre Spieldaten.
// Passwortschutz und Rate-Limits laufen dabei unverändert mit.
export const test = base.extend({
  ticketAdminPassword: ['', { option: true }],
  adminPassword: ['', { option: true }],
  discordOAuth: [false, { option: true }],
  idleHall: [false, { option: true }],
  idleStudio: [false, { option: true }],
  // Dateien (Name → JSON-Inhalt), die vor dem Serverstart im Datenordner liegen sollen (z. B. eine vorbefüllte Bestenliste)
  seedFiles: [{}, { option: true }],
  createLimit: ['6', { option: true }],
  app: async ({ ticketAdminPassword, adminPassword, createLimit, seedFiles, discordOAuth, idleHall, idleStudio }, use) => {
    const dataDir = mkdtempSync(join(tmpdir(), 'spieleabend-ui-'));
    const idle = idleHall || idleStudio;
    for (const [name, content] of Object.entries(seedFiles)) writeFileSync(join(dataDir, name), JSON.stringify(content));
    const port = discordOAuth ? await freePort() : 0;
    const provider = discordOAuth ? await fakeDiscord() : null;
    const discordEnv = provider ? {
      PUBLIC_URL: `http://localhost:${port}`, DISCORD_CLIENT_ID: CLIENT, DISCORD_CLIENT_SECRET: SECRET,
      DISCORD_API_BASE: provider.base + '/api', DISCORD_AUTHORIZE_URL: provider.base + '/oauth2/authorize',
    } : {};
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      if (process.env.IDLE_SPIELHALLE_ENABLED === 'on' || process.env.IDLE_STUDIO_ENABLED === 'on') {
        const { register } = await import('node:module');
        const url = new URL('./server/idle/runtime.js', import.meta.url).href;
        const wrapper = 'import { createIdleRuntime as create, isIdleRequest } from ' +
          JSON.stringify(url + '?original') + '; export { isIdleRequest };' +
          'export function createIdleRuntime(opts) { return create({ ...opts, now: () => globalThis.fixtureIdleNow }); }';
        const loader = 'const url=' + JSON.stringify(url) + ';const wrapper=' + JSON.stringify(wrapper) +
          ';export function load(value,context,next) {return value===url ? {format:"module",source:wrapper,shortCircuit:true} : next(value,context);}';
        register('data:text/javascript,' + encodeURIComponent(loader), import.meta.url);
        globalThis.fixtureIdleNow = 1790000000000;
        process.on('message', ({ idleNow }) => {
          globalThis.fixtureIdleNow = idleNow;
          process.send({ idleNow });
        });
      }
      const { http, enableRoomViewAuditForTests } = await import('./server/index.js');
      enableRoomViewAuditForTests();
      const ready = () => console.log('TEST_READY:' + http.address().port);
      if (http.listening) ready(); else http.once('listening', ready);
    `], {
      cwd: root,
      env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: password, TICKET_ADMIN_PASSWORD: ticketAdminPassword, ADMIN_PASSWORD: adminPassword, CREATE_LIMIT: createLimit,
        IDLE_SPIELHALLE_ENABLED: idleHall ? 'on' : 'off',
        IDLE_STUDIO_ENABLED: idleStudio ? 'on' : 'off',
        IDLE_SAVE_KEYRING: idle ? JSON.stringify({ active: 'ui-test', keys: [{ id: 'ui-test', key: 'ab'.repeat(32) }] }) : '',
        ...discordEnv },
      stdio: idle ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stderr.on('data', (d) => { output += d; });
    try {
      const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Testserver startet nicht: ' + output)), 45000); // auf ausgelasteten Rechnern braucht der Start länger
        child.once('error', (e) => { clearTimeout(timer); reject(e); });
        child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Testserver beendet (${code}): ${output}`)); });
        child.stdout.on('data', (d) => {
          output += d;
          const match = output.match(/TEST_READY:(\d+)/);
          if (match) { clearTimeout(timer); resolve('http://localhost:' + match[1]); }
        });
      });
      const setIdleTime = idle ? async (idleNow) => {
        const ack = once(child, 'message');
        child.send({ idleNow });
        expect((await ack)[0].idleNow).toBe(idleNow);
      } : undefined;
      await use({ url, password, ticketAdminPassword, adminPassword, provider, setIdleTime });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const stopped = new Promise((resolve) => child.once('exit', resolve));
        child.kill();
        await stopped;
      }
      if (provider) await new Promise((resolve) => provider.server.close(resolve));
    }
  },
  page: async ({ page, app }, use) => {
    await observeServerView(page, app.url);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await use(page);
    // Keep the isolated server alive until the page is closed. Otherwise a
    // late presence/background request races app teardown and reports a false
    // ERR_CONNECTION_REFUSED in the browser-error assertion.
    if(!page.isClosed())await page.close();
    expect(errors, 'JavaScript- und Browserfehler').toEqual([]);
  },
});

export { expect };

export async function selectGame(page, id) {
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator(`[data-host="${id}"]`).first().click();
}

export async function login(page, app, name = 'Anna') {
  await observeServerView(page, app.url);
  await page.addInitScript((name) => {
    if (!localStorage.getItem('poker:name')) {
      localStorage.setItem('poker:name', JSON.stringify(name));
      localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
      localStorage.setItem('poker:prefs', JSON.stringify({ intros: false }));
    }
  }, name);
  // Die Einführung gehört nicht zum Lobby-Test; bei Bedarf wie ein Nutzer schließen.
  await page.addLocatorHandler(page.locator('#intro-dlg[open]'), async () => {
    await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
  });
  await page.goto(app.url);
  await page.getByLabel('Passwort').fill(app.password);
  await page.getByRole('button', { name: 'Reinkommen' }).click();
  await expect(page.locator('#hub')).toBeVisible();
}

export async function screenshot(page, name) {
  const dir = join(root, 'artifacts', 'block-a');
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${name}-${page.viewportSize().width}.png`), fullPage: true });
}

// ---------- EXP-F6: additive experience assertions ----------
import { inspectPresentation } from '../helpers/presentation-audit.js';
import { MUST_HAVE_SECRETS } from '../helpers/leak-audit.js';
const viewRecords = new WeakMap(), liveViewRecords = new Set();

// Capture only this fixture's inbound Socket.IO traffic, outside the browser's game state.
function observeServerView(page, baseURL) {
  if (viewRecords.has(page)) return viewRecords.get(page).ready;
  const origin = new URL(baseURL);
  const ledger = new ServerViewLedger();
  const record = { page, ledger, ready: page.addInitScript(installRoomViewAudit) };
  const pollingRequests = new WeakMap();
  viewRecords.set(page, record);
  liveViewRecords.add(record);

  const isTransport = (url, transport, protocol) => {
    const address = new URL(url);
    return address.protocol === protocol && address.host === origin.host &&
      address.pathname === '/socket.io/' && address.searchParams.get('transport') === transport;
  };
  page.on('request', request => {
    let frame;
    try { frame = request.frame(); } catch { return; }
    if (frame !== page.mainFrame()) return;
    if (request.isNavigationRequest()) ledger.navigate();
    if (request.method() === 'GET' && isTransport(request.url(), 'polling', origin.protocol)) {
      pollingRequests.set(request, ledger.generation);
    }
  });
  page.on('websocket', socket => {
    const protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    if (!isTransport(socket.url(), 'websocket', protocol)) return;
    const generation = ledger.generation;
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload === 'string') ledger.capture(payload, generation, socket);
    });
    socket.on('close', () => ledger.close(socket));
    socket.on('socketerror', () => ledger.close(socket));
  });
  page.on('response', response => {
    const generation = pollingRequests.get(response.request());
    if (generation !== ledger.generation || !response.ok() || response.fromServiceWorker()) return;
    void response.text().then(payload => ledger.capture(payload, generation), () => {});
  });
  page.once('close', () => liveViewRecords.delete(record));
  return record.ready;
}

export async function waitForServerView(page, accepts = () => true) {
  const ledger = viewRecords.get(page)?.ledger;
  let view;
  await expect.poll(async () => {
    const generation = ledger?.generation;
    const stamp = await page.evaluate(() => globalThis.__pokerRoomViewAudit?.current() ?? null);
    view = generation === ledger?.generation ? ledger?.find(stamp) : undefined;
    return !!view && Boolean(accepts(view));
  }, { message: 'No captured server view for the expected room state' }).toBe(true);
  return view;
}

// Compare one immutable server broadcast even when this tab is already rendering a newer one.
export async function waitForPeerServerView(page, reference) {
  const ledger = viewRecords.get(page)?.ledger;
  const generation = ledger?.generation;
  let peer;
  await expect.poll(async () => {
    const current = await page.evaluate(() => globalThis.__pokerRoomViewAudit?.current() ?? null);
    if (generation !== ledger?.generation || !ledger?.find(current) || current.room !== reference.__roomViewAudit.room) return false;
    const views = ledger.peers(reference, (view, candidate) =>
      isLivePeer(view, candidate) && candidate.__roomViewAudit.connection === current.connection &&
      candidate.__roomViewAudit.viewer === current.viewer && candidate.__roomViewAudit.role === current.role);
    peer = views.length === 1 ? views[0] : undefined;
    return Boolean(peer);
  }, { message: 'No captured peer view for the exact server revision' }).toBe(true);
  return peer;
}

/** Measure the action and newly started finite WAAPI work under 4x CDP CPU throttling. */
export async function expectSmoothMotion(page, action, { minFps, timeout=10000 } = {}) {
  if(typeof action!=='function')throw new TypeError('expectSmoothMotion needs an action function');
  const mobile=await page.evaluate(()=>matchMedia('(pointer: coarse)').matches);
  const budget=minFps??(mobile?60:45);
  if(!Number.isFinite(budget)||budget<=0)throw new TypeError('minFps must be positive');
  const session=await page.context().newCDPSession(page);
  let started=false;
  try{
    await session.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.evaluate(()=>{
      if(window.__experienceFps)throw Error('A motion measurement is already active');
      const before=new WeakSet(document.getAnimations()),state={times:[],animations:0,done:false,idle:0,stop:false,raf:0};
      state.promise=new Promise(resolve=>state.resolve=resolve);
      const tick=time=>{
        state.times.push(time);
        const fresh=document.getAnimations().filter(a=>!before.has(a)&&Number.isFinite(a.effect?.getComputedTiming().endTime)&&a.playState!=='finished'&&a.playState!=='idle');
        state.animations=Math.max(state.animations,fresh.length);
        state.idle=state.done&&!fresh.length?state.idle+1:0;
        if(state.stop||state.idle>=2){state.resolve();return;}
        state.raf=requestAnimationFrame(tick);
      };
      window.__experienceFps=state;state.raf=requestAnimationFrame(tick);
    });started=true;
    // Start at a frame boundary so protocol round trips do not add an unsampled warmup.
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    await action();
    const result=await page.evaluate(async timeout=>{
      const state=window.__experienceFps;state.done=true;
      let timer;
      try{await Promise.race([state.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Motion did not settle within '+timeout+' ms')),timeout);})]);}
      finally{clearTimeout(timer);}
      const intervals=state.times.length-1,duration=state.times.at(-1)-state.times[0];
      return {frames:state.times.length,duration,rawFps:intervals*1000/duration,animations:state.animations,cpuThrottle:4};
    },timeout);
    const fps=Math.round(result.rawFps*100)/100;
    const message=`Motion: ${fps} FPS (raw ${result.rawFps.toFixed(4)}), budget ${budget}, ${result.frames} frames / ${result.duration.toFixed(1)} ms, 4x CPU, ${result.animations} new animations`;
    expect(result.frames,message+'; action must span at least eight frames').toBeGreaterThanOrEqual(8);
    expect(result.duration,message+'; action is too short for a useful sample').toBeGreaterThanOrEqual(200);
    expect(fps,message).toBeGreaterThanOrEqual(budget);
    return {...result,fps,minFps:budget};
  }finally{
    if(started)await page.evaluate(()=>{const state=window.__experienceFps;if(state){state.stop=true;cancelAnimationFrame(state.raf);state.resolve();delete window.__experienceFps;}}).catch(()=>{});
    await session.send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
    await session.detach().catch(()=>{});
  }
}

/** EXP-F1 logging must be enabled BEFORE the sound-producing action. */
export async function expectSound(page,event,{timeout=2500,since=0}={}) {
  const matcher=typeof event==='string'?{event}:event;
  if(!matcher?.event)throw new TypeError('expectSound needs an event name');
  expect(await page.evaluate(()=>Array.isArray(window.__soundLog)),'Enable window.__soundLog = [] before the action').toBe(true);
  let found;
  await expect.poll(async()=>{
    const log=await page.evaluate(()=>window.__soundLog);
    found=log.slice(since).find(entry=>entry&&Object.entries(matcher).every(([key,value])=>entry[key]===value));
    return !!found;
  },{timeout,message:`Expected sound ${JSON.stringify(matcher)} in __soundLog since index ${since}`}).toBe(true);
  return found;
}

/** Bind DOM and animation observations to the exact server revision used by the renderer. */
export async function expectNoLeak(page, { serverView, peers, scope = '#game-root', action, requireSecrets } = {}) {
  if (!await page.locator(scope).count()) throw new Error('No presentation root for ' + scope);
  const initial = serverView ?? await waitForServerView(page);
  const ledger = viewRecords.get(page)?.ledger;
  const generation = ledger?.generation;
  await page.evaluate(startDomPresentationCapture, { scope, expected: initial.__roomViewAudit });

  let batches;
  try {
    if (action) await action();
    const capture = await page.evaluate(() => window.__experienceLeakCapture.finish());
    expect(capture.overflow, 'Presentation capture exceeded 12,000 samples; narrow the scope').toBe(false);
    expect(capture.invalidated || ledger?.generation !== generation, 'No captured server view after invalidation or navigation').toBe(false);
    batches = serverView ? [{ view: serverView, samples: capture.samples }] :
      bindPresentation(capture.samples, stamp => ledger?.find(stamp));
  } finally {
    await page.evaluate(() => window.__experienceLeakCapture?.cleanup()).catch(() => {});
  }

  const result = { compared: 0, privateValues: 0, samples: 0, problems: [] };
  for (const { view, samples } of batches) {
    const needsSecrets = requireSecrets ?? MUST_HAVE_SECRETS.includes(view.game);
    const matchingPeers = () => [...liveViewRecords].filter(record => record.page !== page)
      .flatMap(record => record.ledger.peers(view, isLivePeer));
    if (!serverView && needsSecrets && peers === undefined) {
      await expect.poll(() => matchingPeers().length, { message: 'Private game needs another runner-captured player view at this revision' }).toBeGreaterThan(0);
    }
    const others = serverView ? peers : peers ? peers.filter(peer => isLivePeer(view, peer)) : matchingPeers();
    if (!serverView && peers !== undefined) {
      expect(others.length, 'Explicit peer views must share the DOM revision').toBe(peers.length);
    }
    const report = inspectPresentation(view, others, samples);
    if (needsSecrets) {
      expect(report.compared, 'Private game needs another runner-captured player view').toBeGreaterThan(0);
      expect(report.privateValues, 'No differential private values were exercised; use a view before reveal').toBeGreaterThan(0);
    }
    result.compared += report.compared;
    result.privateValues += report.privateValues;
    result.samples += report.samples;
    result.problems.push(...report.problems);
  }
  expect(result.samples, 'No DOM/animation samples inspected').toBeGreaterThan(0);
  expect(result.problems, 'Presentation leaks for ' + initial.game + ': ' + JSON.stringify(result.problems)).toEqual([]);
  return result;
}
