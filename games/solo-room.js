// Bauart-B-Baustein: Partyspiele, bei denen alle gleichzeitig solo spielen (Zahlenzoo, Gedächtnisküche, Pfeilfieber, Sortierstation).
// Der Server verteilt pro Runde einen Seed. Jeder spielt lokal im Browser; aus dem Seed entsteht überall dieselbe Runde
// (Spiellogik in public/games/<spiel>/logic.js – dieselbe Datei läuft im Browser und hier). Am Ende schickt jeder seine Eingaben,
// der Server spielt sie nach (Zeitstempel und Tempo werden geprüft) und wertet aus. Die Antwort kommt nicht vom Browser, sondern aus dem Nachspielen.
//
// Das Spiel (Unterklasse) setzt static LOGIC = Modul mit
//   makeRound(seed, level, optionen)       Runde aus dem Seed (kann die Lösung enthalten – wie überall bei Bauart B ist Schummeln durch Lesen des Codes nicht ausgeschlossen)
//   score(round, payload, { elapsedMs, settings }) → { pts, ok, detail }   Prüfung und Wertung
//   botPayload(round, rng, settings)       Eingaben eines Computer-Mitspielers
//   solution(round)                        was nach der Runde offen gezeigt wird
// und get timed() (true: die Zeit ist das Spielfenster, der Browser schickt kurz vor Ablauf; false: bis alle fertig sind).
import { randomInt } from 'node:crypto';
import { PartyRoom, partyOptions } from './party-room.js';

export const GRACE_MS = 3000; // Zeit nach dem Spielfenster, in der die Abgabe noch ankommt (nur bei Spielen mit Zeitfenster)
export const soloOptions = () => partyOptions({ voting: false });

export class SoloRoom extends PartyRoom {
  constructor(code, settings, onChange, opts) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, ...opts });
    this.subs = {}; this.rd = null; this.t0 = 0; this.reveal = null;
  }
  get logic() { return this.constructor.LOGIC; }
  get timed() { return false; }
  get flow() { return ['write', 'reveal']; }
  get unit() { return 'Runde'; }
  catalog() { return []; }
  roundOptions() { return {}; }
  get playMs() { return (Number(this.settings.writeSecs) || 30) * 1000; }

  pickQuestions(n) { return Array.from({ length: n }, (_, i) => ({ id: `r${i}`, seed: randomInt(1, 2 ** 31 - 1), level: i })); }
  startQuestion() {
    this.subs = {}; this.reveal = null;
    this.rd = this.logic.makeRound(this.cur.seed, this.cur.level, { ...this.roundOptions(), playMs: this.playMs });
    this.t0 = Date.now();
  }
  stageSecs(stage) {
    if (stage === 'reveal') return this.revealTime();
    const s = Number(this.settings.writeSecs) || 0;
    return this.timed ? s + GRACE_MS / 1000 : s;
  }

  waiting() { return this.order.filter((id) => !this.subs[id]); }
  isReady(id) { return !!this.subs[id]; }

  // Eingaben abgeben (einmal pro Runde). elapsedMs kommt von der Serveruhr, nicht vom Browser.
  submit(id, payload) {
    if (this.phase !== 'playing' || this.stage !== 'write') throw new Error('Gerade läuft keine Runde');
    if (!this.canAnswer(id)) throw new Error('Du spielst in dieser Partie nicht mit');
    if (this.subs[id]) throw new Error('Du hast schon abgegeben');
    const res = this.logic.score(this.rd, payload && typeof payload === 'object' ? payload : {}, { elapsedMs: Date.now() - this.t0, settings: this.settings });
    this.subs[id] = { pts: Math.max(0, Math.floor(res.pts) || 0), ok: !!res.ok, detail: String(res.detail ?? '').slice(0, 80) };
    if (this.order.includes(id)) this.act(id, '✓ fertig');
    this.checkDone();
  }
  closeStage(stage) {
    if (stage !== 'write') return;
    for (const id of this.order) if (!this.subs[id]) this.subs[id] = { pts: 0, ok: false, detail: 'nicht abgegeben', missing: true };
  }

  enter(stage) {
    if (stage !== 'reveal') return;
    const results = this.order.filter((id) => this.subs[id]).map((id) => ({ id, ...this.subs[id] })).sort((a, b) => b.pts - a.pts);
    for (const r of results) this.addPoints(r.id, r.pts);
    this.reveal = { results, solution: this.logic.solution(this.rd) };
    const best = results[0];
    this.say(best && best.pts > 0 ? `${this.unit} ${this.q + 1}: ${this.name(best.id)} holt die meisten Punkte (${best.pts})` : `${this.unit} ${this.q + 1}: niemand hat gepunktet`, 'win');
  }

  botStep(id, rng = Math.random) {
    if (this.stage === 'write' && !this.subs[id]) this.submit(id, this.logic.botPayload(this.rd, rng, this.settings));
  }
  fallback(id) { this.botStep(id); }

  stageView(viewerId) {
    return {
      timed: this.timed, playMs: this.playMs, graceMs: GRACE_MS, t0: this.t0,
      seed: this.stage === 'write' ? this.cur.seed : null, level: this.cur.level, options: this.roundOptions(),
      mine: this.subs[viewerId] ? { pts: this.subs[viewerId].pts, ok: this.subs[viewerId].ok } : null, // nur das Eigene
      reveal: this.stage === 'reveal' ? this.reveal : null,
    };
  }

  onAbort() { super.onAbort(); this.subs = {}; this.reveal = null; }
  static restore(data, onChange) { return PartyRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
