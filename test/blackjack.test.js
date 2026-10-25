// Blackjack: Werte, Einsätze, verdeckte Dealerkarte, Auszahlung (3:2, 1:1, Push), Dealer-Regeln, Verdoppeln, Teilen,
// Versicherung, Aussetzen, Nachkaufen – und die Chip-Summe (Spieler + Bank + Tisch) stimmt immer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room, total, isBlackjack, SHOE_SIZE } from '../games/blackjack/room.js';

const FILL = Array.from({ length: 150 }, (_, i) => `${'23456789'[i % 8]}c`);
// Nächste Karten aus dem Schlitten in dieser Reihenfolge (gezogen wird von hinten)
const stack = (r, cards) => { r.shoe = [...FILL, ...[...cards].reverse()]; };
function setup(n = 1, settings = {}) {
  const r = new Room('BJ', settings, () => {});
  const ids = ['Anna', 'Ben', 'Cem'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const chipsOk = (r) => assert.equal(sum(r.stacks) + r.bank + r.onTable(), sum(r.bought), 'Chip-Summe');

test('Werte: Asse 11 oder 1, Bilder 10, Blackjack nur mit zwei Karten', () => {
  assert.deepEqual(total(['Ah', '6c']), { total: 17, soft: true });
  assert.deepEqual(total(['Ah', '6c', 'Kd']), { total: 17, soft: false });
  assert.equal(total(['Ah', 'Ad', '9c']).total, 21);
  assert.equal(total(['Kh', 'Qd', '5c']).total, 25);
  assert.ok(isBlackjack(['As', 'Jd']));
  assert.ok(!isBlackjack(['7s', '7d', '7c']));
});

test('Einsatz: Grenzen und Chips; verdeckte Dealerkarte bleibt geheim (auch für Zuschauer), danach aufgedeckt', () => {
  const { r, ids: [a] } = setup(1, { minBet: 10, maxBet: 500, startStack: 1000 });
  const z = r.addPlayer('Zoe', null).id;
  assert.throws(() => r.bet(a, 5), /Mindesteinsatz/);
  assert.throws(() => r.bet(a, 600), /Höchsteinsatz/);
  stack(r, ['9h', '5d', '7h', 'Kd']); // Anna 9, 7 · Dealer 5, verdeckt K♦
  r.bet(a, 100);
  assert.equal(r.stacks[a], 900);
  assert.equal(r.step, 'play');
  for (const viewer of [a, z]) {
    const v = r.view(viewer);
    assert.deepEqual(v.g.dealer.cards, ['5d', null]);
    assert.ok(!JSON.stringify(v).includes('"Kd"'), 'verdeckte Karte verraten');
  }
  stack(r, ['2c', 'Th']); // Anna bleibt bei 16 · Dealer zieht T → 25
  r.stay(a);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.view(z).g.dealer.cards, ['5d', 'Kd', '2c'].slice(0, r.dealer.length));
  chipsOk(r);
});

test('Auszahlung: Gewinn 1:1, Verlust, Push, über 21 – die Bank zählt mit', () => {
  const { r, ids: [a, b, c] } = setup(3);
  // Anna 10+9=19, Ben 10+8=18, Cem 10+6=16 · Dealer 10 + 8 = 18 (steht)
  stack(r, ['Th', 'Td', 'Tc', 'Ts', '9h', '8d', '6c', '8s']);
  r.bet(a, 100); r.bet(b, 100); r.bet(c, 100);
  r.stay(a); r.stay(b);
  stack(r, ['Kh']); r.hit(c); // Cem 26 – über 21
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.points, { [a]: 100, [b]: 0, [c]: -100 });
  assert.deepEqual(r.result.winners, [a]);
  assert.equal(r.bank, 0, '+100 von Cem, −100 an Anna');
  assert.match(r.result.detail[b], /Push/);
  assert.match(r.result.detail[c], /über 21/);
  chipsOk(r);
});

