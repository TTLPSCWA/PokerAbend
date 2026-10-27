// Spielmodul Mensch ärgere Dich nicht (interne ID bleibt „huetchen“; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { pawns } from '../art-kit.js';

export default turnGame(Room, {
  id: 'huetchen',
  name: 'Mensch ärgere Dich nicht',
  description: 'Würfeln, rauskommen mit der 6, andere rauswerfen. Wer zuerst alle vier Figuren im Ziel hat, gewinnt.',
  category: 'brett', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 4, duration: 30, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: pawns(), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–4 Spieler',
  createFields: [],
  events: {
    roll: (room, p) => room.throwDice(p.id),
    move: (room, p, { piece }) => room.move(p.id, piece),
  },
});
