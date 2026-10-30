// Wer bin ich? – Partyspiel für 3–10 (Bauart A). Jeder bekommt einen geheimen Begriff „auf die Stirn“: alle anderen sehen ihn, man selbst nicht.
// Reihum stellt man Ja/Nein-Fragen (gesprochen, z. B. per Voice; optional zusätzlich als Text), die anderen antworten mit „Ja“, „Nein“ oder „Weiß nicht“ –
// die Mehrheit gilt (bei Gleichstand „Unklar“). Statt zu fragen kann man raten. Ein Treffer (ohne Groß-/Kleinschreibung, Umlaute, Artikel, kleine Tippfehler)
// zählt automatisch, sonst stimmen die anderen ab, ob es zählt. Wer es erraten hat, bekommt seinen Zettel aufgedeckt und antwortet nur noch.
// Begriffe: „Gegenseitig“ (jeder schreibt für einen zugelosten Mitspieler), „Aus Kategorie“ (begriffe.json) oder „Eigene Liste“ des Hosts.
//
// Geheimhaltung: Der eigene Begriff geht NIE an den eigenen Browser, bis er erraten ist oder die Runde endet – auch nicht über Verlauf, Sprechblasen,
// Abstimmungen oder die Zwischenstände. Wer den Begriff eines anderen kennt, sieht ihn (das ist das Spiel); Zuschauer sehen alle.
// Wer den Begriff für wen geschrieben hat, erfährt niemand.
import { readFileSync } from 'node:fs';
import { TurnRoom } from '../../server/turn-room.js';
import { cleanText } from '../../server/security.js';
import { randomInt } from 'node:crypto';
import { shuffle } from '../../server/random.js';
import { DEFAULT_SETTINGS as POKER_DEFAULTS } from '../poker/room.js';

export const CATALOG = JSON.parse(readFileSync(new URL('./begriffe.json', import.meta.url), 'utf8'));
export const MODES = ['mutual', 'category', 'custom'];
export const MAX_WORD = 40;
export const MAX_QUESTION = 120;
export const MAX_NOTE = 80;
export const HINT_AFTER = 15;       // so viele eigene Fragen, dann darf man um einen Tipp bitten
export const BONUS_UNDER = 20;      // je Frage unter 20 gibt es 10 Punkte
const WORD_SECS = 90, VOTE_SECS = 20, GUESS_SECS = 25;
const NUDGE_LINES = POKER_DEFAULTS.nudgeLines.filter((l) => !/Karten/.test(l));
const NUDGE_GAP = 10000;
const ANSWERS = ['ja', 'nein', 'weiss'];

