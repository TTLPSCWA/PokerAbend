// Mäxchen – Würfeln und Bluffen mit zwei Würfeln. Hausregeln:
// Wertung: höhere Zahl vorne (5 und 3 = 53). Reihenfolge: 31 < 32 < 41 … < 65 < Pasch 11 < … < Pasch 66 < Mäxchen (21).
// Wer dran ist, würfelt verdeckt (nur er sieht den Wurf) und sagt einen Wert an, der höher sein muss als die letzte Ansage – ehrlich oder geblufft.
// Der Nächste glaubt (und würfelt selbst) oder zweifelt an: Dann wird aufgedeckt. Gelogen → der Ansager verliert ein Leben, sonst der Zweifler.
// Bei Mäxchen kostet es zwei Leben. Auf eine Mäxchen-Ansage kann man nur anzweifeln oder sie gelten lassen (ein Leben weg, ohne Aufdecken).
// Wer verliert, beginnt neu. Wer keine Leben mehr hat, ist raus; der Letzte gewinnt die Runde.
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const MAEXCHEN = 21;
// Alle Ansagen von niedrig nach hoch
export const VALUES = [
  31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65,
  11, 22, 33, 44, 55, 66, MAEXCHEN,
];
export const rank = (v) => VALUES.indexOf(v);
export const valueOf = ([a, b]) => { const hi = Math.max(a, b), lo = Math.min(a, b); return hi === 2 && lo === 1 ? MAEXCHEN : hi * 10 + lo; };
export const valueName = (v) => (v === MAEXCHEN ? 'Mäxchen' : v % 11 === 0 ? `Pasch ${v / 11}` : String(v));

export class Room extends TurnRoom {
  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 10, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.lives = {}; this.cup = null; this.last = null; this.reveal = null;
    this.roll = die; // Tests würfeln selbst
  }
  defaultSettings() { return { lives: 3 }; }
  clampSettings(input, base) {
    const s = { ...base };
    if ('lives' in input) { const n = Math.floor(Number(input.lives)); if (n >= 1 && n <= 10) s.lives = n; }
    return s;
  }

  setupRound() {
    this.lives = Object.fromEntries(this.order.map((id) => [id, this.settings.lives]));
    this.cup = null;   // Wurf des Aktiven (geheim)
    this.last = null;  // letzte Ansage { by, value, actual }
    this.reveal = null;
  }

  // Würfeln: am Anfang oder wenn man der letzten Ansage glaubt
  throwDice(id) {
    this.requireTurn(id);
    if (this.cup) throw new Error('Du hast schon gewürfelt – jetzt ansagen');
    if (this.last?.value === MAEXCHEN) throw new Error('Auf Mäxchen geht nur Anzweifeln oder Geltenlassen');
    this.cup = [this.roll(), this.roll()];
    this.reveal = null;
    this.say(`${this.name(id)} würfelt${this.last ? ' (glaubt die Ansage)' : ''}`, 'info', 'action');
  }

  announce(id, value) {
    this.requireTurn(id);
    if (!this.cup) throw new Error('Erst würfeln');
    value = Number(value);
    if (!VALUES.includes(value)) throw new Error('Diesen Wert gibt es nicht');
    if (this.last && rank(value) <= rank(this.last.value)) throw new Error(`Die Ansage muss höher sein als ${valueName(this.last.value)}`);
    this.last = { by: id, value, actual: valueOf(this.cup) };
    this.cup = null;
    this.say(`${this.name(id)} sagt ${valueName(value)}`, 'info', 'action');
    this.next(1);
  }

  // Anzweifeln: aufdecken und auswerten
  doubt(id) {
    this.requireTurn(id);
    if (!this.last || this.cup) throw new Error('Gerade gibt es nichts anzuzweifeln');
    const { by, value, actual } = this.last;
    const lied = rank(actual) < rank(value);
    const loser = lied ? by : id;
    this.reveal = { by, value, actual, loser };
    this.say(`${this.name(id)} zweifelt – aufgedeckt: ${valueName(actual)}. ${lied ? `${this.name(by)} hat geblufft` : 'Die Ansage stimmt'}`, 'cards');
    this.lose(loser, value === MAEXCHEN ? 2 : 1);
  }

  // Mäxchen gelten lassen: ein Leben weg, ohne aufzudecken
  accept(id) {
    this.requireTurn(id);
    if (this.last?.value !== MAEXCHEN || this.cup) throw new Error('Geltenlassen geht nur bei Mäxchen');
    this.reveal = null;
    this.say(`${this.name(id)} lässt Mäxchen gelten`, 'info', 'action');
    this.lose(id, 1);
  }

  lose(id, n) {
    this.lives[id] = Math.max(0, this.lives[id] - n);
    this.say(`${this.name(id)} verliert ${n === 1 ? 'ein Leben' : `${n} Leben`} (noch ${this.lives[id]})`, 'win');
    this.last = null; this.cup = null;
    if (this.lives[id] > 0) { this.turn = this.order.indexOf(id); return; }
    // Raus: der Nächste fängt neu an
    const i = this.order.indexOf(id);
    this.say(`${this.name(id)} ist raus`, 'win');
    this.order.splice(i, 1);
    if (this.order.length === 1) return this.finishRound([this.order[0]], `${this.name(this.order[0])} gewinnt Mäxchen!`, { [this.order[0]]: 1 });
    this.turn = i % this.order.length;
  }

  onDropOut(p) {
    if (this.last?.by === p.id) this.last = null;
    if (this.currentId === p.id) this.cup = null;
  }

  publicPlayer(p) { return { lives: this.lives[p.id] ?? 0, out: this.phase !== 'lobby' && this.seats.includes(p.id) && !this.order.includes(p.id) && this.lives[p.id] === 0 }; }

  gameView(viewerId) {
    const mine = this.currentId === viewerId;
    return {
      last: this.last ? { by: this.last.by, value: this.last.value } : null, // der echte Wurf bleibt geheim
      cup: mine && this.cup ? [...this.cup] : null,
      rolled: !!this.cup,
      reveal: this.reveal,
      values: VALUES,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
