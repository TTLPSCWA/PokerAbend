// Spielmodul Schätzmeister – Regeln in room.js, Fragen in fragen.json
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';

export default turnGame(Room, {
  id: 'schaetzmeister',
  name: 'Schätzmeister',
  description: 'Alle schätzen eine Zahl – wer am nächsten dran liegt, bekommt die Punkte.',
  category: 'party', // Karten, Würfel, Brett oder Party – gruppiert die Startseite
  players: '2–12 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden (Fragen)', type: 'number', min: 1, max: 30, value: 10 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Partie und kann im Host-Menü eigene Fragen ergänzen.',
  events: {
    ...partyEvents,
    guess: (room, p, { text }) => room.guess(p.id, typeof text === 'string' || typeof text === 'number' ? text : ''),
  },
});
