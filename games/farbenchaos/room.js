// UNO – Farbkartenspiel, baut auf Mau-Mau auf (gleiches Ablegen und Ziehen, andere Karten).
// 108 Karten: 4 Farben mit 0 (einmal), 1–9, Aussetzen, Richtungswechsel und +2 (je zweimal), dazu 4× Farbwahl und 4× Farbwahl +4.
// Hausregeln: +2 und +4 werden nicht gestapelt – der Nächste zieht und setzt aus. Richtungswechsel zu zweit = Aussetzen.
// Wer nicht kann, zieht eine Karte und darf genau diese noch spielen. „UNO!“ zeigt die Seite bei der letzten Karte selbst an.
// Wertung: Der Gewinner bekommt die Punkte aller übrigen Handkarten (Zahl = Wert, Aktion 20, Farbwahl 50) – viel ist gut.
// Karten sind zwei Zeichen: Wert + Farbe. Werte 0–9, S (Aussetzen), R (Richtung), D (+2), W (Farbwahl), F (+4). Farben r, y, g, b, w (schwarz).
import { Room as MauMau } from '../maumau/room.js';

export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAME = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz' };
const VALUE_NAME = { S: 'Aussetzen', R: 'Richtungswechsel', D: '+2', W: 'Farbwahl', F: 'Farbwahl +4' };

