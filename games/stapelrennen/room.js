// Stapelrennen – Ablegespiel mit Zahlen 1–12 (Skip-Bo-ähnlich, eigene Gestaltung). Hausregeln:
// 162 Karten: 1–12 je zwölfmal, 18 Joker. Jeder hat einen eigenen Stapel (oberste Karte offen), 5 Handkarten und 4 Ablagen.
// In der Mitte liegen 4 Baureihen: jede beginnt mit 1 und geht bis 12, Joker zählen als die nötige Zahl. Volle Reihen kommen weg.
// Zug: Hand auf 5 auffüllen, dann beliebig oft aus Hand, Stapel oder von einer Ablage (nur die oberste Karte) auf die Baureihen legen.
// Ist die Hand leer, gibt es 5 neue. Zum Schluss eine Handkarte auf eine eigene Ablage – dann ist der Nächste dran.
// Wer seinen Stapel zuerst los ist, gewinnt: 25 Punkte plus 5 für jede Karte, die die anderen noch im Stapel haben.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const JOKER = 0;
export const HAND = 5;

export class Room extends TurnRoom {
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Punkte' });
    this.resetTable();
  }
  resetTable() { this.deck = []; this.used = []; this.build = [[], [], [], []]; this.stock = {}; this.hand = {}; this.piles = {}; }
  defaultSettings() { return { stockSize: 20 }; }
  clampSettings(input, base) {
    const s = { ...base };
    if ('stockSize' in input) { const n = Math.floor(Number(input.stockSize)); if (n >= 5 && n <= 30) s.stockSize = n; }
    return s;
  }

  setupRound() {
    this.resetTable();
    const deck = [];
    for (let n = 1; n <= 12; n++) for (let k = 0; k < 12; k++) deck.push(n);
    for (let k = 0; k < 18; k++) deck.push(JOKER);
    this.deck = shuffle(deck);
    for (const id of this.order) {
      this.stock[id] = this.deck.splice(-this.settings.stockSize);
      this.hand[id] = [];
      this.piles[id] = [[], [], [], []];
    }
  }

  onTurnStart() { if (this.currentId) this.fill(this.currentId); }

  // Hand auf 5 auffüllen; ist der Stapel leer, werden fertige Baureihen neu gemischt
  fill(id) {
    while (this.hand[id].length < HAND) {
      if (!this.deck.length) { this.deck = shuffle(this.used); this.used = []; }
      if (!this.deck.length) break;
      this.hand[id].push(this.deck.pop());
    }
  }

  // Welche Karte liegt an der Quelle? from: { kind: 'hand', index } | { kind: 'stock' } | { kind: 'pile', index }
  source(id, from) {
    if (from?.kind === 'hand') { const c = this.hand[id][from.index]; if (c === undefined) throw new Error('Diese Handkarte gibt es nicht'); return c; }
    if (from?.kind === 'stock') { const s = this.stock[id]; if (!s.length) throw new Error('Dein Stapel ist leer'); return s[s.length - 1]; }
    if (from?.kind === 'pile') { const p = this.piles[id][from.index]; if (!p?.length) throw new Error('Diese Ablage ist leer'); return p[p.length - 1]; }
    throw new Error('Woher soll die Karte kommen?');
  }
  take(id, from) {
    if (from.kind === 'hand') return this.hand[id].splice(from.index, 1)[0];
    if (from.kind === 'stock') return this.stock[id].pop();
    return this.piles[id][from.index].pop();
  }

  play(id, from, to) {
    this.requireTurn(id);
    const b = this.build[Number(to)];
    if (!b) throw new Error('Diese Baureihe gibt es nicht');
    const c = this.source(id, from);
    const need = b.length + 1;
    if (c !== need && c !== JOKER) throw new Error(`Auf diese Reihe gehört eine ${need}`);
    this.take(id, from);
    b.push(c);
    this.say(`${this.name(id)} legt ${c === JOKER ? `Joker (als ${need})` : c}${from.kind === 'stock' ? ' vom Stapel' : ''}`, 'info', from.kind === 'stock' ? 'win' : 'action');
    if (b.length === 12) { this.used.push(...b); this.build[Number(to)] = []; this.say('Eine Reihe ist voll und kommt weg'); }
    if (!this.stock[id].length) return this.win(id);
    if (!this.hand[id].length) this.fill(id);
  }

  throwAway(id, handIndex, pile) {
    this.requireTurn(id);
    const i = Number(handIndex), p = Number(pile);
    if (this.hand[id][i] === undefined) throw new Error('Diese Handkarte gibt es nicht');
    if (!(p >= 0 && p < 4)) throw new Error('Diese Ablage gibt es nicht');
    this.piles[id][p].push(this.hand[id].splice(i, 1)[0]);
    this.say(`${this.name(id)} legt ab`, 'info', 'action');
    this.next(1);
  }

  win(id) {
    const rest = this.order.filter((p) => p !== id).reduce((a, p) => a + this.stock[p].length, 0);
    const pts = 25 + 5 * rest;
    this.finishRound([id], `${this.name(id)} ist den Stapel los und gewinnt +${pts} Punkte`, { [id]: pts });
  }

  onDropOut(p) {
    for (const list of [this.stock[p.id], this.hand[p.id], ...(this.piles[p.id] || [])]) if (list) this.used.push(...list);
    delete this.stock[p.id]; delete this.hand[p.id]; delete this.piles[p.id];
  }

  publicPlayer(p) {
    const s = this.stock[p.id];
    return { stock: s?.length ?? 0, stockTop: s?.length ? s[s.length - 1] : null, cards: this.hand[p.id]?.length ?? 0, piles: this.piles[p.id] || null };
  }

  gameView(viewerId) {
    return {
      build: this.build.map((b) => ({ next: b.length + 1, count: b.length })),
      hand: this.hand[viewerId] ? [...this.hand[viewerId]] : null,
      deck: this.deck.length,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
