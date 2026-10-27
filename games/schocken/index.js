// Spielmodul Schocken (drei Würfel, 13 Deckel; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'schocken',
  name: 'Schocken',
  description: 'Drei Würfel, bis zu drei Würfe, 13 Deckel. Wer am Ende alle Deckel hat, verliert die Halbzeit.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 8, duration: 10, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: dice([{ x: 6, y: 24, n: 1, rot: -8 }, { x: 24, y: 20, n: 1, rot: 6 }, { x: 40, y: 26, n: 6, rot: -4 }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–8 Spieler',
  createFields: [],
  events: {
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 3).map(Number) : []),
    stop: (room, p) => room.stop(p.id),
    sixes: (room, p) => room.turnSixes(p.id),
  },
});
