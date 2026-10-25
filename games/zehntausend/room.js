// Zehntausend – Würfelspiel für 2–8 mit 6 Würfeln. Regeln (Standard):
// Zug: würfeln, mindestens einen punktenden Würfel herauslegen, dann weiterwürfeln (mit den übrigen) oder aufhören und anschreiben.
// Kein punktender Würfel im Wurf = alle Punkte dieses Zuges verloren. Haben alle 6 gepunktet, geht es mit allen 6 weiter.
// Wertung (nur innerhalb eines Wurfs): 1 = 100, 5 = 50; drei gleiche = Augenzahl × 100 (drei 1er = 1.000), vier gleiche = doppelt,
// fünf = vierfach, sechs = achtfach; Straße 1–6 = 2.000 (Hausregel 1.500); drei verschiedene Paare = 1.500 (abschaltbar).
// Jeder herausgelegte Würfel muss punkten. Einstieg: das erste Anschreiben erst ab 350 Punkten in einem Zug (Hausregel 0/350/500).
// Wer zuerst das Ziel (10.000) erreicht, löst die letzte Runde aus: alle anderen haben noch einen Zug (abschaltbar). Am meisten gewinnt.
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

const base = (f) => (f === 1 ? 1000 : f * 100);
// Beste Wertung für genau diese Würfel – jeder Würfel muss punkten, sonst -1
export function scoreDice(vals, { straight = 2000, threePairs = true } = {}) {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const v of vals) c[v]++;
  let best = -1;
  if (vals.length === 6) {
    if ([1, 2, 3, 4, 5, 6].every((f) => c[f] === 1)) best = Math.max(best, straight);
    if (threePairs && c.filter((n) => n === 2).length === 3) best = Math.max(best, 1500);
  }
  // Pasch-Gruppen und einzelne 1er/5er, rekursiv über die Augenzahlen
  const go = (f, acc) => {
    if (f > 6) { best = Math.max(best, acc); return; }
    const n = c[f];
    const single = f === 1 ? 100 : f === 5 ? 50 : 0;
    // k Würfel als Pasch (3–6), der Rest dieser Augenzahl als Einzelne
    for (let k = 0; k <= n; k++) {
      if (k > 0 && k < 3) continue;
      const rest = n - k;
      if (rest && !single) continue;
      go(f + 1, acc + (k ? base(f) * 2 ** (k - 3) : 0) + rest * single);
    }
  };
  if (vals.length) go(1, 0);
  return best > 0 ? best : -1;
}
// Punktet überhaupt etwas in diesem Wurf?
export function canScore(vals, opts) {
  const n = vals.length;
  for (let m = 1; m < 1 << n; m++) if (scoreDice(vals.filter((_, i) => m & (1 << i)), opts) > 0) return true;
  return false;
}
// Die meisten Punkte, die sich aus einem Wurf herauslegen lassen (Bot, Zeit abgelaufen) → Indizes
export function bestTake(vals, opts) {
  let best = null;
  for (let m = 1; m < 1 << vals.length; m++) {
    const idx = vals.map((_, i) => i).filter((i) => m & (1 << i));
    const s = scoreDice(idx.map((i) => vals[i]), opts);
    if (s > 0 && (!best || s > best.points || (s === best.points && idx.length > best.idx.length))) best = { idx, points: s };
  }
  return best;
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'target', label: 'Zielpunktzahl', type: 'number', min: 1000, max: 50000 },
    { key: 'entry', label: 'Einstieg: Punkte fürs erste Anschreiben (0 = sofort)', type: 'number', min: 0, max: 1000 },
    { key: 'straight1500', label: 'Straße zählt 1.500 statt 2.000', type: 'bool' },
    { key: 'threePairs', label: 'Drei Paare zählen 1.500', type: 'bool' },
    { key: 'lastRound', label: 'Letzte Runde: nach dem Ziel haben alle anderen noch einen Zug', type: 'bool' },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { target: 10000, entry: 350, straight1500: false, threePairs: true, lastRound: true, turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: false, scoreLabel: 'Punkte' });
    this.roll = die; // Tests würfeln selbst
    this.banked = {}; this.entered = new Set(); this.final = null;
    this.resetTurn();
  }
  scoring() { return { straight: this.settings.straight1500 ? 1500 : 2000, threePairs: this.settings.threePairs }; }
  resetTurn() { this.dice = []; this.rolled = false; this.turnPoints = 0; this.aside = []; this.remaining = 6; this.lastLoss = null; }
  setupRound() {
    this.banked = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.entered = new Set();
    this.final = null; // { by, left: Set } – letzte Runde
    this.resetTurn();
  }
  onTurnStart() { const loss = this.lastLoss; this.resetTurn(); this.lastLoss = loss; }
  canBank(id) { return this.turnPoints > 0 && !this.rolled && (this.entered.has(id) || this.turnPoints >= this.settings.entry); }

  throwDice(id) {
    this.requireTurn(id);
    if (this.rolled) throw new Error('Erst punktende Würfel herauslegen');
    this.lastLoss = null;
    this.dice = Array.from({ length: this.remaining }, () => this.roll());
    this.say(`${this.name(id)} würfelt ${this.dice.join(' ')}`, 'info', 'action');
    this.act(id, `würfelt ${this.dice.join(' ')}`);
    if (!canScore(this.dice, this.scoring())) {
      this.say(`Nichts punktet – ${this.turnPoints ? `${this.turnPoints} Punkte verloren` : 'Zug vorbei'}`, 'warn');
      this.act(id, this.turnPoints ? `Niete: −${this.turnPoints}` : 'Niete');
      this.lastLoss = { id, points: this.turnPoints, dice: [...this.dice] };
      this.turnPoints = 0;
      return this.endTurn(id);
    }
    this.rolled = true;
  }

  take(id, indexes) {
    this.requireTurn(id);
    if (!this.rolled) throw new Error('Erst würfeln');
    const idx = [...new Set((indexes || []).map(Number))].filter((i) => i >= 0 && i < this.dice.length);
    if (!idx.length) throw new Error('Mindestens einen punktenden Würfel herauslegen');
    const vals = idx.map((i) => this.dice[i]);
    const pts = scoreDice(vals, this.scoring());
    if (pts <= 0) throw new Error('Jeder herausgelegte Würfel muss punkten');
    this.turnPoints += pts;
    this.aside.push({ dice: vals, points: pts });
    this.remaining -= idx.length;
    this.dice = this.dice.filter((_, i) => !idx.includes(i));
    this.rolled = false;
    this.say(`${this.name(id)} legt ${vals.join(' ')} heraus: +${pts} (Zug ${this.turnPoints})`, 'info', 'action');
    this.act(id, `+${pts} (${this.turnPoints})`);
    if (this.remaining === 0) {
      this.remaining = 6; this.dice = [];
      this.say('Alle sechs haben gepunktet – weiter mit allen sechs!', 'react');
      this.act(id, 'alle sechs!');
    }
  }

  bank(id) {
    this.requireTurn(id);
    if (this.rolled) throw new Error('Erst punktende Würfel herauslegen');
    if (!this.turnPoints) throw new Error('Noch keine Punkte in diesem Zug');
    if (!this.canBank(id)) throw new Error(`Zum Einstieg brauchst du mindestens ${this.settings.entry} Punkte in einem Zug`);
    this.banked[id] += this.turnPoints;
    this.entered.add(id);
    this.say(`${this.name(id)} schreibt ${this.turnPoints} an (gesamt ${this.banked[id]})`, 'win');
    this.act(id, `schreibt ${this.turnPoints} an`);
    if (!this.final && this.banked[id] >= this.settings.target) {
      if (!this.settings.lastRound) return this.finish();
      this.final = { by: id, left: new Set(this.order.filter((p) => p !== id)) };
      this.say(`${this.name(id)} hat ${this.settings.target} erreicht – alle anderen haben noch einen Zug`, 'warn');
    }
    this.endTurn(id);
  }

  endTurn(id) {
    if (this.final) {
      this.final.left.delete(id);
      if (!this.final.left.size) return this.finish();
    }
    this.next(1);
    // In der letzten Runde ist nur dran, wer noch einen Zug hat
    if (this.final) for (let k = 0; k < this.order.length && !this.final.left.has(this.currentId); k++) this.next(1);
  }
  finish() {
    const best = Math.max(...this.order.map((p) => this.banked[p]));
    const winners = this.order.filter((p) => this.banked[p] === best);
    const list = [...this.order].sort((a, b) => this.banked[b] - this.banked[a]).map((p) => `${this.name(p)} ${this.banked[p].toLocaleString('de-DE')}`).join(', ');
    this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} ${winners.length > 1 ? 'gewinnen' : 'gewinnt'} mit ${best.toLocaleString('de-DE')} Punkten (${list})`,
      Object.fromEntries(this.order.map((p) => [p, this.banked[p]])));
  }

  // Zeit abgelaufen: alle punktenden Würfel herauslegen, dann aufhören, wenn das geht – sonst weiterwürfeln
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam – der Computer spielt den Schritt`, 'warn');
    if (this.rolled) { this.take(id, bestTake(this.dice, this.scoring()).idx); }
    if (this.currentId !== id) return;
    if (this.canBank(id)) this.bank(id); else this.throwDice(id);
  }
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.final) { this.final.left.delete(p.id); if (this.phase === 'playing' && !this.final.left.size) this.finish(); }
  }

  publicPlayer(p) { return this.banked[p.id] === undefined ? { score: null } : { banked: this.banked[p.id], entered: this.entered.has(p.id), lastTurn: !!this.final?.left.has(p.id) }; }
  gameView() {
    return {
      dice: [...this.dice], rolled: this.rolled, remaining: this.remaining, aside: this.aside, turnPoints: this.turnPoints,
      banked: { ...this.banked }, entered: [...this.entered], final: this.final ? { by: this.final.by, left: [...this.final.left] } : null,
      lastLoss: this.lastLoss, target: this.settings.target, entry: this.settings.entry, scoring: this.scoring(),
      canBank: this.phase === 'playing' && this.canBank(this.currentId),
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
