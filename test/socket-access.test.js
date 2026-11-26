// SEC-SOCKET-01: Der Seitenzugang einer Socket-Verbindung wird bei jedem Paket und für ruhige Verbindungen
// regelmäßig neu geprüft. Testfälle K01–K03 und K05–K08 (K04 Discord: test/discord.test.js).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, createHmac } from 'node:crypto';
import { io } from 'socket.io-client';
import { createSocketAccess, ACCESS_EXPIRED } from '../server/socket-access.js';
import { freePort } from './free-port.js';

const PASSWORD = 'Socket2026';
const SECRET = 'socket-access-test-secret';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return; await wait(50); } throw new Error('Zeitüberschreitung'); }

// ---------- Unit: Modul ohne Server ----------
function fakeSocket(cookieValid = true) {
  const handlers = {}, uses = [], emitted = [];
  return {
    data: {}, valid: cookieValid, emitted, disconnected: false,
    on: (ev, fn) => { (handlers[ev] ||= []).push(fn); },
    use: (fn) => uses.push(fn),
    emit: (ev, payload) => emitted.push([ev, payload]),
    disconnect() { this.disconnected = true; (handlers.disconnect || []).forEach((fn) => fn()); },
    send(packet) { let passed = null; uses.forEach((fn) => fn(packet, (err) => { passed = err || 'next'; })); return passed; },
  };
}

test('Modul: gültige Pakete gehen durch, ungültige werden abgelehnt, gemeldet und getrennt', () => {
  const access = createSocketAccess({ valid: (s) => s.valid });
  const s = fakeSocket();
  access.attach(s);
  assert.equal(s.send(['lobby', {}, () => {}]), 'next');
  s.valid = false;
  let answer = null;
  const result = s.send(['lobby', {}, (a) => { answer = a; }]);
  assert.ok(result instanceof Error && result.message === ACCESS_EXPIRED);
  assert.deepEqual(answer, { ok: false, code: ACCESS_EXPIRED, error: 'Bitte melde dich erneut an.' });
  assert.deepEqual(s.emitted, [['auth-expired', { code: ACCESS_EXPIRED }]]);
  assert.equal(s.disconnected, true);
  s.valid = true;
  assert.ok(s.send(['lobby', {}]) instanceof Error, 'einmal gesperrt bleibt gesperrt, auch wenn die Prüfung wieder gelänge');
  assert.equal(access.size, 0, 'getrennte Verbindungen werden nicht weiter beobachtet');
});

test('Modul: Sweep, gezielter Widerruf, Fehler in der Prüfung sperren, sweepSoon ohne Rekursion', async () => {
  let throwing = false;
  const access = createSocketAccess({ valid: (s) => { if (throwing) throw new Error('kaputt'); return s.valid; } });
  const a = fakeSocket(), b = fakeSocket(), c = fakeSocket();
  [a, b, c].forEach((s) => access.attach(s));
  b.valid = false;
  assert.equal(access.sweep(), 1);
  assert.equal(b.disconnected, true); assert.equal(a.disconnected, false);
  a.data.ref = 'x';
  assert.equal(access.revoke((s) => s.data.ref === 'x'), 1, 'Schnittstelle für SEC-SESSION-01');
  assert.equal(a.disconnected, true); assert.equal(c.disconnected, false);
  throwing = true;
  access.sweepSoon(); access.sweepSoon();
  await wait(20);
  assert.equal(c.disconnected, true, 'eine fehlerhafte Prüfung sperrt statt durchzulassen');
  assert.equal(c.emitted.length, 1, 'nur einmal gemeldet');
});

// ---------- Integration: echter Server ----------
async function startServer(env = {}, dataDir = mkdtempSync(join(tmpdir(), 'socket-access-'))) {
  const port = await freePort(), url = `http://localhost:${port}`;
  const proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: PASSWORD, SESSION_SECRET: SECRET, SOCKET_ACCESS_SWEEP_MS: '300', CREATE_LIMIT: '500', ...env },
    stdio: 'pipe',
  });
  let log = '';
  proc.stderr.on('data', (d) => { log += d; });
  await new Promise((res, rej) => { proc.stdout.on('data', (d) => { log += d; if (String(d).includes('läuft')) res(); }); proc.on('exit', (c) => rej(new Error('Server beendet: ' + c + log))); });
  proc.removeAllListeners('exit');
  const exited = new Promise((r) => proc.once('exit', r));
  return { url, dataDir, stop: () => { if (proc.exitCode === null && !proc.killed) proc.kill(); return exited; } };
}
const login = async (app) => {
  const r = await fetch(app.url + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: PASSWORD }) });
  return r.headers.get('set-cookie').split(';')[0];
};
// Gruppen-Cookie mit selbst gewähltem Ablauf, im Format von server/security.js (Test kennt Passwort und Secret)
function cookieUntil(exp) {
  const tag = createHash('sha256').update('pw:' + PASSWORD).digest('hex').slice(0, 16);
  const sig = createHmac('sha256', SECRET).update(`${exp}.${tag}`).digest('base64url');
  return `pa_auth=${encodeURIComponent(`${exp}.${sig}`)}`;
}
const sockets = [];
function connect(app, cookie) {
  return new Promise((resolve) => {
    const s = io(app.url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: cookie ? { cookie } : {} });
    sockets.push(s);
    s.expired = false; s.reactions = [];
    s.on('auth-expired', () => { s.expired = true; });
    s.on('state', (st) => { s.state = st; });
    s.on('reaction', (r) => s.reactions.push(r));
    s.ask = (event, payload = {}) => s.timeout(3000).emitWithAck(event, payload).catch(() => ({ ok: false, error: 'keine Antwort' }));
    s.on('connect', () => resolve({ ok: true, s }));
    s.on('connect_error', (e) => resolve({ ok: false, error: e.message, s }));
  });
}
const open = async (app, cookie) => { const r = await connect(app, cookie); assert.equal(r.ok, true, 'Verbindung: ' + r.error); return r.s; };

