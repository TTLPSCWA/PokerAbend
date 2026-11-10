// EXP-072: Takt, Tempi und Wertung aus Server-Frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { beatOf, tempo, beats, judged } from '../public/games/rhythmus-rausch/experience.js';
import { loadPalette } from '../public/sound/engine.js';
import { makeChart } from '../games/arcade-logic.js';

test('EXP-072: Grundschlag des Lieds aus echten Notenfolgen', () => {
  for (const seed of [1, 7, 42, 999]) { assert.equal(beatOf(makeChart(seed, 45, 4, false).slice(0, 14)), 560, `ruhig ${seed}`); assert.equal(beatOf(makeChart(seed, 45, 4, true).slice(0, 14)), 420, `schnell ${seed}`); }
  assert.equal(beatOf([]), 560);
});
test('EXP-072: drei Tempi', () => { assert.deepEqual([tempo(560, 0), tempo(420, 5), tempo(560, 20), tempo(420, 50)], ['ruhig', 'schnell', 'rausch', 'rausch']); });
test('EXP-072: Achtelschläge zwischen zwei Frames', () => {
  assert.deepEqual(beats(0, 600, 560), [1, 2]); assert.deepEqual(beats(560, 900, 560), [3]); assert.deepEqual(beats(100, 120, 560), []);
  assert.ok(beats(0, 1e6, 420).length <= 8); // nach einer Pause kein Rückstau
});
test('EXP-072: neue eigene Wertung', () => {
  assert.deepEqual(judged({ last: { grade: 'perfect', lane: 1, at: 900 } }, { last: { grade: 'good', lane: 0, at: 500 } }), { grade: 'perfect', lane: 1, at: 900 });
  assert.equal(judged({ last: { at: 500 } }, { last: { at: 500 } }), null); assert.equal(judged({ last: null }, null), null);
});
test('EXP-072: Palette kennt Beat, Melodietöne, Fehltipp und Jubel', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['kick', 'snare', 'hat', 'lane0', 'lane1', 'lane2', 'lane3', 'perfect', 'stray', 'cheer', 'select', 'highlight', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.equal(Object.keys(palette.samples || {}).filter((k) => ['kick', 'snare', 'hat', 'lane0'].includes(k)).length, 0); // Beat bleibt erzeugt, damit er im Takt liegt
});
