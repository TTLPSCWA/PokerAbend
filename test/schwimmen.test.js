// Schwimmen (31): Werte, Züge, Schieben, Klopfen, 31, Feuer, Leben und Schwimmen, Sieg – und keine fremden Karten im Browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, handValue, SUITS, RANKS } from '../games/schwimmen/room.js';

function setup(n = 3, settings = {}) {
  const r = new Room('SW', settings, () => {});
  const ids = ['Anna', 'Ben', 'Cem', 'Dora'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  // Nach einer Wertung nicht wirklich neu geben – sonst könnte die neue Hand schon 31 haben und das Ergebnis überschreiben
  r.deal = (start) => { r.dealNo++; r.resetDeal(); r.turn = start % r.order.length; };
  return { r, ids };
}
// Feste Hände und Mitte (ohne 31, damit nichts sofort endet); der Rest bleibt im Stapel
function fix(r, hands, middle) {
  const used = new Set([...Object.values(hands).flat(), ...middle]);
  r.hands = { ...hands }; r.middle = [...middle];
  r.deck = SUITS.flatMap((s) => RANKS.map((x) => x + s)).filter((c) => !used.has(c));
}

test('Werte: höchste Farbe zählt, drei gleiche 30½, 31, Feuer 33', () => {
  assert.equal(handValue(['Ah', 'Kh', '7s']), 21);
  assert.equal(handValue(['Ah', 'Kh', 'Th']), 31);
  assert.equal(handValue(['8c', '8h', '8s']), 30.5);
  assert.equal(handValue(['Ac', 'Ah', 'As']), 30.5, 'ohne Feuer sind drei Asse 30½');
  assert.equal(handValue(['Ac', 'Ah', 'As'], true), 33);
  assert.equal(handValue(['7c', '8h', '9s']), 9);
  assert.equal(handValue(['Qd', 'Jd', '9d']), 29);
});

test('Geben: 3 Karten je Spieler, 3 in der Mitte, 32 insgesamt – fremde Karten nie in der Ansicht', () => {
  const { r, ids: [a, b, c] } = setup(3);
  assert.equal(r.middle.length, 3);
  for (const id of [a, b, c]) assert.equal(r.hands[id].length, 3);
  assert.equal(r.deck.length + 3 + 9, 32);
  const v = r.view(a);
  assert.deepEqual(v.g.hand, r.hands[a]);
  const json = JSON.stringify(v);
  for (const card of [...r.hands[b], ...r.hands[c]]) assert.ok(!json.includes(`"${card}"`), `fremde Karte ${card} in der Ansicht`);
  assert.equal(r.view('zuschauer').g.hand, null);
});

test('Tauschen: eine, alle drei; Schieben (abschaltbar); alle schieben → neue Mitte', () => {
  const { r, ids: [a, b, c] } = setup(3);
  fix(r, { [a]: ['7c', '8c', '9h'], [b]: ['7d', '8d', '9s'], [c]: ['7h', '8h', '9c'] }, ['Ks', 'Qs', 'Js']);
  r.swap(a, 0, 1);
  assert.deepEqual(r.hands[a], ['Qs', '8c', '9h']);
  assert.deepEqual(r.middle, ['Ks', '7c', 'Js']);
  assert.equal(r.currentId, b);
  r.swapAll(b);
  assert.deepEqual(r.hands[b], ['Ks', '7c', 'Js']);
  assert.deepEqual(r.middle, ['7d', '8d', '9s']);
  r.pass(c); r.pass(a);
  const before = [...r.middle];
  r.pass(b); // dritter in Folge → neue Mitte
  assert.equal(r.middle.length, 3);
  assert.notDeepEqual(r.middle, before, 'neue Mitte');
  assert.equal(r.deck.length + 3 + 9, 32, 'keine Karte verloren');
  const off = setup(2, { passing: false });
  assert.throws(() => off.r.pass(off.r.currentId), /Schieben ist an diesem Tisch aus/);
});

test('Klopfen: erst ab der zweiten Runde, dann hat jeder andere genau einen Zug, danach Wertung', () => {
  const { r, ids: [a, b, c] } = setup(3);
  fix(r, { [a]: ['Ac', 'Kc', '7d'], [b]: ['7h', '8s', '9d'], [c]: ['Qh', 'Jh', '8c'] }, ['7s', '8d', '9c']);
  assert.throws(() => r.knock(a), /zweiten Runde/);
  r.pass(a); r.pass(b); r.pass(c);
  assert.ok(r.view(a).g.canKnock);
  r.knock(a);
  assert.equal(r.knocker, a);
  assert.equal(r.currentId, b);
  assert.throws(() => r.knock(b), /schon jemand/);
  r.pass(b);
  assert.equal(r.dealNo, 1, 'noch nicht gewertet');
  r.pass(c); // letzter Zug → Wertung: Ben hat 9 und verliert ein Leben
  assert.equal(r.dealNo, 2);
  assert.deepEqual(r.lastDeal.losers, [b]);
  assert.equal(r.lastDeal.reason, 'klopfen');
  assert.equal(r.lives[b], 2);
  assert.equal(r.currentId, b, 'der Verlierer fängt den nächsten Durchgang an');
});

test('31 beendet den Durchgang sofort, Gleichstand unten: alle verlieren ein Leben', () => {
  const { r, ids: [a, b, c] } = setup(3);
  fix(r, { [a]: ['Ah', 'Kh', '7c'], [b]: ['7d', '8s', '9c'], [c]: ['7s', '8c', '9d'] }, ['Th', 'Jd', 'Qs']);
  r.swap(a, 2, 0); // Ah Kh Th = 31
  assert.equal(r.lastDeal.reason, '31');
  assert.equal(r.lastDeal.hero, a);
  assert.deepEqual([...r.lastDeal.losers].sort(), [b, c].sort(), 'beide mit 9 verlieren');
  assert.equal(r.lives[b], 2); assert.equal(r.lives[c], 2); assert.equal(r.lives[a], 3);
  // Nach der Wertung sehen alle die aufgedeckten Hände des Durchgangs
  assert.deepEqual(r.view(b).g.lastDeal.hands[a], ['Ah', 'Kh', 'Th']);
});

test('Feuer: drei Asse – alle anderen verlieren ein Leben; ohne Feuer 30½', () => {
  const { r, ids: [a, b, c] } = setup(3, { fire: true });
  fix(r, { [a]: ['Ac', 'Ah', '7d'], [b]: ['Kc', 'Qc', 'Jc'], [c]: ['7h', '8h', '9h'] }, ['As', '8d', '9s']);
  r.swap(a, 2, 0);
  assert.equal(r.lastDeal.reason, 'feuer');
  assert.deepEqual([...r.lastDeal.losers].sort(), [b, c].sort());
  const n = setup(3, { fire: false });
  fix(n.r, { [n.ids[0]]: ['Ac', 'Ah', '7d'], [n.ids[1]]: ['Kc', 'Qc', 'Jc'], [n.ids[2]]: ['7h', '8h', '9h'] }, ['As', '8d', '9s']);
  n.r.swap(n.ids[0], 2, 0);
  assert.equal(n.r.dealNo, 1, 'ohne Feuer geht es weiter');
  assert.equal(n.r.value(n.ids[0]), 30.5);
});

// Lässt Spieler „id“ den nächsten Durchgang verlieren (Ass + zwei Zehner für einen anderen = 31)
function loseNext(r, id) {
  const other = r.order.find((p) => p !== id);
  const rest = r.order.filter((p) => p !== id && p !== other);
  const hands = { [other]: ['Ah', 'Kh', '7c'], [id]: ['7d', '8s', '9c'] };
  const pool = ['Qc', 'Jc', 'Tc', 'Qs', 'Js', 'Ts', 'Kd', 'Qd'];
  rest.forEach((p, i) => { hands[p] = [pool[i * 3 % 8], pool[(i * 3 + 1) % 8], pool[(i * 3 + 2) % 8]]; });
  fix(r, hands, ['Th', '8d', '9h']);
  r.turn = r.order.indexOf(other);
  r.swap(other, 2, 0);
}

test('Leben weg → schwimmen → raus; ohne Schwimmen gleich raus; der Letzte gewinnt', () => {
  const { r, ids: [a, b] } = setup(2, { lives: 2 });
  loseNext(r, b); assert.equal(r.lives[b], 1);
  loseNext(r, b); assert.equal(r.lives[b], 0); assert.ok(r.swimming.has(b), 'schwimmt');
  assert.equal(r.view(a).players.find((p) => p.id === b).swimming, true);
  loseNext(r, b);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [a]);
  assert.equal(r.scores[a], 1);
  const s = setup(2, { lives: 2, swim: false });
  loseNext(s.r, s.ids[1]); loseNext(s.r, s.ids[1]);
  assert.equal(s.r.phase, 'over', 'ohne Schwimmen nach 2 Leben raus');
});

test('Würden alle Übrigen ausscheiden, zählt der Durchgang nicht', () => {
  const { r, ids: [a, b] } = setup(2, { lives: 2 });
  r.lives[a] = 0; r.lives[b] = 0; r.swimming = new Set([a, b]);
  fix(r, { [a]: ['7d', '8s', '9c'], [b]: ['7c', '8h', '9d'] }, ['Th', 'Js', 'Qd']);
  r.pass(r.currentId); r.pass(r.currentId);
  r.knock(r.currentId); r.pass(r.currentId); // beide 9 → beide wären raus
  assert.equal(r.phase, 'playing');
  assert.equal(r.order.length, 2);
  assert.equal(r.dealNo, 2, 'neu gegeben');
});

test('Aussteigen: Karten zurück in den Stapel, ohne Gegner gewinnt der Letzte', () => {
  const { r, ids: [a, b, c] } = setup(3);
  r.stand(c);
  assert.equal(r.deck.length + r.middle.length + Object.values(r.hands).flat().length, 32);
  r.stand(b);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [a]);
});
