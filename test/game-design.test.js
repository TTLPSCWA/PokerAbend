import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { GAMES } from '../games/index.js';

function design() {
  const calls = [];
  const context = vm.createContext({ document: { addEventListener() {} }, prefs: { sound: true },
    setTimeout: (fn) => fn(), beep: (...args) => calls.push(args), sfx: (name) => calls.push(name) });
  vm.runInContext(readFileSync(new URL('../public/game-design.js', import.meta.url), 'utf8') + '\nglobalThis.design = GameDesign;', context);
  return { api: context.design, prefs: context.prefs, calls };
}

test('Jedes spielbare Spiel hat ein Motiv und kurze, begrenzte Klangfolgen', () => {
  const { api } = design();
  assert.deepEqual(Object.keys(api.scenes).sort(), Object.keys(GAMES).sort());
  for (const id of Object.keys(GAMES)) {
    assert.match(api.scene(id).accent, /^#[A-F0-9]{6}$/);
    for (const event of ['win', 'end', 'warn', 'jump', 'crown', 'done', 'countdown', 'hit', 'catch', 'drum', 'shuffle', 'card']) {
      const notes = api.cue(id, event);
      assert.ok(notes.length >= 1 && notes.length <= 3);
      for (const n of notes) {
        assert.ok(n.freq >= 100 && n.freq <= 2000);
        assert.ok(n.at + n.ms <= 500);
        assert.ok(n.volume > 0 && n.volume <= .06);
      }
    }
  }
  assert.equal(api.scene('unbekannt').family, 'party');
});

test('Stummschalten sperrt auch Spielklänge und den Testton', () => {
  const { api, prefs, calls } = design();
  assert.equal(api.sound('reversi', 'done'), true);
  assert.equal(calls.length, 2);
  calls.length = 0; prefs.sound = false;
  for (const event of ['done', 'win', 'dice', 'splash', 'call']) assert.equal(api.sound('kniffel', event), false);
  assert.equal(calls.length, 0);
});
