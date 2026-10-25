// Kniffel: Felder, Bonus ab 63, drei Würfe mit Liegenlassen, Eintragen/Streichen, 13 Runden, Sieger – Hausregeln Extra-Bonus und Joker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, fieldValue, totals, FIELDS, UPPER } from '../games/kniffel/room.js';

const seq = (...v) => () => { assert.ok(v.length, 'Würfel aufgebraucht'); return v.shift(); };
function setup(n = 2, settings = {}) {
  const r = new Room('KN', settings, () => {});
  const ids = ['Anna', 'Ben', 'Cem'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}
// Ein Zug: würfeln (feste Augen) und eintragen
const turn = (r, id, dice, field) => { r.roll = seq(...dice); r.throwDice(id); r.score(id, field); };

test('Felder: oben Summe der Augen, Pasch, Full House, Straßen, Kniffel, Chance', () => {
  const d = [3, 3, 3, 5, 5];
  assert.equal(fieldValue('threes', d), 9);
  assert.equal(fieldValue('fives', d), 10);
  assert.equal(fieldValue('sixes', d), 0);
  assert.equal(fieldValue('threeKind', d), 19);
  assert.equal(fieldValue('fourKind', d), 0);
  assert.equal(fieldValue('fullHouse', d), 25);
  assert.equal(fieldValue('fullHouse', [4, 4, 4, 4, 4]), 0, 'Kniffel ist ohne Joker kein Full House');
  assert.equal(fieldValue('smallStraight', [1, 2, 3, 4, 6]), 30);
  assert.equal(fieldValue('smallStraight', [3, 4, 5, 6, 6]), 30);
  assert.equal(fieldValue('smallStraight', [1, 2, 4, 5, 6]), 0);
  assert.equal(fieldValue('largeStraight', [2, 3, 4, 5, 6]), 40);
  assert.equal(fieldValue('largeStraight', [1, 2, 3, 4, 6]), 0);
  assert.equal(fieldValue('kniffel', [6, 6, 6, 6, 6]), 50);
  assert.equal(fieldValue('chance', [1, 2, 3, 4, 6]), 16);
  assert.equal(fieldValue('fourKind', [2, 2, 2, 2, 6]), 14);
});

test('Bonus 35 ab 63 Punkten oben', () => {
  const s = Object.fromEntries(FIELDS.map((f) => [f, null]));
  UPPER.forEach((f, i) => { s[f] = 3 * (i + 1); }); // je dreimal = 63
  assert.deepEqual(totals(s), { upper: 63, bonus: 35, lower: 0, extra: 0, total: 98 });
  s.sixes = 12;
  assert.equal(totals(s).bonus, 0, '57 reicht nicht');
});

test('Zug: bis zu 3 Würfe, liegen gelassene Würfel bleiben, eintragen beendet den Zug, Streichen geht', () => {
  const { r, ids: [a, b] } = setup(2);
  assert.throws(() => r.score(a, 'chance'), /Erst würfeln/);
  r.roll = seq(1, 2, 3, 4, 5);
  r.throwDice(a);
  assert.deepEqual(r.dice, [1, 2, 3, 4, 5]);
  r.roll = seq(6, 6);
  r.throwDice(a, [0, 1, 2]);               // 1, 2, 3 liegen lassen
  assert.deepEqual(r.dice, [1, 2, 3, 6, 6]);
  assert.deepEqual(r.held, [true, true, true, false, false]);
  r.roll = seq(4, 5);
  r.throwDice(a, [0, 1, 2]);
  assert.throws(() => r.throwDice(a), /Drei Würfe/);
  assert.deepEqual(r.view(a).g.options.largeStraight, 40);
  assert.equal(r.view(b).g.options, null, 'Vorschläge nur für den, der dran ist');
  r.score(a, 'largeStraight');
  assert.equal(r.sheets[a].largeStraight, 40);
  assert.equal(r.currentId, b);
  assert.equal(r.rolls, 0, 'neuer Zug, neue Würfe');
  turn(r, b, [1, 1, 2, 2, 3], 'kniffel'); // streichen: 0
  assert.equal(r.sheets[b].kniffel, 0);
  assert.throws(() => turn(r, a, [1, 1, 1, 1, 1], 'largeStraight'), /schon eingetragen/);
});

test('13 Runden: danach Endwertung, höchste Summe gewinnt, Gleichstand = beide; Bestenliste mit Summen', () => {
  const events = [];
  const r = new Room('KN', {}, (k, d) => events.push([k, d]));
  const [a, b] = ['Anna', 'Ben'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(a);
  for (const f of FIELDS) { turn(r, a, [6, 6, 6, 6, 6], f); turn(r, b, [6, 6, 6, 6, 6], f); }
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners.sort(), [a, b].sort(), 'Gleichstand');
  const t = totals(r.sheets[a]).total;
  assert.equal(r.result.points[a], t);
  assert.deepEqual(events.find(([k]) => k === 'result')[1].entries.map((e) => e.points), [t, t]);
});

test('Allein spielen: 13 Züge, dann Ende', () => {
  const { r, ids: [a] } = setup(1);
  FIELDS.forEach((f) => turn(r, a, [1, 2, 3, 4, 5], f));
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [a]);
});

