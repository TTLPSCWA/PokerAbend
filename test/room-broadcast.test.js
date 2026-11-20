import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';

async function openServer(t) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    const { http } = await import('./server/index.js');
    const ready = () => console.log('ROOM_TEST_PORT:' + http.address().port);
    if (http.listening) ready(); else http.once('listening', ready);
  `], {
    env: { ...process.env, PORT: '0', POKER_NO_DOTENV: '1', SITE_PASSWORD: '',
      DATA_DIR: mkdtempSync(join(tmpdir(), 'room-broadcast-')) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const clients = [];
  t.after(async () => {
    for (const socket of clients) socket.disconnect();
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = once(child, 'exit');
      child.kill();
      await stopped;
    }
  });
  const url = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Room server did not start: ' + stderr)), 15000);
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Room server exited: ' + code)); });
    child.stdout.on('data', data => {
      stdout += data;
      const port = stdout.match(/ROOM_TEST_PORT:(\d+)/)?.[1];
      if (port) {
        clearTimeout(timer);
        resolve('http://127.0.0.1:' + port);
      }
    });
  });
  return () => {
    const socket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(socket);
    const client = { view: null, presence: null, views: [] };
    socket.on('state', state => { client.view = state; client.views.push(state); });
    socket.on('presence', list => { client.presence = list; });
    client.disconnect = () => socket.disconnect();
    client.send = async (event, payload = {}) => {
      const reply = await socket.timeout(6000).emitWithAck(event, payload);
      assert.equal(reply.ok, true, reply.error);
      return reply;
    };
    return client;
  };
}

async function waitFor(read, accepts, message) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const value = read();
    if (value && accepts(value)) return value;
    await delay(25);
  }
  assert.fail(message);
}

test('ordinary room broadcast schedules one real Hold’em bot action and sends complete metadata to viewers', async t => {
  const client = await openServer(t);
  const host = client(), firstViewer = client(), secondViewer = client();
  const room = await host.send('create', { game: 'poker', name: 'Anna' });
  await host.send('sit', { seat: 1 });
  await host.send('settings', { turnTime: 0, autoNext: false });
  await host.send('addBot', { difficulty: 'hard' });
  await firstViewer.send('join', { code: room.code, name: 'Ben' });
  const viewer = await secondViewer.send('join', { code: room.code, name: 'Cleo' });
  const lobby = await waitFor(() => host.view, state => state.bots?.length === 1, 'Expected one bot');
  const [bot] = lobby.bots;
  assert.equal(bot.difficulty, 'hard');
  assert.ok(typeof bot.name === 'string' && bot.name.length > 0);
  assert.equal(Object.hasOwn(lobby, '__roomViewAudit'), false);
  await host.send('start');
  const started = await waitFor(() => host.view, state => !!state.hand, 'Hold’em did not start');
  assert.equal(started.settings.turnTime, 0);
  const turn = started;
  const botSeat = turn.hand.toAct;
  assert.equal(turn.seats[botSeat].id, bot.id, 'Bot acts first as the initial dealer');

  // Overlapping notifications must reuse the already scheduled bot turn.
  await host.send('unlisted', { value: true });
  await host.send('unlisted', { value: false });
  const result = await waitFor(() => host.view, state => state.hand?.done || state.hand?.toAct !== botSeat,
    'The bot did not play its assigned turn');
  assert.equal(result.hand.no, turn.hand.no);
  assert.notEqual(result.seats[botSeat].lastAction, turn.seats[botSeat].lastAction);
  const guestResult = state => state.hand?.no === turn.hand.no &&
    state.seats[botSeat].lastAction === result.seats[botSeat].lastAction;
  await waitFor(() => firstViewer.view, guestResult, 'First spectator missed the bot action');
  const before = await waitFor(() => secondViewer.view, guestResult, 'Second spectator missed the bot action');
  secondViewer.disconnect();
  const reconnected = client();
  await reconnected.send('join', { code: room.code, token: viewer.token });
  const after = await waitFor(() => reconnected.view, guestResult, 'Reconnecting spectator missed the bot action');
  assert.equal(after.you.id, before.you.id);
  assert.equal(after.you.seat, null);
  for (const state of [firstViewer.view, before, after]) {
    assert.deepEqual(state.bots, [bot]);
    assert.equal(Object.hasOwn(state, '__roomViewAudit'), false);
    if (!state.hand.done) assert.ok(state.seats.filter(Boolean).every(seat => !seat.cards || seat.cards.every(card => card === '??')));
  }
  const actions = after.log.filter(entry => entry.n > turn.logSeq && entry.text.startsWith(bot.name + ' ') &&
    /^(foldet|checkt|callt|setzt|erhöht)\b/u.test(entry.text.slice(bot.name.length + 1)));
  assert.equal(actions.length, 1, 'Only one bot action was broadcast for the assigned turn');
  for (const state of host.views.slice(host.views.indexOf(result))) {
    assert.equal(state.hand.no, result.hand.no);
    assert.equal(state.hand.toAct, result.hand.toAct);
    assert.equal(state.seats[botSeat].lastAction, result.seats[botSeat].lastAction);
    assert.equal(state.seats[botSeat].stack, result.seats[botSeat].stack);
  }
});

test('ordinary presence broadcast redacts a private room and restores its code when public again', async t => {
  const client = await openServer(t);
  const host = client(), firstViewer = client(), secondViewer = client();
  const name = 'Presence Host';
  const room = await host.send('create', { game: 'maumau', name });
  await firstViewer.send('lobby');
  await secondViewer.send('lobby');
  await host.send('presence', { name, visible: true, active: true });
  const hostRow = presence => presence.online.find(person => person.name === name);
  const isPublic = presence => hostRow(presence)?.code === room.code;
  const isPrivate = presence => hostRow(presence)?.status === 'an einem privaten Tisch';
  for (const viewer of [firstViewer, secondViewer]) {
    await waitFor(() => viewer.presence, isPublic, 'Missing public room in live presence');
  }
  await host.send('unlisted', { value: true });
  const assertRedacted = presence => {
    const person = hostRow(presence);
    assert.ok(isPrivate(presence));
    for (const field of ['code', 'game', 'canJoin']) assert.equal(Object.hasOwn(person, field), false, field);
  };
  for (const viewer of [firstViewer, secondViewer]) {
    assertRedacted(await waitFor(() => viewer.presence, isPrivate, 'Missing redacted live presence'));
  }
  secondViewer.disconnect();
  const reconnected = client();
  assertRedacted((await reconnected.send('lobby')).presence);
  await host.send('unlisted', { value: false });
  for (const viewer of [firstViewer, reconnected]) {
    const state = await waitFor(() => viewer.presence, isPublic, 'Public room did not reappear in live presence');
    assert.equal(hostRow(state).game, 'maumau');
  }
});
