import { Room, FIELDS, totals, isKniffel } from './room.js';
import { TurnRoom } from '../../server/turn-room.js';
export class TripleRoom extends Room {
  setupRound() {
    super.setupRound();
    this.columns = Object.fromEntries(this.order.map((id) => [id, [this.sheets[id], ...[1, 2].map(() => Object.fromEntries(FIELDS.map((f) => [f, null])))]]));
    this.columnExtra = Object.fromEntries(this.order.map((id) => [id, [0, 0, 0]]));
  }
  filled(id) { return (this.columns[id] || []).reduce((n, sheet) => n + FIELDS.filter((f) => sheet[f] !== null).length, 0); }
  optionsFor(id, column) { const original = this.sheets[id]; this.sheets[id] = this.columns[id][column]; try { return super.options(id); } finally { this.sheets[id] = original; } }
  options(id) { return this.optionsFor(id, 0); }
  score(id, field, column = 0) {
    this.requireTurn(id);
    if (!this.rolls) throw new Error('Erst würfeln');
    if (!Number.isInteger(column) || column < 0 || column > 2 || !FIELDS.includes(field)) throw new Error('Wähle ein Feld in einer der drei Spalten');
    const sheet = this.columns[id][column], opts = this.optionsFor(id, column);
    if (sheet[field] !== null || !(field in opts)) throw new Error('Dieses Feld ist belegt oder durch die Joker-Regel gesperrt');
    if (this.settings.extraBonus && isKniffel(this.dice) && sheet.kniffel === 50) this.columnExtra[id][column] += 50;
    this.extra[id] = this.columnExtra[id][0];
    sheet[field] = opts[field]; this.act(id, `${field}: ${opts[field]} in Spalte ×${column + 1}`);
    if (this.order.every((p) => this.filled(p) === 39)) return this.finish();
    this.next();
  }
  total(id) { return this.columns[id].reduce((n, sheet, i) => n + totals(sheet, this.columnExtra[id][i]).total * (i + 1), 0); }
  finish() {
    const points = Object.fromEntries(this.order.map((id) => [id, this.total(id)])), best = Math.max(...Object.values(points)), winners = this.order.filter((id) => points[id] === best);
    this.finishRound(winners, `${winners.map((id) => this.name(id)).join(' und ')} gewinnt Dreifach-Kniffel mit ${best} Punkten`, points);
  }
  dropOut(p, message) { TurnRoom.prototype.dropOut.call(this, p, message); if (this.phase === 'playing' && this.order.every((id) => this.filled(id) === 39)) this.finish(); }
  publicPlayer(p) { return this.columns?.[p.id] ? { total: this.total(p.id), filled: this.filled(p.id) } : { total: null, filled: 0 }; }
  gameView(id) {
    const g = super.gameView(id);
    return { ...g, columnSheets: this.columns, columnTotals: Object.fromEntries(this.order.map((p) => [p, this.columns[p].map((sheet, i) => totals(sheet, this.columnExtra[p][i]))])), optionsByColumn: id === this.currentId && this.rolls > 0 ? [0, 1, 2].map((i) => this.optionsFor(id, i)) : null };
  }
  botMove(id) {
    if (!this.rolls) return this.throwDice(id);
    if (this.rolls < 3) { const counts = this.dice.map((v) => this.dice.filter((x) => x === v).length), best = this.dice[counts.indexOf(Math.max(...counts))]; const keep = this.dice.map((v, i) => v === best ? i : -1).filter((i) => i >= 0); if (keep.length < 5) return this.throwDice(id, keep); }
    const choices = [0, 1, 2].flatMap((column) => Object.entries(this.optionsFor(id, column)).map(([field, value]) => ({ field, column, rank: value * (column + 1) - (value === 0 ? column : 0) })));
    const best = choices.sort((a, b) => b.rank - a.rank)[0]; return this.score(id, best.field, best.column);
  }
}
