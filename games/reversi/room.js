// Reversi – 8 × 8, Gegner einschließen und umdrehen (genau 2 Spieler). Schwarz (der, der anfängt) setzt zuerst.
// Ein Stein muss so gesetzt werden, dass in mindestens einer Richtung (waagerecht, senkrecht, diagonal) eine Reihe gegnerischer Steine
// zwischen ihm und einem eigenen Stein liegt; diese Steine werden umgedreht. Wer nicht setzen kann, muss passen (das macht der Server von selbst).
// Kann keiner mehr setzen oder ist das Brett voll, gewinnt, wem mehr Steine gehören.
import { TurnRoom } from '../../server/turn-room.js';

export const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export const cellName = (i) => `${'ABCDEFGH'[i % SIZE]}${Math.floor(i / SIZE) + 1}`;

// Steine, die beim Setzen auf cell umgedreht würden (leer = Zug nicht erlaubt)
export function flips(board, cell, me) {
  if (board[cell] !== null) return [];
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] !== null && board[r * SIZE + c] !== me) { line.push(r * SIZE + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r * SIZE + c] === me) out.push(...line);
  }
  return out;
}
export const legalMoves = (board, me) => board.map((_, i) => i).filter((i) => flips(board, i, me).length);

// Computer: Ecken wertvoll, Felder neben den Ecken gefährlich, Kanten gut, dazu Umdrehen und etwas Zufall
const WEIGHT = (() => {
  const w = Array(64).fill(0);
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), c = i % 8;
    const er = Math.min(r, 7 - r), ec = Math.min(c, 7 - c);
    if (er === 0 && ec === 0) w[i] = 100;
    else if (er <= 1 && ec <= 1 && !(er === 0 || ec === 0)) w[i] = -30; // X-Felder
    else if ((er === 0 && ec === 1) || (er === 1 && ec === 0)) w[i] = -8; // C-Felder
    else if (er === 0 || ec === 0) w[i] = 6;
  }
  return w;
})();
export function botMove(board, me, rng = Math.random) {
  const moves = legalMoves(board, me);
  if (!moves.length) return null;
  let best = null;
  for (const m of moves) {
    const v = WEIGHT[m] + flips(board, m, me).length + rng() * 4;
    if (!best || v > best.v) best = { m, v };
  }
  return best.m;
}

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 }];
  defaultSettings() { return { turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.board = Array(SIZE * SIZE).fill(null); this.colors = {}; this.last = null; this.flipped = [];
  }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Reversi spielen genau zwei'); }
  foe(id) { return this.order.find((p) => p !== id); }

  setupRound() {
    this.board = Array(SIZE * SIZE).fill(null);
    const [b, w] = this.order;
    this.colors = { [b]: 0, [w]: 1 }; // 0 = Schwarz, 1 = Weiß: wer anfängt, ist Schwarz
    this.board[3 * 8 + 3] = w; this.board[4 * 8 + 4] = w; this.board[3 * 8 + 4] = b; this.board[4 * 8 + 3] = b;
    this.last = null; this.flipped = [];
    this.say(`${this.name(b)} spielt Schwarz und fängt an`, 'cards');
  }
  count(id) { return this.board.filter((x) => x === id).length; }

  place(id, cell) {
    this.requireTurn(id);
    cell = Number(cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= 64) throw new Error('Dieses Feld gibt es nicht');
    const f = flips(this.board, cell, id);
    if (!f.length) throw new Error('Dort kannst du nichts einschließen');
    this.board[cell] = id;
    for (const i of f) this.board[i] = id;
    this.last = cell; this.flipped = f;
    this.say(`${this.name(id)} setzt auf ${cellName(cell)} und dreht ${f.length} Stein${f.length === 1 ? '' : 'e'}`, 'info', 'action');
    this.act(id, `${cellName(cell)} (+${f.length})`);
    const foe = this.foe(id);
    if (legalMoves(this.board, foe).length) return this.next(1);
    if (legalMoves(this.board, id).length) {
      this.say(`${this.name(foe)} kann nicht setzen und muss passen`, 'warn');
      this.act(foe, 'passt');
      return; // derselbe Spieler ist nochmal dran
    }
    this.finish();
  }
  finish() {
    const [a, b] = this.order;
    const ca = this.count(a), cb = this.count(b);
    const text = `${this.name(a)} ${ca} : ${cb} ${this.name(b)}`;
    if (ca === cb) return this.finishRound([], `Unentschieden – ${text}`);
    const w = ca > cb ? a : b;
    this.finishRound([w], `${this.name(w)} gewinnt – ${text}`, { [w]: 1 });
  }
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam – der Computer setzt`, 'warn');
    this.place(id, botMove(this.board, id));
  }

  publicPlayer(p) { return { color: this.colors[p.id] ?? null, discs: this.order.includes(p.id) ? this.count(p.id) : 0 }; }
  gameView(viewerId) {
    return {
      board: [...this.board], colors: { ...this.colors }, last: this.last, flipped: [...this.flipped],
      legal: this.phase === 'playing' && this.currentId === viewerId ? legalMoves(this.board, viewerId) : [],
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
