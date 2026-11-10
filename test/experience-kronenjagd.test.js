// EXP-042: Kronenwechsel und Herrschaftsdauer aus Server-Frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { transfer, reign } from '../public/games/kronenjagd/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const F = (holder, elapsed = 0) => ({ elapsed, crown: { x: 450, y: 300, holder } });
test('EXP-042: Kronenwechsel aus Sicht des Gewinners, des Verlierers und der anderen', () => {
  assert.deepEqual(transfer(F('a'), F(null), 'a'), { to: 'a', from: null, kind: 'crown' });
  assert.deepEqual(transfer(F('b'), F('a'), 'a'), { to: 'b', from: 'a', kind: 'lost' });
  assert.deepEqual(transfer(F('b'), F('a'), 'c'), { to: 'b', from: 'a', kind: 'steal' });
  assert.equal(transfer(F('a'), F('a'), 'a'), null); assert.equal(transfer(F(null), F('a'), 'a'), null);
});
test('EXP-042: Herrschaftsdauer zählt ab der Übernahme', () => {
  assert.equal(reign(F('a', 31000), { id: 'a', at: 1000 }), 30000); assert.equal(reign(F(null, 31000), { id: 'a', at: 1000 }), 0); assert.equal(reign(F('a', 500), null), 0);
});
test('EXP-042: Paket zeichnet die Krone selbst und kennt Fanfare und Trompeten-Abfall', async () => {
  assert.equal(experience.paints.crown, true);
  const palette = await loadPalette(experience.palette);
  for (const event of ['crown', 'lost', 'steal', 'count', 'highlight', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['crown', 'lost']);
});