export class Room extends MauMau {
  static OPTIONS = [
    { key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, max: 10 },
    { key: 'stacking', label: '+2 und +4 stapeln', type: 'bool' },
    { key: 'sevenZero', label: '7 tauscht Hände, 0 gibt alle Hände weiter', type: 'bool' },
    { key: 'drawUntil', label: 'Ziehen, bis eine Karte passt', type: 'bool' },
    { key: 'unoCall', label: '„UNO“ selbst sagen (vergessen = 2 Strafkarten)', type: 'bool' },
    { key: 'strictPlus4', label: '+4 nur, wenn man die Farbe nicht hat', type: 'bool' },
    { key: 'startAction', label: 'Startkarte wirkt (Aussetzen, Richtung, +2, Farbwahl)', type: 'bool' },
    { key: 'catchCall', label: 'Erwischen: wer „UNO“ vergisst, kann gemeldet werden (+2)', type: 'bool' },
  ];

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: false, scoreLabel: 'Punkte' });
  }
  defaultSettings() { return { handSize: 7, stacking: false, sevenZero: false, drawUntil: false, unoCall: false, strictPlus4: false, startAction: false, catchCall: false }; }
  play(id, card, wish, called = false, target = null) {
    if (this.settings.sevenZero && card[0] === '7' && (!this.order.includes(target) || target === id)) throw new Error('Wähle einen Mitspieler zum Tauschen');
    this.swapTarget = target; return super.play(id, card, wish, called);
  }
  callKey() { return 'unoCall'; }
  callPenalty() { return 2; }
  catchKey() { return 'catchCall'; }
  // +4 nur, wenn man keine Karte der geltenden Farbe hat (mit Option)
  allowed(c, id) {
    if (c[0] !== 'F' || !this.settings.strictPlus4) return true;
    const top = this.discard[this.discard.length - 1];
    const color = this.wish || top[1];
    return !this.hands[id].some((x) => x !== c && x[1] === color);
  }

  buildDeck() {
    const deck = [];
    for (const c of COLORS) {
      deck.push('0' + c);
      for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D']) deck.push(v + c, v + c);
    }
    for (let k = 0; k < 4; k++) deck.push('Ww', 'Fw');
    return deck;
  }
  // Startkarte: ohne Option immer eine Zahl, mit Option alles außer +4 – die übrigen kommen zurück unter den Stapel
  firstCard() {
    const any = this.settings.startAction;
    for (let k = 0; k < this.deck.length; k++) {
      const c = this.deck.pop();
      if (any ? c[0] !== 'F' : /\d/.test(c[0])) return c;
      this.deck.unshift(c);
    }
    return this.deck.pop();
  }
  cardName(c) { return c[1] === 'w' ? VALUE_NAME[c[0]] : `${COLOR_NAME[c[1]]} ${VALUE_NAME[c[0]] || c[0]}`; }
  cardPoints(c) { return /\d/.test(c[0]) ? Number(c[0]) : c[1] === 'w' ? 50 : 20; }
  lastCardCall() { return 'UNO!'; }
  winText(name) { return `${name} gewinnt – UNO!`; }
  validWish(w) { return COLORS.includes(w); }
  needsWish(c) { return c[1] === 'w'; }
  wishName(w) { return COLOR_NAME[w]; }

  canPlay(c) {
    const top = this.discard[this.discard.length - 1];
    if (this.pending > 0) return c[0] === 'F' || (c[0] === 'D' && top[0] === 'D'); // gestapelt: +2 auf +2, +4 auf alles
    if (c[1] === 'w') return true;
    if (top[1] === 'w' && !this.wish) return true; // Farbwahl als Startkarte: die erste Karte ist frei
    const color = this.wish || top[1];
    return c[1] === color || (top[1] !== 'w' && c[0] === top[0]);
  }

  effect(c, wish) {
    const victim = this.peek(1);
    if (this.settings.sevenZero && c[0] === '7') { const other = this.swapTarget; [this.hands[this.currentId], this.hands[other]] = [this.hands[other], this.hands[this.currentId]]; }
    if (this.settings.sevenZero && c[0] === '0') { const before = { ...this.hands }; this.order.forEach((id, i) => { this.hands[this.order[(i + this.dir + this.order.length) % this.order.length]] = before[id]; }); }
    switch (c[0]) {
      case 'S': this.say(`${this.name(victim)} setzt aus`); this.act(victim, 'setzt aus'); return 2;
      case 'R':
        this.dir *= -1;
        this.say('Richtungswechsel');
        return this.order.length === 2 ? 2 : 1;
      case 'D':
        if (this.settings.stacking) { this.pending += 2; this.say(`${this.name(victim)} muss ${this.pending} ziehen – oder eine Plus-Karte drauflegen`); return 1; }
        this.take(victim, 2); this.say(`${this.name(victim)} zieht 2 und setzt aus`); this.act(victim, 'zieht 2'); return 2;
      case 'W': this.wish = wish; this.say(`Gewählt: ${COLOR_NAME[wish]}`); return 1;
      case 'F':
        this.wish = wish;
        if (this.settings.stacking) { this.pending += 4; this.say(`Gewählt: ${COLOR_NAME[wish]} – ${this.name(victim)} muss ${this.pending} ziehen – oder +4 drauflegen`); return 1; }
        this.take(victim, 4); this.say(`Gewählt: ${COLOR_NAME[wish]} – ${this.name(victim)} zieht 4 und setzt aus`); this.act(victim, 'zieht 4'); return 2;
      default: return 1;
    }
  }

  // Wirkung der Startkarte (nur mit Option)
  startEffect(top) {
    if (!this.settings.startAction) return;
    const n = this.order.length;
    const first = this.order[0];
    switch (top[0]) {
      case 'S': this.say(`Startkarte Aussetzen: ${this.name(first)} setzt aus`); this.turn = 1 % n; break;
      case 'R':
        if (n === 2) { this.say(`Startkarte Richtungswechsel: ${this.name(first)} setzt aus`); this.turn = 1; }
        else { this.dir = -1; this.say('Startkarte Richtungswechsel: es geht andersherum los'); }
        break;
      case 'D': this.take(first, 2); this.say(`Startkarte +2: ${this.name(first)} zieht 2 und setzt aus`); this.turn = 1 % n; break;
      case 'W': this.say(`Startkarte Farbwahl: ${this.name(first)} darf eine beliebige Karte legen`); break;
    }
  }

  // Ziehen, bis eine Karte passt (mit Option)
  draw(id) {
    if (!this.settings.drawUntil || this.pending > 0) return super.draw(id);
    this.requireTurn(id);
    if (this.drawn) throw new Error('Du hast schon gezogen – spiel die Karte oder sag „Weiter“');
    let c, n = 0;
    const fits = (x) => x && this.canPlay(x) && this.allowed(x, id);
    do { [c] = this.take(id, 1); n++; } while (c && !fits(c) && n < 120);
    this.say(`${this.name(id)} zieht ${n === 1 ? 'eine Karte' : `${n} Karten`}`, 'info', 'action');
    this.act(id, n === 1 ? 'zieht' : `zieht ${n}`);
    if (!c && n === 1) return this.noDraw(); // gar nichts mehr zu ziehen
    this.stall = 0;
    if (!fits(c)) return this.next(1);
    this.drawn = c;
  }

  // Der Gewinner kassiert die Punkte der anderen
  win(id) {
    const total = this.order.filter((p) => p !== id).reduce((a, p) => a + this.hands[p].reduce((s, c) => s + this.cardPoints(c), 0), 0);
    this.finishRound([id], `${this.winText(this.name(id))} +${total} Punkte`, { [id]: total });
  }

  static restore(data, onChange) { return MauMau.restoreInto(new this(data.code, data.settings, onChange), data); }
}
