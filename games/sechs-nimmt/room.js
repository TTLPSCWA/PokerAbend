import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';
import { randomInt } from 'node:crypto';

export const horns = (n) => n === 55 ? 7 : n % 11 === 0 ? 5 : n % 10 === 0 ? 3 : n % 5 === 0 ? 2 : 1;
export const rowPoints = (row) => row.reduce((sum, n) => sum + horns(n), 0);
export const deck = (n = 104) => Array.from({ length: n }, (_, i) => i + 1);

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'target', label: 'Hornochsen bis Spielende', type: 'number', min: 10, max: 200 },
    { key: 'turnTime', label: 'Sekunden zum Wählen', type: 'number', min: 5, max: 120 },
    { key: 'pro', label: 'Profi: kleiner Kartensatz, freie erlaubte Reihe', type: 'bool' },
    { key: 'tactics', label: 'Taktik: Kartenpool offen zeigen', type: 'bool' },
  ];
  defaultSettings() { return { target: 66, turnTime: 30, pro: false, tactics: false }; }
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 10, lowWins: true, scoreLabel: 'Hornochsen' });
    this.hands = {}; this.rows = []; this.chosen = {}; this.queue = []; this.totals = {}; this.taken = {}; this.recent = null;
  }
  setupRound() {
    this.totals = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.deal = 0; this.dealCards();
  }
  dealCards() {
    const cards = shuffle(deck(this.settings.pro ? this.order.length * 10 + 4 : 104));
    this.pool = cards.slice(0, this.order.length * 10 + 4).sort((a, b) => a - b);
    this.hands = Object.fromEntries(this.order.map((id) => [id, cards.splice(0, 10).sort((a, b) => a - b)]));
    this.rows = cards.slice(0, 4).map((c) => [c]); this.taken = Object.fromEntries(this.order.map((id) => [id, []]));
    this.deal++; this.trick = 1; this.beginPick();
    this.say(`Blatt ${this.deal}: zehn Karten für alle`, 'cards');
  }
  beginPick() { this.stage = 'pick'; this.chosen = {}; this.queue = []; this.index = 0; this.moveNo++; }
  get currentId() { return this.phase === 'playing' && this.stage === 'row' ? this.queue[this.index]?.id : null; }
  botDue() {
    if (this.stage === 'pick') return this.order.find((id) => this.players.get(id)?.bot && this.chosen[id] === undefined) || null;
    return this.players.get(this.currentId)?.bot ? this.currentId : null;
  }
  choose(id, card) {
    if (this.phase !== 'playing' || this.stage !== 'pick' || !this.order.includes(id)) throw new Error('Du wählst gerade keine Karte');
    if (this.chosen[id] !== undefined) throw new Error('Deine Karte ist schon verdeckt gewählt');
    if (!Number.isInteger(card) || !this.hands[id].includes(card)) throw new Error('Diese Karte hast du nicht');
    this.chosen[id] = card;
    // Erst wenn alle gebunden sind, werden Werte öffentlich und Karten entfernt.
    if (this.order.every((p) => this.chosen[p] !== undefined)) {
      this.queue = this.order.map((p) => ({ id: p, card: this.chosen[p] })).sort((a, b) => a.card - b.card);
      for (const { id: p, card: c } of this.queue) this.hands[p].splice(this.hands[p].indexOf(c), 1);
      this.stage = 'reveal'; this.index = 0; this.moveNo++;
      this.say(this.queue.map((p) => `${this.name(p.id)}: ${p.card}`).join(' · '), 'cards');
    }
  }
  allowed(card) {
    const lower = this.rows.map((row, i) => ({ i, end: row.at(-1) })).filter((r) => r.end < card).sort((a, b) => b.end - a.end);
    return !lower.length ? [0, 1, 2, 3] : this.settings.pro ? lower.map((r) => r.i) : [lower[0].i];
  }
  resolve() {
    const play = this.queue[this.index];
    if (!play) return this.endTrick();
    const allowed = this.allowed(play.card);
    if (allowed.length > 1 || this.rows.every((r) => r.at(-1) > play.card)) { this.stage = 'row'; this.moveNo++; return; }
    this.place(allowed[0]);
  }
  takeRow(id, row) {
    this.requireTurn(id);
    if (!Number.isInteger(row) || !this.allowed(this.queue[this.index].card).includes(row)) throw new Error('Diese Reihe ist nicht erlaubt');
    this.place(row);
  }
  place(row) {
    const { id, card } = this.queue[this.index];
    const take = this.rows[row].length === 5 || this.rows[row].at(-1) > card;
    const cards = take ? this.rows[row].slice() : [];
    if (take) {
      this.taken[id].push(...cards); this.totals[id] += rowPoints(cards); this.rows[row] = [];
      this.say(`${this.name(id)} nimmt Reihe ${row + 1}: +${rowPoints(cards)} Hornochsen`, 'info', 'action');
    }
    this.rows[row].push(card);
    this.act(id, `legt ${card}${take ? `, nimmt ${rowPoints(cards)}` : ''}`, { card, row, taken: cards });
    this.recent = { n: this.actSeq, id, card, row, taken: cards };
    this.index++; this.stage = 'reveal'; this.moveNo++;
  }
  endTrick() {
    if (this.trick < 10) { this.trick++; return this.beginPick(); }
    if (Math.max(...this.order.map((id) => this.totals[id])) < this.settings.target) return this.dealCards();
    const min = Math.min(...this.order.map((id) => this.totals[id]));
    const winners = this.order.filter((id) => this.totals[id] === min);
    this.finishRound(winners, `${winners.map((id) => this.name(id)).join(', ')} gewinnt mit ${min} Hornochsen`, { ...this.totals });
  }
  syncTimer() {
    const key = this.phase === 'playing' ? `${this.roundNo}:${this.deal}:${this.trick}:${this.stage}:${this.index}` : null;
    if (key === this.timerKey) return;
    clearTimeout(this.turnTimer); this.turnTimer = null; this.timerKey = key; this.deadline = null;
    if (!key) return;
    const ms = this.stage === 'reveal' ? 650 : this.settings.turnTime * 1000;
    this.deadline = Date.now() + ms;
    this.turnTimer = setTimeout(() => { if (this.timerKey !== key) return; this.onTimeout(); this.syncTimer(); this.onChange('state'); }, ms);
    this.turnTimer.unref?.();
  }
  onTimeout() {
    if (this.stage === 'pick') for (const id of this.order) { if (this.chosen[id] === undefined) this.choose(id, this.hands[id][randomInt(this.hands[id].length)]); }
    else if (this.stage === 'row') this.takeRow(this.currentId, this.allowed(this.queue[this.index].card).sort((a, b) => rowPoints(this.rows[a]) - rowPoints(this.rows[b]))[0]);
    else if (this.stage === 'reveal') this.resolve();
  }
  onAbort() { this.dispose(); }
  dropOut(p, message) {
    const i = this.order.indexOf(p.id); if (i < 0) return;
    if (message) this.say(message);
    this.order.splice(i, 1); delete this.hands[p.id]; delete this.chosen[p.id];
    if (this.order.length < 2) return this.finishRound([...this.order], 'Die anderen sind ausgestiegen', { ...this.totals });
    if (this.stage === 'pick' && this.order.every((id) => this.chosen[id] !== undefined)) {
      const id = this.order[0], card = this.chosen[id]; delete this.chosen[id]; this.choose(id, card);
    }
    // Bereits aufgedeckte Karten bleiben verbindlich und werden für Ausgestiegene automatisch zugeordnet.
    if (this.stage === 'row' && this.currentId === p.id) this.onTimeout();
  }
  publicPlayer(p) { return { cards: this.hands[p.id]?.length || 0, ready: this.chosen[p.id] !== undefined, horns: this.totals[p.id] || 0 }; }
  gameView(id) {
    return { hand: this.hands[id]?.slice() || null, rows: this.rows.map((r) => [...r]), totals: { ...this.totals }, deal: this.deal, trick: this.trick,
      stage: this.stage, ready: this.chosen[id] !== undefined, queue: this.stage === 'pick' ? [] : this.queue.map((p) => ({ ...p })), index: this.index,
      allowed: this.stage === 'row' ? this.allowed(this.queue[this.index].card) : [], recent: this.recent,
      pool: this.settings.tactics ? [...this.pool] : null };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}

export function botMove(room, id) {
  const g = room.gameView(id);
  if (g.stage === 'row') return room.takeRow(id, g.allowed.sort((a, b) => rowPoints(g.rows[a]) - rowPoints(g.rows[b]))[0]);
  const cost = (c) => {
    const lower = g.rows.filter((r) => r.at(-1) < c).sort((a, b) => b.at(-1) - a.at(-1));
    if (!lower.length) return Math.min(...g.rows.map(rowPoints)) + 2;
    const r = lower[0], gap = c - r.at(-1);
    return r.length === 5 ? rowPoints(r) + 3 : (gap - 1) * (r.length + 1) / 20;
  };
  return room.choose(id, [...g.hand].sort((a, b) => cost(a) - cost(b) || a - b)[0]);
}
