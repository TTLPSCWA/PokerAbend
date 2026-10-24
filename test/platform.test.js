// Plattform für mehrere Spiele: Spielart beim Erstellen und Beitreten, Ereignisse nur an den Richtigen, Speichern mit Spielart.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { GAMES, gameList, gameEvents } from '../games/index.js';
import { BaseRoom } from '../server/base-room.js';

const PORT = 4300 + Math.floor(Math.random() * 50); // eigener Bereich: 4300–4349
const URL = `http://localhost:${PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), 'poker-platform-'));
let server;
before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: '' }, stdio: 'pipe',
  });
  await new Promise((res, rej) => {
    server.stdout.on('data', (d) => { if (String(d).includes('läuft')) res(); });
    server.on('exit', (c) => rej(new Error('Server beendet: ' + c)));
  });
});
after(() => server.kill());

function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.state = null; s.nudges = [];
  s.on('state', (st) => { s.state = st; });
  s.on('nudge', (n) => s.nudges.push(n));
  s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
  return s;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return; await wait(25); }
  throw new Error('Zeitüberschreitung');
}

test('Spielmodule: Beschreibung für die Startseite, eigene Ereignisse, gemeinsame Grundlage', () => {
  const poker = GAMES.poker;
  assert.equal(gameList()[0].id, 'poker');
  assert.ok(gameList()[0].createFields.length >= 3);
  assert.ok(gameEvents().includes('action'));
  for (const e of ['create', 'join', 'kick', 'makeHost', 'history', 'react']) assert.ok(!(e in poker.events), `${e} gehört der Plattform`);
  const r = poker.create('ABCDE', {}, () => {});
  assert.ok(r instanceof BaseRoom, 'Poker baut auf der gemeinsamen Grundlage auf');
  r.dispose();
});

test('Erstellen und Beitreten melden die Spielart, unbekannte Spiele gibt es nicht', async () => {
  const a = client(); const b = client();
  assert.match((await a.ask('create', { game: 'schach', name: 'Anna' })).error, /gibt es nicht/);
  const c = await a.ask('create', { game: 'poker', name: 'Anna', settings: { autoNext: false } });
  assert.ok(c.ok, c.error);
  assert.equal(c.game, 'poker');
  const old = await b.ask('create', { name: 'Ohne Angabe' }); // alte Browser schicken keine Spielart
  assert.equal(old.game, 'poker');
  const j = await b.ask('join', { code: c.code, name: 'Ben' });
  assert.equal(j.game, 'poker');
  a.disconnect(); b.disconnect();
});

test('Anstupsen kommt nur beim Angestupsten an', async () => {
  const [a, b, c] = [client(), client(), client()];
  const r = await a.ask('create', { name: 'Anna', settings: { autoNext: false, turnTime: 0 } });
  await b.ask('join', { code: r.code, name: 'Ben' });
  await c.ask('join', { code: r.code, name: 'Carla' });
  for (const [s, seat] of [[a, 0], [b, 1], [c, 2]]) assert.ok((await s.ask('sit', { seat })).ok);
  assert.ok((await a.ask('start')).ok);
  await until(() => [a, b, c].some((s) => s.state?.legal));
  const target = [a, b, c].find((s) => s.state.legal);
  const others = [a, b, c].filter((s) => s !== target);
  const res = await others[0].ask('nudge', { id: target.state.you.id });
  assert.ok(res.ok, res.error);
  await until(() => target.nudges.length === 1);
  assert.equal(target.nudges[0].from, others[0].state.you.name);
  assert.ok(target.nudges[0].text);
  assert.equal('to' in target.nudges[0], false);
  await wait(150);
  assert.deepEqual(others.map((s) => s.nudges.length), [0, 0], 'die anderen bekommen nichts');
  // Nach der Hand steht die Spielart im Spielstand
  await target.ask('action', { type: 'fold', id: 'f1' });
  while (!target.state.hand.done) {
    const s = [a, b, c].find((x) => x.state.legal);
    if (s) await s.ask('action', { type: 'fold', id: 'f' + Math.random() });
    await wait(30);
  }
  await wait(600);
  const saved = JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8'));
  assert.equal(saved.find((x) => x.code === r.code).game, 'poker');
  assert.ok(existsSync(join(dataDir, `history-${r.code}.json`)));
  for (const s of [a, b, c]) s.disconnect();
});
