// Spielmodul Wer hat das gesagt? – Regeln in room.js, Fragen in fragen.json
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { bubbles } from '../art-kit.js';

export default turnGame(Room, {
  id: 'werhatdasgesagt',
  name: 'Wer hat das gesagt?',
  description: 'Persönliche Fragen anonym beantworten – und raten, von wem welche Antwort kommt.',
  category: 'party', // Karten, Würfel, Brett oder Party – gruppiert die Startseite
  minPlayers: 3, maxPlayers: 10, duration: 15, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: bubbles(), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '3–10 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden (Fragen)', type: 'number', min: 1, max: 30, value: 5 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – mindestens drei. Der Host startet die Partie und kann im Host-Menü eigene Fragen ergänzen.',
  events: {
    ...partyEvents,
    answer: (room, p, { text }) => room.answer(p.id, typeof text === 'string' ? text : ''),
    guess: (room, p, { target }) => room.guess(p.id, String(target ?? '').slice(0, 40)),
  },
});
