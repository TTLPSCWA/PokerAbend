// Mensch ärgere Dich nicht – Brettspiel für 2–4 (interne ID „huetchen“). Im Code heißen die Spielfiguren „Hütchen“. Hausregeln:
// 40 Felder im Kreis, jeder hat 4 Hütchen im Haus, 4 Zielfelder. Rauskommen nur mit einer 6.
// Wer kein Hütchen auf der Strecke hat, darf bis zu dreimal würfeln. Nach einer 6 darf man nochmal.
// Mit einer 6 muss man raus, wenn das eigene Startfeld frei ist; steht ein eigenes Hütchen auf dem Startfeld, muss es weg (wenn es geht).
// Wer auf einem fremden Hütchen landet, schickt es ins Haus. Eigene Hütchen kann man nicht schlagen oder überspringen im Ziel.
// Ins Ziel nur mit passender Augenzahl. Wer zuerst alle 4 im Ziel hat, gewinnt.
// Fortschritt eines Hütchens: -1 = Haus, 0–39 = Schritte ab dem eigenen Startfeld, 40–43 = Zielfelder.
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export const TRACK = 40;
export const GOAL = 40; // erster Zielplatz
export const COLORS = ['Rot', 'Blau', 'Grün', 'Gelb'];

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'forceCapture', label: 'Schlagzwang', type: 'bool' },
    { key: 'sixAgain', label: 'Nach einer 6 nochmal würfeln', type: 'bool' },
    { key: 'threeTries', label: 'Drei Versuche, wenn keine Figur draußen ist', type: 'bool' },
    { key: 'mustExit', label: 'Mit einer 6 muss man raus (und das Startfeld räumen)', type: 'bool' },
  ];
  defaultSettings() { return { forceCapture: false, sixAgain: true, threeTries: true, mustExit: true }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 4, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.roll = die;
    this.pieces = {}; this.color = {}; this.rolled = null; this.tries = 0; this.options = [];
    this.track = this.variant === 'six' ? 60 : TRACK;
  }

  validateStart(ids) { if (this.variant === 'team' && ids.length !== 4) throw new Error('Teamspiel braucht vier Spieler'); }
  partner(id) { return this.variant === 'team' && this.teamSeats?.includes(id) ? this.teamSeats[(this.teamSeats.indexOf(id) + 2) % 4] : null; }
  controlled(id) { return this.variant === 'team' && this.pieces[id]?.every((p) => p >= this.track) ? this.partner(id) : id; }

  setupRound() {
    this.teamSeats = this.order.slice();
    this.pieces = {}; this.color = {};
    this.order.forEach((id, i) => { this.pieces[id] = [-1, -1, -1, -1]; this.color[id] = i; });
  }
  onTurnStart() { this.rolled = null; this.tries = 0; this.options = []; }

  abs(id, progress) { return (this.color[id] * 10 + progress) % this.track; }
  // Wer (außer except) steht auf diesem Streckenfeld? → [Spieler, Hütchen] oder null
  occupant(absField, except = null) {
    for (const id of this.order) {
      if (id === except) continue;
      const i = this.pieces[id].findIndex((p) => p >= 0 && p < this.track && this.abs(id, p) === absField);
      if (i >= 0) return [id, i];
    }
    return null;
  }

  // Welche Hütchen dürfen mit d ziehen? (Pflichten zuerst)
  movable(id, d) {
    const pcs = this.pieces[id];
    const ok = (i) => {
      const p = pcs[i];
      if (p === -1) return d === 6 && !pcs.includes(0) && !this.friendlyAt(id, 0);
      const t = p + d;
      if (t > this.track + 3) return false;
      if (t >= this.track) {
        for (let s = Math.max(p + 1, this.track); s <= t; s++) if (pcs.includes(s)) return false; // nicht überspringen
        return true;
      }
      return !this.friendlyAt(id, t) && !pcs.some((q, j) => j !== i && q === t); // eigenes Hütchen im Weg
    };
    let all = [0, 1, 2, 3].filter(ok);
    // Nur eine Figur aus dem Haus anbieten (die vier sind gleich)
    const house = all.filter((i) => pcs[i] === -1);
    if (house.length > 1) all = all.filter((i) => pcs[i] !== -1 || i === house[0]);
    if (this.settings.mustExit) {
      // Pflicht: mit einer 6 raus
      if (house.length) return [house[0]];
      // Pflicht: eigenes Startfeld räumen, solange noch jemand im Haus wartet
      const onStart = pcs.indexOf(0);
      if (onStart >= 0 && pcs.includes(-1) && all.includes(onStart)) return [onStart];
    }
    // Schlagzwang: wenn man schlagen kann, muss man
    if (this.settings.forceCapture) {
      const hits = all.filter((i) => this.captures(id, i, d));
      if (hits.length) return hits;
    }
    return all;
  }

  friendlyAt(id, progress) { const partner = this.partner(id); return partner && this.pieces[partner]?.some((p) => p >= 0 && p < this.track && this.abs(partner, p) === this.abs(id, progress)); }

  // Würde dieser Zug eine fremde Figur schlagen?
  captures(id, i, d) {
    const p = this.pieces[id][i];
    const t = p === -1 ? 0 : p + d;
    return t < this.track && !!this.occupant(this.abs(id, t), id);
  }

  // Kein Hütchen unterwegs? (dann drei Versuche)
  stuck(id) { return !this.pieces[id].some((p) => p >= 0 && p < this.track); }

  throwDice(id) {
    this.requireTurn(id);
    if (this.rolled !== null) throw new Error('Erst ziehen');
    const d = this.roll();
    this.rolled = d;
    this.options = this.movable(this.controlled(id), d);
    this.say(`${this.name(id)} würfelt eine ${d}`, 'info', 'action');
    this.act(id, `würfelt ${d}`);
    if (this.options.length) return;
    // Nichts zu ziehen
    const s = this.settings;
    if (s.threeTries && this.stuck(this.controlled(id)) && d !== 6 && ++this.tries < 3) { this.rolled = null; return; }
    if (d === 6 && s.sixAgain) { this.rolled = null; this.tries = 0; return; } // nochmal
    this.next(1);
  }

  move(id, piece) {
    this.requireTurn(id);
    if (this.rolled === null) throw new Error('Erst würfeln');
    piece = Number(piece);
    if (!this.options.includes(piece)) throw new Error('Diese Figur darf gerade nicht ziehen');
    const owner = this.controlled(id);
    const pcs = this.pieces[owner];
    const d = this.rolled;
    pcs[piece] = pcs[piece] === -1 ? 0 : pcs[piece] + d;
    if (pcs[piece] < this.track) {
      const hit = this.occupant(this.abs(owner, pcs[piece]), owner);
      if (hit) {
        this.pieces[hit[0]][hit[1]] = -1;
        this.say(`${this.name(id)} schlägt ${this.name(hit[0])} – zurück ins Haus!`, 'react');
        this.act(id, 'schlägt!');
      }
    } else if (pcs[piece] >= this.track) { this.say(`${this.name(id)} ist mit einer Figur im Ziel`, 'info', 'action'); this.act(id, 'ins Ziel'); }
    const winners = this.variant === 'team' ? [id, this.partner(id)] : [id];
    if (winners.every((p) => this.pieces[p].every((v) => v >= this.track))) return this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} gewinnt Mensch ärgere Dich nicht!`, Object.fromEntries(winners.map((p) => [p, 1])));
    if (d === 6 && this.settings.sixAgain) { this.rolled = null; this.tries = 0; this.options = []; return; } // nach einer 6 nochmal
    this.next(1);
  }

  onDropOut(p) { if (this.variant === 'team') { const winners = this.order.filter((id) => id !== p.id && id !== this.partner(p.id)); this.finishRound(winners, 'Teamspiel durch Ausscheiden beendet', Object.fromEntries(winners.map((id) => [id, 1]))); } delete this.pieces[p.id]; }

  publicPlayer(p) { return { color: this.color[p.id] ?? null, home: (this.pieces[p.id] || []).filter((x) => x >= this.track).length }; }

  gameView(viewerId) {
    const mine = this.currentId === viewerId;
    return {
      pieces: this.pieces, color: this.color, rolled: this.rolled, tries: this.tries,
      options: mine ? this.options : [],
      track: this.track, controlled: this.currentId ? this.controlled(this.currentId) : null,
      partners: this.variant === 'team' ? Object.fromEntries(this.teamSeats.map((id) => [id, this.partner(id)])) : null,
      stuck: this.currentId ? this.stuck(this.controlled(this.currentId)) : false,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
