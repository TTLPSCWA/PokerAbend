// Spielmodul Dame – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { checkers } from '../art-kit.js';

export default turnGame(Room, {
  id: 'dame',
  name: 'Dame',
  description: 'Deutsche Dame auf dem 8×8-Brett: schlagen, bis nichts mehr geht.',
  category: 'brett',
  minPlayers: 2, maxPlayers: 2, duration: 20,
  art: checkers(),
  players: '2 Spieler (weitere schauen zu)',
  createFields: [{ key: 'turnTime', label: 'Sekunden pro Zug (0 = ohne)', type: 'number', min: 0, value: 90 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – genau zwei. Der Host startet die Partie.',
  events: {
    move: (room, p, { from, to }) => room.move(p.id, from, to),
  },
});
