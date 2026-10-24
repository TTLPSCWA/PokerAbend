// Ein Pokertisch mit Spielern, Einstellungen, Timern und Rundenverlauf.
// Die Regeln selbst stecken in engine/table.js – hier geht es um Menschen und Zeit.
import { randomBytes } from 'node:crypto';
import { Table, SEATS } from '../engine/table.js';
import { bestHand, compareScores, outlook } from '../engine/cards.js';
import { cleanName, safeAvatarUrl } from './security.js';
import { isSebastian } from './sebastian.js';

export const DEFAULT_SETTINGS = {
  smallBlind: 50,
  bigBlind: 100,
  startStack: 10000,
  rebuy: 'unlimited', // 'off' | 'unlimited' | '1' | '2' | '3' ...
  turnTime: 30,       // Sekunden, 0 = aus
  nextDelay: 6,       // Sekunden bis zur nächsten Hand
  autoNext: true,
  handStrength: true, // Spieler dürfen sich ihre Hand anzeigen lassen
  maxPlayers: 9,
};

const AVATARS = ['🦊', '🐻', '🐼', '🐸', '🦉', '🐯', '🐙', '🦄', '🐺', '🐧', '🦁', '🐢'];
const OFFLINE_TURN = 20; // Sekunden für Spieler ohne Verbindung
const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
const fmtCard = (c) => (c[0] === 'T' ? '10' : c[0]) + SUIT[c[1]];
export const fmt = (n) => n.toLocaleString('de-DE');

export function clampSettings(input, base = DEFAULT_SETTINGS) {
  const s = { ...base };
  const int = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  if (!input) return s;
  if ('bigBlind' in input) s.bigBlind = int(input.bigBlind, 2, 1e7, s.bigBlind);
  if ('smallBlind' in input) s.smallBlind = int(input.smallBlind, 1, s.bigBlind, s.smallBlind);
  s.smallBlind = Math.min(s.smallBlind, s.bigBlind);
  if ('startStack' in input) s.startStack = int(input.startStack, s.bigBlind, 1e9, s.startStack);
  if ('rebuy' in input) s.rebuy = ['off', 'unlimited'].includes(input.rebuy) ? input.rebuy : String(int(input.rebuy, 1, 99, 3));
  if ('turnTime' in input) s.turnTime = int(input.turnTime, 0, 300, s.turnTime);
  if ('nextDelay' in input) s.nextDelay = int(input.nextDelay, 2, 60, s.nextDelay);
  if ('autoNext' in input) s.autoNext = !!input.autoNext;
  if ('handStrength' in input) s.handStrength = !!input.handStrength;
  if ('maxPlayers' in input) s.maxPlayers = int(input.maxPlayers, 2, SEATS, s.maxPlayers);
  return s;
}

export class Room {
  constructor(code, settings, onChange) {
    this.code = code;
    this.settings = clampSettings(settings);
    this.table = new Table({ smallBlind: this.settings.smallBlind, bigBlind: this.settings.bigBlind });
    this.players = new Map(); // id → Spieler
    this.hostId = null;
    this.started = false;
    this.paused = false;
    this.frozen = null; // Host hat sofort angehalten: { turnLeft, turnKey, nextLeft } in ms
    this.log = [];
    this.stats = { hands: 0, biggestPot: null, bestHand: null };
    this.onChange = onChange || (() => {});
    this.turnTimer = null;
    this.turnKey = null;
    this.deadline = null;
    this.nextTimer = null;
    this.nextAt = null;
    this.lastActivity = Date.now();
    this.seq = 0;
  }

