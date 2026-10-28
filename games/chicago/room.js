// Chicago – elf Runden mit zwei Würfeln (2–6 Spieler). In Runde 1 ist die Zielzahl 2, dann 3 … bis 12 in Runde 11.
// Reihum würfelt jeder einmal mit beiden Würfeln. Ergibt die Augensumme genau die Zielzahl, bekommt man diese Zahl als Punkte.
// Nach Runde 11 gewinnt, wer die meisten Punkte hat. Bei Gleichstand an der Spitze würfeln diese Spieler im Stechen (Summe, höhere gewinnt, sonst nochmal).
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const ROUNDS = 11;

export class Room extends TurnRoom {
  static OPTIONS = [];
  defaultSettings() { return {}; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Punkte', winPoints: 1 });
    this.roll = die; // Tests würfeln selbst
    this.points = {}; this.rolled = {}; this.rnd = 1; this.stage = 'main'; this.contenders = []; this.history = [];
  }
  get target() { return this.rnd + 1; }

  setupRound() {
    this.points = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.rolled = {}; this.rnd = 1; this.stage = 'main'; this.contenders = []; this.history = [];
    this.say(`Runde 1 von ${ROUNDS}: Zielzahl ${this.target}`, 'cards');
  }
  // Im Stechen würfeln nur die, die vorne liegen
  onTurnStart() {
    if (this.stage !== 'tie') return;
    for (let n = 0; n < this.order.length && !this.contenders.includes(this.currentId); n++) this.turn = (this.turn + 1) % this.order.length;
  }

  throwDice(id) {
    this.requireTurn(id);
    const dice = [this.roll(), this.roll()];
    const sum = dice[0] + dice[1];
    this.rolled[id] = dice;
    if (this.stage === 'main') {
      const hit = sum === this.target;
      if (hit) this.points[id] += this.target;
      this.say(`${this.name(id)} würfelt ${dice[0]} + ${dice[1]} = ${sum}${hit ? ` – Treffer, +${this.target}` : ''}`, 'info', 'action');
      this.act(id, `${dice[0]} + ${dice[1]} = ${sum}${hit ? ' ✓' : ''}`);
    } else {
      this.say(`${this.name(id)} würfelt im Stechen ${dice[0]} + ${dice[1]} = ${sum}`, 'info', 'action');
      this.act(id, `Stechen: ${sum}`);
    }
    const group = this.stage === 'main' ? this.order : this.contenders;
    if (!group.every((p) => this.rolled[p])) return this.next(1);
    this.endRound();
  }

  endRound() {
    if (this.stage === 'tie') {
      const sums = Object.fromEntries(this.contenders.map((id) => [id, this.rolled[id][0] + this.rolled[id][1]]));
      const best = Math.max(...Object.values(sums));
      const top = this.contenders.filter((id) => sums[id] === best);
      if (top.length === 1) return this.finish(top[0]);
      this.say(`Stechen unentschieden (${best}) – ${top.map((id) => this.name(id)).join(' und ')} würfeln nochmal`, 'warn');
      this.contenders = top; this.rolled = {};
      this.turn = this.order.indexOf(top[0]);
      this.moveNo++;
      return;
    }
    this.history.push({ round: this.rnd, target: this.target, rolls: Object.fromEntries(Object.entries(this.rolled).map(([id, d]) => [id, [...d]])) });
    if (this.rnd < ROUNDS) {
      this.rnd++; this.rolled = {};
      this.say(`Runde ${this.rnd} von ${ROUNDS}: Zielzahl ${this.target}`, 'cards');
      this.turn = 0; this.moveNo++;
      return;
    }
    const best = Math.max(...Object.values(this.points));
    const top = this.order.filter((id) => this.points[id] === best);
    if (top.length === 1) return this.finish(top[0]);
    this.say(`Gleichstand mit ${best} Punkten – Stechen zwischen ${top.map((id) => this.name(id)).join(' und ')}`, 'warn');
    this.stage = 'tie'; this.contenders = top; this.rolled = {};
    this.turn = this.order.indexOf(top[0]); this.moveNo++;
  }

  finish(id) { this.finishRound([id], `${this.name(id)} gewinnt Chicago mit ${this.points[id]} Punkten`, { ...this.points }); }

  onDropOut(p) {
    delete this.rolled[p.id]; delete this.points[p.id];
    this.contenders = this.contenders.filter((x) => x !== p.id);
  }
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase !== 'playing') return;
    const group = this.stage === 'main' ? this.order : this.contenders;
    if (group.length && group.every((id) => this.rolled[id])) this.endRound();
    else if (this.stage === 'tie' && this.contenders.length === 1) this.finish(this.contenders[0]);
  }

  publicPlayer(p) { return { chicago: this.points[p.id] ?? 0 }; }
  gameView() {
    return {
      round: this.rnd, rounds: ROUNDS, target: this.target, points: { ...this.points },
      rolled: Object.fromEntries(Object.entries(this.rolled).map(([id, d]) => [id, [...d]])),
      stage: this.stage, contenders: [...this.contenders], history: this.history.slice(-ROUNDS),
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