test('Blackjack zahlt 3:2 (abgerundet, Rest bei der Bank); Dealer schaut bei Zehn nach und rechnet sofort ab', () => {
  const { r, ids: [a, b] } = setup(2);
  stack(r, ['Ah', '9c', '7d', 'Kh', '9d', 'Tc']); // Anna A+K = Blackjack, Ben 9+9 · Dealer 7, T
  r.bet(a, 25); r.bet(b, 40);
  assert.equal(r.currentId, b, 'Anna mit Blackjack ist fertig');
  r.stay(b); // Dealer 17 steht; Ben 18 gewinnt
  assert.equal(r.result.points[a], 37, '25 × 1,5 = 37,5 → 37');
  assert.equal(r.result.points[b], 40);
  chipsOk(r);
  // Dealer-Blackjack mit Zehn offen: keine Spielzüge, Blackjack gegen Blackjack ist Push
  const g = setup(2);
  stack(g.r, ['As', '9c', 'Kd', 'Qh', '9d', 'Ac']);
  g.r.bet(g.ids[0], 50); g.r.bet(g.ids[1], 50);
  assert.equal(g.r.phase, 'over', 'sofort abgerechnet');
  assert.equal(g.r.result.points[g.ids[0]], 0, 'Push');
  assert.equal(g.r.result.points[g.ids[1]], -50, 'nicht verdoppelt, nur der Einsatz weg');
  assert.ok(g.r.view(g.ids[1]).g.dealer.blackjack);
  chipsOk(g.r);
});

test('Dealer steht auf Soft 17 – mit Hausregel zieht er', () => {
  const s = setup(1);
  stack(s.r, ['Th', 'Ah', '8h', '6d']); // Anna 18 · Dealer A+6 = Soft 17
  s.r.bet(s.ids[0], 10); s.r.stay(s.ids[0]);
  assert.equal(total(s.r.dealer).total, 17);
  assert.equal(s.r.dealer.length, 2);
  const h = setup(1, { hitSoft17: true });
  stack(h.r, ['Th', 'Ah', '8h', '6d', '3c']);
  h.r.bet(h.ids[0], 10); h.r.stay(h.ids[0]);
  assert.equal(h.r.dealer.length, 3, 'zieht auf Soft 17');
  assert.equal(total(h.r.dealer).total, 20);
});

test('Verdoppeln: nur mit zwei Karten, genau eine Karte, doppelter Einsatz; nicht ohne Chips', () => {
  const { r, ids: [a] } = setup(1, { startStack: 300 });
  stack(r, ['5h', '9c', '6d', 'Td', 'Th']); // Anna 5+6=11 · Dealer 9, T · Anna bekommt T → 21
  r.bet(a, 100);
  r.double(a);
  assert.equal(r.hands[a][0].cards.length, 3);
  assert.equal(r.hands[a][0].bet, 200);
  assert.equal(r.phase, 'over');
  assert.equal(r.result.points[a], 200);
  const p = setup(1, { startStack: 300 });
  stack(p.r, ['5h', '9c', '6d', 'Td']);
  p.r.bet(p.ids[0], 200);
  assert.throws(() => p.r.double(p.ids[0]), /nicht genug Chips/);
  stack(p.r, ['2h']); p.r.hit(p.ids[0]);
  assert.throws(() => p.r.double(p.ids[0]), /ersten zwei Karten/);
});

test('Teilen: gleicher Wert (auch K + D), einmal; Asse je eine Karte; Blackjack nach Teilen = 21; Verdoppeln danach abschaltbar', () => {
  const { r, ids: [a] } = setup(1);
  stack(r, ['Kh', '7c', 'Qd', 'Tc', '5s', 'Kc']); // Anna K, D · Dealer 7, T · nach Teilen: K+5, D+K
  r.bet(a, 50);
  assert.ok(r.canSplit(a));
  r.split(a);
  assert.equal(r.hands[a].length, 2);
  assert.equal(r.stacks[a], 900);
  assert.throws(() => r.split(a), /nur einmal|gleichen Werts/);
  stack(r, ['4h']); r.hit(a);   // K+5+4 = 19 → nicht fertig
  r.stay(a);                    // Hand 2: D+K = 20
  r.stay(a);
  assert.equal(r.phase, 'over');
  assert.equal(r.result.points[a], 100, 'beide Hände schlagen 17');
  chipsOk(r);
  // Asse: je nur eine Karte, A+K danach ist 21, kein Blackjack (1:1)
  const s = setup(1);
  stack(s.r, ['Ah', '9c', 'Ad', '8d', 'Kh', '5c']);
  s.r.bet(s.ids[0], 20);
  s.r.split(s.ids[0]);
  assert.ok(s.r.hands[s.ids[0]].every((h) => h.done && h.cards.length === 2), 'Asse: je eine Karte, dann fertig');
  assert.equal(s.r.phase, 'over');
  assert.match(s.r.result.detail[s.ids[0]], /gewonnen \(21\) \+20/, 'nach Teilen kein Blackjack');
  // Ohne „Verdoppeln nach Teilen“
  const d = setup(1, { doubleAfterSplit: false });
  stack(d.r, ['8h', '9c', '8d', 'Td', '3s', '2c']);
  d.r.bet(d.ids[0], 20); d.r.split(d.ids[0]);
  assert.throws(() => d.r.double(d.ids[0]), /nicht verdoppelt/);
});

