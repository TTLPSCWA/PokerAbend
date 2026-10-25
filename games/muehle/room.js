// Mühle – Brettspiel für genau 2 (weitere schauen zu). Regeln (Standard):
// 24 Punkte auf drei Quadraten, je 9 Steine. Setzphase: abwechselnd einen Stein auf einen freien Punkt.
// Zugphase: einen eigenen Stein entlang einer Linie auf den benachbarten freien Punkt ziehen.
// Springphase (Hausregel, Standard an): mit nur noch 3 Steinen auf jeden freien Punkt springen.
// Neue Mühle (3 eigene in einer Linie) – auch beim Setzen –: einen gegnerischen Stein entfernen (bei zwei Mühlen auf einmal nur einen).
// Steine in einer Mühle sind geschützt, außer alle gegnerischen Steine stehen in Mühlen.
// Verloren: nur noch 2 Steine oder kein Zug mehr möglich. Unentschieden: 50 Züge ohne Schlagen (einstellbar, 0 = aus) oder dreimal dieselbe Stellung.
import { TurnRoom } from '../../server/turn-room.js';

// Punkte 0–23: außen 0–7, Mitte 8–15, innen 16–23, jeweils im Uhrzeigersinn ab oben links. Koordinaten auf einem 7 × 7-Raster.
export const XY = [
  [0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3],
  [1, 1], [3, 1], [5, 1], [5, 3], [5, 5], [3, 5], [1, 5], [1, 3],
  [2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3],
];
export const MILLS = [];
for (const r of [0, 8, 16]) for (const s of [0, 2, 4, 6]) MILLS.push([r + s, r + s + 1, r + ((s + 2) % 8)]);
for (const m of [1, 3, 5, 7]) MILLS.push([m, m + 8, m + 16]);
export const ADJ = XY.map(() => []);
const link = (a, b) => { ADJ[a].push(b); ADJ[b].push(a); };
for (const r of [0, 8, 16]) for (let k = 0; k < 8; k++) link(r + k, r + ((k + 1) % 8));
for (const m of [1, 3, 5, 7]) { link(m, m + 8); link(m + 8, m + 16); }

