// D1: Lücken der Regeltests – Zugreihenfolge nach Richtungswechsel, wer nach Lebensverlust anfängt,
// Übersicht und Deckelherkunft bei Schocken, Aufbau der Phase für die Ausleg-Felder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room as UNO } from '../games/farbenchaos/room.js';
import { Room as Maexchen } from '../games/maexchen/room.js';
import { Room as Schocken } from '../games/schocken/room.js';
import { Room as Phase10 } from '../games/zehnetappen/room.js';

const setup = (Room, n, settings = {}) => {
  const r = new Room('T', settings, () => {});
  const ids = ['Anna', 'Ben', 'Cem', 'Dora'].slice(0, n).map((x) => { const p = r.addPlayer(x, null); r.sit(p.id); return p.id; });
  r.start(ids[0]);
  return { r, ids };
};
const seq = (...v) => () => { assert.ok(v.length, 'Würfel aufgebraucht'); return v.shift(); };

test('UNO zu viert: Richtungswechsel dreht die Reihenfolge, Aussetzen wirkt gegen die Richtung', () => {
  const { r, ids: [a, b, c, d] } = setup(UNO, 4);
  r.discard = ['5r'];
  r.hands[a] = ['Rr', '1g', '2g']; r.hands[d] = ['Sr', '3g', '4g']; r.hands[b] = ['6r', '7g', '8g'];
  r.play(a, 'Rr');
  assert.equal(r.currentId, d, 'nach dem Wechsel ist der Vorgänger dran');
  r.play(d, 'Sr'); // Aussetzen gegen die Richtung: Cem setzt aus
  assert.equal(r.currentId, b);
  assert.equal(r.view(a).dir, -1, 'Richtung ist in der Ansicht sichtbar (Pfeil)');
});

test('Mäxchen: wer ein Leben verliert, fängt die nächste Runde an', () => {
  const { r, ids: [a, b, c] } = setup(Maexchen, 3);
  r.roll = seq(3, 1);
  r.throwDice(a); r.announce(a, 54); // geblufft (31)
  r.doubt(b);
  assert.equal(r.lives[a], 2);
  assert.equal(r.currentId, a, 'der Verlierer würfelt als Nächster');
  r.roll = seq(6, 5);
  r.throwDice(a); r.announce(a, 65); // ehrlich
  r.doubt(b);
  assert.equal(r.lives[b], 2);
  assert.equal(r.currentId, b);
  assert.ok(c);
});

test('Schocken: Übersicht bester zuerst, Deckel erst aus der Mitte, dann vom Besten', () => {
  const { r, ids: [a, b] } = setup(Schocken, 2);
  r.roll = seq(1, 1, 4, 6, 5, 3);
  r.throwDice(a); r.stop(a);             // Schock 4
  r.throwDice(b);                        // 6-5-3 (Wurfzahl vom Ersten: 1)
  const lp = r.view(a).g.lastPass;
  assert.deepEqual(lp.rank.map((x) => x.id), [a, b], 'bester zuerst');
  assert.deepEqual(lp.rank.map((x) => x.name), ['Schock 4', '6-5-3']);
  assert.equal(lp.fromStack, true);
  assert.equal(r.held[b], 4);
  // Mitte leer: jetzt gibt der Beste ab
  r.stack = 0; r.held[a] = 5;
  const first = r.currentId, second = first === a ? b : a;
  r.roll = seq(1, 1, 2, 6, 6, 5);
  r.throwDice(first); r.stop(first);
  r.throwDice(second);
  const lp2 = r.view(a).g.lastPass;
  assert.equal(lp2.fromStack, false, 'Deckel kamen vom Besten');
  assert.equal(lp2.best, first);
  // laufender Durchgang: Rangfolge nach dem ersten Wurf
  assert.ok(Array.isArray(r.view(a).g.rank));
});

test('Phase 10: Ausleg-Felder folgen der eigenen Phase', () => {
  const { r, ids: [a, b] } = setup(Phase10, 2);
  assert.deepEqual(r.view(a).g.myGroups, [{ type: 'set', size: 3 }, { type: 'set', size: 3 }]);
  r.progress[b] = 4;
  assert.deepEqual(r.view(b).g.myGroups, [{ type: 'run', size: 7 }]);
  r.progress[a] = 8;
  assert.deepEqual(r.view(a).g.myGroups, [{ type: 'color', size: 7 }]);
  assert.equal(r.view(a).g.phaseText, '7 einer Farbe');
});
