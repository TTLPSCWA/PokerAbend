// Geplante Spiele: erscheinen auf der Startseite ausgegraut mit der Plakette „In Planung“ (ohne Hosten-Button).
// Ist ein Spiel fertig, kommt es nach games/<id>/ und fliegt hier raus.
import { bubbles } from './art-kit.js';

export const PLANNED = [
  { id: 'schlagfertig', name: 'Schlagfertig', description: 'Lustige Aufgaben, zwei Antworten, alle stimmen ab, wer die bessere hatte.', category: 'party', minPlayers: 3, maxPlayers: 8, duration: 20, art: bubbles() },
  { id: 'werhatdasgesagt', name: 'Wer hat das gesagt?', description: 'Persönliche Fragen anonym beantworten – und raten, von wem welche Antwort kommt.', category: 'party', minPlayers: 3, maxPlayers: 10, duration: 15, art: bubbles() },
];
