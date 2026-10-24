import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestHand, compareScores, newDeck } from '../engine/cards.js';
import { Table } from '../engine/table.js';

// ---------- Hilfen ----------
function table(stacks, { sb = 50, bb = 100 } = {}) {
  const t = new Table({ smallBlind: sb, bigBlind: bb });
  stacks.forEach((s, i) => { if (s != null) t.sit(i, { id: 'p' + i, name: 'P' + i, stack: s }); });
  return t;
}

// Legt fest, wer welche Karten bekommt und wie das Board aussieht.
function rig(t, holes, board) {
  const seats = t.eligibleSeats();
  const button = t.button < 0 ? seats[0] : t.nextFrom(t.button, seats);
  const sb = seats.length === 2 ? button : t.nextFrom(button, seats);
  const order = [];
  for (let r = 0; r < 2; r++) { let i = sb; for (let n = 0; n < seats.length; n++) { order.push(holes[i][r]); i = t.nextFrom(i, seats); } }
  const used = new Set([...order, ...board]);
  const filler = newDeck().filter((c) => !used.has(c));
  const burn = () => filler.pop();
  const seq = [...order, burn(), board[0], board[1], board[2], burn(), board[3], burn(), board[4]];
  t.riggedDeck = [...filler, ...seq.reverse()];
}

const stacks = (t) => t.seats.map((s) => (s ? s.stack : null));

// ---------- Handauswertung ----------
test('Handkategorien werden erkannt', () => {
  const cat = (cards) => bestHand(cards.split(' ')).name;
  assert.equal(cat('As Ks Qs Js Ts 2d 3c'), 'Royal Flush');
  assert.equal(cat('9h 8h 7h 6h 5h Ad Ac'), 'Straight Flush bis Neun');
  assert.equal(cat('Qd Qc Qh Qs 2d 3c 4h'), 'Vierling Damen');
  assert.equal(cat('Kd Kc Kh Ts Td 3c 4h'), 'Full House, Könige über Zehnen');
  assert.equal(cat('2c 7c 9c Jc Kc Ad Ah'), 'Flush, König hoch');
  assert.equal(cat('Ad 2c 3h 4s 5d Kc Qh'), 'Straße bis Fünf');
  assert.equal(cat('7d 7c 7h 2s 5d Kc Qh'), 'Drilling Siebenen');
  assert.equal(cat('Ad Ac Kh Ks 5d 3c 2h'), 'Zwei Paare, Asse und Könige');
  assert.equal(cat('Jd Jc 9h 2s 5d 3c 7h'), 'Paar Buben');
  assert.equal(cat('Ad Tc 9h 2s 5d 3c 7h'), 'Höchste Karte Ass');
});

test('Kicker entscheidet, Farbe nicht', () => {
  const s = (c) => bestHand(c.split(' ')).score;
  assert.ok(compareScores(s('Ah Ad Kc 7s 4d 3c 2h'), s('As Ac Qc 7d 4h 3s 2d')) > 0);
  assert.equal(compareScores(s('Ah Kh Qh Jh 9h 2c 3d'), s('As Ks Qs Js 9s 2d 3c')), 0);
  // A-2-3-4-5 ist die kleinste Straße
  assert.ok(compareScores(s('2c 3d 4h 5s 6d Kc Qh'), s('Ad 2c 3h 4s 5d Kc Qh')) > 0);
});

// ---------- Spielablauf ----------
test('Bessere Hand gewinnt beim Showdown', () => {
  const t = table([1000, 1000]);
  rig(t, { 0: ['As', 'Ad'], 1: ['Kc', 'Kd'] }, ['2h', '7c', '9s', 'Jd', '3h']);
  t.startHand();
  t.act(0, { type: 'allin' });
  t.act(1, { type: 'call' });
  assert.equal(t.hand.done, true);
  assert.deepEqual(stacks(t).slice(0, 2), [2000, 0]);
  assert.equal(t.hand.result.pots[0].hand, 'Paar Asse');
});

test('Alle folden – letzter Spieler gewinnt ohne Showdown', () => {
  const t = table([1000, 1000, 1000]);
  t.startHand(); // Button 0, SB 1, BB 2
  t.act(0, { type: 'raise', amount: 300 });
  t.act(1, { type: 'fold' });
  t.act(2, { type: 'fold' });
  assert.equal(t.hand.result.showdown, false);
  assert.deepEqual(stacks(t).slice(0, 3), [1150, 950, 900]);
  assert.equal(t.hand.shown.size, 0);
});

test('Split Pot: unteilbarer Rest-Chip geht an den ersten links vom Button', () => {
  const t = table([101, 1000, 101], { sb: 1, bb: 2 });
  rig(t, { 0: ['2c', '3d'], 1: ['8d', '9c'], 2: ['2d', '3c'] }, ['Ah', 'Kh', 'Qd', 'Js', 'Tc']);
  t.startHand(); // Button 0, SB 1, BB 2
  t.act(0, { type: 'allin' }); // 101
  t.act(1, { type: 'fold' });  // SB verliert 1
  t.act(2, { type: 'call' });  // 101
  // Pot 203, beide spielen das Board (Straße) → 101 / 102, Rest-Chip an Platz 2 (zuerst links vom Button 0 nach Platz 1)
  assert.equal(t.hand.result.pots[0].amount, 203);
  assert.deepEqual(stacks(t), [101, 999, 102, null, null, null, null, null, null]);
});

