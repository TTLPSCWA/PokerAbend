// Spielmodul Blackjack – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { cardsChip } from '../art-kit.js';

export default turnGame(Room, {
  id: 'blackjack',
  name: 'Blackjack',
  description: 'Gegen den Dealer: so nah wie möglich an 21, ohne drüber. Karte, Stehen, Verdoppeln, Teilen – Blackjack zahlt 3:2.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 1, maxPlayers: 7, duration: 20, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: cardsChip({ kind: 'dot', color: '#1A1A1A' }, { kind: 'heart' }, '#1C7A43'), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '1–7 Spieler',
  createFields: [
    { key: 'startStack', label: 'Startchips', type: 'number', min: 100, step: 100, value: 1000 },
    { key: 'minBet', label: 'Mindesteinsatz', type: 'number', min: 1, value: 10 },
    { key: 'maxBet', label: 'Höchsteinsatz', type: 'number', min: 1, value: 500 },
  ],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet jede Hand – gespielt wird gegen den Dealer.',
  events: {
    bet: (room, p, { amount }) => room.bet(p.id, amount),
    sitOut: (room, p) => room.sitOut(p.id),
    dealNow: (room, p) => room.dealNow(p.id),
    insure: (room, p, { yes }) => room.insure(p.id, !!yes),
    hit: (room, p) => room.hit(p.id),
    stay: (room, p) => room.stay(p.id),
    double: (room, p) => room.double(p.id),
    split: (room, p) => room.split(p.id),
    rebuy: (room, p) => room.rebuy(p.id),
  },
});
