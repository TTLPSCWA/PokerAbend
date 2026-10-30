// Gemeinsame Grundlage der Partyspiele (Schätzmeister, Schlagfertig, Wer hat das gesagt?).
// Anders als bei den Rundenspielen sind alle gleichzeitig dran: pro Frage läuft eine Folge von Stufen
// (flow, z. B. Schreiben → Abstimmen → Auflösung), jede mit eigener Uhr. Eine Partie hat mehrere Fragen.
// Das Spiel (Unterklasse) füllt die Haken:
//   get flow()            Stufen einer Frage, immer mit 'reveal' am Ende
//   catalog()             alle Fragen/Aufgaben des Spiels (JSON im Spielordner)
//   parseCustom(zeile)    eigene Frage des Hosts → Fragenobjekt oder null
//   startQuestion()       neue Frage vorbereiten (this.cur ist die Frage)
//   waiting(stage)        wer muss in dieser Stufe noch etwas abgeben? (nur Mitspieler)
//   closeStage(stage)     Stufe zu: Fehlendes mit „keine Antwort“ füllen
//   moreSteps(stage)      noch ein Schritt in derselben Stufe (z. B. nächste Abstimmung)? Dann ruft Basis enter() nochmal
//   enter(stage)          Stufe beginnt (bei 'reveal': Punkte vergeben via addPoints)
//   isReady(id)           hat dieser Spieler in der aktuellen Stufe schon abgegeben?
//   stageView(viewerId)   was dieser Spieler sehen darf – NIE fremde Antworten vor der Auflösung
//   fallback(id)          Zug für einen Bot, wenn sein Zug fehlschlägt
import { TurnRoom } from '../server/turn-room.js';
import { cleanText } from '../server/security.js';
import { shuffle } from '../server/random.js';
import { DEFAULT_SETTINGS as POKER_DEFAULTS } from './poker/room.js';

export const MAX_ANSWER = 120;      // Zeichen pro Antwort
export const MAX_CUSTOM = 100;      // eigene Fragen des Hosts pro Raum
export const MAX_CUSTOM_LEN = 200;  // Zeichen pro eigener Frage
export const NO_ANSWER = '(keine Antwort)';
// Anstupsen für Trödler: dieselben Sprüche wie beim Poker (ohne die Kartenwitze)
const NUDGE_LINES = POKER_DEFAULTS.nudgeLines.filter((l) => !/Karten/.test(l));
const NUDGE_GAP = 10000;          // pro Spieler höchstens einmal so oft anstupsen bzw. angestupst werden
const AUTO_NUDGE_BEFORE = 15000;  // so lange vor Stufenende stupst das Spiel Trödler selbst an
// Platzhalter-Antworten für Bots und Tests (keine Fantasie nötig, nur etwas Text)
export const PLACEHOLDERS = ['Kartoffelsalat', 'Onkel Heinz', 'Ein sprechender Toaster', 'Dienstagabend', 'Gummistiefel', 'Zu viele Socken', 'Die rote Tür', 'Kaffee, aber lauwarm', 'Opa Willi', 'Ein Hamster im Anzug',
  'Sofa-Olympiade', 'Gurkenwasser', 'Montag', 'Ein Pinguin mit Rucksack', 'Tante Erna', 'Papierflieger', 'Doppelt hält besser', 'Das Fahrrad meiner Nachbarin', 'Käsekuchen', 'Eine sehr lange Schlange',
  'Regenschirm im Keller', 'Schlaf', 'Ein Wellensittich namens Bernd', 'Taschenrechner', 'Nudeln mit Ketchup', 'Mamas Rezept', 'Der Mond', 'Ein Kissen aus Stein', 'Heute Nacht', 'Waschbär',
  'Gartenzwerg', 'Ein Sack Flöhe', 'Bärenmarke', 'Zitronenfalter', 'Eine Runde Mau-Mau', 'Pantoffeln', 'Der Wecker', 'Brezel', 'Ein Haufen Wäsche', 'Opas Hut'];
