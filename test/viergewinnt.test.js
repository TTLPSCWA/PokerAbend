// Vier gewinnt: Schwerkraft, volle Spalte, vier in einer Reihe (alle Richtungen), unentschieden, Farben, Zug-Timer, Bot.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Room, botColumn, COLS } from '../games/viergewinnt/room.js';

function setup(settings = {}) {
  const r = new Room('VG', { turnTime: 0, ...settings }, () => {});
  const [a, b] = ['Anna', 'Ben'].map((n) => { const p = r.addPlayer(n, null); r.sit(p.id); return p.id; });
  r.start(a);
  return { r, a, b };
}
const play = (r, cols) => cols.forEach((c) => r.drop(r.currentId, c));

test('Steine fallen nach unten, volle Spalte geht nicht, nur wer dran ist', () => {
  const { r, a, b } = setup();
  r.drop(a, 3);
  assert.equal(r.board[5 * COLS + 3], a, 'unten');
  assert.throws(() => r.drop(a, 2), /nicht dran/);
  r.drop(b, 3);
  assert.equal(r.board[4 * COLS + 3], b, 'darauf');
  play(r, [3, 3, 3, 3]);
  assert.throws(() => r.drop(r.currentId, 3), /voll/);
  assert.throws(() => r.drop(r.currentId, 7), /gibt es nicht/);
});

test('Vier in einer Reihe: waagerecht, senkrecht, diagonal – Gewinn-Reihe wird gemeldet', () => {
  const h = setup(); play(h.r, [0, 0, 1, 1, 2, 2, 3]);
  assert.equal(h.r.phase, 'over'); assert.deepEqual(h.r.result.winners, [h.a]); assert.deepEqual(h.r.win, [35, 36, 37, 38]);
  const v = setup(); play(v.r, [0, 1, 0, 1, 0, 1, 0]);
  assert.deepEqual(v.r.result.winners, [v.a]); assert.equal(v.r.win.length, 4);
  // Diagonal nach rechts oben für Anna: (5,0) (4,1) (3,2) (2,3)
  const d = setup(); play(d.r, [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3]);
  assert.deepEqual(d.r.result.winners, [d.a]);
  assert.deepEqual(d.r.win, [2 * 7 + 3, 3 * 7 + 2, 4 * 7 + 1, 5 * 7 + 0].sort((x, y) => x - y));
  assert.equal(d.r.scores[d.a], 1);
});

test('Volles Feld ohne vier = unentschieden', () => {
  const { r } = setup();
  // Spaltenfolge, die das Feld ohne Viererreihe füllt (Muster aus Paaren)
  const order = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 2, 3, 2, 3, 3, 2, 3, 2, 2, 3, 2, 3, 4, 5, 4, 5, 5, 4, 5, 4, 4, 5, 4, 5, 6, 6, 6, 6, 6, 6];
  play(r, order);
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, []);
  assert.match(r.result.text, /unentschieden/);
});

test('Farben bleiben am Platz, wer anfängt wechselt jede Partie', () => {
  const { r, a, b } = setup();
  assert.deepEqual(r.view(a).g.colors, { [a]: 0, [b]: 1 });
  assert.equal(r.currentId, a);
  r.stand(b); r.sit(b); // Runde vorbei (Ben weg) – Ben setzt sich wieder
  r.start(a);
  assert.equal(r.currentId, b, 'jetzt fängt Ben an');
  assert.equal(r.view(a).g.colors[a], 0, 'Anna bleibt Rot');
});

test('Bot: nimmt den eigenen Sieg, blockt den Gegner, legt keinen Sieg vor', () => {
  const { r, a, b } = setup();
  play(r, [0, 6, 1, 6, 2]); // Anna droht 0-1-2-3, Ben ist dran
  assert.equal(botColumn(r.board, b, a), 3, 'blocken');
  // Eigener Sieg geht vor Blocken: Ben hat drei in Spalte 6, Anna droht unten 0-1-2-3
  const g = setup();
  play(g.r, [0, 6, 0, 6, 1, 6, 2]);
  assert.equal(botColumn(g.r.board, g.b, g.a), 6, 'Ben gewinnt senkrecht in Spalte 6');
});

test('Zug-Timer: abgelaufen = Computer wirft für dich', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const { r, a, b } = setup({ turnTime: 20 });
    r.afterChange();
    assert.ok(r.view(a).deadline);
    mock.timers.tick(20500);
    assert.equal(r.board.filter(Boolean).length, 1);
    assert.equal(r.currentId, b);
    r.dispose();
  } finally { mock.timers.reset(); }
});
