// Vier gewinnt – Brettspiel für genau 2 (weitere schauen zu). Regeln:
// 7 Spalten × 6 Reihen, Steine fallen nach unten. Abwechselnd eine Spalte wählen.
// Wer zuerst 4 in einer Reihe hat (waagerecht, senkrecht oder diagonal), gewinnt. Volles Feld ohne Sieger = unentschieden.
// Wer anfängt, wechselt jede Partie (macht die Plattform). Farben bleiben am Platz: wer zuerst saß, spielt Rot.
// Zeit pro Zug über den Zug-Timer – läuft sie ab, zieht der Computer (wie der Bot).
import { TurnRoom } from '../../server/turn-room.js';

export const COLS = 7, ROWS = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// Freie Reihe in einer Spalte (von unten) – oder -1, wenn voll. board[r * COLS + c], Reihe 0 = oben
export const landing = (board, c) => { for (let r = ROWS - 1; r >= 0; r--) if (board[r * COLS + c] === null) return r; return -1; };
// Gewinn-Reihe durch das Feld (r, c) für diesen Spieler – oder null
export function winLine(board, r, c, who, cols = COLS, rows = ROWS, need = 4) {
  for (const [dr, dc] of DIRS) {
    const line = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < rows && cc >= 0 && cc < cols && board[rr * cols + cc] === who) { line.push([rr, cc]); rr += dr * s; cc += dc * s; }
    }
    if (line.length >= need) return line.map(([a, b]) => a * cols + b).sort((x, y) => x - y);
  }
  return null;
}
// Strategie: vier Züge vorausrechnen (Sieg nehmen, Sieg verhindern, keine Zwickmühle zulassen),
// sonst Reihen mit vielen eigenen Steinen und die Mitte bevorzugen. Etwas Zufall bei gleich guten Spalten.
const WINDOWS = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of DIRS) {
  const cells = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
  if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS)) WINDOWS.push(cells.map(([rr, cc]) => rr * COLS + cc));
}
function rate(board, me, foe) {
  let v = 0;
  for (let r = 0; r < ROWS; r++) { const x = board[r * COLS + 3]; if (x === me) v += 3; else if (x === foe) v -= 3; }
  for (const w of WINDOWS) {
    let m = 0, f = 0;
    for (const i of w) { if (board[i] === me) m++; else if (board[i] === foe) f++; }
    if (m && f) continue;
    if (m === 3) v += 12; else if (m === 2) v += 3;
    if (f === 3) v -= 14; else if (f === 2) v -= 3;
  }
  return v;
}
const ORDER = [3, 2, 4, 1, 5, 0, 6];
function search(board, depth, me, foe, alpha, beta) {
  if (depth === 0) return rate(board, me, foe);
  let any = false;
  for (const c of ORDER) {
    const r = landing(board, c);
    if (r < 0) continue;
    any = true;
    board[r * COLS + c] = me;
    const v = winLine(board, r, c, me) ? 10000 + depth : -search(board, depth - 1, foe, me, -beta, -alpha);
    board[r * COLS + c] = null;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return any ? alpha : 0;
}
export function botColumn(board, me, foe, rng = Math.random, depth = 5) {
  const b = [...board];
  let best = null;
  for (const c of ORDER) {
    const r = landing(b, c);
    if (r < 0) continue;
    b[r * COLS + c] = me;
    // Fenster knapp unter der besten Spalte: fast gleich gute Spalten werden noch genau bewertet und per Zufall gemischt
    const floor = best ? best.raw - 4 : -Infinity;
    const raw = winLine(b, r, c, me) ? 100000 : -search(b, depth - 1, foe, me, -Infinity, -floor);
    b[r * COLS + c] = null;
    const v = raw + rng() * 4;
    if (!best || v > best.v) best = { c, v, raw: Math.max(raw, best?.raw ?? -Infinity) };
  }
  return best.c;
}

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 }];
  defaultSettings() { return { turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.board = Array(COLS * ROWS).fill(null);
    this.win = null; this.last = null; this.colors = {};
    this.cols = this.variant === 'five' ? 9 : COLS; this.rows = ROWS; this.need = this.variant === 'five' ? 5 : 4;
  }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Vier gewinnt spielen genau zwei'); }
  setupRound() {
    this.board = Array(this.cols * this.rows).fill(null);
    this.win = null; this.last = null;
    // Farbe nach Sitzplatz (Rot = wer zuerst saß), unabhängig davon, wer anfängt
    const bySeat = this.seats.filter((id) => this.order.includes(id));
    this.colors = Object.fromEntries(bySeat.map((id, i) => [id, i]));
    this.say(`${this.name(this.order[0])} fängt an`, 'cards');
  }

  drop(id, col) {
    this.requireTurn(id);
    const c = Number(col);
    if (!Number.isInteger(c) || c < 0 || c >= this.cols) throw new Error('Diese Spalte gibt es nicht');
    const r = this.landing(c);
    if (r < 0) throw new Error('Die Spalte ist voll');
    this.board[r * this.cols + c] = id;
    this.last = r * this.cols + c;
    this.act(id, `Spalte ${c + 1}`);
    this.say(`${this.name(id)} wirft in Spalte ${c + 1}`, 'info', 'action');
    const line = winLine(this.board, r, c, id, this.cols, this.rows, this.need);
    if (line) {
      this.win = line;
      this.act(id, 'Vier gewinnt!');
      return this.finishRound([id], `${this.name(id)} hat ${this.need} in einer Reihe und gewinnt!`, { [id]: 1 });
    }
    if (this.variant !== 'pop-out' && this.board.every((x) => x !== null)) return this.finishRound([], 'Das Feld ist voll – unentschieden');
    this.next(1);
  }
  landing(col, board = this.board) { for (let r = this.rows - 1; r >= 0; r--) if (board[r * this.cols + col] === null) return r; return -1; }
  lineFor(id, board = this.board) { for (let i = 0; i < board.length; i++) if (board[i] === id) { const line = winLine(board, Math.floor(i / this.cols), i % this.cols, id, this.cols, this.rows, this.need); if (line) return line; } return null; }
  pop(id, col) {
    this.requireTurn(id); col = Number(col);
    if (this.variant !== 'pop-out' || !Number.isInteger(col) || col < 0 || col >= this.cols || this.board[(this.rows - 1) * this.cols + col] !== id) throw new Error('Nur den eigenen untersten Stein herausziehen');
    for (let r = this.rows - 1; r > 0; r--) this.board[r * this.cols + col] = this.board[(r - 1) * this.cols + col];
    this.board[col] = null; this.last = null; this.act(id, `zieht unten aus Spalte ${col + 1}`);
    // Der eigene Zug hat Vorrang, falls beide Farben gleichzeitig eine Reihe bekommen.
    for (const who of [id, ...this.order.filter((p) => p !== id)]) { const line = this.lineFor(who); if (line) { this.win = line; return this.finishRound([who], `${this.name(who)} gewinnt nach dem Herausziehen`, { [who]: 1 }); } }
    this.next();
  }
  variantBot(id, rng = Math.random) {
    const foe = this.order.find((p) => p !== id), actions = [];
    for (let c = 0; c < this.cols; c++) {
      const r = this.landing(c);
      if (r >= 0) actions.push({ c, pop: false, board: this.board.map((v, i) => i === r * this.cols + c ? id : v) });
      if (this.variant === 'pop-out' && this.board[(this.rows - 1) * this.cols + c] === id) { const board = [...this.board]; for (let r = this.rows - 1; r > 0; r--) board[r * this.cols + c] = board[(r - 1) * this.cols + c]; board[c] = null; actions.push({ c, pop: true, board }); }
    }
    const rank = (a) => {
      if (this.lineFor(id, a.board)) return 100000;
      if (this.lineFor(foe, a.board)) return -100000;
      let risk = 0;
      for (let c = 0; c < this.cols; c++) { const r = this.landing(c, a.board); if (r < 0) continue; const b = [...a.board]; b[r * this.cols + c] = foe; if (this.lineFor(foe, b)) risk += 1000; }
      return -risk - Math.abs(a.c - (this.cols - 1) / 2) - (a.pop ? 8 : 0) + rng();
    };
    const best = actions.map((a) => ({ ...a, value: rank(a) })).sort((a, b) => b.value - a.value)[0];
    if (!best) return this.finishRound([], 'Keine legalen Züge – unentschieden');
    return best.pop ? this.pop(id, best.c) : this.drop(id, best.c);
  }
  onTimeout(id) {
    if (this.variant !== 'classic') return this.variantBot(id);
    const foe = this.order.find((p) => p !== id);
    this.say(`${this.name(id)} war zu langsam – der Computer wirft`, 'warn');
    this.drop(id, botColumn(this.board, id, foe));
  }

  publicPlayer(p) { return { color: this.colors[p.id] ?? null }; }
  gameView(viewerId) {
    return { board: [...this.board], colors: { ...this.colors }, win: this.win, last: this.last, cols: this.cols, rows: this.rows, need: this.need,
      canPop: this.variant === 'pop-out' && this.currentId === viewerId ? Array.from({ length: this.cols }, (_, c) => c).filter((c) => this.board[(this.rows - 1) * this.cols + c] === viewerId) : [] };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
