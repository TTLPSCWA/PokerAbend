// Skip-Bo – Ablegespiel mit Zahlen 1–12 (interne ID bleibt „stapelrennen“). Hausregeln:
// 162 Karten: 1–12 je zwölfmal, 18 Joker. Jeder hat einen eigenen Stapel (oberste Karte offen), 5 Handkarten und 4 Ablagen.
// In der Mitte liegen 4 Baureihen: jede beginnt mit 1 und geht bis 12, Joker zählen als die nötige Zahl. Volle Reihen kommen weg.
// Zug: Hand auf 5 auffüllen, dann beliebig oft aus Hand, Stapel oder von einer Ablage (nur die oberste Karte) auf die Baureihen legen.
// Ist die Hand leer, gibt es 5 neue. Zum Schluss eine Handkarte auf eine eigene Ablage – dann ist der Nächste dran.
// Wer seinen Stapel zuerst los ist, gewinnt: 25 Punkte plus 5 für jede Karte, die die anderen noch im Stapel haben.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const JOKER = 0;
export const HAND = 5;
export const DECK_SIZE = 162;

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'stockSize', label: 'Karten im eigenen Stapel (offiziell 30, ab 5 Spielern 20)', type: 'number', min: 5, max: 30 }];

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Punkte' });
    this.resetTable();
  }
  resetTable() { this.deck = []; this.used = []; this.build = [[], [], [], []]; this.stock = {}; this.hand = {}; this.piles = {}; }
  defaultSettings() { return { stockSize: 20 }; }

  validateStart(ids) {
    // Neben den persönlichen Stapeln müssen fünf Handkarten für jeden übrig bleiben.
    const max = Math.floor(DECK_SIZE / ids.length) - HAND;
    if (this.settings.stockSize > max) throw new Error(`Für ${ids.length} Mitspieler sind höchstens ${max} Karten im eigenen Stapel möglich. Bitte die Stapelgröße im Host-Menü verringern.`);
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
    this.act(id, `legt ${c === JOKER ? '★' : c}${from.kind === 'stock' ? ' vom Stapel' : ''}`);
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
    this.act(id, 'legt ab');
    this.next(1);
  }

  // Sind alle Nachziehkarten aufgebraucht, muss auch eine leere Hand den Zug beenden können.
  pass(id) {
    this.requireTurn(id);
    if (this.hand[id].length || this.deck.length || this.used.length) throw new Error('Zum Beenden musst du eine Handkarte ablegen');
    const canContinue = this.order.some((p) => this.hand[p].length ||
      [this.stock[p].at(-1), ...this.piles[p].map((pile) => pile.at(-1))]
        .some((c) => c === JOKER || this.build.some((b) => b.length + 1 === c)));
    if (!canContinue) return this.finishRound([], 'Keine Karten mehr spielbar – Runde unentschieden');
    this.say(`${this.name(id)} gibt weiter – keine Handkarte und kein Nachziehen möglich`, 'info', 'action');
    this.act(id, 'gibt weiter');
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
      build: this.build.map((b) => ({ next: b.length + 1, count: b.length, jokers: b.map((c, i) => (c === JOKER ? i : -1)).filter((i) => i >= 0) })),
      hand: this.hand[viewerId] ? [...this.hand[viewerId]] : null,
      deck: this.deck.length,
      canPass: this.phase === 'playing' && this.currentId === viewerId && !this.hand[viewerId]?.length && !this.deck.length && !this.used.length,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
