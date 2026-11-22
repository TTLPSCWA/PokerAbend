import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fakeDiscord, CLIENT, SECRET } from './discord-fake.js';
import { freePort } from './free-port.js';

const game = '/api/idle/fixture-idle';
const epoch = 1_790_000_000_000;
const year = 365 * 86_400_000;
const sitePassword = 'idle-test-password';
const oldKey = { id: 'previous', key: 'ab'.repeat(32) };
const nextKey = { id: 'next', key: 'cd'.repeat(32) };
const keyring = (active, ...keys) => JSON.stringify({ active, keys });
const initialKeys = keyring(oldKey.id, oldKey);
const registryUrl = new URL('../server/idle/registry.js', import.meta.url).href;
const runtimeUrl = new URL('../server/idle/runtime.js', import.meta.url).href;
const engineUrl = new URL('../public/idle/engine.js', import.meta.url).href;
const fixtureEngine = [
  'import { createIdleEngine, quantity, produceBatches, transact } from ' + JSON.stringify(engineUrl) + ';',
  'export const idleEngines = [createIdleEngine({',
  ' id: "fixture-idle", stateVersion: 1, rulesVersion: 1, facts: () => ({}),',
  ' create: () => ({ units: "0", carry: 0 }),',
  ' validate: (state) => quantity(state.units) >= 0n && Number.isInteger(state.carry) && state.carry >= 0 && state.carry < 1000,',
  ' command: (state, { spend }) => ({ ...state, ...transact({ units: state.units }, { spend: { units: spend } }) }),',
  ' advance(state, { from, to }) {',
  '   const { balances, carry } = produceBatches({ units: state.units }, { interval: 1000, carry: state.carry, elapsed: to - from, earn: { units: "1" } });',
  '   return { until: to, data: { units: balances.units, carry } };',
  ' },',
  '}, [{ id: "fixture-phase", enter: [], unlocks: [], automations: [] }])];',
].join('\n');
const fixtureRuntime = [
  'import { createIdleRuntime as create, isIdleRequest } from ' + JSON.stringify(runtimeUrl + '?fixture-real') + ';',
  'export { isIdleRequest };',
  'export function createIdleRuntime(options) { return create({ ...options, now: () => globalThis.idleWall, leaseClock: () => globalThis.idleLease }); }',
].join('\n');

