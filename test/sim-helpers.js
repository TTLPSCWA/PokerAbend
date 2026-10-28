// Gemeinsam für Massentest und Abbruch-Test: fester Zufall, Invarianten je Spiel, Plan (Partien, Spielerzahl, Zug-Obergrenze).
import assert from 'node:assert/strict';
import { DECKEL } from '../games/schocken/room.js';
import { TRACK, GOAL } from '../games/huetchen/room.js';
import { SHOE_SIZE } from '../games/blackjack/room.js';
import { FIELDS, totals } from '../games/kniffel/room.js';
import { botColumn } from '../games/viergewinnt/room.js';

// Fester Zufall für die Züge (Würfel ebenfalls) – Mischen bleibt echter Zufall
export function seeded(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}
const sum = (lists) => lists.reduce((a, l) => a + l.length, 0);

// Was bei jedem Spiel immer stimmen muss
export const INVARIANTS = {
  maumau: (r) => assert.equal(sum([r.deck, r.discard, ...Object.values(r.hands)]), r.buildDeck(r.order.length).length, 'Karten'),
  farbenchaos: (r) => assert.equal(sum([r.deck, r.discard, ...Object.values(r.hands)]), 108, 'Karten'),
  maexchen: (r) => { for (const id of r.order) assert.ok(r.lives[id] > 0, 'Leben'); },
  schocken: (r) => assert.equal(r.stack + Object.values(r.held).reduce((a, n) => a + n, 0), DECKEL, 'Deckel'),
  huetchen: (r) => {
    const track = new Set();
    for (const id of r.order) {
      const pcs = r.pieces[id];
      const placed = pcs.filter((p) => p >= 0);
      assert.equal(new Set(placed).size, placed.length, 'zwei eigene Figuren auf einem Feld');
      for (const p of pcs) {
        assert.ok(p >= -1 && p <= GOAL + 3, 'Figur außerhalb des Bretts');
        if (p >= 0 && p < TRACK) { const f = r.abs(id, p); assert.ok(!track.has(f), 'zwei Figuren auf einem Feld'); track.add(f); }
      }
    }
  },
  zehnetappen: (r) => {
    const cards = [...r.deck, ...r.discard, ...Object.values(r.hands).flat(), ...Object.values(r.laid).flat().flatMap((g) => g.cards)];
    assert.equal(cards.length, 108, 'Karten');
    assert.equal(new Set(cards.map((c) => c.id)).size, 108, 'Karte doppelt');
  },
  stapelrennen: (r) => assert.equal(sum([r.deck, r.used, ...r.build, ...Object.values(r.stock), ...Object.values(r.hand), ...Object.values(r.piles).flat()]), 162, 'Karten'),
  muehle: (r) => {
    for (const id of r.order) {
      assert.ok(r.hand[id] >= 0 && r.hand[id] <= 9, 'Steine in der Hand');
      assert.ok(r.hand[id] + r.count(id) <= 9, 'mehr als 9 Steine');
      if (r.phase === 'playing') assert.ok(r.hand[id] + r.count(id) >= 3, 'mit 2 Steinen noch im Spiel');
    }
    assert.ok(r.board.every((x) => x === null || r.order.includes(x)), 'fremder Stein');
  },
  zehntausend: (r) => {
    assert.ok(r.remaining >= 1 && r.remaining <= 6, 'Würfelzahl');
    assert.ok(r.turnPoints >= 0, 'Zugpunkte');
    if (r.rolled) assert.equal(r.dice.length, r.remaining, 'Wurf passt nicht zu den übrigen Würfeln');
    for (const id of r.order) { assert.ok(r.banked[id] >= 0 && r.banked[id] % 50 === 0, 'Punktestand'); if (r.banked[id]) assert.ok(r.entered.has(id), 'angeschrieben ohne Einstieg'); }
  },
  shutthebox: (r) => {
    const n = r.flaps();
    for (const id of r.order) {
      const b = r.boxes[id];
      assert.equal(new Set(b).size, b.length, 'Klappe doppelt');
      assert.ok(b.every((f) => f >= 1 && f <= n), 'Klappe außerhalb');
      assert.ok(r.results[id].length <= r.settings.rounds, 'zu viele Runden');
    }
    if (r.pending) assert.ok(r.dice.length >= 1, 'offener Wurf ohne Würfel');
  },
  viergewinnt: (r) => {
    // Schwerkraft: unter jedem Stein liegt ein Stein; Steine wechseln sich ab (Unterschied höchstens 1)
    for (let i = 0; i < 35; i++) if (r.board[i] !== null) assert.ok(r.board[i + 7] !== null, 'Stein schwebt');
    const n = r.order.map((id) => r.board.filter((x) => x === id).length);
    assert.ok(Math.abs(n[0] - (n[1] ?? 0)) <= 1, 'ungleich viele Steine');
    if (r.phase === 'playing') assert.equal(r.win, null);
  },
  kniffel: (r) => {
    for (const x of r.dice) assert.ok(x >= 0 && x <= 6, 'Würfel');
    assert.ok(r.rolls >= 0 && r.rolls <= 3, 'mehr als 3 Würfe');
    const filled = r.order.map((id) => r.filled(id));
    assert.ok(Math.max(...filled) - Math.min(...filled) <= 1, 'ungleich viele Runden');
    for (const id of r.order) {
      for (const f of FIELDS) { const v = r.sheets[id][f]; assert.ok(v === null || (Number.isInteger(v) && v >= 0 && v <= 50), 'Feldwert ' + f + ' ' + v); }
      assert.ok(totals(r.sheets[id], r.extra[id]).total <= 1575, 'zu viele Punkte');
    }
  },
  blackjack: (r) => {
    // Chips: Spieler + Bank + Tisch = alles Ausgegebene (Start + Nachkäufe) – nichts entsteht, nichts geht verloren
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    assert.equal(sum(r.stacks) + r.bank + r.onTable(), sum(r.bought), 'Chips');
    for (const v of Object.values(r.stacks)) assert.ok(v >= 0, 'negativer Chipstand');
    const inPlay = r.settled ? 0 : r.dealer.length + Object.values(r.hands).flat().reduce((a, h) => a + h.cards.length, 0);
    assert.equal(r.shoe.length + r.used.length + inPlay, SHOE_SIZE, 'Karten');
  },
  schiffe: (r) => {
    for (const id of r.order) {
      const foe = r.other(id);
      for (const [cell, kind] of Object.entries(r.shots[id] || {})) {
        const hit = !!r.ships[foe]?.some((sh) => sh.cells.includes(Number(cell)));
        assert.equal(kind, hit ? 'hit' : 'miss', 'Treffer/Wasser falsch');
      }
      assert.ok(Object.keys(r.shots[id] || {}).length <= 100, 'mehr Schüsse als Felder');
      if (r.ships[id]) assert.equal(r.ships[id].length, r.fleet().length, 'Flotte');
    }
  },
  mogeln: (r) => assert.equal(sum([r.pile, ...Object.values(r.hands)]), 52, 'Karten'),
  praesident: (r) => {
    const all = Object.values(r.hands).flat();
    assert.equal(new Set(all).size, all.length, 'Karte doppelt');
    assert.ok(all.length <= 52);
  },
  durak: (r) => {
    const cards = [...r.deck, ...r.discard, ...Object.values(r.hands).flat(), ...r.board.flatMap((p) => [p.a, ...(p.d ? [p.d] : [])])];
    assert.equal(cards.length, 36, 'Karten');
    assert.equal(new Set(cards).size, 36, 'Karte doppelt');
  },
  schwimmen: (r) => {
    const cards = [...r.deck, ...r.middle, ...Object.values(r.hands).flat()];
    assert.equal(cards.length, 32, 'Karten');
    assert.equal(new Set(cards).size, 32, 'Karte doppelt');
    assert.equal(r.middle.length, 3, 'Mitte');
    for (const id of r.order) { assert.equal(r.hands[id].length, 3, 'Hand'); assert.ok(r.lives[id] >= 0, 'Leben'); assert.ok(r.lives[id] > 0 || r.swimming.has(id), 'ohne Leben, aber nicht geschwommen'); }
  },
};

