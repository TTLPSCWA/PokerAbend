import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { PROPERTIES } from '../games/monopoly/room.js';
import { JUNIOR_BOARD } from '../public/games/monopoly/data.js';
import { seeded } from './sim-helpers.js';
function setup(variant, count = 2) {
  const r = GAMES.monopoly.create('MO', { variant, turnTime: 5 }, () => {});
  const ids = Array.from({ length: count }, (_, i) => { const p = r.addPlayer(`P${i}`, null); r.sit(p.id); return p.id; }); r.start(ids[0]); return { r, ids };
}
function dice(r, ...values) { let i = 0; r.roll = () => values[i++ % values.length]; }

test('Tempowürfel: individueller Start nach Los, Gefängnis nur mit weißen Würfeln', () => {
  const { r, ids: [a, b] } = setup('speed'); assert.equal(r.people[a].money, 2500); assert.equal(r.people[a].speedActive, false);
  r.people[a].position = 38; dice(r, 1, 1); r.throwDice(a); assert.equal(r.speedDie, null); assert.equal(r.people[a].speedActive, true); assert.equal(r.people[b].speedActive, false);
  r.jail(a); r.step = 'jail'; let rolls = 0; r.roll = () => { rolls++; return 2; }; r.throwDice(a); assert.equal(rolls, 2); assert.equal(r.speedDie, null); r.dispose();
});
for (const n of [1, 2, 3]) test(`Tempowürfel Zahl ${n} wird mit beiden weißen Würfeln addiert`, () => {
  const { r, ids: [a] } = setup('speed'); r.people[a].speedActive = true; r.people[a].position = 10; dice(r, 1, 4, n); r.throwDice(a); assert.equal(r.people[a].position, 15 + n); assert.equal(r.again, false); r.dispose();
});
for (const n of [4, 5]) test(`Tempowürfel Glücksseite ${n} wartet auf Kauf und zieht dann weiter`, () => {
  const { r, ids: [a] } = setup('speed'); r.people[a].speedActive = true; dice(r, 1, 2, n); r.throwDice(a);
  assert.equal(r.people[a].position, 3); assert.equal(r.step, 'buy'); assert.equal(r.speedBonus, a);
  r.buy(a, true); assert.equal(r.people[a].position, 5); assert.equal(r.step, 'buy'); assert.equal(r.speedBonus, null); r.dispose();
});
test('Tempowürfel Glück ohne freie Grundstücke überspringt eigene und belastete Felder', () => {
  const { r, ids: [a, b] } = setup('speed'); r.people[a].speedActive = true;
  PROPERTIES.forEach((i) => { r.owned[i].owner = a; }); r.owned[6].owner = b; r.owned[6].mortgage = true; r.owned[8].owner = b;
  dice(r, 1, 2, 4); r.throwDice(a); assert.equal(r.people[a].position, 8); assert.ok(r.people[b].money > 2500); r.dispose();
});
test('Tempowürfel Bus erlaubt nur einen weißen Würfel oder die Summe', () => {
  const { r, ids: [a] } = setup('speed'); r.people[a].speedActive = true; r.people[a].position = 8; dice(r, 2, 5, 6); r.throwDice(a);
  assert.equal(r.speedChoice, 'bus'); assert.throws(() => r.speedSelect(a, 4)); r.speedSelect(a, 7); assert.equal(r.people[a].position, 15); r.dispose();
});
test('Tempowürfel Dreierpasch wählt jedes Feld; weiße Pasche allein zählen für Zusatzwurf', () => {
  const { r, ids: [a] } = setup('speed'); r.people[a].speedActive = true; dice(r, 2, 2, 2); r.throwDice(a); assert.equal(r.speedChoice, 'triple'); assert.equal(r.again, false);
  r.speedSelect(a, 20); assert.equal(r.people[a].position, 20); assert.equal(r.step, 'end'); r.dispose();
  const s = setup('speed'); const id = s.ids[0]; s.r.people[id].speedActive = true; dice(s.r, 1, 1, 3); s.r.throwDice(id); assert.equal(s.r.again, true); assert.equal(s.r.speedChoice, null); s.r.dispose();
});
test('Junior: 24 Felder, Startgeld, Pflichtkauf, doppelte Gruppenmiete, erster Bankrott beendet', () => {
  const { r, ids: [a, b] } = setup('junior'); assert.equal(JUNIOR_BOARD.length, 24); assert.equal(r.people[a].money, 31);
  r.walk(a, 1); assert.equal(r.owned[1].owner, a); assert.equal(r.people[a].money, 30); r.walk(a, 1); assert.equal(r.rent(1), 2);
  assert.throws(() => r.manage(a, 1, 'mortgage')); assert.throws(() => r.manage(a, 1, 'build'));
  r.people[b].money = 0; r.people[b].position = 1; r.land(b); assert.equal(r.phase, 'over'); assert.deepEqual(r.result.winners, [a]); r.dispose();
  const four = setup('junior', 4); assert.equal(four.r.people[four.ids[0]].money, 20); four.r.dispose();
});
test('Monopoly: eigene Figuren auswählbar und nach Neustart erhalten', () => {
  const { r, ids: [a, b] } = setup('classic'); r.tokens = {}; r.chooseToken(a, 'cat'); assert.throws(() => r.chooseToken(b, 'cat'));
  const restored = GAMES.monopoly.restore(r.snapshot(), () => {}); assert.equal(restored.tokens[a], 'cat'); restored.dispose(); r.dispose();
});
for (const variant of ['junior', 'speed']) test(`Monopoly ${variant}: 40 Botpartien mit regelkonformen Zügen und Ausstieg bei langen Partien`, () => {
  const rng = seeded(8113);
  for (let n = 0; n < 40; n++) {
    const { r } = setup(variant, 2 + n % 3); r.roll = () => 1 + Math.floor(rng() * 6);
    let k = 0; while (r.phase === 'playing' && k++ < 8000) { const before = [r.moveNo, r.currentId, r.step]; BOTS.monopoly(r, r.currentId, rng); assert.ok(r.moveNo !== before[0] || r.currentId !== before[1] || r.step !== before[2] || r.phase === 'over'); }
    // Monopoly garantiert bei ausgeglichenen Besitzverhältnissen kein natürliches Ende.
    // Ein Ausstieg muss auch nach einer langen Partie weiterhin korrekt abrechnen.
    if (r.phase === 'playing') { if (variant === 'junior') r.dropOut(r.players.get(r.currentId), 'Simulation beendet'); else r.finishWealth(); }
    assert.equal(r.phase, 'over'); r.dispose();
  }
});
