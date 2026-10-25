// Ergänzende Regeltests (B1): Zugreihenfolge, Sonderkarten/-würfe, Spielende, Punktezählung, Kartenzahl.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room as MauMau } from '../games/maumau/room.js';
import { Room as UNO } from '../games/farbenchaos/room.js';
import { Room as Maexchen } from '../games/maexchen/room.js';
import { Room as Schocken, DECKEL } from '../games/schocken/room.js';
import { Room as Maedn } from '../games/huetchen/room.js';
import { Room as Phase10 } from '../games/zehnetappen/room.js';
import { Room as SkipBo, JOKER } from '../games/stapelrennen/room.js';

function setup(Room, names = ['Anna', 'Ben', 'Carla'], settings = {}) {
  const r = new Room('TESTX', settings, () => {});
  const ids = names.map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}
const seq = (...vals) => () => { if (!vals.length) throw new Error('Würfel aufgebraucht'); return vals.shift(); };
const count = (...lists) => lists.reduce((a, l) => a + l.length, 0);

// ---------- Mau-Mau ----------
test('Mau-Mau: Reihenfolge reihum, Kartenzahl bleibt, zwei Spiele ab 6', () => {
  const { r, ids: [a, b, c] } = setup(MauMau);
  assert.equal(count(r.deck, r.discard, ...Object.values(r.hands)), 32);
  assert.ok(Object.values(r.hands).every((h) => h.length === 5));
  r.discard = ['9d'];
  r.hands[a] = ['9h', '9s']; r.hands[b] = ['Kh', 'Ks']; r.hands[c] = ['Qh', 'Qs'];
  r.play(a, '9h'); assert.equal(r.currentId, b);
  r.play(b, 'Kh'); assert.equal(r.currentId, c);
  r.play(c, 'Qh'); assert.equal(r.currentId, a);
  const six = setup(MauMau, ['A', 'B', 'C', 'D', 'E', 'F'], { handSize: 4 }).r;
  assert.equal(count(six.deck, six.discard, ...Object.values(six.hands)), 64);
  assert.ok(Object.values(six.hands).every((h) => h.length === 4));
});

test('Mau-Mau: leerer Stapel wird aus der Ablage gemischt, oberste Karte bleibt liegen', () => {
  const { r, ids: [a] } = setup(MauMau);
  r.deck = []; r.discard = ['9h', 'Kc', 'Qd', '8s']; r.hands[a] = ['7c'];
  r.draw(a);
  assert.equal(r.hands[a].length, 2);
  assert.deepEqual(r.discard, ['8s']);
  assert.equal(r.deck.length, 2);
});

test('Mau-Mau: letzte Karte eine 7 beendet die Runde sofort, 8 zu zweit = nochmal dran', () => {
  const { r, ids: [a, b, c] } = setup(MauMau);
  r.discard = ['9h']; r.hands[a] = ['7h']; r.hands[b] = ['Ac']; r.hands[c] = ['Kd', 'Qs'];
  r.play(a, '7h');
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.scores, { [a]: 0, [b]: 11, [c]: 4 + 3 });
  const two = setup(MauMau, ['A', 'B']);
  two.r.discard = ['9h']; two.r.hands[two.ids[0]] = ['8h', 'Kh'];
  two.r.play(two.ids[0], '8h');
  assert.equal(two.r.currentId, two.ids[0]);
});

// ---------- UNO ----------
test('UNO: +2 zu zweit, Richtungswechsel zu dritt, Farbwahl nötig, +4-Farbe gilt', () => {
  const { r, ids: [a, b] } = setup(UNO, ['Anna', 'Ben']);
  assert.equal(count(r.deck, r.discard, ...Object.values(r.hands)), 108);
  r.discard = ['5r']; r.hands[a] = ['Dr', '1g', '2g']; r.hands[b] = ['9b'];
  r.play(a, 'Dr');
  assert.equal(r.hands[b].length, 3, 'Ben zieht 2');
  assert.equal(r.currentId, a, 'und setzt aus');
  assert.throws(() => r.play(a, 'Ww'), /Karte hast du nicht/);
  r.hands[a].push('Ww', 'Fw');
  assert.throws(() => r.play(a, 'Ww'), /Farbe wünschen/);
  r.play(a, 'Fw', 'b');
  assert.equal(r.currentId, a, '+4 lässt Ben aussetzen');
  assert.throws(() => r.play(a, '1g'), /passt nicht/, 'Blau ist gewünscht');
  const three = setup(UNO);
  const [x, y, z] = three.ids;
  three.r.discard = ['5r']; three.r.hands[x] = ['Rr', '1r']; three.r.hands[z] = ['6r', '7r']; three.r.hands[y] = ['8r', '9r'];
  three.r.play(x, 'Rr'); assert.equal(three.r.currentId, z);
  three.r.play(z, '6r'); assert.equal(three.r.currentId, y, 'gegen den Uhrzeigersinn weiter');
});

