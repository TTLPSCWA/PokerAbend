// Dame (deutsche Regeln) – 8 × 8, zwölf Steine je Spieler auf den dunklen Feldern, genau 2 Spieler. Weiß (wer anfängt) zieht zuerst nach oben.
// Gewöhnliche Steine ziehen ein Feld diagonal vorwärts, schlagen aber auch rückwärts, indem sie einen Gegner überspringen.
// Es gibt Schlagzwang, und ein Sprung, nach dem weitere Sprünge mit demselben Stein möglich sind, muss weitergeführt werden.
// Erreicht ein Stein die letzte Reihe, wird er zur Dame (der Zug endet dort). Damen ziehen und schlagen diagonal beliebig weit.
// Wer keinen Stein mehr hat oder nicht ziehen kann, verliert. Nach 50 Zügen ohne Schlag und ohne Steinzug ist es unentschieden.
// Ein Teilzug ist ein Sprung oder ein Schritt: bei Mehrfachsprüngen schickt der Browser jeden Sprung einzeln.
import { TurnRoom } from '../../server/turn-room.js';

export const SIZE = 8;
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export const cellName = (i) => `${'abcdefgh'[i % SIZE]}${SIZE - Math.floor(i / SIZE)}`;
const isKing = (p) => p === p.toUpperCase();
const colorOf = (p) => p.toLowerCase();
const at = (r, c) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? r * SIZE + c : -1);

export function startBoard() {
  const b = Array(SIZE * SIZE).fill(null);
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) { if (r < 3) b[r * SIZE + c] = 'b'; else if (r > 4) b[r * SIZE + c] = 'w'; }
  return b;
}
// Sprünge eines Steins: [{ to, over }]
export function jumps(board, pos, piece) {
  const me = colorOf(piece), r0 = Math.floor(pos / SIZE), c0 = pos % SIZE, out = [];
  for (const [dr, dc] of DIAG) {
    let r = r0 + dr, c = c0 + dc;
    if (isKing(piece)) while (at(r, c) >= 0 && board[at(r, c)] === null) { r += dr; c += dc; }
    const o = at(r, c);
    if (o < 0 || board[o] === null || colorOf(board[o]) === me) continue;
    let lr = r + dr, lc = c + dc;
    while (at(lr, lc) >= 0 && board[at(lr, lc)] === null) {
      out.push({ to: at(lr, lc), over: o });
      if (!isKing(piece)) break;
      lr += dr; lc += dc;
    }
  }
  return out;
}
export function slides(board, pos, piece) {
  const me = colorOf(piece), r0 = Math.floor(pos / SIZE), c0 = pos % SIZE, out = [];
  const fwd = me === 'w' ? -1 : 1;
  for (const [dr, dc] of DIAG) {
    if (!isKing(piece) && dr !== fwd) continue;
    let r = r0 + dr, c = c0 + dc;
    while (at(r, c) >= 0 && board[at(r, c)] === null) { out.push({ to: at(r, c), over: null }); if (!isKing(piece)) break; r += dr; c += dc; }
  }
  return out;
}
// Erlaubte Teilzüge für eine Farbe: { von: [{to, over}] } – mit Schlagzwang; chain = Stein, der weiterspringen muss
export function legal(board, color, chain = null) {
  const res = {};
  const pieces = board.map((p, i) => [p, i]).filter(([p, i]) => p && colorOf(p) === color && (chain === null || i === chain));
  for (const [p, i] of pieces) { const j = jumps(board, i, p); if (j.length) res[i] = j; }
  if (Object.keys(res).length || chain !== null) return res;
  for (const [p, i] of pieces) { const s = slides(board, i, p); if (s.length) res[i] = s; }
  return res;
}

