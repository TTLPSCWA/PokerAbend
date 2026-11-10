// Gemeinsame Ereigniserkennung der Ablegespiele (EXP-003, EXP-004): nur aus bestätigten, öffentlichen Zuständen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { shedEvents, skipped } from '../public/games/shedding-events.js';
import { loadPalette } from '../public/sound/engine.js';

const P = (id, cards, extra = {}) => ({ id, cards, inRound: true, last: cards === 1, ...extra });
const V = (players, g = {}, extra = {}) => ({ phase: 'playing', roundNo: 1, dir: 1, turnId: 'a', players, g: { top: '7r', wish: null, pending: 0, ...g }, ...extra });
test('Ablegen, Ziehen, letzte Karte, Richtungswechsel, Wunsch und Kette werden erkannt', () => {
  const a = V([P('a', 5), P('b', 5), P('c', 2)]);
  assert.deepEqual(shedEvents(a, V([P('a', 4), P('b', 5), P('c', 2)], { top: '9r' }, { turnId: 'b' })), [{ type: 'play', id: 'a', card: '9r' }]);
  assert.deepEqual(shedEvents(a, V([P('a', 7), P('b', 5), P('c', 2)], {}, { turnId: 'b' })), [{ type: 'draw', id: 'a', n: 2 }]);
  assert.deepEqual(shedEvents(V([P('a', 5), P('b', 5), P('c', 2)], {}, { turnId: 'c' }), V([P('a', 5), P('b', 5), P('c', 1)], { top: '2r' })).map((e) => e.type), ['play', 'last']);
  assert.deepEqual(shedEvents(a, V([P('a', 4), P('b', 5), P('c', 2)], { top: 'Rr' }, { dir: -1, turnId: 'c' })).map((e) => e.type), ['play', 'reverse']);
  assert.deepEqual(shedEvents(a, V([P('a', 4), P('b', 5), P('c', 2)], { top: 'Ww', wish: 'b' }, { turnId: 'b' })).map((e) => e.type), ['play', 'wish']);
  assert.deepEqual(shedEvents(a, V([P('a', 4), P('b', 5), P('c', 2)], { top: 'Dr', pending: 2 }, { turnId: 'b' })).at(-1), { type: 'chain', total: 2, stacked: false });
  assert.deepEqual(shedEvents(V([P('a', 4), P('b', 5)], { top: 'Dr', pending: 2 }, { turnId: 'b' }), V([P('a', 4), P('b', 4)], { top: 'Dg', pending: 4 })).at(-1), { type: 'chain', total: 4, stacked: true });
});
test('Neue Runde, Neuladen und gleicher Zustand lösen nichts aus', () => {
  const a = V([P('a', 5), P('b', 5)]);
  assert.deepEqual(shedEvents(a, a), []); assert.deepEqual(shedEvents(null, a), []);
  assert.deepEqual(shedEvents(a, { ...V([P('a', 7), P('b', 7)]), roundNo: 2 }), []);
  assert.deepEqual(shedEvents({ ...a, phase: 'lobby' }, V([P('a', 7), P('b', 7)])), []);
});
test('Übersprungen ist nur, über wen der Zug wirklich hinwegging', () => {
  const a = V([P('a', 5), P('b', 5), P('c', 5)]);
  assert.equal(skipped(a, V([P('a', 4), P('b', 5), P('c', 5)], { top: 'Sr' }, { turnId: 'c' })), 'b');
  assert.equal(skipped(a, V([P('a', 4), P('b', 5), P('c', 5)], { top: '9r' }, { turnId: 'b' })), null);
  assert.equal(skipped(a, V([P('a', 4), P('b', 7), P('c', 5)], { top: 'Dr' }, { turnId: 'c' })), null); // hat gezogen, nicht ausgesetzt
  assert.equal(skipped(V([P('a', 5), P('b', 5)]), V([P('a', 4), P('b', 5)], { top: 'Sr' }, { turnId: 'a' })), 'b'); // zu zweit: wieder am Zug
});
test('EXP-004: Palette uno kennt Klatschen, Ziehen, Stopp, Wusch, Ruf und Stapelton', async () => {
  const palette = await loadPalette('uno');
  for (const event of ['card', 'draw', 'skip', 'reverse', 'call', 'stack', 'wish', 'highlight', 'deal', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.deepEqual(palette.synth, ['skip', 'reverse', 'call', 'stack']);
});
test('EXP-003: Palette maumau kennt Schnippen, Klirren, 7er-Zähler und Einschlafen', async () => {
  const palette = await loadPalette('maumau');
  for (const event of ['card', 'draw', 'deal', 'mau', 'maumau', 'seven', 'sleep', 'wish', 'highlight', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.deepEqual(palette.synth, ['sleep']);
});
