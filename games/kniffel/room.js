// Kniffel – Würfelspiel für 1–6. Regeln (Standard):
// 5 Würfel, pro Zug bis zu 3 Würfe; zwischen den Würfen Würfel liegen lassen. Nach dem Zug genau ein freies Feld eintragen
// (auch 0 Punkte = streichen). Oben: Einser bis Sechser = Summe dieser Augen, Bonus 35 ab 63 Punkten oben.
// Unten: Dreierpasch und Viererpasch (Summe aller Würfel), Full House 25, Kleine Straße 30, Große Straße 40, Kniffel 50, Chance (Summe).
// 13 Runden, dann gewinnt die höchste Summe. Hausregeln: Extra-Kniffel-Bonus (+50 je weiterem Kniffel, wenn das Kniffel-Feld 50 hat)
// und Joker-Regel (weiterer Kniffel: erst das passende obere Feld, sonst jedes untere mit voller Punktzahl, sonst oben 0).
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const UPPER = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
export const LOWER = ['threeKind', 'fourKind', 'fullHouse', 'smallStraight', 'largeStraight', 'kniffel', 'chance'];
export const FIELDS = [...UPPER, ...LOWER];
export const FIELD_NAME = {
  ones: 'Einser', twos: 'Zweier', threes: 'Dreier', fours: 'Vierer', fives: 'Fünfer', sixes: 'Sechser',
  threeKind: 'Dreierpasch', fourKind: 'Viererpasch', fullHouse: 'Full House', smallStraight: 'Kleine Straße', largeStraight: 'Große Straße', kniffel: 'Kniffel', chance: 'Chance',
};
const counts = (d) => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const x of d) c[x]++; return c; };
const sum = (d) => d.reduce((a, b) => a + b, 0);
const run = (d, n) => { const s = new Set(d); for (let a = 1; a + n - 1 <= 6; a++) if ([...Array(n).keys()].every((k) => s.has(a + k))) return true; return false; };
export const isKniffel = (d) => d.length === 5 && d.every((x) => x === d[0]);

