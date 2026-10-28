// Domino – 28 Steine (0–6), 2–4 Spieler, je 7 Steine, der Rest ist der Vorrat. Gespielt wird eine Kette mit zwei Enden.
// Wer den höchsten Pasch hat (sonst den höchsten Stein), legt ihn zuerst. Reihum legt man einen Stein mit passender Augenzahl an eines der beiden Enden.
// Wer nichts anlegen kann, zieht aus dem Vorrat, bis er legen kann; ist der Vorrat leer, setzt er aus.
// Wer zuerst alle Steine los ist, gewinnt und bekommt die Augen der Reststeine der anderen. Ist das Spiel blockiert (alle müssen aussetzen),
// gewinnt, wer die wenigsten Augen hat (er bekommt den Unterschied zu den anderen), bei Gleichstand ist es unentschieden.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const HAND = 7;
export const tileKey = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
export const pips = (t) => t.split('-').reduce((s, x) => s + Number(x), 0);
export const allTiles = () => { const l = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) l.push(`${a}-${b}`); return l; };
const sides = (t) => t.split('-').map(Number);

export class Room extends TurnRoom {
  static OPTIONS = [];
  defaultSettings() { return {}; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 4, lowWins: false, scoreLabel: 'Augen' });
    this.resetTable();
  }
  resetTable() { this.hands = {}; this.stock = []; this.chain = []; this.passes = 0; this.starter = null; }
  get ends() { return this.chain.length ? [this.chain[0][0], this.chain.at(-1)[1]] : null; }

  setupRound() {
    this.resetTable();
    const tiles = shuffle(allTiles());
    for (const id of this.order) this.hands[id] = tiles.splice(-HAND);
    this.stock = tiles;
    // Wer hat den höchsten Pasch (sonst den höchsten Stein)?
    let best = null;
    for (const id of this.order) for (const t of this.hands[id]) {
      const [a, b] = sides(t);
      const score = a === b ? 100 + a : a + b + Math.max(a, b) / 10;
      if (!best || score > best.score) best = { id, t, score };
    }
    this.starter = best.t; this.turn = this.order.indexOf(best.id);
    this.say(`${this.name(best.id)} hat den höchsten Stein (${best.t.replace('-', '|')}) und fängt an`, 'cards');
  }

  matches(t, end) { return sides(t).includes(end); }
  playable(id) {
    const hand = this.hands[id] || [];
    if (!this.chain.length) return hand.includes(this.starter) ? [{ tile: this.starter, sides: ['R'] }] : [];
    const [l, r] = this.ends;
    return hand.map((t) => ({ tile: t, sides: [...(this.matches(t, l) ? ['L'] : []), ...(this.matches(t, r) ? ['R'] : [])] })).filter((x) => x.sides.length);
  }

  play(id, tile, side) {
    this.requireTurn(id);
    const opt = this.playable(id).find((x) => x.tile === tile);
    if (!opt) throw new Error(this.chain.length ? 'Dieser Stein passt an kein Ende' : `Du musst mit ${this.starter.replace('-', '|')} anfangen`);
    if (!opt.sides.includes(side)) { if (opt.sides.length === 1) side = opt.sides[0]; else throw new Error('Wähl ein Ende der Kette'); }
    const [a, b] = sides(tile);
    if (!this.chain.length) this.chain.push([a, b]);
    else if (side === 'L') this.chain.unshift(this.matches(tile, this.ends[0]) && a === this.ends[0] ? [b, a] : [a, b]);
    else this.chain.push(b === this.ends[1] ? [b, a] : [a, b]);
    this.hands[id] = this.hands[id].filter((t) => t !== tile);
    this.passes = 0;
    this.say(`${this.name(id)} legt ${tile.replace('-', '|')}`, 'info', 'action');
    this.act(id, `legt ${tile.replace('-', '|')}`, { tile, side });
    if (!this.hands[id].length) {
      const pts = this.order.filter((p) => p !== id).reduce((s, p) => s + this.hands[p].reduce((x, t) => x + pips(t), 0), 0);
      return this.finishRound([id], `${this.name(id)} ist alle Steine los und bekommt ${pts} Augen`, { [id]: pts });
    }
    this.next(1);
  }

  draw(id) {
    this.requireTurn(id);
    if (this.playable(id).length) throw new Error('Du kannst anlegen – zieh nicht');
    if (!this.stock.length) throw new Error('Der Vorrat ist leer – du musst aussetzen');
    this.hands[id].push(this.stock.pop());
    this.say(`${this.name(id)} zieht aus dem Vorrat`, 'info', 'action');
    this.act(id, 'zieht');
  }

  pass(id) {
    this.requireTurn(id);
    if (this.playable(id).length) throw new Error('Du kannst anlegen');
    if (this.stock.length) throw new Error('Zieh erst aus dem Vorrat');
    this.passes++;
    this.say(`${this.name(id)} setzt aus`, 'info', 'action');
    this.act(id, 'setzt aus');
    if (this.passes >= this.order.length) return this.blocked();
    this.next(1);
  }

  blocked() {
    const eyes = Object.fromEntries(this.order.map((id) => [id, this.hands[id].reduce((s, t) => s + pips(t), 0)]));
    const low = Math.min(...Object.values(eyes));
    const best = this.order.filter((id) => eyes[id] === low);
    this.say(`Blockiert – ${this.order.map((id) => `${this.name(id)} ${eyes[id]}`).join(' · ')}`, 'cards');
    if (best.length > 1) return this.finishRound([], 'Das Spiel ist blockiert – unentschieden');
    const w = best[0];
    const pts = this.order.filter((p) => p !== w).reduce((s, p) => s + eyes[p], 0) - low;
    this.finishRound([w], `Blockiert: ${this.name(w)} hat die wenigsten Augen (${low}) und bekommt ${pts}`, { [w]: pts });
  }

  onDropOut(p) { this.stock.unshift(...(this.hands[p.id] || [])); delete this.hands[p.id]; }
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.passes >= this.order.length) this.blocked();
  }

  publicPlayer(p) { return { tiles: this.hands[p.id]?.length ?? 0 }; }
  gameView(viewerId) {
    const mine = this.hands[viewerId];
    return {
      chain: this.chain.map((t) => [...t]), ends: this.ends, stock: this.stock.length, starter: this.chain.length ? null : this.starter,
      hand: mine ? [...mine] : null,
      playable: this.phase === 'playing' && this.currentId === viewerId ? this.playable(viewerId) : [],
      canDraw: this.phase === 'playing' && this.currentId === viewerId && !this.playable(viewerId).length && this.stock.length > 0,
      canPass: this.phase === 'playing' && this.currentId === viewerId && !this.playable(viewerId).length && !this.stock.length,
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
