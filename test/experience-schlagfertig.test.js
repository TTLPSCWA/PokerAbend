// EXP-019: Ausgang eines Duells aus der aufgedeckten Wertung.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { verdict, laughter } from '../public/games/schlagfertig/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-019: Sieger, Gleichstand und Volltreffer eines Duells', () => {
  assert.deepEqual(verdict({ answers: [{ votes: 2, fullHit: true }, { votes: 0 }] }), { top: 2, tie: false, winner: 0, ovation: true });
  assert.deepEqual(verdict({ answers: [{ votes: 1 }, { votes: 1 }] }), { top: 1, tie: true, winner: -1, ovation: false });
  assert.deepEqual(verdict({ answers: [{ votes: 0 }, { votes: 3 }] }), { top: 3, tie: false, winner: 1, ovation: false });
  assert.deepEqual(verdict({ answers: [{ votes: 0 }, { votes: 0 }] }), { top: 0, tie: false, winner: -1, ovation: false });
  assert.deepEqual(verdict(null), { top: 0, tie: false, winner: -1, ovation: false });
});
test('EXP-019: Lachstärke nach Stimmenzahl', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(laughter), [null, 'laugh1', 'laugh2', 'laugh2', 'laugh3', 'laugh3']);
});
test('EXP-019: Palette kennt Lachen in drei Stärken, Rimshot und Applaus', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['index', 'mic', 'laugh1', 'laugh2', 'laugh3', 'rimshot', 'applause', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.ok(palette.events.laugh3.length > palette.events.laugh1.length);
});
