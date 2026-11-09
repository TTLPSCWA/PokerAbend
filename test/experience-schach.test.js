// EXP-088: Die Darstellung leitet Figurenbewegungen nur aus zwei bestätigten Stellungen ab.
import test from 'node:test';
import assert from 'node:assert/strict';
import experience, { moves } from '../public/games/schach/experience.js';
import { loadPalette } from '../public/sound/engine.js';

const board = (map) => { const b = Array(64).fill(null); for (const [sq, p] of Object.entries(map)) b['abcdefgh'.indexOf(sq[0]) + (8 - Number(sq[1])) * 8] = p; return b; };
const sorted = (list) => list.map((m) => m.from + m.to).sort();

test('EXP-088: einfacher Zug und Schlagzug bewegen genau eine Figur', () => {
  assert.deepEqual(sorted(moves(board({ e2: 'wp' }), board({ e4: 'wp' }))), ['e2e4']);
  assert.deepEqual(sorted(moves(board({ e4: 'wp', d5: 'bp' }), board({ d5: 'wp' }))), ['e4d5']);
});
test('EXP-088: Rochade bewegt König und Turm gemeinsam, auch in Chess960', () => {
  assert.deepEqual(sorted(moves(board({ e1: 'wk', h1: 'wr' }), board({ g1: 'wk', f1: 'wr' }))), ['e1g1', 'h1f1']);
  assert.deepEqual(sorted(moves(board({ e8: 'bk', a8: 'br' }), board({ c8: 'bk', d8: 'br' }))), ['a8d8', 'e8c8']);
  // Chess960: König steht schon auf g1, nur der Turm wandert.
  assert.deepEqual(sorted(moves(board({ g1: 'wk', h1: 'wr' }), board({ g1: 'wk', f1: 'wr' }))), ['h1f1']);
});
test('EXP-088: en passant und Umwandlung', () => {
  assert.deepEqual(sorted(moves(board({ e5: 'wp', d5: 'bp' }), board({ d6: 'wp' }))), ['e5d6']);
  assert.deepEqual(sorted(moves(board({ b7: 'wp', a8: 'br' }), board({ a8: 'wn' }))), ['b7a8']);
});
test('EXP-088: Highlight nur bei frischem Schachmatt; Palette kennt die Spielereignisse', async () => {
  const playing = { phase: 'playing', g: {} }, mate = { phase: 'over', g: { reason: 'checkmate' } }, resign = { phase: 'over', g: { reason: 'resignation' } };
  assert.ok(experience.finale(mate, playing) > 0);
  assert.equal(experience.finale(resign, playing), 0);
  assert.equal(experience.finale(mate, mate), 0);
  const palette = await loadPalette(experience.palette);
  for (const event of ['piece', 'capture', 'check', 'tick', 'promote', 'highlight', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length && palette.samples[event], event);
});