// Partien je Spiel, Spielerzahl, Zug-Obergrenze pro Runde. SIM_SCALE=10 npm test spielt zehnmal so viele (gut 1,5 Minuten).
export const SCALE = Math.max(1, Number(process.env.SIM_SCALE) || 1);
export const PLAN = {
  maumau: { games: 1500, players: [2, 8], settings: {}, maxSteps: 3000 },
  farbenchaos: { games: 1500, players: [2, 8], settings: {}, maxSteps: 6000 }, // mit „ziehen bis es passt“ und Stapeln werden Partien sehr lang
  maexchen: { games: 1500, players: [2, 10], settings: { lives: 3 }, maxSteps: 3000 },
  schocken: { games: 300, players: [2, 6], settings: {}, maxSteps: 40000 },
  huetchen: { games: 300, players: [2, 4], settings: {}, maxSteps: 20000 },
  zehnetappen: { games: 200, players: [2, 6], settings: {}, maxSteps: 20000 },
  stapelrennen: { games: 200, players: [2, 6], settings: { stockSize: 10 }, maxSteps: 30000 },
  schwimmen: { games: 1000, players: [2, 9], settings: {}, maxSteps: 20000 },
  schiffe: { games: 1000, players: [2, 2], settings: {}, maxSteps: 400 },
  muehle: { games: 1500, players: [2, 2], settings: {}, maxSteps: 2000 },
  zehntausend: { games: 300, players: [2, 8], settings: {}, maxSteps: 20000 },
  shutthebox: { games: 800, players: [1, 8], settings: {}, maxSteps: 3000 },
  // Flacher Bot (1 Zug voraus) statt der vollen Suche: hier zählen die Regeln, nicht die Spielstärke
  viergewinnt: { games: 2000, players: [2, 2], settings: {}, maxSteps: 50, bot: (r, id, rng) => r.drop(id, botColumn(r.board, id, r.order.find((p) => p !== id), rng, 1)) },
  kniffel: { games: 600, players: [1, 6], settings: {}, maxSteps: 400 },
  mogeln: { games: 800, players: [3, 8], settings: {}, maxSteps: 4000 },
  praesident: { games: 800, players: [3, 8], settings: {}, maxSteps: 4000 },
  durak: { games: 800, players: [2, 6], settings: {}, maxSteps: 4000 },
  blackjack: { games: 300, rounds: 20, players: [1, 7], settings: {}, maxSteps: 400 }, // 20 Hände je Tisch – Chips und Schlitten laufen weiter
};
