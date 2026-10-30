// Phase 10 – Kartenspiel über zehn Phasen (interne ID bleibt „zehnetappen“). Hausregeln:
// 108 Karten: 1–12 in vier Farben (je zweimal), 8 Joker, 4 Aussetzen. Jeder bekommt 10 Karten.
// Zug: eine Karte ziehen (Stapel oder oberste Ablage, aber kein Aussetzen), dann evtl. die eigene Phase auslegen,
// nach dem Auslegen auch an beliebige ausgelegte Gruppen anlegen, zum Schluss eine Karte abwerfen.
// Aussetzen abwerfen: ein Mitspieler deiner Wahl setzt einmal aus. Joker ersetzen jede Karte.
// Die Mengen der Phasen sind Mindestangaben (Standard): Eine Gruppe darf mehr Karten haben, z. B. eine 6er-Folge statt einer 4er-Folge. Hausregel: nur genau die verlangte Anzahl.
// Joker in Auslagen sind fest: Beim Auslegen oder Anlegen bekommt jeder Joker einen Wert (Zahl, bei „eine Farbe“ die Farbe) und bleibt für immer liegen.
// Die Runde endet, wenn jemand keine Karten mehr hat. Wer seine Phase ausgelegt hat, ist in der nächsten Runde eine weiter.
// Strafpunkte für Restkarten: 1–9 = 5, 10–12 = 10, Aussetzen = 15, Joker = 25.
// Wer zuerst Phase 10 schafft, gewinnt das Spiel (bei Gleichstand wenig Strafpunkte). Danach geht es wieder bei Phase 1 los.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const COLORS = ['r', 'g', 'b', 'y'];
const SORT = [...COLORS, 'j', 's'];
// [Art, Anzahl]: set = gleiche Zahl, run = Folge, color = eine Farbe
export const PHASES = [null,
  [['set', 3], ['set', 3]], [['set', 3], ['run', 4]], [['set', 4], ['run', 4]], [['run', 7]], [['run', 8]],
  [['run', 9]], [['set', 4], ['set', 4]], [['color', 7]], [['set', 5], ['set', 2]], [['set', 5], ['set', 3]],
];
const WORD = { set: { 2: 'Zwilling', 3: 'Drilling', 4: 'Vierling', 5: 'Fünfling' }, run: (n) => `${n}er-Folge`, color: (n) => `${n} einer Farbe` };
export function phaseText(n) {
  if (n > 10) return 'alle geschafft';
  const parts = PHASES[n].map(([t, k]) => (t === 'set' ? WORD.set[k] : WORD[t](k)));
  return parts.length === 2 && parts[0] === parts[1] ? `2 ${parts[0].replace(/ling$/, 'linge')}` : parts.join(' + ');
}
export const cardPoints = (c) => (c.c === 'j' ? 25 : c.c === 's' ? 15 : c.n >= 10 ? 10 : 5);

// Passen die Karten als Gruppe dieser Art? (Joker füllen Lücken)
export function validGroup(type, cards) {
  if (cards.some((c) => c.c === 's')) return false;
  const nat = cards.filter((c) => c.c !== 'j');
  if (!nat.length) return false; // mindestens eine echte Karte, sonst hätte der Joker keinen Wert
  if (type === 'set') return new Set(nat.map((c) => c.n)).size <= 1;
  if (type === 'color') return new Set(nat.map((c) => c.c)).size <= 1;
  if (cards.length > 12) return false;
  const ns = nat.map((c) => c.n);
  if (new Set(ns).size !== ns.length) return false;
  return Math.max(...ns) - Math.min(...ns) + 1 <= cards.length;
}

// Ausgewählte Karten in die Gruppen der Phase aufteilen – oder null
export function partition(cards, groups) {
  if (cards.length !== groups.reduce((a, [, k]) => a + k, 0)) return null;
  const go = (rest, gi) => {
    if (gi === groups.length) return [];
    const [type, k] = groups[gi];
    const pick = (start, chosen) => {
      if (chosen.length === k) {
        if (!validGroup(type, chosen)) return null;
        const after = go(rest.filter((c) => !chosen.includes(c)), gi + 1);
        return after && [{ type, cards: chosen }, ...after];
      }
      for (let i = start; i <= rest.length - (k - chosen.length); i++) {
        const r = pick(i + 1, [...chosen, rest[i]]);
        if (r) return r;
      }
      return null;
    };
    return pick(0, []);
  };
  return go(cards, 0);
}

