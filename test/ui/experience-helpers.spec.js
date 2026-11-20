import {test,expect,login,selectGame,expectSmoothMotion,expectSound,expectNoLeak,waitForServerView} from './helpers.js';
import {setup} from '../helpers/leak-audit.js';
import {GAMES} from '../../games/index.js';
import {writeFileSync} from 'node:fs';

test('EXP-F6 expectSmoothMotion: actual motion, default device budget, 4x CPU',async({page,app},info)=>{
 await login(page,app);await page.goto(app.url+'/motion/test-motion.html');await expect.poll(()=>page.evaluate(()=>!!window.motionDemo)).toBe(true);
 const result=await expectSmoothMotion(page,()=>page.evaluate(()=>motionDemo.run('walk',{duration:1800})));
 expect(result.cpuThrottle).toBe(4);expect(result.minFps).toBe(info.project.name==='mobil'?60:45);expect(result.animations).toBeGreaterThan(0);
 writeFileSync(info.outputPath('experience-fps.json'),JSON.stringify(result,null,2)+'\n');
});
test('EXP-F6 expectSmoothMotion: rejects below budget and restores CPU and recorder after failures',async({page,app})=>{
 await login(page,app);await page.goto(app.url+'/motion/test-motion.html');await expect.poll(()=>page.evaluate(()=>!!window.motionDemo)).toBe(true);
 const context=page.context(),original=context.newCDPSession.bind(context),rates=[];
 context.newCDPSession=async target=>{const session=await original(target),send=session.send.bind(session);session.send=async(method,params)=>{if(method==='Emulation.setCPUThrottlingRate')rates.push(params.rate);return send(method,params);};return session;};
 try{
  await expect(expectSmoothMotion(page,()=>page.evaluate(()=>motionDemo.run('pulse',{duration:700})),{minFps:1000})).rejects.toThrow(/Motion: .*FPS.*budget 1000.*4x CPU/);
  expect(await page.evaluate(()=>window.__experienceFps===undefined)).toBe(true);
  await expect(expectSmoothMotion(page,async()=>{throw Error('action-marker');})).rejects.toThrow('action-marker');
  expect(rates).toEqual([4,1,4,1]);
 }finally{context.newCDPSession=original;}
});
test('EXP-F6 expectSound: real engine log, palette matcher and missing event counterexample',async({page,app})=>{
 await login(page,app);await page.evaluate(async()=>{window.__soundLog=[];await Sound.use('holz');await Sound.play('confirm');});
 const entry=await expectSound(page,{event:'confirm',palette:'holz'});expect(entry.channel).toBe('effects');
 await expect(expectSound(page,'win',{timeout:150})).rejects.toThrow(/Expected sound/);
 await page.evaluate(()=>{delete window.__soundLog;});await expect(expectSound(page,'confirm')).rejects.toThrow(/Enable window.__soundLog/);
});
test('EXP-F6 expectNoLeak: real player views, transient animation and tampered browser state',async({page,app,browser},info)=>{
 await login(page,app);await selectGame(page,'maumau');await page.locator('#host-form button[type=submit]').click();await page.evaluate(()=>send('sit'));
 const code=await page.evaluate(()=>lastState.code),context=await browser.newContext({...info.project.use,viewport:page.viewportSize()}),other=await context.newPage();
 try{
  await login(other,app,'Ben');await other.evaluate(code=>joinAndEnter(code,'sit'),code);await expect.poll(()=>page.evaluate(()=>lastState.players.filter(p=>p.seated).length)).toBe(2);
  expect((await page.evaluate(()=>send('start'))).ok).toBe(true);await expect.poll(()=>page.evaluate(()=>lastState.phase)).toBe('playing');await expect.poll(()=>other.evaluate(()=>lastState.phase)).toBe('playing');
  const report=await expectNoLeak(page);expect(report.compared).toBeGreaterThan(0);expect(report.privateValues).toBeGreaterThan(0);
  const own=await page.evaluate(()=>[...lastState.g.hand,lastState.g.top]),hidden=(await other.evaluate(()=>lastState.g.hand)).find(card=>!own.includes(card));expect(hidden).toBeTruthy();
  await expect(expectNoLeak(page,{action:()=>page.evaluate(card=>{
    const el=document.createElement('span');el.dataset.card=card;document.querySelector('#game-root').append(el);el.animate([{opacity:0},{opacity:1}],{duration:1000});el.remove();
  },hidden)})).rejects.toThrow(/animation/);
  await expect(expectNoLeak(page, { action: () => page.evaluate(card => {
    const node = document.createElement('span');
    node.dataset.card = card;
    document.querySelector('#game-root').append(node);
    node.remove();
  }, hidden) })).rejects.toThrow(/private card|card attribute absent/);
  await expect(expectNoLeak(page,{action:()=>page.evaluate(card=>{
    window.originalHand=[...lastState.g.hand];lastState.g.hand.push(card);const el=document.createElement('span');el.id='injected-card';el.dataset.card=card;document.querySelector('#game-root').append(el);
  },hidden)})).rejects.toThrow(/Presentation leaks/);
  await page.evaluate(()=>{lastState.g.hand=window.originalHand;delete window.originalHand;document.querySelector('#injected-card').remove();});
  await expectNoLeak(page);
 }finally{await context.close();}
});
test('EXP-F6 expectNoLeak: V2-09 dice fixture, bound hidden slot and no numeric-score false positive',async({page,app})=>{
 const env=setup(GAMES.maexchen);let serverView,peer;
 try{env.r.start(env.r.hostId);const dice=[3,6];env.r.roll=()=>dice.shift();env.r.throwDice(env.r.currentId);const owner=env.r.currentId;serverView=env.r.view(env.ids.find(id=>id!==owner));peer=env.r.view(owner);}finally{env.r.dispose();}
 await login(page,app);await page.evaluate(()=>{const el=document.createElement('div');el.id='leak-test';el.innerHTML='<span>6</span><span class="die" data-view-path=".g.cup" data-view-value="">??</span>';document.querySelector('#hub-main').append(el);});
 const options={serverView,peers:[peer],scope:'#leak-test'};await expectNoLeak(page,options);
 await expect(expectNoLeak(page,{...options,action:()=>page.evaluate(()=>{const die=document.querySelector('.die');die.dataset.dieValue='6';die.dataset.viewValue='6';})})).rejects.toThrow(/Presentation leaks/);
 await page.evaluate(()=>{const die=document.querySelector('.die');delete die.dataset.dieValue;die.dataset.viewValue='';});await expectNoLeak(page,options);
});
test('EXP-F6 assertions reject missing server data and empty presentation roots',async({page,app})=>{
 await login(page,app);
 await expect(expectNoLeak(page,{scope:'#missing-root'})).rejects.toThrow(/No presentation root/);
 await expect(expectNoLeak(page,{scope:'#hub-main'})).rejects.toThrow(/No captured server view/);
});

