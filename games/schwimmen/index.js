// Spielmodul Schwimmen (31) – Regeln in room.js
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'schwimmen',
  name: 'Schwimmen',
  description: 'Drei Karten, eine Farbe zählt: tauschen, schieben, klopfen. 31 gewinnt sofort, die Niedrigsten verlieren Leben.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–9 Spieler',
  createFields: [{ key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 2, value: 3 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet das Spiel.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    swap: (room, p, { hand, middle }) => room.swap(p.id, hand, middle),
    swapAll: (room, p) => room.swapAll(p.id),
    pass: (room, p) => room.pass(p.id),
    knock: (room, p) => room.knock(p.id),
  },
};
