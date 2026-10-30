import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { io } from 'socket.io-client';

async function until(fn, ms = 6000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { if (fn()) return; await wait(20); }
  throw new Error('Zeitüberschreitung');
}
async function start(dataDir) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('PROGRAM_READY:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(output)), 12000);
    child.stderr.on('data', (d) => { output += d; });
    child.once('error', (e) => { clearTimeout(timer); reject(e); });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server beendet (${code}): ${output}`)); });
    child.stdout.on('data', (d) => { output += d; const match = output.match(/PROGRAM_READY:(\d+)/); if (match) { clearTimeout(timer); resolve('http://localhost:' + match[1]); } });
  });
  return { url, stop: async () => { if (child.exitCode === null && child.signalCode === null) { const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited; } } };
}
async function client(url) {
  const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  socket.state = null;
  socket.on('state', (S) => { socket.state = S; });
  socket.ask = (event, data = {}) => new Promise((resolve, reject) => socket.timeout(5000).emit(event, data, (err, reply) => err ? reject(err) : resolve(reply)));
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}

test('Programm über WebSocket: Rechte, Spielwechsel, Tokens, Speichern, Neustart, Wiederholung und Siegerehrung', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'party-program-'));
  let server = await start(dir);
  const clients = [];
  try {
    let a = await client(server.url), b = await client(server.url), z = await client(server.url); clients.push(a, b, z);
    const created = await a.ask('create', { game: 'schaetzmeister', name: 'Anna' });
    const joined = await b.ask('join', { code: created.code, name: 'Ben' });
    await z.ask('join', { code: created.code, name: 'Zoe' });
    await a.ask('sit'); await b.ask('sit');
    await a.ask('custom', { text: 'Wie lautet die Geheimzahl? | 987654321 | Punkte' });
    const config = { name: 'Test-Abend', mode: 'playlist', entries: [{ game: 'schaetzmeister', settings: { rounds: 1 } }, { game: 'zahlenzoo', settings: { rounds: 1 } }] };
    assert.equal((await b.ask('programSave', config)).ok, false);
    assert.ok((await a.ask('programSave', config)).ok);
    assert.ok((await a.ask('programStart')).ok);
    await until(() => a.state?.phase === 'playing' && a.state.partyProgram?.status === 'running');
    assert.equal((await z.ask('sit')).ok, false);
    assert.equal((await a.ask('programNext')).ok, false);
    assert.equal((await a.ask('switchGame', { game: 'zahlenzoo' })).ok, false);
    assert.ok(!JSON.stringify(b.state.partyProgram).includes('987654321'));
    await a.ask('guess', { text: '987654321' }); await b.ask('guess', { text: '1' });
    await until(() => a.state.g.stage === 'reveal');
    await a.ask('next');
    await until(() => a.state.partyProgram.status === 'between');
    assert.equal(a.state.partyProgram.standings[0].name, 'Anna');
    assert.equal(a.state.partyProgram.standings[0].points, 2);
    await until(() => { try { return JSON.parse(readFileSync(join(dir, 'rooms.json'), 'utf8'))[0]?.partyProgram?.status === 'between'; } catch { return false; } });
    a.close(); b.close(); z.close(); await server.stop();
    server = await start(dir);
    a = await client(server.url); b = await client(server.url); clients.push(a, b);
    assert.ok((await a.ask('join', { code: created.code, token: created.token })).ok);
    assert.ok((await b.ask('join', { code: created.code, token: joined.token })).ok);
    assert.equal(a.state.partyProgram.results.length, 1);
    assert.ok((await a.ask('programNext')).ok);
    await until(() => a.state.game === 'zahlenzoo' && a.state.phase === 'playing');
    const id = a.state.you.id;
    assert.equal(a.state.code, created.code);
    assert.equal(a.state.partyProgram.index, 1);
    assert.ok((await a.ask('abortRound')).ok);
    assert.equal(a.state.partyProgram.results.length, 1);
    assert.ok((await a.ask('programNext')).ok, 'abgebrochene Station wiederholen');
    assert.equal(a.state.partyProgram.index, 1);
    assert.equal(a.state.you.id, id);
    await a.ask('next'); await a.ask('next');
    await until(() => a.state.partyProgram.status === 'done');
    assert.equal(a.state.partyProgram.results.length, 2);
    assert.equal(a.state.partyProgram.standings.find((p) => p.name === 'Anna').points, 2);
    assert.deepEqual(a.state.partyProgram.winners, ['Anna']);
    assert.ok((await a.ask('programStop')).ok);
    assert.ok((await a.ask('switchGame', { game: 'maumau' })).ok);
  } finally { clients.forEach((socket) => socket.close()); await server.stop(); }
});

test('Abend-Modus über WebSocket: Brett → Poker → Omaha → Karten, Neustart, feste Teilnehmer und Chip-Schutz', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'evening-program-')); let server = await start(dir); const clients = [];
  try {
    let a = await client(server.url), b = await client(server.url), z = await client(server.url); clients.push(a, b, z);
    const created = await a.ask('create', { game: 'poker', name: 'Anna' }), joined = await b.ask('join', { code: created.code, name: 'Ben' });
    await z.ask('join', { code: created.code, name: 'Zoe' }); await a.ask('sit', { seat: 0 }); await b.ask('sit', { seat: 1 });
    const ids = [a.state.you.id, b.state.you.id];
    assert.ok((await a.ask('programSave', { mode: 'abend', name: 'Bunter Abend', entries: [{ game: 'viergewinnt' }, { game: 'poker', settings: { startStack: 1000 } }, { game: 'omaha', settings: { startStack: 2000 } }, { game: 'maumau' }] })).ok);
    assert.ok((await a.ask('programStart')).ok); await until(() => a.state?.game === 'viergewinnt');
    assert.equal((await z.ask('sit')).ok, false);
    for (let i = 0; i < 7; i++) { const active = a.state.turnId === ids[0] ? a : b; assert.ok((await active.ask('drop', { col: active === a ? 0 : 1 })).ok); }
    await until(() => a.state.partyProgram.status === 'between');
    assert.equal(a.state.partyProgram.standings.find((p) => p.id === ids[0]).points, 2);
    await until(() => { try { return JSON.parse(readFileSync(join(dir, 'rooms.json'), 'utf8'))[0]?.partyProgram?.status === 'between'; } catch { return false; } });
    a.close(); b.close(); z.close(); await server.stop(); server = await start(dir);
    a = await client(server.url); b = await client(server.url); clients.push(a, b);
    await a.ask('join', { code: created.code, token: created.token }); await b.ask('join', { code: created.code, token: joined.token });
    for (const [game, stack] of [['poker', 1000], ['omaha', 2000]]) {
      assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === game && a.state.hand && !a.state.hand.done);
      assert.equal(a.state.settings.autoNext, false); assert.equal(a.state.settings.gifts, false); assert.equal(a.state.settings.rebuy, 'off');
      assert.equal(a.state.seats.filter(Boolean).reduce((sum, s) => sum + s.stack, 0) + a.state.hand.bets, stack * 2);
      assert.equal((await a.ask('adjust', { id: ids[0], amount: 10000 })).ok, false);
      assert.equal((await a.ask('settings', { autoNext: true })).ok, false);
      const otherCards = a.state.seats.find((s) => s?.id === ids[1]).cards;
      assert.ok(otherCards.every((c) => c === '??'));
      if (game === 'poker') {
        assert.ok((await a.ask('abortRound')).ok); assert.equal(a.state.partyProgram.results.length, 1);
        assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === 'poker' && a.state.hand && !a.state.hand.done);
        assert.equal(a.state.partyProgram.index, 1); assert.equal(a.state.partyProgram.results.length, 1);
        assert.equal(a.state.seats.filter(Boolean).reduce((sum, s) => sum + s.stack, 0) + a.state.hand.bets, stack * 2);
      }
      const active = a.state.seats[a.state.hand.toAct].id === ids[0] ? a : b;
      assert.ok((await active.ask('action', { type: 'fold' })).ok); await until(() => a.state.partyProgram.status === 'between');
      assert.equal((await a.ask('nextHand')).ok, false); assert.equal((await a.ask('rebuy')).ok, false);
      assert.ok(!JSON.stringify(a.state.partyProgram).includes('handIds'));
    }
    assert.ok((await a.ask('programNext')).ok); await until(() => a.state.game === 'maumau');
    assert.equal(a.state.you.id, ids[0]); assert.equal(a.state.code, created.code); assert.ok(Number.isInteger(a.state.roundNo));
    assert.ok((await a.ask('abortRound')).ok); assert.equal(a.state.partyProgram.results.length, 3);
    assert.ok((await a.ask('programNext')).ok); assert.equal(a.state.partyProgram.index, 3);
    assert.ok((await b.ask('stand')).ok); await until(() => a.state.partyProgram.status === 'done');
    assert.equal(a.state.partyProgram.results.length, 4); assert.equal(a.state.partyProgram.standings.length, 2);
  } finally { clients.forEach((s) => s.close()); await server.stop(); }
});