test('Drei unterschiedliche All-ins: Main Pot, Side Pot, Rückgabe', () => {
  const t = table([1000, 2000, 3000]);
  rig(t, { 0: ['As', 'Ad'], 1: ['Ks', 'Kd'], 2: ['Qs', 'Qd'] }, ['2h', '7c', '9s', '4d', '3h']);
  const before = t.totalChips();
  t.startHand(); // Button 0, SB 1, BB 2
  t.act(0, { type: 'allin' });
  t.act(1, { type: 'allin' });
  t.act(2, { type: 'allin' });
  const r = t.hand.result;
  assert.deepEqual(r.pots.map((p) => p.amount), [3000, 2000]);
  assert.deepEqual(r.pots[0].winners, [0]);
  assert.deepEqual(r.pots[1].winners, [1]);
  assert.deepEqual(stacks(t).slice(0, 3), [3000, 2000, 1000]);
  assert.equal(t.totalChips(), before);
});

test('Short-Call: zu wenig Chips zum Callen → All-in', () => {
  const t = table([1000, 300, 1000]);
  t.startHand(); // Button 0, SB 1 (300), BB 2
  t.act(0, { type: 'raise', amount: 600 });
  const L = t.legal(1);
  assert.equal(L.toCall, 250);
  assert.equal(L.canRaise, false);
  t.act(1, { type: 'call' });
  assert.equal(t.hand.players[1].allIn, true);
});

test('Unvollständiges All-in-Raise eröffnet die Runde nicht neu', () => {
  const t = table([5000, 400, 5000]);
  t.startHand(); // Button 0, SB 1, BB 2 – Spieler 0 handelt zuerst
  t.act(0, { type: 'raise', amount: 300 }); // Raise um 200
  t.act(1, { type: 'allin' });              // auf 400, nur +100
  t.act(2, { type: 'call' });
  const L = t.legal(0);
  assert.equal(L.toCall, 100);
  assert.equal(L.canRaise, false, 'Spieler 0 darf nur callen oder folden');
});

test('Big Blind bekommt Pre-Flop seine Option', () => {
  const t = table([1000, 1000, 1000]);
  t.startHand();
  t.act(0, { type: 'call' });
  t.act(1, { type: 'call' });
  assert.equal(t.hand.toAct, 2);
  const L = t.legal(2);
  assert.equal(L.canCheck, true);
  assert.equal(L.canRaise, true);
  t.act(2, { type: 'check' });
  assert.equal(t.hand.street, 'flop');
});

test('Heads-up: Button ist Small Blind, handelt pre-flop zuerst, danach zuletzt', () => {
  const t = table([1000, 1000]);
  t.startHand();
  assert.equal(t.hand.button, 0);
  assert.equal(t.hand.sb, 0);
  assert.equal(t.hand.bb, 1);
  assert.equal(t.hand.toAct, 0);
  t.act(0, { type: 'call' });
  t.act(1, { type: 'check' });
  assert.equal(t.hand.street, 'flop');
  assert.equal(t.hand.toAct, 1);
});

test('Mindest-Raise wird geprüft', () => {
  const t = table([1000, 1000, 1000]);
  t.startHand();
  assert.throws(() => t.act(0, { type: 'raise', amount: 150 }), /Mindestens 200/);
  t.act(0, { type: 'raise', amount: 350 }); // +250
  assert.equal(t.legal(1).minTo, 600);
});

test('Nur wer am Zug ist, darf handeln', () => {
  const t = table([1000, 1000, 1000]);
  t.startHand();
  assert.throws(() => t.act(1, { type: 'fold' }), /nicht am Zug/);
});

test('Dealer-Button wandert weiter', () => {
  const t = table([1000, 1000, 1000]);
  t.startHand(); t.act(0, { type: 'fold' }); t.act(1, { type: 'fold' });
  t.startHand();
  assert.equal(t.hand.button, 1);
  assert.equal(t.hand.sb, 2);
  assert.equal(t.hand.bb, 0);
});

test('Massentest: Chipsumme bleibt in jeder Hand gleich', () => {
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const t = new Table({ smallBlind: 10, bigBlind: 20, rng: (n) => Math.floor(rand() * n) });
  for (let i = 0; i < 6; i++) t.sit(i * 1 + (i > 2 ? 1 : 0), { id: 'p' + i, name: 'P' + i, stack: 500 + i * 300 });
  const HANDS = 100000;
  for (let n = 0; n < HANDS; n++) {
    for (const s of t.seats) if (s && s.stack === 0) s.stack = 1000; // Rebuy
    const before = t.totalChips();
    t.startHand();
    let guard = 0;
    while (!t.hand.done) {
      const seat = t.hand.toAct;
      const L = t.legal(seat);
      const r = rand();
      if (r < 0.15) t.act(seat, { type: 'fold' });
      else if (r < 0.55) t.act(seat, { type: L.canCheck ? 'check' : 'call' });
      else if (r < 0.9 && L.canRaise) t.act(seat, { type: 'raise', amount: L.minTo + Math.floor(rand() * (L.maxTo - L.minTo + 1)) });
      else if (L.canRaise) t.act(seat, { type: 'allin' });
      else t.act(seat, { type: L.canCheck ? 'check' : 'call' });
      if (++guard > 500) assert.fail('Hand endet nicht');
    }
    assert.equal(t.totalChips(), before, `Hand ${n}: Chips verändert`);
    for (const s of t.seats) if (s) assert.ok(s.stack >= 0);
    assert.equal(t.hand.board.length === 5 || !t.hand.result.showdown, true);
  }
});
