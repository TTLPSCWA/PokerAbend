// Würfelpoker – fünf Würfel, die beste Pokerhand gewinnt die Runde, der Schlechteste bekommt einen Strich (2–6 Spieler).
// Pro Zug bis zu drei Würfe; nach jedem Wurf legt man beliebige Würfel beiseite (sie bleiben liegen) und würfelt den Rest neu.
// Wer in einer Runde als Erster dran ist, darf bis zu dreimal würfeln und legt damit fest, wie oft alle anderen höchstens würfeln dürfen.
// Hände von oben nach unten: Fünfling, Vierling, Full House, große Straße (2–6), kleine Straße (1–5), Drilling, zwei Paare, Paar, hohe Karte.
// Bei gleicher Hand entscheidet die höhere Augenzahl. Wer die schlechteste Hand hat, bekommt einen Strich (bei Gleichstand alle Betroffenen,
// haben alle dasselbe, gibt es keinen). Wer die eingestellte Strichzahl erreicht, scheidet aus. Der Letzte gewinnt.
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const CATEGORIES = ['Hohe Karte', 'Ein Paar', 'Zwei Paare', 'Drilling', 'Kleine Straße', 'Große Straße', 'Full House', 'Vierling', 'Fünfling'];

// Wertung als Liste: zuerst die Kategorie, dann die Augenzahlen, die entscheiden
export function evaluate(dice) {
  const count = Array(7).fill(0);
  for (const d of dice) count[d]++;
  const groups = [1, 2, 3, 4, 5, 6].filter((f) => count[f]).sort((a, b) => count[b] - count[a] || b - a);
  const top = count[groups[0]];
  const sorted = [...dice].sort((a, b) => b - a);
  if (top === 5) return [8, groups[0]];
  if (top === 4) return [7, groups[0], groups[1]];
  if (top === 3 && count[groups[1]] === 2) return [6, groups[0], groups[1]];
  if (groups.length === 5) {
    if (!count[1]) return [5, 6]; // 2–6
    if (!count[6]) return [4, 5]; // 1–5
  }
  if (top === 3) return [3, groups[0], ...groups.slice(1)];
  if (top === 2 && count[groups[1]] === 2) return [2, groups[0], groups[1], groups[2]];
  if (top === 2) return [1, groups[0], ...groups.slice(1)];
  return [0, ...sorted];
}
export function compare(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'strikes', label: 'Striche bis zum Ausscheiden', type: 'number', min: 1, max: 9 }];
  defaultSettings() { return { strikes: 3 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.roll = die; // Tests würfeln selbst
    this.strikes = {}; this.results = {}; this.limit = null; this.last = null; this.hands = 0;
    this.dice = [0, 0, 0, 0, 0]; this.kept = []; this.throws = 0;
  }

  setupRound() {
    this.strikes = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.results = {}; this.limit = null; this.last = null; this.hands = 1;
  }
  onTurnStart() { this.dice = [0, 0, 0, 0, 0]; this.kept = []; this.throws = 0; }

  get first() { return this.order.every((id) => !this.results[id]); } // noch niemand in dieser Runde fertig
  maxThrows() { return this.limit ?? 3; }

  // Würfeln: im ersten Wurf alle, danach alle außer den beiseitegelegten (keep = Nummern der Würfel, die liegen bleiben)
  throwDice(id, keep = []) {
    this.requireTurn(id);
    if (this.throws >= this.maxThrows()) throw new Error('Du hast keine Würfe mehr');
    if (this.throws === 0) this.dice = this.dice.map(() => this.roll());
    else {
      const k = new Set((Array.isArray(keep) ? keep : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < 5));
      if (k.size === 5) throw new Error('Du musst mindestens einen Würfel neu würfeln');
      this.dice = this.dice.map((d, i) => (k.has(i) ? d : this.roll()));
      this.kept = [...k];
    }
    this.throws++;
    this.act(id, `${this.throws}. Wurf: ${this.dice.join(' ')}`);
    if (this.throws >= this.maxThrows()) this.finishTurn(id);
  }
  stop(id) {
    this.requireTurn(id);
    if (!this.throws) throw new Error('Würfle erst');
    this.finishTurn(id);
  }

  finishTurn(id) {
    const ev = evaluate(this.dice);
    if (this.first) { this.limit = this.throws; if (this.limit < 3) this.say(`${this.name(id)} hört nach ${this.limit} ${this.limit === 1 ? 'Wurf' : 'Würfen'} auf – alle anderen würfeln höchstens ${this.limit}×`, 'warn'); }
    this.results[id] = { dice: [...this.dice], ev, name: CATEGORIES[ev[0]] };
    this.say(`${this.name(id)}: ${this.dice.join(' ')} – ${CATEGORIES[ev[0]]}`, 'info', 'action');
    this.act(id, CATEGORIES[ev[0]]);
    if (this.order.every((p) => this.results[p])) return this.resolve();
    this.next(1);
  }

  resolve() {
    const ids = [...this.order];
    const worst = ids.reduce((w, id) => (compare(this.results[id].ev, this.results[w].ev) < 0 ? id : w), ids[0]);
    const losers = ids.filter((id) => compare(this.results[id].ev, this.results[worst].ev) === 0);
    const tie = losers.length === ids.length;
    this.last = { no: this.hands, results: Object.fromEntries(ids.map((id) => [id, { dice: this.results[id].dice, name: this.results[id].name }])), losers: tie ? [] : losers };
    if (tie) this.say('Alle haben dasselbe – kein Strich', 'warn');
    const out = [];
    if (!tie) for (const id of losers) {
      this.strikes[id]++;
      this.say(`${this.name(id)} bekommt einen Strich (${this.strikes[id]} von ${this.settings.strikes})`, 'win');
      if (this.strikes[id] >= this.settings.strikes) out.push(id);
    }
    const startId = (!tie && losers.find((id) => !out.includes(id))) || this.order[(this.turn + 1) % this.order.length];
    for (const id of out) { this.say(`${this.name(id)} scheidet aus`, 'win'); this.order.splice(this.order.indexOf(id), 1); }
    if (this.order.length === 1) {
      const w = this.order[0];
      return this.finishRound([w], `${this.name(w)} gewinnt Würfelpoker`, { [w]: 1 });
    }
    // Wenn alle Übrigen ausschieden (z. B. alle gleichzeitig), wird neu gewürfelt statt abzubrechen – sie sind ja noch drin
    this.results = {}; this.limit = null; this.hands++;
    this.turn = Math.max(0, this.order.indexOf(startId));
    this.onTurnStart();
    this.moveNo++;
  }

  onDropOut(p) { delete this.results[p.id]; delete this.strikes[p.id]; }
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.order.length > 1 && this.order.every((id) => this.results[id])) this.resolve();
  }

  publicPlayer(p) { return { strikes: this.strikes[p.id] ?? 0, out: this.phase !== 'lobby' && this.seats.includes(p.id) && !this.order.includes(p.id) && p.id in this.strikes }; }
  gameView() {
    return {
      dice: [...this.dice], kept: [...this.kept], throws: this.throws, maxThrows: this.maxThrows(), limit: this.limit,
      results: Object.fromEntries(Object.entries(this.results).map(([id, r]) => [id, { dice: r.dice, name: r.name }])),
      last: this.last, hands: this.hands, strikesMax: this.settings.strikes,
      current: this.throws ? CATEGORIES[evaluate(this.dice)[0]] : null,
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
