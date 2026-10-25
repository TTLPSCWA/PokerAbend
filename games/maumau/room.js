// Mau-Mau mit 32 Karten (7 bis Ass). Hausregeln (klassisch):
// 7 = der Nächste zieht 2 (stapelbar: 7 auf 7 → 4, 6 …), 8 = der Nächste setzt aus,
// Bube = Farbe wünschen (passt auf alles, aber nicht Bube auf Bube). „Mau!“ zeigt die Seite selbst an.
// Wer nicht kann, zieht eine Karte und darf genau diese noch spielen, sonst „Weiter“.
// Wertung über den Abend: Gewinner 0, alle anderen die Augen ihrer Handkarten – wenig ist gut.
// UNO (games/farbenchaos) baut auf dieser Klasse auf und tauscht Karten, Regeln und Wertung.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const SUITS = ['c', 's', 'h', 'd']; // Kreuz, Pik, Herz, Karo
export const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const POINTS = { 7: 7, 8: 8, 9: 9, T: 10, J: 2, Q: 3, K: 4, A: 11 };
export const SUIT_NAME = { c: 'Kreuz', s: 'Pik', h: 'Herz', d: 'Karo' };
const RANK_NAME = { 7: '7', 8: '8', 9: '9', T: '10', J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass' };

export class Room extends TurnRoom {
  // Regel-Optionen (Host-Menü). Standard = wie bisher.
  static OPTIONS = [
    { key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, max: 10 },
    { key: 'seven', label: '7: der Nächste zieht 2', type: 'bool' },
    { key: 'sevenStack', label: '7 auf 7 legen (dann 4, 6 …)', type: 'bool' },
    { key: 'eight', label: '8: der Nächste setzt aus', type: 'bool' },
    { key: 'jackWish', label: 'Bube: Farbe wünschen', type: 'bool' },
    { key: 'jackOnJack', label: 'Bube auf Bube erlaubt', type: 'bool' },
    { key: 'ace', label: 'Ass: nochmal dran', type: 'bool' },
    { key: 'mauCall', label: '„Mau“ selbst sagen (vergessen = 1 Strafkarte)', type: 'bool' },
    { key: 'firstCardEffect', label: 'Erste Karte wirkt (7 und 8)', type: 'bool' },
  ];

  constructor(code, settings, onChange, opts = {}) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: true, scoreLabel: 'Punkte', ...opts });
    this.resetTable();
  }
  resetTable() {
    this.deck = []; this.discard = []; this.hands = {};
    this.wish = null;    // gewünschte Farbe nach einem Buben (bzw. Farbwahl)
    this.pending = 0;    // so viele Karten muss der Nächste ziehen (gestapelte 7en)
    this.drawn = null;   // Karte, die der Aktive gerade gezogen hat (nur die darf er noch spielen)
    this.forgot = null;  // Erwischen (UNO): wer „UNO“ vergessen hat – bis der Nächste etwas tut
    this.stall = 0;      // Züge hintereinander, in denen nichts gezogen und nichts gelegt wurde
  }

  defaultSettings() {
    return { handSize: 5, seven: true, sevenStack: true, eight: true, jackWish: true, jackOnJack: false, ace: false, mauCall: false, firstCardEffect: false };
  }

  // ---------- Karten (UNO überschreibt das) ----------
  buildDeck(players) {
    const one = SUITS.flatMap((s) => RANKS.map((r) => r + s));
    return players > 5 ? [...one, ...one] : one; // ab 6 Spielern zwei Spiele
  }
  cardName(c) { return `${SUIT_NAME[c[1]]} ${RANK_NAME[c[0]]}`; }
  cardPoints(c) { return POINTS[c[0]]; }
  lastCardCall() { return 'Mau!'; }
  winText(name) { return `${name} gewinnt – Mau-Mau!`; }
  validWish(w) { return SUITS.includes(w); }
  needsWish(c) { return this.settings.jackWish && c[0] === 'J'; }
  callKey() { return 'mauCall'; }    // Einstellung: letzte Karte selbst ansagen
  callPenalty() { return 1; }        // Strafkarten, wenn man es vergisst
  allowed() { return true; }         // zusätzliche Bedingung je Spieler (UNO: +4 nur ohne passende Farbe)
  wishName(w) { return SUIT_NAME[w]; }
  firstCard() { return this.deck.pop(); }

  // Passt die Karte?
  canPlay(c) {
    const s = this.settings;
    const top = this.discard[this.discard.length - 1];
    if (this.pending > 0) return s.sevenStack && c[0] === '7'; // gegen eine 7 hilft nur eine 7 (wenn erlaubt)
    if (s.jackWish && c[0] === 'J') return s.jackOnJack || top[0] !== 'J'; // Bube auf alles (auf Bube nur, wenn erlaubt)
    const suit = this.wish || top[1];
    return c[1] === suit || (!this.wish && c[0] === top[0]);
  }

  // Wirkung der gespielten Karte: gibt zurück, wie viele Plätze es weitergeht
  effect(c, wish) {
    const s = this.settings;
    if (c[0] === '7' && s.seven) { this.pending += 2; return 1; }
    if (c[0] === '8' && s.eight) { this.say(`${this.name(this.peek(1))} setzt aus`); this.act(this.peek(1), 'setzt aus'); return 2; }
    if (c[0] === 'J' && s.jackWish) { this.wish = wish; this.say(`Gewünscht: ${this.wishName(wish)}`); }
    if (c[0] === 'A' && s.ace) { this.say('Ass – nochmal dran'); return 0; }
    return 1;
  }

  // Wirkung der ersten Karte (nur mit Option)
  startEffect(top) {
    const s = this.settings;
    if (!s.firstCardEffect) return;
    const first = this.name(this.order[0]);
    if (top[0] === '7' && s.seven) { this.pending = 2; this.say(`Die erste Karte ist eine 7: ${first} muss 2 ziehen${s.sevenStack ? ' oder eine 7 legen' : ''}`); }
    else if (top[0] === '8' && s.eight) { this.say(`Die erste Karte ist eine 8: ${first} setzt aus`); this.turn = 1 % this.order.length; }
  }

  // ---------- Ablauf ----------
  validateStart(ids) {
    const max = Math.floor((this.buildDeck(ids.length).length - 1) / ids.length);
    if (this.settings.handSize > max) throw new Error(`Für ${ids.length} Mitspieler sind höchstens ${max} Karten pro Spieler möglich. Bitte die Kartenanzahl im Host-Menü verringern.`);
  }

  setupRound() {
    this.resetTable();
    this.deck = shuffle(this.buildDeck(this.order.length));
    for (const id of this.order) this.hands[id] = this.deck.splice(-this.settings.handSize);
    this.discard = [this.firstCard()];
    this.say(`Erste Karte: ${this.cardName(this.discard[0])}`, 'street');
    this.startEffect(this.discard[0]);
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

  // Erwischen-Option (nur UNO): Vergessen kostet nicht sofort, sondern erst, wenn jemand es meldet
  catchKey() { return null; }
  catching() { return !!(this.catchKey() && this.settings[this.catchKey()]); }
  needCall() { return !!this.settings[this.callKey()] || this.catching(); }

  // called: hat der Spieler bei der vorletzten Karte „Mau“/„UNO“ gesagt? (zählt nur mit Option)
  play(id, card, wish, called = false) {
    this.requireTurn(id);
    this.forgot = null; // wer jetzt handelt, schließt das Fenster zum Erwischen
    const hand = this.hands[id];
    const i = hand.indexOf(card);
    if (i < 0) throw new Error('Die Karte hast du nicht');
    if (this.drawn && card !== this.drawn) throw new Error('Nach dem Ziehen darfst du nur die gezogene Karte spielen');
    if (!this.canPlay(card) || !this.allowed(card, id)) throw new Error('Die Karte passt nicht');
    if (this.needsWish(card) && !this.validWish(wish)) throw new Error('Bitte eine Farbe wünschen');
    hand.splice(i, 1);
    this.discard.push(card);
    this.stall = 0;
    this.wish = null;
    this.say(`${this.name(id)} spielt ${this.cardName(card)}`, 'info', 'action');
    this.act(id, `legt ${this.cardName(card)}`);
    const steps = this.effect(card, wish);
    if (!hand.length) return this.win(id);
    if (hand.length === 1) {
      const word = this.lastCardCall();
      if (this.catching() && !called) this.forgot = id; // die anderen dürfen melden
      else if (this.needCall() && !called) {
        const n = this.callPenalty();
        this.take(id, n);
        this.say(`${this.name(id)} hat „${word.replace('!', '')}“ vergessen – ${n === 1 ? 'eine Strafkarte' : `${n} Strafkarten`}`, 'react');
        this.act(id, `„${word.replace('!', '')}“ vergessen: +${n}`);
      } else { this.say(`${this.name(id)}: ${word}`, 'react'); this.act(id, word); }
    }
    this.next(steps);
  }

  draw(id) {
    this.requireTurn(id);
    this.forgot = null;
    if (this.pending > 0) {
      const n = this.pending; this.pending = 0;
      if (this.take(id, n).length) this.stall = 0; else if (++this.stall >= this.order.length) return this.endStuck();
      this.say(`${this.name(id)} zieht ${n} Karten`, 'info', 'action');
      this.act(id, `zieht ${n}`);
      return this.next(1);
    }
    if (this.drawn) throw new Error('Du hast schon gezogen – spiel die Karte oder sag „Weiter“');
    const [c] = this.take(id, 1);
    this.say(`${this.name(id)} zieht`, 'info', 'action');
    this.act(id, 'zieht');
    if (!c) return this.noDraw(); // nichts mehr zu ziehen
    this.stall = 0;
    this.drawn = c;
  }

  // Nichts mehr zu ziehen: Zug vorbei. Kann eine ganze Runde lang niemand ziehen oder legen, endet die Runde –
  // sonst säßen alle für immer fest (alle Karten auf den Händen, keine passt)
  noDraw() {
    if (++this.stall >= this.order.length) return this.endStuck();
    this.next(1);
  }
  endStuck() {
    const fewest = Math.min(...this.order.map((p) => this.hands[p].length));
    const id = this.order.find((p) => this.hands[p].length === fewest);
    this.say(`Nichts mehr zu ziehen und niemand kann legen – ${this.name(id)} hat die wenigsten Karten`, 'warn');
    this.win(id);
  }

  pass(id) {
    this.requireTurn(id);
    this.forgot = null;
    if (!this.drawn) throw new Error('Erst ziehen, dann weiter');
    this.say(`${this.name(id)} kann nicht`, 'info', 'action');
    this.act(id, 'kann nicht');
    this.next(1);
  }

  // Erwischen: jemand aus der Runde meldet, dass der Vorgänger „UNO“ vergessen hat → Strafkarten
  catchForgot(id) {
    if (this.phase !== 'playing' || !this.forgot) throw new Error('Gerade hat niemand etwas vergessen – zu spät oder zu früh');
    if (!this.order.includes(id)) throw new Error('Nur wer mitspielt, darf melden');
    if (id === this.forgot) throw new Error('Dich selbst kannst du nicht erwischen – sag es lieber schnell');
    const f = this.forgot;
    this.forgot = null;
    const n = this.callPenalty();
    this.take(f, n);
    this.say(`${this.name(id)} erwischt ${this.name(f)}: „${this.lastCardCall().replace('!', '')}“ vergessen – ${n} Strafkarten`, 'react');
    this.act(id, 'Erwischt!');
    this.act(f, `erwischt: +${n}`);
  }
  // … oder man sagt es selbst noch schnell, bevor jemand meldet
  lateCall(id) {
    if (this.forgot !== id) throw new Error('Das musst du gerade nicht sagen');
    this.forgot = null;
    this.say(`${this.name(id)}: ${this.lastCardCall()} (gerade noch)`, 'react');
    this.act(id, this.lastCardCall());
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
    if (this.forgot === p.id) this.forgot = null;
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
      playable: mine && this.phase === 'playing' ? this.hands[viewerId].filter((c) => (!this.drawn || c === this.drawn) && this.canPlay(c) && this.allowed(c, viewerId)) : [],
      drawn: mine ? this.drawn : null,
      callNeeded: this.needCall(), // „Mau“/„UNO“ muss man selbst sagen
      forgot: this.forgot, // Erwischen: wer gerade „UNO“ vergessen hat (sehen alle – am Tisch hört man es ja auch)
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
