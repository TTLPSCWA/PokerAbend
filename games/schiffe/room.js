// Schiffe versenken – Brettspiel für genau 2 (weitere schauen zu). Hausregeln (Standard):
// Zwei Meere 10 × 10 (Spalten A–J, Zeilen 1–10). Flotte: 1× 5er, 1× 4er, 2× 3er, 1× 2er (Hausregel „Klassisch“: 1× 5, 2× 4, 3× 3, 4× 2).
// Erst setzen beide gleichzeitig ihre Schiffe (nicht überlappend, nicht berührend – auch nicht diagonal; Berühren als Hausregel).
// Dann wird abwechselnd geschossen: Wasser oder Treffer = Wechsel (Hausregel: nach einem Treffer nochmal). Versenkt wird angesagt.
// Wer zuerst alle gegnerischen Schiffe versenkt, gewinnt. Zeit pro Schuss über den Zug-Timer (läuft sie ab, wird zufällig geschossen).
// WICHTIG: Wo die Schiffe des Gegners liegen, verlässt den Server erst nach Spielende – vorher nur Treffer, Wasser und versenkte Schiffe.
import { TurnRoom } from '../../server/turn-room.js';

export const SIZE = 10;
export const FLEETS = { standard: [5, 4, 3, 3, 2], classic: [5, 4, 4, 3, 3, 3, 2, 2, 2, 2] };
export const SHIP_NAME = { 5: 'Flugzeugträger', 4: 'Schlachtschiff', 3: 'Kreuzer', 2: 'Zerstörer' };
export const cellName = (i) => `${'ABCDEFGHIJ'[i % SIZE]}${Math.floor(i / SIZE) + 1}`;