test('Versicherung (Hausregel): zahlt 2:1 bei Dealer-Blackjack, sonst verloren', () => {
  const { r, ids: [a, b] } = setup(2, { insurance: true });
  stack(r, ['Th', '9c', 'Ah', '9h', '8d', 'Kd']); // Dealer A + K = Blackjack
  r.bet(a, 100); r.bet(b, 100);
  assert.equal(r.step, 'insure');
  r.insure(a, true); r.insure(b, false);
  assert.equal(r.phase, 'over');
  assert.equal(r.result.points[a], 0, '−100 Einsatz, +100 Versicherung');
  assert.equal(r.result.points[b], -100);
  chipsOk(r);
  const n = setup(1, { insurance: true });
  stack(n.r, ['Th', 'Ah', '9h', '7d']); // Dealer A + 7: kein Blackjack
  n.r.bet(n.ids[0], 100); n.r.insure(n.ids[0], true);
  assert.equal(n.r.step, 'play');
  n.r.stay(n.ids[0]); // 19 gegen Soft 18
  assert.equal(n.r.result.points[n.ids[0]], 50, '+100 Hand, −50 Versicherung');
  chipsOk(n.r);
});

test('Aussetzen, Host gibt sofort, niemand setzt → keine Hand', () => {
  const { r, ids: [a, b] } = setup(2);
  r.sitOut(b);
  assert.throws(() => r.dealNow(b), /Nur der Host/);
  stack(r, ['Th', '9c', '9h', '8d']);
  r.bet(a, 10);
  assert.equal(r.step, 'play');
  assert.deepEqual(r.order, [a], 'Ben ist diese Hand nicht dabei');
  const g = setup(2);
  g.r.bet(g.ids[1], 20);
  stack(g.r, ['Th', '9c', '9h', '8d']);
  g.r.dealNow(g.ids[0]);
  assert.deepEqual(g.r.order, [g.ids[1]]);
  const none = setup(2);
  none.r.sitOut(none.ids[0]); none.r.sitOut(none.ids[1]);
  assert.equal(none.r.phase, 'over');
  assert.match(none.r.result.text, /Niemand hat gesetzt/);
});

test('Nachkaufen: nur ohne Mindesteinsatz, mit Grenze, abschaltbar', () => {
  const { r, ids: [a] } = setup(1, { startStack: 100, minBet: 10, rebuys: 1 });
  assert.throws(() => r.rebuy(a), /zu wenig Chips/);
  stack(r, ['Th', 'Tc', '6h', '9d', 'Kc']); // Anna 16 → zieht K → über 21
  r.bet(a, 100); r.hit(a);
  assert.equal(r.stacks[a], 0);
  r.start(a);
  r.rebuy(a);
  assert.equal(r.stacks[a], 100);
  assert.equal(r.bought[a], 200);
  r.stacks[a] = 0; // nochmal pleite
  assert.throws(() => r.rebuy(a), /Höchstens 1×/);
  const off = setup(1, { rebuys: 0 });
  off.r.stacks[off.ids[0]] = 0;
  assert.throws(() => off.r.rebuy(off.ids[0]), /aus/);
});

test('Aussteigen: vor dem Geben Einsatz zurück, danach an die Bank; allein weiterspielen, Chips stimmen', () => {
  const { r, ids: [a, b] } = setup(2);
  r.bet(b, 50);
  r.stand(b); // vor dem Geben
  assert.equal(r.stacks[b], 1000);
  chipsOk(r);
  stack(r, ['Th', '9c', '9h', '8d']);
  r.bet(a, 30);
  assert.equal(r.step, 'play', 'Anna spielt allein weiter');
  r.stand(a); // mitten in der Hand: Einsatz verfällt
  assert.equal(r.phase, 'over');
  assert.equal(r.bank, 30);
  chipsOk(r);
});

test('Schlitten: 6 Decks, neu gemischt unter 25 %; Ergebnis für die Bestenliste', () => {
  const events = [];
  const r = new Room('BJ', {}, (k, d) => events.push([k, d]));
  const a = r.addPlayer('Anna', null).id; r.sit(a);
  r.start(a);
  assert.equal(r.shoe.length, SHOE_SIZE);
  r.sitOut(a);
  r.shoe = r.shoe.slice(0, 50); r.used = [];
  r.start(a);
  assert.equal(r.shoe.length, SHOE_SIZE, 'neu gemischt');
  stack(r, ['Th', '9c', '9h', '8d']);
  r.bet(a, 10); r.stay(a);
  const res = events.filter(([k]) => k === 'result').at(-1)[1].entries;
  assert.deepEqual(res, [{ name: 'Anna', win: true, points: 10 }]);
});
