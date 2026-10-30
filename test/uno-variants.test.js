import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { flipDeck, mercyDeck, allWildDeck } from '../games/farbenchaos/variants.js';
import { seeded } from './sim-helpers.js';
function setup(variant, count = 3, settings = {}) {
  const r = GAMES.farbenchaos.create('UNO', { variant, ...settings }, () => {});
  const ids = Array.from({ length: count }, (_, i) => { const p = r.addPlayer(`P${i}`, null); r.sit(p.id); return p.id; }); r.start(ids[0]);
  r.turn = 0; r.dir = 1; r.side = 0; r.wish = null; r.colorChoice = null; r.challenge = null; return { r, ids };
}
let serial = 1000;
const card = (a, b = '1p') => ({ id: serial++, faces: [a, b] });
function setHand(r, id, ...codes) { r.hands[id] = codes.map((c) => card(c)); }
function play(r, id, index = 0, wish = 'r', target = null) { r.play(id, r.token(r.hands[id][index]), wish, true, target); }

test('UNO-Variantendecks: 112 doppelseitige Flip-, 168 No-Mercy- und 112 All-Wild-Karten', () => {
  const f = flipDeck(); assert.equal(f.length, 112); assert.ok(f.every((c) => c.faces.length === 2));
  for (let side = 0; side < 2; side++) { const faces = f.map((c) => c.faces[side]); assert.equal(faces.filter((c) => /\d/.test(c[0])).length, 72); assert.equal(faces.filter((c) => c[0] === 'L').length, 8); }
  assert.equal(mercyDeck().length, 168); assert.equal(new Set(mercyDeck().map((c) => c.id)).size, 168); assert.equal(allWildDeck().length, 112); assert.ok(allWildDeck().every((c) => c.faces[0][1] === 'w'));
  const counts = Object.fromEntries(['W', 'R', 'S', 'K', 'D', 'F', 'T', 'X'].map((v) => [v, allWildDeck().filter((c) => c.faces[0][0] === v).length]));
  assert.deepEqual(counts, { W: 54, R: 14, S: 14, K: 6, D: 10, F: 6, T: 4, X: 4 });
});

test('Flip dreht alle physischen Stapel; fremde aktive Seiten verlassen den Server nicht', () => {
  const { r, ids: [a, b] } = setup('flip');
  r.hands[a] = [card('Lr', '2t'), card('1g', '8v')]; r.hands[b] = [card('9b', '4o')];
  r.discard = [card('2r', '3t'), card('5r', '6v')]; const previousDeck = r.deck.slice(); const oldBottom = r.discard[0]; const last = r.hands[a][0];
  const before = r.gameView(a); assert.deepEqual(before.inactiveHands[b], ['4o']); assert.ok(!JSON.stringify(before).includes(r.token(r.hands[b][0])));
  play(r, a); assert.equal(r.side, 1); assert.equal(r.deck[0], previousDeck.at(-1)); assert.equal(r.deck.at(-1), previousDeck[0]); assert.equal(r.discard.at(-1), oldBottom); assert.equal(r.discard[0], last);
  const after = r.gameView(a); assert.deepEqual(after.inactiveHands[b], ['9b']); assert.ok(!JSON.stringify(after).includes(r.token(r.hands[b][0])));
  assert.equal(r.gameView(null).hand, null); r.dispose();
});

test('Flip Originalpunkte und 500er-Partiewertung bleiben nach Neustart erhalten', () => {
  const { r, ids: [a, b, c] } = setup('flip');
  for (const [code, value] of [['9r', 9], ['Ir', 10], ['Lr', 20], ['Ep', 30], ['Ww', 40], ['Bw', 50], ['Cw', 60]]) assert.equal(r.cardPoints(code), value);
  setHand(r, b, 'Cw'); setHand(r, c, 'Ww'); r.matchScores[a] = 410; r.win(a);
  assert.equal(r.matchScores[a], 510); assert.equal(r.matchOver, true);
  const restored = GAMES.farbenchaos.restore(r.snapshot(), () => {}); assert.equal(restored.matchScores[a], 510); restored.dispose(); r.dispose();
});

test('Flip Anfechtung zeigt nur dem Betroffenen die Hand und kehrt eine illegale Strafe um', () => {
  const { r, ids: [a, b, c] } = setup('flip'); r.discard = [card('3r')]; setHand(r, a, 'Bw', '1r');
  play(r, a, 0, 'g'); assert.equal(r.currentId, b); assert.equal(r.gameView(c).challengeHand, null);
  const count = r.hands[a].length; r.challengeDraw(b, true); assert.equal(r.hands[a].length, count + 2); assert.equal(r.currentId, b); assert.ok(r.gameView(b).challengeHand); assert.equal(r.gameView(c).challengeHand, null); r.dispose();
});

