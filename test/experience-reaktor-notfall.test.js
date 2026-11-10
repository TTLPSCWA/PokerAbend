// EXP-094: Temperatur, Alarmstufen und Rettung aus öffentlichen Angaben.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { heatOf, alarmLevel, lastSecond, proposed } from '../public/games/reaktor-notfall/experience.js';
import { loadPalette } from '../public/sound/engine.js';

test('EXP-094: verbrauchte Zeit und Alarmstufen', () => {
  assert.equal(heatOf({ heatMs: 240000, heatTotal: 240000 }), 0); assert.equal(heatOf({ heatMs: 60000, heatTotal: 240000 }), 0.75);
  assert.equal(heatOf({ heatMs: 60000, heatTotal: 240000 }, 120000), 1); assert.equal(heatOf(null), 0);
  assert.deepEqual([0.3, 0.6, 0.8, 0.95].map(alarmLevel), [0, 1, 2, 3]);
});
test('EXP-094: Rettung in letzter Sekunde nur gelöst und bei 99 %', () => {
  assert.equal(lastSecond({ heatMs: 2000, heatTotal: 240000, result: { solved: true } }), true);
  assert.equal(lastSecond({ heatMs: 30000, heatTotal: 240000, result: { solved: true } }), false);
  assert.equal(lastSecond({ heatMs: 0, heatTotal: 240000, result: { solved: false } }), false);
});
test('EXP-094: neue oder geänderte Vorschläge', () => { assert.deepEqual(proposed({ proposals: { a: '12' } }, { proposals: { a: '12', b: '34' } }), ['b']); assert.deepEqual(proposed({ proposals: { a: '12' } }, { proposals: { a: '13' } }), ['a']); });
test('EXP-094: Palette kennt Alarmstufen, Zischen, Entwarnung und Seufzer', async () => {
  const palette = await loadPalette(experience.palette);
  for (const event of ['alarm1', 'alarm2', 'alarm3', 'hiss', 'allclear', 'sigh', 'switch', 'wrong', 'highlight', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
});
