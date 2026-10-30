// Werwolf – Partyspiel für 6–18 (Mechanik der Werwolf-Spielform „Dorf gegen Werwölfe“). Der Server ist Spielleiter.
// Rollen: Dorfbewohner, Werwolf, Seherin, Hexe (je ein Heil- und ein Gifttrank), Amor (verliebt in der ersten Nacht zwei Spieler), Jäger (nimmt beim Tod jemanden mit).
// Nacht: Amor (nur die erste Nacht) → Werwölfe einigen sich auf ein Opfer (Mehrheit, bei Gleichstand entscheidet der Zufall) → Seherin sieht eine Rolle → Hexe sieht das Opfer und darf heilen oder vergiften.
// Tag: Alle erfahren, wer gestorben ist, und diskutieren (am Tisch, per Voice). Dann stimmt das Dorf ab; wer die meisten Stimmen hat, wird hingerichtet (bei Gleichstand niemand).
// Stirbt der Jäger, schießt er sofort auf jemanden. Stirbt einer der Verliebten, stirbt auch der andere.
// Das Dorf gewinnt, wenn alle Werwölfe tot sind; die Werwölfe gewinnen, wenn sie mindestens so viele sind wie alle anderen; leben nur noch die beiden Verliebten (aus beiden Lagern), gewinnen sie.
//
// Geheimhaltung: Jeder bekommt nur seine eigene Rolle gesagt (Werwölfe kennen einander, Verliebte einander). Nachtaktionen stehen weder im Verlauf noch in Sprechblasen.
// Tote (und alle nach dem Spiel) sehen alle Rollen und das Nachtgeschehen; Zuschauer außerhalb der Partie sehen nur Öffentliches.
import { TurnRoom } from '../../server/turn-room.js';
import { randomInt } from 'node:crypto';
import { shuffle } from '../../server/random.js';

