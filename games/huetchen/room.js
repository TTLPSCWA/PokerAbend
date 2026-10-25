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
  }

  setupRound() {
    this.pieces = {}; this.color = {};
    this.order.forEach((id, i) => { this.pieces[id] = [-1, -1, -1, -1]; this.color[id] = i; });
  }
  onTurnStart() { this.rolled = null; this.tries = 0; this.options = []; }

  abs(id, progress) { return (this.color[id] * 10 + progress) % TRACK; }
  // Wer (außer except) steht auf diesem Streckenfeld? → [Spieler, Hütchen] oder null
  occupant(absField, except = null) {
    for (const id of this.order) {
      if (id === except) continue;
      const i = this.pieces[id].findIndex((p) => p >= 0 && p < TRACK && this.abs(id, p) === absField);
      if (i >= 0) return [id, i];
    }
    return null;
  }

  // Welche Hütchen dürfen mit d ziehen? (Pflichten zuerst)
  movable(id, d) {
    const pcs = this.pieces[id];
    const ok = (i) => {
      const p = pcs[i];
      if (p === -1) return d === 6 && !pcs.includes(0);
      const t = p + d;
      if (t > GOAL + 3) return false;
      if (t >= GOAL) {
        for (let s = Math.max(p + 1, GOAL); s <= t; s++) if (pcs.includes(s)) return false; // nicht überspringen
        return true;
      }
      return !pcs.some((q, j) => j !== i && q === t); // eigenes Hütchen im Weg
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

  // Würde dieser Zug eine fremde Figur schlagen?
  captures(id, i, d) {
    const p = this.pieces[id][i];
    const t = p === -1 ? 0 : p + d;
    return t < GOAL && !!this.occupant(this.abs(id, t), id);
  }

  // Kein Hütchen unterwegs? (dann drei Versuche)
  stuck(id) { return !this.pieces[id].some((p) => p >= 0 && p < GOAL); }

  throwDice(id) {
    this.requireTurn(id);
    if (this.rolled !== null) throw new Error('Erst ziehen');
    const d = this.roll();
    this.rolled = d;
    this.options = this.movable(id, d);
    this.say(`${this.name(id)} würfelt eine ${d}`, 'info', 'action');
    this.act(id, `würfelt ${d}`);
    if (this.options.length) return;
    // Nichts zu ziehen
    const s = this.settings;
    if (s.threeTries && this.stuck(id) && d !== 6 && ++this.tries < 3) { this.rolled = null; return; }
    if (d === 6 && s.sixAgain) { this.rolled = null; this.tries = 0; return; } // nochmal
    this.next(1);
  }

  move(id, piece) {
    this.requireTurn(id);
    if (this.rolled === null) throw new Error('Erst würfeln');
    piece = Number(piece);
    if (!this.options.includes(piece)) throw new Error('Diese Figur darf gerade nicht ziehen');
    const pcs = this.pieces[id];
    const d = this.rolled;
    pcs[piece] = pcs[piece] === -1 ? 0 : pcs[piece] + d;
    if (pcs[piece] < GOAL) {
      const hit = this.occupant(this.abs(id, pcs[piece]), id);
      if (hit) {
        this.pieces[hit[0]][hit[1]] = -1;
        this.say(`${this.name(id)} schlägt ${this.name(hit[0])} – zurück ins Haus!`, 'react');
        this.act(id, 'schlägt!');
      }
    } else if (pcs[piece] >= GOAL) { this.say(`${this.name(id)} ist mit einer Figur im Ziel`, 'info', 'action'); this.act(id, 'ins Ziel'); }
    if (pcs.every((p) => p >= GOAL)) return this.finishRound([id], `${this.name(id)} gewinnt Mensch ärgere Dich nicht!`, { [id]: 1 });
    if (d === 6 && this.settings.sixAgain) { this.rolled = null; this.tries = 0; this.options = []; return; } // nach einer 6 nochmal
    this.next(1);
  }

  onDropOut(p) { delete this.pieces[p.id]; }

  publicPlayer(p) { return { color: this.color[p.id] ?? null, home: (this.pieces[p.id] || []).filter((x) => x >= GOAL).length }; }

  gameView(viewerId) {
    const mine = this.currentId === viewerId;
    return {
      pieces: this.pieces, color: this.color, rolled: this.rolled, tries: this.tries,
      options: mine ? this.options : [],
      stuck: this.currentId ? this.stuck(this.currentId) : false,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
