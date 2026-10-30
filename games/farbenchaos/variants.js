import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const LIGHT = ['r', 'y', 'g', 'b'], DARK = ['p', 't', 'o', 'v'];
export const DRAW = { I: 1, D: 2, F: 4, H: 5, U: 6, Z: 10, V: 4, B: 2 };
const physical = (faces, id) => ({ id, faces });
export function flipDeck() {
  const side = (colors, actions, wild) => {
    const a = colors.flatMap((c) => [...'123456789', ...actions].flatMap((v) => [v + c, v + c]));
    for (let i = 0; i < 4; i++) a.push('Ww', wild + 'w'); return a;
  };
  const light = side(LIGHT, ['I', 'S', 'R', 'L'], 'B'), dark = shuffle(side(DARK, ['H', 'E', 'R', 'L'], 'C'));
  return light.map((c, i) => physical([c, dark[i]], i));
}
export function mercyDeck() {
  const codes = LIGHT.flatMap((c) => [...'0123456789'].flatMap((v) => [v + c, v + c])
    .concat(['S', 'R', 'D', 'A'].flatMap((v) => Array(3).fill(v + c)), ['F', 'E'].flatMap((v) => Array(2).fill(v + c))));
  for (const [v, n] of [['V', 8], ['Q', 8], ['U', 4], ['Z', 4]]) codes.push(...Array(n).fill(v + 'w'));
  return codes.map((c, i) => physical([c], i));
}
export function allWildDeck() {
  // HHL33-Packung: 54 einfache Karten; die Aktionsarten sind unterschiedlich häufig.
  // Fotografierter Kartenumfang: https://gigazine.net/news/20220514-uno-all-wild/
  const codes = [];
  for (const [v, count] of [['W', 54], ['R', 14], ['S', 14], ['K', 6], ['D', 10], ['F', 6], ['T', 4], ['X', 4]]) codes.push(...Array(count).fill(v + 'w'));
  return codes.map((c, i) => physical([c], i));
}

