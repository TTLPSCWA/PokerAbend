// Präsident – Ablegespiel für 3–8 mit dem 52er-Blatt. Wer zuerst alle Karten los ist, wird Präsident, wer übrig bleibt, ist das Schlusslicht.
// Rangfolge der Karten (niedrig → hoch): 3 4 5 6 7 8 9 10 B D K A 2. Der Starter legt 1 bis 4 Karten gleichen Werts,
// danach muss man mit genau so vielen Karten höheren Werts überbieten – oder passen. Haben alle anderen gepasst, ist der Tisch frei
// und der, der zuletzt gelegt hat, spielt aus (hat er keine Karten mehr, der Nächste in der Reihe).
// Ab der zweiten Runde gibt das Schlusslicht seine beste Karte an den Präsidenten und bekommt dessen schlechteste; der Präsident fängt an.
// Punkte je Runde: Präsident n−1, dann abwärts bis 0 für das Schlusslicht.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const ORDER = ['3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A', '2'];
export const SUITS = ['c', 'd', 'h', 's'];
export const RANK_NAME = { T: 'Zehner', J: 'Buben', Q: 'Damen', K: 'Könige', A: 'Asse', 2: 'Zweier' };
export const rankName = (r) => RANK_NAME[r] || `${r}er`;
export const power = (c) => ORDER.indexOf(c[0]);
export const deck52 = () => SUITS.flatMap((s) => ORDER.map((r) => r + s));
const TITLES = ['Präsident', 'Vizepräsident'];