let app;
before(async () => { app = await startServer(); });
after(async () => { sockets.forEach((s) => s.close()); await app?.stop(); });

test('Basis und Handshake: gültige Verbindung spielt; ohne, mit abgelaufenem oder gefälschtem Cookie keine Verbindung', async () => {
  const cookie = await login(app);
  const s = await open(app, cookie);
  const table = await s.ask('create', { game: 'viergewinnt', name: 'Basis' });
  assert.equal(table.ok, true, table.error);
  assert.equal((await connect(app, '')).ok, false);
  assert.equal((await connect(app, cookieUntil(Date.now() - 1000))).ok, false, 'abgelaufen');
  assert.equal((await connect(app, cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')))).ok, false, 'verändert');
});

test('K02: nach Ablauf wird jedes Ereignis abgelehnt – Spielereignis, history, react, clientError', async () => {
  // eigener Server ohne kurzen Durchlauf: hier wird nur die Prüfung je Paket nachgewiesen (K03 prüft den Durchlauf)
  const perPacket = await startServer({ SOCKET_ACCESS_SWEEP_MS: '600000' });
  try {
    const expires = Date.now() + 6000, short = cookieUntil(expires);
    const host = await open(perPacket, short);
    const table = await host.ask('create', { game: 'viergewinnt', name: 'Läuft ab' });
    assert.equal(table.ok, true, table.error);
    const observer = await open(perPacket, await login(perPacket));
    assert.equal((await observer.ask('join', { code: table.code, name: 'Zuschauer' })).ok, true);
    // gleiche (bald abgelaufene) Anmeldung, weitere Verbindungen, die alle am Tisch sitzen
    const viaHistory = await open(perPacket, short), viaReact = await open(perPacket, short), viaError = await open(perPacket, short);
    for (const [s, name] of [[viaHistory, 'H'], [viaReact, 'R'], [viaError, 'E']]) assert.equal((await s.ask('join', { code: table.code, name })).ok, true);
    await wait(Math.max(0, expires - Date.now()) + 150);
    const lobby = await host.ask('lobby');
    assert.equal(lobby.ok, false); assert.equal(lobby.code, ACCESS_EXPIRED);
    const history = await viaHistory.ask('history');
    assert.equal(history.code, ACCESS_EXPIRED, 'history liegt außerhalb des Spiel-Handlers und wird trotzdem geprüft');
    viaReact.emit('react', { text: 'GG' });
    viaError.emit('clientError', { message: 'Test', where: 'socket-access' });
    for (const s of [host, viaHistory, viaReact, viaError]) await until(() => s.expired && !s.connected);
    await wait(200);
    assert.deepEqual(observer.reactions, [], 'die abgelaufene Verbindung konnte keine Reaktion senden');
  } finally { await perPacket.stop(); }
});

test('K03: ruhige Verbindung wird nach Ablauf getrennt; Platz und Spielstand bleiben (offline)', async () => {
  const observer = await open(app, await login(app));
  const host = await open(app, await login(app));
  const table = await host.ask('create', { game: 'viergewinnt', name: 'Host' });
  const expires = Date.now() + 3000, sleeper = await open(app, cookieUntil(expires));
  const seat = await sleeper.ask('join', { code: table.code, name: 'Schläfer' });
  assert.equal(seat.ok, true);
  assert.equal((await observer.ask('join', { code: table.code, name: 'Beobachter' })).ok, true);
  await until(() => sleeper.expired && !sleeper.connected, Math.max(0, expires - Date.now()) + 3000);
  await until(() => observer.state?.players?.some((p) => p.name === 'Schläfer' && p.connected === false));
  assert.ok(observer.state.players.some((p) => p.name === 'Host' && p.connected), 'die anderen spielen weiter');
});

test('K01/K05: Logout sperrt alle offenen Verbindungen dieser Anmeldung sofort; andere Anmeldungen bleiben', async () => {
  const mine = await login(app); await wait(5);
  const other = await login(app);
  assert.notEqual(mine, other);
  const tabA = await open(app, mine), tabB = await open(app, mine), elsewhere = await open(app, other);
  const r = await fetch(app.url + '/logout', { method: 'POST', redirect: 'manual', headers: { cookie: mine } });
  assert.equal(r.status, 303);
  await until(() => tabA.expired && tabB.expired && !tabA.connected && !tabB.connected, 2000);
  assert.equal((await elsewhere.ask('lobby')).ok, true, 'die andere Anmeldung spielt weiter');
  assert.equal((await connect(app, mine)).ok, false, 'das abgemeldete Cookie öffnet keine neue Verbindung');
});

test('K01b: Logout in Tab 2 sperrt auch Tab 1 desselben Browsers, obwohl dessen Cookie-Wert älter ist', async () => {
  const v1 = await login(app);
  await wait(5);
  const page = await fetch(app.url + '/', { redirect: 'manual', headers: { cookie: v1 } }); // Seitenaufruf: neues Cookie und Gastidentität
  const set = page.headers.getSetCookie();
  const v2 = set.find((c) => c.startsWith('pa_auth=')).split(';')[0];
  const guest = set.find((c) => c.startsWith('pa_guest=')).split(';')[0];
  assert.notEqual(v1, v2, 'jeder Seitenaufruf stellt das Gruppen-Cookie neu aus (heutiges Verhalten bis SEC-SESSION-01)');
  const tab1 = await open(app, `${v1}; ${guest}`), tab2 = await open(app, `${v2}; ${guest}`);
  const unrelated = await open(app, await login(app));
  await fetch(app.url + '/logout', { method: 'POST', redirect: 'manual', headers: { cookie: `${v2}; ${guest}` } });
  await until(() => tab1.expired && tab2.expired && !tab1.connected && !tab2.connected, 2000);
  assert.equal((await unrelated.ask('lobby')).ok, true);
});

test('K07: nach Neuanmeldung übernimmt der Spieler seinen Platz mit dem Token; normaler Reconnect unverändert', async () => {
  const first = await login(app);
  const host = await open(app, await login(app));
  const table = await host.ask('create', { game: 'viergewinnt', name: 'Host' });
  const player = await open(app, first);
  const seat = await player.ask('join', { code: table.code, name: 'Rückkehrer' });
  // normaler Verbindungsabbruch ohne Logout
  player.close();
  const back = await open(app, first);
  const again = await back.ask('join', { code: table.code, token: seat.token });
  assert.equal(again.ok, true); assert.equal(again.token, seat.token);
  // Logout, Neuanmeldung, Wiederaufnahme mit dem gespeicherten Token
  await fetch(app.url + '/logout', { method: 'POST', redirect: 'manual', headers: { cookie: first } });
  await until(() => back.expired);
  const fresh = await open(app, await login(app));
  const resumed = await fresh.ask('join', { code: table.code, token: seat.token });
  assert.equal(resumed.ok, true, resumed.error); assert.equal(resumed.token, seat.token, 'derselbe Platz');
  await until(() => host.state?.players?.filter((p) => p.name === 'Rückkehrer').length === 1 && host.state.players.find((p) => p.name === 'Rückkehrer').connected);
});

test('Neustart: Räume und Platz-Tokens bleiben, gültige Anmeldungen funktionieren weiter', async () => {
  const restartable = await startServer();
  try {
    const cookie = await login(restartable);
    const host = await open(restartable, cookie);
    const table = await host.ask('create', { game: 'viergewinnt', name: 'Vor dem Neustart' });
    await wait(600); // Speichern ist entprellt
    host.close();
    await restartable.stop();
    const again = await startServer({}, restartable.dataDir);
    try {
      const s = await open(again, cookie);
      const back = await s.ask('join', { code: table.code, token: table.token });
      assert.equal(back.ok, true, back.error); assert.equal(back.token, table.token);
    } finally { await again.stop(); }
  } finally { await restartable.stop().catch(() => {}); }
});

test('K06: nach Passwortwechsel und Neustart öffnet ein altes Gruppen-Cookie keine Verbindung mehr', async () => {
  const before = await startServer();
  const cookie = await login(before);
  await before.stop();
  const changed = await startServer({ SITE_PASSWORD: PASSWORD + '-neu' }, before.dataDir);
  try {
    assert.equal((await connect(changed, cookie)).ok, false);
  } finally { await changed.stop(); }
});

test('K08: ohne Gruppenpasswort (offener Modus) bleibt alles wie bisher', async () => {
  const openApp = await startServer({ SITE_PASSWORD: '' });
  try {
    const s = await open(openApp, '');
    assert.equal((await s.ask('create', { game: 'viergewinnt', name: 'Offen' })).ok, true);
    await wait(800);
    assert.equal(s.connected, true); assert.equal(s.expired, false);
    assert.equal((await s.ask('lobby')).ok, true);
  } finally { await openApp.stop(); }
});
