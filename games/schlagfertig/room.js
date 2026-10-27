// Schlagfertig – Partyspiel für 3–8. Pro Runde bekommt jeder 2 lustige Aufgaben, jede Aufgabe geht an genau 2 Spieler
// (Aufgabe k an den k-ten und den (k+1)-ten Spieler im Kreis). Schreibphase → Abstimmen (pro Aufgabe beide Antworten ohne Namen
// nebeneinander, alle außer den beiden Autoren stimmen ab) → Auflösung (Namen aufdecken).
// Punkte: Stimmen × 100; alle Stimmen für eine Antwort (mindestens 2) = „Volltreffer“ +200.
// Letzte Runde (das Finale): eine Aufgabe für alle, jeder verteilt bis zu 3 Stimmen auf verschiedene Antworten (nicht die eigene), 100 je Stimme, kein Bonus.
// Die Aufgaben liegen in aufgaben.json; der Host kann eigene ergänzen (eine pro Zeile, gelten nur in diesem Raum).
import { readFileSync } from 'node:fs';
import { PartyRoom, partyOptions, cleanAnswer, NO_ANSWER, PLACEHOLDERS } from '../party-room.js';
import { shuffle } from '../../server/random.js';

const CATALOG = JSON.parse(readFileSync(new URL('./aufgaben.json', import.meta.url), 'utf8'));
export const PTS_PER_VOTE = 100;
export const PTS_FULL_HIT = 200;
export const FINAL_VOTES = 3;