export const inMill = (board, p) => MILLS.some((m) => m.includes(p) && m.every((q) => board[q] === board[p] && board[p] !== null));
const millAt = (board, p, who) => MILLS.some((m) => m.includes(p) && m.every((q) => board[q] === who));

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'fly', label: 'Springen mit 3 Steinen', type: 'bool' },
    { key: 'drawLimit', label: 'Unentschieden nach so vielen Zügen ohne Schlagen (0 = aus)', type: 'number', min: 0, max: 200 },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { fly: true, drawLimit: 50, turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.board = Array(24).fill(null); this.hand = {}; this.colors = {};
    this.step = 'move'; this.quiet = 0; this.seen = new Map(); this.lastMove = null;
  }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Mühle spielen genau zwei'); }
  setupRound() {
    this.board = Array(24).fill(null);
    this.hand = Object.fromEntries(this.order.map((id) => [id, 9]));
    const bySeat = this.seats.filter((id) => this.order.includes(id));
    this.colors = Object.fromEntries(bySeat.map((id, i) => [id, i])); // 0 = Weiß (wer zuerst saß), 1 = Schwarz
    this.step = 'move'; this.quiet = 0; this.seen = new Map(); this.lastMove = null;
    this.say(`${this.name(this.order[0])} fängt an`, 'cards');
  }
  foe(id) { return this.order.find((p) => p !== id); }
  count(id) { return this.board.filter((x) => x === id).length; }
  flying(id) { return this.settings.fly && !this.hand[id] && this.count(id) === 3; }
  // Erlaubte Züge: { place: [Punkte] } in der Setzphase, sonst { moves: { von: [nach] } }
  legal(id) {
    if (this.hand[id] > 0) return { place: this.board.map((x, p) => (x === null ? p : -1)).filter((p) => p >= 0) };
    const free = this.board.map((x, p) => (x === null ? p : -1)).filter((p) => p >= 0);
    const moves = {};
    this.board.forEach((x, p) => {
      if (x !== id) return;
      const to = this.flying(id) ? free : ADJ[p].filter((q) => this.board[q] === null);
      if (to.length) moves[p] = to;
    });
    return { moves };
  }
  hasMove(id) { const l = this.legal(id); return l.place ? l.place.length > 0 : Object.keys(l.moves).length > 0; }
  removable(owner) {
    const stones = this.board.map((x, p) => (x === owner ? p : -1)).filter((p) => p >= 0);
    const free = stones.filter((p) => !inMill(this.board, p));
    return free.length ? free : stones;
  }

  place(id, p) {
    this.requireTurn(id);
    if (this.step !== 'move') throw new Error('Erst einen Stein entfernen');
    if (!(this.hand[id] > 0)) throw new Error('Du hast keine Steine mehr zum Setzen – jetzt wird gezogen');
    p = Number(p);
    if (!(p >= 0 && p < 24) || this.board[p] !== null) throw new Error('Der Punkt ist nicht frei');
    this.board[p] = id; this.hand[id]--;
    this.say(`${this.name(id)} setzt`, 'info', 'action');
    this.after(id, null, p);
  }
  move(id, from, to) {
    this.requireTurn(id);
    if (this.step !== 'move') throw new Error('Erst einen Stein entfernen');
    if (this.hand[id] > 0) throw new Error('Erst alle Steine setzen');
    from = Number(from); to = Number(to);
    if (this.board[from] !== id) throw new Error('Das ist nicht dein Stein');
    if (!(to >= 0 && to < 24) || this.board[to] !== null) throw new Error('Der Punkt ist nicht frei');
    if (!this.flying(id) && !ADJ[from].includes(to)) throw new Error('Nur entlang der Linie auf den Nachbarpunkt');
    this.board[from] = null; this.board[to] = id;
    this.say(`${this.name(id)} ${this.flying(id) ? 'springt' : 'zieht'}`, 'info', 'action');
    this.after(id, from, to);
  }
  // Nach Setzen/Ziehen: neue Mühle → erst entfernen, sonst ist der andere dran
  after(id, from, to) {
    this.lastMove = { by: id, from, to, removed: null };
    if (millAt(this.board, to, id) && this.count(this.foe(id)) > 0) {
      this.step = 'remove';
      this.say(`${this.name(id)} hat eine Mühle!`, 'react');
      this.act(id, 'Mühle!');
      return;
    }
    this.act(id, from === null ? 'setzt' : 'zieht');
    this.endTurn(id, false);
  }
  // Stein schlagen (heißt nicht remove – das ist in BaseRoom das Entfernen eines Spielers)
  capture(id, p) {
    this.requireTurn(id);
    if (this.step !== 'remove') throw new Error('Gerade gibt es nichts zu schlagen');
    const foe = this.foe(id);
    p = Number(p);
    if (this.board[p] !== foe) throw new Error('Dort steht kein gegnerischer Stein');
    if (!this.removable(foe).includes(p)) throw new Error('Steine in einer Mühle sind geschützt');
    this.board[p] = null;
    this.step = 'move';
    this.lastMove = { ...this.lastMove, removed: p };
    this.say(`${this.name(id)} nimmt einen Stein von ${this.name(foe)}`, 'react');
    this.act(id, 'schlägt');
    if (this.hand[foe] + this.count(foe) < 3) {
      return this.finishRound([id], `${this.name(foe)} hat nur noch 2 Steine – ${this.name(id)} gewinnt!`, { [id]: 1 });
    }
    this.endTurn(id, true);
  }

  endTurn(id, captured) {
    const placing = this.order.some((p) => this.hand[p] > 0);
    if (captured) this.quiet = 0;
    else if (!placing) this.quiet++;
    const limit = this.settings.drawLimit;
    if (limit && this.quiet >= limit) return this.finishRound([], `${limit} Züge ohne Schlagen – unentschieden`);
    this.next(1);
    const cur = this.currentId;
    if (!this.hasMove(cur)) return this.finishRound([id], `${this.name(cur)} kann nicht mehr ziehen – ${this.name(id)} gewinnt!`, { [id]: 1 });
    // Dreimal dieselbe Stellung (mit demselben am Zug) = unentschieden – nur nach der Setzphase
    if (!placing) {
      const key = `${this.board.map((x) => (x === null ? '.' : this.colors[x])).join('')}:${this.colors[cur]}`;
      const n = (this.seen.get(key) || 0) + 1;
      this.seen.set(key, n);
      if (n >= 3) return this.finishRound([], 'Dreimal dieselbe Stellung – unentschieden');
    }
  }

  // Zeit abgelaufen: der Computer spielt den Zug (und schlägt, wenn er dabei eine Mühle schließt)
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam – der Computer zieht`, 'warn');
    botMove(this, id, Math.random);
    if (this.phase === 'playing' && this.currentId === id && this.step === 'remove') botMove(this, id, Math.random);
  }

  publicPlayer(p) {
    if (!(p.id in this.hand)) return { color: null };
    return { color: this.colors[p.id], hand: this.hand[p.id], stones: this.count(p.id), flying: this.flying(p.id) };
  }
  gameView(viewerId) {
    const cur = this.currentId;
    const mine = cur === viewerId && this.phase === 'playing';
    return {
      board: [...this.board], colors: { ...this.colors }, inHand: { ...this.hand }, step: this.step, // Steine noch zum Setzen (öffentlich)
      mills: MILLS.filter((m) => this.board[m[0]] !== null && m.every((q) => this.board[q] === this.board[m[0]])),
      lastMove: this.lastMove, quiet: this.quiet, drawLimit: this.settings.drawLimit,
      // Erlaubte Züge bzw. schlagbare Steine – nur für den, der dran ist
      legal: mine && this.step === 'move' ? this.legal(viewerId) : null,
      removable: mine && this.step === 'remove' ? this.removable(this.foe(viewerId)) : null,
      flying: cur ? this.flying(cur) : false,
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}

// Strategie: jeden erlaubten Zug eine Ebene tief bewerten – Mühle schließen, keine gegnerische Mühle zulassen,
// eigene Drohungen aufbauen (am besten solche, die der andere nicht zustellen kann: Zwickmühle), beweglich bleiben.
// Etwas Zufall, damit die Partien verschieden sind.
export function botMove(room, id, rng = Math.random) {
  const foe = room.foe(id);
  const hand = { ...room.hand };
  const count = (b, who) => b.filter((x) => x === who).length;
  const flies = (b, who) => room.settings.fly && !hand[who] && count(b, who) === 3;
  // Punkte, auf denen „who“ im nächsten Zug eine Mühle schließen kann
  const threats = (b, who) => {
    const out = new Set();
    for (const m of MILLS) {
      const empty = m.filter((q) => b[q] === null);
      if (empty.length !== 1 || m.filter((q) => b[q] === who).length !== 2) continue;
      const p = empty[0];
      if (hand[who] > 0 || flies(b, who) || ADJ[p].some((q) => b[q] === who && !m.includes(q))) out.add(p);
    }
    return out;
  };
  const reach = (b, who, p) => hand[who] > 0 || flies(b, who) || ADJ[p].some((q) => b[q] === who);
  const mobility = (b, who) => (hand[who] > 0 || flies(b, who) ? 4 : b.reduce((n, x, p) => n + (x === who ? ADJ[p].filter((q) => b[q] === null).length : 0), 0));
  // Bewertung aus Sicht von id, der andere ist als Nächstes dran
  const rate = (b) => {
    if (!hand[foe] && count(b, foe) + hand[foe] < 3) return 10000;
    if (!hand[foe] && mobility(b, foe) === 0) return 9000;
    const mine = threats(b, id), theirs = threats(b, foe);
    let v = -80 * Math.min(theirs.size, 2);
    for (const p of mine) v += reach(b, foe, p) ? 15 : 45;
    for (const m of MILLS) {
      const o = m.filter((q) => b[q] === id).length, f = m.filter((q) => b[q] === foe).length;
      if (o === 2 && !f) v += 4; if (f === 2 && !o) v -= 4;
    }
    v += 10 * (count(b, id) + hand[id] - count(b, foe) - hand[foe]);
    v += mobility(b, id) - 1.5 * mobility(b, foe);
    return v + rng() * 3;
  };
  const after = (from, to) => { const b = [...room.board]; if (from !== null) b[from] = null; b[to] = id; return b; };
  if (room.step === 'remove') {
    let best = null;
    for (const p of room.removable(foe)) {
      const b = [...room.board]; b[p] = null;
      const v = rate(b);
      if (!best || v > best.v) best = { p, v };
    }
    return room.capture(id, best.p);
  }
  const l = room.legal(id);
  const placing = !!l.place;
  if (placing) hand[id]--;
  const options = placing ? l.place.map((t) => [null, t]) : Object.entries(l.moves).flatMap(([f, ts]) => ts.map((t) => [Number(f), t]));
  let best = null;
  for (const [f, t] of options) {
    const b = after(f, t);
    let v = millAt(b, t, id) ? 500 + rate(b) * 0.1 : rate(b);
    if (placing) v += ADJ[t].length;
    if (!best || v > best.v) best = { f, t, v };
  }
  return placing ? room.place(id, best.t) : room.move(id, best.f, best.t);
}