  // ---------- Spieler ----------
  // Mit Discord-Login kommen Name und Bild von Discord (identity), sonst aus der Lobby
  addPlayer(name, avatar, { discordId = null, avatarUrl = null } = {}) {
    name = cleanName(name);
    if (!name) throw new Error('Bitte gib einen Namen ein');
    const taken = (n) => [...this.players.values()].some((p) => p.name.toLowerCase() === n.toLowerCase());
    if (discordId) {
      // Discord-Namen sind fest: bei Gleichstand bekommt der Zweite eine Nummer („Anna 2“)
      const base = name;
      for (let i = 2; taken(name); i++) name = base.slice(0, 16 - String(i).length - 1).trim() + ' ' + i;
    } else if (taken(name)) throw new Error('Der Name ist schon vergeben');
    if (this.players.size >= 30) throw new Error('Der Raum ist voll');
    const id = randomBytes(6).toString('hex');
    const p = {
      id, token: randomBytes(24).toString('hex'), name,
      avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.players.size % AVATARS.length],
      seat: null, bank: this.settings.startStack, buyIn: this.settings.startStack, rebuys: 0,
      connected: false, socketId: null, missed: 0, leaveAfterHand: false, seen: [],
      discordId: discordId ? String(discordId) : null, avatarUrl: safeAvatarUrl(avatarUrl),
    };
    this.players.set(id, p);
    if (!this.hostId) this.hostId = id;
    this.say(`${name} ist da`);
    return p;
  }

  byToken(token) {
    for (const p of this.players.values()) if (p.token === token) return p;
    return null;
  }

  byDiscord(discordId) {
    for (const p of this.players.values()) if (p.discordId && p.discordId === String(discordId)) return p;
    return null;
  }

  seatOf(id) { return this.players.get(id)?.seat ?? null; }
  playerAt(seat) { const s = this.table.seats[seat]; return s ? this.players.get(s.id) : null; }
  get handRunning() { return !!(this.table.hand && !this.table.hand.done); }

  sit(id, seat) {
    const p = this.players.get(id);
    if (p.seat !== null) throw new Error('Du sitzt schon');
    const seated = this.table.seats.filter(Boolean).length;
    if (seated >= this.settings.maxPlayers) throw new Error('Der Tisch ist voll');
    this.table.sit(seat, { id, name: p.name, stack: p.bank });
    p.bank = 0; p.seat = seat; p.leaveAfterHand = false;
    this.say(`${p.name} setzt sich`);
    this.maybeStart();
  }

  stand(id) {
    const p = this.players.get(id);
    if (p.seat === null) return;
    if (this.handRunning && this.table.hand.players[p.seat]) {
      this.table.forceFold(p.seat);
      this.flushEvents();
      if (this.handRunning) { p.leaveAfterHand = true; return; }
    }
    this.doStand(p);
  }

  doStand(p) {
    const s = this.table.leave(p.seat);
    p.bank = s.stack; p.seat = null; p.leaveAfterHand = false; p.sebPause = false;
    this.say(`${p.name} steht auf`);
  }

  remove(id, message) {
    const p = this.players.get(id);
    if (!p || p.kicked) return;
    this.say(message || `${p.name} wurde vom Tisch entfernt`);
    if (this.hostId === id) this.transferHost();
    if (p.seat !== null) {
      if (this.handRunning && this.table.hand.players[p.seat]) { this.table.forceFold(p.seat); this.flushEvents(); }
      // Läuft die Hand noch, verschwindet er erst danach (Chips im Pot bleiben im Pot)
      if (this.handRunning && this.table.hand.players[p.seat]) { p.kicked = true; p.leaveAfterHand = true; return; }
      this.table.leave(p.seat);
    }
    this.players.delete(id);
  }

  // Wer länger als ms offline ist, fliegt mit allen Daten raus: Platz frei, Chips und Stand weg.
  // Ist es der Host, übernimmt jemand anderes.
  dropAway(ms, now = Date.now()) {
    let dropped = 0;
    for (const p of [...this.players.values()]) {
      if (p.connected || p.kicked || now - (p.offlineSince ?? now) < ms) continue;
      this.remove(p.id, `${p.name} war ${Math.round(ms / 60000) || 'ein paar'} Minuten weg und wurde entfernt`);
      dropped++;
    }
    return dropped;
  }

  // Niemand mehr da: alle entfernt oder nur noch auf dem Weg raus
  get abandoned() {
    return [...this.players.values()].every((p) => p.kicked);
  }

  setSittingOut(id, value) {
    const p = this.players.get(id);
    if (p.seat === null) throw new Error('Du sitzt nicht am Tisch');
    this.table.seats[p.seat].sittingOut = value;
    p.sebPause = value && isSebastian(p.name); // Easter Egg, nur bei Pause per Knopf
    p.missed = 0;
    this.say(value ? `${p.name} macht Pause` : `${p.name} ist wieder dabei`);
    if (!value) this.maybeStart();
  }

  rebuy(id) {
    const p = this.players.get(id);
    if (p.seat === null) throw new Error('Setz dich zuerst an den Tisch');
    const s = this.table.seats[p.seat];
    if (s.stack > 0) throw new Error('Nachkaufen geht erst, wenn du keine Chips mehr hast');
    if (this.handRunning && this.table.hand.players[p.seat] && !this.table.hand.players[p.seat].folded) throw new Error('Warte bis die Hand vorbei ist');
    const r = this.settings.rebuy;
    if (r === 'off') throw new Error('Nachkaufen ist an diesem Tisch aus');
    if (r !== 'unlimited' && p.rebuys >= Number(r)) throw new Error(`Maximal ${r}× nachkaufen`);
    s.stack = this.settings.startStack;
    s.sittingOut = false;
    p.sebPause = false;
    p.rebuys++; p.buyIn += this.settings.startStack;
    this.say(`${p.name} kauft ${fmt(this.settings.startStack)} Chips nach`);
    this.maybeStart();
  }

  transferHost() {
    const next = [...this.players.values()].find((p) => p.connected && !p.kicked && p.id !== this.hostId)
      || [...this.players.values()].find((p) => !p.kicked && p.id !== this.hostId);
    if (next) { this.hostId = next.id; this.say(`${next.name} ist jetzt Host`); }
  }

  // ---------- Host ----------
  requireHost(id) { if (id !== this.hostId) throw new Error('Nur der Host darf das'); }

  updateSettings(id, input) {
    this.requireHost(id);
    this.settings = clampSettings(input, this.settings);
    if (!this.handRunning) this.applyBlinds();
    this.say('Tischregeln geändert' + (this.handRunning ? ' – gilt ab der nächsten Hand' : ''));
  }

  applyBlinds() {
    this.table.smallBlind = this.settings.smallBlind;
    this.table.bigBlind = this.settings.bigBlind;
  }

  adjustStack(id, targetId, amount) {
    this.requireHost(id);
    if (this.handRunning) throw new Error('Chips korrigieren geht nur zwischen zwei Händen');
    const p = this.players.get(targetId);
    if (!p) throw new Error('Spieler nicht gefunden');
    const n = Math.max(0, Math.floor(Number(amount)));
    if (!Number.isFinite(n)) throw new Error('Ungültiger Betrag');
    const old = p.seat !== null ? this.table.seats[p.seat].stack : p.bank;
    if (p.seat !== null) this.table.seats[p.seat].stack = n; else p.bank = n;
    this.say(`Host-Korrektur: ${p.name} ${fmt(old)} → ${fmt(n)}`, 'warn');
  }

  start(id) {
    this.requireHost(id);
    if (this.handRunning) return;
    if (this.table.eligibleSeats().length < 2) throw new Error('Es müssen mindestens 2 Spieler mit Chips sitzen');
    this.paused = false;
    this.say('Das Spiel läuft');
    this.startNext(true);
  }

  togglePause(id) {
    this.requireHost(id);
    this.paused = !this.paused;
    this.say(this.paused ? 'Pause nach dieser Hand' : 'Weiter geht’s');
    if (!this.paused) this.maybeStart();
  }

  // Sofort-Pause für alle: Timer bleiben stehen, niemand kann handeln, bis der Host weitermacht
  toggleFreeze(id) {
    this.requireHost(id);
    if (this.frozen) {
      const { turnLeft, turnKey, nextLeft } = this.frozen;
      this.frozen = null;
      const h = this.table.hand;
      // Restzeit nur, wenn noch derselbe Zug läuft – sonst bekommt der Nächste die volle Zeit
      if (turnLeft !== null && turnKey === this.turnKey && h && !h.done && `${h.no}:${this.seq}:${h.toAct}` === turnKey) {
        const seat = h.toAct; const key = turnKey;
        this.deadline = Date.now() + turnLeft;
        this.turnTimer = setTimeout(() => this.timeout(seat, key), turnLeft);
      }
      if (nextLeft !== null) this.scheduleNext(nextLeft);
      this.say('Weiter geht’s', 'warn');
      this.afterChange();
      return;
    }
    const now = Date.now();
    this.frozen = {
      turnLeft: this.deadline ? Math.max(0, this.deadline - now) : null,
      turnKey: this.turnKey,
      nextLeft: this.nextAt ? Math.max(0, this.nextAt - now) : null,
    };
    clearTimeout(this.turnTimer); this.turnTimer = null; this.deadline = null;
    clearTimeout(this.nextTimer); this.nextTimer = null; this.nextAt = null;
    this.say('Der Host hat das Spiel angehalten', 'warn');
  }

  nextHand(id) {
    this.requireHost(id);
    if (this.frozen) throw new Error('Das Spiel ist angehalten');
    if (this.handRunning) throw new Error('Die Hand läuft noch');
    this.startNext(true);
  }

  // ---------- Spielablauf ----------
  maybeStart() {
    if (!this.started || this.paused || this.frozen || this.handRunning || this.nextTimer) return this.handRunning;
    if (this.table.hand?.done && !this.settings.autoNext) return false;
    return this.startNext();
  }

  startNext(force = false) {
    clearTimeout(this.nextTimer); this.nextTimer = null; this.nextAt = null;
    if (this.handRunning || (!this.started && !force) || (this.paused && !force)) return false;
    if (force) this.started = true;
    this.cleanupAfterHand();
    this.applyBlinds();
    if (this.table.eligibleSeats().length < 2) return false;
    this.table.startHand();
    this.flushEvents();
    this.afterChange();
    return true;
  }

  cleanupAfterHand() {
    for (const p of [...this.players.values()]) {
      if (p.leaveAfterHand && p.seat !== null) {
        if (p.kicked) { this.table.leave(p.seat); this.players.delete(p.id); }
        else this.doStand(p);
      }
    }
  }

  act(id, action) {
    const p = this.players.get(id);
    if (p.seat === null) throw new Error('Du sitzt nicht am Tisch');
    if (this.frozen) throw new Error('Das Spiel ist gerade angehalten');
    if (action.id) {
      if (p.seen.includes(action.id)) return false; // doppelt gesendet
      p.seen.push(action.id); if (p.seen.length > 50) p.seen.shift();
    }
    this.table.act(p.seat, action);
    p.missed = 0;
    this.flushEvents();
    this.afterChange();
    return true;
  }

  show(id) {
    const p = this.players.get(id);
    if (p.seat === null) throw new Error('Du sitzt nicht am Tisch');
    this.table.show(p.seat);
    this.say(`${p.name} zeigt ${this.table.hand.players[p.seat].cards.map(fmtCard).join(' ')}`);
  }

  // Wird nach jeder Änderung am Spielzustand aufgerufen
  afterChange() {
    const h = this.table.hand;
    if (h && h.done) {
      clearTimeout(this.turnTimer); this.turnTimer = null; this.turnKey = null; this.deadline = null;
      if (!h.counted) { h.counted = true; this.recordStats(h); this.onChange('handDone'); }
      if (this.started && !this.paused && !this.frozen && this.settings.autoNext && !this.nextTimer) this.scheduleNext(this.settings.nextDelay * 1000);
      return;
    }
    if (!this.frozen) this.scheduleTurn();
  }

  scheduleNext(ms) {
    this.nextAt = Date.now() + ms;
    this.nextTimer = setTimeout(() => { this.nextTimer = null; this.nextAt = null; this.startNext(); this.onChange('state'); }, ms);
  }

  scheduleTurn() {
    const h = this.table.hand;
    if (!h || h.done || h.toAct < 0) return;
    const key = `${h.no}:${this.seq}:${h.toAct}`;
    const p = this.playerAt(h.toAct);
    const offline = !!p && !p.connected;
    let secs = this.settings.turnTime || 0;
    if (offline) secs = secs ? Math.min(secs, OFFLINE_TURN) : OFFLINE_TURN;
    if (key === this.turnKey) {
      // Gleicher Zug: nur verkürzen, wenn der Spieler gerade offline gegangen ist
      if (!offline || (this.deadline && this.deadline - Date.now() <= secs * 1000)) return;
    }
    clearTimeout(this.turnTimer);
    this.turnKey = key;
    if (!secs) { this.deadline = null; return; }
    this.deadline = Date.now() + secs * 1000;
    const seat = h.toAct;
    this.turnTimer = setTimeout(() => this.timeout(seat, key), secs * 1000);
  }

  timeout(seat, key) {
    const h = this.table.hand;
    if (!h || h.done || h.toAct !== seat || this.turnKey !== key) return;
    const p = this.playerAt(seat);
    const L = this.table.legal(seat);
    this.table.act(seat, { type: L.canCheck ? 'check' : 'fold' });
    if (p) {
      p.missed++;
      this.say(`${p.name}: Zeit abgelaufen`);
      if (p.missed >= 2) { this.table.seats[seat].sittingOut = true; this.say(`${p.name} wird auf Pause gesetzt`); }
    }
    this.flushEvents();
    this.afterChange();
    this.onChange('state');
  }

  recordStats(h) {
    this.stats.hands++;
    for (const pot of h.result.pots) {
      const name = pot.winners.map((s) => this.playerAt(s)?.name).join(' & ');
      if (!this.stats.biggestPot || pot.amount > this.stats.biggestPot.amount) {
        this.stats.biggestPot = { amount: pot.amount, name, hand: pot.hand };
      }
    }
    if (h.result.showdown) {
      for (const seat of h.shown) {
        const e = bestHand([...h.players[seat].cards, ...h.board]);
        const best = this.stats.bestHand;
        if (!best || compareScores(e.score, best.score) > 0) {
          this.stats.bestHand = { score: e.score, name: this.playerAt(seat)?.name, hand: e.name };
        }
      }
    }
  }

  // Engine-Ereignisse in lesbaren Rundenverlauf übersetzen
  flushEvents() {
    const t = this.table;
    const name = (seat) => t.seats[seat]?.name ?? '?';
    for (const e of t.events.splice(0)) {
      this.seq++;
      switch (e.type) {
        case 'hand': this.say(`Hand #${e.no}`, 'hand'); break;
        case 'sb': this.say(`${name(e.seat)} zahlt Small Blind ${fmt(e.amount)}`); break;
        case 'bb': this.say(`${name(e.seat)} zahlt Big Blind ${fmt(e.amount)}`); break;
        case 'fold': this.say(`${name(e.seat)} foldet`); break;
        case 'check': this.say(`${name(e.seat)} checkt`); break;
        case 'call': this.say(`${name(e.seat)} callt ${fmt(e.amount)}${e.allIn ? ' und ist All-in' : ''}`); break;
        case 'bet': this.say(`${name(e.seat)} setzt ${fmt(e.to)}${e.allIn ? ' (All-in)' : ''}`, 'bet'); break;
        case 'raise': this.say(`${name(e.seat)} erhöht auf ${fmt(e.to)}${e.allIn ? ' (All-in)' : ''}`, 'bet'); break;
        case 'refund': this.say(`${name(e.seat)} bekommt ${fmt(e.amount)} zurück`); break;
        case 'street': {
          const label = { flop: 'Flop', turn: 'Turn', river: 'River' }[e.street];
          const cards = e.street === 'flop' ? e.board : e.board.slice(-1);
          this.say(`${label}: ${cards.map(fmtCard).join(' ')}`, 'street');
          break;
        }
        case 'result':
          for (const pot of e.result.pots) {
            const who = pot.winners.map(name).join(' & ');
            const verb = pot.winners.length > 1 ? 'teilen sich' : 'gewinnt';
            this.say(`${who} ${verb} ${fmt(pot.amount)}${pot.hand ? ` mit ${pot.hand}` : ''}`, 'win');
          }
          break;
      }
    }
  }

  say(text, kind = 'info') {
    this.log.push({ text, kind, at: Date.now() });
    if (this.log.length > 80) this.log.shift();
    this.lastActivity = Date.now();
  }

  // ---------- Ansicht pro Spieler (nur was er sehen darf!) ----------
  view(viewerId) {
    const t = this.table;
    const h = t.hand;
    const me = this.players.get(viewerId);
    const mySeat = me?.seat ?? null;
    const seats = t.seats.map((s, i) => {
      if (!s) return null;
      const p = this.players.get(s.id);
      const hp = h?.players[i];
      let cards = null;
      if (hp && !hp.folded) {
        const visible = i === mySeat || (h.done && h.shown.has(i));
        cards = visible ? hp.cards : ['??', '??'];
      }
      return {
        seat: i, id: s.id, name: s.name, avatar: p?.avatar, avatarUrl: p?.avatarUrl || null, stack: s.stack,
        sittingOut: s.sittingOut, busted: s.stack === 0 && !(hp && !h.done && !hp.folded),
        connected: !!p?.connected, isHost: s.id === this.hostId,
        inHand: !!hp, folded: !!hp?.folded, allIn: !!hp?.allIn && !h?.done,
        bet: hp && !h.done ? hp.bet : 0, lastAction: hp?.lastAction ?? null,
        cards, leaving: !!p?.leaveAfterHand,
      };
    });

    let hand = null;
    if (h) {
      const result = h.result && {
        showdown: h.result.showdown,
        pots: h.result.pots.map((pot) => ({
          amount: pot.amount, winners: pot.winners, hand: pot.hand, cards: pot.cards,
          names: pot.winners.map((s) => t.seats[s]?.name ?? '?'),
        })),
        hands: Object.fromEntries([...h.shown].filter((s) => h.result.hands[s]).map((s) => [s, h.result.hands[s]])),
      };
      hand = {
        no: h.no, street: h.street, board: h.board, button: h.button, sb: h.sb, bb: h.bb,
        toAct: h.toAct, currentBet: h.currentBet, done: h.done,
        pots: h.done ? [] : t.potsDisplay().map((p) => p.amount),
        bets: h.done ? 0 : h.seats.reduce((a, i) => a + h.players[i].bet, 0),
        deadline: this.deadline, frozenLeft: this.frozen?.turnLeft ?? null, turnTime: this.settings.turnTime, result,
      };
    }

    let legal = null;
    let strength = null;
    let odds = null;
    let strengthCat = null;
    if (mySeat !== null && h) {
      if (!h.done && !this.frozen && h.toAct === mySeat) legal = t.legal(mySeat);
      const hp = h.players[mySeat];
      if (hp && !hp.folded && this.settings.handStrength) {
        const e = bestHand([...hp.cards, ...h.board]);
        strength = e.name; strengthCat = e.category;
        if (!h.done) odds = this.oddsFor(mySeat);
      }
    }
    const canShow = !!(h && h.done && mySeat !== null && h.players[mySeat] && !h.shown.has(mySeat) && !h.result.showdown);

    const standings = [...this.players.values()].map((p) => {
      const chips = p.seat !== null ? t.seats[p.seat].stack : p.bank;
      const inPot = p.seat !== null && h && !h.done && h.players[p.seat] ? h.players[p.seat].total : 0;
      return { id: p.id, name: p.name, avatar: p.avatar, avatarUrl: p.avatarUrl || null, chips: chips + inPot, net: chips + inPot - p.buyIn, rebuys: p.rebuys, seated: p.seat !== null, connected: p.connected };
    }).sort((a, b) => b.net - a.net);

    return {
      code: this.code,
      you: me ? { id: me.id, name: me.name, seat: mySeat, isHost: me.id === this.hostId, rebuys: me.rebuys } : null,
      hostId: this.hostId,
      settings: this.settings,
      started: this.started, paused: this.paused, frozen: !!this.frozen, nextAt: this.nextAt, now: Date.now(),
      seats, hand, legal, strength, strengthCat, odds, canShow,
      log: this.log.slice(-40),
      // Easter Egg: wer gerade als „Sebastian“ Pause macht (per ID, nur dieser Raum)
      sebs: [...this.players.values()]
        .filter((p) => p.sebPause && p.seat !== null && t.seats[p.seat]?.sittingOut)
        .map((p) => ({ id: p.id, name: p.name })),
      standings,
      stats: { hands: this.stats.hands, biggestPot: this.stats.biggestPot, bestHand: this.stats.bestHand && { name: this.stats.bestHand.name, hand: this.stats.bestHand.hand } },
    };
  }

  // Chancen je Hand bis zum River – nur einmal pro Straße rechnen, nicht bei jedem Update
  oddsFor(seat) {
    const h = this.table.hand;
    if (this.oddsCache?.no !== h.no) this.oddsCache = { no: h.no, map: new Map() };
    const key = seat + ':' + h.board.length;
    let odds = this.oddsCache.map.get(key);
    if (!odds) {
      odds = outlook(h.players[seat].cards, h.board).map((p) => Math.round(p * 1000) / 10);
      this.oddsCache.map.set(key, odds);
    }
    return odds;
  }

  // ---------- Speichern / Laden ----------
  snapshot() {
    return {
      code: this.code, settings: this.settings, hostId: this.hostId,
      button: this.table.button, handNo: this.table.handNo, stats: this.stats,
      log: this.log.slice(-20),
      players: [...this.players.values()].map((p) => ({
        id: p.id, token: p.token, name: p.name, avatar: p.avatar, seat: p.seat,
        discordId: p.discordId || null, avatarUrl: p.avatarUrl || null,
        chips: p.seat !== null ? this.table.seats[p.seat].stack : p.bank,
        sittingOut: p.seat !== null ? this.table.seats[p.seat].sittingOut : false,
        buyIn: p.buyIn, rebuys: p.rebuys, sebPause: !!p.sebPause,
      })),
    };
  }

  static restore(data, onChange) {
    const r = new Room(data.code, data.settings, onChange);
    r.hostId = data.hostId;
    r.table.button = data.button;
    r.table.handNo = data.handNo;
    r.stats = data.stats || r.stats;
    r.log = data.log || [];
    for (const d of data.players) {
      const p = {
        id: d.id, token: d.token, name: d.name, avatar: d.avatar, seat: null, bank: d.chips,
        discordId: d.discordId || null, avatarUrl: safeAvatarUrl(d.avatarUrl),
        buyIn: d.buyIn, rebuys: d.rebuys, connected: false, socketId: null, missed: 0, leaveAfterHand: false, seen: [],
        offlineSince: Date.now(), // nach einem Neustart bekommt jeder wieder die volle Frist
        sebPause: !!d.sebPause,
      };
      r.players.set(p.id, p);
      if (d.seat !== null && d.seat !== undefined) {
        r.table.sit(d.seat, { id: p.id, name: p.name, stack: d.chips, sittingOut: d.sittingOut });
        p.seat = d.seat; p.bank = 0;
      }
    }
    r.say('Server neu gestartet – Host startet weiter');
    return r;
  }
}
