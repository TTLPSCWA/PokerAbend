// Spielmodul Wer bin ich? – Regeln in room.js, Begriffe in begriffe.json
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { silhouette } from '../art-kit.js';

const str = (v, n = 160) => (typeof v === 'string' ? v.slice(0, n) : '');

export default turnGame(Room, {
  id: 'wer-bin-ich',
  name: 'Wer bin ich?',
  description: 'Alle sehen deinen Begriff auf der Stirn, nur du nicht: Rate per Ja/Nein-Fragen, wer oder was du bist.',
  category: 'party',
  minPlayers: 3, maxPlayers: 10, duration: 25,
  art: silhouette(),
  players: '3–10 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – mindestens drei. Gefragt wird per Voice (z. B. Discord), geantwortet per Knopf. Der Host stellt im Host-Menü ein, woher die Begriffe kommen.',
  events: {
    next: partyEvents.next,
    nudge: partyEvents.nudge,
    custom: partyEvents.custom,
    wbWord: (room, p, { text }) => room.word(p.id, str(text, 80)),
    wbAsk: (room, p, { text }) => room.ask(p.id, str(text, 300)),
    wbAnswer: (room, p, { answer }) => room.answer(p.id, str(answer, 10)),
    wbGuess: (room, p, { text }) => room.guess(p.id, str(text, 80)),
    wbVote: (room, p, { ok }) => room.vote(p.id, !!ok),
    wbHintAsk: (room, p) => room.hintAsk(p.id),
    wbHintWrite: (room, p, { text }) => room.hintWrite(p.id, str(text, 200)),
  },
});