export const REVEAL_SECS = 15;      // so lange bleibt die Auflösung stehen, wenn der Host nicht „Weiter“ tippt
// Antworten: Steuerzeichen und unsichtbare Tricks raus, höchstens 120 Zeichen. Ausgegeben wird immer als Text, nie als HTML.
export const cleanAnswer = (text) => cleanText(text, MAX_ANSWER);

// Host-Einstellungen, die alle Partyspiele haben: Runden, Zeit pro Stufe, Punkte-Ziel, Zuschauer
export const partyOptions = ({ voting = true } = {}) => [
  { key: 'rounds', label: 'Anzahl Runden (Fragen)', type: 'number', min: 1, max: 30 },
  { key: 'writeSecs', label: voting ? 'Zeit zum Schreiben in Sekunden' : 'Zeit zum Antworten in Sekunden', type: 'number', min: 10, max: 300 },
  ...(voting ? [{ key: 'voteSecs', label: 'Zeit zum Abstimmen in Sekunden', type: 'number', min: 10, max: 300 }] : []),
  { key: 'target', label: 'Punkte-Ziel (0 = aus)', type: 'number', min: 0, max: 100000 },
  { key: 'spectators', label: 'Zuschauer dürfen mitmachen', type: 'bool' },
];

export class PartyRoom extends TurnRoom {
  constructor(code, settings, onChange, opts) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 8, lowWins: false, scoreLabel: 'Punkte', ...opts });
    this.stage = null;        // 'write' | 'vote' | 'reveal' (null: keine Partie)
    this.sub = 0;             // Schritt innerhalb der Stufe (z. B. welche Antwort gerade zur Wahl steht)
    this.q = 0;               // Index der laufenden Frage
    this.total = 0;
    this.picks = [];
    this.cur = null;
    this.past = [];           // Auflösungen früherer Fragen dieser Partie (offen für alle)
    this.gamePts = {};        // Punkte dieser Partie (die Abendpunkte stehen in scores)
    this.custom = [];         // eigene Fragen des Hosts (nur für diesen Raum)
    this.used = new Set();    // schon gespielte Fragen, damit sich nichts wiederholt
    this.revealSecs = REVEAL_SECS;
  }

  // ---------- Haken ----------
  get flow() { return ['write', 'reveal']; }
  catalog() { return []; }
  customOnly() { return false; }
  parseCustom() { return null; }
  startQuestion() {}
  waiting() { return []; }
  closeStage() {}
  moreSteps() { return false; }
  enter() {}
  isReady() { return false; }
  stageView() { return {}; }
  fallback() {}
  revealTime() { return this.revealSecs; } // Haken: Spiele mit langer Auflösung geben mehr Zeit
  stageSecs(stage) {
    if (stage === 'reveal') return this.revealTime();
    return Number(stage === 'write' ? this.settings.writeSecs : this.settings.voteSecs) || 0;
  }

  // ---------- Grundlage ----------
  get currentId() { return null; } // niemand ist „dran“: alle gleichzeitig
  validateStart() {
    if (this.customOnly() && !this.custom.length) throw new Error('Mit „nur eigene Fragen“ braucht es mindestens eine eigene Frage (Host-Menü)');
  }
  // Antworten dürfen Mitspieler und – wenn der Host es erlaubt – Zuschauer
  canAnswer(id) {
    const p = this.players.get(id);
    return !!p && !p.kicked && this.phase === 'playing' && (this.order.includes(id) || !!this.settings.spectators);
  }
  isPlayer(id) { return this.order.includes(id); }
  addPoints(id, n) { if (n && id in this.gamePts) this.gamePts[id] += n; }

  setupRound() {
    this.gamePts = Object.fromEntries(this.order.map((id) => [id, 0]));
    this.past = [];
    this.picks = this.pickQuestions(this.settings.rounds);
    this.total = this.picks.length;
    this.q = 0;
    this.beginQuestion();
  }
  pickQuestions(n) { return this.draw(n); }
  // Eigene Fragen zuerst, danach aus dem Katalog – ohne Wiederholung, bis alles einmal dran war
  draw(n) {
    const own = shuffle([...this.custom]).slice(0, n);
    const picks = [...own];
    if (!this.customOnly() && picks.length < n) {
      const all = this.catalog();
      let pool = shuffle(all.filter((c) => !this.used.has(c.id)));
      if (pool.length < n - picks.length) { this.used.clear(); pool = shuffle([...all]); }
      for (const c of pool) { if (picks.length >= n) break; picks.push(c); this.used.add(c.id); }
    }
    return picks;
  }
  beginQuestion() {
    this.cur = this.picks[this.q];
    this.stage = this.flow[0]; this.sub = 0;
    this.startQuestion();
    this.enterStage(this.stage);
    this.moveNo++;
  }

  // Stufe beenden (Zeit um, alle fertig oder der Host tippt „Weiter“) und zur nächsten gehen
  advance() {
    if (this.phase !== 'playing' || !this.stage) return;
    this.closeStage(this.stage);
    this.acts = {}; // Sprechblasen („✓ fertig“) gehören zur Stufe, die gerade endet
    if (this.stage !== 'reveal' && this.moreSteps(this.stage)) { this.sub++; this.enterStage(this.stage); this.moveNo++; return; }
    const i = this.flow.indexOf(this.stage);
    if (i + 1 < this.flow.length) { this.stage = this.flow[i + 1]; this.sub = 0; this.enterStage(this.stage); this.moveNo++; return; }
    this.q++;
    if (this.q >= this.total || this.targetReached()) return this.finishGame();
    this.beginQuestion();
  }
  targetReached() {
    const t = Number(this.settings.target) || 0;
    return t > 0 && Math.max(0, ...Object.values(this.gamePts)) >= t;
  }

  // Wer blockiert nicht? Menschen, die offline sind, werden übersprungen (Bots sind immer da)
  active(id) { const p = this.players.get(id); return !!p && !p.kicked && (p.bot || p.connected); }
  humanOnline() { return [...this.players.values()].some((p) => !p.bot && !p.kicked && p.connected); }
  // Sind alle fertig, geht es sofort weiter (nie während der Auflösung – die läuft über Uhr oder „Weiter“)
  checkDone() {
    for (let n = 0; n < 4 && this.phase === 'playing' && this.stage && this.stage !== 'reveal'; n++) {
      if (!this.humanOnline() || this.waiting(this.stage).some((id) => this.active(id))) return;
      this.advance();
    }
  }
  // Der Host schaltet weiter (Auflösung überspringen oder eine Stufe vorzeitig beenden)
  next(id) {
    this.requireHost(id);
    if (this.phase !== 'playing') throw new Error('Gerade läuft keine Partie');
    this.advance();
    this.checkDone();
  }

  finishGame(reason = '') {
    this.stage = null; this.cur = null;
    this.clock.clearTimeout(this.turnTimer); this.turnTimer = null; this.deadline = null; this.timerKey = null;
    const ids = this.roundPlayers || this.order;
    const best = Math.max(0, ...ids.map((id) => this.gamePts[id] || 0));
    const winners = best > 0 ? ids.filter((id) => (this.gamePts[id] || 0) === best && this.players.has(id)) : [];
    const names = winners.map((id) => this.name(id)).join(' und ');
    const text = reason || (winners.length ? `${names} ${winners.length > 1 ? 'teilen sich den Sieg' : 'gewinnt'} mit ${best} Punkten` : 'Keine Punkte – niemand gewinnt');
    this.finishRound(winners, text, { ...this.gamePts });
  }

  // Mitspieler steigt mitten in der Partie aus: seine Punkte bleiben, die Partie läuft weiter (bei zu wenigen endet sie)
  dropOut(p, message) {
    const i = this.order.indexOf(p.id);
    if (i < 0) return;
    if (message) this.say(message);
    this.order.splice(i, 1);
    if (this.order.length < this.opts.minPlayers) return this.finishGame('Zu wenige Mitspieler – die Partie ist zu Ende');
    this.checkDone();
  }

  // ---------- Uhr pro Stufe ----------
  timerActive() { return true; }
  afterChange() { if (!this.gamePaused) { this.checkDone(); this.syncTimer(); } }
  syncTimer() {
    const key = this.phase === 'playing' && this.stage ? `${this.roundNo}:${this.q}:${this.stage}:${this.sub}` : null;
    if (key === this.timerKey) return;
    this.clock.clearTimeout(this.turnTimer); this.clock.clearTimeout(this.nudgeTimer);
    this.turnTimer = null; this.nudgeTimer = null; this.deadline = null; this.timerKey = key;
    if (!key) return;
    const secs = this.stageSecs(this.stage);
    if (!(secs > 0)) return;
    this.deadline = this.clock.now() + secs * 1000;
    this.clock.clearTimeout(this.nudgeTimer); this.nudgeTimer = null;
    if (this.settings.nudge && this.stage !== 'reveal' && secs * 1000 > AUTO_NUDGE_BEFORE + 5000) {
      this.nudgeTimer = this.clock.setTimeout(() => { if (this.timerKey === key) this.autoNudge(); }, secs * 1000 - AUTO_NUDGE_BEFORE);
      this.nudgeTimer.unref?.();
    }
    this.turnTimer = this.clock.setTimeout(() => {
      this.turnTimer = null;
      if (this.timerKey !== key) return;
      try { this.advance(); this.checkDone(); } catch { /* nichts zu tun */ }
      this.syncTimer();
      this.onChange('state');
    }, secs * 1000);
    this.turnTimer.unref?.();
  }
  onTimeout(id) { this.fallback(id); }

  // ---------- Anstupsen (Hausregel „nudge“, nur Spiele, die sie als Option führen) ----------
  nudge(fromId, targetId) {
    if (!this.settings.nudge) throw new Error('Anstupsen ist an diesem Tisch aus');
    if (this.phase !== 'playing' || !this.stage || this.stage === 'reveal') throw new Error('Gerade gibt es niemanden anzustupsen');
    const from = this.players.get(fromId), target = this.players.get(targetId);
    if (!from || !target || fromId === targetId) throw new Error('Das geht nicht');
    if (!this.order.includes(fromId) || !this.order.includes(targetId)) throw new Error('Nur Mitspieler können anstupsen');
    if (!this.isReady(fromId)) throw new Error('Erst selbst fertig werden, dann anstupsen');
    const now = this.clock.now();
    if (now - (from.nudgeSentAt || 0) < NUDGE_GAP) throw new Error('Nicht so schnell – höchstens alle 10 Sekunden');
    if (!this.waiting(this.stage).includes(targetId)) return; // wer nichts mehr zu tun hat (z. B. Autor in der Abstimmung): nichts senden, nichts verraten
    if (!this.sendNudge(target, from.name)) throw new Error(`${target.name} wurde gerade erst angestupst`);
    from.nudgeSentAt = now;
    this.say(`${from.name} stupst ${target.name} an`, 'react');
  }
  sendNudge(target, fromName) {
    const now = this.clock.now();
    if (now - (target.nudgedAt || 0) < NUDGE_GAP) return false;
    target.nudgedAt = now;
    this.onChange('nudge', { to: target.id, from: fromName, text: NUDGE_LINES[Math.floor(Math.random() * NUDGE_LINES.length)] });
    return true;
  }
  autoNudge() {
    if (this.phase !== 'playing' || !this.stage || this.stage === 'reveal') return;
    for (const id of this.waiting(this.stage)) { const p = this.players.get(id); if (p && !p.bot && p.connected) this.sendNudge(p, null); }
  }

  lobbyStatus() { return this.phase === 'playing' && this.total ? `${this.unit || 'Frage'} ${this.q + 1}/${this.total}` : super.lobbyStatus(); }

  // ---------- Bots ----------
  // Der Bot, der als Nächstes etwas abgeben muss (nextBot in server/bots.js fragt das für alle Partyspiele)
  botDue() {
    if (this.phase !== 'playing' || !this.stage || this.stage === 'reveal') return null;
    const due = new Set(this.waiting(this.stage));
    return this.order.find((id) => this.players.get(id)?.bot && due.has(id)) || null;
  }

  // ---------- Eigene Fragen des Hosts (eine pro Zeile, gelten nur in diesem Raum) ----------
  setCustom(id, text) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Eigene Fragen gehen nur zwischen den Partien');
    const lines = String(text ?? '').split(/\r?\n/).slice(0, 400).map((l) => cleanText(l, MAX_CUSTOM_LEN)).filter(Boolean);
    const out = []; let skipped = 0;
    for (const line of lines) {
      const c = out.length < MAX_CUSTOM ? this.parseCustom(line, out.length) : null;
      if (c) out.push({ ...c, raw: line }); else skipped++;
    }
    this.custom = out;
    this.say(out.length ? `Der Host hat ${out.length} eigene Frage${out.length === 1 ? '' : 'n'} für diesen Abend gespeichert` : 'Eigene Fragen entfernt');
    return { reply: { count: out.length, skipped } };
  }
  saveExtra() { return { custom: this.custom.map((c) => c.raw) }; }
  loadExtra(extra) {
    this.custom = (extra?.custom || []).slice(0, MAX_CUSTOM).map((raw, i) => { const c = this.parseCustom(String(raw), i); return c && { ...c, raw: String(raw) }; }).filter(Boolean);
  }

  // Stufe beginnt; die Auflösung (offen für alle) merkt sich der Raum für „Frühere Runden ansehen“
  enterStage(stage) {
    this.enter(stage);
    if (stage === 'reveal') this.past.push({ q: this.q + 1, ...this.stageView(null) });
  }
  // ---------- Ansicht ----------
  publicPlayer(p) {
    return { ready: this.phase === 'playing' && this.stage !== 'reveal' && this.order.includes(p.id) && !!this.isReady(p.id), pts: this.gamePts[p.id] ?? 0 };
  }
  gameView(viewerId) {
    return {
      stage: this.stage, q: this.q + 1, of: this.total, sub: this.sub,
      past: this.past.slice(0, this.stage === 'reveal' ? -1 : undefined), // frühere Auflösungen (die aktuelle steht ohnehin da)
      canAnswer: this.canAnswer(viewerId),
      ...(this.stage ? this.stageView(viewerId) : {}),
    };
  }
  view(viewerId) {
    const v = super.view(viewerId);
    // Nur der Host sieht seine eigene Liste – und nur zwischen den Partien (sie enthält bei Schätzfragen die richtigen Antworten)
    if (viewerId === this.hostId && this.phase !== 'playing') v.custom = this.custom.map((c) => c.raw);
    return v;
  }

  onAbort() { this.past = []; this.stage = null; this.cur = null; this.gamePts = {}; this.clock.clearTimeout(this.turnTimer); this.clock.clearTimeout(this.nudgeTimer); this.turnTimer = null; this.nudgeTimer = null; this.deadline = null; this.timerKey = null; }
  dispose() { super.dispose(); this.clock.clearTimeout(this.nudgeTimer); this.nudgeTimer = null; }
}

// Ereignisse, die alle Partyspiele zusätzlich verstehen
export const partyEvents = {
  next: (room, p) => room.next(p.id),
  nudge: (room, p, { id }) => room.nudge(p.id, String(id ?? '').slice(0, 40)),
  custom: (room, p, { text }) => room.setCustom(p.id, typeof text === 'string' ? text.slice(0, 40000) : ''),
};
