// Spielmodul Tickendes Paket – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';

export default turnGame(Room, {
  id: 'tickendes-paket',
  name: 'Tickendes Paket',
  description: 'Ein tickendes Paket wandert von Hand zu Hand – wer es hält, wenn es platzt, verliert.',
  category: 'party',
  minPlayers: 3, maxPlayers: 8, duration: 10,
  art: glyph('bomb', '#7A5238'),
  players: '3–8 Spieler',
  createFields: [{ key: 'rounds', label: 'Anzahl Runden (Pakete)', type: 'number', min: 1, max: 20, value: 5 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Partie.',
  events: {
    answer: (room, p, { text }) => room.answer(p.id, typeof text === 'string' ? text.slice(0, 80) : ''),
  },
});