// ---------- Begriffe vergleichen ----------
const ARTICLES = /^(der|die|das|ein|eine|einen|einem|einer|dem|den|des)\s+/;
export function normalize(text) {
  let s = String(text ?? '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(ARTICLES, '');
  return s.replace(/ /g, '');
}
export function distance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
// Passt der Rateversuch automatisch? Gleich nach Normalisierung, oder bei Wörtern ab 6 Zeichen höchstens 2 Tippfehler
export function matches(guess, word) {
  const g = normalize(guess), w = normalize(word);
  if (!g || !w) return false;
  return g === w || (w.length >= 6 && distance(g, w) <= 2);
}
export const majority = (counts) => (counts.ja > counts.nein ? 'ja' : counts.nein > counts.ja ? 'nein' : 'unklar');

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'follow', label: 'Bei „Ja“ weiterfragen', type: 'bool' },
    { key: 'fixedQ', label: 'Feste Anzahl Fragen pro Zug (0 = aus)', type: 'number', min: 0, max: 5 },
    { key: 'maxQ', label: 'Höchstens Fragen pro Spieler (0 = unbegrenzt)', type: 'number', min: 0, max: 30 },
    { key: 'hints', label: 'Hinweis-Hilfe nach 15 Fragen', type: 'bool' },
    { key: 'penalty', label: 'Falsch geraten: eine Runde aussetzen', type: 'bool' },
    { key: 'nudge', label: 'Anstupsen', type: 'bool' },
    { key: 'qSecs', label: 'Sekunden pro Frage (0 = ohne)', type: 'number', min: 0, max: 600 },
    { key: 'limitMin', label: 'Zeitlimit des Abends in Minuten (0 = ohne)', type: 'number', min: 0, max: 240 },
  ];
  defaultSettings() { return { mode: 'mutual', cats: ['tiere'], follow: true, fixedQ: 0, maxQ: 0, hints: false, penalty: false, nudge: true, qSecs: 60, limitMin: 0 }; }
  // Zusätzlich zu Zahlen und Schaltern: Modus und Kategorien
  clampSettings(input, base) {
    const s = super.clampSettings(input, base);
    if ('mode' in input && MODES.includes(input.mode)) s.mode = input.mode;
    if ('cats' in input && Array.isArray(input.cats)) { const c = input.cats.filter((x) => typeof x === 'string' && CATALOG[x]); if (c.length) s.cats = [...new Set(c)]; }
    return s;
  }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 10, lowWins: false, scoreLabel: 'Punkte' });
    this.custom = [];
    this.stageTimer = null; this.limitTimer = null; this.stageKey = null; this.deadline = null;
    this.reset();
  }
  reset() {
    this.stage = null; this.sub = null;
    this.words = {}; this.targetOf = {}; this.drafts = {};
    this.solved = []; this.qs = {}; this.gaveUp = new Set(); this.skipNext = new Set();
    this.turnQ = 0; this.q = null; this.gv = null; this.hist = []; this.hints = []; this.hintReq = null; this.hintUsed = new Set();
    this.revealed = false; this.nudgeAt = {}; this.lastQ = null;
  }

  // ---------- Start ----------
  validateStart(ids) {
    const s = this.settings;
    if (s.mode === 'custom' && this.custom.length < ids.length) throw new Error(`Für ${ids.length} Mitspieler braucht die eigene Liste mindestens ${ids.length} Begriffe (Host-Menü)`);
    if (s.mode === 'category' && !s.cats.length) throw new Error('Bitte mindestens eine Kategorie wählen (Host-Menü)');
  }
  pool() {
    const s = this.settings;
    if (s.mode === 'custom') return [...this.custom];
    return s.cats.flatMap((c) => CATALOG[c]?.words || []);
  }
  setupRound() {
    this.reset();
    this.order.forEach((id) => { this.qs[id] = 0; });
    if (this.settings.mode === 'mutual') {
      // Jeder schreibt für den Nächsten in einer gemischten Reihe: jeder genau einen, niemand für sich selbst
      const ring = shuffle([...this.order]);
      ring.forEach((id, i) => { this.targetOf[id] = ring[(i + 1) % ring.length]; });
      this.stage = 'words';
      this.say('Jeder schreibt jetzt einen Begriff für einen zugelosten Mitspieler. Wer für wen schreibt, bleibt geheim.', 'cards');
      return;
    }
    const pool = shuffle(this.pool());
    this.order.forEach((id, i) => { this.words[id] = pool[i % pool.length]; });
    this.beginPlay();
  }
  beginPlay() {
    this.stage = 'play'; this.sub = 'ask'; this.turnQ = 0;
    this.startedAt = this.clock.now();
    this.clock.clearTimeout(this.limitTimer);
    const lim = Number(this.settings.limitMin) || 0;
    if (lim > 0) {
      this.limitTimer = this.clock.setTimeout(() => { this.limitTimer = null; if (this.phase === 'playing') { this.finish('Das Zeitlimit des Abends ist um'); this.onChange('state'); } }, lim * 60000);
      this.limitTimer.unref?.();
    }
    this.say('Alle Zettel hängen. Wer fängt an? – ' + this.name(this.order[this.turn]), 'cards');
  }
  get currentId() { return this.phase === 'playing' && this.stage === 'play' ? this.order[this.turn] ?? null : null; }

  // ---------- Begriffe schreiben („Gegenseitig“) ----------
  word(id, text) {
    if (this.phase !== 'playing' || this.stage !== 'words') throw new Error('Gerade werden keine Begriffe geschrieben');
    if (!this.order.includes(id)) throw new Error('Du spielst in dieser Runde nicht mit');
    const w = cleanText(text, MAX_WORD);
    if (w.length < 2) throw new Error('Der Begriff ist zu kurz');
    const n = normalize(w);
    if (this.order.some((p) => { const pn = normalize(this.name(p)); return pn.length >= 3 && (n === pn || n.includes(pn)); }) || [...this.players.values()].some((p) => normalize(p.name) === n)) {
      throw new Error('Bitte keine Begriffe über Mitspieler oder andere Privatpersonen');
    }
    this.drafts[id] = w;
    if (this.order.every((p) => this.drafts[p])) this.assignWords();
  }
  assignWords() {
    for (const [writer, target] of Object.entries(this.targetOf)) if (this.order.includes(target)) this.words[target] = this.drafts[writer];
    this.fillMissing();
    this.drafts = {}; this.targetOf = {}; // wer für wen geschrieben hat, wird vergessen
    this.beginPlay();
  }
  // Wer nichts geschrieben hat (Zeit um, ausgestiegen): der Begriff kommt aus der Kategorie „Tiere“ bzw. der eigenen Liste
  fillMissing() {
    const taken = new Set(Object.values(this.words).map(normalize));
    const pool = shuffle(this.pool().length ? this.pool() : CATALOG.tiere.words).filter((w) => !taken.has(normalize(w)));
    for (const id of this.order) if (!this.words[id]) this.words[id] = pool.shift() ?? CATALOG.tiere.words[randomInt(CATALOG.tiere.words.length)];
  }

  // ---------- Fragen ----------
  eligible(id) { return this.order.includes(id) && !this.solved.includes(id) && !this.gaveUp.has(id); }
  voters(exclude) { return this.order.filter((p) => p !== exclude); }
  activeVoters(exclude) { return this.voters(exclude).filter((p) => { const pl = this.players.get(p); return pl && (pl.connected || pl.bot); }); }

  ask(id, text) {
    this.requireAsk(id);
    const t = cleanText(text ?? '', MAX_QUESTION);
    this.qs[id] = (this.qs[id] || 0) + 1;
    this.q = { by: id, text: t, answers: {} };
    this.sub = 'vote';
    this.moveNo++;
    this.say(`${this.name(id)} fragt${t ? `: „${t}“` : ' (per Voice)'}`, 'info', 'action');
    this.act(id, t ? 'fragt' : 'fragt (Voice)');
  }
  requireAsk(id) {
    if (this.phase !== 'playing' || this.stage !== 'play' || this.sub !== 'ask') throw new Error('Gerade wird nicht gefragt');
    if (this.currentId !== id) throw new Error('Du bist nicht dran');
  }
  answer(id, a) {
    if (this.phase !== 'playing' || this.stage !== 'play' || this.sub !== 'vote') throw new Error('Gerade gibt es nichts zu beantworten');
    if (!this.order.includes(id) || id === this.q.by) throw new Error('Du antwortest nicht');
    if (!ANSWERS.includes(a)) throw new Error('Antworte mit Ja, Nein oder Weiß nicht');
    this.q.answers[id] = a;
    if (this.activeVoters(this.q.by).every((p) => this.q.answers[p])) this.resolveQuestion();
  }
  resolveQuestion() {
    const counts = { ja: 0, nein: 0, weiss: 0 };
    for (const a of Object.values(this.q.answers)) counts[a]++;
    const res = majority(counts);
    const by = this.q.by;
    this.hist.push({ t: 'q', by, text: this.q.text, res, counts });
    if (this.hist.length > 300) this.hist.shift();
    this.lastQ = { by, text: this.q.text, res, counts };
    this.say(`${this.name(by)}${this.q.text ? `: „${this.q.text}“` : ''} → ${{ ja: 'Ja', nein: 'Nein', unklar: 'Unklar' }[res]} (${counts.ja}:${counts.nein}${counts.weiss ? `, ${counts.weiss}× weiß nicht` : ''})`, res === 'ja' ? 'win' : 'info');
    this.act(by, { ja: 'Ja!', nein: 'Nein', unklar: 'Unklar' }[res]);
    this.q = null; this.sub = 'ask'; this.turnQ++;
    const s = this.settings;
    // Zu viele Fragen ohne Treffer: raus
    if (s.maxQ > 0 && this.qs[by] >= s.maxQ) {
      this.gaveUp.add(by);
      this.say(`${this.name(by)} hat ${s.maxQ} Fragen gebraucht und scheidet aus – der Begriff bleibt bis zum Schluss geheim`, 'warn');
      if (this.checkEnd()) return;
      return this.nextAsker();
    }
    const keep = s.fixedQ > 0 ? this.turnQ < s.fixedQ : s.follow && res === 'ja';
    if (!keep) this.nextAsker(); else this.moveNo++;
  }

  // ---------- Raten ----------
  guess(id, text) {
    this.requireAsk(id);
    const g = cleanText(text, MAX_WORD);
    if (g.length < 2) throw new Error('Tipp deinen Begriff ein');
    if (matches(g, this.words[id])) { this.hist.push({ t: 'g', by: id, text: g, ok: true }); return this.solve(id, g); }
    this.gv = { by: id, text: g, votes: {} };
    this.sub = 'gvote';
    this.moveNo++;
    this.say(`${this.name(id)} rät: „${g}“ – zählt das?`, 'info', 'action');
    this.act(id, `rät: ${g}`);
  }
  vote(id, ok) {
    if (this.phase !== 'playing' || this.stage !== 'play' || this.sub !== 'gvote') throw new Error('Gerade wird nicht über einen Tipp abgestimmt');
    if (!this.order.includes(id) || id === this.gv.by) throw new Error('Du stimmst nicht mit ab');
    this.gv.votes[id] = !!ok;
    if (this.activeVoters(this.gv.by).every((p) => p in this.gv.votes)) this.resolveGuess();
  }
  resolveGuess() {
    const { by, text, votes } = this.gv;
    const yes = Object.values(votes).filter(Boolean).length, no = Object.values(votes).length - yes;
    const ok = yes > no;
    this.hist.push({ t: 'g', by, text, ok });
    this.gv = null; this.sub = 'ask';
    if (ok) return this.solve(by, text);
    this.say(`${this.name(by)} lag mit „${text}“ daneben (${yes}:${no}).`, 'warn');
    this.act(by, 'daneben');
    if (this.settings.penalty) { this.skipNext.add(by); this.say(`${this.name(by)} setzt die nächste Runde aus.`, 'warn'); }
    this.nextAsker();
  }
  solve(id, text) {
    this.solved.push(id);
    const place = this.solved.length;
    this.say(`🎉 ${this.name(id)} hat es erraten: „${this.words[id]}“ (Platz ${place}, ${this.qs[id]} Frage${this.qs[id] === 1 ? '' : 'n'})`, 'win');
    this.act(id, 'erraten!');
    void text;
    this.q = null; this.gv = null; this.sub = 'ask';
    if (this.checkEnd()) return;
    this.nextAsker();
  }

  // ---------- Zugwechsel und Ende ----------
  remaining() { return this.order.filter((id) => this.eligible(id)); }
  checkEnd() {
    if (this.remaining().length <= 1) { this.finish(this.solved.length ? '' : 'Niemand hat seinen Begriff erraten'); return true; }
    return false;
  }
  nextAsker() {
    this.turnQ = 0; this.q = null; this.gv = null; this.sub = 'ask';
    const n = this.order.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.turn + k) % n;
      const id = this.order[i];
      if (!this.eligible(id)) continue;
      if (this.skipNext.has(id)) { this.skipNext.delete(id); this.say(`${this.name(id)} setzt aus.`, 'info'); this.act(id, 'setzt aus'); continue; }
      this.turn = i; this.moveNo++;
      return;
    }
    this.finish('Niemand ist mehr dran');
  }
  finish(reason = '') {
    if (this.phase !== 'playing') return;
    this.clearTimers();
    const n = this.order.length;
    const points = {};
    this.solved.forEach((id, i) => { points[id] = (n - (i + 1) + 1) * 100 + 10 * Math.max(0, BONUS_UNDER - (this.qs[id] || 0)); });
    for (const id of this.order) points[id] ||= 0;
    this.revealed = true; this.stage = 'over'; this.sub = null;
    const first = this.solved[0];
    const text = reason || `${this.name(first)} war am schnellsten`;
    this.finishRound(first ? [first] : [], first && reason ? `${reason} – ${this.name(first)} war am schnellsten` : text, points);
  }

  // ---------- Tipps ----------
  hintAsk(id) {
    const s = this.settings;
    if (!s.hints) throw new Error('Die Hinweis-Hilfe ist an diesem Tisch aus');
    if (this.phase !== 'playing' || this.stage !== 'play' || !this.eligible(id)) throw new Error('Gerade geht das nicht');
    if ((this.qs[id] || 0) < HINT_AFTER) throw new Error(`Einen Tipp gibt es nach ${HINT_AFTER} eigenen Fragen`);
    if (this.hintUsed.has(id)) throw new Error('Du hattest schon einen Tipp');
    if (this.hintReq) throw new Error('Ein Tipp ist schon unterwegs');
    const writers = this.order.filter((p) => p !== id && (this.players.get(p)?.connected || this.players.get(p)?.bot));
    if (!writers.length) throw new Error('Gerade ist niemand da, der einen Tipp schreiben kann');
    const by = writers[randomInt(writers.length)];
    this.hintUsed.add(id);
    this.hintReq = { for: id, by };
    this.say(`${this.name(id)} bittet um einen Tipp – ${this.name(by)} schreibt ihn.`, 'info');
  }
  hintWrite(id, text) {
    if (!this.hintReq || this.hintReq.by !== id) throw new Error('Du sollst gerade keinen Tipp schreiben');
    const t = cleanText(text, MAX_NOTE);
    if (t.length < 3) throw new Error('Der Tipp ist zu kurz');
    this.hints.push({ for: this.hintReq.for, by: id, text: t });
    this.say(`Tipp für ${this.name(this.hintReq.for)}: „${t}“`, 'win');
    this.hintReq = null;
  }

  // ---------- Anstupsen ----------
  nudge(fromId, targetId) {
    if (!this.settings.nudge) throw new Error('Anstupsen ist an diesem Tisch aus');
    const from = this.players.get(fromId), target = this.players.get(targetId);
    if (this.phase !== 'playing' || !from || !target || fromId === targetId || !this.order.includes(fromId) || !this.order.includes(targetId)) throw new Error('Das geht nicht');
    const waiting = this.stage === 'words' ? !this.drafts[targetId]
      : this.sub === 'ask' ? this.currentId === targetId
        : this.sub === 'vote' ? targetId !== this.q.by && !this.q.answers[targetId]
          : this.sub === 'gvote' ? targetId !== this.gv.by && !(targetId in this.gv.votes) : false;
    if (!waiting) return;
    const now = this.clock.now();
    if (now - (this.nudgeAt[fromId] || 0) < NUDGE_GAP) throw new Error('Nicht so schnell – höchstens alle 10 Sekunden');
    if (now - (target.nudgedAt || 0) < NUDGE_GAP) throw new Error(`${target.name} wurde gerade erst angestupst`);
    this.nudgeAt[fromId] = now; target.nudgedAt = now;
    this.onChange('nudge', { to: targetId, from: from.name, text: NUDGE_LINES[randomInt(NUDGE_LINES.length)] });
    this.say(`${from.name} stupst ${target.name} an`, 'react');
  }

  // ---------- Eigene Liste des Hosts ----------
  setCustom(id, text) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Eigene Begriffe gehen nur zwischen den Runden');
    const lines = String(text ?? '').split(/\r?\n/).slice(0, 300).map((l) => cleanText(l, MAX_WORD)).filter((l) => l.length >= 2);
    this.custom = [...new Set(lines)];
    this.say(this.custom.length ? `Der Host hat ${this.custom.length} eigene Begriffe für diesen Abend gespeichert` : 'Eigene Begriffe entfernt');
    return { reply: { count: this.custom.length } };
  }
  saveExtra() { return { custom: this.custom }; }
  loadExtra(x) { this.custom = (x?.custom || []).map((l) => cleanText(String(l), MAX_WORD)).filter(Boolean).slice(0, 300); }

  // ---------- Uhr ----------
  stageSecs() {
    if (this.stage === 'words') return WORD_SECS;
    if (this.stage !== 'play') return 0;
    return this.sub === 'ask' ? Number(this.settings.qSecs) || 0 : this.sub === 'vote' ? VOTE_SECS : GUESS_SECS;
  }
  expire() {
    if (this.stage === 'words') { this.fillMissing(); this.drafts = {}; this.targetOf = {}; this.beginPlay(); }
    else if (this.stage === 'play' && this.sub === 'ask') { this.say(`${this.name(this.currentId)} war zu langsam – der Nächste ist dran`, 'warn'); this.nextAsker(); }
    else if (this.stage === 'play' && this.sub === 'vote') this.resolveQuestion();
    else if (this.stage === 'play' && this.sub === 'gvote') this.resolveGuess();
  }
  next(id) {
    this.requireHost(id);
    if (this.phase !== 'playing') throw new Error('Gerade läuft keine Runde');
    this.expire();
  }
  afterChange() { if (!this.gamePaused) this.syncTimer(); }
  syncTimer() {
    const key = this.phase === 'playing' && this.stage && this.stage !== 'over' ? `${this.roundNo}:${this.stage}:${this.sub}:${this.moveNo}` : null;
    if (key === this.stageKey) return;
    this.clock.clearTimeout(this.stageTimer); this.stageTimer = null; this.deadline = null; this.stageKey = key;
    if (!key) return;
    const secs = this.stageSecs();
    if (!(secs > 0)) return;
    this.deadline = this.clock.now() + secs * 1000;
    this.stageTimer = this.clock.setTimeout(() => {
      this.stageTimer = null;
      if (this.stageKey !== key) return;
      try { this.expire(); } catch { /* nichts zu tun */ }
      this.syncTimer();
      this.onChange('state');
    }, secs * 1000);
    this.stageTimer.unref?.();
  }
  clearTimers() { this.clock.clearTimeout(this.stageTimer); this.clock.clearTimeout(this.limitTimer); this.stageTimer = null; this.limitTimer = null; this.deadline = null; this.stageKey = null; }
  dispose() { this.clearTimers(); super.dispose(); }
  onAbort() { this.clearTimers(); this.reset(); }

  // ---------- Aussteigen ----------
  onDropOut(p) {
    delete this.words[p.id]; delete this.drafts[p.id]; delete this.qs[p.id];
    this.solved = this.solved.filter((x) => x !== p.id);
    this.gaveUp.delete(p.id); this.skipNext.delete(p.id);
    for (const [w, t] of Object.entries(this.targetOf)) if (w === p.id || t === p.id) delete this.targetOf[w];
    if (this.hintReq && (this.hintReq.by === p.id || this.hintReq.for === p.id)) this.hintReq = null;
  }
  dropOut(p, message) {
    const i = this.order.indexOf(p.id);
    if (i < 0) return;
    if (message) this.say(message);
    const wasAsker = this.currentId === p.id;
    this.onDropOut(p);
    this.order.splice(i, 1);
    if (i < this.turn) this.turn--;
    if (this.turn >= this.order.length) this.turn = 0;
    if (this.order.length < this.opts.minPlayers) return this.finish('Zu wenige Mitspieler – die Runde ist zu Ende');
    if (this.stage === 'words') { if (this.order.every((x) => this.drafts[x])) this.assignWords(); return; }
    if (this.stage !== 'play') return;
    this.fillMissing();
    if (this.q?.by === p.id || this.gv?.by === p.id || wasAsker) { this.q = null; this.gv = null; this.sub = 'ask'; this.turnQ = 0; if (!this.eligible(this.currentId)) this.nextAsker(); this.moveNo++; return; }
    if (this.sub === 'vote' && this.activeVoters(this.q.by).every((x) => this.q.answers[x])) this.resolveQuestion();
    else if (this.sub === 'gvote' && this.activeVoters(this.gv.by).every((x) => x in this.gv.votes)) this.resolveGuess();
    this.checkEnd();
  }

  // ---------- Ansicht ----------
  publicPlayer(p) {
    const place = this.solved.indexOf(p.id);
    return {
      place: place >= 0 ? place + 1 : null, qs: this.qs[p.id] ?? 0, gaveUp: this.gaveUp.has(p.id), skipped: this.skipNext.has(p.id),
      answered: this.stage === 'play' && ((this.sub === 'vote' && !!this.q?.answers[p.id]) || (this.sub === 'gvote' && !!this.gv && p.id in this.gv.votes)),
      writing: this.stage === 'words' ? !!this.drafts[p.id] : false,
    };
  }
  // Begriffe, die dieser Betrachter sehen darf: alle außer dem eigenen (bis erraten oder zum Rundenende). Zuschauer sehen alle.
  visibleWords(viewerId) {
    const mine = this.order.includes(viewerId);
    const out = {};
    for (const id of this.order) {
      if (this.words[id] === undefined) continue;
      const hide = mine && id === viewerId && !this.solved.includes(id) && !this.revealed;
      out[id] = hide ? null : this.words[id];
    }
    return out;
  }
  gameView(viewerId) {
    const inGame = this.order.includes(viewerId);
    const s = this.settings;
    const g = {
      stage: this.stage, sub: this.sub, deadline: this.deadline, mode: s.mode,
      words: this.stage === 'words' ? {} : this.visibleWords(viewerId),
      solved: [...this.solved], qs: { ...this.qs }, gaveUp: [...this.gaveUp],
      q: this.q ? { by: this.q.by, text: this.q.text, answered: Object.keys(this.q.answers), mine: this.q.answers[viewerId] ?? null } : null,
      gv: this.gv ? { by: this.gv.by, text: this.gv.text, answered: Object.keys(this.gv.votes), mine: viewerId in this.gv.votes ? this.gv.votes[viewerId] : null } : null,
      lastQ: this.lastQ || null, hist: this.hist.slice(-120), hints: this.hints.map((h) => ({ for: h.for, text: h.text, by: h.by })),
      turnQ: this.turnQ, hintReq: this.hintReq ? { for: this.hintReq.for, by: this.hintReq.by } : null,
      canHint: !!(s.hints && inGame && this.stage === 'play' && this.eligible(viewerId) && (this.qs[viewerId] || 0) >= HINT_AFTER && !this.hintUsed.has(viewerId) && !this.hintReq),
      reveal: this.revealed ? { words: { ...this.words }, qs: { ...this.qs }, solved: [...this.solved] } : null,
    };
    if (this.stage === 'words' && inGame) {
      g.myTarget = this.targetOf[viewerId] ?? null; // für wen ich schreibe – wer für mich schreibt, erfährt niemand
      g.myDraft = this.drafts[viewerId] ?? null;
    }
    return g;
  }
  view(viewerId) {
    const v = super.view(viewerId);
    if (viewerId === this.hostId && this.phase !== 'playing') v.custom = [...this.custom];
    v.categories = Object.fromEntries(Object.entries(CATALOG).map(([k, c]) => [k, c.name]));
    return v;
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
