// Spielmodul Mühle – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'muehle',
  name: 'Mühle',
  description: 'Je 9 Steine setzen, ziehen, springen: Wer drei in einer Reihe hat, nimmt dem anderen einen Stein.',
  category: 'brett', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2 Spieler (weitere schauen zu)',
  createFields: [{ key: 'turnTime', label: 'Sekunden pro Zug (0 = ohne)', type: 'number', min: 0, value: 60 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – genau zwei. Der Host startet die Partie.',
  events: {
    place: (room, p, { point }) => room.place(p.id, point),
    move: (room, p, { from, to }) => room.move(p.id, from, to),
    capture: (room, p, { point }) => room.capture(p.id, point),
  },
});
