// Schocken – Würfelspiel mit drei Würfeln und 13 Deckeln. Hausregeln (vereinfacht, eine „Halbzeit“ pro Runde):
// Jeder würfelt nacheinander bis zu dreimal; Würfel kann man liegen lassen und den Rest neu werfen.
// Wie oft gewürfelt werden darf, legt der Erste fest (seine Wurfzahl gilt für alle danach).
// Wertung (hoch nach niedrig): Schock aus (1-1-1) > Schock X (1-1-X) > General (drei Gleiche) > Straße (drei in Folge) > Zahl (höchste zuerst, z. B. 6-5-3).
// Gleichstand: weniger Würfe ist besser, dann wer früher dran war.
// Der Schlechteste bekommt Deckel: Schock X = X, General = 3, Straße = 2, Zahl = 1 (nach dem Wurf des Besten).
// Erst vom Stapel in der Mitte, ist der leer, vom Besten. Wer dann keinen Deckel hat, ist raus.
// Wer am Ende alle 13 hat – oder gegen einen Schock aus verliert –, verliert die Halbzeit. Wertung: verlorene Halbzeiten (wenig ist gut).
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const DECKEL = 13;

// Wert eines Wurfs: höher ist besser
export function judge(d) {
  const s = [...d].sort((a, b) => b - a);
  const ones = d.filter((x) => x === 1).length;
  if (ones === 3) return { cat: 6, val: 0, name: 'Schock aus', deckel: DECKEL };
  if (ones === 2) return { cat: 5, val: s[0], name: `Schock ${s[0]}`, deckel: s[0] };
  if (s[0] === s[2]) return { cat: 4, val: s[0], name: `General ${s[0]}`, deckel: 3 };
  if (s[0] - 1 === s[1] && s[1] - 1 === s[2]) return { cat: 3, val: s[0], name: `Straße ${s[2]}-${s[1]}-${s[0]}`, deckel: 2 };
  return { cat: 2, val: s[0] * 100 + s[1] * 10 + s[2], name: s.join('-'), deckel: 1 };
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'sixToOne', label: 'Zwei Sechsen zu einer Eins drehen', type: 'bool' },
    { key: 'fullGame', label: 'Ganzes Spiel: 2 Halbzeiten und Finale', type: 'bool' },
  ];
  defaultSettings() { return { sixToOne: false, fullGame: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: true, scoreLabel: 'verlorene Halbzeiten' });
    this.roll = die;
    this.series = []; // Verlierer der Halbzeiten im laufenden Spiel (Option „Ganzes Spiel“)
    this.finale = null; // [A, B]: die nächste Runde ist das Finale
    this.isFinale = false;
    this.resetHalf();
  }
  resetGame() { this.series = []; this.finale = null; }
  saveExtra() { return { series: this.series, finale: this.finale }; }
  loadExtra(x) { this.series = x.series || []; this.finale = x.finale || null; }
  resetHalf() {
    this.stack = DECKEL; this.held = {};
    this.dice = {}; this.kept = {}; this.throws = {}; this.done = new Set();
    this.forced = {}; this.reroll = {};
    this.maxThrows = 3; this.lastPass = null;
  }

  setupRound() {
    this.resetHalf();
    // Finale: nur die beiden Verlierer der Halbzeiten (wenn beide noch mitspielen)
    this.isFinale = false;
    if (this.settings.fullGame && this.finale) {
      const both = this.finale.filter((id) => this.order.includes(id));
      if (both.length === 2) { this.order = both; this.isFinale = true; this.say(`Finale: ${this.name(both[0])} gegen ${this.name(both[1])}`, 'warn'); }
      else { this.finale = null; this.series = []; }
    }
    this.halfPlayers = [...this.order]; // wer diese Halbzeit angefangen hat
    for (const id of this.order) this.held[id] = 0;
    this.startPass(0);
  }

  // Ein Durchgang: jeder würfelt einmal reihum, angefangen bei start
  startPass(start) {
    this.turn = start;
    this.dice = {}; this.kept = {}; this.throws = {}; this.done = new Set(); this.forced = {}; this.reroll = {};
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
    if (old && this.forced[id] !== undefined) hold.add(this.forced[id]); // gedrehte Eins bleibt liegen
    hold.delete(this.reroll[id]); // die zweite Sechs muss beim nächsten Wurf neu geworfen werden
    if (old && hold.size === 3) throw new Error('Mindestens einen Würfel neu werfen');
    this.dice[id] = [0, 1, 2].map((i) => (hold.has(i) ? old[i] : this.roll()));
    this.kept[id] = [0, 1, 2].map((i) => hold.has(i));
    this.throws[id] = n + 1;
    delete this.reroll[id];
    if (this.throws[id] >= this.maxThrows) this.finishThrow(id);
  }

  // Zwei Sechsen zu einer Eins drehen (mit Option): eine wird zur Eins und bleibt liegen, die andere wird neu geworfen
  turnSixes(id) {
    this.requireTurn(id);
    if (!this.settings.sixToOne) throw new Error('Sechsen drehen ist an diesem Tisch aus');
    const d = this.dice[id];
    if (!d || (this.throws[id] || 0) >= this.maxThrows) throw new Error('Jetzt geht kein Wurf mehr');
    const i = d.indexOf(6), j = d.indexOf(6, i + 1);
    if (i < 0 || j < 0 || this.forced[id] !== undefined) throw new Error('Dafür braucht es zwei Sechsen');
    d[i] = 1;
    this.forced[id] = i;
    this.reroll[id] = j;
    this.kept[id] = [0, 1, 2].map((k) => k === i);
    this.say(`${this.name(id)} dreht zwei Sechsen zu einer Eins`, 'info', 'action');
    this.act(id, '6 + 6 → 1');
  }

  // Fertig: der Wurf zählt
  stop(id) {
    this.requireTurn(id);
    if (!this.throws[id]) throw new Error('Erst würfeln');
    if (this.reroll[id] !== undefined) throw new Error('Nach dem Drehen musst du die zweite Sechs erneut würfeln');
    this.finishThrow(id);
  }

  finishThrow(id) {
    if (id === this.passFirst) this.maxThrows = this.throws[id]; // der Erste legt die Wurfzahl fest
    this.done.add(id);
    this.say(`${this.name(id)}: ${judge(this.dice[id]).name} (${this.throws[id]}× gewürfelt)`, 'info', 'action');
    this.act(id, judge(this.dice[id]).name);
    if (this.passOrder.every((p) => this.done.has(p) || !this.order.includes(p))) return this.evaluate();
    this.next(1);
  }

  // Wer im Durchgang am besten bzw. am schlechtesten war
  ranking() {
    const ids = this.passOrder.filter((p) => this.order.includes(p) && this.dice[p]);
    const key = (p) => { const j = judge(this.dice[p]); return [j.cat, j.val, -this.throws[p], -ids.indexOf(p)]; };
    const cmp = (a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
    const sorted = [...ids].sort(cmp);
    return { worst: sorted[0], best: sorted[sorted.length - 1], sorted };
  }

  evaluate() {
    const { worst, best, sorted } = this.ranking();
    const j = judge(this.dice[best]);
    if (j.cat === 6) {
      this.say(`Schock aus von ${this.name(best)}!`, 'win');
      return this.loseHalf(worst);
    }
    let n = j.deckel;
    const fromStack = this.stack > 0;
    if (fromStack) {
      n = Math.min(n, this.stack);
      this.stack -= n;
      this.held[worst] += n;
      this.say(`${this.name(worst)} bekommt ${n} Deckel vom Stapel (${j.name} von ${this.name(best)})`, 'win');
    } else {
      n = Math.min(n, this.held[best]);
      this.held[best] -= n; this.held[worst] += n;
      this.say(`${this.name(best)} gibt ${this.name(worst)} ${n} Deckel (${j.name})`, 'win');
    }
    // Übersicht des Durchgangs, bester Wurf zuerst
    const rank = [...sorted].reverse().map((p) => ({ id: p, name: judge(this.dice[p]).name, dice: [...this.dice[p]], throws: this.throws[p] }));
    this.lastPass = { best, worst, name: j.name, deckel: n, dice: { ...this.dice }, rank, fromStack };
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
    if (!this.settings.fullGame) return this.finishRound(winners, `${this.name(id)} verliert die Halbzeit`, { [id]: 1 });
    // Ganzes Spiel: zwei Halbzeiten, bei verschiedenen Verlierern ein Finale
    if (this.isFinale) {
      this.series = []; this.finale = null;
      return this.finishRound(winners, `${this.name(id)} verliert das Finale und damit das Spiel`, { [id]: 1 });
    }
    this.series.push(id);
    if (this.series.length === 1) return this.finishRound([], `${this.name(id)} verliert die 1. Halbzeit`);
    const [a, b] = this.series;
    if (a === b) {
      this.series = [];
      return this.finishRound(winners, `${this.name(id)} verliert beide Halbzeiten und damit das Spiel`, { [id]: 1 });
    }
    this.finale = [a, b]; this.series = [];
    this.finishRound([], `${this.name(id)} verliert die 2. Halbzeit – jetzt Finale: ${this.name(a)} gegen ${this.name(b)}`);
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
      lastPass: this.lastPass, forced: this.forced, reroll: this.reroll,
      rank: [...this.ranking().sorted].reverse(), // laufender Durchgang: bester Wurf zuerst (vorläufig, solange nicht alle fertig sind)
      series: this.series.map((p) => this.name(p)), finale: this.isFinale,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
