// Lügenwürfel – verdeckt würfeln, Gebote über alle Würfel am Tisch abgeben und Lügen aufdecken (2–6 Spieler).
// Jeder hat Würfel unter einem Becher und kennt nur seine eigenen. Reihum gibt man ein Gebot ab: „Mindestens N Würfel zeigen die Augenzahl F“
// – gemeint sind alle Würfel am Tisch. Ein neues Gebot muss höher sein: mehr Würfel, oder dieselbe Anzahl mit höherer Augenzahl.
// Statt zu bieten ruft man „Lüge!“: alle Becher werden gehoben und gezählt. Stimmte das Gebot (mindestens so viele), verliert der Zweifler einen Würfel,
// sonst der Bieter. Wer keine Würfel mehr hat, scheidet aus, der Letzte gewinnt. Wer verliert, fängt die nächste Runde an.
// Hausregel „Einsen zählen als Joker“: Einsen zählen bei jedem Gebot mit (außer bei Geboten auf Einsen).
import { TurnRoom } from '../../server/turn-room.js';
import { die } from '../../server/random.js';

export class Room extends TurnRoom {
  static OPTIONS = [
    { key: 'dice', label: 'Würfel pro Spieler', type: 'number', min: 2, max: 6 },
    { key: 'wild', label: 'Einsen zählen als Joker', type: 'bool' },
  ];
  defaultSettings() { return { dice: 5, wild: false }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 2, maxPlayers: 6, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.roll = die; // Tests würfeln selbst
    this.cups = {}; this.bid = null; this.reveal = null; this.deal = 0;
  }

  total() { return this.order.reduce((a, id) => a + (this.cups[id]?.length ?? 0), 0); }
  setupRound() {
    this.cups = Object.fromEntries(this.order.map((id) => [id, []]));
    for (const id of this.order) this.cups[id] = Array.from({ length: this.settings.dice }, () => this.roll());
    this.bid = null; this.reveal = null; this.deal = 1;
  }
  rollAll() { for (const id of this.order) this.cups[id] = Array.from({ length: this.cups[id].length }, () => this.roll()); }

  // So viele Würfel zeigen die Augenzahl face (mit Joker zählen Einsen mit)
  countOf(face) {
    let n = 0;
    for (const id of this.order) for (const d of this.cups[id]) if (d === face || (this.settings.wild && d === 1 && face !== 1)) n++;
    return n;
  }
  higher(n, face) { return !this.bid || n > this.bid.n || (n === this.bid.n && face > this.bid.face); }

  makeBid(id, n, face) {
    this.requireTurn(id);
    n = Math.floor(Number(n)); face = Math.floor(Number(face));
    if (!(face >= 1 && face <= 6)) throw new Error('Die Augenzahl geht von 1 bis 6');
    if (!(n >= 1 && n <= this.total())) throw new Error(`Es liegen nur ${this.total()} Würfel auf dem Tisch`);
    if (!this.higher(n, face)) throw new Error('Das Gebot muss höher sein: mehr Würfel oder dieselbe Anzahl mit höherer Augenzahl');
    this.bid = { by: id, n, face };
    this.reveal = null;
    this.say(`${this.name(id)} bietet: mindestens ${n} × ${face}`, 'info', 'action');
    this.act(id, `${n} × ${face}`);
    this.next(1);
  }

  doubt(id) {
    this.requireTurn(id);
    if (!this.bid) throw new Error('Es gibt noch kein Gebot');
    const B = this.bid;
    const count = this.countOf(B.face);
    const truth = count >= B.n;
    const loser = truth ? id : B.by;
    this.reveal = { doubter: id, bidder: B.by, bid: { n: B.n, face: B.face }, count, truth, loser, cups: Object.fromEntries(this.order.map((p) => [p, [...this.cups[p]]])) };
    this.say(`${this.name(id)} ruft „Lüge!“ – gezählt: ${count} × ${B.face}, geboten waren ${B.n}. ${this.name(loser)} verliert einen Würfel`, truth ? 'info' : 'win');
    this.act(id, 'Lüge!');
    this.cups[loser].pop();
    this.bid = null;
    let startIdx = this.order.indexOf(loser);
    if (!this.cups[loser].length) {
      this.say(`${this.name(loser)} hat keine Würfel mehr und scheidet aus`, 'win');
      this.order.splice(startIdx, 1);
      delete this.cups[loser];
      if (this.order.length === 1) { const w = this.order[0]; return this.finishRound([w], `${this.name(w)} gewinnt Lügenwürfel`, { [w]: 1 }); }
      if (startIdx >= this.order.length) startIdx = 0;
    }
    this.rollAll();
    this.deal++;
    this.turn = startIdx;
    this.onTurnStart();
    this.moveNo++;
  }

  onDropOut(p) { delete this.cups[p.id]; if (this.bid?.by === p.id) this.bid = null; }

  publicPlayer(p) { return { dice: this.cups[p.id]?.length ?? 0 }; }
  gameView(viewerId) {
    const mine = this.cups[viewerId];
    return {
      cup: mine ? [...mine] : null, // nur die eigenen Würfel
      bid: this.bid, total: this.total(), reveal: this.reveal, wild: this.settings.wild, deal: this.deal,
    };
  }
  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
