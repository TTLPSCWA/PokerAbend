import test from 'node:test';
import assert from 'node:assert/strict';
import { Room as Uno } from '../games/farbenchaos/room.js';

function table(t) {
  const r = new Uno('ZUG', { startAction: false }, () => {});
  t.after(() => r.dispose());
  const ids = ['Anna', 'Ben', 'Cem', 'Dana'].map((name) => {
    const p = r.addPlayer(name, null); r.sit(p.id); return p.id;
  });
  r.start(ids[0]);
  return { r, ids };
}

test('Zugwechsel: aktiver Aussteiger gibt in beiden Spielrichtungen an seinen nächsten Nachbarn ab', (t) => {
  for (const dir of [1, -1]) for (let turn = 0; turn < 4; turn++) {
    const { r, ids } = table(t);
    r.dir = dir; r.turn = turn;
    const expected = ids[(turn + dir + ids.length) % ids.length];
    r.stand(ids[turn]);
    assert.equal(r.phase, 'playing');
    assert.equal(r.currentId, expected, `Richtung ${dir}, Platz ${turn}`);
    assert.equal(r.dir, dir);
  }
});

test('Zugwechsel: Ausstieg eines wartenden Spielers ändert den aktiven Spieler nicht', (t) => {
  for (const dir of [1, -1]) for (let turn = 0; turn < 4; turn++) for (let leaving = 0; leaving < 4; leaving++) {
    if (leaving === turn) continue;
    const { r, ids } = table(t);
    r.dir = dir; r.turn = turn;
    r.stand(ids[leaving]);
    assert.equal(r.currentId, ids[turn], `Richtung ${dir}, Platz ${turn}, Ausstieg ${leaving}`);
  }
});