// ---------- Mäxchen ----------
test('Mäxchen: Reihenfolge, nichts anzuzweifeln, Geltenlassen nur bei Mäxchen, Ansager steigt aus', () => {
  const { r, ids: [a, b, c] } = setup(Maexchen);
  assert.throws(() => r.doubt(a), /nichts anzuzweifeln/);
  r.roll = seq(5, 3);
  r.throwDice(a); r.announce(a, 53);
  assert.equal(r.currentId, b);
  assert.throws(() => r.accept(b), /nur bei Mäxchen/);
  r.stand(a); // Ansager weg → keine offene Ansage mehr
  assert.equal(r.last, null);
  assert.equal(r.currentId, b);
  assert.ok(c);
});

// ---------- Schocken ----------
test('Schocken: Würfelregeln, Wurfzahl vom Ersten, Aussteiger gibt Deckel zurück', () => {
  const { r, ids: [a, b, c] } = setup(Schocken);
  assert.throws(() => r.stop(a), /Erst würfeln/);
  r.roll = seq(2, 3, 4);
  r.throwDice(a);
  assert.throws(() => r.throwDice(a, [0, 1, 2]), /Mindestens einen/);
  r.stop(a); // nach einem Wurf → alle nur einen
  assert.equal(r.maxThrows, 1);
  r.roll = seq(6, 6, 5);
  r.throwDice(b);
  assert.ok(r.done.has(b), 'automatisch fertig');
  assert.equal(r.currentId, c);
  r.held[b] = 3; r.stack = DECKEL - 3;
  r.stand(b);
  assert.equal(r.stack, DECKEL, 'Deckel zurück in die Mitte');
});

// ---------- Mensch ärgere Dich nicht ----------
test('Mensch ärgere Dich nicht: Rauskommen schlägt Gegner auf dem Startfeld, kein Zug ohne Wartezeit', () => {
  const { r, ids: [a, b] } = setup(Maedn, ['Anna', 'Ben']);
  // Ben (Farbe 1) steht auf Feld 0 = Annas Startfeld (Fortschritt 30 von Ben aus)
  r.pieces[b] = [30, -1, -1, -1];
  r.roll = seq(6);
  r.throwDice(a);
  r.move(a, r.options[0]);
  assert.equal(r.pieces[b][0], -1, 'geschlagen');
  assert.equal(r.currentId, a, 'nach 6 nochmal');
  // Figur auf der Strecke, kein möglicher Zug, keine 6 → sofort der Nächste (keine drei Versuche)
  r.pieces[a] = [39, -1, -1, -1];
  r.roll = seq(5);
  r.throwDice(a);
  assert.equal(r.currentId, b);
});

// ---------- Phase 10 ----------
test('Phase 10: Kartenzahl, falsche Phase, Anlegen zu früh, Aussetzen auf sich selbst, leerer Stapel', () => {
  const { r, ids: [a, b] } = setup(Phase10, ['Anna', 'Ben']);
  assert.equal(count(r.deck, r.discard, ...Object.values(r.hands)), 108);
  let k = 5000;
  const C = (c, n) => ({ id: k++, c, n });
  r.hands[a] = [C('r', 1), C('g', 2), C('b', 3), C('y', 4), C('r', 5), C('g', 6), C('s', 0)];
  r.deck = []; r.discard = [C('y', 9), C('r', 8), C('b', 7)];
  r.drawCard(a, 'deck');
  assert.deepEqual(r.discard.map((x) => x.n), [7], 'Ablage neu gemischt, oberste bleibt');
  assert.throws(() => r.layPhase(a, r.hands[a].slice(0, 6).map((x) => x.id)), /passt nicht zu Phase 1/);
  assert.throws(() => r.hit(a, r.hands[a][0].id, b, 0), /erst, wenn deine Phase liegt/);
  const skip = r.hands[a].find((x) => x.c === 's').id;
  assert.throws(() => r.throwAway(a, skip, a), /Wer soll aussetzen/);
});

// ---------- Skip-Bo ----------
test('Skip-Bo: Kartenzahl, Hand zu Zugbeginn aufgefüllt, Joker vom Stapel, Ablage nur 0–3', () => {
  const { r, ids: [a, b] } = setup(SkipBo, ['Anna', 'Ben'], { stockSize: 10 });
  const all = () => count(r.deck, r.used, ...r.build, ...Object.values(r.stock), ...Object.values(r.hand), ...Object.values(r.piles).flat());
  assert.equal(all(), 162);
  r.stock[a][r.stock[a].length - 1] = JOKER; // oberste Stapelkarte ist ein Joker (Anzahl bleibt gleich)
  r.play(a, { kind: 'stock' }, 0);
  assert.deepEqual(r.build[0], [JOKER], 'Joker als 1');
  assert.throws(() => r.throwAway(a, 0, 4), /Ablage gibt es nicht/);
  r.throwAway(a, 0, 1);
  assert.equal(r.currentId, b);
  assert.equal(r.hand[b].length, 5, 'Ben hat zu Beginn 5 Karten');
  assert.equal(all(), 162, 'keine Karte verloren oder doppelt');
  // Stapel leer → fertige Reihen werden neu gemischt
  r.used.push(...r.deck.splice(0), ...r.hand[b].splice(0));
  r.fill(b);
  assert.equal(r.hand[b].length, 5);
  assert.equal(all(), 162);
});
