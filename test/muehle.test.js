// Mühle: Brett (24 Punkte, 16 Mühlen, Nachbarn), Setzen, Ziehen, Springen, Mühle → schlagen (geschützte Steine), Sieg bei 2 Steinen
// oder ohne Zug, Unentschieden (Zuggrenze, dreimal dieselbe Stellung), Zug-Timer, Bot.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Room, MILLS, ADJ, XY, botMove } from '../games/muehle/room.js';

function setup(settings = {}) {
  const r = new Room('MU', { turnTime: 0, ...settings }, () => {});
  const [a, b] = ['Anna', 'Ben'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(a);
  return { r, a, b };
}
// Stellung direkt setzen: Setzphase vorbei, Steine verteilt
function position(r, a, b, mine, theirs, handA = 0, handB = 0) {
  r.board = Array(24).fill(null);
  mine.forEach((p) => { r.board[p] = a; }); theirs.forEach((p) => { r.board[p] = b; });
  r.hand[a] = handA; r.hand[b] = handB; r.step = 'move';
}

test('Brett: 24 Punkte, 16 Mühlen, jeder Punkt hat 2–4 Nachbarn auf Linien', () => {
  assert.equal(XY.length, 24);
  assert.equal(MILLS.length, 16);
  assert.ok(ADJ.every((n) => n.length >= 2 && n.length <= 4));
  assert.deepEqual(ADJ[1].sort((x, y) => x - y), [0, 2, 9]);
  assert.deepEqual(ADJ[9].sort((x, y) => x - y), [1, 8, 10, 17]);
});

test('Setzen: abwechselnd, nur freie Punkte; Mühle beim Setzen schlägt; geschützte Steine', () => {
  const { r, a, b } = setup();
  r.place(a, 0); r.place(b, 8);
  assert.throws(() => r.place(a, 8), /nicht frei/);
  r.place(a, 1); r.place(b, 9);
  r.place(a, 2); // Mühle 0-1-2
  assert.equal(r.step, 'remove');
  assert.equal(r.currentId, a, 'erst schlagen');
  assert.throws(() => r.place(a, 3), /Erst einen Stein entfernen/);
  r.capture(a, 8);
  assert.equal(r.board[8], null);
  assert.equal(r.currentId, b);
  r.place(b, 8); r.place(a, 3); r.place(b, 10); // Ben: Mühle 8-9-10
  assert.equal(r.step, 'remove');
  assert.throws(() => r.capture(b, 0), /geschützt/, 'Annas 0-1-2 ist eine Mühle, die 3 nicht');
  r.capture(b, 3);
});

test('Ziehen nur zum Nachbarn, Springen mit 3 Steinen (abschaltbar)', () => {
  const { r, a, b } = setup();
  position(r, a, b, [0, 9, 20, 22], [4, 6, 12, 14]);
  r.turn = r.order.indexOf(a);
  assert.throws(() => r.move(a, 0, 3), /Nachbarpunkt/);
  r.move(a, 0, 1);
  assert.equal(r.board[1], a);
  // Ben mit 3 Steinen springt überall hin
  const s = setup();
  position(s.r, s.a, s.b, [0, 9, 20, 22], [4, 6, 12]);
  s.r.turn = s.r.order.indexOf(s.b);
  assert.ok(s.r.flying(s.b));
  s.r.move(s.b, 4, 17);
  assert.equal(s.r.board[17], s.b);
  const n = setup({ fly: false });
  position(n.r, n.a, n.b, [0, 9, 20, 22], [4, 6, 12]);
  n.r.turn = n.r.order.indexOf(n.b);
  assert.throws(() => n.r.move(n.b, 4, 17), /Nachbarpunkt/);
});

test('Sieg: Gegner hat nur noch 2 Steine – oder kann nicht mehr ziehen', () => {
  const { r, a, b } = setup();
  position(r, a, b, [0, 1, 3, 20], [5, 6, 22]);
  r.turn = r.order.indexOf(a);
  r.move(a, 3, 2); // Mühle 0-1-2
  r.capture(a, 5);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, [a]);
  assert.equal(r.scores[a], 1);
  // Ben eingesperrt: seine Ecken 0, 2, 6 haben nur Annas Steine als Nachbarn, Springen aus
  const g = setup({ fly: false });
  position(g.r, g.a, g.b, [1, 3, 5, 7, 9], [0, 2, 6]);
  g.r.turn = g.r.order.indexOf(g.a);
  g.r.move(g.a, 9, 8); // Anna zieht, Ben kann danach nicht ziehen
  assert.equal(g.r.phase, 'over');
  assert.match(g.r.result.text, /kann nicht mehr ziehen/);
});

test('Unentschieden: Zuggrenze ohne Schlagen und dreimal dieselbe Stellung', () => {
  const { r, a, b } = setup({ drawLimit: 4 });
  position(r, a, b, [0, 9, 20, 22], [4, 6, 12, 14]);
  r.turn = r.order.indexOf(a);
  r.move(a, 0, 1); r.move(b, 4, 3); r.move(a, 1, 0);
  assert.equal(r.phase, 'playing');
  r.move(b, 3, 4);
  assert.equal(r.phase, 'over');
  assert.match(r.result.text, /4 Züge ohne Schlagen/);
  const w = setup({ drawLimit: 0 });
  position(w.r, w.a, w.b, [0, 9, 20, 22], [4, 6, 12, 14]);
  w.r.turn = w.r.order.indexOf(w.a);
  const cycle = [[w.a, 0, 1], [w.b, 4, 3], [w.a, 1, 0], [w.b, 3, 4]];
  for (let k = 0; k < 12 && w.r.phase === 'playing'; k++) { const [who, f, t] = cycle[k % 4]; w.r.move(who, f, t); }
  assert.equal(w.r.phase, 'over');
  assert.match(w.r.result.text, /Dreimal dieselbe Stellung/);
});

test('Bot: schließt eine Mühle, verhindert eine gegnerische', () => {
  const { r, a, b } = setup();
  r.place(a, 0); r.place(b, 8); r.place(a, 1); // Anna droht 0-1-2
  botMove(r, b);
  assert.equal(r.board[2], b, 'blockt');
  r.place(a, 16); // Ben (8) …
  r.place(b, 9); r.place(a, 17);
  botMove(r, b); // Ben schließt 8-9-10
  assert.equal(r.board[10], b);
  assert.equal(r.step, 'remove');
});

test('Zug-Timer: der Computer zieht', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const { r, b } = setup({ turnTime: 10 });
    r.afterChange();
    mock.timers.tick(10500);
    assert.equal(r.board.filter(Boolean).length, 1);
    assert.equal(r.currentId, b);
    r.dispose();
  } finally { mock.timers.reset(); }
});
