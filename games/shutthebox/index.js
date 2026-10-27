// Spielmodul Shut the Box – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { flapBox } from '../art-kit.js';

export default turnGame(Room, {
  id: 'shutthebox',
  name: 'Shut the Box',
  description: 'Würfeln und Klappen schließen, die genau die Augensumme ergeben. Was offen bleibt, zählt – wenig ist gut.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 1, maxPlayers: 8, duration: 15, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: flapBox(), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '1–8 Spieler',
  createFields: [{ key: 'rounds', label: 'Runden', type: 'number', min: 1, value: 5 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – allein geht auch. Der Host startet das Spiel.',
  events: {
    roll: (room, p, { count }) => room.throwDice(p.id, count),
    close: (room, p, { flaps }) => room.close(p.id, Array.isArray(flaps) ? flaps.slice(0, 12) : []),
  },
});