// Computer: Schlagen vor allem, dann Dame werden, keinen Stein einstellen, sonst zufällig
export function botMove(board, color, chain, rng = Math.random) {
  const L = legal(board, color, chain);
  const foe = color === 'w' ? 'b' : 'w';
  let best = null;
  for (const [from, list] of Object.entries(L)) {
    for (const m of list) {
      const b2 = [...board];
      const piece = b2[from];
      b2[m.to] = piece; b2[from] = null; if (m.over !== null) b2[m.over] = null;
      let v = rng() * 3 + (m.over !== null ? 10 : 0);
      const promo = !isKing(piece) && ((color === 'w' && Math.floor(m.to / SIZE) === 0) || (color === 'b' && Math.floor(m.to / SIZE) === SIZE - 1));
      if (promo) v += 6;
      if (!isKing(piece)) v += (color === 'w' ? SIZE - Math.floor(m.to / SIZE) : Math.floor(m.to / SIZE)) * 0.3;
      if (Object.keys(legal(b2, foe)).some((f) => legal(b2, foe)[f].some((x) => x.over === m.to))) v -= 7; // würde geschlagen
      if (!best || v > best.v) best = { v, from: Number(from), to: m.to };
    }
  }
  return best;
}

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 }];
  defaultSettings() { return { turnTime: 90 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.board = startBoard(); this.colors = {}; this.chain = null; this.last = null; this.quiet = 0;
  }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Dame spielen genau zwei'); }
  foe(id) { return this.order.find((p) => p !== id); }
  color(id) { return this.colors[id] === 0 ? 'w' : 'b'; }
  count(id) { const c = this.color(id); return this.board.filter((p) => p && colorOf(p) === c).length; }

  setupRound() {
    this.board = startBoard();
    const [w, b] = this.order;
    this.colors = { [w]: 0, [b]: 1 }; // 0 = Weiß (unten, fängt an), 1 = Schwarz
    this.chain = null; this.last = null; this.quiet = 0;
    this.say(`${this.name(w)} spielt Weiß und fängt an`, 'cards');
  }
  options(id) { return legal(this.board, this.color(id), this.chain); }

  move(id, from, to) {
    this.requireTurn(id);
    from = Number(from); to = Number(to);
    const L = this.options(id);
    const m = (L[from] || []).find((x) => x.to === to);
    if (!m) throw new Error(Object.keys(L).length && Object.values(L).some((l) => l.some((x) => x.over !== null)) ? 'Es besteht Schlagzwang – spring über einen Gegner' : 'Dieser Zug ist nicht erlaubt');
    const piece = this.board[from];
    const me = this.color(id);
    this.board[from] = null;
    const promo = !isKing(piece) && ((me === 'w' && Math.floor(to / SIZE) === 0) || (me === 'b' && Math.floor(to / SIZE) === SIZE - 1));
    this.board[to] = promo ? piece.toUpperCase() : piece;
    if (m.over !== null) this.board[m.over] = null;
    this.last = { from, to, over: m.over };
    if (m.over !== null || !isKing(piece)) this.quiet = 0; else this.quiet++;
    this.say(`${this.name(id)} ${m.over !== null ? 'schlägt' : 'zieht'} ${cellName(from)} → ${cellName(to)}${promo ? ' und wird Dame' : ''}`, 'info', 'action');
    this.act(id, `${m.over !== null ? 'schlägt' : 'zieht'} ${cellName(to)}${promo ? ' ♛' : ''}`, { from, to, over: m.over });
    // Weiterspringen mit demselben Stein?
    if (m.over !== null && !promo && jumps(this.board, to, this.board[to]).length) { this.chain = to; return; }
    this.chain = null;
    const foe = this.foe(id);
    if (!Object.keys(legal(this.board, this.color(foe))).length) {
      return this.finishRound([id], `${this.name(id)} gewinnt – ${this.name(foe)} kann nicht mehr ziehen`, { [id]: 1 });
    }
    if (this.quiet >= 50) return this.finishRound([], 'Unentschieden – 50 Züge ohne Schlag und ohne Steinzug');
    this.next(1);
  }
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam – der Computer zieht`, 'warn');
    const m = botMove(this.board, this.color(id), this.chain);
    this.move(id, m.from, m.to);
  }

  publicPlayer(p) { return { color: this.colors[p.id] ?? null, pieces: this.order.includes(p.id) ? this.count(p.id) : 0 }; }
  gameView(viewerId) {
    const mine = this.phase === 'playing' && this.currentId === viewerId;
    return {
      board: [...this.board], colors: { ...this.colors }, last: this.last, chain: this.chain,
      legal: mine ? Object.fromEntries(Object.entries(this.options(viewerId)).map(([f, l]) => [f, l.map((m) => m.to)])) : {},
      mustJump: mine && Object.values(this.options(viewerId)).some((l) => l.some((m) => m.over !== null)),
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