export class Room extends TurnRoom {
  static OPTIONS = [];
  defaultSettings() { return {}; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 8, lowWins: false, scoreLabel: 'Punkte' });
    this.lastRanking = []; // Rangfolge der letzten Runde (Präsident zuerst) – für den Kartentausch
    this.resetTable();
  }
  resetTable() { this.hands = {}; this.pile = null; this.passed = new Set(); this.places = []; this.exchange = null; this.ranking = null; }
  resetGame() { this.lastRanking = []; }
  title(i, n) { return i === 0 ? TITLES[0] : i === n - 1 ? 'Schlusslicht' : i === 1 ? TITLES[1] : i === n - 2 && n > 3 ? 'Vize-Schlusslicht' : 'Bürger'; }

  active() { return this.order.filter((id) => this.hands[id]?.length > 0); }

  setupRound() {
    this.resetTable();
    const deck = shuffle(deck52());
    for (const id of this.order) this.hands[id] = [];
    deck.forEach((c, i) => this.hands[this.order[i % this.order.length]].push(c));
    for (const id of this.order) this.hands[id].sort((a, b) => power(a) - power(b));
    // Kartentausch: nur, wenn dieselben Leute wie in der letzten Runde spielen
    const prev = this.lastRanking;
    if (prev.length === this.order.length && prev.every((id) => this.order.includes(id))) {
      const pres = prev[0], scum = prev[prev.length - 1];
      const best = this.hands[scum].pop();                     // beste Karte (Hand ist aufsteigend sortiert)
      const worst = this.hands[pres].shift();                  // schlechteste Karte
      this.hands[pres].push(best); this.hands[scum].push(worst);
      for (const id of [pres, scum]) this.hands[id].sort((a, b) => power(a) - power(b));
      this.say(`Kartentausch: ${this.name(scum)} gibt ${this.cardText(best)} an ${this.name(pres)} und bekommt ${this.cardText(worst)}`, 'cards');
      this.exchange = { from: scum, to: pres, gave: best, got: worst };
      this.turn = this.order.indexOf(pres); // der Präsident fängt an
    } else this.exchange = null;
    this.say(`${this.name(this.order[this.turn])} spielt aus`, 'cards');
  }
  cardText(c) { return `${c[0] === 'T' ? '10' : c[0]}${{ c: '♣', d: '♦', h: '♥', s: '♠' }[c[1]]}`; }

  // Wer ohne Karten ist, wird übersprungen
  onTurnStart() {
    for (let n = 0; n < this.order.length && !this.hands[this.currentId]?.length; n++) this.turn = (this.turn + 1) % this.order.length;
  }

  play(id, cards) {
    this.requireTurn(id);
    if (!Array.isArray(cards) || !cards.length || new Set(cards).size !== cards.length) throw new Error('Wähl Karten gleichen Werts');
    const hand = this.hands[id];
    if (!cards.every((c) => hand.includes(c))) throw new Error('Diese Karten hast du nicht');
    const rank = cards[0][0];
    if (cards.length > 4 || !cards.every((c) => c[0] === rank)) throw new Error('Nur Karten gleichen Werts, höchstens vier');
    if (this.pile) {
      if (cards.length !== this.pile.count) throw new Error(`Du musst genau ${this.pile.count} Karte${this.pile.count === 1 ? '' : 'n'} legen`);
      if (ORDER.indexOf(rank) <= ORDER.indexOf(this.pile.rank)) throw new Error('Das ist nicht höher');
    }
    this.hands[id] = hand.filter((c) => !cards.includes(c));
    this.pile = { by: id, cards: [...cards], count: cards.length, rank };
    this.passed.clear();
    this.say(`${this.name(id)} legt ${cards.length} × ${rankName(rank)}`, 'info', 'action');
    this.act(id, `${cards.length} × ${rankName(rank)}`);
    if (!this.hands[id].length) {
      this.places.push(id);
      this.say(`${this.name(id)} ist fertig: ${this.places.length}. Platz`, 'win');
      if (this.active().length <= 1) return this.finish();
    }
    this.next(1);
  }

  pass(id) {
    this.requireTurn(id);
    if (!this.pile) throw new Error('Du musst ausspielen');
    this.passed.add(id);
    this.say(`${this.name(id)} passt`, 'info', 'action');
    this.act(id, 'passt');
    const others = this.active().filter((p) => p !== this.pile.by);
    if (others.every((p) => this.passed.has(p))) {
      // Tisch frei: der, der zuletzt gelegt hat, spielt aus (ist er fertig, der Nächste in der Reihe)
      const leader = this.pile.by;
      this.pile = null; this.passed.clear();
      this.say('Alle haben gepasst – der Tisch ist frei', 'cards');
      this.turn = this.order.indexOf(leader);
      if (!this.hands[leader].length) this.turn = (this.turn + 1) % this.order.length;
      this.moveNo++;
      this.onTurnStart();
      return;
    }
    this.next(1);
  }

  finish() {
    const last = this.active()[0];
    const ranking = [...this.places, ...(last ? [last] : [])].filter((id) => this.players.has(id) && this.roundPlayers.includes(id));
    const n = ranking.length;
    const points = Object.fromEntries(ranking.map((id, i) => [id, n - 1 - i]));
    this.lastRanking = ranking;
    this.ranking = ranking.map((id, i) => ({ id, title: this.title(i, n) }));
    const text = `${this.name(ranking[0])} wird Präsident${n > 1 ? `, ${this.name(ranking[n - 1])} ist das Schlusslicht` : ''}`;
    this.finishRound(ranking[0] ? [ranking[0]] : [], text, points);
  }

  onDropOut(p) {
    delete this.hands[p.id];
    this.passed.delete(p.id);
    this.places = this.places.filter((x) => x !== p.id);
    if (this.pile?.by === p.id) { this.pile = null; this.passed.clear(); }
  }
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.active().length <= 1) this.finish();
  }

  publicPlayer(p) {
    const i = this.places.indexOf(p.id);
    return { cards: this.hands[p.id]?.length ?? 0, place: i >= 0 ? i + 1 : null, out: this.hands[p.id] ? this.hands[p.id].length === 0 : false };
  }

  gameView(viewerId) {
    const mine = this.hands[viewerId];
    return {
      table: this.pile, passed: [...this.passed], places: [...this.places],
      hand: mine ? [...mine] : null, order: ORDER,
      lastRanking: this.lastRanking, exchange: this.exchange,
      ranking: this.phase === 'over' ? this.ranking : null,
      canPass: this.currentId === viewerId && !!this.pile,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
