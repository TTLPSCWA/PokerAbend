// EXP-086: Ereignisse aus zwei bestätigten Skat-Zuständen.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { isTrump, events } from '../public/games/skat/experience.js';
import { isTrump as ruleTrump } from '../games/skat/rules.js';
import { loadPalette } from '../public/sound/engine.js';

const G = (g) => ({ g: { dealKey: 'k', stage: 'play', bd: null, passed: [], trick: [], lastTrick: null, game: { type: 'suit', suit: 'h' }, ...g } });
test('EXP-086: Trumpf wie in den Regeln', () => {
  for (const game of [{ type: 'suit', suit: 'h' }, { type: 'grand' }, { type: 'null' }, { type: 'ramsch' }]) for (const c of ['Jc', 'Ah', 'Ts', '7d', 'Jd', 'Kh']) assert.equal(isTrump(c, game), ruleTrump(c, game), `${c} ${game.type}`);
});
test('EXP-086: Reizen, Skat aufnehmen, drücken, Trumpf, Stich, Grand Hand', () => {
  assert.deepEqual(events(G({ stage: 'bid', bd: { value: 18 } }), G({ stage: 'bid', bd: { value: 20 } })), ['bid']);
  assert.deepEqual(events(G({ stage: 'pickup' }), G({ stage: 'discard' })), ['pickup']);
  assert.deepEqual(events(G({ stage: 'discard' }), G({ stage: 'declare' })), ['press']);
  assert.deepEqual(events(G({ stage: 'declare' }), G({ stage: 'play', game: { type: 'grand', hand: true } })), ['grandhand']);
  assert.deepEqual(events(G({ stage: 'declare' }), G({ stage: 'play', game: { type: 'grand', hand: false } })), []);
  assert.deepEqual(events(G({}), G({ trick: [{ id: 'a', card: 'Jc' }] })), ['trump']);
  assert.deepEqual(events(G({}), G({ trick: [{ id: 'a', card: '7s' }] })), ['card']);
  assert.deepEqual(events(G({ trick: [{}, {}] }), G({ lastTrick: { winner: 'a', cards: [] } })), ['sweep']);
  assert.deepEqual(events(G({}), { g: { ...G({ stage: 'bid' }).g, dealKey: 'neu' } }), []);
});
test('EXP-086: Palette kennt Klopfen, Bleistift, Rascheln und Stammtisch', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['knock', 'pencil', 'rustle', 'sweep', 'press', 'stammtisch', 'card', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.deepEqual(palette.synth, ['pencil', 'stammtisch']);
});
