// Schwimmen (31) – Kartenspiel mit 32 Karten (7 bis Ass) für 2–9. Hausregeln (Standard):
// Jeder bekommt 3 Karten, 3 liegen offen in der Mitte. Gezählt wird die höchste Summe EINER Farbe
// (Ass 11, Bilder 10, Zahlen nach Augen); drei gleiche Werte = 30,5. 31 (Ass + zwei Zehner einer Farbe) beendet den Durchgang sofort.
// Zug: eine Karte tauschen, alle drei tauschen, schieben (nichts tun) oder klopfen. Schieben alle hintereinander, kommt eine neue Mitte.
// Klopfen (erst ab der zweiten Runde am Tisch) ersetzt den Zug: jeder andere hat noch genau einen Zug, dann wird gewertet.
// Wertung: Die niedrigste Summe verliert ein Leben (Gleichstand: alle). Ohne Leben „schwimmt“ man noch einmal mit; wer dann verliert, ist raus.
// Feuer (drei Asse = 33, Hausregel): sofortige Wertung, alle anderen verlieren ein Leben. Wer übrig bleibt, gewinnt das Spiel.
// Ein Spiel (= eine Runde der Plattform) besteht aus vielen Durchgängen; der Verlierer eines Durchgangs fängt den nächsten an.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const SUITS = ['c', 's', 'h', 'd'];
export const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const POINTS = { 7: 7, 8: 8, 9: 9, T: 10, J: 10, Q: 10, K: 10, A: 11 };

