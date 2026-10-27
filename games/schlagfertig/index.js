// Spielmodul Schlagfertig – Regeln in room.js, Aufgaben in aufgaben.json
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { bubbles } from '../art-kit.js';

export default turnGame(Room, {
  id: 'schlagfertig',
  name: 'Schlagfertig',
  description: 'Lustige Aufgaben, zwei Antworten, alle stimmen ab, wer die bessere hatte.',
  category: 'party', // Karten, Würfel, Brett oder Party – gruppiert die Startseite
  minPlayers: 3, maxPlayers: 8, duration: 20, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: bubbles(), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '3–8 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden (die letzte ist das Finale)', type: 'number', min: 1, max: 30, value: 3 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – mindestens drei. Der Host startet die Partie und kann im Host-Menü eigene Aufgaben ergänzen.',
  events: {
    ...partyEvents,
    answer: (room, p, { task, text }) => room.answer(p.id, Number(task), typeof text === 'string' ? text : ''),
    vote: (room, p, { choice }) => room.vote(p.id, choice),
  },
});
