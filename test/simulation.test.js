// Massentest (B2): pro Spiel viele zufällige Partien mit simulierten Spielern.
// Geprüft wird nach jedem Zug: kein Absturz, keine Karte verdoppelt oder verloren, niemand dauerhaft blockiert,
// und jede Runde endet nach einer begrenzten Zahl von Zügen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { seeded, INVARIANTS, PLAN, SCALE } from './sim-helpers.js';

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
