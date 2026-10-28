// Mogeln – Karten verdeckt ablegen und den Wert ansagen (Bluffspiel) für 3–8.
// 52 Karten werden ganz verteilt. Reihum wird in fester Folge angesagt: Ass, 2, 3 … Dame, König, wieder Ass.
// Wer dran ist, legt 1 bis 4 Karten verdeckt ab und behauptet, es seien Karten des angesagten Werts – ob es stimmt, ist egal.
// Jeder andere darf bis zum nächsten Ablegen „Mogeln!“ rufen. Dann wird die letzte Gruppe aufgedeckt:
// war gelogen, nimmt der Lügner den ganzen Stapel auf; stimmte die Ansage, bekommt ihn der Zweifler. Wer den Stapel nimmt, fängt an.
// Wer als Erster keine Karten mehr hat und nicht durchschaut wird (der Nächste legt einfach ab, ohne zu rufen), gewinnt.
import { TurnRoom } from '../../server/turn-room.js';
import { shuffle } from '../../server/random.js';

export const CLAIM_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
export const SUITS = ['c', 'd', 'h', 's'];
export const RANK_NAME = { A: 'Asse', T: 'Zehner', J: 'Buben', Q: 'Damen', K: 'Könige' };
export const rankName = (r) => RANK_NAME[r] || `${r}er`;
export const deck52 = () => SUITS.flatMap((s) => CLAIM_RANKS.map((r) => r + s));

export class Room extends TurnRoom {
  static OPTIONS = [{ key: 'maxCards', label: 'Karten pro Zug (höchstens)', type: 'number', min: 1, max: 4 }];
  defaultSettings() { return { maxCards: 4 }; }

  constructor(code, settings, onChange) {
    super(code, settings, onChange, { minPlayers: 3, maxPlayers: 8, lowWins: false, scoreLabel: 'Siege', winPoints: 1 });
    this.resetTable();
  }
  resetTable() { this.hands = {}; this.pile = []; this.step = 0; this.last = null; this.reveal = null; }
  get need() { return CLAIM_RANKS[this.step % CLAIM_RANKS.length]; }

  setupRound() {
    this.resetTable();
    const deck = shuffle(deck52());
    for (const id of this.order) this.hands[id] = [];
    deck.forEach((c, i) => this.hands[this.order[i % this.order.length]].push(c));
    this.say(`Karten verteilt – ${this.name(this.order[0])} fängt mit den ${rankName(this.need)} an`, 'cards');
  }

  // Karten ablegen und behaupten, es seien Karten des angesagten Werts
  play(id, cards) {
    this.requireTurn(id);
    if (this.last && !this.hands[this.last.by].length) return this.win(this.last.by); // niemand hat gerufen: die letzte Gruppe war die letzte Karte
    if (!Array.isArray(cards) || !cards.length || new Set(cards).size !== cards.length) throw new Error('Wähl 1 bis 4 verschiedene Karten');
    if (cards.length > this.settings.maxCards) throw new Error(`Höchstens ${this.settings.maxCards} Karte${this.settings.maxCards === 1 ? '' : 'n'} pro Zug`);
    const hand = this.hands[id];
    if (!cards.every((c) => hand.includes(c))) throw new Error('Diese Karten hast du nicht');
    this.hands[id] = hand.filter((c) => !cards.includes(c));
    this.pile.push(...cards);
    this.last = { by: id, cards: [...cards], count: cards.length, rank: this.need };
    this.step++;
    this.reveal = null;
    this.say(`${this.name(id)} legt ${cards.length} Karte${cards.length === 1 ? '' : 'n'} ab: „${cards.length} × ${rankName(this.last.rank)}“`, 'info', 'action');
    this.act(id, `${cards.length} × ${rankName(this.last.rank)}`);
    this.next(1);
  }

  // „Mogeln!“: die letzte Gruppe aufdecken. Darf jeder außer dem, der sie gelegt hat
  call(id) {
    if (this.phase !== 'playing' || !this.order.includes(id)) throw new Error('Du spielst gerade nicht mit');
    if (!this.last) throw new Error('Es liegt noch nichts zum Anzweifeln da');
    if (this.last.by === id) throw new Error('Das ist deine eigene Ansage');
    const L = this.last;
    const truth = L.cards.every((c) => c[0] === L.rank);
    const taker = truth ? id : L.by;
    this.reveal = { caller: id, by: L.by, cards: [...L.cards], rank: L.rank, truth, taker };
    this.say(`${this.name(id)} ruft „Mogeln!“ – aufgedeckt: ${L.cards.length} × ${rankName(L.rank)} ${truth ? 'stimmte' : 'war gelogen'}, ${this.name(taker)} nimmt den Stapel (${this.pile.length})`, truth ? 'info' : 'win');
    this.act(id, 'Mogeln!');
    this.act(L.by, truth ? 'stimmte' : 'gelogen');
    this.hands[taker].push(...this.pile);
    this.pile = [];
    this.last = null;
    if (truth && !this.hands[L.by].length) return this.win(L.by);
    this.turn = this.order.indexOf(taker);
    this.onTurnStart();
  }

  win(id) { this.finishRound([id], `${this.name(id)} ist alle Karten los und gewinnt`, { [id]: 1 }); }

  onDropOut(p) {
    this.pile.unshift(...(this.hands[p.id] || [])); // Karten bleiben im Spiel: unter den Stapel
    delete this.hands[p.id];
    if (this.last?.by === p.id) this.last = null;
  }

  publicPlayer(p) { return { cards: this.hands[p.id]?.length ?? 0 }; }

  gameView(viewerId) {
    const mine = this.hands[viewerId];
    return {
      need: this.need, pile: this.pile.length,
      last: this.last ? { by: this.last.by, count: this.last.count, rank: this.last.rank } : null, // was gelegt wurde, bleibt verdeckt
      reveal: this.reveal, // nach dem Rufen offen für alle
      hand: mine ? [...mine] : null,
      canCall: !!this.last && this.order.includes(viewerId) && this.last.by !== viewerId && this.phase === 'playing',
      maxCards: this.settings.maxCards,
    };
  }

  static restore(data, onChange) { return TurnRoom.restoreInto(new this(data.code, data.settings, onChange), data); }
}
