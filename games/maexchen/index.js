// Spielmodul Mäxchen (Würfeln und Bluffen; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'maexchen',
  name: 'Mäxchen',
  description: 'Verdeckt würfeln, höher ansagen, bluffen oder anzweifeln. Wer alle Leben verliert, ist raus.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–10 Spieler',
  createFields: [{ key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 1, value: 3 }],
  events: {
    roll: (room, p) => room.throwDice(p.id),
    announce: (room, p, { value }) => room.announce(p.id, value),
    doubt: (room, p) => room.doubt(p.id),
    accept: (room, p) => room.accept(p.id),
    blind: (room, p, { value }) => room.passBlind(p.id, value),
  },
});