function temp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'poker-idle-integration-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function start(dir, { modules = true, keys = initialKeys, at = epoch, discord, failure } = {}) {
  // The test process controls the clock. Use the normal registry for the cross-game case.
  const real = modules === 'real';
  const sources = modules ? { [runtimeUrl]: fixtureRuntime, ...(!real ? { [registryUrl]: fixtureEngine } : {}) } : {};
  const hook = 'const sources = ' + JSON.stringify(sources) + ';' +
    'export function load(url, ctx, next) { return Object.hasOwn(sources, url) ?' +
    ' { format: "module", shortCircuit: true, source: sources[url] } : next(url, ctx); }';
  const loader = 'data:text/javascript,' + encodeURIComponent(hook);
  const boot = [
    'import { register } from "node:module";',
    'import { once } from "node:events";',
    'register(' + JSON.stringify(loader) + ', import.meta.url);',
    'globalThis.idleWall = ' + at + '; globalThis.idleLease = 0;',
    'const { http } = await import("./server/index.js");',
    'if (!http.listening) await once(http, "listening");',
    'process.on("message", (message) => {',
    ' if (message.stop) process.exit(0);',
    ' globalThis.idleWall = message.at; globalThis.idleLease = message.lease ?? 0; process.send({ updated: true });',
    '});',
    'process.send({ port: http.address().port });',
  ].join('\n');
  const port = discord ? await freePort() : 0;
  const child = spawn(process.execPath, ['--input-type=module', '-e', boot], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', POKER_NO_DOTENV: '1', PORT: String(port), DATA_DIR: dir,
      SITE_PASSWORD: sitePassword, SESSION_SECRET: '', DISCORD_EXCLUSIVE_MODULES: 'off',
      IDLE_SAVE_KEYRING: keys, IDLE_SPIELHALLE_ENABLED: real ? 'on' : 'off',
      IDLE_STUDIO_ENABLED: real ? 'on' : 'off', IDLE_FACTORY_ENABLED: real ? 'on' : 'off',
      DISCORD_CLIENT_ID: discord ? CLIENT : '', DISCORD_CLIENT_SECRET: discord ? SECRET : '',
      DISCORD_GUILD_ID: '', DISCORD_ROLE_ID: '', FEATURE_DISCORD: '', DISCORD_API_BASE: discord ? discord.base + '/api' : '',
      DISCORD_AUTHORIZE_URL: discord ? discord.base + '/oauth2/authorize' : '', PUBLIC_URL: discord ? 'http://localhost:' + port : '',
    },
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (data) => { stderr += data; });
  let finish;
  const exited = new Promise((resolve) => { child.once('close', (...args) => { resolve(args); finish?.(args); }); });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('Idle-Testserver startet nicht.')); }, 30_000);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('message', ({ port: bound }) => { clearTimeout(timer); resolve(bound); });
    finish = ([code]) => {
      clearTimeout(timer);
      if (failure && code !== 0 && failure.test(stderr)) resolve(null);
      else reject(new Error('Idle-Testserver beendet: ' + code + '\n' + stderr));
    };
  });
  const bound = await ready;
  if (bound === null) return null;
  async function stop(force = false) {
    if (child.exitCode === null && child.signalCode === null) {
      if (force) child.kill('SIGKILL');
      else child.send({ stop: true });
    }
    await exited;
  }
  if (failure) {
    await stop();
    assert.fail('Unsicherer Start wurde zugelassen.');
  }
  return {
    url: 'http://localhost:' + bound,
    stop,
    async clock(at, lease = 0) {
      const ack = once(child, 'message');
      child.send({ at, lease });
      assert.deepEqual((await ack)[0], { updated: true });
    },
  };
}

