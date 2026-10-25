import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { GAMES } from '../games/index.js';
import { BOTS, pokerDecision } from '../games/bots.js';
import { addBot, removeBot, nextBot, createBotRunner } from '../server/bots.js';

function setup(game, settings = {}) {
  const room = GAMES[game].create('BOTSX', settings, () => {});
  room.game = game;
  const host = room.addPlayer('Anna', null);
  host.connected = true;
  return { room, host };
}

for (const game of Object.keys(GAMES)) {
  test(`${game}: optionaler Bot sitzt, lädt wieder und lässt sich entfernen`, () => {
    assert.equal(typeof BOTS[game], 'function');
    const { room, host } = setup(game);
    assert.equal([...room.players.values()].filter((p) => p.bot).length, 0);
    const bot = addBot(room, host.id);
    assert.ok(bot.bot && bot.connected);
    assert.throws(() => addBot(room, bot.id), /Host/);
    const restored = GAMES[game].restore(JSON.parse(JSON.stringify(room.snapshot())), () => {});
    restored.game = game;
    try {
      assert.equal(restored.players.get(bot.id).bot, true);
      assert.equal(restored.players.get(bot.id).connected, true);
      assert.equal(restored.hostId, host.id);
      removeBot(restored, host.id, bot.id);
      assert.equal(restored.players.has(bot.id), false);
    } finally { restored.dispose(); room.dispose(); }
  });
}

test('Bots bekommen keine Host-Rechte, halten verlassene Räume nicht offen; Tischlimit und Rundenwechsel', () => {
  const { room, host } = setup('viergewinnt');
  const b = addBot(room, host.id);
  addBot(room, host.id);
  assert.throws(() => addBot(room, host.id), /voll/);
  room.start(host.id);
  assert.throws(() => addBot(room, host.id), /zwischen/);
  assert.throws(() => removeBot(room, host.id, b.id), /zwischen/);
  host.connected = false;
  host.offlineSince = 0;
  room.transferHost();
  assert.equal(room.hostId, host.id);
  room.dropAway(1, 100);
  assert.equal(room.abandoned, true);
  assert.ok(room.players.has(b.id));
  room.dispose();
});

test('Bots erledigen gleichzeitiges Setzen und Platzieren auch vor einem Menschen', () => {
  for (const game of ['blackjack', 'schiffe']) {
    const { room, host } = setup(game, { turnTime: 0 });
    room.sit(host.id);
    const b = addBot(room, host.id);
    room.start(host.id);
    assert.equal(room.currentId, host.id);
    assert.equal(nextBot(room), b.id);
    BOTS[game](room, b.id, Math.random);
    assert.equal(nextBot(room), null);
    assert.ok(game === 'schiffe' ? room.ready.has(b.id) : room.decided.has(b.id));
    room.dispose();
  }
});

test('Bot-Timer spielt eine Runde, pausiert ohne Menschen und stoppt bei Raumwechsel', async () => {
  const { room, host } = setup('viergewinnt', { turnTime: 0 });
  addBot(room, host.id); addBot(room, host.id);
  room.start(host.id);
  let current = true, updates = 0;
  const runner = createBotRunner({ isCurrent: () => current, notify: () => updates++, delay: 1 });
  try {
    host.connected = false;
    runner.sync(room);
    await wait(15);
    assert.equal(updates, 0);
    host.connected = true;
    runner.sync(room); runner.sync(room);
    const deadline = Date.now() + 4000;
    while (room.busy && Date.now() < deadline) await wait(10);
    assert.equal(room.busy, false);
    assert.ok(updates > 0 && updates <= 42);
    room.start(host.id);
    runner.sync(room);
    current = false;
    const before = updates;
    await wait(15);
    assert.equal(updates, before);
  } finally { runner.stop(room); room.dispose(); }
});

test('Poker-Bots beenden Hände regelkonform und erhalten alle Chips', () => {
  for (let n = 0; n < 40; n++) {
    const { room, host } = setup('poker', { autoNext: false, turnTime: 0, handStrength: false, oddsMode: 'off' });
    const count = 2 + n % 7;
    for (let i = 0; i < count; i++) addBot(room, host.id);
    const chips = room.table.totalChips();
    try {
      room.start(host.id);
      let actions = 0;
      while (!room.table.hand.done && actions++ < 300) {
        const id = nextBot(room);
        assert.ok(id);
        BOTS.poker(room, id, Math.random);
        assert.equal(room.table.totalChips(), chips);
      }
      assert.ok(room.table.hand.done);
    } finally { room.dispose(); }
  }
});

test('Poker-Entscheidung liest keine fremden Karten und checkt kostenlos', () => {
  const opponent = { id: 'b', inHand: true, folded: false, get cards() { throw new Error('Fremde Karten!'); } };
  const view = { you: { id: 'a', seat: 0 }, seats: [{ id: 'a', inHand: true, cards: ['2s', '7d'] }, opponent],
    legal: { canCheck: true, canRaise: false, toCall: 0 }, hand: { board: ['Ah', 'Ks', 'Qc', 'Jd', '9h'], pots: [100], bets: 0 } };
  assert.deepEqual(pokerDecision(view, () => 0.4), { type: 'check' });
});