// Punkte eines Wurfs in einem Feld (ohne Joker)
export function fieldValue(field, d) {
  const c = counts(d);
  const i = UPPER.indexOf(field);
  if (i >= 0) return c[i + 1] * (i + 1);
  switch (field) {
    case 'threeKind': return c.some((n) => n >= 3) ? sum(d) : 0;
    case 'fourKind': return c.some((n) => n >= 4) ? sum(d) : 0;
    case 'fullHouse': return c.includes(3) && c.includes(2) ? 25 : 0;
    case 'smallStraight': return run(d, 4) ? 30 : 0;
    case 'largeStraight': return run(d, 5) ? 40 : 0;
    case 'kniffel': return isKniffel(d) ? 50 : 0;
    case 'chance': return sum(d);
    default: return 0;
  }
}
// Summen eines Blatts
export function totals(sheet, extra = 0) {
  const upper = UPPER.reduce((a, f) => a + (sheet[f] || 0), 0);
  const bonus = upper >= 63 ? 35 : 0;
  const lower = LOWER.reduce((a, f) => a + (sheet[f] || 0), 0);
  return { upper, bonus, lower, extra, total: upper + bonus + lower + extra };
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'extraBonus', label: 'Extra-Kniffel-Bonus: jeder weitere Kniffel +50', type: 'bool' },
    { key: 'joker', label: 'Joker-Regel bei weiterem Kniffel', type: 'bool' },
  ];
  defaultSettings() { return { extraBonus: false, joker: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 1, maxPlayers: 6, lowWins: false, scoreLabel: 'Punkte' });
    this.roll = die; // Tests würfeln selbst
    this.sheets = {}; this.extra = {};
    this.resetTurn();
  }
  resetTurn() { this.dice = [0, 0, 0, 0, 0]; this.held = [false, false, false, false, false]; this.rolls = 0; }
  setupRound() {
    this.sheets = Object.fromEntries(this.order.map((id) => [id, Object.fromEntries(FIELDS.map((f) => [f, null]))]));
    this.extra = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.resetTurn();
  }
  onTurnStart() { this.resetTurn(); }
  filled(id) { return FIELDS.filter((f) => this.sheets[id][f] !== null).length; }

  throwDice(id, keep = []) {
    this.requireTurn(id);
    if (this.rolls >= 3) throw new Error('Drei Würfe sind vorbei – trag ein Feld ein');
    const hold = new Set(this.rolls ? (keep || []).map(Number).filter((i) => i >= 0 && i < 5) : []);
    if (hold.size === 5) throw new Error('Alle Würfel liegen – trag ein Feld ein');
    this.dice = this.dice.map((v, i) => (hold.has(i) ? v : this.roll()));
    this.held = this.dice.map((_, i) => hold.has(i));
    this.rolls++;
    this.say(`${this.name(id)} würfelt: ${this.dice.join(' ')}`, 'info', 'action');
    this.act(id, `würfelt ${this.dice.join(' ')}`);
  }

  // Welche Felder dürfen jetzt eingetragen werden, mit welchen Punkten? (Joker-Regel beachtet)
  options(id) {
    const sheet = this.sheets[id];
    const free = FIELDS.filter((f) => sheet[f] === null);
    const d = this.dice;
    if (this.settings.joker && isKniffel(d) && sheet.kniffel !== null) {
      const up = UPPER[d[0] - 1];
      if (sheet[up] === null) return { [up]: fieldValue(up, d) };           // erst das passende obere Feld
      const lower = free.filter((f) => LOWER.includes(f));
      if (lower.length) return Object.fromEntries(lower.map((f) => [f, { fullHouse: 25, smallStraight: 30, largeStraight: 40 }[f] ?? fieldValue(f, d)]));
      return Object.fromEntries(free.map((f) => [f, 0]));                  // sonst oben 0
    }
    return Object.fromEntries(free.map((f) => [f, fieldValue(f, d)]));
  }

  score(id, field) {
    this.requireTurn(id);
    if (!this.rolls) throw new Error('Erst würfeln');
    if (!FIELDS.includes(field)) throw new Error('Dieses Feld gibt es nicht');
    if (this.sheets[id][field] !== null) throw new Error('Das Feld ist schon eingetragen');
    const opts = this.options(id);
    if (!(field in opts)) throw new Error('Mit der Joker-Regel geht dieses Feld gerade nicht');
    // Extra-Kniffel-Bonus: weiterer Kniffel, das Kniffel-Feld hat schon 50
    if (this.settings.extraBonus && isKniffel(this.dice) && this.sheets[id].kniffel === 50) {
      this.extra[id] += 50;
      this.say(`${this.name(id)} würfelt noch einen Kniffel: +50 Bonus`, 'react');
    }
    const v = opts[field];
    this.sheets[id][field] = v;
    this.say(`${this.name(id)}: ${FIELD_NAME[field]} ${v ? `${v} Punkte` : 'gestrichen'}`, v ? 'info' : 'warn', 'action');
    this.act(id, field === 'kniffel' && v ? 'Kniffel!' : `${FIELD_NAME[field]} ${v || 'gestrichen'}`);
    // Alle Blätter voll → Endwertung
    if (this.order.every((p) => this.filled(p) === FIELDS.length)) return this.finish();
    this.next(1);
  }

  finish() {
    const sums = Object.fromEntries(this.order.map((p) => [p, totals(this.sheets[p], this.extra[p]).total]));
    const best = Math.max(...Object.values(sums));
    const winners = this.order.filter((p) => sums[p] === best);
    const list = [...this.order].sort((a, b) => sums[b] - sums[a]).map((p) => `${this.name(p)} ${sums[p]}`).join(', ');
    this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} ${winners.length > 1 ? 'gewinnen' : 'gewinnt'} Kniffel mit ${best} Punkten (${list})`, sums);
  }

  // Wer aussteigt, fliegt aus der Wertung; sind die Übrigen schon fertig, ist das Spiel vorbei
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.order.length && this.order.every((x) => this.filled(x) === FIELDS.length)) this.finish();
  }

  publicPlayer(p) {
    const s = this.sheets[p.id];
    return s ? { total: totals(s, this.extra[p.id] || 0).total, filled: this.filled(p.id) } : { total: null, filled: 0 };
  }
  gameView(viewerId) {
    const mine = this.currentId === viewerId && this.phase === 'playing';
    return {
      dice: [...this.dice], held: [...this.held], rolls: this.rolls,
      sheets: this.sheets, extra: this.extra,
      totals: Object.fromEntries(Object.keys(this.sheets).map((id) => [id, totals(this.sheets[id], this.extra[id] || 0)])),
      // Mögliche Punkte nur für den, der dran ist (und erst nach dem ersten Wurf)
      options: mine && this.rolls ? this.options(viewerId) : null,
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
