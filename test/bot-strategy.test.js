// Spielen die Bots sinnvoll? Typische Stellungen, in denen ein Mensch den Zug sofort sieht.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { botColumn, COLS } from '../games/viergewinnt/room.js';
import { addBot, brokeBot, createBotRunner } from '../server/bots.js';

function room2(game, settings = {}) {
  const r = GAMES[game].create('STRAT', { turnTime: 0, ...settings }, () => {});
  r.game = game;
  const a = r.addPlayer('Anna', null), b = r.addPlayer('Ben', null);
  a.connected = b.connected = true;
  r.sit(a.id); r.sit(b.id);
  r.start(a.id);
  return { r, A: r.order[0], B: r.order[1] };
}
const rng = () => 0.5;

test('Vier gewinnt: Bot nimmt den Sieg, blockt, und baut keine Zwickmühle für den Gegner', () => {
  const at = (cells) => { const b = Array(COLS * 6).fill(null); for (const [r, c, who] of cells) b[r * COLS + c] = who; return b; };
  // Eigener Sieg (senkrecht in Spalte 6) geht vor Blocken (Spalte 3)
  assert.equal(botColumn(at([[5, 0, 'a'], [5, 1, 'a'], [5, 2, 'a'], [5, 6, 'b'], [4, 6, 'b'], [3, 6, 'b']]), 'b', 'a', rng), 6);
  // Gegner droht unten waagerecht in Spalte 3 → blocken
  assert.equal(botColumn(at([[5, 0, 'a'], [5, 1, 'a'], [5, 2, 'a'], [4, 0, 'b']]), 'b', 'a', rng), 3);
  // Offene Zweier unten (Spalten 2 und 3): einer von beiden Rändern muss zu, sonst gibt es eine Zwickmühle
  const c = botColumn(at([[5, 2, 'a'], [5, 3, 'a'], [4, 3, 'b']]), 'b', 'a', rng);
  assert.ok([1, 4].includes(c), `Spalte ${c}`);
});

test('Mühle: Bot schließt eine Mühle, verhindert eine gegnerische und schlägt den gefährlichsten Stein', () => {
  const { r, A, B } = room2('muehle');
  // Setzphase: A hat 0 und 1 → setzt auf 2
  r.board[0] = A; r.board[1] = A; r.board[8] = B; r.board[16] = B; r.hand[A] = 7; r.hand[B] = 7;
  BOTS.muehle(r, A, rng);
  assert.equal(r.board[2], A);
  assert.equal(r.step, 'remove');
  // Schlagen: B droht mit 11 und 19 die Mühle 3-11-19 → einen dieser Steine nehmen, nicht den einzelnen auf 12
  r.board.fill(null); r.board[0] = A; r.board[1] = A; r.board[2] = A; r.board[11] = B; r.board[19] = B; r.board[12] = B;
  BOTS.muehle(r, A, rng);
  assert.equal(r.board[12], B);
  assert.ok(r.board[11] === null || r.board[19] === null, 'nimmt einen Stein aus der drohenden Linie 3-11-19');
  // B setzt jetzt: A droht 4-5-6 (4 und 5 stehen) → B blockt auf 6
  r.board.fill(null); r.board[4] = A; r.board[5] = A; r.board[20] = B;
  if (r.currentId !== B) r.turn = r.order.indexOf(B);
  r.step = 'move';
  BOTS.muehle(r, B, () => 0.99);
  assert.equal(r.board[6], B);
  r.dispose();
});

test('Zehntausend: in der letzten Runde würfelt der Bot weiter, bis er vorne liegt', () => {
  const { r, A, B } = room2('zehntausend', { entry: 0 });
  r.banked[B] = 10200; r.banked[A] = 9000; r.entered.add(A); r.entered.add(B);
  r.final = { by: B, left: new Set([A]) };
  r.turnPoints = 600; r.remaining = 2; r.rolled = false;
  r.roll = () => 2; // Niete, falls gewürfelt wird
  BOTS.zehntausend(r, A, rng);
  assert.equal(r.banked[A], 9000, 'hat nicht mit 9.600 aufgehört');
  r.dispose();
});

test('Zehntausend: mit vielen Zugpunkten und wenig Würfeln hört der Bot auf', () => {
  const { r, A } = room2('zehntausend', { entry: 0 });
  r.entered.add(A);
  r.turnPoints = 700; r.remaining = 2; r.rolled = false;
  BOTS.zehntausend(r, A, rng);
  assert.equal(r.banked[A], 700);
  r.dispose();
});

