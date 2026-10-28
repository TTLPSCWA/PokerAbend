// Spielmodul Würfelpoker – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'wuerfelpoker',
  name: 'Würfelpoker',
  description: 'Mit fünf Würfeln die beste Pokerhand werfen – bis zu dreimal pro Zug.',
  category: 'wuerfel',
  minPlayers: 2, maxPlayers: 6, duration: 10,
  art: dice([{ x: 4, y: 8, n: 6, s: 18, rot: -10 }, { x: 24, y: 6, n: 6, s: 18, rot: 8 }, { x: 44, y: 10, n: 6, s: 16, rot: -6 }, { x: 14, y: 36, n: 3, s: 18, rot: 6 }, { x: 36, y: 36, n: 6, s: 18, rot: -8 }]),
  players: '2–6 Spieler',
  createFields: [{ key: 'strikes', label: 'Striche bis zum Ausscheiden', type: 'number', min: 1, value: 3 }],
  events: {
    throw: (room, p, { keep }) => room.throwDice(p.id, keep),
    stop: (room, p) => room.stop(p.id),
  },
});
