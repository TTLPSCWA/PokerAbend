// Phase 10: feste Joker in Auslagen, Phasen mit mehr Karten auslegen (Mindestangaben), Hausregel „genaue Kartenanzahl“.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { fixGroup, hitSide, partitionMin, PHASES } from '../games/zehnetappen/room.js';

let k = 1;
const C = (c, n = 0) => ({ id: k++, c, n });
function table(settings = {}, phase = 1) {
  const r = GAMES.zehnetappen.create('PH', settings, () => {});
  const ids = ['Anna', 'Ben', 'Carla'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  r.progress[ids[0]] = phase;
  r.step = 'play';
  return { r, ids, a: ids[0], b: ids[1] };
}
const give = (r, id, cards) => { r.hands[id] = cards; };

test('Joker bekommen beim Auslegen einen festen Wert (Folge: Lücke, Enden; Satz: Zahl; Farbe)', () => {
  const run = fixGroup('run', [C('r', 3), C('j'), C('b', 5), C('g', 6)]);
  assert.deepEqual(run.vals, [3, 4, 5, 6]);
  assert.equal(run.cards[1].c, 'j');
  const ends = fixGroup('run', [C('r', 10), C('b', 11), C('j'), C('j')]);
  assert.deepEqual(ends.vals, [9, 10, 11, 12], 'erst nach oben bis 12, dann nach unten');
  const set = fixGroup('set', [C('r', 7), C('b', 7), C('j')]);
  assert.deepEqual(set.vals, [7, 7, 7]);
  const col = fixGroup('color', [C('g', 1), C('g', 9), C('j')]);
  assert.deepEqual(col.vals, ['g', 'g', 'g']);
  assert.equal(fixGroup('set', [C('j'), C('j'), C('j')]), null, 'mindestens eine echte Karte');
  assert.equal(fixGroup('run', [C('r', 3), C('r', 3), C('j')]), null);
});

test('Anlegen an Folgen mit Joker: beide Enden, Joker-Position bleibt, Lücken gibt es nicht mehr', () => {
  const g = fixGroup('run', [C('r', 3), C('j'), C('b', 5), C('g', 6)]);
  const jokerCard = g.cards[1];
  assert.equal(hitSide(g, C('y', 7)), 'high');
  assert.equal(hitSide(g, C('y', 2)), 'low');
  assert.equal(hitSide(g, C('y', 4)), null, 'die 4 ist schon vom Joker besetzt');
  assert.equal(hitSide(g, C('y', 9)), null);
  assert.equal(hitSide(g, C('j')), 'high');
  assert.equal(hitSide(g, C('j'), 'low'), 'low');
  const full = fixGroup('run', Array.from({ length: 12 }, (_, i) => C('r', i + 1)));
  assert.equal(hitSide(full, C('j')), null, 'nichts mehr zu verlängern');
  const top = fixGroup('run', [C('r', 10), C('r', 11), C('r', 12)]);
  assert.equal(hitSide(top, C('y', 12)), null);
  assert.equal(hitSide(top, C('j')), 'low', 'oben ist Schluss');
  assert.equal(g.cards[1], jokerCard);
});

test('Server: ausgelegte Joker bleiben liegen – Anlegen verändert sie nicht, Tauschen/Aufnehmen gibt es nicht', () => {
  const { r, a, b } = table({}, 2); // Drilling + 4er-Folge
  give(r, a, [C('r', 4), C('g', 4), C('b', 4), C('r', 5), C('g', 6), C('j'), C('y', 8), C('b', 12)]);
  const h = r.hands[a];
  r.layPhase(a, h.slice(0, 7).map((c) => c.id)); // Drilling 4 + Folge 5, 6, Joker (= 7), 8
  assert.ok(r.done.has(a));
  const run = r.laid[a].find((g) => g.type === 'run');
  const jokerIdx = run.cards.findIndex((c) => c.c === 'j');
  assert.ok(jokerIdx >= 0);
  const jokerVal = run.vals[jokerIdx];
  const jokerCard = run.cards[jokerIdx];
  const hi = run.vals[run.vals.length - 1] + 1;
  give(r, a, [C('y', hi), C('b', 12)]);
  r.hit(a, r.hands[a][0].id, a, r.laid[a].indexOf(run));
  const jIdx = run.cards.indexOf(jokerCard);
  assert.equal(run.cards[jIdx].c, 'j');
  assert.equal(run.vals[jIdx], jokerVal, 'der Joker behält seinen Wert');
  assert.equal(run.vals[run.vals.length - 1], hi);
  assert.throws(() => r.takeJoker(), /Joker bleiben liegen/);
  assert.throws(() => GAMES.zehnetappen.events.takeJoker(r, r.players.get(a), {}), /Joker bleiben liegen/);
  // Karten aus der Auslage lassen sich nicht anlegen oder abwerfen (sie gehören nicht zur Hand)
  assert.throws(() => r.hit(a, jokerCard.id, a, r.laid[a].indexOf(run)), /nicht/);
  assert.throws(() => r.throwAway(a, jokerCard.id), /nicht/);
  assert.throws(() => r.hit(b, jokerCard.id, a, 0), /nicht|dran|Phase/);
  // Die Ansicht zeigt den festen Wert
  const view = r.view(b).g.laid[a].find((g) => g.type === 'run');
  assert.equal(view.vals[view.cards.indexOf(jokerCard)], jokerVal);
});

test('Joker beim Anlegen an einen Satz bekommt dessen Zahl', () => {
  const { r, a } = table({}, 1);
  give(r, a, [C('r', 7), C('b', 7), C('g', 7), C('r', 9), C('b', 9), C('g', 9), C('j'), C('y', 1)]);
  const h = r.hands[a];
  r.layPhase(a, h.slice(0, 6).map((c) => c.id));
  const setIdx = r.laid[a].findIndex((g) => g.vals[0] === 7);
  r.hit(a, r.hands[a].find((c) => c.c === 'j').id, a, setIdx);
  assert.deepEqual(r.laid[a][setIdx].vals, [7, 7, 7, 7]);
  assert.equal(r.laid[a][setIdx].cards.at(-1).c, 'j');
});

test('Phase mit mehr Karten: 6er-Folge, 4er-Vierling, mit Joker, 9 einer Farbe', () => {
  const { r, a } = table({}, 2); // Drilling + 4er-Folge
  give(r, a, [C('r', 2), C('b', 2), C('g', 2), C('y', 2), C('r', 3), C('g', 4), C('b', 5), C('y', 6), C('r', 7), C('r', 8), C('b', 11)]);
  const hh = r.hands[a];
  assert.throws(() => r.layPhase(a, [], [[hh[0].id, hh[1].id, hh[4].id], hh.slice(5, 9).map((c) => c.id)]), /passt nicht/, 'Gruppe 1 ist kein Satz');
  r.layPhase(a, [], [hh.slice(0, 4).map((c) => c.id), hh.slice(4, 10).map((c) => c.id)]); // Vierling (statt Drilling) + 6er-Folge, so aufgeteilt
  assert.equal(r.laid[a].map((g) => g.cards.length).sort().join(), '4,6');
  assert.equal(r.hands[a].length, 1);
  const t = table({}, 4); // 7er-Folge als 9er-Folge mit Joker
  give(t.r, t.a, [C('r', 1), C('r', 2), C('j'), C('r', 4), C('r', 5), C('r', 6), C('r', 7), C('r', 8), C('r', 9), C('b', 11)]);
  t.r.layPhase(t.a, t.r.hands[t.a].slice(0, 9).map((c) => c.id));
  assert.equal(t.r.laid[t.a][0].cards.length, 9);
  assert.deepEqual(t.r.laid[t.a][0].vals, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const f = table({}, 8); // 7 einer Farbe als 9
  give(f.r, f.a, [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => C('g', n)).concat([C('b', 1), C('y', 3)]));
  f.r.layPhase(f.a, f.r.hands[f.a].slice(0, 9).map((c) => c.id));
  assert.equal(f.r.laid[f.a][0].cards.length, 9);
  const s = table({}, 1); // 2 Drillinge als Vierling + Fünfling (mit Joker)
  give(s.r, s.a, [C('r', 4), C('g', 4), C('b', 4), C('y', 4), C('r', 9), C('g', 9), C('b', 9), C('y', 9), C('j'), C('r', 1)]);
  s.r.layPhase(s.a, s.r.hands[s.a].slice(0, 9).map((c) => c.id));
  assert.equal(s.r.laid[s.a].map((g) => g.cards.length).sort().join(), '4,5');
});

test('Ungültige Auslagen werden weiter abgelehnt (zu wenig, Lücke ohne Joker, nur Joker, Aussetzen)', () => {
  const { r, a } = table({}, 2);
  give(r, a, [C('r', 2), C('b', 2), C('g', 2), C('r', 3), C('g', 4), C('b', 5), C('y', 7), C('j'), C('j'), C('j'), C('s')]);
  const h = r.hands[a];
  const ids = (list) => list.map((c) => c.id);
  assert.throws(() => r.layPhase(a, ids(h.slice(0, 5))), /passt nicht/, 'zu wenige Karten');
  assert.throws(() => r.layPhase(a, ids([h[0], h[1], h[2], h[3], h[4], h[6]])), /passt nicht/, 'Lücke 4–7 ohne Joker');
  assert.throws(() => r.layPhase(a, ids([h[0], h[1], h[2], h[7], h[8], h[9]])), /passt nicht/, 'Folge nur aus Jokern');
  assert.throws(() => r.layPhase(a, ids([h[0], h[1], h[2], h[3], h[4], h[10]])), /passt nicht/, 'Aussetzen nie in Gruppen');
  assert.throws(() => r.layPhase(a, [999999]), /nicht/, 'Karte nicht auf der Hand');
  assert.equal(r.done.has(a), false);
  assert.equal(r.hands[a].length, 11, 'nach einer abgelehnten Auslage bleibt alles wie vorher');
});

test('Hausregel „nur genaue Kartenanzahl“: Standard aus; mehr Karten werden dann abgelehnt', () => {
  assert.equal(GAMES.zehnetappen.create('X', {}, () => {}).settings.exactSize, false);
  const { r, a } = table({ exactSize: true }, 2);
  give(r, a, [C('r', 2), C('b', 2), C('g', 2), C('y', 2), C('r', 3), C('g', 4), C('b', 5), C('y', 6), C('r', 8)]);
  assert.throws(() => r.layPhase(a, r.hands[a].slice(0, 8).map((c) => c.id)), /passt nicht/, 'Vierling statt Drilling');
  const exact = [0, 1, 2, 4, 5, 6, 7].map((i) => r.hands[a][i]);
  r.layPhase(a, exact.map((c) => c.id));
  assert.ok(r.done.has(a));
  assert.equal(partitionMin([C('r', 2), C('b', 2), C('g', 2), C('y', 5)], PHASES[2]), null);
});
