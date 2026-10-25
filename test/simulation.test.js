// Massentest (B2): pro Spiel viele zufällige Partien mit simulierten Spielern.
// Geprüft wird nach jedem Zug: kein Absturz, keine Karte verdoppelt oder verloren, niemand dauerhaft blockiert,
// und jede Runde endet nach einer begrenzten Zahl von Zügen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { DECKEL } from '../games/schocken/room.js';
import { TRACK, GOAL } from '../games/huetchen/room.js';

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
};

// Partien je Spiel, Spielerzahl, Zug-Obergrenze pro Runde
const PLAN = {
  maumau: { games: 1500, players: [2, 8], settings: {}, maxSteps: 3000 },
  farbenchaos: { games: 1500, players: [2, 8], settings: {}, maxSteps: 3000 },
  maexchen: { games: 1500, players: [2, 10], settings: { lives: 3 }, maxSteps: 3000 },
  schocken: { games: 300, players: [2, 6], settings: {}, maxSteps: 40000 },
  huetchen: { games: 300, players: [2, 4], settings: {}, maxSteps: 20000 },
  zehnetappen: { games: 200, players: [2, 6], settings: {}, maxSteps: 20000 },
  stapelrennen: { games: 200, players: [2, 6], settings: { stockSize: 10 }, maxSteps: 30000 },
};

for (const [id, plan] of Object.entries(PLAN)) {
  test(`Massentest ${GAMES[id].name}: ${plan.games} zufällige Partien`, () => {
    const rng = seeded(1234 + id.length);
    let steps = 0, rounds = 0, longest = 0;
    for (let n = 0; n < plan.games; n++) {
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
      const room = GAMES[id].create('SIM' + n, { ...plan.settings, ...options }, () => {});
      if ('roll' in room) room.roll = () => Math.floor(rng() * 6) + 1;
      const ids = Array.from({ length: count }, (_, k) => { const p = room.addPlayer('Bot' + k, null); room.sit(p.id); return p.id; });
      room.start(ids[0]);
      let k = 0, same = 0, last = null;
      while (room.phase === 'playing') {
        const cur = room.currentId;
        assert.ok(cur, `${id}: niemand am Zug`);
        try { BOTS[id](room, cur, rng); }
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
      room.dispose();
    }
    console.log(`  ${GAMES[id].name}: ${rounds} Runden, Ø ${Math.round(steps / rounds)} Züge, längste ${longest}`);
  });
}
