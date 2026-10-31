import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';
import { CITY, MODES, neighbours, distances } from './map.js';

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'rounds', label: 'Züge von Mr. X', type: 'number', min: 12, max: 24 },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
    { key: 'reveals', label: 'Auftauchen von Mr. X', type: 'select', values: [{ value: 'normal', label: 'Normal (3, 8, 13, 18, 24)' }, { value: 'often', label: 'Alle 3 Züge' }, { value: 'rare', label: 'Alle 6 Züge' }] },
  ];
  defaultSettings() { return { rounds: 24, turnTime: 60, reveals: 'normal' }; }
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 6, scoreLabel: 'Siege', winPoints: 1 });
    this.xChoice = null; this.xId = null; this.positions = {}; this.tickets = {}; this.travel = []; this.candidates = []; this.lastSeen = null; this.doublePending = false;
  }
  chooseX(id, target) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Rollen lassen sich nur zwischen den Partien ändern');
    if (target !== null && !this.seats.includes(target)) throw new Error('Mr. X muss am Tisch mitspielen');
    this.xChoice = target;
  }
  get detectives() { return this.order.filter((id) => id !== this.xId && Object.hasOwn(this.positions, id)); }
  setupRound() {
    this.xId = this.order.includes(this.xChoice) ? this.xChoice : this.order[0];
    this.order = [this.xId, ...this.order.filter((id) => id !== this.xId)]; this.turn = 0;
    this.positions = {}; this.tickets = {}; this.travel = []; this.lastSeen = null; this.doublePending = false;
    const starts = shuffle([1, 7, 25, 43, 49]);
    for (const id of this.order.slice(1)) { this.positions[id] = starts.pop(); this.tickets[id] = { taxi: 10, bus: 8, underground: 4 }; }
    const occupied = Object.values(this.positions);
    this.positions[this.xId] = shuffle(CITY.nodes.map((n) => n.id).filter((n) => !occupied.includes(n)))[0];
    this.tickets[this.xId] = { taxi: 4, bus: 3, underground: 3, black: 5, double: 2 };
    this.candidates = CITY.nodes.map((n) => n.id).filter((n) => !occupied.includes(n));
    this.say(`${this.name(this.xId)} ist Mr. X. Die Fahndung beginnt.`);
  }
  revealAt(move) { return move === this.settings.rounds || (this.settings.reveals === 'normal' ? [3, 8, 13, 18, 24].includes(move) : move % (this.settings.reveals === 'often' ? 3 : 6) === 0); }
  legal(id, at = this.positions[id], wallet = this.tickets[id]) {
    if (!wallet || !Number.isInteger(at)) return [];
    const blocked = new Set(this.detectives.filter((p) => p !== id).map((p) => this.positions[p]));
    return [...MODES, ...(id === this.xId ? ['black'] : [])].flatMap((ticket) => wallet[ticket] > 0 ? neighbours(at, ticket).filter((to) => !blocked.has(to)).map((to) => ({ to, ticket })) : []);
  }
  doubleAllowed(move) {
    if (this.doublePending || !this.tickets[this.xId]?.double || this.travel.length + 2 > this.settings.rounds) return false;
    const wallet = { ...this.tickets[this.xId], [move.ticket]: this.tickets[this.xId][move.ticket] - 1 };
    return this.legal(this.xId, move.to, wallet).length > 0;
  }
  win(side, reason) {
    const winners = side === 'x' ? [this.xId] : this.detectives;
    this.finishRound(winners, reason, Object.fromEntries(winners.map((id) => [id, 1])));
  }
  onTurnStart() {
    if (this.phase !== 'playing') return;
    if (this.currentId === this.xId) {
      if (this.travel.length >= this.settings.rounds) { this.win('x', 'Mr. X hat alle Fahndungsrunden überstanden.'); return; }
      if (!this.legal(this.xId).length) { this.win('detectives', 'Mr. X ist eingeschlossen. Die Detektive gewinnen.'); return; }
    }
    if (!this.detectives.some((id) => this.legal(id).length)) { this.win('x', 'Die Detektive können nicht mehr ziehen. Mr. X entkommt.'); return; }
    if (this.currentId !== this.xId && !this.legal(this.currentId).length) {
      this.act(this.currentId, 'kann nicht ziehen und setzt aus'); this.next();
    }
  }
  move(id, to, ticket, double = false) {
    this.requireTurn(id);
    if (!Number.isInteger(to) || typeof ticket !== 'string' || typeof double !== 'boolean') throw new Error('Ungültiger Fahndungszug');
    const move = this.legal(id).find((m) => m.to === to && m.ticket === ticket);
    if (!move) throw new Error('Diese Verbindung ist mit deinen Tickets nicht erreichbar');
    if (double && (id !== this.xId || !this.doubleAllowed(move))) throw new Error('Dieser Doppelzug ist nicht möglich');
    if (double) { this.tickets[id].double--; this.doublePending = true; }
    const second = id === this.xId && this.doublePending && !double;
    this.tickets[id][ticket]--; this.positions[id] = to;
    if (id === this.xId) {
      const step = this.travel.length + 1, visible = this.revealAt(step);
      const blocked = new Set(this.detectives.map((p) => this.positions[p]));
      this.candidates = [...new Set(this.candidates.flatMap((at) => neighbours(at, ticket)))].filter((at) => !blocked.has(at));
      if (visible) { this.lastSeen = { move: step, station: to }; this.candidates = [to]; }
      this.travel.push({ move: step, ticket, ...(visible ? { station: to } : {}), ...(double || second ? { double: true } : {}) });
      // Keine geheime Haltestelle in Verlauf, Sprechblasen oder Zugdetails!
      this.act(id, `${double ? 'Doppelzug · ' : ''}${ticket}${visible ? ` · zeigt sich auf ${to}` : ' · verdeckt'}`);
      this.say(`Mr. X · Zug ${step}: ${ticket}${visible ? ` · Station ${to}` : ''}`);
      if (double) { this.onTurnStart(); return; }
      this.doublePending = false;
    } else {
      this.tickets[this.xId][ticket]++;
      this.act(id, `${ticket} → ${to}`);
      if (to === this.positions[this.xId]) { this.win('detectives', `${this.name(id)} fasst Mr. X auf Station ${to}.`); return; }
      this.candidates = this.candidates.filter((at) => at !== to);
    }
    this.next();
  }
  onTimeout(id) { this.botMove(id); }
  botMove(id, rng = Math.random) {
    const action = chooseMove(this.gameView(id), rng);
    if (action) this.move(id, action.to, action.ticket, action.double);
  }
  onDropOut(p) {
    if (p.id === this.xId) { this.win('detectives', 'Mr. X hat die Fahndung verlassen. Die Detektive gewinnen.'); return; }
    delete this.positions[p.id]; delete this.tickets[p.id];
    if (!this.detectives.length) this.win('x', 'Alle Detektive haben die Fahndung verlassen.');
  }
  publicPlayer(p) { return { role: p.id === this.xId ? 'x' : 'detective', ...(p.id !== this.xId && Object.hasOwn(this.positions, p.id) ? { station: this.positions[p.id] } : {}) }; }
  gameView(id) {
    const own = id === this.xId, over = this.phase === 'over';
    const visible = over || own || this.travel.at(-1)?.station !== undefined;
    const legal = this.phase === 'playing' && this.currentId === id ? this.legal(id).map((m) => ({ ...m, doubleAllowed: own && this.doubleAllowed(m) })) : [];
    return {
      map: CITY, xId: this.xId, isX: own, move: this.travel.length, limit: this.settings.rounds,
      xPosition: visible ? this.positions[this.xId] : null, lastSeen: this.lastSeen ? { ...this.lastSeen } : null,
      travel: this.travel.map((m) => ({ ...m })), candidates: [...this.candidates], doublePending: this.doublePending,
      detectives: this.detectives.map((p) => ({ id: p, station: this.positions[p], tickets: { ...this.tickets[p] } })),
      tickets: own ? { ...this.tickets[this.xId] } : this.tickets[id] ? { ...this.tickets[id] } : null,
      legal, canDouble: legal.some((m) => m.doubleAllowed),
    };
  }
  view(id) { return { ...super.view(id), xChoice: this.seats.includes(this.xChoice) ? this.xChoice : null }; }
  saveExtra() { return { xChoice: this.xChoice }; }
  loadExtra(extra) { this.xChoice = this.seats.includes(extra.xChoice) ? extra.xChoice : null; }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}

// Ausschließlich die persönliche Ansicht verwenden. Detektiv-Bots sehen Mr. X nicht.
export function chooseMove(g, rng = Math.random) {
  if (!g.legal.length) return null;
  const other = g.detectives.map((p) => p.station), target = g.xPosition !== null ? [g.xPosition] : g.candidates;
  let best = null;
  for (const m of g.legal) {
    const d = distances(m.to);
    const score = g.isX
      ? Math.min(...other.map((p) => d.get(p))) * 10 + neighbours(m.to, 'black').length - (m.ticket === 'black' ? 1.5 : 0) + rng()
      : -(target.reduce((sum, at) => sum + d.get(at), 0) / Math.max(1, target.length)) * 5 + (target.includes(m.to) ? 5 : 0) + Math.min(...other.filter((at) => at !== m.to).map((at) => d.get(at)), 3) + rng();
    if (!best || score > best.score) best = { ...m, score };
  }
  const nearest = g.isX ? Math.min(...other.map((at) => distances(g.xPosition).get(at))) : Infinity;
  return { to: best.to, ticket: best.ticket, double: g.isX && best.doubleAllowed && nearest <= 1 };
}
