// EXP-001: Darstellungshilfen leiten alles aus bestätigten Zuständen ab und verraten nichts.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { daytime, curve, trips, line, arrested } from '../public/games/scotland-yard/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-001: Tageszeit wechselt alle sechs Züge', () => {
  assert.deepEqual([0, 5, 6, 11, 12, 17, 18, 23, 24].map(daytime), ['tag', 'tag', 'daemmerung', 'daemmerung', 'nacht', 'nacht', 'morgen', 'morgen', 'tag']);
  assert.equal(daytime(undefined), 'tag');
});
test('EXP-001: Kurve beginnt und endet an den Haltestellen und biegt zur Linienseite aus', () => {
  const points = curve({ x: 0, y: 0 }, { x: 100, y: 0 }, 20, 4);
  assert.equal(points.length, 5); assert.deepEqual(points[0], { x: 0, y: 0 }); assert.deepEqual(points.at(-1), { x: 100, y: 0 });
  assert.equal(points[2].x, 50); assert.equal(points[2].y, 10);
  assert.deepEqual(curve({ x: 5, y: 5 }, { x: 5, y: 5 }, 9, 2).at(-1), { x: 5, y: 5 });
});
test('EXP-001: Fahrten der Detektive samt Ticket aus zwei Zuständen', () => {
  const before = [{ id: 'a', station: 3, tickets: { taxi: 10, bus: 8, underground: 4 } }, { id: 'b', station: 9, tickets: { taxi: 10, bus: 8, underground: 4 } }];
  const after = [{ id: 'a', station: 4, tickets: { taxi: 10, bus: 7, underground: 4 } }, { id: 'b', station: 9, tickets: { taxi: 10, bus: 8, underground: 4 } }];
  assert.deepEqual(trips(before, after), [{ id: 'a', from: 3, to: 4, ticket: 'bus' }]);
  assert.deepEqual(trips(null, after), []);
});
test('EXP-001: Linie zum Ticket; Fährhorn nur, wenn es ausschließlich die Fähre gibt', () => {
  const edges = [{ a: 1, b: 2, mode: 'taxi' }, { a: 1, b: 2, mode: 'bus' }, { a: 2, b: 7, mode: 'ferry' }];
  assert.equal(line(edges, 2, 1, 'bus').mode, 'bus'); assert.equal(line(edges, 1, 2, 'black').ferryOnly, false);
  assert.equal(line(edges, 7, 2, 'black').ferryOnly, true); assert.equal(line(edges, 1, 9, 'taxi'), null);
});
test('EXP-001: Festnahme nur, wenn ein Detektiv auf dem Feld von Mr. X steht und die Detektive gewinnen', () => {
  const g = { xId: 'x', xPosition: 12, detectives: [{ id: 'a', station: 12 }, { id: 'b', station: 30 }] };
  assert.equal(arrested({ phase: 'over', result: { winners: ['a', 'b'] }, g }), true);
  assert.equal(arrested({ phase: 'over', result: { winners: ['x'] }, g }), false);
  assert.equal(arrested({ phase: 'playing', result: null, g }), false);
  assert.equal(arrested({ phase: 'over', result: { winners: ['a', 'b'] }, g: { ...g, xPosition: 13 } }), false);
});
test('EXP-001: Palette kennt jedes Ticket, Auftauchen und Festnahme', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['taxi', 'bus', 'underground', 'ferry', 'black', 'casefile', 'reveal', 'cuffs', 'stamp', 'highlight', 'select', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length, event);
  assert.deepEqual(palette.synth, ['taxi', 'bus', 'underground', 'ferry']);
});