export class Room extends PartyRoom {
  static OPTIONS = [...partyOptions(), { key: 'nudge', label: 'Anstupsen für Trödler (mit Sprüchen)', type: 'bool' }];
  defaultSettings() { return { rounds: 3, writeSecs: 60, voteSecs: 30, target: 0, spectators: false, nudge: true }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 8 });
    this.unit = 'Runde';
    this.tasks = []; this.steps = []; this.hasVotes = null; this.results = []; this.gains = {};
  }
  get flow() { return this.hasVotes === false ? ['write', 'reveal'] : ['write', 'vote', 'reveal']; }
  catalog() { return CATALOG; }
  parseCustom(line, i = 0) { return line.length >= 8 ? { id: `x${i + 1}`, q: line } : null; }

  // Runden: Duell-Runden mit je einer Aufgabe pro Spieler, die letzte Runde ist das Finale mit einer Aufgabe für alle
  pickQuestions(rounds) {
    const n = this.order.length;
    const need = (rounds - 1) * n + 1;
    const list = [];
    for (let guard = 0; list.length < need && guard < 10; guard++) list.push(...this.draw(need - list.length));
    const out = [];
    let k = 0;
    for (let r = 0; r < rounds; r++) {
      const final = r === rounds - 1;
      const count = final ? 1 : n;
      out.push({ kind: final ? 'final' : 'duel', tasks: list.slice(k, k + count) });
      k += count;
    }
    return out;
  }
  startQuestion() {
    const n = this.order.length;
    const final = this.cur.kind === 'final';
    this.tasks = this.cur.tasks.map((t, k) => ({ q: t.q, authors: final ? [...this.order] : [this.order[k % n], this.order[(k + 1) % n]], answers: {} }));
    this.steps = []; this.hasVotes = null; this.results = []; this.gains = {};
  }
  get isFinal() { return this.cur?.kind === 'final'; }
  myTasks(id) { return this.order.includes(id) ? this.tasks.map((t, k) => (t.authors.includes(id) ? k : -1)).filter((k) => k >= 0) : []; }
  step() { return this.steps[this.sub]; }

  // ---------- Schreiben ----------
  answer(id, task, text) {
    if (this.phase !== 'playing' || this.stage !== 'write') throw new Error('Gerade wird nicht geschrieben');
    const t = this.tasks[Number(task)];
    if (!t || !this.order.includes(id) || !t.authors.includes(id)) throw new Error('Diese Aufgabe gehört dir nicht');
    const a = cleanAnswer(text);
    if (!a) throw new Error('Bitte schreib etwas hin');
    t.answers[id] = a;
    if (this.myTasks(id).every((k) => this.tasks[k].answers[id] !== undefined)) this.act(id, '✓ fertig');
    this.checkDone();
  }
  writeDone(id) { return this.myTasks(id).every((k) => this.tasks[k].answers[id] !== undefined); }

  // ---------- Abstimmen ----------
  canVote(id, s) {
    if (!s) return false;
    const t = this.tasks[s.task];
    if (this.order.includes(id)) return this.isFinal ? s.display.some((a) => a !== id) : !t.authors.includes(id);
    return !!this.settings.spectators && !!this.players.get(id) && !this.players.get(id).kicked;
  }
  maxPicks(id, s) { return this.isFinal ? Math.min(FINAL_VOTES, s.display.filter((a) => a !== id).length) : 1; }
  // Duell: choice = 0 oder 1 (links/rechts). Finale: choice = Liste von Positionen (bis zu 3, nicht die eigene)
  vote(id, choice) {
    if (this.phase !== 'playing' || this.stage !== 'vote') throw new Error('Gerade wird nicht abgestimmt');
    const s = this.step();
    if (!this.canVote(id, s)) throw new Error(this.isFinal ? 'Du kannst hier nicht abstimmen' : 'Die Autoren stimmen nicht mit ab');
    if (this.isFinal) {
      const picks = [...new Set((Array.isArray(choice) ? choice : []).map(Number))];
      if (!picks.length || picks.length > this.maxPicks(id, s) || picks.some((i) => !Number.isInteger(i) || i < 0 || i >= s.display.length || s.display[i] === id)) throw new Error(`Wähle bis zu ${this.maxPicks(id, s)} fremde Antworten`);
      s.votes[id] = picks.map((i) => s.display[i]);
    } else {
      const i = Number(choice);
      if (i !== 0 && i !== 1) throw new Error('Wähle eine der beiden Antworten');
      s.votes[id] = [s.display[i]];
    }
    if (this.order.includes(id)) this.act(id, '✓ gewählt');
    this.checkDone();
  }

  waiting(stage) {
    if (stage === 'write') return this.order.filter((id) => !this.writeDone(id));
    if (stage === 'vote') { const s = this.step(); return s ? this.order.filter((id) => this.canVote(id, s) && s.votes[id] === undefined) : []; }
    return [];
  }
  isReady(id) {
    if (!this.order.includes(id)) return false;
    if (this.stage === 'write') return this.writeDone(id);
    const s = this.step();
    return this.stage === 'vote' && !!s && s.votes[id] !== undefined; // Autoren gelten nicht als „fertig“: so verrät die Anzeige nicht, wer geschrieben hat
  }

  closeStage(stage) {
    if (stage !== 'write') return;
    for (const t of this.tasks) for (const id of t.authors) if (t.answers[id] === undefined) t.answers[id] = '';
    this.steps = [];
    this.tasks.forEach((t, k) => {
      const written = t.authors.filter((id) => t.answers[id]);
      if (!written.length) return; // niemand hat etwas geschrieben: nichts abzustimmen
      this.steps.push({ task: k, display: shuffle(this.isFinal ? written : [...t.authors]), votes: {} });
    });
    this.hasVotes = this.steps.length > 0;
  }
  moreSteps(stage) { return stage === 'vote' && this.sub + 1 < this.steps.length; }
  revealTime() { return Math.min(60, 10 + 6 * Math.max(1, this.steps.length)); }

  enter(stage) {
    if (stage !== 'reveal') return;
    this.results = this.steps.map((s) => {
      const t = this.tasks[s.task];
      const answers = s.display.map((author) => {
        const voters = Object.entries(s.votes).filter(([, picks]) => picks.includes(author)).map(([v]) => v);
        return { id: author, text: t.answers[author] || '', votes: voters.length, voters, pts: voters.length * PTS_PER_VOTE, fullHit: false };
      });
      const total = answers.reduce((a, x) => a + x.votes, 0);
      if (!this.isFinal && total >= 2) for (const a of answers) if (a.votes === total) { a.fullHit = true; a.pts += PTS_FULL_HIT; }
      return { q: t.q, answers };
    });
    this.gains = {};
    for (const r of this.results) for (const a of r.answers) { this.gains[a.id] = (this.gains[a.id] || 0) + a.pts; this.addPoints(a.id, a.pts); }
    const best = Object.entries(this.gains).sort((a, b) => b[1] - a[1])[0];
    const hits = this.results.flatMap((r) => r.answers).filter((a) => a.fullHit);
    this.say(best && best[1] ? `Runde ${this.q + 1}: ${this.name(best[0])} holt ${best[1]} Punkte${hits.length ? ` – ${hits.length}× Volltreffer` : ''}` : `Runde ${this.q + 1}: keine Stimmen`, 'win');
  }

  // Bots: Platzhalter-Antworten, Stimmen zufällig
  botStep(id, rng = Math.random) {
    if (this.stage === 'write') {
      for (const k of this.myTasks(id)) if (this.tasks[k].answers[id] === undefined) this.answer(id, k, PLACEHOLDERS[Math.floor(rng() * PLACEHOLDERS.length)]);
    } else if (this.stage === 'vote') {
      const s = this.step();
      if (!this.canVote(id, s)) return;
      if (!this.isFinal) return this.vote(id, rng() < 0.5 ? 0 : 1);
      const others = s.display.map((a, i) => (a === id ? -1 : i)).filter((i) => i >= 0);
      const n = 1 + Math.floor(rng() * this.maxPicks(id, s));
      this.vote(id, shuffle(others, (m) => Math.floor(rng() * m)).slice(0, n));
    }
  }
  fallback(id) { this.botStep(id, Math.random); }

  stageView(viewerId) {
    const base = { final: this.isFinal };
    if (this.stage === 'write') {
      const mine = this.myTasks(viewerId);
      return { ...base, tasks: mine.map((k) => ({ idx: k, q: this.tasks[k].q, mine: this.tasks[k].answers[viewerId] ?? null })), canWrite: mine.length > 0 };
    }
    if (this.stage === 'vote') {
      const s = this.step(), t = this.tasks[s.task];
      const can = this.canVote(viewerId, s);
      return {
        ...base, prompt: t.q, step: this.sub + 1, steps: this.steps.length, canVote: can, isAuthor: !this.isFinal && t.authors.includes(viewerId) && this.order.includes(viewerId),
        // Nur Texte – keine Autoren, keine Stimmen der anderen (erst in der Auflösung)
        answers: s.display.map((a, i) => ({ i, text: t.answers[a] || NO_ANSWER, empty: !t.answers[a], mine: a === viewerId })),
        maxPicks: can ? this.maxPicks(viewerId, s) : 0,
        myVote: s.votes[viewerId] ? s.votes[viewerId].map((a) => s.display.indexOf(a)) : null,
      };
    }
    return { ...base, results: this.results, gains: this.gains };
  }
  static restore(data, onChange) { return PartyRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
