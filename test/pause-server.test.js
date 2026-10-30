import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';

let server, url;
before(async () => {
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('PAUSE_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: mkdtempSync(join(tmpdir(), 'pause-')), POKER_NO_DOTENV: '1', SITE_PASSWORD: '', CREATE_LIMIT: '20' }, stdio: 'pipe' });
  url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Testserver startet nicht')), 15000);
    server.once('error', reject);
    server.once('exit', () => { clearTimeout(timeout); reject(new Error('Testserver beendet')); });
    server.stdout.on('data', (data) => { const match = String(data).match(/PAUSE_READY:(\d+)/); if (match) { clearTimeout(timeout); resolve('http://localhost:' + match[1]); } });
  });
});
after(() => server?.kill());
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check) {
  for (let n = 0; n < 150; n++) { if (check()) return; await wait(20); }
  throw new Error('Zustand kommt nicht an');
}
function client() {
  const socket = io(url, { transports: ['websocket'], forceNew: true });
  socket.on('state', (state) => { socket.state = state; });
  socket.ask = (event, data = {}) => new Promise((resolve) => socket.timeout(5000).emit(event, data, (error, result) => resolve(error ? { ok: false, error: error.message } : result)));
  return socket;
}

for (const game of ['maumau', 'schaetzmeister', 'pfeilfieber', 'kronenjagd']) {
  test(`${game}: Host-Pause gilt über Socket für alle, Reconnect und Hostwechsel`, async () => {
    const a = client(), b = client(), watcher = client();
    try {
      const created = await a.ask('create', { game, name: 'Anna' }); assert.ok(created.ok, created.error);
      const joined = await b.ask('join', { code: created.code, name: 'Ben' }); assert.ok(joined.ok, joined.error);
      assert.ok((await watcher.ask('join', { code: created.code, name: 'Zuschauer' })).ok);
      assert.equal((await a.ask('gamePause', { paused: true })).ok, false, 'vor Spielstart keine Pause');
      await a.ask('sit'); await b.ask('sit'); assert.ok((await a.ask('start')).ok);
      assert.equal((await b.ask('gamePause', { paused: true })).ok, false);
      assert.equal((await watcher.ask('gamePause', { paused: true })).ok, false);
      assert.equal((await a.ask('gamePause', { paused: 'true' })).ok, false);
      assert.ok((await a.ask('gamePause', { paused: true })).ok);
      await until(() => a.state?.gamePaused && b.state?.gamePaused && watcher.state?.gamePaused);
      const before = structuredClone(a.state);
      assert.ok((await a.ask('gamePause', { paused: true })).ok);
      for (const event of ['start', 'settings', 'programStart', 'programNext', 'switchGame', 'addBot', 'sit', 'stand']) {
        const result = await a.ask(event, { game: 'kniffel' });
        assert.equal(result.ok, false, event); assert.match(result.error, /angehalten/, event);
      }
      await wait(250);
      b.disconnect(); b.connect();
      assert.ok((await b.ask('join', { code: created.code, token: joined.token })).ok);
      await until(() => b.state?.gamePaused && a.state.players.find((p) => p.name === 'Ben')?.connected);
      assert.equal(a.state.now, before.now);
      assert.deepEqual(a.state.g, before.g, 'automatische Züge und Stufen bleiben stehen');
      const newHost = b.state.you.id;
      assert.ok((await a.ask('makeHost', { id: newHost })).ok);
      assert.equal((await a.ask('gamePause', { paused: false })).ok, false, 'alter Host kann nicht fortsetzen');
      assert.ok((await b.ask('gamePause', { paused: false })).ok);
      await until(() => !b.state.gamePaused && !watcher.state.gamePaused);
      assert.ok((await b.ask('gamePause', { paused: true })).ok);
      assert.ok((await b.ask('abortRound')).ok, 'Abbrechen bleibt möglich');
      await until(() => !b.state.gamePaused && b.state.phase !== 'playing');
      assert.ok((await b.ask('closeTable')).ok);
    } finally { a.disconnect(); b.disconnect(); watcher.disconnect(); }
  });
}
