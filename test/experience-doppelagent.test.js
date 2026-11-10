// EXP-081: Darstellung hängt nur an öffentlichen Ereignissen.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { events } from '../public/games/doppelagent/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const base = { key: 'k', stage: 'ask', transcript: [], vote: null, summary: null };
test('EXP-081: neue Akte, Protokoll, Anklage, Stimme und Enthüllung werden erkannt', () => {
  assert.deepEqual(events({ ...base, key: 'alt' }, base), ['case']);
  assert.deepEqual(events(null, base), ['case']);
  assert.deepEqual(events(base, { ...base, stage: 'answer', transcript: [{}] }), ['typed']);
  assert.deepEqual(events(base, { ...base, stage: 'vote', vote: { id: 1, count: 0 } }), ['accused']);
  assert.deepEqual(events({ ...base, stage: 'vote', vote: { id: 1, count: 0 } }, { ...base, stage: 'vote', vote: { id: 1, count: 1 } }), ['voted']);
  assert.deepEqual(events({ ...base, stage: 'vote', vote: { id: 1, count: 1 } }, { ...base, stage: 'reveal', summary: { reason: 'caught' } }), ['revealed']);
  assert.deepEqual(events(base, base), []);
});
test('EXP-081: „Mission erfüllt“ nur, wenn der Agent den Ort errät', () => {
  assert.deepEqual(events(base, { ...base, stage: 'reveal', summary: { reason: 'guess' } }), ['mission']);
  for (const reason of ['caught', 'wrong', 'failed', 'timeout']) assert.deepEqual(events(base, { ...base, stage: 'reveal', summary: { reason } }), ['revealed']);
});
test('EXP-081: Palette kennt Schreibmaschine, Akte, Anklage und Akkord', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['type', 'file', 'accuse', 'vote', 'reveal', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['reveal']);
});