export const ROLES = { dorf: 'Dorfbewohner', wolf: 'Werwolf', seher: 'Seherin', hexe: 'Hexe', amor: 'Amor', jaeger: 'Jäger' };
export const wolfCount = (n) => Math.max(1, Math.floor(n / 4));

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'seher', label: 'Rolle Seherin dabei', type: 'bool' },
    { key: 'hexe', label: 'Rolle Hexe dabei', type: 'bool' },
    { key: 'amor', label: 'Rolle Amor dabei', type: 'bool' },
    { key: 'jaeger', label: 'Rolle Jäger dabei', type: 'bool' },
    { key: 'nightSecs', label: 'Sekunden pro Nachtschritt', type: 'number', min: 10, max: 300 },
    { key: 'daySecs', label: 'Sekunden Diskussion am Tag', type: 'number', min: 10, max: 900 },
    { key: 'voteSecs', label: 'Sekunden zum Abstimmen', type: 'number', min: 10, max: 300 },
    { key: 'revealRole', label: 'Rolle bei Tod aufdecken', type: 'bool' },
  ];
  defaultSettings() { return { seher: true, hexe: true, amor: true, jaeger: true, nightSecs: 45, daySecs: 120, voteSecs: 45, revealRole: true }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 6, maxPlayers: 18, lowWins: false, scoreLabel: 'Siege' });
    this.reset();
    this.stageTimer = null; this.stageKey = null; this.deadline = null;
  }
  reset() {
    this.roles = {}; this.alive = new Set(); this.lovers = null; this.potions = { heal: true, poison: true };
    this.stage = null; this.step = null; this.day = 0; this.deaths = []; this.nightLog = [];
    this.amorPick = null; this.wolfVotes = {}; this.victim = null; this.seen = []; this.witchDone = false; this.witchSave = false; this.witchKill = null;
    this.votes = {}; this.lastVote = null; this.hunter = null; this.afterHunter = null; this.winner = null;
  }
  get currentId() { return null; }

  // ---------- Start ----------
  validateStart(ids) {
    if (ids.length < 6) throw new Error('Werwolf braucht mindestens 6 Mitspieler');
  }
  setupRound() {
    this.reset();
    const n = this.order.length, s = this.settings;
    const wolves = wolfCount(n);
    const specials = [];
    if (s.seher) specials.push('seher');
    if (s.hexe) specials.push('hexe');
    if (s.jaeger) specials.push('jaeger');
    if (s.amor) specials.push('amor');
    const pool = [...Array(wolves).fill('wolf'), ...specials.slice(0, Math.max(0, n - wolves - 1))];
    while (pool.length < n) pool.push('dorf');
    const roles = shuffle(pool);
    this.order.forEach((id, i) => { this.roles[id] = roles[i]; this.alive.add(id); });
    this.say(`Das Spiel beginnt: ${n} Spieler, davon ${wolves} Werwolf${wolves === 1 ? '' : 'wölfe'}. Jeder sieht nur seine eigene Rolle.`, 'cards');
    this.beginNight();
  }
  onTurnStart() {}

  // ---------- Hilfen ----------
  living(role) { return [...this.alive].filter((id) => this.roles[id] === role); }
  wolves() { return [...this.alive].filter((id) => this.roles[id] === 'wolf'); }
  isDead(id) { return this.order.includes(id) && !this.alive.has(id); }
  nm(id) { return this.name(id); }

  // ---------- Nacht ----------
  beginNight() {
    this.day++;
    this.stage = 'night'; this.victim = null; this.wolfVotes = {}; this.amorPick = null; this.witchDone = false; this.witchSave = false; this.witchKill = null;
    this.nightLog.push(`— Nacht ${this.day} —`);
    if (this.nightLog.length > 80) this.nightLog.splice(0, this.nightLog.length - 80);
    this.say(`Nacht ${this.day}: Das Dorf schläft ein.`, 'cards');
    this.step = null;
    this.nextStep();
  }
  // Nächster Nachtschritt, bei dem noch jemand etwas tun muss; Schritte ohne lebende Rolle werden übersprungen
  nextStep() {
    const order = ['amor', 'wolves', 'seer', 'witch'];
    let i = order.indexOf(this.step) + 1;
    for (; i < order.length; i++) {
      const s = order[i];
      if (s === 'amor' && this.day === 1 && this.living('amor').length && !this.lovers) { this.step = s; this.moveNo++; return; }
      if (s === 'wolves' && this.wolves().length) { this.step = s; this.moveNo++; return; }
      if (s === 'seer' && this.living('seher').length) { this.step = s; this.moveNo++; return; }
      if (s === 'witch' && this.living('hexe').length && (this.potions.heal || this.potions.poison)) { this.step = s; this.moveNo++; return; }
    }
    this.dawn();
  }
  stepDone() {
    if (this.step === 'amor') return !!this.amorPick || !this.living('amor').length;
    if (this.step === 'wolves') return this.wolves().every((w) => this.wolfVotes[w] !== undefined);
    if (this.step === 'seer') return this.living('seher').every((s) => this.seen.some((x) => x.day === this.day && x.by === s));
    if (this.step === 'witch') return this.witchDone || !this.living('hexe').length;
    return true;
  }
  tallyWolves() {
    const votes = Object.values(this.wolfVotes).filter(Boolean);
    if (!votes.length) { this.victim = null; return; }
    const count = {};
    for (const v of votes) count[v] = (count[v] || 0) + 1;
    const top = Math.max(...Object.values(count));
    const tied = Object.keys(count).filter((k) => count[k] === top);
    this.victim = tied[randomInt(tied.length)];
    this.nightLog.push(`Die Werwölfe wählen ${this.nm(this.victim)}.`);
  }
  amor(id, a, b) {
    this.guardStep('amor', id, 'amor');
    if (a === b || !this.alive.has(a) || !this.alive.has(b)) throw new Error('Wähl zwei verschiedene lebende Spieler');
    this.amorPick = [a, b]; this.lovers = [a, b];
    this.nightLog.push(`Amor verliebt ${this.nm(a)} und ${this.nm(b)}.`);
    this.afterAction();
  }
  wolfVote(id, target) {
    this.guardStep('wolves', id, 'wolf');
    if (target !== null && (!this.alive.has(target) || this.roles[target] === 'wolf')) throw new Error('Wähl einen lebenden Spieler, der kein Werwolf ist');
    this.wolfVotes[id] = target;
    this.afterAction();
  }
  seer(id, target) {
    this.guardStep('seer', id, 'seher');
    if (!this.alive.has(target) || target === id) throw new Error('Wähl einen anderen lebenden Spieler');
    if (this.seen.some((x) => x.day === this.day && x.by === id)) throw new Error('Du hast heute Nacht schon geschaut');
    this.seen.push({ day: this.day, by: id, id: target, role: this.roles[target] });
    this.nightLog.push(`Die Seherin schaut ${this.nm(target)} an: ${ROLES[this.roles[target]]}.`);
    this.afterAction();
  }
  witch(id, action, target) {
    this.guardStep('witch', id, 'hexe');
    if (action === 'heal') {
      if (!this.potions.heal) throw new Error('Der Heiltrank ist schon verbraucht');
      if (!this.victim) throw new Error('Heute Nacht gibt es kein Opfer');
      this.potions.heal = false; this.witchSave = true;
      this.nightLog.push(`Die Hexe heilt ${this.nm(this.victim)}.`);
    } else if (action === 'poison') {
      if (!this.potions.poison) throw new Error('Der Gifttrank ist schon verbraucht');
      if (!this.alive.has(target)) throw new Error('Wähl einen lebenden Spieler');
      this.potions.poison = false; this.witchKill = target;
      this.nightLog.push(`Die Hexe vergiftet ${this.nm(target)}.`);
    } else if (action !== 'none') throw new Error('Unbekannte Aktion');
    this.witchDone = true;
    this.afterAction();
  }
  guardStep(step, id, role) {
    if (this.phase !== 'playing' || this.stage !== 'night' || this.step !== step) throw new Error('Das geht gerade nicht');
    if (!this.alive.has(id) || this.roles[id] !== role) throw new Error('Das ist nicht deine Aufgabe');
  }
  afterAction() { this.advanceIfDone(); }
  advanceIfDone() {
    for (let g = 0; g < 6 && this.phase === 'playing'; g++) {
      if (this.stage === 'night' && this.stepDone()) { this.closeStep(); continue; }
      if (this.stage === 'vote' && [...this.alive].every((id) => id in this.votes)) { this.tallyVote(); continue; }
      break;
    }
  }
  closeStep() {
    if (this.step === 'wolves') this.tallyWolves();
    this.nextStep();
  }

  // Morgengrauen: Opfer, Heilung, Gift, Verliebte, Jäger
  dawn() {
    const dead = [];
    if (this.victim && !this.witchSave) dead.push(this.victim);
    if (this.witchKill && !dead.includes(this.witchKill)) dead.push(this.witchKill);
    this.step = null;
    this.killAll(dead, 'nacht');
    if (this.phase !== 'playing') return;
    if (this.hunter) { this.afterHunter = 'day'; this.enterHunter(); return; }
    this.enterDay();
  }
  // Tote eintragen (mit Verliebten-Kette); der Jäger schießt danach
  killAll(ids, cause) {
    const names = [];
    const queue = [...ids];
    while (queue.length) {
      const id = queue.shift();
      if (!this.alive.has(id)) continue;
      this.alive.delete(id);
      this.deaths.push({ id, day: this.day, cause, role: this.roles[id] });
      names.push(id);
      if (this.roles[id] === 'jaeger' && !this.hunter) this.hunter = id;
      const l = this.lovers;
      if (l && l.includes(id)) { const other = l.find((x) => x !== id); if (this.alive.has(other)) { queue.push(other); this.nightLog.push(`${this.nm(other)} stirbt aus Liebe.`); } }
    }
    this.lastDeaths = names;
    const txt = (id) => (this.settings.revealRole ? `${this.nm(id)} (${ROLES[this.roles[id]]})` : this.nm(id));
    if (cause === 'nacht') this.say(names.length ? `Der Morgen graut: ${names.map(txt).join(' und ')} ${names.length === 1 ? 'ist' : 'sind'} in der Nacht gestorben.` : 'Der Morgen graut: Niemand ist in der Nacht gestorben.', names.length ? 'warn' : 'info');
    else if (names.length) this.say(`${names.map(txt).join(' und ')} ${names.length === 1 ? 'ist' : 'sind'} gestorben.`, 'warn');
    this.checkWin();
  }
  checkWin() {
    if (this.phase !== 'playing') return true;
    const alive = [...this.alive];
    const wolves = this.wolves().length;
    const rest = alive.length - wolves;
    let team = null;
    if (this.lovers && alive.length === 2 && this.lovers.every((x) => this.alive.has(x)) && this.lovers.some((x) => this.roles[x] === 'wolf') && this.lovers.some((x) => this.roles[x] !== 'wolf')) team = 'liebende';
    else if (!wolves) team = 'dorf';
    else if (wolves >= rest) team = 'wolf';
    if (!team) return false;
    this.clearTimer();
    this.winner = team;
    const winners = this.order.filter((id) => (team === 'liebende' ? this.lovers.includes(id) : team === 'wolf' ? this.roles[id] === 'wolf' : this.roles[id] !== 'wolf'));
    const text = team === 'dorf' ? 'Das Dorf gewinnt – alle Werwölfe sind tot!' : team === 'wolf' ? 'Die Werwölfe gewinnen – sie haben das Dorf übernommen!' : 'Die Verliebten gewinnen – gemeinsam gegen alle!';
    this.stage = 'over';
    this.finishRound(winners, text, Object.fromEntries(winners.map((id) => [id, 1])));
    return true;
  }

  // ---------- Tag und Abstimmung ----------
  enterDay() {
    this.stage = 'day'; this.votes = {}; this.moveNo++;
    this.say(`Tag ${this.day}: Besprecht euch am Tisch – wer ist ein Werwolf?`, 'cards');
  }
  toVote() {
    this.stage = 'vote'; this.votes = {}; this.moveNo++;
    this.say('Abstimmung: Wer soll hingerichtet werden?', 'cards');
  }
  vote(id, target) {
    if (this.phase !== 'playing' || this.stage !== 'vote') throw new Error('Gerade wird nicht abgestimmt');
    if (!this.alive.has(id)) throw new Error('Tote stimmen nicht ab');
    if (target !== null && (!this.alive.has(target) || target === id)) throw new Error('Wähl einen anderen lebenden Spieler – oder enthalte dich');
    this.votes[id] = target;
    this.advanceIfDone();
  }
  tallyVote() {
    const count = {};
    for (const v of Object.values(this.votes)) if (v) count[v] = (count[v] || 0) + 1;
    const top = Math.max(0, ...Object.values(count));
    const tied = Object.keys(count).filter((k) => count[k] === top);
    const executed = top && tied.length === 1 ? tied[0] : null;
    this.lastVote = { day: this.day, votes: { ...this.votes }, tally: count, executed };
    this.say(executed ? `Das Dorf richtet ${this.nm(executed)} hin (${top} Stimme${top === 1 ? '' : 'n'}).` : 'Gleichstand oder keine Stimmen – niemand wird hingerichtet.', 'warn');
    if (executed) this.killAll([executed], 'abstimmung');
    if (this.phase !== 'playing') return;
    if (this.hunter) { this.afterHunter = 'night'; this.enterHunter(); return; }
    this.beginNight();
  }
  enterHunter() { this.stage = 'hunter'; this.moveNo++; this.say(`${this.nm(this.hunter)} war der Jäger und schießt noch einmal!`, 'warn'); }
  shoot(id, target) {
    if (this.phase !== 'playing' || this.stage !== 'hunter' || this.hunter !== id) throw new Error('Du darfst gerade nicht schießen');
    if (!this.alive.has(target)) throw new Error('Wähl einen lebenden Spieler');
    this.finishHunter(target);
  }
  finishHunter(target) {
    const h = this.hunter;
    this.hunter = null;
    this.nightLog.push(`Der Jäger ${this.nm(h)} schießt auf ${target ? this.nm(target) : 'niemanden'}.`);
    if (target) this.killAll([target], 'jaeger');
    if (this.phase !== 'playing') return;
    if (this.hunter) { this.enterHunter(); return; } // ein zweiter Jäger gibt es nicht, nur zur Sicherheit
    if (this.afterHunter === 'day') this.enterDay(); else this.beginNight();
  }
  // Host überspringt die Diskussion (oder eine hängende Stufe)
  next(id) {
    this.requireHost(id);
    if (this.phase !== 'playing') throw new Error('Gerade läuft keine Partie');
    this.expire();
  }

  // ---------- Uhr ----------
  stageSecs() {
    const s = this.settings;
    if (this.stage === 'night') return s.nightSecs;
    if (this.stage === 'day') return s.daySecs;
    if (this.stage === 'vote') return s.voteSecs;
    if (this.stage === 'hunter') return s.nightSecs;
    return 0;
  }
  // Zeit um (oder der Host drückt „Weiter“): fehlende Aktionen gelten als „nichts“
  expire() {
    if (this.stage === 'night') {
      if (this.step === 'wolves') for (const w of this.wolves()) if (this.wolfVotes[w] === undefined) this.wolfVotes[w] = null;
      if (this.step === 'witch') this.witchDone = true;
      if (this.step === 'seer') for (const s of this.living('seher')) if (!this.seen.some((x) => x.day === this.day && x.by === s)) this.seen.push({ day: this.day, by: s, id: null, role: null });
      if (this.step === 'amor' && !this.amorPick) this.amorPick = [];
      this.closeStep();
    } else if (this.stage === 'day') this.toVote();
    else if (this.stage === 'vote') { for (const id of this.alive) if (!(id in this.votes)) this.votes[id] = null; this.tallyVote(); }
    else if (this.stage === 'hunter') this.finishHunter(null);
    this.advanceIfDone();
  }
  afterChange() { if (!this.gamePaused) { this.advanceIfDone(); this.syncTimer(); } }
  syncTimer() {
    const key = this.phase === 'playing' && this.stage && this.stage !== 'over' ? `${this.roundNo}:${this.day}:${this.stage}:${this.step}:${this.hunter}` : null;
    if (key === this.stageKey) return;
    this.clearTimer();
    this.stageKey = key;
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
  clearTimer() { this.clock.clearTimeout(this.stageTimer); this.stageTimer = null; this.deadline = null; this.stageKey = null; }
  dispose() { this.clearTimer(); super.dispose(); }
  onAbort() { this.clearTimer(); this.reset(); }

  // Wer aussteigt, stirbt (ohne Rolle zu verraten, der Jäger schießt nicht mehr)
  onDropOut(p) {
    if (this.alive.has(p.id)) {
      this.alive.delete(p.id);
      this.deaths.push({ id: p.id, day: this.day, cause: 'weg', role: this.roles[p.id] });
      this.say(`${p.name} hat das Dorf verlassen.`, 'warn');
      if (this.hunter === p.id) this.hunter = null;
      const l = this.lovers;
      if (l && l.includes(p.id)) { const other = l.find((x) => x !== p.id); if (this.alive.has(other)) { this.alive.delete(other); this.deaths.push({ id: other, day: this.day, cause: 'nacht', role: this.roles[other] }); } }
    }
  }
  dropOut(p, message) {
    if (!this.order.includes(p.id)) return;
    if (message) this.say(message);
    this.onDropOut(p);
    if (this.phase === 'playing' && !this.checkWin()) { if (this.stage === 'hunter' && this.hunter === null) this.finishHunter(null); this.advanceIfDone(); }
  }

  // ---------- Bots ----------
  botDue() {
    if (this.phase !== 'playing') return null;
    const bot = (id) => this.players.get(id)?.bot;
    if (this.stage === 'night') {
      if (this.step === 'amor') return this.living('amor').find((id) => bot(id) && !this.amorPick) || null;
      if (this.step === 'wolves') return this.wolves().find((id) => bot(id) && this.wolfVotes[id] === undefined) || null;
      if (this.step === 'seer') return this.living('seher').find((id) => bot(id) && !this.seen.some((x) => x.day === this.day && x.by === id)) || null;
      if (this.step === 'witch') return this.living('hexe').find((id) => bot(id) && !this.witchDone) || null;
    }
    if (this.stage === 'vote') return [...this.alive].find((id) => bot(id) && !(id in this.votes)) || null;
    if (this.stage === 'hunter') return bot(this.hunter) ? this.hunter : null;
    return null;
  }
  botStep(id, rng = Math.random) {
    const pick = (list) => list[Math.floor(rng() * list.length)];
    const others = [...this.alive].filter((x) => x !== id);
    if (this.stage === 'night') {
      if (this.step === 'amor') { const [a, b] = shuffle([...this.alive]).slice(0, 2); return this.amor(id, a, b); }
      if (this.step === 'wolves') return this.wolfVote(id, pick([...this.alive].filter((x) => this.roles[x] !== 'wolf')));
      if (this.step === 'seer') return this.seer(id, pick(others));
      if (this.step === 'witch') {
        if (this.potions.heal && this.victim && rng() < 0.5) return this.witch(id, 'heal');
        if (this.potions.poison && rng() < 0.15) return this.witch(id, 'poison', pick(others));
        return this.witch(id, 'none');
      }
    }
    if (this.stage === 'vote') {
      const pool = this.roles[id] === 'wolf' ? others.filter((x) => this.roles[x] !== 'wolf') : others;
      return this.vote(id, rng() < 0.1 ? null : pick(pool.length ? pool : others));
    }
    if (this.stage === 'hunter') return this.shoot(id, pick([...this.alive]));
    return undefined;
  }

  // ---------- Ansicht ----------
  publicPlayer(p) {
    const dead = this.isDead(p.id);
    return {
      alive: this.alive.has(p.id), dead,
      deadRole: dead && (this.settings.revealRole || this.phase === 'over') ? this.roles[p.id] : null, // nur, wenn aufgedeckt wird
      voted: this.stage === 'vote' ? p.id in this.votes : false,
    };
  }
  gameView(viewerId) {
    const inGame = this.order.includes(viewerId);
    const role = inGame ? this.roles[viewerId] : null;
    const dead = this.isDead(viewerId);
    const all = dead || this.phase === 'over';
    const alive = this.alive.has(viewerId);
    const g = {
      stage: this.stage, day: this.day, deadline: this.deadline, alive: [...this.alive],
      deaths: this.deaths.map((d) => ({ id: d.id, day: d.day, cause: d.cause === 'weg' ? 'weg' : undefined, role: this.settings.revealRole || this.phase === 'over' ? d.role : null })),
      lastVote: this.lastVote, voted: this.stage === 'vote' ? Object.keys(this.votes).length : 0, voters: this.alive.size,
      winner: this.winner, revealRole: this.settings.revealRole,
      role: role ?? null, dead,
      wolves: role === 'wolf' || all ? this.order.filter((id) => this.roles[id] === 'wolf') : null,
      lovers: this.lovers && (this.lovers.includes(viewerId) || all) ? [...this.lovers] : null,
      roles: all ? { ...this.roles } : null,
      nightLog: all ? [...this.nightLog] : null,
      seen: role === 'seher' || all ? this.seen.filter((x) => x.id).map((x) => ({ day: x.day, id: x.id, role: x.role })) : null,
      potions: role === 'hexe' || all ? { ...this.potions } : null,
      todo: null,
    };
    if (alive && this.phase === 'playing') {
      const others = [...this.alive].filter((x) => x !== viewerId);
      if (this.stage === 'night') {
        if (this.step === 'amor' && role === 'amor' && !this.amorPick) g.todo = { type: 'amor', targets: [...this.alive] };
        else if (this.step === 'wolves' && role === 'wolf') g.todo = { type: 'wolf', targets: [...this.alive].filter((x) => this.roles[x] !== 'wolf'), voted: this.wolfVotes[viewerId] !== undefined, votes: { ...this.wolfVotes } };
        else if (this.step === 'seer' && role === 'seher' && !this.seen.some((x) => x.day === this.day && x.by === viewerId)) g.todo = { type: 'seer', targets: others };
        else if (this.step === 'witch' && role === 'hexe' && !this.witchDone) g.todo = { type: 'witch', victim: this.victim, heal: this.potions.heal && !!this.victim, poison: this.potions.poison, targets: others };
      } else if (this.stage === 'vote') g.todo = { type: 'vote', targets: others, mine: this.votes[viewerId] ?? undefined, done: viewerId in this.votes };
      else if (this.stage === 'hunter' && this.hunter === viewerId) g.todo = { type: 'shoot', targets: [...this.alive] };
    }
    if (this.stage === 'night' && all && this.phase === 'playing') g.step = this.step;
    return g;
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
