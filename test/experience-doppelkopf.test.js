// EXP-087: Ansagen, Parteien, Füchse und Doppelkopf aus zwei bestätigten Zuständen.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { events, doko } from '../public/games/doppelkopf/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const G = (g) => ({ g: { dealKey: 'k', stage: 'play', levels: { re: 0, kontra: 0 }, known: {}, trick: [], lastTrick: null, ...g } });
test('EXP-087: Ansage und geklärte Partei', () => {
  assert.deepEqual(events(G({}), G({ levels: { re: 1, kontra: 0 }, known: { a: 're' } })), [{ type: 'call', party: 're' }, { type: 'party', id: 'a', party: 're' }]);
  assert.deepEqual(events(G({ levels: { re: 1, kontra: 0 } }), G({ levels: { re: 1, kontra: 1 } })), [{ type: 'call', party: 'kontra' }]);
});
test('EXP-087: Stich, Fuchs (gefangen nur bei bekannten, verschiedenen Parteien) und Doko', () => {
  const trick = { winner: 'b', points: 41, cards: [{ id: 'a', card: 'Ad1' }, { id: 'b', card: 'Tc' }, { id: 'c', card: 'Kc' }, { id: 'd', card: 'Qc' }] };
  assert.deepEqual(events(G({ trick: [{}, {}, {}] }), G({ lastTrick: trick, known: {} })), [{ type: 'sweep', winner: 'b', points: 41 }, { type: 'fox', from: 'a', to: 'b', caught: false }]);
  assert.equal(events(G({ trick: [{}, {}, {}] }), G({ lastTrick: trick, known: { a: 're', b: 'kontra' } })).at(-1).caught, true);
  assert.equal(events(G({ trick: [{}, {}, {}] }), G({ lastTrick: { ...trick, winner: 'a' }, known: {} })).some((e) => e.type === 'fox'), false); // eigener Fuchs
  assert.equal(doko(40), true); assert.equal(doko(39), false);
  assert.deepEqual(events(G({}), { g: { ...G({}).g, dealKey: 'neu', levels: { re: 1, kontra: 0 } } }), []);
});
test('EXP-087: Palette kennt Re, Kontra, Jagdhorn', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['re', 'kontra', 'horn', 'sweep', 'flip', 'card', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.deepEqual(palette.synth, ['re', 'kontra', 'horn']);
});
