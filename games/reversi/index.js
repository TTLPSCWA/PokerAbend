// Spielmodul Reversi – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { reversi } from '../art-kit.js';

export default turnGame(Room, {
  id: 'reversi',
  name: 'Reversi',
  description: 'Gegnerische Steine einschließen und umdrehen – am Ende zählt, wem mehr Steine gehören.',
  category: 'brett',
  minPlayers: 2, maxPlayers: 2, duration: 15,
  art: reversi(),
  players: '2 Spieler (weitere schauen zu)',
  createFields: [{ key: 'turnTime', label: 'Sekunden pro Zug (0 = ohne)', type: 'number', min: 0, value: 60 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – genau zwei. Der Host startet die Partie.',
  events: {
    place: (room, p, { cell }) => room.place(p.id, cell),
  },
});
