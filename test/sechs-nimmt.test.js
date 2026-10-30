import test from 'node:test';
import assert from 'node:assert/strict';
import { Room, horns, rowPoints, deck, botMove } from '../games/sechs-nimmt/room.js';

function table(n = 3, settings = {}) {
  const room = new Room('SIX', settings, () => {});
  const ids = Array.from({ length: n }, (_, i) => { const p = room.addPlayer('S' + i, null); room.sit(p.id); return p.id; });
  room.start(ids[0]); return { room, ids };
}
test('6 nimmt!: 104 eindeutige Karten und alle Hornochsen-Sonderwerte', () => {
  assert.equal(new Set(deck()).size, 104);
  for (const [n, p] of [[55, 7], [11, 5], [22, 5], [110, 5], [10, 3], [100, 3], [5, 2], [15, 2], [1, 1], [104, 1]]) assert.equal(horns(n), p);
  for (let n = 2; n <= 10; n++) {
    const { room: r } = table(n);
    const cards = [...Object.values(r.hands).flat(), ...r.rows.flat()];
    assert.equal(cards.length, n * 10 + 4); assert.equal(new Set(cards).size, cards.length);
    assert.ok(Object.values(r.hands).every((h) => h.length === 10)); r.dispose();
  }
});
test('6 nimmt!: gleichzeitige Wahl bleibt bis zur letzten Bindung im gesamten Mitspieler-JSON verborgen', () => {
  const { room: r, ids: [a, b, c] } = table();
  // Karten sind Zahlen. Die Zeichenfolge kann dagegen in Namen, IDs und Zeiten vorkommen.
  const numbers = (value) => typeof value === 'number' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : [];
  r.players.get(b).name = 'Spieler 92';
  r.hands = { [a]: [91, 92], [b]: [81, 82], [c]: [71, 72] }; r.rows = [[1], [2], [3], [4]];
  r.choose(a, 91);
  const view = JSON.parse(JSON.stringify(r.view(b)));
  assert.ok(!numbers(view).some((n) => n === 91 || n === 92)); assert.equal(view.players.find((p) => p.id === a).ready, true);
  assert.equal(r.hands[a].length, 2); assert.throws(() => r.choose(a, 92), /schon/);
  assert.throws(() => r.choose(b, 91), /nicht/);
  r.choose(b, 81); assert.equal(r.gameView(c).queue.length, 0);
  r.choose(c, 71); assert.deepEqual(r.gameView(b).queue.map((p) => p.card), [71, 81, 91]);
  assert.ok(!numbers(JSON.parse(JSON.stringify(r.view(b)))).includes(92)); r.dispose();
});
test('6 nimmt!: nächstkleineres Ende, sechste Karte und kleinste Karte mit verbindlicher Reihenwahl', () => {
  const { room: r, ids: [a, b] } = table(2);
  r.rows = [[5, 10, 15, 20, 25], [30], [60], [80]];
  r.queue = [{ id: a, card: 27 }, { id: b, card: 1 }]; r.stage = 'reveal'; r.index = 0;
  r.resolve(); assert.deepEqual(r.rows[0], [27]); assert.equal(r.totals[a], 12);
  r.resolve(); assert.equal(r.stage, 'row'); assert.equal(r.currentId, b);
  assert.throws(() => r.takeRow(a, 0), /dran/); assert.throws(() => r.takeRow(b, -1), /erlaubt/);
  r.takeRow(b, 1); assert.deepEqual(r.rows[1], [1]); assert.equal(r.totals[b], 3); r.dispose();
});
test('6 nimmt!: Profi-Kartensatz und erlaubte freie Reihen, Taktik-Pool ohne Handzuordnung', () => {
  const { room: r, ids: [a] } = table(2, { pro: true, tactics: true });
  assert.deepEqual(r.pool, deck(24)); assert.equal(r.gameView(a).pool.length, 24);
  r.rows = [[1], [5], [10], [20]]; assert.deepEqual(r.allowed(12), [2, 1, 0]);
  r.queue = [{ id: a, card: 12 }]; r.index = 0; r.stage = 'row';
  assert.throws(() => r.takeRow(a, 3), /erlaubt/); r.takeRow(a, 0); assert.deepEqual(r.rows[0], [1, 12]); r.dispose();
});
test('6 nimmt!: Timer wählt fehlende Karten, Reconnect und Snapshot haben keine fremden Hände', () => {
  const { room: r, ids: [a, b] } = table(2);
  r.choose(a, r.hands[a][0]); r.onTimeout(); assert.equal(r.stage, 'reveal'); assert.equal(r.queue.length, 2);
  assert.equal(r.view(a).g.hand.length, 9); assert.equal(r.view(b).g.hand.length, 9);
  assert.equal(r.view('zuschauer').g.hand, null);
  r.abortRound(a); const restored = Room.restore(r.snapshot(), () => {});
  assert.equal(restored.phase, 'lobby'); assert.equal(restored.seats.length, 2); assert.deepEqual(restored.scores, r.scores);
  r.dispose(); restored.dispose();
});
test('6 nimmt!: 180 Bot-Partien mit allen Spielerzahlen enden, Karten und Hornochsen bleiben konsistent', () => {
  for (let k = 0; k < 180; k++) {
    const { room: r } = table(2 + k % 9, { pro: k % 2 === 0 });
    let steps = 0;
    while (r.phase === 'playing' && steps++ < 20000) {
      if (r.stage === 'pick') for (const id of r.order) { if (r.chosen[id] === undefined) botMove(r, id); }
      else if (r.stage === 'row') botMove(r, r.currentId);
      else r.onTimeout();
      for (const row of r.rows) assert.ok(row.length >= 1 && row.length <= 5);
      for (const id of r.order) assert.ok(r.totals[id] >= rowPoints(r.taken[id]));
    }
    assert.equal(r.phase, 'over', `Partie ${k}, ${steps} Schritte`);
    assert.ok(Math.max(...Object.values(r.totals)) >= r.settings.target);
    assert.ok(r.result.winners.every((id) => r.totals[id] === Math.min(...r.order.map((p) => r.totals[p])))); r.dispose();
  }
});