test('Kniffel: Bot hält eine Viererstraße und trägt die große Straße ein', () => {
  const { r, A } = room2('kniffel');
  r.roll = () => 6;
  BOTS.kniffel(r, A, rng); // erster Wurf: lauter Sechsen
  r.dice = [2, 3, 4, 5, 2]; // jetzt eine Viererstraße
  let kept = null;
  r.roll = () => 6;
  const orig = r.throwDice.bind(r);
  r.throwDice = (id, keep) => { kept = keep; return orig(id, keep); };
  BOTS.kniffel(r, A, rng);
  assert.deepEqual(new Set(kept.map((i) => [2, 3, 4, 5, 2][i])), new Set([2, 3, 4, 5]));
  assert.deepEqual([...r.dice].sort(), [2, 3, 4, 5, 6]);
  BOTS.kniffel(r, A, rng);
  assert.equal(r.sheets[A].largeStraight, 40);
  r.dispose();
});

test('Schiffe versenken: nach zwei Treffern in einer Reihe schießt der Bot auf die Verlängerung', () => {
  const room = GAMES.schiffe.create('STRAT', { turnTime: 0 }, () => {});
  room.game = 'schiffe';
  const a = room.addPlayer('Anna', null), b = room.addPlayer('Ben', null);
  room.sit(a.id); room.sit(b.id); room.start(a.id);
  BOTS.schiffe(room, a.id, Math.random); BOTS.schiffe(room, b.id, Math.random);
  const me = room.currentId, foe = room.other(me);
  const ship = room.ships[foe].find((s) => s.cells.length >= 4);
  const [c0, c1] = ship.cells;
  room.shots[me][c0] = 'hit'; room.shots[me][c1] = 'hit';
  BOTS.schiffe(room, me, Math.random);
  const shot = Number(Object.keys(room.shots[me]).find((k) => ![c0, c1].includes(Number(k))));
  const d = c1 - c0;
  assert.ok([c0 - d, c1 + d].includes(shot), `Schuss auf ${shot} statt neben ${c0}/${c1}`);
  room.dispose();
});

test('Poker: Bot ohne Chips kauft zwischen zwei Händen nach (wenn erlaubt)', async () => {
  const room = GAMES.poker.create('STRAT', { autoNext: false, turnTime: 0 }, () => {});
  room.game = 'poker';
  const host = room.addPlayer('Anna', null); host.connected = true;
  const bot = addBot(room, host.id);
  room.table.seats.find((s) => s?.id === bot.id).stack = 0;
  assert.equal(brokeBot(room), bot.id);
  const runner = createBotRunner({ isCurrent: () => true, notify: () => {}, delay: 1 });
  try {
    runner.sync(room);
    await wait(20);
    assert.ok(room.table.seats.find((s) => s?.id === bot.id).stack > 0);
    assert.equal(brokeBot(room), null);
    room.settings.rebuy = 'off';
    room.table.seats.find((s) => s?.id === bot.id).stack = 0;
    assert.equal(brokeBot(room), null);
  } finally { runner.stop(room); room.dispose(); }
});

test('Bot-Zug schlägt fehl: Ersatzzug wie bei abgelaufener Zeit, die Runde hängt nicht', async () => {
  const room = GAMES.viergewinnt.create('STRAT', { turnTime: 0 }, () => {});
  room.game = 'viergewinnt';
  const host = room.addPlayer('Anna', null); host.connected = true;
  addBot(room, host.id); addBot(room, host.id);
  room.start(host.id);
  const real = BOTS.viergewinnt;
  BOTS.viergewinnt = () => { throw new Error('kaputt'); };
  const runner = createBotRunner({ isCurrent: () => true, notify: () => {}, delay: 1 });
  const errors = console.error;
  console.error = () => {};
  try {
    runner.sync(room);
    const deadline = Date.now() + 3000;
    while (room.busy && Date.now() < deadline) { await wait(5); runner.sync(room); }
    assert.equal(room.busy, false, 'Runde wurde trotz Fehler zu Ende gespielt');
  } finally { BOTS.viergewinnt = real; console.error = errors; runner.stop(room); room.dispose(); }
});
