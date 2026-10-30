import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomClock } from '../server/room-clock.js';
import { GAMES } from '../games/index.js';
import { createBotRunner, addBot, nextBot } from '../server/bots.js';

test('Spieluhr: Restzeit, mehrfaches Pausieren, Intervalle und Aufräumen', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const clock = new RoomClock(); let calls = 0;
  clock.setTimeout(() => calls++, 1000);
  t.mock.timers.tick(400); clock.setPaused(true);
  t.mock.timers.tick(90000);
  assert.equal(clock.now(), 100400); assert.equal(calls, 0);
  clock.setPaused(true); clock.setPaused(false); clock.setPaused(false);
  t.mock.timers.tick(599); assert.equal(calls, 0);
  t.mock.timers.tick(1); assert.equal(calls, 1);
  clock.setPaused(true);
  const canceled = clock.setTimeout(() => calls += 100, 10);
  clock.clearTimeout(canceled);
  clock.setTimeout(() => calls++, 100);
  const interval = clock.setInterval(() => calls++, 50).unref();
  t.mock.timers.tick(60000); assert.equal(calls, 1);
  clock.setPaused(false);
  t.mock.timers.tick(50); assert.equal(calls, 2);
  clock.clearInterval(interval);
  t.mock.timers.tick(50); assert.equal(calls, 3);
  clock.setTimeout(() => calls++, 10); clock.dispose();
  t.mock.timers.tick(1000); assert.equal(calls, 3);
});

function setup(game, settings = {}) {
  const room = game.create('PAUSE', settings, () => {}); room.game = game.id;
  const people = Array.from({ length: room.opts?.minPlayers || game.minPlayers }, (_, i) => {
    const p = room.addPlayer(`Person ${i}`, null); p.connected = true;
    game.events.sit(room, p, { seat: i }); return p;
  });
  room.start(people[0].id); room.afterChange();
  return { room, people, host: people[0] };
}

for (const game of Object.values(GAMES)) {
  for (const variant of game.variants || [{ id: 'classic' }]) {
    test(`${game.id}/${variant.id}: gemeinsame Pause erhält Zustand und Spielzeit`, (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
      const { room, host, people } = setup(game, { variant: variant.id });
      try {
        assert.ok(room.busy, 'Runde läuft');
        assert.throws(() => room.setGamePaused(people[1]?.id || 'fremd', true), /Host/);
        room.setGamePaused(host.id, true);
        const before = structuredClone(room.view(host.id));
        assert.equal(before.gamePaused, true);
        assert.match(room.lobbyInfo().status, /pausiert/);
        const logSeq = room.logSeq;
        room.setGamePaused(host.id, true);
        assert.equal(room.logSeq, logSeq, 'wiederholte Pause ist idempotent');
        t.mock.timers.tick(120000);
        room.afterChange();
        const after = room.view(host.id);
        assert.equal(after.now, before.now);
        assert.deepEqual(after.g, before.g, 'keine automatische Spieländerung');
        assert.deepEqual(after.hand, before.hand, 'Pokerhand bleibt stehen');
        assert.equal(room.busy, true);
        room.setGamePaused(host.id, false); room.afterChange();
        assert.equal(room.view(host.id).gamePaused, false);
        t.mock.timers.tick(25);
        assert.equal(room.clock.now(), before.now + 25);
      } finally { room.dispose(); }
    });
  }
}

test('Zugtimer läuft nach der Pause mit seiner Restzeit weiter', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const { room, host } = setup(GAMES['monopoly-deal'], { turnTime: 15 });
  try {
    let expired = 0; room.onTimeout = () => { expired++; room.phase = 'over'; };
    t.mock.timers.tick(5000); room.setGamePaused(host.id, true);
    t.mock.timers.tick(60000); assert.equal(expired, 0);
    room.setGamePaused(host.id, false); room.afterChange();
    t.mock.timers.tick(9999); assert.equal(expired, 0);
    t.mock.timers.tick(1); assert.equal(expired, 1);
  } finally { room.dispose(); }
});

test('Bots warten auch bei bereits eingeplantem Zug bis zum Fortsetzen', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const game = GAMES.viergewinnt, room = game.create('PAUSE', {}, () => {}); room.game = game.id;
  const host = room.addPlayer('Anna', null); host.connected = true;
  room.sit(host.id); addBot(room, host.id); room.start(host.id);
  room.turn = 1;
  const runner = createBotRunner({ isCurrent: () => true, notify: () => {}, delay: 100 });
  try {
    assert.ok(nextBot(room)); runner.sync(room);
    room.setGamePaused(host.id, true);
    assert.equal(nextBot(room), null);
    t.mock.timers.tick(1000); assert.equal(room.moveNo, 0);
    room.setGamePaused(host.id, false); runner.sync(room);
    t.mock.timers.tick(100); assert.ok(room.moveNo > 0);
  } finally { runner.stop(room); room.dispose(); }
});

test('Monopoly: auch das Zeitlimit der gesamten Partie zählt keine Pausenzeit', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const { room, host } = setup(GAMES.monopoly, { timeLimit: 1, turnTime: 180 });
  try {
    t.mock.timers.tick(10000); room.setGamePaused(host.id, true);
    t.mock.timers.tick(120000); assert.equal(room.phase, 'playing');
    room.setGamePaused(host.id, false); room.afterChange();
    t.mock.timers.tick(49999); assert.equal(room.phase, 'playing');
    t.mock.timers.tick(1); assert.equal(room.phase, 'over');
  } finally { room.dispose(); }
});

test('Solo-Wertung erhält verstrichene Spielzeit ohne Pause', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const { room, host } = setup(GAMES.pfeilfieber);
  try {
    const logic = room.logic; let scoredMs;
    Object.defineProperty(room, 'logic', { value: { ...logic, score: (round, payload, options) => { scoredMs = options.elapsedMs; return logic.score(round, payload, options); } } });
    t.mock.timers.tick(5000); room.setGamePaused(host.id, true);
    t.mock.timers.tick(90000); room.setGamePaused(host.id, false);
    t.mock.timers.tick(1000); room.submit(host.id, { inputs: [] });
    assert.equal(scoredMs, 6000);
  } finally { room.dispose(); }
});
