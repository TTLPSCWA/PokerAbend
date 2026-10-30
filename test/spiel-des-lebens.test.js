import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { spinWheel } from '../games/spiel-des-lebens/room.js';
import { lifeBoard, HOUSES } from '../public/games/spiel-des-lebens/data.js';
import { seeded } from './sim-helpers.js';
function setup(variant = 'classic', count = 2) {
  const r = GAMES['spiel-des-lebens'].create('LIFE', { variant }, () => {});
  const ids = Array.from({ length: count }, (_, i) => { const p = r.addPlayer(`P${i}`, null); r.sit(p.id); return p.id; }); r.start(ids[0]); return { r, ids };
}
test('Drehrad: alle zehn gleich großen Intervalle und statistische Verteilung', () => {
  for (let i = 0; i < 10; i++) assert.equal(spinWheel((limit) => { assert.equal(limit, 10); return i; }), i + 1);
  const counts = Array(10).fill(0), rng = seeded(823); for (let i = 0; i < 100000; i++) counts[spinWheel((limit) => Math.floor(rng() * limit)) - 1]++;
  assert.ok(counts.every((n) => n > 9500 && n < 10500));
});
test('Startwahl: Studium finanziert 100.000 durch zwei Kredite, Beruf überspringt Studienweg', () => {
  const { r, ids: [a, b] } = setup(); r.choose(a, 'college'); assert.equal(r.people[a].loans, 2); assert.equal(r.people[a].money, 200000); assert.equal(r.people[a].position, '0');
  r.choose(b, 'work'); assert.equal(r.people[b].position, '8'); assert.equal(r.choice.kind, 'job'); const offers = r.gameView(b).choice.offers; assert.equal(offers.length, 3); assert.equal(r.gameView(a).choice.offers, undefined); r.choose(b, offers[0]); assert.equal(r.currentId, a); r.dispose();
});
test('Zahltag zahlt beim Überqueren, Abschluss STOPP hält auch einen Zehnerwurf an', () => {
  const { r, ids: [a] } = setup(); const p = r.people[a]; p.started = true; p.job = 'train'; p.position = '4'; r.choice = null; r.step = 'spin';
  const before = p.money; r.move(a, 3); assert.equal(p.money, before + r.salary(a));
  r.turn = 0; p.position = '0'; r.choice = null; r.move(a, 10); assert.equal(p.position, '8'); assert.equal(r.choice.kind, 'job'); assert.equal(r.lastMove.path.length, 9); r.dispose();
});
test('Alle STOPP-Felder halten an, beide Gabelungen haben tatsächliche getrennte Wege', () => {
  for (const short of [false, true]) {
    const board = lifeBoard(short), map = new Map(board.fields.map((f) => [f.id, f]));
    for (const f of board.fields) { if (f.next) assert.ok(map.has(f.next)); if (f.branches) { assert.equal(Object.values(f.branches).length, 2); assert.notEqual(...Object.values(f.branches)); for (const id of Object.values(f.branches)) assert.ok(map.has(id)); } }
  }
  const { r, ids: [a] } = setup(); r.people[a].started = true;
  for (const [kind, at] of Object.entries(r.board.marks).filter(([k]) => k !== 'retirement')) { r.turn = 0; r.choice = null; r.people[a].position = String(at - 1); r.move(a, 10); assert.equal(r.people[a].position, String(at), kind); }
  r.dispose();
});
test('Bank: jederzeit leihen, korrekt tilgen und Pflichtzahlungen finanzieren nur den Fehlbetrag', () => {
  const { r, ids: [a, b] } = setup(); const p = r.people[b]; r.borrow(b, 2); assert.equal(p.money, 300000); assert.equal(p.loans, 2); r.repay(b); assert.equal(p.money, 240000); assert.equal(p.loans, 1);
  assert.throws(() => r.borrow(a, -1)); assert.throws(() => r.repay(b, 2)); p.money = 10000; r.pay(b, 120000); assert.equal(p.money, 40000); assert.equal(p.loans, 4); r.dispose();
});
test('Familie: Hochzeit nach Drehrad, Kinder und Zwillinge mit Geschenken', () => {
  const { r, ids: [a, b] } = setup(); r.people[a].started = true; r.people[a].position = '18'; r.land(a); r.spinValue = () => 3; r.choose(a, 'spin'); assert.equal(r.people[a].partner, true); assert.equal(r.people[b].money, 170000);
  r.addKids(a, 2); assert.equal(r.people[a].kids, 2); assert.equal(r.people[b].money, 150000); assert.equal(r.people[a].life.length, 3); r.dispose();
});
test('Lebenskarten bleiben für alle verdeckt; Endwertung verkauft Häuser und tilgt Kredite', () => {
  const { r, ids: [a, b] } = setup(); Object.assign(r.people[a], { money: 200000, loans: 2, kids: 2, houses: ['cottage'], life: [50000, 250000] }); r.people[b].life = [150000];
  for (const viewer of [a, b, null]) { const g = r.gameView(viewer); assert.equal(g.people[a].lifeCards, 2); assert.equal(g.people[a].life, undefined); assert.equal(g.breakdown, null); assert.ok(!('lifeDeck' in g)); }
  r.spinValue = () => 2; r.finish(); const row = r.breakdown[a]; assert.equal(row.sales[0].value, HOUSES[0].sale[1]); assert.equal(row.debt, 120000); assert.equal(row.total, 700000); assert.equal(r.people[a].loans, 0); assert.deepEqual(r.gameView(null).breakdown[a].life, [50000, 250000]); r.dispose();
});
test('Ruhestand: 4/3/2/1/1/1 Bonuskarten, alle Ankünfte führen zur Abrechnung', () => {
  const { r, ids } = setup('short', 6); r.spinValue = () => 1;
  ids.forEach((id, i) => { r.turn = r.order.indexOf(id); r.choice = null; r.people[id].started = true; const before = r.people[id].life.length; r.retire(id); assert.equal(r.people[id].life.length - before, Math.max(1, 4 - i)); });
  assert.equal(r.phase, 'over'); assert.equal(Object.keys(r.breakdown).length, 6); r.dispose();
});
for (const variant of ['classic', 'short']) test(`Spiel des Lebens ${variant}: 240 vollständige Botpartien ohne Informationsleck`, () => {
  const rng = seeded(2802);
  for (let n = 0; n < 240; n++) {
    const { r } = setup(variant, 2 + n % 5); r.spinValue = () => 1 + Math.floor(rng() * 10); let steps = 0;
    while (r.phase === 'playing' && steps++ < 1500) {
      BOTS['spiel-des-lebens'](r, r.currentId, rng);
      for (const p of Object.values(r.people)) { assert.ok(Number.isSafeInteger(p.money) && p.money >= 0 || r.phase === 'over'); assert.ok(Number.isSafeInteger(p.loans) && p.loans >= 0); }
      if (r.phase === 'playing') for (const p of Object.values(r.gameView(null).people)) assert.equal(p.life, undefined);
    }
    assert.equal(r.phase, 'over', `Partie ${n} hängt nach ${steps}`); assert.ok(r.result.winners.length); r.dispose();
  }
});
