// Gewinnchancen gegen bekannte Werte – und die schnelle Handbewertung gegen die genaue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equity, score7, bestHand, compareScores, outlook, newDeck, shuffle } from '../games/poker/engine/cards.js';

// Fester Zufall, damit die Tests immer gleich ausgehen
function seeded(seed = 42) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}
const pct = (x) => x * 100;

test('Schnelle Bewertung ordnet Hände genau wie bestHand', () => {
  let rand = seeded(7);
  const rng = (n) => Math.floor(rand() * n);
  for (let i = 0; i < 5000; i++) {
    const d = shuffle(newDeck(), rng);
    const a = d.slice(0, 7), b = d.slice(7, 14);
    assert.equal(Math.sign(score7(a) - score7(b)), Math.sign(compareScores(bestHand(a).score, bestHand(b).score)), `${a} gegen ${b}`);
  }
  // Sonderfälle: Rad-Straße, Straight Flush gegen Flush, Full House aus zwei Drillingen, Kicker beim Paar
  const s = (str) => score7(str.split(' '));
  assert.ok(s('As 2d 3c 4h 5s Kd Qd') > s('Ks Kd 3c 4h 9s Jd 2h'), 'Rad schlägt Paar');
  assert.ok(s('6s 7s 8s 9s Ts 2d 3d') > s('As Ks Qs Js 9s 2d 3d'), 'Straight Flush schlägt Flush');
  assert.ok(s('Ks Kd Kc Qs Qd Qc 2h') > s('Ks Kd Kc Js Jd 2c 3h'), 'Full House mit höherem Paar aus zweitem Drilling');
  assert.ok(s('As Ad Kc 9h 7s 3d 2c') > s('As Ad Qc 9h 7s 3d 2c'), 'Kicker zählt');
  assert.equal(s('As Ad Kc 9h 7s 3d 2c'), s('Ah Ac Kd 9s 7c 3h 2d'), 'gleiche Hand = Split');
});

test('Pre-Flop: AA gegen KK ≈ 81–82 %, KK gegen AK ≈ 70 %', () => {
  const aa = equity([['As', 'Ah'], ['Kd', 'Kc']], [], { samples: 40000, rng: seeded(1) });
  assert.ok(pct(aa[0]) > 80 && pct(aa[0]) < 82.5, 'AA vs KK: ' + pct(aa[0]).toFixed(1));
  assert.ok(Math.abs(aa[0] + aa[1] - 1) < 1e-9, 'Summe 100 %');
  const kk = equity([['Ks', 'Kh'], ['Ad', 'Kc']], [], { samples: 40000, rng: seeded(2) });
  assert.ok(pct(kk[0]) > 68.5 && pct(kk[0]) < 71.5, 'KK vs AK: ' + pct(kk[0]).toFixed(1));
});

test('Flop und Turn werden exakt durchgerechnet', () => {
  // Turn: Flush-Draw (9 Outs) gegen ein Paar Asse ohne weitere Chancen: genau 9/44 plus Split-Fälle gibt es nicht
  const t = equity([['Kh', 'Qh'], ['As', 'Ac']], ['7h', '2h', '9c', '3d']);
  assert.ok(Math.abs(t[0] - 9 / 44) < 1e-9, 'Flush-Draw am Turn: ' + pct(t[0]).toFixed(2));
  // Gleiche Hände am River: immer Split
  const r = equity([['As', 'Kd'], ['Ac', 'Kh']], ['2s', '7d', '9c', 'Jh', '3s']);
  assert.deepEqual(r, [0.5, 0.5]);
});

test('Eigene Handchancen (outlook): bekannte Werte', () => {
  // Turn, vier Herz, keine Paare: Flush oder besser mit genau 9 von 46 Karten
  const turn = outlook(['Ah', 'Kh'], ['7h', '2h', '9c', 'Qd']);
  const flushOrBetter = turn.slice(5).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(flushOrBetter - 9 / 46) < 1e-9, 'Turn: ' + pct(flushOrBetter).toFixed(2));
  // Flop: 9 Outs auf zwei Karten ≈ 35 %
  const flop = outlook(['Ah', 'Kh'], ['7h', '2h', '9c']);
  const f = pct(flop.slice(5).reduce((a, b) => a + b, 0));
  assert.ok(f > 34.9 && f < 36.5, 'Flop: ' + f.toFixed(2));
  // Anteile ergeben immer 100 %
  assert.ok(Math.abs(flop.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});
