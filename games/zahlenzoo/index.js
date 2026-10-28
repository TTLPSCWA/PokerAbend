// Spielmodul Zahlenzoo – Regeln in public/games/zahlenzoo/logic.js, Ablauf in games/solo-room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { glyph } from '../art-kit.js';

export default turnGame(Room, {
  id: 'zahlenzoo',
  name: 'Zahlenzoo',
  description: 'Tiere huschen über das Bild – wer sie am besten zählt und verrechnet, gewinnt.',
  category: 'party',
  minPlayers: 2, maxPlayers: 8, duration: 5,
  art: glyph('paw', '#1C7A43'),
  players: '2–8 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden', type: 'number', min: 1, max: 30, value: 6 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Alle spielen gleichzeitig dieselbe Runde, der Host startet die Partie.',
  events: {
    ...partyEvents,
    solo: (room, p, { payload }) => room.submit(p.id, payload),
  },
});
