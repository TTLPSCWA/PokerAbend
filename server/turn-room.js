// Grundlage für rundenbasierte Spiele (Karten, Würfel, Brett): Mitspieler, Reihenfolge, Runden, Punkte des Abends.
// Ein Spiel erweitert diese Klasse und füllt die Haken: setupRound, onTurnStart, onDropOut, gameView, publicPlayer.
import { BaseRoom } from './base-room.js';

export class TurnRoom extends BaseRoom {
  // opts: { minPlayers, maxPlayers, lowWins (wenig Punkte = gut), scoreLabel, winPoints (Punkte für einen Sieg, wenn Punkte = Siege) }
  constructor(code, settings, onChange, opts) {
    super(code, onChange);
    this.opts = { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Punkte', ...opts };
    this.settings = this.clampSettings(settings || {}, this.defaultSettings());
    this.seats = [];      // Mitspieler (IDs) in Sitzreihenfolge
    this.order = [];      // wer in der laufenden Runde mitspielt
    this.turn = 0;        // Index in order
    this.dir = 1;         // Spielrichtung
    this.phase = 'lobby'; // lobby | playing | over
    this.roundNo = 0;
    this.scores = {};     // ID → Punkte des Abends
    this.wins = {};       // ID → gewonnene Runden
    this.result = null;   // Ergebnis der letzten Runde
  }

  // ---------- Haken für das Spiel ----------
  defaultSettings() { return {}; }
  clampSettings(input, base) { return { ...base }; }
  setupRound() {}         // Karten geben, Würfel bereitlegen …
  onTurnStart() {}        // wer jetzt dran ist (z. B. Aussetzen überspringen)
  onDropOut() {}          // jemand verlässt die laufende Runde (Karten zurück …)
  gameView() { return {}; }          // spielspezifische Ansicht – nur, was dieser Spieler sehen darf
  publicPlayer() { return {}; }      // was alle über einen Mitspieler sehen (z. B. Kartenanzahl)

  // ---------- Grundlage ----------
  get round() { return this.roundNo; }
  get busy() { return this.phase === 'playing'; }
  get currentId() { return this.phase === 'playing' ? this.order[this.turn] ?? null : null; }
  get current() { return this.players.get(this.currentId); }
  name(id) { return this.players.get(id)?.name ?? '?'; }

  sit(id) {
    const p = this.players.get(id);
    if (this.seats.includes(id)) throw new Error('Du spielst schon mit');
    if (this.seats.length >= this.opts.maxPlayers) throw new Error(`Mehr als ${this.opts.maxPlayers} Mitspieler gehen nicht`);
    this.seats.push(id);
    this.say(this.phase === 'playing' ? `${p.name} spielt ab der nächsten Runde mit` : `${p.name} spielt mit`);
  }

  stand(id) {
    const p = this.players.get(id);
    if (!this.seats.includes(id)) return;
    this.seats = this.seats.filter((x) => x !== id);
    if (this.phase === 'playing' && this.order.includes(id)) this.dropOut(p, `${p.name} steigt aus der Runde aus`);
    else this.say(`${p.name} schaut zu`);
  }

  // Aus der laufenden Runde nehmen. Bleibt nur einer übrig, ist die Runde vorbei.
  dropOut(p, message) {
    const i = this.order.indexOf(p.id);
    if (i < 0) return;
    if (message) this.say(message);
    const wasCurrent = i === this.turn;
    this.onDropOut(p);
    if (this.phase !== 'playing') return; // das Spiel hat die Runde schon beendet
    this.order.splice(i, 1);
    if (i < this.turn) this.turn--;
    if (this.order.length < 2) {
      const left = this.order[0];
      this.finishRound(left ? [left] : [], left ? `${this.name(left)} bleibt übrig und gewinnt die Runde` : 'Runde abgebrochen', left && this.opts.winPoints ? { [left]: this.opts.winPoints } : {});
      return;
    }
    if (this.turn >= this.order.length) this.turn = 0;
    if (wasCurrent) this.onTurnStart();
  }

  // Die Plattform entfernt jemanden (Host, Wegbleiben): aus der Runde und von den Plätzen
  leaveGame(p) {
    this.seats = this.seats.filter((x) => x !== p.id);
    if (this.phase === 'playing' && this.order.includes(p.id)) this.dropOut(p, null);
    return false;
  }

  start(id) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Die Runde läuft schon');
    const ids = this.seats.filter((x) => this.players.has(x));
    if (ids.length < this.opts.minPlayers) throw new Error(`Es müssen mindestens ${this.opts.minPlayers} mitspielen`);
    // Wer anfängt, wechselt jede Runde
    const s = this.roundNo % ids.length;
    this.order = [...ids.slice(s), ...ids.slice(0, s)];
    this.roundNo++;
    this.turn = 0; this.dir = 1;
    this.phase = 'playing';
    this.result = null;
    this.say(`Runde #${this.roundNo}`, 'hand');
    this.setupRound();
    if (this.phase === 'playing') this.onTurnStart();
  }

  // Weiter zum nächsten (oder übernächsten) Spieler in Spielrichtung
  next(steps = 1) {
    const n = this.order.length;
    this.turn = (((this.turn + this.dir * steps) % n) + n) % n;
    this.onTurnStart();
  }
  // Nächster in Spielrichtung, ohne zu wechseln
  peek(steps = 1) {
    const n = this.order.length;
    return this.order[(((this.turn + this.dir * steps) % n) + n) % n];
  }