export class VariantRoom extends TurnRoom {
  static OPTIONS = [];
  defaultSettings() { return {}; }
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 10, lowWins: false, scoreLabel: 'Punkte' });
    this.hands = {}; this.deck = []; this.discard = []; this.side = 0; this.matchScores = {}; this.matchOver = false;
    this.pending = 0; this.lastDraw = 0; this.forgot = null; this.drawn = null; this.eliminated = {}; this.aside = [];
  }
  buildDeck() { return this.variant === 'flip' ? flipDeck() : this.variant === 'no-mercy' ? mercyDeck() : allWildDeck(); }
  face(card) { return card.faces[this.side] || card.faces[0]; }
  token(card) { return `${this.face(card)}@${card.id}`; }
  colors() { return this.variant === 'flip' && this.side ? DARK : LIGHT; }
  saveExtra() { return { matchScores: this.matchScores, matchOver: this.matchOver }; }
  loadExtra(x) { this.matchScores = x.matchScores || {}; this.matchOver = !!x.matchOver; }
  resetGame() { this.matchScores = {}; this.matchOver = false; }
  setupRound() {
    if (this.matchOver) this.resetGame();
    this.side = 0; this.deck = shuffle(this.buildDeck()); this.hands = {}; this.discard = []; this.aside = [];
    this.pending = 0; this.lastDraw = 0; this.wish = null; this.drawn = null; this.forgot = null; this.stall = 0;
    this.eliminated = {}; this.colorChoice = null; this.challenge = null; this.challengeHand = null; this.revealed = [];
    for (const id of this.order) this.hands[id] = this.deck.splice(-7);
    let first = this.deck.pop();
    if (this.variant === 'no-mercy') { while (!/\d/.test(this.face(first)[0])) { this.deck.unshift(first); first = this.deck.pop(); } }
    if (this.variant === 'flip') { while (this.face(first)[0] === 'B') { this.deck.unshift(first); first = this.deck.pop(); } }
    this.discard = [first];
    if (this.variant === 'flip') {
      const v = this.face(first)[0];
      if (v === 'I') { this.take(this.order[0], 1); this.turn = 1; }
      if (v === 'S') this.turn = 1;
      if (v === 'R') { this.dir = -1; this.turn = this.order.length - 1; }
      if (v === 'L') this.flip();
      if (this.face(this.discard.at(-1))[1] === 'w') this.colorChoice = { id: this.currentId, kind: 'start' };
    }
  }
  onTurnStart() { this.drawn = null; }
  alive() { return this.order.filter((id) => !this.eliminated[id]); }
  peek(steps = 1) {
    let at = this.turn;
    for (let n = 0; n < steps; n++) { do { at = (at + this.dir + this.order.length) % this.order.length; } while (this.eliminated[this.order[at]] && this.alive().length); }
    return this.order[at];
  }
  next(steps = 1) { const id = this.peek(steps); this.turn = this.order.indexOf(id); this.drawn = null; }
  take(id, n) {
    const got = [];
    for (let i = 0; i < n && !this.eliminated[id]; i++) {
      if (!this.deck.length) { const top = this.discard.pop(); this.deck = shuffle([...this.discard, ...this.aside]); this.discard = top ? [top] : []; this.aside = []; }
      if (!this.deck.length) break;
      const c = this.deck.pop(); this.hands[id].push(c); got.push(c);
      if (this.variant === 'no-mercy' && this.hands[id].length >= 25) {
        this.aside.push(...this.hands[id]); this.hands[id] = []; this.eliminated[id] = true;
        this.say(`${this.name(id)} scheidet mit 25 Karten aus`, 'warn');
      }
    }
    return got;
  }
  canPlay(card) {
    const c = typeof card === 'string' ? card : this.face(card), top = this.face(this.discard.at(-1));
    if (this.variant === 'all-wild') return true;
    if (this.pending) return (DRAW[c[0]] || 0) >= this.lastDraw;
    return c[1] === 'w' || c[1] === (this.wish || top[1]) || (top[1] !== 'w' && c[0] === top[0]) || (top[1] === 'w' && !this.wish);
  }
  flip() { this.side = 1 - this.side; this.deck.reverse(); this.discard.reverse(); Object.values(this.hands).forEach((h) => h.reverse()); this.wish = null; this.say(this.side ? 'Alle Karten auf die dunkle Seite drehen' : 'Alle Karten auf die helle Seite drehen', 'react'); }
  swap(id, target) { [this.hands[id], this.hands[target]] = [this.hands[target], this.hands[id]]; this.say(`${this.name(id)} tauscht die Hand mit ${this.name(target)}`, 'react'); }
  rotate() { const old = { ...this.hands }; this.alive().forEach((id) => { const at = this.order.indexOf(id), saved = this.turn; this.turn = at; const to = this.peek(1); this.turn = saved; this.hands[to] = old[id]; }); this.say('Alle Hände wandern in Spielrichtung weiter', 'react'); }
  needsTarget(c) { return (this.variant === 'no-mercy' && c[0] === '7') || (this.variant === 'all-wild' && ['T', 'X'].includes(c[0])); }
  play(id, token, wish, called = false, target = null) {
    this.requireTurn(id);
    if (this.challenge || this.colorChoice) throw new Error('Erst die offene Entscheidung abschließen');
    const hand = this.hands[id], card = hand.find((c) => this.token(c) === token);
    if (!card || !this.canPlay(card) || (this.drawn && token !== this.drawn)) throw new Error('Diese Karte ist gerade nicht spielbar');
    const c = this.face(card), v = c[0], wild = c[1] === 'w' && this.variant !== 'all-wild' && v !== 'Q';
    if (wild && !this.colors().includes(wish)) throw new Error('Bitte eine Farbe wählen');
    if (this.needsTarget(c) && (!this.alive().includes(target) || target === id)) throw new Error('Wähle einen anderen aktiven Mitspieler');
    const oldColor = this.wish || this.face(this.discard.at(-1))[1];
    const illegal = hand.some((x) => x !== card && this.face(x)[1] === oldColor);
    this.forgot = null; this.challengeHand = null; this.stall = 0;
    hand.splice(hand.indexOf(card), 1); this.discard.push(card); this.wish = wild ? wish : null;
    this.act(id, `legt ${c}`); this.say(`${this.name(id)} legt ${c}`, 'info', 'action');
    let steps = 1;
    if (v === 'R' || v === 'V') { this.dir *= -1; if (this.alive().length === 2) steps = v === 'V' ? 0 : 2; }
    if (v === 'S') steps = 2;
    if (v === 'K') steps = 3;
    if (v === 'E') steps = 0;
    if (v === 'X' || (v === '7' && this.variant === 'no-mercy')) this.swap(id, target);
    if (v === '0' && this.variant === 'no-mercy') this.rotate();
    if (v === 'T') this.take(target, 2);
    if (v === 'A') { const extra = this.hands[id].filter((x) => this.face(x)[1] === c[1]); this.hands[id] = this.hands[id].filter((x) => !extra.includes(x)); this.discard.splice(this.discard.length - 1, 0, ...extra); }
    if (v === 'L') { this.flip(); if (this.face(this.discard.at(-1))[1] === 'w') this.colorChoice = { id, kind: 'flip' }; }
    if (v === 'Q') this.colorChoice = { id: this.peek(), kind: 'roulette' };
    if (DRAW[v]) {
      if (this.variant === 'no-mercy') { this.pending += DRAW[v]; this.lastDraw = DRAW[v]; }
      else if (this.variant === 'flip' && v === 'B') this.challenge = { offender: id, victim: this.peek(), illegal, amount: 2, color: null };
      else { this.take(this.peek(), DRAW[v]); steps = 2; }
    }
    if (this.variant === 'flip' && v === 'C') this.challenge = { offender: id, victim: this.peek(), illegal, amount: 0, color: wish };
    if (this.finishIfWon()) return;
    if (this.hands[id].length === 1 && !called) this.forgot = id;
    if (this.colorChoice?.kind === 'flip') return;
    this.next(steps);
  }
  finishIfWon() {
    if (this.challenge || this.colorChoice) return false;
    const alive = this.alive(), winner = alive.length === 1 ? alive[0] : alive.find((id) => !this.hands[id].length);
    if (!winner) return false;
    this.win(winner); return true;
  }
  drawColor(id, color) {
    this.revealed = [];
    for (let k = 0; k < 300; k++) { const [c] = this.take(id, 1); if (!c) break; this.revealed.push(this.face(c)); if (this.face(c)[1] === color || this.eliminated[id]) break; }
  }
  chooseColor(id, color) {
    this.requireTurn(id);
    const choice = this.colorChoice; if (!choice || choice.id !== id || !this.colors().includes(color)) throw new Error('Diese Farbwahl ist gerade nicht möglich');
    this.colorChoice = null; this.wish = color;
    if (choice.kind === 'roulette') { this.drawColor(id, color); if (!this.finishIfWon()) this.next(); }
    else if (choice.kind === 'flip') { if (!this.finishIfWon()) this.next(); }
  }
  challengeDraw(id, challenge) {
    this.requireTurn(id); const c = this.challenge;
    if (!c || c.victim !== id) throw new Error('Keine Plus-Karte zum Anfechten');
    this.challenge = null;
    if (challenge) this.challengeHand = { viewer: id, cards: this.hands[c.offender].map((x) => this.face(x)) };
    const guilty = challenge && c.illegal, victim = guilty ? c.offender : id;
    if (c.color) this.drawColor(victim, c.color); else this.take(victim, c.amount);
    if (challenge && !guilty) this.take(id, 2);
    this.say(challenge ? guilty ? 'Anfechtung erfolgreich' : 'Anfechtung fehlgeschlagen: zusätzlich zwei Karten' : 'Ziehstrafe angenommen');
    if (!this.finishIfWon() && !guilty) this.next();
  }
  draw(id) {
    this.requireTurn(id);
    if (this.colorChoice) throw new Error('Erst eine Farbe wählen');
    if (this.challenge) return this.challengeDraw(id, false);
    if (this.drawn) throw new Error('Du hast bereits gezogen');
    this.forgot = null; this.challengeHand = null;
    if (this.pending) { const n = this.pending; this.pending = 0; this.lastDraw = 0; this.take(id, n); if (!this.finishIfWon()) this.next(); return; }
    if (this.variant === 'no-mercy' && this.hands[id].some((c) => this.canPlay(c))) throw new Error('Du musst eine passende Karte spielen');
    let card, count = 0;
    do { [card] = this.take(id, 1); count++; } while (this.variant === 'no-mercy' && card && !this.canPlay(card) && !this.eliminated[id] && count < 300);
    this.act(id, `zieht ${count}`);
    if (this.finishIfWon()) return;
    if (this.eliminated[id]) return this.next();
    if (!card) { if (++this.stall >= this.alive().length) return this.finishRound([], 'Keine Karten mehr spielbar – unentschieden'); return this.next(); }
    this.stall = 0;
    if (this.variant !== 'all-wild' && !this.canPlay(card)) return this.next();
    this.drawn = this.token(card);
  }
  pass(id) { this.requireTurn(id); if (!this.drawn || this.variant === 'no-mercy') throw new Error('Die gezogene Karte muss gespielt werden'); this.forgot = null; this.next(); }
  catchForgot(id) { if (this.phase !== 'playing' || !this.forgot || id === this.forgot || !this.alive().includes(id)) throw new Error('Gerade niemanden zu erwischen'); const f = this.forgot; this.forgot = null; this.take(f, 2); this.finishIfWon(); }
  lateCall(id) { if (this.forgot !== id) throw new Error('Gerade nicht nötig'); this.forgot = null; this.act(id, 'UNO!'); }
  cardPoints(card) {
    const c = typeof card === 'string' ? card : this.face(card), v = c[0];
    if (/\d/.test(v)) return Number(v);
    if (this.variant === 'all-wild') return v === 'W' ? 20 : 50;
    if (this.variant === 'flip') return ({ I: 10, E: 30, W: 40, B: 50, C: 60 })[v] || 20;
    return c[1] === 'w' ? 50 : 20;
  }
  win(id) {
    const points = this.alive().filter((p) => p !== id).reduce((n, p) => n + this.hands[p].reduce((s, c) => s + this.cardPoints(c), 0), 0) + Object.keys(this.eliminated).length * 250;
    this.matchScores[id] = (this.matchScores[id] || 0) + points;
    const target = this.variant === 'no-mercy' ? 1000 : 500; this.matchOver = this.matchScores[id] >= target;
    this.finishRound([id], `${this.name(id)} gewinnt die Runde · +${points} Punkte${this.matchOver ? ` · Ziel ${target} erreicht, Partie gewonnen!` : ''}`, { [id]: points });
  }
  onDropOut(p) { this.aside.push(...(this.hands[p.id] || [])); delete this.hands[p.id]; if (this.forgot === p.id) this.forgot = null; if (this.colorChoice?.id === p.id) this.colorChoice = null; if (this.challenge && [this.challenge.offender, this.challenge.victim].includes(p.id)) this.challenge = null; }
  publicPlayer(p) { return { cards: this.hands[p.id]?.length || 0, last: this.hands[p.id]?.length === 1, eliminated: !!this.eliminated[p.id], matchScore: this.matchScores[p.id] || 0 }; }
  gameView(id) {
    const mine = id === this.currentId && this.phase === 'playing' && !this.eliminated[id];
    return {
      top: this.discard.length ? this.token(this.discard.at(-1)) : null, side: this.side, colors: this.colors(), wish: this.wish, pending: this.pending, lastDraw: this.lastDraw, deck: this.deck.length,
      hand: this.hands[id] && !this.eliminated[id] ? this.hands[id].map((c) => this.token(c)) : null,
      playable: mine && !this.challenge && !this.colorChoice ? this.hands[id].filter((c) => this.canPlay(c) && (!this.drawn || this.token(c) === this.drawn)).map((c) => this.token(c)) : [],
      inactiveHands: this.variant === 'flip' ? Object.fromEntries(Object.entries(this.hands).filter(([p]) => p !== id).map(([p, hand]) => [p, hand.map((c) => c.faces[1 - this.side])])) : null,
      drawBack: this.variant === 'flip' && this.deck.length ? this.deck.at(-1).faces[1 - this.side] : null,
      drawn: mine ? this.drawn : null, mustPlay: this.variant === 'no-mercy', callNeeded: true, forgot: this.forgot,
      colorChoice: this.colorChoice ? { id: this.colorChoice.id, kind: this.colorChoice.kind } : null,
      challenge: this.challenge ? { offender: this.challenge.offender, victim: this.challenge.victim } : null,
      challengeHand: this.challengeHand?.viewer === id ? this.challengeHand.cards : null,
      revealed: this.revealed, matchScores: this.matchScores, matchOver: this.matchOver,
    };
  }
  variantBot(id, rng = Math.random) {
    if (this.forgot === id) this.lateCall(id); else if (this.forgot) this.catchForgot(id);
    if (this.phase !== 'playing') return;
    const colors = this.colors(), hand = this.hands[id];
    const wish = colors.slice().sort((a, b) => hand.filter((c) => this.face(c)[1] === b).length - hand.filter((c) => this.face(c)[1] === a).length)[0];
    if (this.colorChoice?.id === id) return this.chooseColor(id, wish);
    if (this.challenge) return this.challengeDraw(id, false);
    const playable = this.gameView(id).playable;
    if (!playable.length) return this.drawn ? this.pass(id) : this.draw(id);
    const value = (c) => this.cardPoints(c) + hand.filter((x) => this.face(x)[1] === c[1]).length * 5 - (c[1] === 'w' && hand.length > 3 ? 60 : 0);
    const card = rng() < .1 ? playable[Math.floor(rng() * playable.length)] : playable.slice().sort((a, b) => value(b) - value(a))[0];
    const others = this.alive().filter((p) => p !== id).sort((a, b) => this.hands[a].length - this.hands[b].length);
    return this.play(id, card, wish, true, others[0]);
  }
  onTimeout(id) { if (id) this.variantBot(id); }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