// Zellen eines Schiffs: Bug bei cell, waagerecht nach rechts oder senkrecht nach unten – oder null, wenn es nicht aufs Brett passt
export function shipCells(cell, size, horizontal) {
  const r = Math.floor(cell / SIZE), c = cell % SIZE;
  if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) return null;
  if (horizontal ? c + size > SIZE : r + size > SIZE) return null;
  return Array.from({ length: size }, (_, k) => (horizontal ? cell + k : cell + k * SIZE));
}
// Nachbarn inklusive Diagonale
export function around(cell) {
  const r = Math.floor(cell / SIZE), c = cell % SIZE, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if ((dr || dc) && rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
  }
  return out;
}
// Prüft eine ganze Flotte: [{ cell, horizontal }] in der Reihenfolge der Flotte → [{ size, cells }] oder Fehler
export function buildFleet(list, fleet, touch) {
  if (!Array.isArray(list) || list.length !== fleet.length) throw new Error(`Bitte alle ${fleet.length} Schiffe setzen`);
  const taken = new Map(); // Zelle → Schiff
  const ships = fleet.map((size, k) => {
    const cells = shipCells(Number(list[k]?.cell), size, !!list[k]?.horizontal);
    if (!cells) throw new Error(`${SHIP_NAME[size]} passt nicht aufs Meer`);
    return { size, cells };
  });
  ships.forEach((s, k) => s.cells.forEach((c) => {
    if (taken.has(c)) throw new Error('Schiffe dürfen sich nicht überlappen');
    taken.set(c, k);
  }));
  if (!touch) {
    ships.forEach((s, k) => s.cells.forEach((c) => around(c).forEach((n) => {
      if (taken.has(n) && taken.get(n) !== k) throw new Error('Schiffe dürfen sich nicht berühren – auch nicht über Eck');
    })));
  }
  return ships;
}
// Zufällige gültige Flotte (Bots, „Zufällig verteilen“ im Browser macht dasselbe)
export function randomFleet(fleet, touch, rng = Math.random) {
  for (let tries = 0; tries < 500; tries++) {
    const list = [];
    let ok = true;
    for (const size of fleet) {
      let placed = false;
      for (let k = 0; k < 200 && !placed; k++) {
        const cand = { cell: Math.floor(rng() * SIZE * SIZE), horizontal: rng() < 0.5 };
        try { buildFleet([...list, cand], fleet.slice(0, list.length + 1), touch); list.push(cand); placed = true; } catch { /* nächster Versuch */ }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return list;
  }
  throw new Error('Keine Aufstellung gefunden');
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'classic', label: 'Klassische Flotte: 1× 5, 2× 4, 3× 3, 4× 2', type: 'bool' },
    { key: 'touch', label: 'Schiffe dürfen sich berühren', type: 'bool' },
    { key: 'again', label: 'Treffer: nochmal schießen', type: 'bool' },
    { key: 'turnTime', label: 'Zeit pro Schuss in Sekunden (0 = ohne)', type: 'number', min: 0, max: 300 },
  ];
  defaultSettings() { return { classic: false, touch: false, again: false, turnTime: 60 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 2, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.reset();
  }
  reset() {
    this.step = 'place';     // place | shoot
    this.ships = {};         // ID → [{ size, cells }] – geheim
    this.ready = new Set();
    this.shots = {};         // ID → { Zelle: 'hit' | 'miss' } – Schüsse DIESES Spielers aufs gegnerische Meer
    this.sunk = {};          // ID → [Schiffsindex] – versenkte Schiffe DIESES Spielers
  }
  fleet() { return this.settings.classic ? FLEETS.classic : FLEETS.standard; }
  validateStart(ids) { if (ids.length !== 2) throw new Error('Schiffe versenken spielen genau zwei'); }
  setupRound() {
    this.reset();
    for (const id of this.order) { this.shots[id] = {}; this.sunk[id] = []; }
  }
  // Beim Setzen ist niemand „dran“ – für die Plattform zählt, wer noch nicht fertig ist
  get currentId() {
    if (this.phase === 'playing' && this.step === 'place') return this.order.find((p) => !this.ready.has(p)) ?? null;
    return super.currentId;
  }
  timerActive() { return this.step === 'shoot'; }
  other(id) { return this.order.find((p) => p !== id); }

  // ---------- Setzen ----------
  place(id, list) {
    if (this.phase !== 'playing' || this.step !== 'place') throw new Error('Gerade wird nicht gesetzt');
    if (!this.order.includes(id)) throw new Error('Du spielst nicht mit');
    if (this.ready.has(id)) throw new Error('Deine Flotte steht schon');
    this.ships[id] = buildFleet(list, this.fleet(), this.settings.touch);
    this.ready.add(id);
    this.say(`${this.name(id)} ist bereit`, 'info', 'action');
    this.act(id, 'bereit');
    if (this.order.every((p) => this.ready.has(p))) {
      this.step = 'shoot';
      this.turn = 0;
      this.say(`Alle Schiffe gesetzt – ${this.name(this.order[0])} schießt zuerst`, 'cards');
      this.moveNo++;
    }
  }
  // Doch noch umstellen, solange der andere nicht fertig ist
  unplace(id) {
    if (this.phase !== 'playing' || this.step !== 'place' || !this.ready.has(id)) throw new Error('Gerade nicht möglich');
    this.ready.delete(id);
    delete this.ships[id];
    this.say(`${this.name(id)} stellt nochmal um`, 'info', 'action');
  }

  // ---------- Schießen ----------
  shoot(id, cell) {
    this.requireTurn(id);
    if (this.step !== 'shoot') throw new Error('Erst müssen alle ihre Schiffe setzen');
    cell = Number(cell);
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE) throw new Error('Dieses Feld gibt es nicht');
    if (this.shots[id][cell]) throw new Error('Da hast du schon hingeschossen');
    const foe = this.other(id);
    const k = this.ships[foe].findIndex((s) => s.cells.includes(cell));
    if (k < 0) {
      this.shots[id][cell] = 'miss';
      this.say(`${this.name(id)}: ${cellName(cell)} – Wasser`, 'info', 'action');
      this.act(id, `${cellName(cell)} Wasser`);
      return this.next(1);
    }
    this.shots[id][cell] = 'hit';
    const ship = this.ships[foe][k];
    if (ship.cells.every((c) => this.shots[id][c] === 'hit')) {
      this.sunk[id].push(k);
      this.say(`${this.name(id)}: ${cellName(cell)} – ${SHIP_NAME[ship.size]} versenkt!`, 'react');
      this.act(id, `${cellName(cell)} versenkt!`);
      if (this.sunk[id].length === this.ships[foe].length) {
        return this.finishRound([id], `${this.name(id)} versenkt die ganze Flotte und gewinnt!`, { [id]: 1 });
      }
    } else {
      this.say(`${this.name(id)}: ${cellName(cell)} – Treffer`, 'info', 'action');
      this.act(id, `${cellName(cell)} Treffer`);
    }
    if (!this.settings.again) this.next(1);
  }
  // Zeit abgelaufen: zufällig auf ein freies Feld
  onTimeout(id) {
    if (this.step !== 'shoot' || !id) return;
    const free = [...Array(SIZE * SIZE).keys()].filter((c) => !this.shots[id][c]);
    this.say(`${this.name(id)} war zu langsam – es wird zufällig geschossen`, 'warn');
    this.shoot(id, free[Math.floor(Math.random() * free.length)]);
  }

  publicPlayer(p) {
    const foe = this.other(p.id);
    return {
      ready: this.ready.has(p.id),
      // Wie viele eigene Schiffe noch schwimmen (sieht jeder – versenkt wird ja angesagt)
      afloat: this.ships[p.id] && foe ? this.ships[p.id].length - (this.sunk[foe]?.length || 0) : null,
    };
  }

  // Das Meer eines Spielers aus Sicht von viewer: Schüsse des Gegners darauf, versenkte Schiffe – die Schiffe selbst nur für den Besitzer oder nach Spielende
  sea(owner, viewer) {
    const foe = this.other(owner);
    const reveal = viewer === owner || this.phase === 'over';
    return {
      shots: foe ? { ...this.shots[foe] } : {},
      sunk: foe ? (this.sunk[foe] || []).map((k) => ({ ...this.ships[owner][k], cells: [...this.ships[owner][k].cells] })) : [],
      ships: reveal && this.ships[owner] ? this.ships[owner].map((s) => ({ size: s.size, cells: [...s.cells] })) : null,
      ready: this.ready.has(owner),
    };
  }

  gameView(viewerId) {
    return {
      step: this.step, fleet: this.fleet(), size: SIZE,
      seas: Object.fromEntries(this.order.map((id) => [id, this.sea(id, viewerId)])),
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
