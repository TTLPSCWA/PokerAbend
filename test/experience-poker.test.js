// EXP-002: Erkennung der Aktionen aus zwei bestätigten Zuständen (reine Darstellung).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPalette, PALETTES } from '../public/sound/engine.js';

// Das Modul importiert /motion/motion.js mit absolutem Browserpfad; die reinen Helfer werden deshalb aus dem Quelltext geladen.
const source = readFileSync(new URL('../public/games/poker/experience.js', import.meta.url), 'utf8');
const pure = source.slice(source.indexOf('const seats'), source.indexOf('const host = globalThis')).replaceAll('export ', '');
const { actions, boardNew, showdown, runout } = new Function(`${pure}; return { actions, boardNew, showdown, runout };`)();

const seat = (id, extra = {}) => ({ id, bet: 0, stack: 1000, folded: false, allIn: false, lastAction: null, ...extra });
const view = (hand, seats) => ({ hand: { no: 1, street: 'preflop', board: [], toAct: 0, done: false, ...hand }, seats });
test('EXP-002: Einsatz, Check, Fold und All-in je Platz', () => {
  const a = view({ toAct: 0 }, [seat('a'), seat('b', { bet: 100 }), null, seat('c')]);
  assert.deepEqual(actions(a, view({ toAct: 1 }, [seat('a', { bet: 100, lastAction: 'Call' }), seat('b', { bet: 100 }), null, seat('c')])), [{ seat: 0, type: 'chips' }]);
  assert.deepEqual(actions(a, view({ toAct: 1 }, [seat('a', { lastAction: 'Check' }), seat('b', { bet: 100 }), null, seat('c')])), [{ seat: 0, type: 'check' }]);
  assert.deepEqual(actions(a, view({ toAct: 1 }, [seat('a', { folded: true }), seat('b', { bet: 100 }), null, seat('c')])), [{ seat: 0, type: 'fold' }]);
  assert.deepEqual(actions(a, view({ toAct: 1 }, [seat('a', { bet: 900, allIn: true }), seat('b', { bet: 100 }), null, seat('c')])), [{ seat: 0, type: 'allin' }]);
  // Ein Call, der die Setzrunde schließt: Der Einsatz liegt schon im Pot, der Stack ist kleiner – kein Check.
  assert.deepEqual(actions(view({ toAct: 0 }, [seat('a', { bet: 50, stack: 950 }), seat('b', { bet: 100, stack: 900 })]), view({ toAct: 1, street: 'flop' }, [seat('a', { stack: 900 }), seat('b', { stack: 900 })])), [{ seat: 0, type: 'chips' }]);
  // Check, der die Setzrunde schließt; wer nicht am Zug war, zählt nicht.
  assert.deepEqual(actions(view({ toAct: 1 }, [seat('a'), seat('b')]), view({ toAct: 0, street: 'flop' }, [seat('a'), seat('b')])), [{ seat: 1, type: 'check' }]);
  assert.deepEqual(actions(a, view({ no: 2 }, [seat('a', { bet: 50 })])), []);
  assert.deepEqual(actions(null, a), []);
});
test('EXP-002: neue Gemeinschaftskarten und auslaufendes Board', () => {
  const a = view({ board: ['Ah', 'Kd', '2c'] }, [seat('a', { allIn: true }), seat('b')]);
  assert.deepEqual(boardNew(a, view({ board: ['Ah', 'Kd', '2c', '9s', '3h'], done: true, toAct: null }, a.seats)), [3, 4]);
  assert.deepEqual(boardNew(view({ no: 0, board: ['Ah'] }, []), view({ board: ['2c', '3c', '4c'] }, [])), [0, 1, 2]);
  assert.equal(runout(a, view({ board: ['Ah', 'Kd', '2c', '9s', '3h'], done: true, toAct: null }, a.seats)), true);
  assert.equal(runout(view({ board: [] }, [seat('a'), seat('b')]), view({ board: ['Ah', 'Kd', '2c'], toAct: 1 }, [seat('a'), seat('b')])), false);
});
test('EXP-002: All-in-Showdown nur mit All-in und aufgedeckter Gewinnhand', () => {
  const a = view({}, [seat('a', { allIn: true }), seat('b')]);
  const done = (pots) => view({ done: true, result: { pots } }, a.seats);
  assert.equal(showdown(a, done([{ winners: [0], cards: ['Ah', 'Kd'] }])), true);
  assert.equal(showdown(a, done([{ winners: [0] }])), false); // alle anderen haben gefoldet
  assert.equal(showdown(view({}, [seat('a'), seat('b')]), view({ done: true, result: { pots: [{ winners: [0], cards: ['Ah'] }] } }, [seat('a'), seat('b')])), false);
  // Am Handende sind die All-in-Marken schon zurückgesetzt: Das auslaufende Board verrät das All-in.
  assert.equal(showdown(view({ board: ['Ah', 'Kd', '2c'] }, [seat('a'), seat('b')]), view({ board: ['Ah', 'Kd', '2c', '9s', '3h'], done: true, toAct: -1, result: { pots: [{ winners: [0], cards: ['Ah'] }] } }, [seat('a'), seat('b')])), true);
  assert.equal(showdown(done([{ winners: [0], cards: ['Ah'] }]), done([{ winners: [0], cards: ['Ah'] }])), false); // derselbe Endstand noch einmal
});
test('EXP-002: Palette poker kennt Chips, Einsammeln, Filz, Check und All-in', async () => {
  assert.ok(PALETTES.includes('poker'));
  const palette = await loadPalette('poker');
  for (const event of ['chips', 'collect', 'deal', 'card', 'check', 'fold', 'allin', 'shuffle', 'highlight', 'turn', 'win', 'lose']) assert.ok(palette.events[event]?.length || palette.samples[event], event);
  assert.deepEqual(palette.synth, ['allin']);
});