  requireTurn(id) {
    if (this.phase !== 'playing') throw new Error('Gerade läuft keine Runde');
    if (this.currentId !== id) throw new Error('Du bist nicht dran');
  }

  // Runde beenden. points: Punkte dieser Runde je Spieler (kommen auf den Abend), winners: Gewinner
  finishRound(winners, text, points = {}) {
    this.phase = 'over';
    for (const [id, pts] of Object.entries(points)) this.scores[id] = (this.scores[id] || 0) + pts;
    for (const w of winners) this.wins[w] = (this.wins[w] || 0) + 1;
    this.result = { text, winners, points };
    this.say(text, 'win');
    this.onChange('handDone');
  }

  newGame(id) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Ein neues Spiel geht nur zwischen zwei Runden');
    const list = this.standingsList().filter((p) => p.score || p.wins).map((p) => `${p.name} ${p.score} ${this.opts.scoreLabel}, ${p.wins} gewonnen`);
    this.say(`Abendstand vor dem neuen Spiel: ${list.join(' · ') || 'noch nichts gespielt'}`, 'summary');
    this.scores = {}; this.wins = {}; this.result = null; this.phase = 'lobby';
    this.resetGame();
    this.say('Neues Spiel – alle starten bei null', 'warn');
  }
  resetGame() {} // Haken: Fortschritt über mehrere Runden zurücksetzen (z. B. Etappen)

  updateSettings(id, input) {
    this.requireHost(id);
    if (this.phase === 'playing') throw new Error('Einstellungen gehen nur zwischen den Runden');
    this.settings = this.clampSettings(input || {}, this.settings);
    this.say('Einstellungen geändert');
  }

  standingsList() {
    const list = [...this.players.values()].filter((p) => !p.kicked)
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: this.scores[p.id] || 0, wins: this.wins[p.id] || 0, connected: p.connected, playing: this.seats.includes(p.id) }));
    const dir = this.opts.lowWins ? 1 : -1;
    return list.sort((a, b) => (a.score - b.score) * dir || b.wins - a.wins);
  }

  view(viewerId) {
    const me = this.players.get(viewerId);
    const people = [...this.players.values()].filter((p) => !p.kicked);
    // Mitspieler in Sitzreihenfolge zuerst, dann Zuschauer
    people.sort((a, b) => (this.seats.indexOf(a.id) + 1 || 99) - (this.seats.indexOf(b.id) + 1 || 99));
    return {
      code: this.code, game: this.game, now: Date.now(),
      you: me ? { id: me.id, name: me.name, isHost: me.id === this.hostId, playing: this.seats.includes(me.id), inRound: this.order.includes(me.id) } : null,
      hostId: this.hostId, settings: this.settings, phase: this.phase, roundNo: this.roundNo, turnId: this.currentId, dir: this.dir,
      minPlayers: this.opts.minPlayers, maxPlayers: this.opts.maxPlayers, scoreLabel: this.opts.scoreLabel, lowWins: this.opts.lowWins,
      players: people.map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, isHost: p.id === this.hostId,
        seated: this.seats.includes(p.id), inRound: this.order.includes(p.id), score: this.scores[p.id] || 0, wins: this.wins[p.id] || 0,
        ...(this.order.includes(p.id) || this.phase !== 'lobby' ? this.publicPlayer(p) : {}),
      })),
      result: this.result,
      log: this.log.slice(-40), logSeq: this.logSeq,
      standings: this.standingsList(),
      g: this.phase === 'lobby' ? null : this.gameView(viewerId),
    };
  }

  // Gespeichert wird nur zwischen den Runden: Spieler, Plätze, Punkte und Einstellungen
  snapshot() {
    return {
      code: this.code, settings: this.settings, hostId: this.hostId, roundNo: this.roundNo, scores: this.scores, wins: this.wins, seats: this.seats,
      extra: this.saveExtra(),
      players: [...this.players.values()].filter((p) => !p.kicked).map((p) => ({ id: p.id, token: p.token, name: p.name, avatar: p.avatar })),
    };
  }
  saveExtra() { return null; }
  loadExtra() {}

  static restoreInto(r, data) {
    r.hostId = data.hostId;
    r.roundNo = Number(data.roundNo) || 0;
    r.scores = data.scores || {};
    r.wins = data.wins || {};
    for (const d of data.players || []) {
      r.players.set(d.id, { ...r.playerFields(), id: d.id, token: d.token, name: d.name, avatar: d.avatar, connected: false, socketId: null, offlineSince: Date.now() });
    }
    r.seats = (data.seats || []).filter((id) => r.players.has(id));
    if (data.extra) r.loadExtra(data.extra);
    r.say('Server neu gestartet – der Host startet die nächste Runde');
    return r;
  }
}

// Ereignisse, die jedes rundenbasierte Spiel versteht
export const turnEvents = {
  sit: (room, p) => room.sit(p.id),
  stand: (room, p) => room.stand(p.id),
  start: (room, p) => room.start(p.id),
  newGame: (room, p) => room.newGame(p.id),
  settings: (room, p, s) => room.updateSettings(p.id, s),
};
