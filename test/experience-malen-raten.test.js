// EXP-040: Darstellungshilfen leiten alles aus bestätigten Zuständen ab.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { everyone, secondsLeft } from '../public/games/malen-raten/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const players = [{ id: 'a', inRound: true }, { id: 'b', inRound: true }, { id: 'c', inRound: true }, { id: 'z', inRound: false }];
test('EXP-040: „alle erraten“ zählt nur die Ratenden und nur bei der Auflösung', () => {
  assert.equal(everyone({ players, g: { stage: 'reveal', artist: 'a', guessed: ['b', 'c'] } }), true);
  assert.equal(everyone({ players, g: { stage: 'reveal', artist: 'a', guessed: ['b'] } }), false);
  assert.equal(everyone({ players, g: { stage: 'write', artist: 'a', guessed: ['b', 'c'] } }), false);
  assert.equal(everyone({ players: [], g: { stage: 'reveal', artist: 'a', guessed: [] } }), false);
});
test('EXP-040: Eieruhr rechnet nur in der laufenden Zeichenrunde', () => {
  assert.equal(secondsLeft({ phase: 'playing', deadline: 20000, g: { stage: 'write' } }, 10500), 10);
  assert.equal(secondsLeft({ phase: 'playing', deadline: 20000, g: { stage: 'reveal' } }, 10500), null);
  assert.equal(secondsLeft({ phase: 'playing', deadline: null, g: { stage: 'write' } }, 1), null);
});
test('EXP-040: Palette kennt Pinsel, Treffer-Glocke, Eieruhr und Highlight', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['brush', 'hit', 'frame', 'ring', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['ring']);
});
