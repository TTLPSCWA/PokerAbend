// EXP-038: „Zugestellt“ wird aus der aufgedeckten Kette abgeleitet.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { delivered } from '../public/games/kritzelpost/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-038: Kette ist zugestellt, wenn die letzte Beschreibung dem Anfangsbegriff entspricht', () => {
  assert.equal(delivered({ pages: [{ text: 'Rote Katze' }, { image: [{}] }, { text: 'rote  katze!' }] }), true);
  assert.equal(delivered({ pages: [{ text: 'Katze' }, { image: [{}] }, { text: 'Hund' }] }), false);
  assert.equal(delivered({ pages: [{ text: 'Katze' }, { image: [{}] }, { text: 'Katze' }, { image: [{}] }] }), true);
  assert.equal(delivered({ pages: [{ text: 'Katze' }] }), false);
  assert.equal(delivered({ pages: [{ text: '' }, { image: [] }, { text: '' }] }), false);
  assert.equal(delivered(null), false);
});
test('EXP-038: Palette kennt Stempel, Umschlag, Sirene und Highlight', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['stamp', 'envelope', 'page', 'siren', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['siren']);
});
