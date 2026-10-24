// Mau-Mau mit 32 Karten (7 bis Ass). Hausregeln (klassisch):
// 7 = der Nächste zieht 2 (stapelbar: 7 auf 7 → 4, 6 …), 8 = der Nächste setzt aus,
// Bube = Farbe wünschen (passt auf alles, aber nicht Bube auf Bube). „Mau!“ zeigt die Seite selbst an.
// Wer nicht kann, zieht eine Karte und darf genau diese noch spielen, sonst „Weiter“.
// Wertung über den Abend: Gewinner 0, alle anderen die Augen ihrer Handkarten – wenig ist gut.
// Farbenchaos (games/farbenchaos) baut auf dieser Klasse auf und tauscht Karten, Regeln und Wertung.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const SUITS = ['c', 's', 'h', 'd']; // Kreuz, Pik, Herz, Karo
export const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const POINTS = { 7: 7, 8: 8, 9: 9, T: 10, J: 2, Q: 3, K: 4, A: 11 };
export const SUIT_NAME = { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' };
const RANK_NAME = { 7: '7', 8: '8', 9: '9', T: '10', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };

export class Room extends TurnRoom {
  constructor(code, settings, onChange, opts = {}) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: true, scoreLabel: 'Punkte', ...opts });
    this.resetTable();
  }
  resetTable() {
    this.deck = []; this.discard = []; this.hands = {};
    this.wish = null;    // gewünschte Farbe nach einem Buben (bzw. Farbwahl)
    this.pending = 0;    // so viele Karten muss der Nächste ziehen (gestapelte 7en)
    this.drawn = null;   // Karte, die der Aktive gerade gezogen hat (nur die darf er noch spielen)
  }

  defaultSettings() { return { handSize: 5 }; }
  clampSettings(input, base) {
    const s = { ...base };
    if ('handSize' in input) { const n = Math.floor(Number(input.handSize)); if (n >= 3 && n <= 10) s.handSize = n; }
    return s;
  }

  // ---------- Karten (Farbenchaos überschreibt das) ----------
  buildDeck(players) {
    const one = SUITS.flatMap((s) => RANKS.map((r) => r + s));
    return players > 5 ? [...one, ...one] : one; // ab 6 Spielern zwei Spiele
  }
  cardName(c) { return `${SUIT_NAME[c[1]]} ${RANK_NAME[c[0]]}`; }
  cardPoints(c) { return POINTS[c[0]]; }
  lastCardCall() { return 'Mau!'; }
  winText(name) { return `${name} gewinnt – Mau-Mau!`; }
  validWish(w) { return SUITS.includes(w); }
  needsWish(c) { return c[0] === 'J'; }
  wishName(w) { return SUIT_NAME[w]; }
  firstCard() { return this.deck.pop(); }

  // Passt die Karte?
  canPlay(c) {
    const top = this.discard[this.discard.length - 1];
    if (this.pending > 0) return c[0] === '7'; // gegen eine 7 hilft nur eine 7
    if (c[0] === 'J') return top[0] !== 'J';  // Bube auf alles, nur nicht auf Bube
    const suit = this.wish || top[1];
    return c[1] === suit || (!this.wish && c[0] === top[0]);
  }

  // Wirkung der gespielten Karte: gibt zurück, wie viele Plätze es weitergeht
  effect(c, wish) {
    if (c[0] === '7') { this.pending += 2; return 1; }
    if (c[0] === '8') { this.say(`${this.name(this.peek(1))} setzt aus`); return 2; }
    if (c[0] === 'J') { this.wish = wish; this.say(`Gewünscht: ${this.wishName(wish)}`); }
    return 1;
  }

  // ---------- Ablauf ----------
  setupRound() {
    this.resetTable();
    this.deck = shuffle(this.buildDeck(this.order.length));
    for (const id of this.order) this.hands[id] = this.deck.splice(-this.settings.handSize);
    this.discard = [this.firstCard()];
    this.say(`Erste Karte: ${this.cardName(this.discard[0])}`, 'street');
  }

  onTurnStart() { this.drawn = null; }

  // Nachziehen; ist der Stapel leer, wird die Ablage (ohne oberste Karte) neu gemischt
  take(id, n) {
    const got = [];
    for (let k = 0; k < n; k++) {
      if (!this.deck.length) {
        const top = this.discard.pop();
        this.deck = shuffle(this.discard);
        this.discard = [top];
        if (!this.deck.length) break; // alles auf den Händen
      }
      got.push(this.deck.pop());
    }
    this.hands[id].push(...got);
    return got;
  }

  play(id, card, wish) {
    this.requireTurn(id);
    const hand = this.hands[id];
    const i = hand.indexOf(card);
    if (i < 0) throw new Error('Die Karte hast du nicht');
    if (this.drawn && card !== this.drawn) throw new Error('Nach dem Ziehen darfst du nur die gezogene Karte spielen');
    if (!this.canPlay(card)) throw new Error('Die Karte passt nicht');
    if (this.needsWish(card) && !this.validWish(wish)) throw new Error('Bitte eine Farbe wünschen');
    hand.splice(i, 1);
    this.discard.push(card);
    this.wish = null;
    this.say(`${this.name(id)} spielt ${this.cardName(card)}`, 'info', 'action');
    const steps = this.effect(card, wish);
    if (!hand.length) return this.win(id);
    if (hand.length === 1) this.say(`${this.name(id)}: ${this.lastCardCall()}`, 'react');
    this.next(steps);
  }

  draw(id) {
    this.requireTurn(id);
    if (this.pending > 0) {
      const n = this.pending; this.pending = 0;
      this.take(id, n);
      this.say(`${this.name(id)} zieht ${n} Karten`, 'info', 'action');
      return this.next(1);
    }
    if (this.drawn) throw new Error('Du hast schon gezogen – spiel die Karte oder sag „Weiter“');
    const [c] = this.take(id, 1);
    this.say(`${this.name(id)} zieht`, 'info', 'action');
    if (!c) return this.next(1); // nichts mehr zu ziehen
    this.drawn = c;
  }

  pass(id) {
    this.requireTurn(id);
    if (!this.drawn) throw new Error('Erst ziehen, dann weiter');
    this.say(`${this.name(id)} kann nicht`, 'info', 'action');
    this.next(1);
  }

  win(id) {
    const points = {};
    for (const p of this.order) points[p] = p === id ? 0 : this.hands[p].reduce((a, c) => a + this.cardPoints(c), 0);
    const rest = this.order.filter((p) => p !== id).map((p) => `${this.name(p)} ${points[p]}`).join(', ');
    this.finishRound([id], `${this.winText(this.name(id))} ${rest ? `(${rest} ${this.opts.scoreLabel})` : ''}`.trim(), points);
  }

  onDropOut(p) {
    // Karten des Aussteigers kommen unter den Stapel
    this.deck.unshift(...(this.hands[p.id] || []));
    delete this.hands[p.id];
    if (this.currentId === p.id) this.drawn = null;
  }

  publicPlayer(p) {
    const n = this.hands[p.id]?.length ?? 0;
    return { cards: n, last: this.order.includes(p.id) && n === 1 };
  }

  gameView(viewerId) {
    const mine = this.currentId === viewerId;
    return {
      top: this.discard[this.discard.length - 1] ?? null,
      wish: this.wish, pending: this.pending, deck: this.deck.length,
      hand: this.hands[viewerId] ? [...this.hands[viewerId]] : null,
      // Was der Aktive gerade machen kann (nur für ihn)
      playable: mine && this.phase === 'playing' ? this.hands[viewerId].filter((c) => (!this.drawn || c === this.drawn) && this.canPlay(c)) : [],
      drawn: mine ? this.drawn : null,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