test('EXP-F6 server view: actual HTTP polling remains authoritative after reload', async ({ page, app }) => {
  let websockets = 0;
  page.on('websocket', () => websockets++);
  // Exercise the actual Engine.IO polling endpoint, using a transport-only fixture override.
  await page.route('**/core.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const transport = "transports: ['websocket', 'polling']";
    expect(source).toContain(transport);
    await route.fulfill({ response, body: source.replace(transport, "transports: ['polling']") });
  });
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  const first = await waitForServerView(page, view => view.game === 'maumau' && view.you?.id);
  await page.reload();
  const reconnected = await waitForServerView(page, view => view.code === first.code && view.you?.id === first.you.id);
  expect(reconnected.__roomViewAudit.connection).not.toBe(first.__roomViewAudit.connection);
  expect(reconnected.__roomViewAudit.revision).toBeGreaterThan(first.__roomViewAudit.revision);
  expect(websockets).toBe(0);
});


test('EXP-F6 server view: a later frame cannot authorize an earlier DOM value', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  const initial = await waitForServerView(page, view => view.game === 'maumau');
  expect(initial.unlisted).toBe(false);

  await expect(expectNoLeak(page, { requireSecrets: false, action: async () => {
    await page.evaluate(() => {
      const element = document.createElement('span');
      element.id = 'revision-test-marker';
      element.dataset.viewPath = '.unlisted';
      element.dataset.viewValue = 'true';
      document.querySelector('#game-root').append(element);
    });
    expect((await page.evaluate(() => send('unlisted', { value: true }))).ok).toBe(true);
    await waitForServerView(page, view => view.unlisted && view.__roomViewAudit.revision > initial.__roomViewAudit.revision);
    await page.evaluate(() => document.querySelector('#revision-test-marker')?.remove());
  }})).rejects.toThrow(/value is not authorized at \.unlisted/);
  await expectNoLeak(page, { requireSecrets: false });
});

test('EXP-F6 server view: a copied browser view has no renderer provenance', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  await waitForServerView(page, view => view.game === 'maumau');
  await expect(expectNoLeak(page, { requireSecrets: false, action: () =>
    page.evaluate(() => applyRoomView(structuredClone(lastState))),
  })).rejects.toThrow(/No captured server view.*DOM revision/);
  expect((await page.evaluate(() => send('unlisted', { value: true }))).ok).toBe(true);
  await waitForServerView(page, view => view.unlisted);
  await expectNoLeak(page, { requireSecrets: false });
});

test('EXP-F6 server view: WebSocket close invalidates capture until a real reconnect', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  const first = await waitForServerView(page, view => view.game === 'maumau');
  expect(await page.evaluate(() => socket.io.engine.transport.name)).toBe('websocket');
  await expect(expectNoLeak(page, { requireSecrets: false, action: async () => {
    await page.evaluate(() => new Promise(resolve => {
      socket.io.reconnection(false);
      socket.once('disconnect', resolve);
      socket.io.engine.transport.ws.close();
    }));
    expect(await page.evaluate(() => lastState.code)).toBe(first.code);
    expect(await page.evaluate(() => window.__pokerRoomViewAudit.current())).toBeNull();
  }})).rejects.toThrow(/No captured server view after invalidation/);

  await page.evaluate(() => { socket.connect(); });
  const second = await waitForServerView(page, view => view.code === first.code && view.you.id === first.you.id);
  expect(second.__roomViewAudit.connection).not.toBe(first.__roomViewAudit.connection);
  expect(second.__roomViewAudit.revision).toBeGreaterThan(first.__roomViewAudit.revision);
  await expectNoLeak(page, { requireSecrets: false });
});


