// C5 Zuschauen: Zuschauer sehen keine verdeckten Karten oder Würfel und können zur nächsten Runde einsteigen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';

// Alles Geheime eines Spielers als Text (Karten, Würfel), damit man es im JSON der Zuschauer-Ansicht suchen kann
const SECRETS = {
  maumau: (r, id) => r.hands[id],
  farbenchaos: (r, id) => r.hands[id],
  zehnetappen: (r, id) => r.hands[id].map((c) => `"id":${c.id},`),
  stapelrennen: (r, id) => (r.hand[id].length ? [`"hand":[${r.hand[id].join(',')}]`] : []),
  maexchen: (r, id) => (r.cup && r.currentId === id ? [`"cup":[${r.cup.join(',')}]`] : []),
};

for (const g of Object.values(GAMES)) {
  if (g.id === 'poker') continue; // Poker: test/server.test.js und room.test.js
  test(`Zuschauen bei ${g.name}: nichts Verdecktes, Einstieg zur nächsten Runde`, () => {
    const r = g.create('ZUSCH', {}, () => {});
    const [a, b] = ['Anna', 'Ben'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
    const z = r.addPlayer('Zoe', null).id; // schaut nur zu
    r.start(a);
    if (g.id === 'maexchen') r.throwDice(r.currentId); // ein verdeckter Wurf liegt unter dem Becher
    const v = r.view(z);
    assert.equal(v.you.playing, false);
    assert.equal(v.you.inRound, false);
    if (v.g && 'hand' in v.g) assert.equal(v.g.hand, null, 'keine eigene Hand');
    const json = JSON.stringify(v);
    for (const id of [a, b]) {
      for (const secret of SECRETS[g.id]?.(r, id) || []) {
        // Bei Mau-Mau/UNO kann dieselbe Karte als offene Ablage liegen – die ist nicht geheim
        if (typeof secret === 'string' && secret.length === 2 && v.g.top === secret) continue;
        if (typeof secret === 'string' && secret.length === 2) assert.ok(!json.includes(`"${secret}"`), `${g.id}: ${secret} sichtbar`);
        else assert.ok(!json.includes(secret), `${g.id}: ${secret} sichtbar`);
      }
    }
    if (g.id === 'maexchen') assert.equal(v.g.cup, null);
    // Mitten in der Runde einsteigen: erst ab der nächsten Runde
    r.sit(z);
    assert.ok(r.seats.includes(z));
    assert.ok(!r.order.includes(z));
    assert.ok(r.log.some((l) => l.text === 'Zoe spielt ab der nächsten Runde mit'));
    r.phase = 'over'; // Runde vorbei (für den Test abgekürzt)
    r.start(a);
    assert.ok(r.order.includes(z), 'in der nächsten Runde dabei');
    r.dispose();
  });
}