// Wie partition, aber Gruppen dürfen größer sein als verlangt (Option „nicht genau“)
export function partitionMin(cards, groups) {
  if (cards.length < groups.reduce((a, [, k]) => a + k, 0)) return null;
  if (groups.length === 1) { const [type, k] = groups[0]; return cards.length >= k && validGroup(type, cards) ? [{ type, cards }] : null; }
  // Zwei Gruppen: jede Karte kommt in Gruppe 1 oder 2 (bei ≤ 12 Karten höchstens 4096 Möglichkeiten)
  if (cards.length > 12) return null;
  const [[t1, k1], [t2, k2]] = groups;
  for (let mask = 0; mask < 1 << cards.length; mask++) {
    const a = cards.filter((_, i) => mask & (1 << i));
    const b = cards.filter((_, i) => !(mask & (1 << i)));
    if (a.length >= k1 && b.length >= k2 && validGroup(t1, a) && validGroup(t2, b)) return [{ type: t1, cards: a }, { type: t2, cards: b }];
  }
  return null;
}

// Joker in einer Auslage bekommen beim Auslegen einen festen Wert: eine Folge zählt aufsteigend von unten, Lücken füllen die Joker,
// übrige Joker verlängern nach oben (bis 12), dann nach unten. Bei „gleiche Zahl“ ist es die Zahl, bei „eine Farbe“ die Farbe.
// Ergebnis: { type, cards (Folge aufsteigend), vals (Wert je Karte: Zahl oder Farbe) } – oder null, wenn die Karten keine Gruppe ergeben.
export function fixGroup(type, cards) {
  if (!validGroup(type, cards)) return null;
  const nat = cards.filter((c) => c.c !== 'j');
  const jokers = cards.filter((c) => c.c === 'j');
  if (type === 'set') return { type, cards: [...nat, ...jokers], vals: cards.map(() => nat[0].n) };
  if (type === 'color') return { type, cards: [...nat, ...jokers], vals: cards.map(() => nat[0].c) };
  const sorted = [...nat].sort((x, y) => x.n - y.n);
  const out = [], vals = [];
  const spare = [...jokers];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]); vals.push(sorted[i].n);
    if (i < sorted.length - 1) for (let v = sorted[i].n + 1; v < sorted[i + 1].n; v++) { out.push(spare.pop()); vals.push(v); }
  }
  let hi = vals[vals.length - 1], lo = vals[0];
  while (spare.length && hi < 12) { out.push(spare.pop()); vals.push(++hi); }
  while (spare.length && lo > 1) { out.unshift(spare.pop()); vals.unshift(--lo); }
  return spare.length ? null : { type, cards: out, vals };
}
// Passt die Karte an diese ausgelegte Gruppe? Gibt die Seite zurück ('high' | 'low' | 'set') oder null. Joker nehmen den Wert, den die Stelle verlangt.
export function hitSide(group, card, end = null) {
  if (card.c === 's') return null;
  if (group.type === 'set') return card.c === 'j' || card.n === group.vals[0] ? 'set' : null;
  if (group.type === 'color') return card.c === 'j' || card.c === group.vals[0] ? 'set' : null;
  const lo = group.vals[0], hi = group.vals[group.vals.length - 1];
  if (card.c !== 'j') return card.n === hi + 1 && hi < 12 ? 'high' : card.n === lo - 1 && lo > 1 ? 'low' : null;
  const can = { high: hi < 12, low: lo > 1 };
  if (end === 'high' || end === 'low') return can[end] ? end : null;
  return can.high ? 'high' : can.low ? 'low' : null;
}

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'skipChoose', label: 'Aussetzen: Spieler frei wählen (sonst setzt der Nächste aus)', type: 'bool' },
    { key: 'exactSize', label: 'Phase nur mit genauer Kartenanzahl auslegen', type: 'bool' },
    { key: 'firstSkip', label: 'Aussetzen als erste Ablage: der Erste setzt aus', type: 'bool' },
  ];
  defaultSettings() { return { skipChoose: true, exactSize: false, firstSkip: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.progress = {}; this.penalty = {}; this.gameOver = false;
    this.resetTable();
  }
  resetTable() { this.deck = []; this.discard = []; this.hands = {}; this.laid = {}; this.done = new Set(); this.skip = new Set(); this.step = 'draw'; }
  resetGame() { this.progress = {}; this.penalty = {}; this.gameOver = false; }
  saveExtra() { return { progress: this.progress, penalty: this.penalty }; }
  loadExtra(x) { this.progress = x.progress || {}; this.penalty = x.penalty || {}; }
  phaseOf(id) { return this.progress[id] || 1; }
  partner(id) { const seats = this.seats; return this.variant === 'team' && seats.includes(id) ? seats[(seats.indexOf(id) + 2) % 4] : null; }
  validateStart(ids) { if (this.variant === 'team' && ids.length !== 4) throw new Error('Teamspiel braucht vier Spieler'); }
  get phaseLimit() { return this.variant === 'short' ? 5 : 10; }

  setupRound() {
    if (this.gameOver) this.resetGame();
    this.resetTable();
    let k = 0;
    const deck = [];
    for (const c of COLORS) for (let n = 1; n <= 12; n++) deck.push({ id: k++, c, n }, { id: k++, c, n });
    for (let i = 0; i < 8; i++) deck.push({ id: k++, c: 'j', n: 0 });
    for (let i = 0; i < 4; i++) deck.push({ id: k++, c: 's', n: 0 });
    this.deck = shuffle(deck);
    for (const id of this.order) { this.hands[id] = this.deck.splice(-10); this.laid[id] = []; }
    // Erste Ablage: kein Aussetzen
    let first = this.pickFirst();
    if (this.settings.firstSkip && first.c === 's') this.skip.add(this.order[0]); // der Erste setzt aus
    else while (first.c === 's') { this.deck.unshift(first); first = this.deck.pop(); }
    this.discard = [first];
  }

  pickFirst() { return this.deck.pop(); } // erste Ablagekarte (Tests legen sie fest)

  // Wer aussetzen muss, wird übersprungen
  onTurnStart() {
    this.step = 'draw';
    for (let k = 0; k < this.order.length && this.skip.has(this.currentId); k++) {
      this.skip.delete(this.currentId);
      this.say(`${this.name(this.currentId)} setzt aus`);
      this.act(this.currentId, 'setzt aus');
      const n = this.order.length;
      this.turn = (this.turn + this.dir + n) % n;
    }
  }

  inHand(id, cardId) {
    const c = this.hands[id].find((x) => x.id === Number(cardId));
    if (!c) throw new Error('Die Karte hast du nicht');
    return c;
  }
  removeCards(id, cards) { this.hands[id] = this.hands[id].filter((c) => !cards.includes(c)); }

  drawCard(id, from) {
    this.requireTurn(id);
    if (this.step !== 'draw') throw new Error('Du hast schon gezogen');
    let c;
    if (from === 'discard') {
      c = this.discard[this.discard.length - 1];
      if (!c) throw new Error('Die Ablage ist leer');
      if (c.c === 's') throw new Error('Aussetzen darf man nicht aufnehmen');
      this.discard.pop();
      this.say(`${this.name(id)} nimmt von der Ablage`, 'info', 'action');
      this.act(id, 'nimmt Ablage', c);
    } else {
      if (!this.deck.length) { const top = this.discard.pop(); this.deck = shuffle(this.discard); this.discard = top ? [top] : []; }
      c = this.deck.pop();
      if (!c) throw new Error('Keine Karten mehr');
      this.say(`${this.name(id)} zieht`, 'info', 'action');
      this.act(id, 'zieht');
    }
    this.hands[id].push(c);
    this.step = 'play';
  }

  // cardIds: alle Karten der Phase; groupIds (optional): die Karten je Gruppe in der Reihenfolge der Phase – dann gilt genau diese Aufteilung,
  // sonst sucht der Server selbst eine passende.
  layPhase(id, cardIds, groupIds = null) {
    this.requireTurn(id);
    if (this.step !== 'play') throw new Error('Erst eine Karte ziehen');
    if (this.done.has(id)) throw new Error('Deine Phase liegt schon');
    const n = this.phaseOf(id);
    if (n > this.phaseLimit) throw new Error('Du hast alle Phasen geschafft');
    let cards, groups;
    if (Array.isArray(groupIds) && groupIds.length) {
      if (groupIds.length !== PHASES[n].length) throw new Error(`Das passt nicht zu Phase ${n}: ${phaseText(n)}`);
      const lists = groupIds.map((g) => [...new Set((Array.isArray(g) ? g : []).map(Number))].map((x) => this.inHand(id, x)));
      cards = lists.flat();
      if (new Set(cards.map((c) => c.id)).size !== cards.length) throw new Error('Jede Karte nur in einer Gruppe');
      groups = lists.map((cs, i) => {
        const [type, size] = PHASES[n][i];
        return (this.settings.exactSize ? cs.length === size : cs.length >= size) && validGroup(type, cs) ? { type, cards: cs } : null;
      });
      if (groups.some((g) => !g)) groups = null;
    } else {
      cards = [...new Set(cardIds.map(Number))].map((x) => this.inHand(id, x));
      groups = (this.settings.exactSize ? partition : partitionMin)(cards, PHASES[n]);
    }
    if (!groups) throw new Error(`Das passt nicht zu Phase ${n}: ${phaseText(n)}`);
    const fixed = groups.map((g) => fixGroup(g.type, g.cards));
    if (fixed.some((g) => !g)) throw new Error(`Das passt nicht zu Phase ${n}: ${phaseText(n)}`);
    this.removeCards(id, cards);
    this.laid[id] = fixed;
    this.done.add(id);
    this.say(`${this.name(id)} legt Phase ${n} aus (${phaseText(n)})`, 'win');
    this.act(id, `Phase ${n} ✓`);
    if (!this.hands[id].length) this.endRound(id);
  }

  // Ausgelegte Joker bleiben für immer liegen – es gibt kein Tauschen und kein Aufnehmen
  takeJoker() { throw new Error('Joker bleiben liegen'); }

  hit(id, cardId, owner, groupIndex, end = null) {
    this.requireTurn(id);
    if (this.step !== 'play') throw new Error('Erst eine Karte ziehen');
    if (!this.done.has(id)) throw new Error('Anlegen geht erst, wenn deine Phase liegt');
    const g = this.laid[owner]?.[Number(groupIndex)];
    if (!g) throw new Error('Diese Gruppe gibt es nicht');
    const c = this.inHand(id, cardId);
    const side = hitSide(g, c, end);
    if (!side) throw new Error('Die Karte passt nicht an diese Gruppe');
    if (side === 'low') { g.cards.unshift(c); g.vals.unshift(g.vals[0] - 1); }
    else if (side === 'high') { g.cards.push(c); g.vals.push(g.vals[g.vals.length - 1] + 1); }
    else { g.cards.push(c); g.vals.push(g.vals[0]); }
    this.removeCards(id, [c]);
    this.say(`${this.name(id)} legt an bei ${this.name(owner)}`, 'info', 'action');
    this.act(id, 'legt an');
    if (!this.hands[id].length) this.endRound(id);
  }

  throwAway(id, cardId, target) {
    this.requireTurn(id);
    if (this.step !== 'play') throw new Error('Erst eine Karte ziehen');
    const c = this.inHand(id, cardId);
    if (c.c === 's') {
      if (!this.settings.skipChoose) target = this.peek(1); // ohne Wahl: der Nächste
      if (!this.order.includes(target) || target === id) throw new Error('Wer soll aussetzen?');
      this.skip.add(target);
      this.say(`${this.name(id)} lässt ${this.name(target)} aussetzen`, 'react');
      this.act(id, `${this.name(target)} setzt aus`);
    } else { this.say(`${this.name(id)} wirft ab`, 'info', 'action'); this.act(id, 'wirft ab', c); }
    this.removeCards(id, [c]);
    this.discard.push(c);
    if (!this.hands[id].length) return this.endRound(id);
    this.next(1);
  }

  endRound(out) {
    const lines = [];
    const completed = new Set(this.order.filter((p) => this.done.has(p) && (this.variant !== 'team' || this.done.has(this.partner(p)))));
    for (const p of this.order) {
      const pts = this.hands[p].reduce((a, c) => a + cardPoints(c), 0);
      this.penalty[p] = (this.penalty[p] || 0) + pts;
      if (completed.has(p)) this.progress[p] = this.phaseOf(p) + 1;
      lines.push(`${this.name(p)}: Phase ${Math.min(this.phaseLimit, this.phaseOf(p))}${this.phaseOf(p) > this.phaseLimit ? ' geschafft' : ''}, ${this.penalty[p]} Strafpunkte`);
    }
    this.say(`${this.name(out)} ist fertig. ${lines.join(' · ')}`, 'win');
    const teamPenalty = (p) => (this.penalty[p] || 0) + (this.variant === 'team' ? this.penalty[this.partner(p)] || 0 : 0);
    const finished = this.order.filter((p) => this.phaseOf(p) > this.phaseLimit).sort((a, b) => teamPenalty(a) - teamPenalty(b));
    if (finished.length) {
      this.gameOver = true;
      const winners = this.variant === 'team' ? [finished[0], this.partner(finished[0])] : [finished[0]];
      return this.finishRound(winners, `${winners.map((p) => this.name(p)).join(' und ')} schafft alle ${this.phaseLimit} Phasen und gewinnt!`, Object.fromEntries(winners.map((p) => [p, 1])));
    }
    this.finishRound([], `Runde vorbei – ${this.name(out)} ist zuerst fertig`);
  }

  onDropOut(p) {
    if (this.variant === 'team') { const winners = this.order.filter((id) => id !== p.id && id !== this.partner(p.id)); this.finishRound(winners, 'Teamspiel durch Ausscheiden beendet', Object.fromEntries(winners.map((id) => [id, 1]))); }
    this.deck.unshift(...(this.hands[p.id] || []));
    delete this.hands[p.id];
    this.skip.delete(p.id);
  }

  publicPlayer(p) {
    return { cards: this.hands[p.id]?.length ?? 0, phase: Math.min(this.phaseLimit, this.phaseOf(p.id)), laidDone: this.done.has(p.id), penalty: this.penalty[p.id] || 0, skipped: this.skip.has(p.id), partner: this.partner(p.id) };
  }

  gameView(viewerId) {
    return {
      // Sortiert: Farben, darin aufsteigend; Joker und Aussetzen ans Ende
      hand: this.hands[viewerId] ? [...this.hands[viewerId]].sort((a, b) => SORT.indexOf(a.c) - SORT.indexOf(b.c) || a.n - b.n) : null,
      laid: Object.fromEntries(Object.entries(this.laid).map(([id, gs]) => [id, gs.map((g) => ({ type: g.type, cards: g.cards, vals: g.vals }))])),
      top: this.discard[this.discard.length - 1] ?? null, deck: this.deck.length,
      step: this.currentId === viewerId ? this.step : null,
      myPhase: this.phaseOf(viewerId), phaseText: this.phaseOf(viewerId) > this.phaseLimit ? 'alle geschafft' : phaseText(this.phaseOf(viewerId)),
      partner: this.partner(viewerId),
      // Aufbau der eigenen Phase für die Ausleg-Felder: [{ type, size }]
      myGroups: (this.phaseOf(viewerId) > this.phaseLimit ? [] : PHASES[this.phaseOf(viewerId)] || []).map(([type, size]) => ({ type, size })),
      phases: Object.fromEntries(this.order.map((id) => [id, this.phaseOf(id) > this.phaseLimit ? 'alle geschafft' : phaseText(this.phaseOf(id))])),
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
