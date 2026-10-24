// Hütchenrennen – Brettspiel für 2–4 (Mensch-ärgere-dich-ähnlich, eigene Gestaltung). Hausregeln:
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
    const all = [0, 1, 2, 3].filter(ok);
    // Pflicht: mit einer 6 raus
    const out = all.filter((i) => pcs[i] === -1);
    if (out.length) return [out[0]];
    // Pflicht: eigenes Startfeld räumen, solange noch jemand im Haus wartet
    const onStart = pcs.indexOf(0);
    if (onStart >= 0 && pcs.includes(-1) && all.includes(onStart)) return [onStart];
    return all;
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
    if (this.options.length) return;
    // Nichts zu ziehen
    if (this.stuck(id) && d !== 6 && ++this.tries < 3) { this.rolled = null; return; }
    if (d === 6) { this.rolled = null; this.tries = 0; return; } // nochmal
    this.next(1);
  }

  move(id, piece) {
    this.requireTurn(id);
    if (this.rolled === null) throw new Error('Erst würfeln');
    piece = Number(piece);
    if (!this.options.includes(piece)) throw new Error('Dieses Hütchen darf gerade nicht ziehen');
    const pcs = this.pieces[id];
    const d = this.rolled;
    pcs[piece] = pcs[piece] === -1 ? 0 : pcs[piece] + d;
    if (pcs[piece] < GOAL) {
      const hit = this.occupant(this.abs(id, pcs[piece]), id);
      if (hit) {
        this.pieces[hit[0]][hit[1]] = -1;
        this.say(`${this.name(id)} schlägt ${this.name(hit[0])} – zurück ins Haus!`, 'react');
      }
    } else if (pcs[piece] >= GOAL) this.say(`${this.name(id)} ist mit einem Hütchen im Ziel`, 'info', 'action');
    if (pcs.every((p) => p >= GOAL)) return this.finishRound([id], `${this.name(id)} gewinnt das Hütchenrennen!`, { [id]: 1 });
    if (d === 6) { this.rolled = null; this.tries = 0; this.options = []; return; } // nach einer 6 nochmal
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
