// Shut the Box: Kombinationen, genau die Augensumme, Zugende ohne Kombination, Ein-Würfel-Regel, Box zu (Runde sofort gewonnen),
// Wertung als Summe oder Ziffern, feste Rundenzahl, niedrigste Summe gewinnt, Zug-Timer.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Room, combos } from '../games/shutthebox/room.js';

const seq = (...v) => () => { assert.ok(v.length, 'Würfel aufgebraucht'); return v.shift(); };
function setup(n = 2, settings = {}) {
  const r = new Room('SB', { turnTime: 0, ...settings }, () => {});
  const ids = ['Anna', 'Ben', 'Cem'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}

test('Kombinationen: alle Klappen-Mengen mit genau dieser Summe', () => {
  assert.deepEqual(combos([1, 2, 3, 4, 5, 6, 7, 8, 9], 8), [[1, 2, 5], [1, 3, 4], [1, 7], [2, 6], [3, 5], [8]]);
  assert.deepEqual(combos([2, 4], 5), []);
  assert.deepEqual(combos([12], 12), [[12]]);
});

test('Zug: würfeln, genau passende Klappen schließen, weiterwürfeln; passt nichts mehr, endet der Zug mit der Summe der offenen', () => {
  const { r, ids: [a, b] } = setup(2);
  assert.throws(() => r.close(a, [8]), /Erst würfeln/);
  r.roll = seq(5, 3); r.throwDice(a);
  assert.equal(r.view(a).g.sum, 8);
  assert.equal(r.view(a).g.combos.length, 6);
  assert.equal(r.view(b).g.combos, null, 'Vorschläge nur für den, der dran ist');
  assert.throws(() => r.throwDice(a), /Erst Klappen schließen/);
  assert.throws(() => r.close(a, [5, 4]), /genau 8/);
  r.close(a, [5, 3]);
  assert.deepEqual(r.boxes[a], [1, 2, 4, 6, 7, 8, 9]);
  assert.throws(() => r.close(a, [8]), /Erst würfeln/);
  r.roll = seq(6, 6); r.throwDice(a); r.close(a, [4, 8]);
  r.roll = seq(1, 1); r.throwDice(a); r.close(a, [2]);
  r.roll = seq(1, 2); r.throwDice(a); // 3: 3 ist zu, 1 + 2 geht nicht mehr (2 ist zu) → keine Kombination
  assert.equal(r.currentId, b, 'Zug vorbei');
  assert.deepEqual(r.results[a], [1 + 6 + 7 + 9]);
});

test('Ein-Würfel-Regel: erst wenn 7, 8, 9 zu sind – abschaltbar', () => {
  const { r, ids: [a] } = setup(1);
  assert.throws(() => r.throwDice(a, 1), /erst, wenn 7 bis 9 zu/);
  r.boxes[a] = [1, 2, 3];
  assert.ok(r.view(a).g.canOneDie);
  r.roll = seq(3); r.throwDice(a, 1);
  assert.deepEqual(r.dice, [3]);
  const off = setup(1, { oneDie: false });
  off.r.boxes[off.ids[0]] = [1, 2];
  assert.throws(() => off.r.throwDice(off.ids[0], 1), /erst, wenn/);
});

test('Box geschlossen: 0 Punkte, Runde sofort vorbei – wer noch nicht dran war, bekommt die volle Summe', () => {
  const { r, ids: [a, b, c] } = setup(3);
  r.boxes[a] = [4, 5];
  r.roll = seq(4, 5); r.throwDice(a); r.close(a, [4, 5]);
  assert.deepEqual(r.results[a], [0]);
  assert.deepEqual(r.results[b], [45]);
  assert.deepEqual(r.results[c], [45]);
  assert.equal(r.sub, 2, 'nächste Runde');
  assert.equal(r.boxes[a].length, 9, 'Boxen wieder offen');
  assert.equal(r.lastShut.id, a);
});

test('Klappen 1–12 und Wertung „Ziffern hintereinander“', () => {
  const { r, ids: [a] } = setup(1, { twelve: true, digits: true, rounds: 1 });
  assert.equal(r.boxes[a].length, 12);
  assert.throws(() => r.throwDice(a, 1), /7 bis 12/);
  r.boxes[a] = [1, 4, 10];
  r.roll = seq(1, 1); r.throwDice(a); // 2 passt nicht → Zugende
  assert.deepEqual(r.results[a], [1410]);
  assert.equal(r.phase, 'over');
});

test('Feste Rundenzahl, niedrigste Gesamtsumme gewinnt (Gleichstand: beide); Bestenliste mit Summen', () => {
  const { r, ids: [a, b] } = setup(2, { rounds: 2 });
  const noMatch = (open) => { const id = r.currentId; r.boxes[id] = open; r.roll = seq(1, 1); r.throwDice(id); }; // 2 passt nicht
  noMatch([3, 9]); noMatch([4, 5]);   // Runde 1
  noMatch([3]); noMatch([6]);         // Runde 2
  assert.equal(r.phase, 'over');
  const sums = r.result.points;
  assert.equal(sums[a] + sums[b], 12 + 9 + 3 + 6);
  assert.deepEqual(r.result.winners.sort(), sums[a] === sums[b] ? [a, b].sort() : [sums[a] < sums[b] ? a : b]);
  assert.ok(r.opts.lowWins);
});

test('Zug-Timer: der Computer würfelt bzw. schließt die höchsten Klappen', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const { r, ids: [a] } = setup(2, { turnTime: 15 });
    r.roll = seq(6, 3, 1, 1);
    r.afterChange();
    mock.timers.tick(15500); r.afterChange();
    assert.deepEqual(r.dice, [6, 3]);
    mock.timers.tick(15500);
    assert.ok(!r.boxes[a].includes(9), 'die 9 geschlossen');
    r.dispose();
  } finally { mock.timers.reset(); }
});
