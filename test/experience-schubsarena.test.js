// EXP-079: Stöße, Rauswürfe und der Doppelschubser aus Server-Frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { happenings, inFront, credit } from '../public/games/schubsarena/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const B = (id, x, extra = {}) => ({ id, x, y: 300, alive: true, pushAt: -10000, facing: { x: 1, y: 0 }, ...extra });
test('EXP-079: neue Stöße und Rauswürfe eines Frames', () => {
  const prev = { bodies: [B('a', 400), B('b', 460), B('c', 700)] };
  const next = { bodies: [B('a', 400, { pushAt: 2000 }), B('b', 520), B('c', 720, { alive: false })] };
  assert.deepEqual(happenings(next, prev), { shoves: ['a'], out: [{ id: 'c', x: 700, y: 300 }] });
  assert.deepEqual(happenings(prev, prev), { shoves: [], out: [] });
});
test('EXP-079: Stoß trifft nur nahe Gegner vor der Blickrichtung', () => {
  assert.equal(inFront(B('a', 400), B('b', 460)), true);
  assert.equal(inFront(B('a', 400), B('b', 340)), false); // hinter mir
  assert.equal(inFront(B('a', 400), B('b', 500)), false); // zu weit weg
});
test('EXP-079: Doppelschubser zählt nur Getroffene desselben Stoßes im Zeitfenster', () => {
  const push = { id: 'a', at: 1000, count: 0, victims: ['b', 'c'] };
  assert.equal(credit(push, { id: 'b' }, 1400), 1); assert.equal(credit(push, { id: 'c' }, 1900), 2);
  assert.equal(credit({ id: 'a', at: 1000, count: 0, victims: ['b'] }, { id: 'c' }, 1200), 0); // nicht getroffen
  assert.equal(credit({ id: 'a', at: 1000, count: 0, victims: ['b'] }, { id: 'b' }, 4000), 0); // zu spät
  assert.equal(credit(null, { id: 'b' }, 1000), 0);
});
test('EXP-079: Palette kennt Wumms, Rutschen, Platsch und Eisknacken', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['shove', 'slide', 'splash', 'crack', 'count', 'highlight', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['slide', 'splash', 'crack']);
});
