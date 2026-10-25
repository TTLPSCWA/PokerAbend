// Spielmodul Schocken (drei Würfel, 13 Deckel; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'schocken',
  name: 'Schocken',
  description: 'Drei Würfel, bis zu drei Würfe, 13 Deckel. Wer am Ende alle Deckel hat, verliert die Halbzeit.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–8 Spieler',
  createFields: [],
  events: {
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 3).map(Number) : []),
    stop: (room, p) => room.stop(p.id),
    sixes: (room, p) => room.turnSixes(p.id),
  },
});
