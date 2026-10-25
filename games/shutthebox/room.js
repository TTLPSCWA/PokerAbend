// Shut the Box – Würfelspiel für 1–8. Regeln (Standard):
// Jeder hat eine eigene Box mit Klappen 1–9 (Hausregel 1–12). Zug: 2 Würfel werfen, dann Klappen schließen, deren Summe genau
// der Augensumme entspricht (eine oder mehrere). Weiterwürfeln, bis keine passende Kombination mehr möglich ist.
// Sind 7, 8 und 9 (bei 1–12: 7 bis 12) zu, darf man wählen, mit nur einem Würfel zu werfen (Hausregel, Standard an).
// Zugende: Punkte = Summe der offenen Klappen (Hausregel: Ziffern hintereinander, z. B. 1, 4, 7 = 147). Weniger ist besser.
// Alle Klappen zu = „Box geschlossen“: 0 Punkte, die Runde ist sofort gewonnen – wer in dieser Runde noch nicht dran war,
// bekommt die volle Summe. Nach der eingestellten Zahl Runden (Standard 5) gewinnt die niedrigste Gesamtsumme.
// Ein Spiel (= eine Runde der Plattform) besteht aus diesen Runden.
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

// Alle Klappen-Kombinationen (aufsteigend), die genau target ergeben
export function combos(open, target) {
  const list = [...open].sort((a, b) => a - b);
  const out = [];
  const go = (i, sum, pick) => {
    if (sum === target) { out.push([...pick]); return; }
    for (let k = i; k < list.length && sum + list[k] <= target; k++) { pick.push(list[k]); go(k + 1, sum + list[k], pick); pick.pop(); }
  };
  go(0, 0, []);
  return out;
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'rounds', label: 'Runden', type: 'number', min: 1, max: 20 },
    { key: 'twelve', label: 'Klappen 1–12 statt 1–9', type: 'bool' },
    { key: 'oneDie', label: 'Ein-Würfel-Regel (wenn 7 bis zur höchsten Klappe zu sind)', type: 'bool' },
    { key: 'digits', label: 'Wertung: Ziffern hintereinander statt Summe', type: 'bool' },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { rounds: 5, twelve: false, oneDie: true, digits: false, turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 1, maxPlayers: 8, lowWins: true, scoreLabel: 'Punkte' });
    this.roll = die; // Tests würfeln selbst
    this.boxes = {}; this.results = {}; this.played = new Set(); this.sub = 0;
    this.dice = []; this.pending = false; this.lastShut = null;
  }
  flaps() { return this.settings.twelve ? 12 : 9; }
  full() { const n = this.flaps(); return (n * (n + 1)) / 2; }
  value(open) {
    if (!this.settings.digits) return open.reduce((a, b) => a + b, 0);
    return open.length ? Number([...open].sort((a, b) => a - b).join('')) : 0;
  }
  setupRound() {
    this.results = Object.fromEntries(this.order.map((id) => [id, []]));
    this.sub = 0;
    this.startSub();
  }
  // Neue Runde im Spiel: alle Boxen wieder offen
  startSub() {
    this.sub++;
    this.played = new Set();
    this.boxes = Object.fromEntries(this.order.map((id) => [id, [...Array(this.flaps()).keys()].map((k) => k + 1)]));
    this.dice = []; this.pending = false;
    this.say(`Runde ${this.sub} von ${this.settings.rounds}`, 'cards');
  }
  onTurnStart() { this.dice = []; this.pending = false; }

  canOneDie(id) { return this.settings.oneDie && this.boxes[id].every((f) => f < 7); }

  throwDice(id, count = 2) {
    this.requireTurn(id);
    if (this.pending) throw new Error('Erst Klappen schließen');
    count = Number(count) === 1 ? 1 : 2;
    if (count === 1 && !this.canOneDie(id)) throw new Error(`Mit einem Würfel erst, wenn 7 bis ${this.flaps()} zu sind`);
    this.dice = Array.from({ length: count }, () => this.roll());
    const sum = this.dice.reduce((a, b) => a + b, 0);
    this.say(`${this.name(id)} würfelt ${this.dice.join(' + ')}${count === 2 ? ` = ${sum}` : ''}`, 'info', 'action');
    this.act(id, `würfelt ${sum}`);
    if (!combos(this.boxes[id], sum).length) {
      this.say(`Keine Klappen passen zur ${sum}`, 'info', 'action');
      return this.endTurn(id);
    }
    this.pending = true;
  }

  close(id, flaps) {
    this.requireTurn(id);
    if (!this.pending) throw new Error('Erst würfeln');
    const pick = [...new Set((flaps || []).map(Number))];
    const open = this.boxes[id];
    if (!pick.length || pick.some((f) => !open.includes(f))) throw new Error('Diese Klappe ist schon zu');
    const sum = this.dice.reduce((a, b) => a + b, 0);
    if (pick.reduce((a, b) => a + b, 0) !== sum) throw new Error(`Die Klappen müssen zusammen genau ${sum} ergeben`);
    this.boxes[id] = open.filter((f) => !pick.includes(f));
    this.pending = false;
    this.say(`${this.name(id)} schließt ${pick.sort((a, b) => a - b).join(' + ')}`, 'info', 'action');
    this.act(id, `schließt ${pick.join('+')}`);
    if (!this.boxes[id].length) return this.boxShut(id);
  }

  // Zugende: Punkte = offene Klappen
  endTurn(id) {
    const v = this.value(this.boxes[id]);
    this.results[id].push(v);
    this.played.add(id);
    this.say(`${this.name(id)} bekommt ${v} Punkte`, 'win');
    this.act(id, `${v} Punkte`);
    this.afterTurn();
  }
  // Alle Klappen zu: 0 Punkte, Runde sofort gewonnen – wer noch nicht dran war, bekommt die volle Summe
  boxShut(id) {
    this.results[id].push(0);
    this.played.add(id);
    this.lastShut = { id, sub: this.sub };
    this.say(`${this.name(id)}: Box geschlossen! Runde ${this.sub} gewonnen`, 'win');
    this.act(id, 'Box zu!');
    const full = this.value([...Array(this.flaps()).keys()].map((k) => k + 1));
    for (const p of this.order) if (!this.played.has(p)) { this.results[p].push(full); this.played.add(p); this.say(`${this.name(p)} war noch nicht dran: ${full} Punkte`, 'info'); }
    this.afterTurn(true);
  }
  afterTurn(shut = false) {
    if (shut || this.order.every((p) => this.played.has(p))) {
      if (this.sub >= this.settings.rounds) return this.finish();
      this.startSub();
      // Wer die nächste Runde beginnt: reihum (der Nächste nach dem letzten Anfang)
      this.turn = (this.sub - 1) % this.order.length;
      return this.onTurnStart();
    }
    this.next(1);
  }
  finish() {
    const sums = Object.fromEntries(this.order.map((p) => [p, this.results[p].reduce((a, b) => a + b, 0)]));
    const best = Math.min(...Object.values(sums));
    const winners = this.order.filter((p) => sums[p] === best);
    const list = [...this.order].sort((a, b) => sums[a] - sums[b]).map((p) => `${this.name(p)} ${sums[p]}`).join(', ');
    this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} ${winners.length > 1 ? 'gewinnen' : 'gewinnt'} mit ${best} Punkten (${list})`, sums);
  }

  // Zeit abgelaufen: der Computer macht weiter (würfeln bzw. die Kombination mit den höchsten Klappen schließen)
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam – der Computer spielt den Schritt`, 'warn');
    if (!this.pending) return this.throwDice(id, this.canOneDie(id) && this.boxes[id].reduce((a, b) => a + b, 0) <= 6 ? 1 : 2);
    const all = combos(this.boxes[id], this.dice.reduce((a, b) => a + b, 0));
    all.sort((a, b) => Math.max(...b) - Math.max(...a) || a.length - b.length);
    this.close(id, all[0]);
  }

  // Wer aussteigt, fehlt in der Wertung; waren alle anderen schon dran, geht es weiter
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.order.length && this.order.every((x) => this.played.has(x))) this.afterTurn();
  }

  publicPlayer(p) {
    const r = this.results[p.id];
    return r ? { total: r.reduce((a, b) => a + b, 0), open: this.boxes[p.id] ? [...this.boxes[p.id]] : null, played: this.played.has(p.id) } : { total: null };
  }
  gameView(viewerId) {
    const mine = this.currentId === viewerId && this.phase === 'playing';
    const sum = this.dice.reduce((a, b) => a + b, 0);
    return {
      flaps: this.flaps(), sub: this.sub, rounds: this.settings.rounds,
      boxes: Object.fromEntries(Object.entries(this.boxes).map(([id, b]) => [id, [...b]])),
      results: this.results, played: [...this.played],
      dice: [...this.dice], sum, pending: this.pending, lastShut: this.lastShut,
      combos: mine && this.pending ? combos(this.boxes[viewerId], sum) : null, // nur für den, der dran ist
      canOneDie: mine && !this.pending && this.canOneDie(viewerId),
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
