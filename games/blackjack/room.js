// Blackjack – Kartenspiel für 1–7 gegen den Dealer (die Bank). Hausregeln (Standard):
// 6 Decks im Schlitten, neu gemischt, wenn weniger als 25 % übrig sind. Jeder hat einen eigenen Chipstand (Startchips, Nachkaufen).
// Ablauf je Hand (= eine Runde der Plattform): alle setzen (Mindest-/Höchsteinsatz) → je 2 Karten offen, Dealer 1 offen + 1 verdeckt
// → (Versicherung, wenn an und der Dealer ein Ass zeigt) → Dealer schaut bei Ass oder Zehn nach Blackjack (dann sofort Abrechnung)
// → reihum: Karte, Stehen, Verdoppeln (nur mit 2 Karten, genau 1 weitere), Teilen (gleicher Wert, einmal; geteilte Asse nur je 1 Karte)
// → Dealer zieht bis mindestens 17, steht auf Soft 17 (Hausregel: zieht auf Soft 17).
// Auszahlung: Blackjack 3:2 (abgerundet, der Rest bleibt bei der Bank), Gewinn 1:1, Gleichstand = Einsatz zurück, über 21 verloren.
// Blackjack nach dem Teilen zählt als 21. Die Bank zählt mit: Chips der Spieler + Bank + Chips auf dem Tisch = alles, was ausgegeben wurde.
// Die verdeckte Dealerkarte verlässt den Server erst beim Aufdecken.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const DECKS = 6;
const RANKS = '23456789TJQKA';
const SUITS = 'cdhs';
export const SHOE_SIZE = DECKS * 52;
export const cardValue = (c) => (c[0] === 'A' ? 11 : 'TJQK'.includes(c[0]) ? 10 : Number(c[0]));
// Summe einer Hand: Asse zählen 11, bei Bedarf 1. soft = ein Ass zählt noch als 11
export function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += cardValue(c); if (c[0] === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0 };
}
export const isBlackjack = (cards) => cards.length === 2 && total(cards).total === 21;

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'startStack', label: 'Startchips', type: 'number', min: 100, max: 100000 },
    { key: 'minBet', label: 'Mindesteinsatz', type: 'number', min: 1, max: 10000 },
    { key: 'maxBet', label: 'Höchsteinsatz', type: 'number', min: 1, max: 100000 },
    { key: 'hitSoft17', label: 'Dealer zieht auf Soft 17', type: 'bool' },
    { key: 'insurance', label: 'Versicherung anbieten (zahlt 2:1)', type: 'bool' },
    { key: 'doubleAfterSplit', label: 'Verdoppeln nach dem Teilen', type: 'bool' },
    { key: 'rebuys', label: 'Nachkaufen: wie oft (0 = aus, 99 = unbegrenzt)', type: 'number', min: 0, max: 99 },
  ];
  defaultSettings() { return { startStack: 1000, minBet: 10, maxBet: 500, hitSoft17: false, insurance: false, doubleAfterSplit: true, rebuys: 99 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 1, maxPlayers: 7, lowWins: false, scoreLabel: 'Chips' });
    this.stacks = {};      // ID → Chips
    this.bought = {};      // ID → insgesamt erhaltene Chips (Start + Nachkäufe)
    this.rebuyCount = {};
    this.bank = 0;         // Gewinn (+) oder Verlust (−) der Bank über den Abend
    this.shoe = []; this.used = [];
    this.resetHand();
  }
  resetHand() {
    this.step = 'bet';     // bet | insure | play | done
    this.bets = {};        // Einsätze vor dem Geben
    this.hands = {};       // ID → [{ cards, bet, done, doubled, split }]
    this.insured = {};     // ID → Versicherung
    this.decided = new Set();
    this.dealer = [];
    this.hidden = true;    // zweite Dealerkarte noch verdeckt
    this.handIdx = 0;
    this.settled = false;
    this.startStacks = {};
    this.detail = {};
  }

  validateStart() { if (this.settings.minBet > this.settings.maxBet) throw new Error('Der Mindesteinsatz ist höher als der Höchsteinsatz – bitte im Host-Menü ändern'); }

  // ---------- Chips ----------
  sit(id) {
    super.sit(id);
    if (!(id in this.stacks)) { this.stacks[id] = this.settings.startStack; this.bought[id] = this.settings.startStack; this.rebuyCount[id] = 0; }
  }
  canRebuy(id) {
    const r = this.settings.rebuys;
    return (this.stacks[id] ?? 0) < this.settings.minBet && (r >= 99 || (this.rebuyCount[id] || 0) < r);
  }
  rebuy(id) {
    if (!(id in this.stacks)) throw new Error('Setz dich erst an den Tisch');
    if (this.settings.rebuys === 0) throw new Error('Nachkaufen ist an diesem Tisch aus');
    if (this.stacks[id] >= this.settings.minBet) throw new Error('Nachkaufen geht erst, wenn du zu wenig Chips für den Mindesteinsatz hast');
    if (!this.canRebuy(id)) throw new Error(`Höchstens ${this.settings.rebuys}× nachkaufen`);
    if (this.phase === 'playing' && (this.step !== 'bet' || this.decided.has(id))) throw new Error('Nachkaufen geht nur vor dem Setzen');
    const n = this.settings.startStack;
    this.stacks[id] += n; this.bought[id] += n; this.rebuyCount[id]++;
    if (this.phase === 'playing') this.startStacks[id] = (this.startStacks[id] || 0) + n;
    this.say(`${this.name(id)} kauft ${n} Chips nach`, 'info', 'action');
    this.act(id, `kauft ${n} nach`);
  }
  // Chips, die gerade auf dem Tisch liegen (Einsätze und Versicherungen dieser Hand)
  onTable() {
    if (this.settled || this.phase !== 'playing') return 0;
    if (this.step === 'bet') return Object.values(this.bets).reduce((a, b) => a + b, 0);
    return Object.values(this.hands).flat().reduce((a, h) => a + h.bet, 0) + Object.values(this.insured).reduce((a, b) => a + b, 0);
  }

  // Abbruch: Einsätze und Versicherungen zurück an die Spieler, ausgeteilte Karten zurück in den Ablagestapel
  onAbort() {
    if (!this.settled) {
      if (this.step === 'bet') for (const [id, n] of Object.entries(this.bets)) this.stacks[id] += n;
      else {
        for (const [id, hs] of Object.entries(this.hands)) for (const h of hs) this.stacks[id] += h.bet;
        for (const [id, n] of Object.entries(this.insured)) this.stacks[id] += n;
      }
    }
    for (const hs of Object.values(this.hands)) for (const h of hs) this.used.push(...h.cards);
    this.used.push(...this.dealer);
    this.resetHand();
  }

  // ---------- Schlitten ----------
  draw() {
    if (!this.shoe.length) { this.shoe = shuffle(this.used); this.used = []; }
    return this.shoe.pop();
  }

  // ---------- Hand ----------
  setupRound() {
    this.resetHand();
    if (this.shoe.length < SHOE_SIZE * 0.25) {
      this.shoe = shuffle(Array.from({ length: DECKS }, () => [...SUITS].flatMap((s) => [...RANKS].map((r) => r + s))).flat());
      this.used = [];
      this.say(`Neu gemischt: ${DECKS} Decks im Schlitten`, 'cards');
    }
    for (const id of this.order) this.startStacks[id] = this.stacks[id];
    // Wer den Mindesteinsatz nicht hat und nicht nachkaufen darf, setzt aus
    for (const id of this.order) if (this.stacks[id] < this.settings.minBet && !this.canRebuy(id)) { this.decided.add(id); this.act(id, 'setzt aus'); }
    this.maybeDeal();
  }
  get currentId() {
    if (this.phase !== 'playing') return null;
    if (this.step === 'bet' || this.step === 'insure') return this.order.find((p) => !this.decided.has(p)) ?? null;
    if (this.step === 'play') return this.order[this.turn] ?? null;
    return null;
  }
  requireStep(step, id) {
    if (this.phase !== 'playing' || this.step !== step) throw new Error(step === 'bet' ? 'Gerade wird nicht gesetzt' : step === 'insure' ? 'Gerade gibt es keine Versicherung' : 'Gerade nicht');
    if (!this.order.includes(id)) throw new Error('Du spielst diese Hand nicht mit');
  }

  bet(id, amount) {
    this.requireStep('bet', id);
    if (this.decided.has(id)) throw new Error('Du hast schon gesetzt');
    amount = Math.floor(Number(amount));
    const max = Math.min(this.settings.maxBet, this.stacks[id]);
    if (!(amount >= this.settings.minBet)) throw new Error(`Mindesteinsatz ${this.settings.minBet}`);
    if (amount > max) throw new Error(amount > this.stacks[id] ? 'So viele Chips hast du nicht' : `Höchsteinsatz ${this.settings.maxBet}`);
    this.stacks[id] -= amount;
    this.bets[id] = amount;
    this.decided.add(id);
    this.say(`${this.name(id)} setzt ${amount}`, 'info', 'action');
    this.act(id, `setzt ${amount}`);
    this.maybeDeal();
  }
  sitOut(id) {
    this.requireStep('bet', id);
    if (this.decided.has(id)) throw new Error('Du hast schon gesetzt');
    this.decided.add(id);
    this.say(`${this.name(id)} setzt diese Hand aus`, 'info', 'action');
    this.act(id, 'setzt aus');
    this.maybeDeal();
  }
  // Host: nicht länger warten – wer noch nicht gesetzt hat, setzt aus
  dealNow(id) {
    this.requireHost(id);
    if (this.phase !== 'playing' || this.step !== 'bet') throw new Error('Gerade wird nicht gesetzt');
    for (const p of this.order) if (!this.decided.has(p)) { this.decided.add(p); this.act(p, 'setzt aus'); }
    this.maybeDeal();
  }
  maybeDeal() { if (this.step === 'bet' && this.order.every((p) => this.decided.has(p))) this.deal(); }

  deal() {
    const players = this.order.filter((p) => this.bets[p]);
    if (!players.length) {
      this.settled = true;
      return this.finishRound([], 'Niemand hat gesetzt – keine Hand', {});
    }
    // Wer aussetzt, ist in dieser Hand nicht dabei (auch nicht in der Bestenliste)
    this.order = players;
    this.roundPlayers = [...players];
    for (const p of players) this.hands[p] = [{ cards: [], bet: this.bets[p], done: false, doubled: false, split: false }];
    for (let k = 0; k < 2; k++) {
      for (const p of players) this.hands[p][0].cards.push(this.draw());
      this.dealer.push(this.draw());
    }
    this.say(`Karten: Dealer zeigt ${this.cardText(this.dealer[0])}`, 'cards');
    this.decided = new Set();
    if (this.settings.insurance && this.dealer[0][0] === 'A') {
      this.step = 'insure';
      this.say('Der Dealer zeigt ein Ass – Versicherung?', 'warn');
      this.moveNo++;
      return;
    }
    this.dealerPeek();
  }
  insure(id, yes) {
    this.requireStep('insure', id);
    if (this.decided.has(id)) throw new Error('Schon entschieden');
    if (yes) {
      const amount = Math.floor(this.bets[id] / 2);
      if (amount < 1) throw new Error('Der Einsatz ist zu klein für eine Versicherung');
      if (this.stacks[id] < amount) throw new Error('Dafür hast du nicht genug Chips');
      this.stacks[id] -= amount;
      this.insured[id] = amount;
      this.say(`${this.name(id)} versichert (${amount})`, 'info', 'action');
      this.act(id, `versichert ${amount}`);
    } else this.act(id, 'keine Versicherung');
    this.decided.add(id);
    if (this.order.every((p) => this.decided.has(p))) this.dealerPeek();
  }
  // Dealer schaut bei Ass oder Zehn nach Blackjack (heißt nicht peek – das ist in TurnRoom der Nächste in Spielrichtung)
  dealerPeek() {
    const up = this.dealer[0];
    if ((up[0] === 'A' || cardValue(up) === 10) && isBlackjack(this.dealer)) {
      this.hidden = false;
      this.say('Der Dealer hat Blackjack!', 'warn');
      return this.settle();
    }
    if (up[0] === 'A' || cardValue(up) === 10) this.say('Der Dealer hat keinen Blackjack', 'cards');
    this.step = 'play';
    for (const p of this.order) if (isBlackjack(this.hands[p][0].cards)) { this.hands[p][0].done = true; this.act(p, 'Blackjack!'); }
    this.turn = 0; this.handIdx = -1;
    this.advance(true);
  }

  // Nächste offene Hand (erst die weiteren Hände des Spielers, dann die nächsten Spieler) – sonst spielt der Dealer
  advance(fromStart = false) {
    let t = fromStart ? 0 : this.turn, h = fromStart ? 0 : this.handIdx + 1;
    while (t < this.order.length) {
      const hs = this.hands[this.order[t]] || [];
      while (h < hs.length) { if (!hs[h].done) { this.turn = t; this.handIdx = h; this.moveNo++; return; } h++; }
      t++; h = 0;
    }
    this.dealerPlay();
  }
  current(id) {
    this.requireTurn(id);
    if (this.step !== 'play') throw new Error('Gerade nicht');
    return this.hands[id][this.handIdx];
  }
  hit(id) {
    const hand = this.current(id);
    hand.cards.push(this.draw());
    const { total: t } = total(hand.cards);
    this.say(`${this.name(id)} nimmt eine Karte: ${t}`, 'info', 'action');
    if (t > 21) { hand.done = true; this.act(id, `${t} – über 21`); return this.advance(); }
    this.act(id, `Karte: ${t}`);
    if (t === 21) { hand.done = true; return this.advance(); }
  }
  // „Stehen“ (heißt nicht stand – das ist in TurnRoom das Aufstehen vom Platz)
  stay(id) {
    const hand = this.current(id);
    hand.done = true;
    this.say(`${this.name(id)} bleibt bei ${total(hand.cards).total}`, 'info', 'action');
    this.act(id, `bleibt bei ${total(hand.cards).total}`);
    this.advance();
  }
  canDouble(id) {
    const hand = this.hands[id]?.[this.handIdx];
    return !!hand && hand.cards.length === 2 && (!hand.split || this.settings.doubleAfterSplit) && this.stacks[id] >= hand.bet;
  }
  double(id) {
    const hand = this.current(id);
    if (hand.cards.length !== 2) throw new Error('Verdoppeln geht nur mit den ersten zwei Karten');
    if (hand.split && !this.settings.doubleAfterSplit) throw new Error('Nach dem Teilen wird an diesem Tisch nicht verdoppelt');
    if (this.stacks[id] < hand.bet) throw new Error('Dafür hast du nicht genug Chips');
    this.stacks[id] -= hand.bet;
    hand.bet *= 2; hand.doubled = true;
    hand.cards.push(this.draw());
    hand.done = true;
    const t = total(hand.cards).total;
    this.say(`${this.name(id)} verdoppelt auf ${hand.bet}: ${t}`, 'info', 'action');
    this.act(id, `verdoppelt: ${t}${t > 21 ? ' – über 21' : ''}`);
    this.advance();
  }
  canSplit(id) {
    const hs = this.hands[id];
    const hand = hs?.[this.handIdx];
    return !!hand && hs.length === 1 && hand.cards.length === 2 && cardValue(hand.cards[0]) === cardValue(hand.cards[1]) && this.stacks[id] >= hand.bet;
  }
  split(id) {
    const hand = this.current(id);
    if (this.hands[id].length !== 1) throw new Error('Geteilt wird nur einmal');
    if (hand.cards.length !== 2 || cardValue(hand.cards[0]) !== cardValue(hand.cards[1])) throw new Error('Teilen geht nur mit zwei Karten gleichen Werts');
    if (this.stacks[id] < hand.bet) throw new Error('Dafür hast du nicht genug Chips');
    this.stacks[id] -= hand.bet;
    const aces = hand.cards[0][0] === 'A';
    this.hands[id] = hand.cards.map((c) => ({ cards: [c, this.draw()], bet: hand.bet, done: aces, doubled: false, split: true }));
    for (const h of this.hands[id]) if (total(h.cards).total === 21) h.done = true;
    this.say(`${this.name(id)} teilt${aces ? ' (Asse: je nur eine Karte)' : ''}`, 'info', 'action');
    this.act(id, 'teilt');
    this.handIdx = -1;
    this.advance();
  }

  dealerPlay() {
    this.step = 'dealer';
    this.hidden = false;
    const live = Object.values(this.hands).flat().some((h) => total(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.split));
    if (live) {
      for (;;) {
        const { total: t, soft } = total(this.dealer);
        if (t < 17 || (t === 17 && soft && this.settings.hitSoft17)) this.dealer.push(this.draw()); else break;
      }
    }
    const d = total(this.dealer).total;
    this.say(`Dealer: ${this.dealer.map((c) => this.cardText(c)).join(' ')} = ${d}${d > 21 ? ' – über 21' : ''}`, 'cards');
    this.settle();
  }

  // Abrechnung: Spieler-Chips, Bank, Ergebnis je Spieler
  settle() {
    this.step = 'done';
    this.hidden = false;
    const dt = total(this.dealer).total, dealerBJ = isBlackjack(this.dealer);
    const points = {}, winners = [];
    for (const id of this.order) {
      const lines = [];
      for (const h of this.hands[id]) {
        const t = total(h.cards).total;
        const natural = isBlackjack(h.cards) && !h.split;
        let back = 0, text;
        if (t > 21) text = `über 21 −${h.bet}`;
        else if (dealerBJ) { if (natural) { back = h.bet; text = 'Blackjack gegen Blackjack: Push'; } else text = `Dealer-Blackjack −${h.bet}`; }
        else if (natural) { const win = Math.floor(h.bet * 1.5); back = h.bet + win; text = `Blackjack! +${win}`; }
        else if (dt > 21 || t > dt) { back = 2 * h.bet; text = `gewonnen (${t}) +${h.bet}`; }
        else if (t === dt) { back = h.bet; text = `Push (${t})`; }
        else text = `verloren (${t}) −${h.bet}`;
        this.stacks[id] += back;
        this.bank += h.bet - back;
        lines.push(text);
      }
      if (this.insured[id]) {
        if (dealerBJ) { this.stacks[id] += this.insured[id] * 3; this.bank -= this.insured[id] * 2; lines.push(`Versicherung +${this.insured[id] * 2}`); }
        else { this.bank += this.insured[id]; lines.push(`Versicherung −${this.insured[id]}`); }
      }
      points[id] = this.stacks[id] - this.startStacks[id];
      if (points[id] > 0) winners.push(id);
      this.detail[id] = lines.join(' · ');
    }
    // Karten der Hand kommen in den Abwurf
    this.used.push(...this.dealer, ...Object.values(this.hands).flat().flatMap((h) => h.cards));
    this.settled = true;
    const sign = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
    this.finishRound(winners, `Dealer ${dealerBJ ? 'Blackjack' : dt > 21 ? `über 21 (${dt})` : dt} – ${this.order.map((id) => `${this.name(id)} ${sign(points[id])}`).join(', ')}`, points);
    this.result.detail = { ...this.detail };
  }

  cardText(c) { return `${{ T: '10', J: 'B', Q: 'D', K: 'K', A: 'A' }[c[0]] || c[0]}${{ c: '♣', d: '♦', h: '♥', s: '♠' }[c[1]]}`; }

  // Aussteigen: vor dem Geben Einsatz zurück, danach verfällt er an die Bank
  onDropOut(p) {
    const id = p.id;
    if (this.step === 'bet') { this.stacks[id] += this.bets[id] || 0; delete this.bets[id]; this.decided.delete(id); }
    else if (!this.settled) {
      for (const h of this.hands[id] || []) { this.bank += h.bet; this.used.push(...h.cards); }
      this.bank += this.insured[id] || 0;
      delete this.hands[id]; delete this.insured[id];
    }
  }
  dropOut(p, message) {
    const wasCurrent = this.currentId === p.id;
    super.dropOut(p, message);
    if (this.phase !== 'playing') return;
    if (this.step === 'bet') this.maybeDeal();
    else if (this.step === 'insure' && this.order.every((x) => this.decided.has(x))) this.dealerPeek();
    else if (this.step === 'play' && wasCurrent) { this.handIdx = -1; this.turn = Math.min(this.turn, this.order.length - 1); this.turn = Math.max(0, this.turn); this.advanceFromTurn(); }
  }
  advanceFromTurn() {
    const t0 = this.turn;
    for (let t = t0; t < this.order.length; t++) {
      const hs = this.hands[this.order[t]] || [];
      const h = hs.findIndex((x) => !x.done);
      if (h >= 0) { this.turn = t; this.handIdx = h; this.moveNo++; return; }
    }
    this.dealerPlay();
  }
  onTurnStart() {}

  publicPlayer(p) {
    return { stack: this.stacks[p.id] ?? null, bet: this.bets[p.id] || 0, decided: this.decided.has(p.id), rebuys: this.rebuyCount[p.id] || 0 };
  }
  gameView(viewerId) {
    const showAll = !this.hidden;
    const hands = Object.fromEntries(Object.entries(this.hands).map(([id, hs]) => [id, hs.map((h) => ({ ...h, cards: [...h.cards], total: total(h.cards).total, soft: total(h.cards).soft, natural: isBlackjack(h.cards) && !h.split }))]));
    const mine = this.currentId === viewerId && this.step === 'play';
    return {
      step: this.step,
      // Verdeckte Dealerkarte bleibt auf dem Server, bis aufgedeckt wird
      dealer: showAll ? { cards: [...this.dealer], total: total(this.dealer).total, blackjack: isBlackjack(this.dealer) }
        : { cards: this.dealer.length ? [this.dealer[0], null] : [], total: this.dealer.length ? cardValue(this.dealer[0]) : null, blackjack: false },
      hands, handIdx: this.step === 'play' ? this.handIdx : null,
      bets: { ...this.bets }, insured: { ...this.insured },
      stack: this.stacks[viewerId] ?? null,
      minBet: this.settings.minBet, maxBet: this.settings.maxBet,
      canDouble: mine && this.canDouble(viewerId), canSplit: mine && this.canSplit(viewerId),
      canRebuy: viewerId in this.stacks && this.settings.rebuys > 0 && this.canRebuy(viewerId),
      shoe: this.shoe.length, shoeSize: SHOE_SIZE, bank: this.bank,
      detail: this.settled ? this.detail : null,
    };
  }
  // Zwischen den Händen auch ohne laufende Runde: Chipstände zeigen
  view(viewerId) {
    const v = super.view(viewerId);
    v.chips = { stack: this.stacks[viewerId] ?? null, canRebuy: viewerId in this.stacks && this.settings.rebuys > 0 && this.canRebuy(viewerId), bank: this.bank, minBet: this.settings.minBet };
    for (const p of v.players) { p.stack = this.stacks[p.id] ?? null; p.rebuys = this.rebuyCount[p.id] || 0; }
    return v;
  }

  saveExtra() { return { stacks: this.stacks, bought: this.bought, rebuyCount: this.rebuyCount, bank: this.bank }; }
  loadExtra(x) { this.stacks = x.stacks || {}; this.bought = x.bought || {}; this.rebuyCount = x.rebuyCount || {}; this.bank = x.bank || 0; }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
