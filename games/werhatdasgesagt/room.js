// Wer hat das gesagt? – Partyspiel für 3–10. Pro Runde eine persönliche, lockere Frage; alle beantworten sie anonym.
// Danach wird jede Antwort einzeln gezeigt, und alle anderen tippen, von wem sie stammt (Spielerliste mit Avataren).
// Punkte: richtig getippt +100 für den Tippenden; der Autor bekommt +50 für jeden, der falsch getippt hat (gut getarnt).
// Fragen liegen in fragen.json (keine Fragen zu Gesundheit, Beziehungen, Politik, Religion, Geld-Details).
// Hausregel „nur eigene Fragen“: gespielt wird nur aus der Liste des Hosts (Host-Menü, eine Frage pro Zeile).
import { readFileSync } from 'node:fs';
import { PartyRoom, partyOptions, cleanAnswer, NO_ANSWER, PLACEHOLDERS } from '../party-room.js';
import { shuffle } from '../../server/random.js';

const CATALOG = JSON.parse(readFileSync(new URL('./fragen.json', import.meta.url), 'utf8'));
export const PTS_RIGHT = 100;
export const PTS_DISGUISE = 50;

export class Room extends PartyRoom {
  static OPTIONS = [...partyOptions(), { key: 'ownOnly', label: 'Nur Fragen aus der eigenen Liste des Hosts', type: 'bool' }];
  defaultSettings() { return { rounds: 5, writeSecs: 60, voteSecs: 30, target: 0, spectators: false, ownOnly: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 10 });
    this.answers = {}; this.steps = []; this.hasVotes = null; this.results = []; this.gains = {};
  }
  get flow() { return this.hasVotes === false ? ['write', 'reveal'] : ['write', 'vote', 'reveal']; }
  catalog() { return CATALOG; }
  customOnly() { return !!this.settings.ownOnly; }
  parseCustom(line, i = 0) { return line.length >= 5 ? { id: `x${i + 1}`, q: line } : null; }

  startQuestion() { this.answers = {}; this.steps = []; this.hasVotes = null; this.results = []; this.gains = {}; }
  step() { return this.steps[this.sub]; }

  // ---------- Schreiben ----------
  answer(id, text) {
    if (this.phase !== 'playing' || this.stage !== 'write') throw new Error('Gerade wird nicht geantwortet');
    if (!this.order.includes(id)) throw new Error('Du spielst in dieser Partie nicht mit');
    const a = cleanAnswer(text);
    if (!a) throw new Error('Bitte schreib etwas hin');
    this.answers[id] = a;
    this.act(id, '✓ fertig');
    this.checkDone();
  }

  // ---------- Raten ----------
  // Raten dürfen alle außer dem Autor; Zuschauer nur, wenn der Host es erlaubt (ohne Punkte)
  canGuess(id, s) {
    if (!s || id === s.author) return false;
    if (this.order.includes(id)) return true;
    return !!this.settings.spectators && !!this.players.get(id) && !this.players.get(id).kicked;
  }
  guess(id, target) {
    if (this.phase !== 'playing' || this.stage !== 'vote') throw new Error('Gerade wird nicht geraten');
    const s = this.step();
    if (!this.canGuess(id, s)) throw new Error('Das ist deine Antwort – du darfst nicht raten');
    if (!this.order.includes(target) || target === id) throw new Error('Wähle einen anderen Mitspieler');
    s.guesses[id] = target;
    if (this.order.includes(id)) this.act(id, '✓ getippt');
    this.checkDone();
  }

  waiting(stage) {
    if (stage === 'write') return this.order.filter((id) => this.answers[id] === undefined);
    if (stage === 'vote') { const s = this.step(); return s ? this.order.filter((id) => this.canGuess(id, s) && s.guesses[id] === undefined) : []; }
    return [];
  }
  isReady(id) {
    if (!this.order.includes(id)) return false;
    if (this.stage === 'write') return this.answers[id] !== undefined;
    const s = this.step();
    return this.stage === 'vote' && !!s && s.guesses[id] !== undefined; // der Autor gilt nicht als „fertig“ – sonst wäre er sofort erkennbar
  }

  closeStage(stage) {
    if (stage !== 'write') return;
    for (const id of this.order) if (this.answers[id] === undefined) this.answers[id] = '';
    // Nur echte Antworten kommen zur Wahl, in zufälliger Reihenfolge
    this.steps = shuffle(this.order.filter((id) => this.answers[id])).map((author) => ({ author, guesses: {} }));
    this.hasVotes = this.steps.length > 0;
  }
  moreSteps(stage) { return stage === 'vote' && this.sub + 1 < this.steps.length; }
  revealTime() { return Math.min(60, 10 + 5 * Math.max(1, this.steps.length)); }

  enter(stage) {
    if (stage !== 'reveal') return;
    this.gains = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.results = this.steps.map((s) => {
      const guesses = Object.entries(s.guesses).map(([voter, target]) => ({ voter, target, right: target === s.author, spectator: !this.order.includes(voter) }));
      let wrong = 0;
      for (const g of guesses) {
        if (g.spectator) continue; // Zuschauer tippen nur zum Spaß mit: keine Punkte, und ihre Fehltipps geben dem Autor nichts
        if (g.right) { this.addPoints(g.voter, PTS_RIGHT); this.gains[g.voter] = (this.gains[g.voter] || 0) + PTS_RIGHT; } else wrong++;
      }
      this.addPoints(s.author, wrong * PTS_DISGUISE);
      this.gains[s.author] = (this.gains[s.author] || 0) + wrong * PTS_DISGUISE;
      return { author: s.author, text: this.answers[s.author], guesses, disguise: wrong * PTS_DISGUISE };
    });
    const best = Object.entries(this.gains).sort((a, b) => b[1] - a[1])[0];
    this.say(best && best[1] ? `Frage ${this.q + 1}: ${this.name(best[0])} holt ${best[1]} Punkte` : `Frage ${this.q + 1}: keine Tipps`, 'win');
  }

  // Bots: Platzhalter-Antworten, Tipps zufällig
  botStep(id, rng = Math.random) {
    if (this.stage === 'write') {
      if (this.answers[id] === undefined) this.answer(id, PLACEHOLDERS[Math.floor(rng() * PLACEHOLDERS.length)]);
    } else if (this.stage === 'vote') {
      const s = this.step();
      if (!this.canGuess(id, s) || s.guesses[id] !== undefined) return;
      const others = this.order.filter((p) => p !== id);
      this.guess(id, others[Math.floor(rng() * others.length)]);
    }
  }
  fallback(id) { this.botStep(id, Math.random); }

  stageView(viewerId) {
    if (this.stage === 'write') {
      return { prompt: this.cur.q, canWrite: this.order.includes(viewerId), mine: this.answers[viewerId] ?? null };
    }
    if (this.stage === 'vote') {
      const s = this.step();
      const can = this.canGuess(viewerId, s);
      return {
        prompt: this.cur.q, step: this.sub + 1, steps: this.steps.length,
        text: this.answers[s.author] || NO_ANSWER, // nur der Text – der Autor steht erst in der Auflösung im Zustand
        mine: s.author === viewerId, canGuess: can,
        myGuess: s.guesses[viewerId] ?? null,
        candidates: can ? this.order.filter((p) => p !== viewerId) : [],
      };
    }
    return { prompt: this.cur.q, results: this.results, gains: this.gains };
  }
  static restore(data, onChange) { return PartyRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