test('EXP-F6 server view: HTTP polling upgrades to WebSocket without changing viewer identity', async ({ page, app }) => {
  // Start on real polling and control when Engine.IO performs its ordinary upgrade.
  await page.route('**/core.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const transport = "transports: ['websocket', 'polling']";
    expect(source).toContain(transport);
    await route.fulfill({ response, body: source.replace(transport, "transports: ['polling', 'websocket'], upgrade: false") });
  });
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  const first = await waitForServerView(page, view => view.game === 'maumau');
  expect(await page.evaluate(() => socket.io.engine.transport.name)).toBe('polling');
  await page.evaluate(() => socket.io.engine._probe('websocket'));
  await expect.poll(() => page.evaluate(() => socket.io.engine.transport.name)).toBe('websocket');
  expect((await page.evaluate(() => send('unlisted', { value: true }))).ok).toBe(true);
  const second = await waitForServerView(page, view => view.unlisted);
  expect(second.you.id).toBe(first.you.id);
  expect(second.__roomViewAudit.connection).toBe(first.__roomViewAudit.connection);
  expect(second.__roomViewAudit.revision).toBeGreaterThan(first.__roomViewAudit.revision);
  await expectNoLeak(page, { requireSecrets: false });
});


async function mountBoundMarker(page, app) {
  await login(page, app);
  await selectGame(page, 'maumau');
  await page.locator('#host-form button[type=submit]').click();
  const view = await waitForServerView(page, state => state.game === 'maumau');
  expect(view.unlisted).toBe(false);
  await page.evaluate(() => {
    const region = document.createElement('div');
    region.id = 'bound-audit-region';
    const marker = document.createElement('span');
    marker.dataset.viewPath = '.unlisted';
    marker.dataset.viewValue = '';
    region.append(marker);
    document.querySelector('#game-root').append(region);
  });
  return view;
}

const auditBoundMarker = (page, action) => expectNoLeak(page, {
  scope: '#bound-audit-region', requireSecrets: false, action,
});

test('EXP-F6 server view: a bound value left in the DOM is checked at the next render revision', async ({ page, app }) => {
  await mountBoundMarker(page, app);
  expect((await page.evaluate(() => send('unlisted', { value: true }))).ok).toBe(true);
  const first = await waitForServerView(page, view => view.unlisted);
  await page.evaluate(() => { document.querySelector('#bound-audit-region span').dataset.viewValue = 'true'; });
  await auditBoundMarker(page);

  await expect(auditBoundMarker(page, async () => {
    expect((await page.evaluate(() => send('unlisted', { value: false }))).ok).toBe(true);
    const second = await waitForServerView(page, view => !view.unlisted);
    expect(second.__roomViewAudit.revision).toBeGreaterThan(first.__roomViewAudit.revision);
    expect(second.__roomViewAudit.connection).toBe(first.__roomViewAudit.connection);
    await expect(page.locator('#bound-audit-region span')).toHaveAttribute('data-view-value', 'true');
    await page.evaluate(() => { document.querySelector('#bound-audit-region span').dataset.viewValue = ''; });
  })).rejects.toThrow(/value is not authorized at \.unlisted/);
  await auditBoundMarker(page);
});

test('EXP-F6 server view: multiple synchronous value and field changes retain intermediate bindings', async ({ page, app }) => {
  await mountBoundMarker(page, app);
  await expect(auditBoundMarker(page, () => page.evaluate(() => {
    const marker = document.querySelector('#bound-audit-region span');
    marker.dataset.viewValue = 'true';
    marker.dataset.viewValue = '';
    marker.dataset.viewPath = '.game';
    marker.dataset.viewValue = 'maumau';
  }))).rejects.toThrow(/value is not authorized at \.unlisted/);
  await auditBoundMarker(page);
});

test('EXP-F6 server view: replacement roots and transient text in their children are checked', async ({ page, app }) => {
  await mountBoundMarker(page, app);
  await expect(auditBoundMarker(page, () => page.evaluate(() => {
    const original = document.querySelector('#bound-audit-region');
    const replacement = original.cloneNode(true);
    const node = replacement.querySelector('span');
    node.removeAttribute('data-view-value');
    const text = document.createTextNode('');
    node.append(text);
    original.replaceWith(replacement);
    text.data = 'true';
    text.data = '';
    replacement.replaceWith(original);
  }))).rejects.toThrow(/value is not authorized at \.unlisted/);
  await auditBoundMarker(page);
});
