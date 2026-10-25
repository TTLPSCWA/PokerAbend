// Zehntausend: Wertung (beste Aufteilung, jeder Würfel muss punkten), Herauslegen, Niete, alle sechs, Einstieg, Ziel und letzte Runde.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Room, scoreDice, canScore, bestTake } from '../games/zehntausend/room.js';

const seq = (...v) => () => { assert.ok(v.length, 'Würfel aufgebraucht'); return v.shift(); };
function setup(n = 2, settings = {}) {
  const r = new Room('ZT', { turnTime: 0, ...settings }, () => {});
  const ids = ['Anna', 'Ben', 'Cem'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}

test('Wertung: Einzelne, Päsche (doppelt je weiterem Würfel), Straße, drei Paare, beste Aufteilung', () => {
  assert.equal(scoreDice([1]), 100);
  assert.equal(scoreDice([5]), 50);
  assert.equal(scoreDice([2]), -1, 'eine 2 punktet nicht');
  assert.equal(scoreDice([1, 5, 2]), -1, 'jeder Würfel muss punkten');
  assert.equal(scoreDice([1, 1, 1]), 1000);
  assert.equal(scoreDice([4, 4, 4]), 400);
  assert.equal(scoreDice([4, 4, 4, 4]), 800);
  assert.equal(scoreDice([4, 4, 4, 4, 4]), 1600);
  assert.equal(scoreDice([4, 4, 4, 4, 4, 4]), 3200);
  assert.equal(scoreDice([1, 1, 1, 1, 1, 1]), 8000);
  assert.equal(scoreDice([3, 3, 3, 1, 5]), 450);
  assert.equal(scoreDice([1, 2, 3, 4, 5, 6]), 2000);
  assert.equal(scoreDice([1, 2, 3, 4, 5, 6], { straight: 1500 }), 1500);
  assert.equal(scoreDice([2, 2, 4, 4, 6, 6]), 1500);
  assert.equal(scoreDice([2, 2, 4, 4, 6, 6], { threePairs: false }), -1);
  assert.equal(scoreDice([1, 1, 1, 1, 5, 5]), 2100, 'Vierling + 5 + 5 ist mehr als drei Paare');
  assert.equal(scoreDice([2, 2, 2, 2, 3, 3]), -1, 'vier gleiche + Paar sind keine drei Paare');
  assert.ok(canScore([2, 3, 4, 6, 6, 2]) === false);
  assert.ok(canScore([2, 3, 4, 6, 6, 5]));
  assert.deepEqual(bestTake([5, 2, 1, 3, 1, 1]).points, 1050);
});

test('Zug: herauslegen, weiterwürfeln mit den übrigen, aufhören schreibt an', () => {
  const { r, ids: [a, b] } = setup(2, { entry: 0 });
  assert.throws(() => r.take(a, [0]), /Erst würfeln/);
  r.roll = seq(1, 5, 2, 3, 4, 6); r.throwDice(a);   // Straße! (aber wir legen nur die 1 heraus)
  assert.throws(() => r.bank(a), /Erst punktende/);
  assert.throws(() => r.take(a, [2]), /muss punkten/);
  r.take(a, [0]);
  assert.equal(r.turnPoints, 100);
  assert.equal(r.remaining, 5);
  r.roll = seq(5, 2, 3, 4, 6); r.throwDice(a);
  assert.equal(r.dice.length, 5);
  r.take(a, [0]);
  r.bank(a);
  assert.equal(r.banked[a], 150);
  assert.equal(r.currentId, b);
});

test('Niete: kein punktender Würfel – alle Zugpunkte weg, der Nächste ist dran', () => {
  const { r, ids: [a, b] } = setup(2, { entry: 0 });
  r.roll = seq(1, 1, 1, 2, 3, 4); r.throwDice(a); r.take(a, [0, 1, 2]); // 1.000
  r.roll = seq(2, 3, 4); r.throwDice(a);                                  // Niete
  assert.equal(r.banked[a], 0);
  assert.equal(r.currentId, b);
  assert.equal(r.view(b).g.lastLoss.points, 1000);
});

test('Alle sechs gepunktet: weiter mit allen sechs', () => {
  const { r, ids: [a] } = setup(2, { entry: 0 });
  r.roll = seq(1, 1, 1, 5, 5, 5); r.throwDice(a); r.take(a, [0, 1, 2, 3, 4, 5]);
  assert.equal(r.turnPoints, 1500);
  assert.equal(r.remaining, 6);
  r.roll = seq(2, 2, 3, 3, 4, 1); r.throwDice(a);
  assert.equal(r.dice.length, 6);
});

test('Einstieg: erst ab 350 in einem Zug anschreiben (einstellbar)', () => {
  const { r, ids: [a] } = setup(2);
  r.roll = seq(1, 5, 2, 3, 4, 6, 2, 2, 3, 3); r.throwDice(a); r.take(a, [0, 1]); // 150
  assert.ok(!r.canBank(a));
  assert.throws(() => r.bank(a), /mindestens 350/);
  const z = setup(2, { entry: 0 });
  z.r.roll = seq(5, 2, 3, 4, 6, 6); z.r.throwDice(z.ids[0]); z.r.take(z.ids[0], [0]);
  z.r.bank(z.ids[0]);
  assert.equal(z.r.banked[z.ids[0]], 50);
});

test('Ziel erreicht: alle anderen haben noch einen Zug, dann gewinnt, wer am meisten hat (abschaltbar)', () => {
  const { r, ids: [a, b, c] } = setup(3, { target: 1000, entry: 0 });
  r.roll = seq(1, 1, 1, 2, 3, 4); r.throwDice(a); r.take(a, [0, 1, 2]); r.bank(a); // 1.000 → letzte Runde
  assert.deepEqual(r.view(b).g.final.left.sort(), [b, c].sort());
  r.roll = seq(1, 1, 1, 1, 2, 3); r.throwDice(b); r.take(b, [0, 1, 2, 3]); r.bank(b); // 2.000
  assert.equal(r.phase, 'playing');
  r.roll = seq(2, 3, 4, 6, 6, 2); r.throwDice(c);                                   // Niete
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [b]);
  assert.equal(r.result.points[b], 2000);
  const n = setup(2, { target: 1000, entry: 0, lastRound: false });
  n.r.roll = seq(1, 1, 1, 2, 3, 4); n.r.throwDice(n.ids[0]); n.r.take(n.ids[0], [0, 1, 2]); n.r.bank(n.ids[0]);
  assert.equal(n.r.phase, 'over', 'ohne letzte Runde sofort vorbei');
});

test('Zug-Timer: Punktendes herauslegen, dann aufhören oder weiterwürfeln', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const { r, ids: [a, b] } = setup(2, { turnTime: 10, entry: 0 });
    r.roll = seq(1, 1, 1, 2, 3, 4); r.throwDice(a); r.afterChange();
    mock.timers.tick(10500);
    assert.equal(r.banked[a], 1000, 'alle Einser herausgelegt und angeschrieben');
    assert.equal(r.currentId, b);
    r.dispose();
  } finally { mock.timers.reset(); }
});
