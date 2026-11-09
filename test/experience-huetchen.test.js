// EXP-007: Darstellungshilfen leiten alles aus bestätigten Zuständen ab.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { streak, diff } from '../public/games/huetchen/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-007: drei Sechsen in Folge desselben Spielers lösen genau einmal aus', () => {
  let s = streak(null, [{ id: 'a', value: 6 }]); assert.equal(s.triple, null);
  s = streak(s, [{ id: 'a', value: 6 }]); assert.equal(s.count, 2);
  s = streak(s, [{ id: 'a', value: 6 }]); assert.equal(s.triple, 'a'); assert.equal(s.count, 0);
  s = streak(streak(streak(null, [{ id: 'a', value: 6 }]), [{ id: 'a', value: 3 }]), [{ id: 'a', value: 6 }]); assert.equal(s.count, 1);
  s = streak(streak(null, [{ id: 'a', value: 6 }, { id: 'a', value: 6 }]), [{ id: 'b', value: 6 }]); assert.equal(s.triple, null); assert.equal(s.id, 'b');
});
test('EXP-007: Zug und Rauswurf werden aus zwei Stellungen erkannt', () => {
  const d = diff({ a: [-1, 4, 0, 0], b: [7, -1, -1, -1] }, { a: [0, 7, 0, 0], b: [-1, -1, -1, -1] });
  assert.deepEqual(d.walked, [{ id: 'a', i: 0, from: -1, to: 0 }, { id: 'a', i: 1, from: 4, to: 7 }]);
  assert.deepEqual(d.hit, [{ id: 'b', i: 0, from: 7 }]);
  assert.deepEqual(diff(null, { a: [0] }), { walked: [], hit: [] });
});
test('EXP-007: Palette kennt Würfel, Tocken, Plopp, Grummeln und das Highlight', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['dice', 'piece', 'plop', 'grumble', 'six', 'home', 'highlight', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['plop', 'grumble']);
});
