import { Room, BOARD, PROPERTIES } from './room.js';

export class SpeedRoom extends Room {
  defaultSettings() { return { ...super.defaultSettings(), startMoney: 2500 }; }
  setupRound() { super.setupRound(); for (const p of Object.values(this.people)) p.speedActive = false; this.speedDie = null; this.speedBonus = null; this.speedChoice = null; }
  cash(from, to, amount, reason, tax = false) { super.cash(from, to, amount, reason, tax); if (to && reason === 'Über Los') this.people[to].speedActive = true; }
  throwDice(id) {
    this.requireActor(id); if (!['roll', 'jail'].includes(this.step)) throw new Error('Du kannst gerade nicht würfeln');
    const p = this.people[id]; this.speedChoice = null; this.speedDie = null;
    // Im Gefängnis kommen ausschließlich die beiden weißen Würfel zum Einsatz.
    if (p.jail || !p.speedActive) return super.throwDice(id);
    this.dice = [this.roll(), this.roll()]; this.rollNo++; this.card = null;
    const face = this.roll(); this.speedDie = face <= 3 ? face : face <= 5 ? 'luck' : 'bus';
    this.act(id, `würfelt ${this.dice.join(' + ')} · ${this.speedDie === 'luck' ? 'Glück' : this.speedDie === 'bus' ? 'Bus' : this.speedDie}`);
    const double = this.dice[0] === this.dice[1]; this.again = double; this.doubles = double ? this.doubles + 1 : 0;
    // Dreierpasch hat Vorrang vor der Regel für drei aufeinanderfolgende weiße Pasche.
    if (Number.isInteger(this.speedDie) && double && this.speedDie === this.dice[0]) { this.again = false; this.doubles = 0; this.step = 'speed-choice'; this.speedChoice = 'triple'; return; }
    if (this.doubles === 3) return this.jail(id);
    if (this.speedDie === 'bus') { this.step = 'speed-choice'; this.speedChoice = 'bus'; return; }
    const luck = this.speedDie === 'luck';
    this.walk(id, this.dice[0] + this.dice[1] + (Number.isInteger(this.speedDie) ? this.speedDie : 0));
    if (luck && !p.jail && this.phase === 'playing') { this.speedBonus = id; this.resumeSpeed(); }
  }
  speedSelect(id, value) {
    this.requireActor(id);
    if (this.step !== 'speed-choice' || !Number.isInteger(value)) throw new Error('Keine Tempowürfel-Auswahl offen');
    const p = this.people[id], kind = this.speedChoice;
    if (kind === 'bus' && ![...this.dice, this.dice[0] + this.dice[1]].includes(value)) throw new Error('Wähle einen weißen Würfel oder deren Summe');
    if (kind === 'triple' && (value < 0 || value >= 40)) throw new Error('Wähle ein Feld');
    this.speedChoice = null; this.walk(id, kind === 'bus' ? value : (value - p.position + 40) % 40);
  }
  resumeSpeed() {
    const id = this.speedBonus;
    if (!id || this.phase !== 'playing' || this.debt || this.auction || this.trade || this.step === 'buy') return;
    this.speedBonus = null;
    if (!this.order.includes(id) || this.people[id].jail) return;
    const free = PROPERTIES.some((i) => !this.owned[i].owner), from = this.people[id].position;
    for (let n = 1; n <= 40; n++) {
      const i = (from + n) % 40, p = this.owned[i];
      if (p && (free ? !p.owner : p.owner && p.owner !== id && this.rent(i) > 0)) { this.say('Glück: weiter zum nächsten passenden Grundstück', 'react'); this.walk(id, n); return; }
    }
  }
  rent(field, sum = null, special = null) { return super.rent(field, (sum ?? this.dice[0] + this.dice[1]) + (Number.isInteger(this.speedDie) ? this.speedDie : 0), special); }
  buy(id, yes) { super.buy(id, yes); this.resumeSpeed(); }
  finishAuction() { super.finishAuction(); this.resumeSpeed(); }
  settlePayments() { super.settlePayments(); this.resumeSpeed(); }
  endTurn(id) { this.requireActor(id); this.resumeSpeed(); if (this.step !== 'end') return; return super.endTurn(id); }
  onTurnStart() { this.speedBonus = null; this.speedChoice = null; this.speedDie = null; super.onTurnStart(); }
  onTimeout(id) { if (this.step === 'speed-choice' && !this.debt && !this.auction && !this.trade) return this.speedSelect(id, this.speedChoice === 'bus' ? this.dice[0] + this.dice[1] : this.bestDestination(id)); return super.onTimeout(id); }
  bestDestination(id) { return PROPERTIES.find((i) => !this.owned[i].owner && this.people[id].money > BOARD[i].price + 200) ?? 0; }
  gameView(id) { return { ...super.gameView(id), speedDie: this.speedDie, speedBonus: this.speedBonus, speedChoice: this.speedChoice }; }
}
