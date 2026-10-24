// Schocken – Würfelspiel mit drei Würfeln und 13 Deckeln. Hausregeln (vereinfacht, eine „Hälfte“ pro Runde):
// Jeder würfelt nacheinander bis zu dreimal; Würfel kann man liegen lassen und den Rest neu werfen.
// Wie oft gewürfelt werden darf, legt der Erste fest (seine Wurfzahl gilt für alle danach).
// Wertung (hoch nach niedrig): Schock out (1-1-1) > Schock X (1-1-X) > General (drei Gleiche) > Straße (drei in Folge) > Zahl (höchste zuerst, z. B. 6-5-3).
// Gleichstand: weniger Würfe ist besser, dann wer früher dran war.
// Der Schlechteste bekommt Deckel: Schock X = X, General = 3, Straße = 2, Zahl = 1 (nach dem Wurf des Besten).
// Erst vom Stapel in der Mitte, ist der leer, vom Besten. Wer dann keinen Deckel hat, ist raus.
// Wer am Ende alle 13 hat – oder gegen einen Schock out verliert –, verliert die Hälfte. Wertung: verlorene Hälften (wenig ist gut).
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const DECKEL = 13;

// Wert eines Wurfs: höher ist besser
export function judge(d) {
  const s = [...d].sort((a, b) => b - a);
  const ones = d.filter((x) => x === 1).length;
  if (ones === 3) return { cat: 6, val: 0, name: 'Schock out', deckel: DECKEL };
  if (ones === 2) return { cat: 5, val: s[0], name: `Schock ${s[0]}`, deckel: s[0] };
  if (s[0] === s[2]) return { cat: 4, val: s[0], name: `General ${s[0]}`, deckel: 3 };
  if (s[0] - 1 === s[1] && s[1] - 1 === s[2]) return { cat: 3, val: s[0], name: `Straße ${s[2]}-${s[1]}-${s[0]}`, deckel: 2 };
  return { cat: 2, val: s[0] * 100 + s[1] * 10 + s[2], name: s.join('-'), deckel: 1 };
}

export class Room extends TurnRoom {
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: true, scoreLabel: 'verlorene Hälften' });
    this.roll = die;
    this.resetHalf();
  }
  resetHalf() {
    this.stack = DECKEL; this.held = {};
    this.dice = {}; this.kept = {}; this.throws = {}; this.done = new Set();
    this.maxThrows = 3; this.lastPass = null;
  }

  setupRound() {
    this.resetHalf();
    this.halfPlayers = [...this.order]; // wer diese Hälfte angefangen hat
    for (const id of this.order) this.held[id] = 0;
    this.startPass(0);
  }

  // Ein Durchgang: jeder würfelt einmal reihum, angefangen bei start
  startPass(start) {
    this.turn = start;
    this.dice = {}; this.kept = {}; this.throws = {}; this.done = new Set();
    this.maxThrows = 3;
    this.passFirst = this.order[start];
    this.passOrder = [...this.order.slice(start), ...this.order.slice(0, start)];
  }

  // Würfeln: keep = Indizes der Würfel, die liegen bleiben (beim ersten Wurf egal)
  throwDice(id, keep = []) {
    this.requireTurn(id);
    const n = this.throws[id] || 0;
    if (n >= this.maxThrows) throw new Error(`Mehr als ${this.maxThrows} Würfe gehen nicht`);
    const old = this.dice[id];
    const hold = new Set(old ? keep.filter((i) => Number.isInteger(i) && i >= 0 && i < 3) : []);
    if (old && hold.size === 3) throw new Error('Mindestens einen Würfel neu werfen');
    this.dice[id] = [0, 1, 2].map((i) => (hold.has(i) ? old[i] : this.roll()));
    this.kept[id] = [0, 1, 2].map((i) => hold.has(i));
    this.throws[id] = n + 1;
    if (this.throws[id] >= this.maxThrows) this.finishThrow(id);
  }

  // Fertig: der Wurf zählt
  stop(id) {
    this.requireTurn(id);
    if (!this.throws[id]) throw new Error('Erst würfeln');
    this.finishThrow(id);
  }

  finishThrow(id) {
    if (id === this.passFirst) this.maxThrows = this.throws[id]; // der Erste legt die Wurfzahl fest
    this.done.add(id);
    this.say(`${this.name(id)}: ${judge(this.dice[id]).name} (${this.throws[id]}× gewürfelt)`, 'info', 'action');
    if (this.passOrder.every((p) => this.done.has(p) || !this.order.includes(p))) return this.evaluate();
    this.next(1);
  }

  // Wer im Durchgang am besten bzw. am schlechtesten war
  ranking() {
    const ids = this.passOrder.filter((p) => this.order.includes(p) && this.dice[p]);
    const key = (p) => { const j = judge(this.dice[p]); return [j.cat, j.val, -this.throws[p], -ids.indexOf(p)]; };
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
    const sorted = [...ids].sort(cmp);
    return { worst: sorted[0], best: sorted[sorted.length - 1] };
  }

  evaluate() {
    const { worst, best } = this.ranking();
    const j = judge(this.dice[best]);
    if (j.cat === 6) {
      this.say(`Schock out von ${this.name(best)}!`, 'win');
      return this.loseHalf(worst);
    }
    let n = j.deckel;
    if (this.stack > 0) {
      n = Math.min(n, this.stack);
      this.stack -= n;
      this.held[worst] += n;
      this.say(`${this.name(worst)} bekommt ${n} Deckel vom Stapel (${j.name} von ${this.name(best)})`, 'win');
    } else {
      n = Math.min(n, this.held[best]);
      this.held[best] -= n; this.held[worst] += n;
      this.say(`${this.name(best)} gibt ${this.name(worst)} ${n} Deckel (${j.name})`, 'win');
    }
    this.lastPass = { best, worst, name: j.name, deckel: n, dice: { ...this.dice } };
    if (this.stack === 0) {
      // Ohne Deckel ist man raus
      for (const p of [...this.order]) {
        if (this.held[p] === 0) { this.say(`${this.name(p)} hat keinen Deckel mehr und ist raus`); this.order.splice(this.order.indexOf(p), 1); }
      }
      if (this.order.length === 1) return this.loseHalf(this.order[0]);
    }
    this.startPass(Math.max(0, this.order.indexOf(worst))); // der Verlierer fängt an
  }

  loseHalf(id) {
    const winners = this.halfPlayers.filter((p) => p !== id);
    this.finishRound(winners, `${this.name(id)} verliert die Hälfte`, { [id]: 1 });
  }

  onDropOut(p) {
    // Seine Deckel gehen zurück in die Mitte
    this.stack += this.held[p.id] || 0;
    this.held[p.id] = 0;
    this.passOrder = (this.passOrder || []).filter((x) => x !== p.id);
  }

  publicPlayer(p) { return { deckel: this.held[p.id] ?? 0 }; }

  gameView() {
    return {
      stack: this.stack, maxThrows: this.maxThrows, first: this.passFirst,
      dice: this.dice, kept: this.kept, throws: this.throws, done: [...this.done],
      judged: Object.fromEntries(Object.entries(this.dice).map(([p, d]) => [p, judge(d).name])),
      lastPass: this.lastPass,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
