// Spielmodul Schwimmen (31) – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'schwimmen',
  name: 'Schwimmen',
  description: 'Drei Karten, eine Farbe zählt: tauschen, schieben, klopfen. 31 gewinnt sofort, die Niedrigsten verlieren Leben.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–9 Spieler',
  createFields: [{ key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 2, value: 3 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet das Spiel.',
  events: {
    swap: (room, p, { hand, middle }) => room.swap(p.id, hand, middle),
    swapAll: (room, p) => room.swapAll(p.id),
    pass: (room, p) => room.pass(p.id),
    knock: (room, p) => room.knock(p.id),
  },
});
