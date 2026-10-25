// Massentest (B2): pro Spiel viele zufällige Partien mit simulierten Spielern.
// Geprüft wird nach jedem Zug: kein Absturz, keine Karte verdoppelt oder verloren, niemand dauerhaft blockiert,
// und jede Runde endet nach einer begrenzten Zahl von Zügen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { DECKEL } from '../games/schocken/room.js';
import { TRACK, GOAL } from '../games/huetchen/room.js';
import { SHOE_SIZE } from '../games/blackjack/room.js';
import { FIELDS, totals } from '../games/kniffel/room.js';
import { botColumn } from '../games/viergewinnt/room.js';

// Fester Zufall für die Züge (Würfel ebenfalls) – Mischen bleibt echter Zufall
function seeded(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}
const sum = (lists) => lists.reduce((a, l) => a + l.length, 0);

// Was bei jedem Spiel immer stimmen muss
const INVARIANTS = {
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
  schwimmen: (r) => {
    const cards = [...r.deck, ...r.middle, ...Object.values(r.hands).flat()];
    assert.equal(cards.length, 32, 'Karten');
    assert.equal(new Set(cards).size, 32, 'Karte doppelt');
    assert.equal(r.middle.length, 3, 'Mitte');
    for (const id of r.order) { assert.equal(r.hands[id].length, 3, 'Hand'); assert.ok(r.lives[id] >= 0, 'Leben'); assert.ok(r.lives[id] > 0 || r.swimming.has(id), 'ohne Leben, aber nicht geschwommen'); }
  },
};

// Partien je Spiel, Spielerzahl, Zug-Obergrenze pro Runde. SIM_SCALE=10 npm test spielt zehnmal so viele (gut 1,5 Minuten).
const SCALE = Math.max(1, Number(process.env.SIM_SCALE) || 1);
const PLAN = {
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
  blackjack: { games: 300, rounds: 20, players: [1, 7], settings: {}, maxSteps: 400 }, // 20 Hände je Tisch – Chips und Schlitten laufen weiter
};

for (const [id, plan] of Object.entries(PLAN)) {
  const games = plan.games * SCALE;
  test(`Massentest ${GAMES[id].name}: ${games} zufällige Partien`, () => {
    const rng = seeded(1234 + id.length);
    let steps = 0, rounds = 0, longest = 0;
    for (let n = 0; n < games; n++) {
      const [lo, hi] = plan.players;
      const count = lo + Math.floor(rng() * (hi - lo + 1));
      // Auch Zahlenoptionen variieren. Unmögliche Kartenzahlen prüft review-regressions.test.js separat.
      const options = Object.fromEntries((GAMES[id].options || []).map((o) => {
        if (o.type === 'bool') return [o.key, rng() < 0.5];
        let max = o.max;
        if (id === 'maumau' && o.key === 'handSize') max = Math.min(max, Math.floor(((count > 5 ? 64 : 32) - 1) / count));
        if (id === 'stapelrennen' && o.key === 'stockSize') max = Math.min(max, Math.floor(162 / count) - 5);
        return [o.key, o.min + Math.floor(rng() * (max - o.min + 1))];
      }));
      // Blackjack: Mindesteinsatz höchstens ein Fünftel der Startchips und nicht über dem Höchsteinsatz (sonst spielt niemand)
      if (id === 'blackjack') {
        options.minBet = Math.max(1, Math.min(options.minBet, Math.floor(options.startStack / 5)));
        options.maxBet = Math.max(options.maxBet, options.minBet);
      }
      const room = GAMES[id].create('SIM' + n, { ...plan.settings, ...options }, () => {});
      if ('roll' in room) room.roll = () => Math.floor(rng() * 6) + 1;
      const ids = Array.from({ length: count }, (_, k) => { const p = room.addPlayer('Bot' + k, null); room.sit(p.id); return p.id; });
      for (let rd = 0; rd < (plan.rounds || 1); rd++) {
      if (rd) { assert.equal(room.phase, 'over'); room.start(ids[0]); }
      else room.start(ids[0]);
      let k = 0, same = 0, last = null;
      while (room.phase === 'playing') {
        const cur = room.currentId;
        assert.ok(cur, `${id}: niemand am Zug`);
        try { (plan.bot || BOTS[id])(room, cur, rng); }
        catch (e) { assert.fail(`${id}, Partie ${n}, Zug ${k} (Optionen ${JSON.stringify(options)}): ${e.message}`); }
        INVARIANTS[id](room);
        // Niemand bleibt ewig dran (bei Skip-Bo legt man viele Karten in einem Zug)
        same = room.currentId === last ? same + 1 : 0; last = room.currentId;
        assert.ok(same < 600, `${id}: ${room.name(cur)} kommt nicht weiter`);
        if (++k > plan.maxSteps) assert.fail(`${id}, Partie ${n}: Runde endet nicht (${k} Züge, Optionen ${JSON.stringify(options)})`);
      }
      assert.equal(room.phase, 'over');
      assert.ok(room.result?.text, 'Ergebnis fehlt');
      steps += k; rounds++; longest = Math.max(longest, k);
      }
      room.dispose();
    }
    console.log(`  ${GAMES[id].name}: ${rounds} Runden, Ø ${Math.round(steps / rounds)} Züge, längste ${longest}`);
  });
}