test('Hausregel Extra-Kniffel-Bonus: +50 nur, wenn das Kniffel-Feld schon 50 hat', () => {
  const { r, ids: [a, b] } = setup(2, { extraBonus: true });
  turn(r, a, [5, 5, 5, 5, 5], 'kniffel');
  turn(r, b, [1, 1, 1, 1, 1], 'kniffel');
  turn(r, a, [5, 5, 5, 5, 5], 'fives');
  assert.equal(r.extra[a], 50);
  assert.equal(totals(r.sheets[a], r.extra[a]).total, 50 + 25 + 50);
  turn(r, b, [2, 3, 4, 5, 6], 'largeStraight');
  // Kniffel gestrichen → kein Bonus
  const g = setup(1, { extraBonus: true });
  turn(g.r, g.ids[0], [1, 2, 3, 4, 6], 'kniffel');
  turn(g.r, g.ids[0], [4, 4, 4, 4, 4], 'fours');
  assert.equal(g.r.extra[g.ids[0]], 0);
  // Ohne Hausregel kein Bonus
  const o = setup(1);
  turn(o.r, o.ids[0], [3, 3, 3, 3, 3], 'kniffel');
  turn(o.r, o.ids[0], [3, 3, 3, 3, 3], 'threes');
  assert.equal(o.r.extra[o.ids[0]], 0);
});

test('Hausregel Joker: erst das passende obere Feld, sonst unten mit voller Punktzahl, sonst oben 0', () => {
  const { r, ids: [a] } = setup(1, { joker: true });
  turn(r, a, [4, 4, 4, 4, 4], 'kniffel');
  // Zweiter Kniffel aus Vieren: nur „Vierer“ erlaubt
  r.roll = seq(4, 4, 4, 4, 4); r.throwDice(a);
  assert.deepEqual(r.options(a), { fours: 20 });
  assert.throws(() => r.score(a, 'fullHouse'), /Joker-Regel/);
  r.score(a, 'fours');
  // Dritter Kniffel aus Vieren: Vierer belegt → untere Felder mit voller Punktzahl
  r.roll = seq(4, 4, 4, 4, 4); r.throwDice(a);
  const o = r.options(a);
  assert.equal(o.fullHouse, 25); assert.equal(o.smallStraight, 30); assert.equal(o.largeStraight, 40); assert.equal(o.chance, 20);
  assert.ok(!('ones' in o), 'oben nur, wenn unten nichts frei ist');
  r.score(a, 'largeStraight');
  assert.equal(r.sheets[a].largeStraight, 40);
  // Ohne Joker: Kniffel aus Vieren ist keine Große Straße
  const n = setup(1);
  turn(n.r, n.ids[0], [4, 4, 4, 4, 4], 'kniffel');
  n.r.roll = seq(4, 4, 4, 4, 4); n.r.throwDice(n.ids[0]);
  assert.equal(n.r.options(n.ids[0]).largeStraight, 0);
});

test('Aussteigen: die anderen spielen weiter; wer übrig ist und fertig ist, gewinnt', () => {
  const { r, ids: [a, b, c] } = setup(3);
  turn(r, a, [1, 1, 1, 2, 2], 'fullHouse');
  r.stand(b);
  assert.equal(r.phase, 'playing');
  assert.equal(r.currentId, c);
  r.stand(c);
  assert.equal(r.phase, 'playing', 'allein geht es weiter');
  for (const f of FIELDS.filter((x) => x !== 'fullHouse')) turn(r, a, [2, 2, 2, 3, 3], f);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [a]);
});
