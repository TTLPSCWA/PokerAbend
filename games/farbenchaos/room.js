// Farbenchaos – Farbkartenspiel, baut auf Mau-Mau auf (gleiches Ablegen und Ziehen, andere Karten).
// 108 Karten: 4 Farben mit 0 (einmal), 1–9, Aussetzen, Richtungswechsel und +2 (je zweimal), dazu 4× Farbwahl und 4× Farbwahl +4.
// Hausregeln: +2 und +4 werden nicht gestapelt – der Nächste zieht und setzt aus. Richtungswechsel zu zweit = Aussetzen.
// Wer nicht kann, zieht eine Karte und darf genau diese noch spielen. „Chaos!“ zeigt die Seite bei der letzten Karte selbst an.
// Wertung: Der Gewinner bekommt die Punkte aller übrigen Handkarten (Zahl = Wert, Aktion 20, Farbwahl 50) – viel ist gut.
// Karten sind zwei Zeichen: Wert + Farbe. Werte 0–9, S (Aussetzen), R (Richtung), D (+2), W (Farbwahl), F (+4). Farben r, y, g, b, w (schwarz).
import { Room as MauMau } from '../maumau/room.js';

export const COLORS = ['r', 'y', 'g', 'b'];
export const COLOR_NAME = { r: 'Rot', y: 'Gelb', g: 'Grün', b: 'Blau', w: 'Schwarz' };
const VALUE_NAME = { S: 'Aussetzen', R: 'Richtungswechsel', D: '+2', W: 'Farbwahl', F: 'Farbwahl +4' };

export class Room extends MauMau {
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: false, scoreLabel: 'Punkte' });
  }
  defaultSettings() { return { handSize: 7 }; }

  buildDeck() {
    const deck = [];
    for (const c of COLORS) {
      deck.push('0' + c);
      for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D']) deck.push(v + c, v + c);
    }
    for (let k = 0; k < 4; k++) deck.push('Ww', 'Fw');
    return deck;
  }
  // Startkarte immer eine Zahl – Aktionskarten kommen zurück unter den Stapel
  firstCard() {
    for (let k = 0; k < this.deck.length; k++) {
      const c = this.deck.pop();
      if (/\d/.test(c[0])) return c;
      this.deck.unshift(c);
    }
    return this.deck.pop();
  }
  cardName(c) { return c[1] === 'w' ? VALUE_NAME[c[0]] : `${COLOR_NAME[c[1]]} ${VALUE_NAME[c[0]] || c[0]}`; }
  cardPoints(c) { return /\d/.test(c[0]) ? Number(c[0]) : c[1] === 'w' ? 50 : 20; }
  lastCardCall() { return 'Chaos!'; }
  winText(name) { return `${name} gewinnt – Farbenchaos!`; }
  validWish(w) { return COLORS.includes(w); }
  needsWish(c) { return c[1] === 'w'; }
  wishName(w) { return COLOR_NAME[w]; }

  canPlay(c) {
    if (c[1] === 'w') return true;
    const top = this.discard[this.discard.length - 1];
    const color = this.wish || top[1];
    return c[1] === color || (top[1] !== 'w' && c[0] === top[0]);
  }

  effect(c, wish) {
    const victim = this.peek(1);
    switch (c[0]) {
      case 'S': this.say(`${this.name(victim)} setzt aus`); return 2;
      case 'R':
        this.dir *= -1;
        this.say('Richtungswechsel');
        return this.order.length === 2 ? 2 : 1;
      case 'D': this.take(victim, 2); this.say(`${this.name(victim)} zieht 2 und setzt aus`); return 2;
      case 'W': this.wish = wish; this.say(`Gewählt: ${COLOR_NAME[wish]}`); return 1;
      case 'F': this.wish = wish; this.take(victim, 4); this.say(`Gewählt: ${COLOR_NAME[wish]} – ${this.name(victim)} zieht 4 und setzt aus`); return 2;
      default: return 1;
    }
  }

  // Der Gewinner kassiert die Punkte der anderen
  win(id) {
    const total = this.order.filter((p) => p !== id).reduce((a, p) => a + this.hands[p].reduce((s, c) => s + this.cardPoints(c), 0), 0);
    this.finishRound([id], `${this.winText(this.name(id))} +${total} Punkte`, { [id]: total });
  }

  static restore(data, onChange) { return MauMau.restoreInto(new this(data.code, data.settings, onChange), data); }
}
