// Tickendes Paket – Partyspiel für 3–8 (Heiße-Kartoffel-Mechanik). Ein Paket tickt mit einer für alle unbekannten Zeit und wandert von Hand zu Hand.
// Wer es hat, bekommt eine Kurzfrage („Ein Tier mit K“) und muss mit einem passenden Wort antworten, das mit dem Buchstaben beginnt und in dieser Runde noch nicht vorkam.
// Danach geht das Paket an den Nächsten. Wer zu lange braucht, behält es (neue Frage, die Uhr tickt weiter). Platzt es, bekommt der Halter einen Minuspunkt und fängt die nächste Runde an.
// Nach den eingestellten Runden gewinnt, wer die wenigsten Minuspunkte hat. Ob ein Wort wirklich zur Kategorie passt, prüft die Gruppe selbst (es gibt kein Wörterbuch);
// der Server prüft nur Anfangsbuchstabe, Länge und Wiederholung. Wie lange das Paket noch tickt, erfährt niemand.
import { randomInt } from 'node:crypto';
import { TurnRoom } from '../../server/turn-room.js';
import { cleanText } from '../../server/security.js';

export const CATEGORIES = [
  'Tier', 'Stadt in Deutschland', 'Obst oder Gemüse', 'Beruf', 'Land', 'Fluss oder See', 'Automarke', 'Sportart', 'Getränk', 'Kleidungsstück',
  'Musikinstrument', 'Möbelstück', 'Vorname', 'Gegenstand im Badezimmer', 'Gegenstand in der Küche', 'Fahrzeug', 'Farbe', 'Pflanze', 'Süßigkeit', 'Körperteil',
  'Schulfach', 'Brettspiel oder Kartenspiel', 'Werkzeug', 'Insekt', 'Gewürz oder Kraut', 'Gericht', 'Film oder Serie', 'Berg oder Gebirge', 'Märchenfigur', 'Etwas, das man im Urlaub braucht',
];
export const LETTERS = 'ABDEFGHKLMNPRSTWZ'.split('');
export const MAX_WORD = 30;
export const norm = (w) => String(w).trim().toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'rounds', label: 'Anzahl Runden (Pakete)', type: 'number', min: 1, max: 20 },
    { key: 'turnTime', label: 'Sekunden pro Antwort (0 = ohne)', type: 'number', min: 0, max: 60 },
    { key: 'visibleFuse', label: 'Sichtbarer Countdown statt Zufallszeit', type: 'bool' },
  ];
  defaultSettings() { return { rounds: 5, turnTime: 12, visibleFuse: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 8, lowWins: true, scoreLabel: 'Minuspunkte' });
    this.minus = {}; this.bomb = 0; this.prompt = null; this.used = []; this.fuseTimer = null; this.fuseEndsAt = 0; this.fuseMs = 0; this.exploded = null;
  }

  get fuseRange() { return this.settings.visibleFuse ? [30000, 30000] : [18000, 45000]; }
  setupRound() {
    this.minus = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.bomb = 0; this.exploded = null;
    this.armBomb();
  }
  // Neues Paket: Zündschnur, leere Wortliste, erste Frage
  armBomb() {
    const [lo, hi] = this.fuseRange;
    this.fuseMs = lo === hi ? lo : lo + randomInt(hi - lo + 1);
    this.startFuse(this.fuseMs);
    this.bomb++; this.used = []; this.newPrompt();
    this.say(`Paket ${this.bomb} von ${this.settings.rounds} tickt – ${this.name(this.currentId)} hat es`, 'cards');
  }
  startFuse(ms) {
    clearTimeout(this.fuseTimer);
    this.fuseEndsAt = Date.now() + ms;
    this.fuseTimer = setTimeout(() => { this.fuseTimer = null; if (this.phase === 'playing') { this.boom(); this.onChange('state'); } }, ms);
    this.fuseTimer.unref?.();
  }
  newPrompt() { this.prompt = { cat: CATEGORIES[randomInt(CATEGORIES.length)], letter: LETTERS[randomInt(LETTERS.length)] }; }

  answer(id, text) {
    this.requireTurn(id);
    const word = cleanText(text, MAX_WORD);
    const n = norm(word);
    if (n.length < 2) throw new Error('Das ist zu kurz');
    if (n[0] !== norm(this.prompt.letter)) throw new Error(`Das Wort muss mit ${this.prompt.letter} anfangen`);
    if (this.used.some((u) => norm(u) === n)) throw new Error('Das gab es in dieser Runde schon');
    this.used.push(word);
    this.say(`${this.name(id)}: ${this.prompt.cat} mit ${this.prompt.letter} – „${word}“`, 'info', 'action');
    this.act(id, `${word}`);
    this.newPrompt();
    this.next(1);
  }
  // Zeit abgelaufen: der Halter behält das Paket und bekommt eine neue Frage
  onTimeout(id) {
    this.say(`${this.name(id)} war zu langsam und behält das Paket`, 'warn');
    this.act(id, 'zu langsam');
    this.newPrompt();
  }

  boom() {
    const id = this.currentId;
    this.minus[id] = (this.minus[id] || 0) + 1;
    this.exploded = { id, bomb: this.bomb };
    this.say(`💥 Das Paket platzt bei ${this.name(id)}! (${this.minus[id]} Minuspunkt${this.minus[id] === 1 ? '' : 'e'})`, 'win');
    this.act(id, '💥 Peng!');
    if (this.bomb >= this.settings.rounds) {
      const least = Math.min(...this.order.map((p) => this.minus[p]));
      const winners = this.order.filter((p) => this.minus[p] === least);
      return this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} ${winners.length > 1 ? 'haben' : 'hat'} die wenigsten Minuspunkte (${least})`, { ...this.minus });
    }
    this.turn = this.order.indexOf(id); // wem es geplatzt ist, fängt an
    this.armBomb();
    this.moveNo++;
  }

  clearFuse() { clearTimeout(this.fuseTimer); this.fuseTimer = null; }
  finishRound(...args) { this.clearFuse(); return super.finishRound(...args); }
  onAbort() { this.clearFuse(); this.prompt = null; this.used = []; }
  dispose() { this.clearFuse(); super.dispose(); }
  onDropOut(p) { delete this.minus[p.id]; }

  publicPlayer(p) { return { minus: this.minus[p.id] ?? 0, holder: this.currentId === p.id }; }
  gameView() {
    return {
      bomb: this.bomb, rounds: this.settings.rounds, prompt: this.prompt, used: [...this.used], exploded: this.exploded,
      minus: { ...this.minus }, visibleFuse: !!this.settings.visibleFuse,
      fuseLeft: this.settings.visibleFuse && this.fuseEndsAt ? Math.max(0, this.fuseEndsAt - Date.now()) : null, // nur beim sichtbaren Countdown
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
