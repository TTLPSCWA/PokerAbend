import { TurnRoom } from '../../server/turn-room.js';
export const adjacent = (cell, size) => {
  const r = Math.floor(cell / size), c = cell % size;
  return [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]].map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && a < size && b >= 0 && b < size).map(([a, b]) => a * size + b);
};
export function connection(board, size, color) {
  const starts = board.flatMap((v, i) => v === color && (color === 0 ? i < size : i % size === 0) ? [i] : []), parent = new Map(starts.map((i) => [i, null]));
  for (const cell of starts) {
    if (color === 0 ? Math.floor(cell / size) === size - 1 : cell % size === size - 1) {
      const path = []; for (let i = cell; i !== null; i = parent.get(i)) path.push(i); return path.reverse();
    }
    for (const next of adjacent(cell, size)) if (board[next] === color && !parent.has(next)) { parent.set(next, cell); starts.push(next); }
  }
  return [];
}
// 0/1-Dijkstra: eigene Steine kosten 0, freie Felder 1, gegnerische sind gesperrt.
export function pathCost(board, size, color) {
  const distance = Array(board.length).fill(Infinity), used = new Set();
  for (let i = 0; i < size; i++) { const p = color === 0 ? i : i * size; if (board[p] !== 1 - color) distance[p] = board[p] === color ? 0 : 1; }
  for (let k = 0; k < board.length; k++) {
    let cell = -1; for (let i = 0; i < board.length; i++) if (!used.has(i) && (cell < 0 || distance[i] < distance[cell])) cell = i;
    if (cell < 0 || !Number.isFinite(distance[cell])) break;
    if (color === 0 ? Math.floor(cell / size) === size - 1 : cell % size === size - 1) return distance[cell];
    used.add(cell);
    for (const next of adjacent(cell, size)) if (board[next] !== 1 - color) distance[next] = Math.min(distance[next], distance[cell] + (board[next] === color ? 0 : 1));
  }
  return size * size;
}
export function botCell(board, size, color, rng = Math.random) {
  const free = board.flatMap((v, i) => v === null ? [i] : []);
  for (const side of [color, 1 - color]) for (const cell of free) {
    const next = [...board]; next[cell] = side; if (connection(next, size, side).length) return cell;
  }
  // Auf großen Brettern zuerst die Nachbarschaft der bestehenden Steine betrachten.
  const near = new Set(board.flatMap((v, i) => v === null ? [] : adjacent(i, size)));
  const choices = free.length > 60 && near.size ? free.filter((i) => near.has(i)) : free;
  let best = null;
  for (const cell of choices) {
    const next = [...board]; next[cell] = color;
    const r = Math.floor(cell / size), c = cell % size;
    const score = -pathCost(next, size, color) * 8 + pathCost(next, size, 1 - color) * 5 - (Math.abs(r - size / 2) + Math.abs(c - size / 2)) * .1 + rng() * .3;
    if (!best || score > best.score) best = { cell, score };
  }
  return best?.cell ?? null;
}
export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'size', label: 'Brettgröße', type: 'select', values: [{ value: '11', label: '11 × 11' }, { value: '9', label: '9 × 9' }] },
    { key: 'swap', label: 'Tauschregel nach dem ersten Stein', type: 'bool' },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { size: '11', swap: true, turnTime: 60 }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, scoreLabel: 'Siege', winPoints: 1 }); this.board = []; this.colors = {}; this.path = []; this.placements = 0; this.swapped = false; this.last = null; }
  setupRound() { this.size = Number(this.settings.size); this.board = Array(this.size ** 2).fill(null); this.colors = Object.fromEntries(this.order.map((id, i) => [id, i])); this.path = []; this.placements = 0; this.swapped = false; this.last = null; }
  canSwap(id) { return this.settings.swap && !this.swapped && this.placements === 1 && id === this.order[1] && this.currentId === id; }
  place(id, cell) {
    this.requireTurn(id);
    if (!Number.isInteger(cell) || cell < 0 || cell >= this.board.length || this.board[cell] !== null) throw new Error('Wähle ein freies Hex-Feld');
    this.board[cell] = this.colors[id]; this.last = cell; this.placements++;
    this.act(id, `${String.fromCharCode(65 + cell % this.size)}${Math.floor(cell / this.size) + 1}`);
    this.path = connection(this.board, this.size, this.colors[id]);
    if (this.path.length) this.finishRound([id], `${this.name(id)} verbindet beide Ränder und gewinnt.`, { [id]: 1 }); else this.next();
  }
  swapSides(id) {
    this.requireTurn(id);
    if (!this.canSwap(id)) throw new Error('Die Tauschregel ist jetzt nicht verfügbar');
    for (const p of this.order) this.colors[p] = 1 - this.colors[p];
    this.swapped = true; this.act(id, 'tauscht die Seiten'); this.next();
  }
  onTimeout(id) { this.place(id, botCell(this.board, this.size, this.colors[id])); }
  onDropOut(p) { const winner = this.order.find((id) => id !== p.id); if (winner) this.finishRound([winner], `${this.name(winner)} gewinnt durch Aufgabe.`, { [winner]: 1 }); }
  publicPlayer(p) { return { color: this.colors[p.id] ?? null }; }
  gameView(id) { return { board: [...this.board], size: this.size, colors: { ...this.colors }, path: [...this.path], last: this.last, canSwap: this.phase === 'playing' && this.canSwap(id), legal: this.phase === 'playing' && this.currentId === id ? this.board.flatMap((v, i) => v === null ? [i] : []) : [] }; }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
