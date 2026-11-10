// EXP-036: Darstellungshilfen leiten alles aus bestätigten, öffentlichen Zuständen ab.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { sky, fallen, victor, GLYPHS } from '../public/games/werwolf/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-036: Himmel folgt der Phase', () => {
  assert.deepEqual(['night', 'day', 'vote', 'hunter', 'over', null].map(sky), ['nacht', 'tag', 'tag', 'tag', null, null]);
});
test('EXP-036: neu Gestorbene aus zwei Zuständen', () => {
  assert.deepEqual(fallen([{ id: 'a' }], [{ id: 'a' }, { id: 'b', role: 'wolf' }]), [{ id: 'b', role: 'wolf' }]);
  assert.deepEqual(fallen(null, [{ id: 'a' }]), [{ id: 'a' }]); assert.deepEqual(fallen([{ id: 'a' }], [{ id: 'a' }]), []);
});
test('EXP-036: Sieger nur am bestätigten Spielende', () => {
  assert.equal(victor({ phase: 'over', g: { winner: 'wolf' } }), 'wolf'); assert.equal(victor({ phase: 'playing', g: { winner: null } }), null); assert.equal(victor({ phase: 'over', g: {} }), null);
});
test('EXP-036: jede Rolle hat ein eigenes Zeichen, die Palette alle Dorfklänge', async () => {
  assert.deepEqual(Object.keys(GLYPHS).sort(), ['amor', 'dorf', 'hexe', 'jaeger', 'seher', 'wolf']);
  const palette = await loadPalette(experience.palette);
  for (const event of ['night', 'rooster', 'murmur', 'gong', 'vote', 'death', 'flip', 'highlight', 'end', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['night', 'rooster', 'murmur', 'gong']);
});
