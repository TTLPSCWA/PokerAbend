import { TurnRoom } from '../../server/turn-room.js';
import { die, shuffle } from '../../server/random.js';
import { JUNIOR_BOARD as BOARD, COLORS } from '../../public/games/monopoly/data.js';

export class JuniorRoom extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Sekunden pro Zug', type: 'number', min: 5, max: 180 }];
  defaultSettings() { return { turnTime: 45, theme: 'classic' }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 4, scoreLabel: 'Siege', winPoints: 1 }); this.people = {}; this.owned = {}; this.roll = die; this.tokens = {}; this.board = { id: 'junior', title: 'Spieleabend-Junior', names: BOARD.filter((f) => f.price).map((f) => f.name) }; }
  setupRound() {
    const available = ['hat', 'car', 'dog', 'ship', 'thimble', 'barrow', 'shoe', 'cat'].filter((t) => !this.order.some((id) => this.tokens[id] === t));
    for (const id of this.order) if (!this.tokens[id]) this.tokens[id] = available.shift();
    const money = this.order.length === 4 ? 20 : 31;
    this.people = Object.fromEntries(this.order.map((id) => [id, { money, position: 0, jail: false, free: [], out: false }]));
    this.owned = Object.fromEntries(BOARD.filter((f) => f.price).map((f) => [f.index, { owner: null, level: 0, mortgage: false }]));
    this.lastMove = null; this.moveSerial = 0; this.dice = [1]; this.rollNo = 0; this.turnNo = 0; this.card = null;
    this.events = shuffle([...Object.keys(COLORS), ...Object.keys(COLORS), 'go', 'go', 'jail', 'free']); this.juniorChoice = null;
  }
  get actor() { return this.currentId; }
  onTurnStart() { this.step = 'roll'; this.turnNo++; }
  properties(id) { return BOARD.filter((f) => this.owned[f.index]?.owner === id); }
  wealth(id) { return this.people[id]?.money || 0; }
  rent(field) { const f = BOARD[field], own = this.owned[field]; if (!own?.owner) return 0; return f.price * (BOARD.filter((p) => p.color === f.color).every((p) => this.owned[p.index].owner === own.owner) ? 2 : 1); }
  charge(id, amount, to = null) {
    const p = this.people[id];
    if (p.money < amount) { p.out = true; this.finishJunior(id); return false; }
    p.money -= amount; if (to) this.people[to].money += amount; return true;
  }
  throwDice(id) {
    this.requireTurn(id); if (this.step !== 'roll') throw new Error('Erst den Zug beenden');
    const p = this.people[id]; if (p.jail) { if (p.free.length) { p.free.pop(); this.events.push('free'); } else if (!this.charge(id, 1)) return; p.jail = false; }
    const value = this.roll(); this.dice = [value]; this.rollNo++; this.card = null;
    this.act(id, `würfelt ${value}`); this.walk(id, value);
  }
  walk(id, steps) {
    const p = this.people[id], from = p.position, path = [from];
    for (let k = 0; k < steps; k++) { p.position = (p.position + 1) % 24; path.push(p.position); if (p.position === 0) { p.money += 2; this.say(`${this.name(id)} erhält 2 über Los`); } }
    this.lastMove = { n: ++this.moveSerial, id, from, path, to: p.position }; this.land(id);
  }
  land(id) {
    this.step = 'end'; const p = this.people[id], f = BOARD[p.position], own = this.owned[p.position];
    this.say(`${this.name(id)} landet auf ${f.name}`, 'info', 'action');
    if (own && !own.owner) { if (!this.charge(id, f.price)) return; own.owner = id; this.say(`${this.name(id)} kauft ${f.name} für ${f.price}`); }
    else if (own?.owner && own.owner !== id) this.charge(id, this.rent(f.index), own.owner);
    else if (f.type === 'gotojail') this.jail(id);
    else if (f.type === 'event') {
      this.drawEvent(id);
    }
  }
  jail(id) { const p = this.people[id], from = p.position; p.position = 6; p.jail = true; this.lastMove = { n: ++this.moveSerial, id, from, path: [from, 6], to: 6 }; this.say('Direkt ins Gefängnis – beim nächsten Zug 1 zahlen'); }
  drawEvent(id) {
    for (let n = 0; n < 20; n++) {
      const event = this.events.shift(); if (!event) break;
      if (event !== 'free') this.events.push(event);
      if (event === 'go') { this.card = { text: 'Einladung an den Start: Ziehe auf Los und erhalte 2.' }; this.walk(id, (24 - this.people[id].position) % 24); return; }
      if (event === 'jail') { this.card = { text: 'Die Nachtruhe wurde gestört: ab ins Gefängnis.' }; this.jail(id); return; }
      if (event === 'free') { this.card = { text: 'Gutes Alibi: Behalte diese Karte für einen freien Ausgang.' }; this.people[id].free.push('free'); return; }
      const fields = BOARD.filter((f) => f.color === event).map((f) => f.index), owner = this.owned[fields[0]].owner;
      if (owner && fields.every((i) => this.owned[i].owner === owner)) continue;
      const choices = fields.filter((i) => this.owned[i].owner !== id);
      this.card = { text: 'Ein Grundstück dieser Farbe gehört kostenlos dir. Eine vollständige fremde Farbgruppe bleibt geschützt.' };
      if (choices.length === 1) this.owned[choices[0]].owner = id;
      else { this.juniorChoice = choices; this.step = 'junior-choice'; }
      return;
    }
    this.card = { text: 'Heute sind alle Farbgruppen geschützt – genieße eine Pause.' };
  }
  juniorSelect(id, field) { this.requireTurn(id); if (!this.juniorChoice?.includes(field)) throw new Error('Wähle eines der angebotenen Grundstücke'); this.owned[field].owner = id; this.juniorChoice = null; this.step = 'end'; }
  finishJunior(bankrupt) {
    let winners = this.order.filter((id) => id !== bankrupt), max = Math.max(...winners.map((id) => this.wealth(id)));
    winners = winners.filter((id) => this.wealth(id) === max);
    if (winners.length > 1) { const value = (id) => this.properties(id).reduce((n, f) => n + f.price, 0), best = Math.max(...winners.map(value)); winners = winners.filter((id) => value(id) === best); }
    this.finishRound(winners, `${this.name(bankrupt)} kann nicht bezahlen. ${winners.map((id) => this.name(id)).join(' und ')} gewinnt mit ${max} Geld`, Object.fromEntries(winners.map((id) => [id, 1])));
  }
  endTurn(id) { this.requireTurn(id); if (this.step !== 'end') throw new Error('Erst würfeln'); this.next(); }
  manage() { throw new Error('Junior hat keine Gebäude oder Hypotheken'); }
  proposeTrade() { throw new Error('Junior hat keinen Handel'); }
  buy() { throw new Error('Junior kauft freie Grundstücke automatisch'); }
  chooseToken(id, token) { if (!this.players.has(id) || !['hat', 'car', 'dog', 'ship', 'thimble', 'barrow', 'shoe', 'cat'].includes(token)) throw new Error('Unbekannte Figur'); if (Object.entries(this.tokens).some(([p, t]) => p !== id && t === token && this.seats.includes(p))) throw new Error('Diese Figur ist schon gewählt'); this.tokens[id] = token; }
  onTimeout(id) { if (this.juniorChoice) return this.juniorSelect(id, this.juniorChoice[0]); return this.step === 'roll' ? this.throwDice(id) : this.endTurn(id); }
  onDropOut(p) { this.finishJunior(p.id); }
  publicPlayer(p) { const v = this.people[p.id]; return v ? { ...v, wealth: v.money, properties: this.properties(p.id).length, token: this.tokens[p.id] || null } : {}; }
  gameView() { return { board: this.board, people: this.people, owned: this.owned, actor: this.actor, step: this.step, dice: this.dice, rollNo: this.rollNo, turnNo: this.turnNo, lastMove: this.lastMove, card: this.card, stock: { houses: 0, hotels: 0 }, pot: 0, possible: [], tokens: this.tokens, juniorChoice: this.juniorChoice }; }
  saveExtra() { return { tokens: this.tokens }; }
  loadExtra(x) { this.tokens = x.tokens || {}; }
  view(id) { return { ...super.view(id), monopolyBoards: [], monopolyTokens: this.tokens }; }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
