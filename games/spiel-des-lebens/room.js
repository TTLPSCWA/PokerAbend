import { randomInt } from 'node:crypto';
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';
import { JOBS, HOUSES, EVENTS, lifeBoard } from '../../public/games/spiel-des-lebens/data.js';
export const spinWheel = (rng = randomInt) => rng(10) + 1;
const unitsValid = (n) => Number.isSafeInteger(n) && n >= 1 && n <= 20;

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'turnTime', label: 'Sekunden pro Entscheidung', type: 'number', min: 5, max: 180 }];
  defaultSettings() { return { turnTime: 60 }; }
  constructor(code, settings, onChange) { super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, scoreLabel: 'Vermögen' }); this.people = {}; this.board = lifeBoard(this.variant === 'short'); this.spinValue = spinWheel; }
  setupRound() {
    this.board = lifeBoard(this.variant === 'short'); this.fields = new Map(this.board.fields.map((f) => [f.id, f]));
    this.people = Object.fromEntries(this.order.map((id) => [id, { position: '0', money: 200000, loans: 0, started: false, college: false, job: null, raise: 0, partner: false, kids: 0, houses: [], life: [], retired: false, out: false, route: null }]));
    this.lifeDeck = shuffle(Array.from({ length: 100 }, (_, i) => (1 + i % 5) * 50000)); this.eventDeck = shuffle(EVENTS.map((_, i) => i));
    this.retirementOrder = []; this.lastSpin = null; this.spinNo = 0; this.lastMove = null; this.moveSerial = 0; this.choice = null; this.lastEvent = null; this.breakdown = null;
  }
  onTurnStart() { this.lastEvent = null; this.choice = this.people[this.currentId]?.started ? null : { kind: 'start', owner: this.currentId }; this.step = this.choice ? 'choose' : 'spin'; }
  member(id) { if (this.phase !== 'playing' || !this.order.includes(id) || this.people[id]?.out || this.people[id]?.retired) throw new Error('Du bist gerade nicht aktiv'); return this.people[id]; }
  field(id) { return this.fields.get(this.people[id].position); }
  spin(reason = '') { const value = this.spinValue(); if (!Number.isInteger(value) || value < 1 || value > 10) throw new Error('Ungültiges Drehrad-Ergebnis'); this.lastSpin = { n: ++this.spinNo, value, reason }; return value; }
  borrow(id, units = 1) { const p = this.member(id); if (!unitsValid(units)) throw new Error('Wähle 1–20 Kredite zu je 50.000'); p.money += units * 50000; p.loans += units; this.act(id, `nimmt ${units * 50000} Kredit auf`); }
  repay(id, units = 1) { const p = this.member(id); if (!unitsValid(units) || units > p.loans || units * 60000 > p.money) throw new Error('Tilgung kostet 60.000 je offenem Kredit'); p.money -= units * 60000; p.loans -= units; this.act(id, `tilgt ${units} Kredit${units === 1 ? '' : 'e'}`); }
  pay(id, amount, event = false) {
    const p = this.people[id], job = JOBS.find((j) => j.id === p.job);
    if (event && job?.ability === 'cost') amount = Math.max(0, amount - job.bonus);
    if (p.money < amount) this.borrow(id, Math.ceil((amount - p.money) / 50000)); p.money -= amount;
  }
  receive(id, amount, reason = '') { const p = this.people[id], job = JOBS.find((j) => j.id === p.job); p.money += amount + (reason && job?.ability === reason ? job.bonus : 0); }
  drawLife(id, count = 1) { for (let n = 0; n < count; n++) { if (!this.lifeDeck.length) this.lifeDeck = shuffle(Array.from({ length: 25 }, (_, i) => (1 + i % 5) * 50000)); this.people[id].life.push(this.lifeDeck.pop()); } this.say(`${this.name(id)} erhält ${count} verdeckte Lebenskarte${count === 1 ? '' : 'n'}`); }
  salary(id) { const p = this.people[id], job = JOBS.find((j) => j.id === p.job); return job ? job.salary + p.raise + (job.ability === 'payday' ? job.bonus : 0) : 0; }
  jobs(id, college) {
    const used = new Set(Object.values(this.people).filter((p) => !p.out).map((p) => p.job));
    const offers = shuffle(JOBS.filter((j) => !used.has(j.id) && (college || !j.college))).slice(0, 3);
    if (!offers.length) { this.endAction(); return; }
    this.choice = { kind: 'job', owner: id, offers: offers.map((j) => j.id) }; this.step = 'choose';
  }
  choose(id, value) {
    this.requireTurn(id); this.member(id); const p = this.people[id], choice = this.choice;
    if (!choice || choice.owner !== id) throw new Error('Keine Wahl offen');
    if (choice.kind === 'start') {
      if (!['college', 'work'].includes(value)) throw new Error('Studium oder Beruf wählen');
      p.started = true; p.college = value === 'college'; this.choice = null;
      if (p.college) { this.borrow(id, 2); p.money -= 100000; this.say(`${this.name(id)} beginnt das Studium (100.000 Studienkredit)`); return this.endAction(); }
      p.position = String(this.board.marks.graduation); this.say(`${this.name(id)} startet direkt ins Berufsleben`); return this.jobs(id, false);
    }
    if (choice.kind === 'job') {
      if (!choice.offers.includes(value)) throw new Error('Wähle einen der angebotenen Berufe');
      p.job = value; p.raise = 0; this.choice = null; this.say(`${this.name(id)} arbeitet als ${JOBS.find((j) => j.id === value).name}`); this.drawLife(id); return this.endAction();
    }
    if (choice.kind === 'house') {
      if (value === 'skip') { this.choice = null; return this.endAction(); }
      if (!choice.offers.includes(value)) throw new Error('Wähle ein angebotenes Haus');
      const house = HOUSES.find((h) => h.id === value); this.pay(id, house.price); p.houses.push(value); this.choice = null; this.say(`${this.name(id)} kauft ${house.name} für ${house.price}`); return this.endAction();
    }
    if (choice.kind === 'route') {
      const f = this.field(id); if (!f.branches?.[value]) throw new Error('Wähle einen der beiden Wege');
      p.route = value; p.branchNext = f.branches[value]; this.choice = null; this.say(`${this.name(id)} wählt ${value === 'career' ? 'Karriere' : value === 'family' ? 'Familie' : value === 'safe' ? 'den sicheren Weg' : 'das Wagnis'}`); return this.endAction();
    }
    if (choice.kind === 'wedding' && value === 'spin') {
      const value = this.spin('Hochzeitsgeschenke'), gift = value * 10000; p.partner = true;
      for (const other of this.order.filter((other) => other !== id && !this.people[other].out && !this.people[other].retired)) { this.pay(other, gift); this.receive(id, gift); }
      this.receive(id, 0, 'gift'); this.drawLife(id); this.choice = null; return this.endAction();
    }
    if (choice.kind === 'chance' && value === 'spin') {
      const result = this.spin(choice.risk ? 'Wagnis' : 'Ereignis');
      if (result <= 5) this.pay(id, choice.risk ? 80000 : 30000, true); else this.receive(id, choice.risk ? 180000 : 70000, 'event');
      this.choice = null; return this.endAction();
    }
    throw new Error('Diese Auswahl ist nicht möglich');
  }
  throwWheel(id) { this.requireTurn(id); this.member(id); if (this.step !== 'spin' || this.choice) throw new Error('Erst die offene Entscheidung abschließen'); this.move(id, this.spin('Fahrt')); }
  move(id, steps) {
    const p = this.people[id], from = p.position, path = [from];
    for (let n = 0; n < steps; n++) {
      const current = this.fields.get(p.position), next = p.branchNext || current.next; delete p.branchNext;
      if (!next) break;
      p.position = next; const field = this.fields.get(next); path.push(next);
      if (field.kind === 'payday') { const pay = this.salary(id); p.money += pay; this.say(`${this.name(id)} passiert Zahltag: ${pay}`); }
      if (field.stop) break;
    }
    this.lastMove = { n: ++this.moveSerial, id, from, to: p.position, path }; this.act(id, `fährt ${path.length - 1} Felder`); this.land(id);
  }
  land(id) {
    const p = this.people[id], f = this.field(id); this.lastEvent = f.name;
    if (f.kind === 'graduation') { this.drawLife(id); return this.jobs(id, true); }
    if (f.kind === 'wedding') { this.choice = { kind: 'wedding', owner: id }; this.step = 'choose'; return; }
    if (f.kind === 'house') {
      const owned = new Set(Object.values(this.people).flatMap((p) => p.houses)), offers = shuffle(HOUSES.filter((h) => !owned.has(h.id))).slice(0, 3);
      if (offers.length) { this.choice = { kind: 'house', owner: id, offers: offers.map((h) => h.id) }; this.step = 'choose'; return; }
    }
    if (f.branches) { this.choice = { kind: 'route', owner: id }; this.step = 'choose'; return; }
    if (f.kind === 'retirement') return this.retire(id);
    if (f.kind === 'life') this.drawLife(id);
    if (f.kind === 'child') this.addKids(id, 1);
    if (f.kind === 'raise') { p.raise += 20000; this.say('Gehaltserhöhung: +20.000 an jedem Zahltag'); }
    if (f.kind === 'job') return this.jobs(id, p.college);
    if (f.kind === 'risk-event') { this.choice = { kind: 'chance', owner: id, risk: true }; this.step = 'choose'; return; }
    if (f.kind === 'event') return this.event(id);
    this.endAction();
  }
  addKids(id, count) {
    const p = this.people[id]; p.kids += count; const gift = 10000 * count;
    for (const other of this.order.filter((x) => x !== id && !this.people[x].out && !this.people[x].retired)) { this.pay(other, gift); this.receive(id, gift); }
    this.receive(id, 0, 'gift'); this.drawLife(id, count); this.say(`${this.name(id)} begrüßt ${count === 2 ? 'Zwillinge' : 'ein Kind'} · ${gift} Geschenk je aktivem Mitspieler`);
  }
  event(id) {
    const index = this.eventDeck.shift(); this.eventDeck.push(index); const event = EVENTS[index]; this.lastEvent = event.text; this.say(event.text, 'street');
    if (event.money > 0) this.receive(id, event.money, 'event'); if (event.money < 0) this.pay(id, -event.money, true);
    if (event.life) this.drawLife(id, event.life); if (event.kids) this.addKids(id, event.kids); if (event.raise) this.people[id].raise += event.raise;
    if (event.job) return this.jobs(id, this.people[id].college);
    if (event.chance) { this.choice = { kind: 'chance', owner: id }; this.step = 'choose'; return; }
    this.endAction();
  }
  retire(id) {
    const bonus = Math.max(1, 4 - this.retirementOrder.length); this.drawLife(id, bonus); this.people[id].retired = true; this.retirementOrder.push(id);
    this.say(`${this.name(id)} ist als ${this.retirementOrder.length}. im Ruhestand und erhält ${bonus} Bonus-Lebenskarten`, 'win'); this.endAction();
  }
  endAction() {
    if (this.phase !== 'playing') return;
    if (this.order.every((id) => this.people[id].retired || this.people[id].out)) return this.finish();
    const n = this.order.length; do { this.turn = (this.turn + 1) % n; } while (this.people[this.order[this.turn]].retired || this.people[this.order[this.turn]].out);
    this.onTurnStart();
  }
  finish() {
    this.choice = null; this.breakdown = {};
    for (const id of this.order.filter((id) => !this.people[id].out)) {
      const p = this.people[id], sales = p.houses.map((key) => { const house = HOUSES.find((h) => h.id === key), spin = this.spin(`Verkauf ${house.name}`); return { house: key, spin, value: house.sale[spin % 2 === 0 ? 1 : 0] }; });
      const row = { cash: p.money, sales, life: p.life.slice(), children: p.kids * 50000, debt: p.loans * 60000 };
      row.total = row.cash + sales.reduce((n, h) => n + h.value, 0) + row.life.reduce((n, v) => n + v, 0) + row.children - row.debt;
      this.breakdown[id] = row; p.money += sales.reduce((n, h) => n + h.value, 0) - row.debt; p.loans = 0;
    }
    const ids = Object.keys(this.breakdown), max = Math.max(...ids.map((id) => this.breakdown[id].total)), winners = ids.filter((id) => this.breakdown[id].total === max);
    this.finishRound(winners, `${winners.map((id) => this.name(id)).join(' und ')} gewinnt mit ${max.toLocaleString('de-DE')} Vermögen`, Object.fromEntries(ids.map((id) => [id, this.breakdown[id].total])));
  }
  onDropOut(p) { if (this.people[p.id]) this.people[p.id].out = true; if (this.choice?.owner === p.id) this.choice = null; if (this.order.every((id) => this.people[id].retired || this.people[id].out)) this.finish(); }
  publicPlayer(p) { const x = this.people[p.id]; return x ? { money: x.money, loans: x.loans, job: x.job, salary: this.salary(p.id), partner: x.partner, kids: x.kids, position: x.position, houses: x.houses, lifeCards: x.life.length, retired: x.retired, out: x.out } : {}; }
  gameView(id) {
    return { board: this.board, people: Object.fromEntries(this.order.map((p) => [p, this.publicPlayer({ id: p })])), actor: this.currentId, step: this.step, spin: this.lastSpin, lastMove: this.lastMove, lastEvent: this.lastEvent,
      choice: this.choice ? { kind: this.choice.kind, owner: this.choice.owner, ...(this.choice.owner === id && this.choice.offers ? { offers: this.choice.offers } : {}) } : null,
      retirementOrder: this.retirementOrder, breakdown: this.phase === 'over' ? this.breakdown : null };
  }
  botMove(id) {
    const p = this.people[id], choice = this.choice;
    if (!choice) { if (p.loans && p.money > 180000) return this.repay(id, Math.min(p.loans, Math.floor((p.money - 100000) / 60000))); return this.throwWheel(id); }
    if (choice.kind === 'start') return this.choose(id, this.variant !== 'short' ? 'college' : 'work');
    if (choice.kind === 'job') { const best = choice.offers.slice().sort((a, b) => JOBS.find((j) => j.id === b).salary - JOBS.find((j) => j.id === a).salary)[0]; return this.choose(id, best); }
    if (choice.kind === 'house') { const best = choice.offers.slice().sort((a, b) => { const value = (key) => { const h = HOUSES.find((x) => x.id === key); return (h.sale[0] + h.sale[1]) / 2 - h.price - Math.max(0, h.price - p.money) * .2; }; return value(b) - value(a); })[0]; return this.choose(id, best); }
    if (choice.kind === 'route') return this.choose(id, this.field(id).kind === 'family' ? p.kids < 2 ? 'family' : 'career' : p.money < 80000 ? 'safe' : 'risk');
    return this.choose(id, 'spin');
  }
  onTimeout(id) { if (id) this.botMove(id); }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
