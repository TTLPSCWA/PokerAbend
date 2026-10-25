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
export function winLine(board, r, c, who) {
  for (const [dr, dc] of DIRS) {
    const line = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr * COLS + cc] === who) { line.push([rr, cc]); rr += dr * s; cc += dc * s; }
    }
    if (line.length >= 4) return line.map(([a, b]) => a * COLS + b).sort((x, y) => x - y);
  }
  return null;
}
// Einfache Strategie: eigenen Sieg nehmen, gegnerischen Sieg verhindern, keinen Sieg vorlegen, sonst Mitte bevorzugen
export function botColumn(board, me, foe, rng = Math.random) {
  const free = [...Array(COLS).keys()].filter((c) => landing(board, c) >= 0);
  const winsWith = (who) => free.find((c) => { const r = landing(board, c); const b = [...board]; b[r * COLS + c] = who; return winLine(b, r, c, who); });
  const win = winsWith(me); if (win !== undefined) return win;
  const block = winsWith(foe); if (block !== undefined) return block;
  // Nicht in eine Spalte legen, über der der Gegner dann gewinnt
  const safe = free.filter((c) => {
    const r = landing(board, c);
    if (r <= 0) return true;
    const b = [...board]; b[r * COLS + c] = me; b[(r - 1) * COLS + c] = foe;
    return !winLine(b, r - 1, c, foe);
  });
  const pool = safe.length ? safe : free;
  const weight = (c) => 4 - Math.abs(3 - c) + rng() * 2.5;
  return pool.sort((a, b) => weight(b) - weight(a))[0];
}

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 }];
  defaultSettings() { return { turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.board = Array(COLS * ROWS).fill(null);
    this.win = null; this.last = null; this.colors = {};
  }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Vier gewinnt spielen genau zwei'); }
  setupRound() {
    this.board = Array(COLS * ROWS).fill(null);
    this.win = null; this.last = null;
    // Farbe nach Sitzplatz (Rot = wer zuerst saß), unabhängig davon, wer anfängt
    const bySeat = this.seats.filter((id) => this.order.includes(id));
    this.colors = Object.fromEntries(bySeat.map((id, i) => [id, i]));
    this.say(`${this.name(this.order[0])} fängt an`, 'cards');
  }

  drop(id, col) {
    this.requireTurn(id);
    const c = Number(col);
    if (!Number.isInteger(c) || c < 0 || c >= COLS) throw new Error('Diese Spalte gibt es nicht');
    const r = landing(this.board, c);
    if (r < 0) throw new Error('Die Spalte ist voll');
    this.board[r * COLS + c] = id;
    this.last = r * COLS + c;
    this.act(id, `Spalte ${c + 1}`);
    this.say(`${this.name(id)} wirft in Spalte ${c + 1}`, 'info', 'action');
    const line = winLine(this.board, r, c, id);
    if (line) {
      this.win = line;
      this.act(id, 'Vier gewinnt!');
      return this.finishRound([id], `${this.name(id)} hat vier in einer Reihe und gewinnt!`, { [id]: 1 });
    }
    if (this.board.every((x) => x !== null)) return this.finishRound([], 'Das Feld ist voll – unentschieden');
    this.next(1);
  }
  onTimeout(id) {
    const foe = this.order.find((p) => p !== id);
    this.say(`${this.name(id)} war zu langsam – der Computer wirft`, 'warn');
    this.drop(id, botColumn(this.board, id, foe));
  }

  publicPlayer(p) { return { color: this.colors[p.id] ?? null }; }
  gameView() {
    return { board: [...this.board], colors: { ...this.colors }, win: this.win, last: this.last, cols: COLS, rows: ROWS };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