function browser(server, initial = {}) {
  const cookies = { ...initial };
  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const cookie = Object.entries(cookies).map(([name, value]) => name + '=' + value).join('; ');
    const res = await fetch(server.url + path, { method, body, redirect: 'manual', headers: { cookie, ...headers } });
    for (const entry of res.headers.getSetCookie()) {
      const [kv, ...attributes] = entry.split(';');
      const idx = kv.indexOf('=');
      const name = kv.slice(0, idx);
      if (attributes.some((attr) => /max-age=0/i.test(attr))) delete cookies[name];
      else cookies[name] = kv.slice(idx + 1);
    }
    return res;
  }
  const get = (path, headers) => request(path, { headers });
  const post = (path, value = {}, headers) => request(path, { method: 'POST', body: JSON.stringify(value),
    headers: { 'content-type': 'application/json', 'x-requested-with': 'spieleabend', ...headers } });
  return {
    cookies, get, post,
    async login() {
      const login = await request('/login', { method: 'POST',
        body: new URLSearchParams({ password: sitePassword }), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
      assert.equal(login.status, 303);
      assert.equal((await get('/')).status, 200);
      return this;
    },
  };
}

async function expectJSON(response, status = 200, code) {
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  if (code) assert.equal(data.code, code);
  return data;
}

const open = async (b) => expectJSON(await b.post(game + '/session'));
const operation = ({ token, revision, sessionVersion }, id) => ({ token, revision, sessionVersion, id });
const linkCode = async (b) => (await expectJSON(await b.post('/api/identity/link/create'))).code;
const link = async (from, to) => from.post('/api/identity/link/redeem', { code: await linkCode(to) });
const inventory = (dir) => join(dir, 'idle', 'fixture-idle');

test('Der reguläre Server bietet ohne registriertes Spiel keine Idle-Routen und schreibt kein Idle-Verzeichnis', { timeout: 45_000 }, async (t) => {
  const dir = temp(t), server = await start(dir, { modules: false });
  try {
    const b = await browser(server).login();
    assert.equal((await b.get('/api/idle')).status, 404);
    assert.equal((await b.post('/api/idle/spielhalle/session')).status, 404);
    assert.equal(existsSync(join(dir, 'idle')), false);
  } finally { await server.stop(); }
});

test('QA-IDLE-01: drei echte Module halten Saves, Leases, Geräte und Signaturen getrennt', { timeout: 45_000 }, async (t) => {
  const games = ['spielhalle', 'studio', 'factory'];
  const paths = Object.fromEntries(games.map((id) => [id, '/api/idle/' + id]));
  const dir = temp(t);
  let app = await start(dir, { modules: 'real' });
  try {
    const owner = await browser(app).login();
    const other = await browser(app).login();
    const later = await browser(app).login();
    const sameTab = browser(app, owner.cookies);
    const call = (who, id, tail = '', body) =>
      body === undefined ? who.get(paths[id] + tail) : who.post(paths[id] + tail, body);
    const sessions = {};
    const files = {};
    const send = async (id, requestId, action) => {
      const state = sessions[id];
      const body = { ...operation(state, requestId), action };
      const accepted = await expectJSON(await call(owner, id, '/actions', body));
      assert.deepEqual(await expectJSON(await call(owner, id, '/actions', body)), accepted);
      Object.assign(state, accepted);
    };
    assert.deepEqual((await expectJSON(await owner.get('/api/idle'))).games, games);
    for (const id of games) {
      sessions[id] = await expectJSON(await call(owner, id, '/session', {}));
      assert.equal(sessions[id].revision, 0);
    }
    assert.equal(new Set(games.map((id) => sessions[id].token)).size, 3);
    await send('spielhalle', 'first', { type: 'manual' });
    await send('spielhalle', 'second', { type: 'auto' });
    await send('studio', 'first', { type: 'start', name: 'Probeprojekt', size: 'mini', depth: 'normal',
      genre: 'puzzle', topic: 'animals', audience: 'casual', platform: 'pc', team: 1 });
    await send('factory', 'first', { type: 'layout', region: 1, build: [{ type: 'drill', x: 9, y: 5, rotation: 0 }] });
    assert.deepEqual((await expectJSON(await owner.get('/api/me/export'))).idleSaves ?? [], []);
    for (const id of games) {
      files[id] = await expectJSON(await call(owner, id, '/export', operation(sessions[id], 'initial-save')));
      assert.equal(files[id].revision, 1);
      Object.assign(sessions[id], files[id]);
    }
    const spectator = await expectJSON(await call(sameTab, 'factory', '/session', {}));
    assert.equal(spectator.readOnly, true);
    const replacement = await expectJSON(await call(sameTab, 'factory', '/takeover', {
      revision: spectator.revision, sessionVersion: spectator.sessionVersion, sessionId: spectator.sessionId, confirm: true,
    }));
    await expectJSON(await call(owner, 'factory', '/session/heartbeat', { token: sessions.factory.token }), 409, 'lease-conflict');
    sessions.factory = replacement;
    await expectJSON(await call(owner, 'studio', '/session/heartbeat', { token: sessions.studio.token }));
    await expectJSON(await call(owner, 'spielhalle', '/session/heartbeat', { token: sessions.spielhalle.token }));
    await send('factory', 'unconfirmed', { type: 'rotate', id: 5 });
    await send('studio', 'unconfirmed', { type: 'cancel', id: 1, confirm: true });
    await expectJSON(await link(owner, later), 409, 'idle-unsaved-actions');
    const otherStudio = await expectJSON(await call(other, 'studio', '/session', {}));
    await expectJSON(await call(other, 'studio', '/save', operation(otherStudio, 'other-save')));

    const future = epoch + 3650 * 86_400_000;
    await app.stop();
    app = await start(dir, { modules: 'real', at: future, keys: keyring(nextKey.id, nextKey, oldKey) });
    const sameOwner = browser(app, owner.cookies);
    const otherAfter = browser(app, other.cookies);
    const nextDevice = browser(app, later.cookies);
    const expected = {
      spielhalle: (v) => v.phase.id === 'SH-P2' && BigInt(v.data.guests) > 1n,
      studio: (v) => v.data.projects.some(({ stage, plan }) => stage === 'gate' && plan.name === 'Probeprojekt'),
      factory: (v) => v.phase.id === 'FE-P2' && v.data.buildings.some(({ type, rotation }) => type === 'drill' && rotation === 0),
    };
    for (const id of games) {
      const current = await expectJSON(await call(sameOwner, id, '/session', {}));
      sessions[id] = current;
      assert.equal(current.revision, 1);
      assert.equal(current.savedAt, epoch);
      assert.equal(current.at ?? current.view.at, future);
      assert.ok(expected[id](current.view), id + ' must resume from its committed state');
      const fields = { token: current.token, file: files[id].file };
      await expectJSON(await call(sameOwner, id, '/import/preview', fields));
      const [key, payload, signature] = fields.file.split('.');
      const changed = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
      await expectJSON(await call(sameOwner, id, '/import/preview', { ...fields, file: [key, payload, changed].join('.') }),
        400, 'invalid-signature');
      assert.ok((await expectJSON(await call(sameOwner, id, '/export'))).file.startsWith('next.'));
      await expectJSON(await call(sameOwner, id, '/save', operation(current, 'after-restart')));
      await expectJSON(await call(sameOwner, id, '/import/preview', fields), 409, 'revision-conflict');
    }
    await expectJSON(await call(sameOwner, 'studio', '/import/preview', { token: sessions.studio.token, file: files.factory.file }),
      404, 'wrong-game');
    await expectJSON(await link(sameOwner, otherAfter), 409, 'idle-account-save-conflict');
    await expectJSON(await link(sameOwner, nextDevice));
    const copy = await expectJSON(await nextDevice.get('/api/me/export'));
    assert.deepEqual(copy.idleSaves.map(({ gameId }) => gameId).sort(), [...games].sort());
    assert.ok(copy.idleSaves.every(({ revision, savedAt }) => revision === 2 && savedAt === future));

    const folder = join(dir, 'idle', 'factory');
    const path = join(folder, readdirSync(folder)[0]);
    const healthy = readFileSync(path);
    writeFileSync(path, '{broken');
    await expectJSON(await call(nextDevice, 'factory'), 503, 'corrupt-save');
    assert.equal((await expectJSON(await call(nextDevice, 'studio'))).revision, 2);
    assert.equal((await expectJSON(await call(nextDevice, 'spielhalle'))).revision, 2);
    assert.equal(readFileSync(path, 'utf8'), '{broken');
    writeFileSync(path, healthy);
    const targetId = (await expectJSON(await nextDevice.get('/api/identity'))).gameId;
    await expectJSON(await nextDevice.post('/api/me/delete', { confirm: targetId }));
    for (const id of games) {
      await expectJSON(await call(sameOwner, id), 401, 'invalid-account');
      assert.equal(readdirSync(join(dir, 'idle', id)).length, id === 'studio' ? 1 : 0);
    }
    assert.equal((await expectJSON(await call(otherAfter, 'studio'))).revision, 1);
  } finally { await app.stop(); }
});

test('Gast-Savepoints, GET-Vorschau, explizite Tab-Übernahme, alte Revision und doppelter Save über den echten Server', { timeout: 45_000 }, async (t) => {
  const dir = temp(t), app = await start(dir);
  try {
    await expectJSON(await browser(app).get('/api/idle'), 401, 'site-access-required');
    const writer = await browser(app).login();
    const onlySite = browser(app, { pa_auth: writer.cookies.pa_auth });
    await expectJSON(await onlySite.get('/api/idle'), 401, 'invalid-account');
    const catalog = await writer.get('/api/idle');
    assert.equal(catalog.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await expectJSON(catalog), { games: ['fixture-idle'] });
    await expectJSON(await writer.post('/api/idle/studio/session'), 404, 'wrong-game');
    await expectJSON(await writer.post(game + '/session', { accountId: 'a'.repeat(32) }), 400, 'invalid-request');
    await expectJSON(await writer.get(game + '?accountId=foreign'), 400, 'invalid-request');
    await expectJSON(await writer.post(game + '/session', {}, { origin: 'https://different.test' }), 403, 'invalid-origin');
    const initial = await expectJSON(await writer.get(game));
    assert.equal(initial.savedAt, null);
    assert.equal(Object.hasOwn(initial, 'token'), false);
    let session = await open(writer);
    const tab = browser(app, writer.cookies);
    const readonly = await open(tab);
    assert.equal(readonly.readOnly, true);
    assert.equal(Object.hasOwn(readonly, 'token'), false);
    await expectJSON(await writer.post(game + '/session/heartbeat', { token: session.token }));
    await app.clock(epoch + 5000);
    const act = { ...operation(session, 'spend'), action: { spend: '2' } };
    const [first, again] = await Promise.all([writer.post(game + '/actions', act), writer.post(game + '/actions', act)]);
    const changed = await expectJSON(first);
    assert.deepEqual(await expectJSON(again), changed);
    await expectJSON(await writer.post(game + '/actions', { ...act, action: { spend: '1' } }), 409, 'operation-conflict');
    const fixed = { sessionId: readonly.sessionId, sessionVersion: readonly.sessionVersion, revision: readonly.revision, confirm: true };
    await expectJSON(await tab.post(game + '/takeover', fixed), 409, 'session-conflict');
    assert.equal(existsSync(inventory(dir)), false, 'Vorschau, Heartbeat und Kommandos machen keine dauerhafte Speicherung');
    session = { ...session, ...changed };
    const save = operation(session, 'manual');
    const [left, right] = await Promise.all([writer.post(game + '/export', save), writer.post(game + '/export', save)]);
    const exported = await expectJSON(left);
    assert.deepEqual(await expectJSON(right), exported);
    assert.equal(exported.revision, 1);
    const readSnapshot = await expectJSON(await writer.get(game));
    assert.equal(readSnapshot.view.data.units, '3');
    const takeover = { ...fixed, sessionVersion: changed.sessionVersion, revision: 1 };
    await expectJSON(await tab.post(game + '/takeover', { ...takeover, confirm: false }), 400, 'invalid-request');
    const second = await expectJSON(await tab.post(game + '/takeover', takeover));
    await expectJSON(await writer.post(game + '/save', { ...save, id: 'expired', revision: 1 }), 409, 'lease-conflict');
    const foreign = await browser(app).login();
    const foreignSession = await open(foreign);
    await expectJSON(await foreign.get(game, { 'x-idle-token': second.token }), 409, 'lease-conflict');
    await expectJSON(await foreign.post(game + '/import/preview', { token: foreignSession.token, file: exported.file }), 400, 'wrong-account');
    const [key, payload, signature] = exported.file.split('.');
    const damaged = [key, (payload[0] === 'a' ? 'b' : 'a') + payload.slice(1), signature].join('.');
    await expectJSON(await tab.post(game + '/import/preview', { token: second.token, file: damaged }), 400, 'invalid-signature');
    const preview = await expectJSON(await tab.post(game + '/import/preview', { token: second.token, file: exported.file }));
    await expectJSON(await tab.post(game + '/import/confirm', { token: second.token, previewId: preview.previewId, confirm: false }), 400, 'invalid-request');
    const confirm = { token: second.token, previewId: preview.previewId, confirm: true };
    const result = await expectJSON(await tab.post(game + '/import/confirm', confirm));
    assert.deepEqual(await expectJSON(await tab.post(game + '/import/confirm', confirm)), result);
    assert.equal(result.revision, 1);
    await expectJSON(await tab.post(game + '/save', operation({ ...second, ...result }, 'newer')));
    const stale = await expectJSON(await tab.post(game + '/import/preview', { token: second.token, file: exported.file }), 409, 'revision-conflict');
    assert.match(stale.error, /Ältere Sicherungen/);
    await app.clock(epoch + 5000, 300_001);
    await expectJSON(await tab.post(game + '/session/heartbeat', { token: second.token }), 409, 'lease-conflict');
    assert.equal((await open(tab)).revision, 2);
  } finally { await app.stop(); }
});

test('Neustart, persistiertes ACK, zehn Jahre Offline-Zeit und Vorgängerschlüssel', { timeout: 45_000 }, async (t) => {
  const dir = temp(t);
  let app = await start(dir);
  try {
    const guest = await browser(app).login();
    const session = await open(guest);
    await app.clock(epoch + 6000);
    const request = operation(session, 'restart-save');
    const saved = await expectJSON(await guest.post(game + '/export', request));
    const old = Buffer.from(saved.file.split('.')[1], 'base64url').toString('utf8');
    assert.ok(!old.includes(guest.cookies.pa_guest) && !old.includes(session.token) && !old.includes(oldKey.key));
    await app.clock(epoch + 8000);
    await expectJSON(await guest.post(game + '/actions', { ...operation({ ...session, revision: 1 }, 'lost'), action: { spend: '7' } }));
    await app.stop();
    app = await start(dir, { at: epoch + 10 * year, keys: keyring(nextKey.id, nextKey, oldKey) });
    const returned = browser(app, guest.cookies);
    const duplicate = await expectJSON(await returned.post(game + '/save', request));
    assert.deepEqual(duplicate, { revision: 1, savedAt: epoch + 6000 });
    assert.deepEqual(await expectJSON(await returned.post(game + '/export', request)), saved,
      'mit Vorgängerschlüssel kommt exakt dieselbe Datei zurück');
    const resumed = await open(returned);
    assert.equal(resumed.view.data.units, '315360000');
    const preview = await expectJSON(await returned.post(game + '/import/preview', { token: resumed.token, file: saved.file }));
    assert.equal(preview.revision, 1);
    assert.ok((await expectJSON(await returned.get(game + '/export'))).file.startsWith('next.'));
    await app.stop();
    app = await start(dir, { keys: keyring(nextKey.id, nextKey), at: epoch + 10 * year });
    const second = browser(app, guest.cookies);
    await expectJSON(await second.post(game + '/export', request), 409, 'export-key-retired');
    const fresh = await open(second);
    await expectJSON(await second.post(game + '/import/preview', { token: fresh.token, file: saved.file }), 400, 'unknown-key');
  } finally { await app.stop(); }
});

test('Fehlende und ungültige Schlüssel sperren die API. Eine zweite Instanz wird auch nach einem harten Abbruch abgewiesen', { timeout: 65_000 }, async (t) => {
  const dir = temp(t);
  let app = await start(dir, { keys: '' });
  try {
    const b = await browser(app).login();
    assert.deepEqual(await expectJSON(await b.get('/api/idle')), { games: [] });
    await expectJSON(await b.post(game + '/session'), 503, 'idle-unavailable');
    await start(dir, { failure: /storage-writer-exists/ });
    await app.stop();
    app = await start(dir, { keys: keyring(nextKey.id, { ...nextKey, key: '1234' }) });
    const reloaded = await browser(app, b.cookies).login();
    await expectJSON(await reloaded.post(game + '/session'), 503, 'idle-unavailable');
    await app.stop(true);
    await start(dir, { failure: /storage-writer-exists/ });
    // Simulate operator recovery only after both child processes have exited.
    rmdirSync(join(dir, 'idle', '.writer'));
    app = await start(dir);
    assert.equal((await open(await browser(app, b.cookies).login())).revision, 0);
  } finally { await app.stop(); }
});

test('Gerätewechsel übernimmt einen einzigen Stand, bewahrt zwei Konfliktstände und löscht alle Geräte-Aliase', { timeout: 45_000 }, async (t) => {
  const dir = temp(t);
  let app = await start(dir);
  try {
    const source = await browser(app).login();
    const target = await browser(app).login();
    const other = await browser(app).login();
    const sourceBeforeLink = { ...source.cookies };
    const sourceSession = await open(source);
    const otherSession = await open(other);
    await app.clock(epoch + 7000);
    const sourceFile = await expectJSON(await source.post(game + '/export', operation(sourceSession, 'source-save')));
    await expectJSON(await other.post(game + '/save', operation(otherSession, 'other-save')));
    await expectJSON(await link(source, other), 409, 'idle-account-save-conflict');
    assert.equal(readdirSync(inventory(dir)).length, 2);
    assert.equal((await expectJSON(await source.get(game + '/export'))).file, sourceFile.file);
    assert.equal((await expectJSON(await other.get(game))).revision, 1);
    const command = await expectJSON(await source.post(game + '/actions',
      { ...operation({ ...sourceSession, revision: 1 }, 'unsaved'), action: { spend: '1' } }));
    await expectJSON(await link(source, target), 409, 'idle-unsaved-actions');
    await expectJSON(await source.post(game + '/save', operation({ ...sourceSession, ...command, revision: 1 }, 'confirmed')));
    const sourceNewest = await expectJSON(await source.get(game + '/export'));
    const targetId = (await expectJSON(await target.get('/api/identity'))).gameId;
    await expectJSON(await link(source, target));
    assert.equal((await expectJSON(await browser(app, sourceBeforeLink).get('/api/identity'))).gameId, targetId);
    await expectJSON(await target.post(game + '/session/heartbeat', { token: sourceSession.token }), 409, 'lease-conflict');
    assert.equal((await expectJSON(await target.get(game))).revision, 2);
    const targetSession = await open(target);
    await expectJSON(await target.post(game + '/import/preview', { token: targetSession.token, file: sourceNewest.file }), 400, 'wrong-account');
    const confirmed = await expectJSON(await target.get('/api/me/export'));
    assert.equal(confirmed.idleSaves.length, 1);
    assert.deepEqual(confirmed.idleSaves[0], {
      gameId: 'fixture-idle', revision: 2, savedAt: epoch + 7000, stateVersion: 1, rulesVersion: 1, state: { units: '6', carry: 0 },
    });
    await app.stop();
    app = await start(dir, { at: epoch + 7000 });
    const restarted = browser(app, target.cookies);
    assert.equal((await expectJSON(await restarted.get(game))).view.data.units, '6');
    assert.equal((await expectJSON(await browser(app, sourceBeforeLink).get(game))).revision, 2);
    await expectJSON(await restarted.post('/api/me/delete', { confirm: targetId }));
    assert.equal(readdirSync(inventory(dir)).length, 1, 'der fremde Stand bleibt, der Alias-Stand wurde gelöscht');
    await expectJSON(await browser(app, sourceBeforeLink).get(game), 401, 'invalid-account');
    assert.equal((await expectJSON(await browser(app, other.cookies).get(game))).revision, 1);
    await app.stop();
    app = await start(dir, { at: epoch + 7000 });
    await expectJSON(await browser(app, sourceBeforeLink).get(game), 401, 'invalid-account');
    await expectJSON(await browser(app, target.cookies).get(game), 401, 'invalid-account');
    assert.equal(readdirSync(inventory(dir)).length, 1);
  } finally { await app.stop(); }
});

test('Fehlgeschlagener Konto-Commit lässt beide Konten getrennt. Ohne Spielregistrierung bleiben Export und Löschung für Bestandsdaten möglich', { timeout: 45_000 }, async (t) => {
  const dir = temp(t);
  let app = await start(dir);
  try {
    const source = await browser(app).login(), target = await browser(app).login();
    const fromId = (await expectJSON(await source.get('/api/identity'))).gameId;
    const toId = (await expectJSON(await target.get('/api/identity'))).gameId;
    const writer = await open(source);
    await expectJSON(await source.post(game + '/save', operation(writer, 'keep')));
    const tempPath = join(dir, 'accounts.json.tmp');
    mkdirSync(tempPath);
    await expectJSON(await link(source, target), 503, 'idle-storage-unavailable');
    rmdirSync(tempPath);
    assert.equal((await expectJSON(await source.get('/api/identity'))).gameId, fromId);
    assert.equal((await expectJSON(await target.get('/api/identity'))).gameId, toId);
    assert.equal((await expectJSON(await source.get(game))).revision, 1);
    assert.equal((await expectJSON(await target.get(game))).revision, 0);
    await app.stop();
    app = await start(dir, { modules: false });
    const owner = browser(app, source.cookies);
    assert.equal((await owner.get(game)).status, 404);
    assert.equal((await expectJSON(await owner.get('/api/me/export'))).idleSaves[0].revision, 1);
    await expectJSON(await owner.post('/api/me/delete', { confirm: fromId }));
    assert.deepEqual(readdirSync(inventory(dir)), []);
  } finally { await app.stop(); }
});

test('Beschädigte oder nicht schreibbare Saves bleiben erhalten und geben keine internen Fehlerdaten aus', { timeout: 45_000 }, async (t) => {
  const dir = temp(t), app = await start(dir);
  try {
    const b = await browser(app).login();
    const current = await open(b);
    writeFileSync(inventory(dir), 'reserviert');
    const req = operation(current, 'write');
    const blocked = await expectJSON(await b.post(game + '/save', req), 503, 'storage-unavailable');
    assert.doesNotMatch(JSON.stringify(blocked), /poker-idle-integration|\.json/);
    assert.equal(readFileSync(inventory(dir), 'utf8'), 'reserviert');
    rmSync(inventory(dir));
    await expectJSON(await b.post(game + '/save', req));
    const file = join(inventory(dir), readdirSync(inventory(dir))[0]);
    writeFileSync(file, '{unvollständig');
    await expectJSON(await b.get(game), 503, 'corrupt-save');
    await expectJSON(await b.get('/api/me/export'), 503, 'idle-storage-unavailable');
    assert.equal(readFileSync(file, 'utf8'), '{unvollständig');
  } finally { await app.stop(); }
});

test('Bestandsdaten ohne lesbares Konto-Verzeichnis sperren den Start bis zur konsistenten Wiederherstellung', { timeout: 45_000 }, async (t) => {
  const dir = temp(t);
  let app = await start(dir);
  try {
    const owner = await browser(app).login();
    await expectJSON(await owner.post(game + '/save', operation(await open(owner), 'verified')));
    await app.stop();
    const accountFile = join(dir, 'accounts.json');
    const accounts = readFileSync(accountFile);
    const record = join(inventory(dir), readdirSync(inventory(dir))[0]);
    const contents = readFileSync(record);
    rmSync(accountFile);
    await start(dir, { failure: /identity-store-unavailable/ });
    writeFileSync(accountFile, '{kaputt');
    await start(dir, { failure: /identity-store-unavailable/ });
    assert.deepEqual(readFileSync(record), contents);
    writeFileSync(accountFile, accounts);
    app = await start(dir);
    assert.equal((await expectJSON(await browser(app, owner.cookies).get(game))).revision, 1);
  } finally { await app.stop(); }
});

test('Registriertes Konto per Test-Discord nutzt denselben Stand weiterhin als Gast mit gültigem Seitenzugang', { timeout: 45_000 }, async (t) => {
  const dir = temp(t), discord = await fakeDiscord();
  const user = '100000000000000099';
  discord.user(user, 'Idle Testkonto');
  let app;
  try {
    app = await start(dir, { discord });
    const b = await browser(app).login();
    const oauth = await b.get('/auth/discord/link');
    assert.equal(oauth.status, 303);
    const back = discord.authorize(oauth.headers.get('location'), { user });
    assert.equal((await b.get(back.pathname + back.search)).status, 303);
    assert.equal((await expectJSON(await b.get('/api/me/settings'))).registered, true);
    const session = await open(b);
    await expectJSON(await b.post(game + '/save', operation(session, 'connected')));
    await expectJSON(await b.post('/auth/discord/logout'));
    assert.equal((await expectJSON(await b.get('/auth/discord/status'))).active, false);
    assert.equal((await expectJSON(await b.get(game))).revision, 1);
    const stranger = await browser(app).login();
    assert.equal((await expectJSON(await stranger.get(game))).revision, 0);
    const other = await open(stranger);
    await expectJSON(await stranger.post(game + '/save', operation(other, 'another-account')));
    const linkRequest = await stranger.get('/auth/discord/link');
    const conflict = discord.authorize(linkRequest.headers.get('location'), { user });
    const prompt = await stranger.get(conflict.pathname + conflict.search);
    assert.match(prompt.headers.get('location'), /discord=conflict/);
    await expectJSON(await stranger.post('/auth/discord/merge', { confirm: true }), 409, 'idle-account-save-conflict');
    assert.notEqual((await expectJSON(await stranger.get('/api/identity'))).gameId,
      (await expectJSON(await b.get('/api/identity'))).gameId);
    assert.equal(readdirSync(inventory(dir)).length, 2);
  } finally {
    await app?.stop();
    discord.server.close();
  }
});
