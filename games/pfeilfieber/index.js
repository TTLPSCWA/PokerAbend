// Spielmodul Pfeilfieber – Regeln in public/games/pfeilfieber/logic.js, Ablauf in games/solo-room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { glyph } from '../art-kit.js';

export default turnGame(Room, {
  id: 'pfeilfieber',
  name: 'Pfeilfieber',
  description: 'Pfeilmuster so schnell und fehlerfrei wie möglich nachtippen.',
  category: 'party',
  minPlayers: 2, maxPlayers: 8, duration: 5,
  art: glyph('arrows', '#1F57C3'),
  players: '2–8 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden', type: 'number', min: 1, max: 30, value: 3 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Alle spielen gleichzeitig dieselbe Runde, der Host startet die Partie.',
  events: {
    ...partyEvents,
    solo: (room, p, { payload }) => room.submit(p.id, payload),
  },
});