test('No Mercy: Stapeln richtet sich nach der letzten Karte, nicht nach der Gesamtsumme', () => {
  const { r, ids: [a, b, c] } = setup('no-mercy'); r.discard = [card('3r')]; setHand(r, a, 'Fr', '1r'); setHand(r, b, 'Uw', '2g'); setHand(r, c, 'Fr', 'Uw', '1b');
  play(r, a); assert.equal(r.pending, 4); play(r, b); assert.equal(r.pending, 10);
  assert.equal(r.canPlay(r.hands[c][0]), false); assert.equal(r.canPlay(r.hands[c][1]), true); play(r, c, 1); assert.equal(r.pending, 16); r.dispose();
});

test('No Mercy: 7 tauscht verpflichtend, 0 gibt Hände in der aktuellen Richtung weiter', () => {
  const { r, ids: [a, b, c] } = setup('no-mercy'); r.discard = [card('3r')]; setHand(r, a, '7r', '1g'); setHand(r, b, '2r', '3b', '4g');
  assert.throws(() => play(r, a)); play(r, a, 0, 'r', b); assert.equal(r.hands[a].length, 3); assert.equal(r.hands[b].length, 1);
  setHand(r, b, '0r', '6g'); const oldA = r.hands[a], oldC = r.hands[c]; play(r, b); assert.equal(r.hands[b], oldA); assert.equal(r.hands[a], oldC); assert.equal(r.hands[c][0].faces[0], '6g'); r.dispose();
});

test('No Mercy: 25 Karten scheiden sofort aus; Richtung +4 trifft zu zweit den Ausspieler', () => {
  const { r, ids: [a, b] } = setup('no-mercy', 2); r.discard = [card('3r')]; setHand(r, a, 'Vw', '1g');
  play(r, a); assert.equal(r.currentId, a); assert.equal(r.pending, 4); assert.equal(r.lastDraw, 4);
  r.hands[a] = Array.from({ length: 24 }, () => card('1r')); r.draw(a); assert.equal(r.eliminated[a], true); assert.deepEqual(r.result.winners, [b]); assert.equal(r.hands[a].length, 0); r.dispose();
});

test('No Mercy Roulette lässt den Betroffenen wählen und zählt auch die passende Karte', () => {
  const { r, ids: [a, b] } = setup('no-mercy'); r.discard = [card('3r')]; setHand(r, a, 'Qw', '1g');
  r.deck = [card('7b'), card('Ww'), card('2r')]; const n = r.hands[b].length;
  play(r, a); assert.equal(r.colorChoice.id, b); r.chooseColor(b, 'b'); assert.equal(r.hands[b].length, n + 3); assert.deepEqual(r.revealed, ['2r', 'Ww', '7b']); r.dispose();
});

test('All Wild: jede Karte passt; gezieltes +2 überspringt den Betroffenen nicht', () => {
  const { r, ids: [a, b] } = setup('all-wild'); assert.ok(r.buildDeck().every((c) => r.canPlay(c))); setHand(r, a, 'Tw', 'Ww'); const n = r.hands[b].length;
  play(r, a, 0, null, b); assert.equal(r.hands[b].length, n + 2); assert.equal(r.currentId, b); r.dispose();
});

test('All Wild: auch die letzte Tauschkarte muss erst ihre Wirkung auflösen', () => {
  const { r, ids: [a, b] } = setup('all-wild'); setHand(r, a, 'Xw'); play(r, a, 0, null, b);
  assert.deepEqual(r.result.winners, [b]); assert.ok(r.hands[a].length > 0); r.dispose();
});

test('Grund-UNO: Hausregel 7–0 nutzt die Hände nach dem Tausch für die Siegerprüfung', () => {
  const { r, ids: [a, b] } = setup('classic', 2, { sevenZero: true }); r.discard = ['3r']; r.hands[a] = ['7r']; r.hands[b] = ['1g', '2b'];
  r.play(a, '7r', null, true, b); assert.deepEqual(r.result.winners, [b]); r.dispose();
});

for (const variant of ['flip', 'no-mercy', 'all-wild']) test(`UNO ${variant}: 120 Botpartien, Kartenerhaltung und vollständiges Ende`, () => {
  const rng = seeded(1203);
  for (let n = 0; n < 120; n++) {
    const { r } = setup(variant, n % 2 ? 2 : variant === 'no-mercy' ? 6 : 10);
    let k = 0;
    while (r.phase === 'playing' && ++k < 10000) {
      BOTS.farbenchaos(r, r.currentId, rng);
      const all = [...r.deck, ...r.discard, ...r.aside, ...Object.values(r.hands).flat()];
      assert.equal(all.length, variant === 'no-mercy' ? 168 : 112); assert.equal(new Set(all.map((c) => c.id)).size, all.length);
    }
    assert.equal(r.phase, 'over', `${variant}: Partie ${n} hängt bei ${k}`); r.dispose();
  }
});
