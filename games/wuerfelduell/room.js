import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';
export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'health', label: 'Lebenspunkte', type: 'number', min: 5, max: 20 },
    { key: 'dice', label: 'Würfel je Angriff und Verteidigung', type: 'number', min: 2, max: 5 },
    { key: 'turnTime', label: 'Zeit pro Zug in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { health: 10, dice: 3, turnTime: 30 }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 4, scoreLabel: 'Siege', winPoints: 1 }); this.health = {}; this.lastAttack = null; this.attacks = 0; this.roll = die; }
  get alive() { return this.order.filter((id) => this.health[id] > 0); }
  setupRound() { this.health = Object.fromEntries(this.order.map((id) => [id, this.settings.health])); this.lastAttack = null; this.attacks = 0; }
  onTurnStart() { if (this.phase === 'playing' && this.health[this.currentId] <= 0) this.next(); }
  attack(id, target) {
    this.requireTurn(id);
    if (typeof target !== 'string' || target === id || !this.alive.includes(target)) throw new Error('Wähle einen lebenden Gegner');
    const attack = Array.from({ length: this.settings.dice }, () => this.roll()), defence = Array.from({ length: this.settings.dice }, () => this.roll());
    const hits = attack.filter((v) => v >= 4).length, shields = defence.filter((v) => v >= 5).length;
    // Nach je 10 Angriffen steigt der Druck: +1 Schaden, klar angezeigt.
    const pressure = Math.floor(this.attacks / 10), damage = Math.max(0, hits - shields) + pressure;
    this.attacks++; this.health[target] = Math.max(0, this.health[target] - damage);
    this.lastAttack = { attacker: id, target, attack, defence, hits, shields, pressure, damage };
    this.act(id, `${this.name(target)}: ${damage} Schaden`, `${attack.join(', ')} gegen ${defence.join(', ')}`);
    if (this.alive.length === 1) { const winner = this.alive[0]; this.finishRound([winner], `${this.name(winner)} übersteht das Würfelduell.`, { [winner]: 1 }); } else this.next();
  }
  onTimeout(id) { const target = this.alive.filter((p) => p !== id).sort((a, b) => this.health[a] - this.health[b])[0]; if (target) this.attack(id, target); }
  onDropOut(p) { this.health[p.id] = 0; if (this.alive.length === 1) { const winner = this.alive[0]; this.finishRound([winner], `${this.name(winner)} gewinnt das Duell.`, { [winner]: 1 }); } }
  publicPlayer(p) { return { health: this.health[p.id] ?? null, eliminated: this.phase === 'playing' && this.health[p.id] <= 0 }; }
  gameView(id) { return { health: { ...this.health }, last: this.lastAttack ? { ...this.lastAttack, attack: [...this.lastAttack.attack], defence: [...this.lastAttack.defence] } : null, attacks: this.attacks, pressure: Math.floor(this.attacks / 10), targets: this.phase === 'playing' && this.currentId === id ? this.alive.filter((p) => p !== id) : [] }; }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