// Wert einer Hand: höchste Summe einer Farbe; drei gleiche Werte 30,5 (drei Asse mit Feuer 33)
export function handValue(cards, fire = false) {
  if (cards.length === 3 && cards.every((c) => c[0] === cards[0][0])) return fire && cards[0][0] === 'A' ? 33 : 30.5;
  let best = 0;
  for (const s of SUITS) best = Math.max(best, cards.filter((c) => c[1] === s).reduce((a, c) => a + POINTS[c[0]], 0));
  return best;
}
export const valueText = (v) => (v === 30.5 ? '30½' : String(v));

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 2, max: 5 },
    { key: 'swim', label: 'Schwimmen: ohne Leben noch einmal mitspielen', type: 'bool' },
    { key: 'passing', label: 'Schieben erlaubt', type: 'bool' },
    { key: 'fire', label: 'Feuer: drei Asse = 33, alle anderen verlieren ein Leben', type: 'bool' },
  ];
  defaultSettings() { return { lives: 3, swim: true, passing: true, fire: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 9, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.lives = {}; this.swimming = new Set();
    this.resetDeal();
    this.lastDeal = null; // aufgedeckte Hände des letzten Durchgangs
    this.dealNo = 0;
  }
  resetDeal() {
    this.deck = []; this.middle = []; this.hands = {};
    this.knocker = null;     // wer geklopft hat
    this.lastTurns = null;   // wer nach dem Klopfen noch einen Zug hat
    this.passStreak = 0;     // so viele haben hintereinander geschoben
    this.turnsTaken = 0;     // Züge in diesem Durchgang (Klopfen erst ab der zweiten Runde am Tisch)
  }

  setupRound() {
    this.lives = Object.fromEntries(this.order.map((id) => [id, this.settings.lives]));
    this.swimming = new Set();
    this.lastDeal = null;
    this.dealNo = 0;
    this.deal(0);
  }

  deal(start) {
    this.resetDeal();
    this.dealNo++;
    this.deck = shuffle(SUITS.flatMap((s) => RANKS.map((r) => r + s)));
    for (const id of this.order) this.hands[id] = this.deck.splice(-3);
    this.middle = this.deck.splice(-3);
    this.turn = start % this.order.length;
    this.say(`Durchgang ${this.dealNo}: ${this.name(this.order[this.turn])} fängt an`, 'cards');
    // Schon beim Geben 31 (oder Feuer)? Dann sofort aufdecken
    this.checkInstant();
  }

  value(id) { return handValue(this.hands[id], this.settings.fire); }
  canKnock() { return !this.knocker && this.turnsTaken >= this.order.length; }

  // ---------- Züge ----------
  swap(id, handIndex, midIndex) {
    this.requireTurn(id);
    const h = Number(handIndex), m = Number(midIndex);
    if (!(h >= 0 && h < 3 && m >= 0 && m < 3)) throw new Error('Diese Karte gibt es nicht');
    const gave = this.hands[id][h], took = this.middle[m];
    [this.hands[id][h], this.middle[m]] = [this.middle[m], this.hands[id][h]];
    this.say(`${this.name(id)} tauscht eine Karte`, 'info', 'action');
    this.act(id, 'tauscht eine', { gave: [gave], took: [took] });
    this.passStreak = 0;
    this.endTurn(id);
  }

  swapAll(id) {
    this.requireTurn(id);
    const gave = [...this.hands[id]], took = [...this.middle];
    [this.hands[id], this.middle] = [this.middle, this.hands[id]];
    this.say(`${this.name(id)} tauscht alle drei`, 'info', 'action');
    this.act(id, 'tauscht alle drei', { gave, took });
    this.passStreak = 0;
    this.endTurn(id);
  }

  pass(id) {
    this.requireTurn(id);
    if (!this.settings.passing) throw new Error('Schieben ist an diesem Tisch aus');
    this.say(`${this.name(id)} schiebt`, 'info', 'action');
    this.act(id, 'schiebt');
    this.passStreak++;
    // Haben alle hintereinander geschoben: neue Mitte (die alte kommt zurück in den Stapel)
    if (this.passStreak >= this.order.length) {
      this.deck = shuffle([...this.deck, ...this.middle]);
      this.middle = this.deck.splice(-3);
      this.passStreak = 0;
      this.say('Alle haben geschoben – neue Karten in der Mitte', 'cards');
    }
    this.endTurn(id);
  }

  knock(id) {
    this.requireTurn(id);
    if (this.knocker) throw new Error('Es hat schon jemand geklopft');
    if (!this.canKnock()) throw new Error('Klopfen geht erst ab der zweiten Runde');
    this.knocker = id;
    this.lastTurns = new Set(this.order.filter((p) => p !== id));
    this.say(`${this.name(id)} klopft – jeder hat noch einen Zug`, 'warn');
    this.act(id, 'klopft!');
    this.passStreak = 0;
    this.turnsTaken++;
    this.next(1);
  }

  endTurn(id) {
    this.turnsTaken++;
    if (this.checkInstant()) return;
    if (this.lastTurns) {
      this.lastTurns.delete(id);
      if (!this.lastTurns.size) return this.score('klopfen');
    }
    this.next(1);
  }

  // 31 oder Feuer: sofort aufdecken
  checkInstant() {
    if (this.phase !== 'playing') return true;
    const vals = this.order.map((id) => [id, this.value(id)]);
    if (this.settings.fire && vals.some(([, v]) => v === 33)) { this.score('feuer'); return true; }
    if (vals.some(([, v]) => v === 31)) { this.score('31'); return true; }
    return false;
  }

  // ---------- Wertung eines Durchgangs ----------
  score(reason) {
    const vals = Object.fromEntries(this.order.map((id) => [id, this.value(id)]));
    let losers;
    if (reason === 'feuer') losers = this.order.filter((id) => vals[id] !== 33);
    else { const low = Math.min(...Object.values(vals)); losers = this.order.filter((id) => vals[id] === low); }
    const hero = reason === '31' ? this.order.find((id) => vals[id] === 31) : reason === 'feuer' ? this.order.find((id) => vals[id] === 33) : null;
    if (hero) this.act(hero, reason === 'feuer' ? 'Feuer!' : '31!');
    this.lastDeal = {
      no: this.dealNo, reason, knocker: this.knocker, hero,
      hands: Object.fromEntries(this.order.map((id) => [id, [...this.hands[id]]])), values: vals, losers,
    };
    const head = reason === '31' ? `${this.name(hero)} hat 31!` : reason === 'feuer' ? `Feuer! ${this.name(hero)} hat drei Asse` : 'Aufgedeckt';
    this.say(`${head} ${this.order.map((id) => `${this.name(id)} ${valueText(vals[id])}`).join(' · ')}`, 'cards');
    // Würden alle Übrigen ausscheiden (z. B. zwei Schwimmer gleichauf), scheidet niemand aus – es wird neu gegeben
    // Raus ist, wer schon schwimmt (oder ohne Schwimmen das letzte Leben verliert)
    const goesOut = (id) => this.lives[id] === 0 || (this.lives[id] === 1 && !this.settings.swim);
    if (losers.filter(goesOut).length === this.order.length) {
      this.say('Alle wären raus – der Durchgang zählt nicht', 'warn');
      return this.deal(this.turn);
    }
    const out = [];
    for (const id of losers) {
      if (goesOut(id)) { out.push(id); continue; }
      this.lives[id]--;
      if (this.lives[id] > 0) this.say(`${this.name(id)} verliert ein Leben (noch ${this.lives[id]})`, 'win');
      else { this.swimming.add(id); this.say(`${this.name(id)} hat kein Leben mehr und schwimmt`, 'win'); this.act(id, 'schwimmt'); }
    }
    const first = losers.find((id) => !out.includes(id)) ?? null;
    for (const id of out) { this.say(`${this.name(id)} ist raus`, 'win'); this.order.splice(this.order.indexOf(id), 1); }
    if (this.order.length === 1) {
      const w = this.order[0];
      return this.finishRound([w], `${this.name(w)} gewinnt Schwimmen!`, { [w]: 1 });
    }
    // Der Verlierer fängt an (ist er raus: wer danach sitzt)
    const startId = first ?? this.order[0];
    this.deal(Math.max(0, this.order.indexOf(startId)));
  }

  onDropOut(p) {
    this.deck.unshift(...(this.hands[p.id] || [])); // Karten zurück in den Stapel
    delete this.hands[p.id];
    this.lastTurns?.delete(p.id);
    if (this.knocker === p.id) { this.knocker = null; this.lastTurns = null; }
  }
  // Aussteiger mitten im Durchgang: hatten alle anderen ihren letzten Zug schon, wird gewertet
  dropOut(p, message) {
    super.dropOut(p, message);
    if (this.phase === 'playing' && this.lastTurns && !this.lastTurns.size) this.score('klopfen');
  }

  publicPlayer(p) {
    return {
      lives: this.lives[p.id] ?? 0, swimming: this.swimming.has(p.id), knocked: this.knocker === p.id,
      out: this.phase !== 'lobby' && this.seats.includes(p.id) && !this.order.includes(p.id) && p.id in this.lives,
    };
  }

  gameView(viewerId) {
    const mine = this.hands[viewerId];
    return {
      middle: [...this.middle], deck: this.deck.length,
      hand: mine ? [...mine] : null,          // nur die eigenen Karten
      myValue: mine ? this.value(viewerId) : null,
      knocker: this.knocker, lastTurn: this.lastTurns ? this.lastTurns.has(viewerId) : false,
      canKnock: this.currentId === viewerId && this.canKnock(),
      passStreak: this.passStreak,
      lastDeal: this.lastDeal, // aufgedeckt erst nach der Wertung – die Hände waren dann für alle sichtbar
      dealNo: this.dealNo,
    };
  }

  // Zwischen den Spielen gibt es nichts zu speichern außer Punkten (Leben gelten nur für ein Spiel)
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
