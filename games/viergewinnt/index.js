// Spielmodul Vier gewinnt – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'viergewinnt',
  name: 'Vier gewinnt',
  description: 'Steine in Spalten fallen lassen – wer zuerst vier in einer Reihe hat, gewinnt.',
  category: 'brett', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2 Spieler (weitere schauen zu)',
  createFields: [{ key: 'turnTime', label: 'Sekunden pro Zug (0 = ohne)', type: 'number', min: 0, value: 60 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – genau zwei. Der Host startet die Partie.',
  events: {
    drop: (room, p, { col }) => room.drop(p.id, col),
  },
});
