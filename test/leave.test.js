// Raum verlassen: „Platz behalten“ (park) und „Tisch verlassen“ (leave) – mit und ohne laufende Runde, letzter Spieler schließt den Raum.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';

let URL;
const dataDir = mkdtempSync(join(tmpdir(), 'poker-leave-'));
let server;
before(async () => {
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('LEAVE_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], {
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: '', CREATE_LIMIT: '500' }, stdio: 'pipe',
  });
  let output = '';
  await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('Testserver startet nicht: ' + output)), 12000);
    server.stderr.on('data', (d) => { output += d; });
    server.stdout.on('data', (d) => { output += d; const match = output.match(/LEAVE_READY:(\d+)/); if (match) { URL = 'http://localhost:' + match[1]; clearTimeout(timer); res(); } });
    server.once('error', (e) => { clearTimeout(timer); rej(e); });
    server.once('exit', (c) => { clearTimeout(timer); rej(new Error(`Server beendet (${c}): ${output}`)); });
  });
});
after(() => server.kill());

const clients = [];
function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.state = null;
  s.on('state', (st) => { s.state = st; });
  s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
  clients.push(s);
  return s;
}
after(() => clients.forEach((c) => c.close()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await wait(25); }
  throw new Error('Zeitüberschreitung');
}
const peek = (c, t) => c.ask('peek', { code: t.code, token: t.token });

async function table(game = 'maumau', names = ['Anna', 'Ben']) {
  const cs = names.map(() => client());
  const t = await cs[0].ask('create', { game, name: names[0] });
  assert.ok(t.ok);
  const joins = [t];
  for (let i = 1; i < cs.length; i++) { const j = await cs[i].ask('join', { code: t.code, name: names[i] }); assert.ok(j.ok); joins.push(j); }
  for (const c of cs) await c.ask('sit');
  return { cs, code: t.code, joins };
}

test('Platz behalten: der Spieler ist offline, der Tisch bleibt auffindbar, mit Token geht es zurück', async () => {
  const { cs: [a, b], code, joins } = await table();
  const r = await b.ask('park');
  assert.ok(r.ok);
  await until(() => a.state?.players.find((p) => p.name === 'Ben')?.connected === false);
  assert.equal((await peek(b, joins[1])).found, true, 'Weiterspielen zeigt den Tisch');
  const back = await b.ask('join', { code, token: joins[1].token });
  assert.ok(back.ok);
  await until(() => a.state?.players.find((p) => p.name === 'Ben')?.connected === true);
});

test('Tisch verlassen ohne laufende Runde: Platz ist frei, Tisch bleibt für die anderen', async () => {
  const { cs: [a, b], code, joins } = await table();
  const r = await b.ask('leave');
  assert.ok(r.ok);
  await until(() => !a.state?.players.some((p) => p.name === 'Ben'));
  assert.equal((await peek(b, joins[1])).found, false, 'kein Weiterspielen mehr');
  const again = await client().ask('join', { code, name: 'Cleo' });
  assert.ok(again.ok);
});

test('Tisch verlassen in laufender Runde: Runde läuft für die anderen weiter', async () => {
  const { cs: [a, b, c] } = await table('maumau', ['Anna', 'Ben', 'Cara']);
  await a.ask('start');
  await until(() => a.state?.phase === 'playing');
  const r = await b.ask('leave');
  assert.ok(r.ok);
  await until(() => !a.state?.players.some((p) => p.name === 'Ben'));
  assert.equal(a.state.phase, 'playing');
  assert.ok(c.state);
});

test('Host verlässt den Tisch: die Host-Rolle geht an den Nächsten', async () => {
  const { cs: [a, b] } = await table();
  await a.ask('leave');
  await until(() => b.state?.players.find((p) => p.name === 'Ben')?.isHost);
});

test('Allein am Tisch: Verlassen schließt den Raum sofort, der Code ist danach ungültig', async () => {
  const c = client();
  const t = await c.ask('create', { game: 'maumau', name: 'Solo' });
  await c.ask('sit');
  assert.ok((await c.ask('leave')).ok);
  const j = await client().ask('join', { code: t.code, name: 'Neu' });
  assert.equal(j.ok, false);
});

test('Alle anderen sind offline: Verlassen schließt den Raum', async () => {
  const { cs: [a, b], code } = await table();
  await b.ask('park');
  await until(() => a.state?.players.find((p) => p.name === 'Ben')?.connected === false);
  assert.ok((await a.ask('leave')).ok);
  const j = await client().ask('join', { code, name: 'Neu' });
  assert.equal(j.ok, false);
});

test('Weiterspielen erscheint nach Platz behalten und verschwindet nach Verlassen', async () => {
  const { cs: [, b], joins } = await table();
  await b.ask('park');
  assert.equal((await peek(client(), joins[1])).found, true);
  await b.ask('join', { code: joins[1].code, token: joins[1].token });
  await b.ask('leave');
  assert.equal((await peek(client(), joins[1])).found, false);
});
