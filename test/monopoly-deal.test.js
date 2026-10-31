import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, CARDS, COLORS, DECK, complete, rent, botMove } from '../games/monopoly-deal/room.js';
function table(n = 2) {
  const r = new Room('DEAL', {}, () => {});
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer('S' + i, null); r.sit(p.id); return p.id; });
  r.start(ids[0]); return { r, ids };
}
const find = (test) => DECK.filter((id) => test(CARDS[id]));
const action = (type) => find((c) => c.action === type)[0];
const property = (color) => find((c) => c.kind === 'property' && c.colors.length === 1 && c.colors[0] === color);
function invariant(r) {
  const all = [...r.deck, ...r.discard, ...Object.values(r.hands).flat(), ...Object.values(r.bank).flat(), ...Object.values(r.sets).flatMap((groups) => groups.flatMap((g) => [...g.cards, ...[g.house, g.hotel].filter(Boolean)]))];
  assert.equal(all.length, 106); assert.equal(new Set(all).size, 106);
  for (const groups of Object.values(r.sets)) for (const g of groups) {
    assert.ok(g.cards.length <= COLORS[g.color].size); assert.ok(g.cards.every((id) => CARDS[id].colors.includes(g.color)));
    assert.ok(!g.hotel || g.house); assert.ok(!g.house || complete(g));
  }
}
test('Monopoly Deal: 106 eindeutige Spielkarten in der geforderten Verteilung und korrekte Mieten', () => {
  assert.equal(DECK.length, 106); assert.equal(new Set(DECK).size, 106);
  for (const [kind, n] of [['money', 20], ['action', 34], ['rent', 13], ['property', 39]]) assert.equal(find((c) => c.kind === kind).length, n);
  assert.equal(find((c) => c.kind === 'property' && c.colors.length === 1).length, 28);
  const { r, ids: [a, b] } = table(); assert.equal(r.hands[a].length, 7); assert.equal(r.hands[b].length, 5); invariant(r);
  for (const [color, c] of Object.entries(COLORS)) { const g = { color, cards: property(color) }; assert.equal(rent(g), c.rent.at(-1)); }
  assert.equal(rent({ color: 'brown', cards: property('brown'), house: 'x', hotel: 'y' }), 9); r.dispose();
});
test('Monopoly Deal: fremde Hände fehlen im gesamten Mitspieler- und Zuschauer-JSON', () => {
  const { r, ids: [a, b] } = table();
  for (const id of r.hands[a]) { assert.ok(!JSON.stringify(r.view(b)).includes(id)); assert.ok(!JSON.stringify(r.view('watcher')).includes(id)); }
  assert.equal(r.view('watcher').g.hand, null); r.dispose();
});
test('Monopoly Deal: Zahlung ohne Wechselgeld, keine Handkarten, kein Überspringen vorhandener Werte', () => {
  const { r, ids: [a, b] } = table();
  const ten = find((c) => c.kind === 'money' && c.value === 10)[0]; r.bank[b] = [ten];
  // The shuffled hand may itself contain ten; choose a card that is not banked.
  const handOnly = r.hands[b].find((id) => id !== ten);
  r.pending = { actor: a, target: b, targets: [b], index: 0, responder: b, kind: 'payment', stage: 'pay', amount: 5 };
  assert.throws(() => r.pay(b, [handOnly]), /Bank/); assert.throws(() => r.pay(b, []), /Betrag/);
  r.pay(b, [ten]); assert.deepEqual(r.bank[a], [ten]); assert.deepEqual(r.bank[b], []);
  const prop = property('blue')[0]; r.put(b, prop, 'blue');
  r.pending = { actor: a, target: b, targets: [b], index: 0, responder: b, kind: 'payment', stage: 'pay', amount: 8 };
  r.pay(b, [prop]); assert.ok(r.sets[a].some((g) => g.cards.includes(prop))); r.dispose();
});
test('Monopoly Deal: Just-Say-No-Kette ist abwechselnd, kostet keine Spielaktion und schützt nur den Betroffenen', () => {
  const { r, ids: [a, b, c] } = table(3), nos = find((c) => c.action === 'no');
  r.hands[a] = [action('birthday'), nos[1]]; r.hands[b] = [nos[0], nos[2]]; r.play(a, action('birthday'));
  assert.throws(() => r.respond(c, true), /dran/);
  r.respond(b, true); assert.equal(r.pending.blocked, true); r.respond(a, true); assert.equal(r.pending.blocked, false);
  r.respond(b, true); r.respond(a, false); assert.equal(r.pending.target, c); assert.equal(r.actions, 1);
  r.respond(c, false); assert.equal(r.pending, null); r.dispose();
});
test('Monopoly Deal: Joker kostenlos umordnen, volle Sätze schützen und Sieg mit drei verschiedenen Farben', () => {
  const { r, ids: [a, b] } = table();
  const wild = find((c) => c.kind === 'property' && c.colors.includes('brown') && c.colors.length === 2)[0];
  r.hands[a] = [wild]; r.property(a, wild, 'brown'); const used = r.actions;
  r.recolor(a, wild, 'lightblue'); assert.equal(r.actions, used); assert.equal(r.sets[a][0].color, 'lightblue');
  r.sets[b] = []; for (const c of property('brown')) r.put(b, c, 'brown');
  r.hands[a] = [action('sly')]; assert.throws(() => r.play(a, action('sly'), { target: b, take: property('brown')[0] }), /geschützt/);
  r.sets[a] = []; for (const color of ['brown', 'blue', 'utility']) for (const c of property(color)) r.put(a, c, color);
  assert.equal(r.checkWin(a), true); assert.equal(r.phase, 'over'); r.dispose();
});
test('Monopoly Deal: Handlimit sieben, leere Hand zieht fünf und Ablage wird nachgemischt', () => {
  const { r, ids: [a, b] } = table();
  r.draw(a, 3); r.endTurn(a); assert.equal(r.step, 'discard'); assert.equal(r.actor, a);
  assert.throws(() => r.endTurn(a, [r.hands[a][0]]), /genau/);
  r.endTurn(a, r.hands[a].slice(0, 3)); assert.equal(r.hands[a].length, 7); assert.equal(r.actor, b);
  r.hands[a] = []; r.endTurn(b); assert.equal(r.hands[a].length, 5);
  r.deck = []; r.discard = [action('go')]; const before = r.hands[a].length; r.draw(a, 2); assert.equal(r.hands[a].length, before + 1); r.dispose();
});
test('Monopoly Deal: Mietverdopplungen zählen mit, Haus/Hotel und Deal Breaker übernehmen den ganzen Satz', () => {
  const { r, ids: [a, b] } = table();
  for (const c of property('brown')) r.put(a, c, 'brown'); const group = r.sets[a][0];
  const rentCard = find((c) => c.kind === 'rent' && c.colors.includes('brown'))[0], doubles = find((c) => c.action === 'double');
  r.hands[a] = [rentCard, ...doubles]; r.play(a, rentCard, { group: group.id, boosts: doubles }); assert.equal(r.actions, 3); assert.equal(r.pending.amount, 8);
  r.respond(b, false); assert.equal(r.step, 'finish');
  r.turn = 1; r.actions = 0; r.step = 'play'; r.hands[b] = [action('breaker')]; group.house = action('house'); group.hotel = action('hotel');
  r.play(b, action('breaker'), { target: a, group: group.id }); r.respond(a, false);
  assert.ok(r.sets[b].includes(group)); assert.equal(r.sets[a].length, 0); assert.ok(group.house && group.hotel); r.dispose();
});
test('Monopoly Deal: 120 Bot-Partien enden ohne verlorene Karten oder ungültige Sätze', () => {
  for (let i = 0; i < 120; i++) {
    const { r } = table(2 + i % 4); let steps = 0;
    while (r.phase === 'playing' && steps++ < 20000) { botMove(r, r.currentId); if (steps % 20 === 0) invariant(r); }
    assert.equal(r.phase, 'over', `Partie ${i}, ${steps} Schritte`); invariant(r); r.dispose();
  }
});
