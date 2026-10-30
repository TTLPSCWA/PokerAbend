// Spielmodul Kniffel – Regeln in room.js
import { Room } from './room.js';
import { TripleRoom } from './triple.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'kniffel',
  variantRooms: { triple: TripleRoom },
  name: 'Kniffel',
  description: 'Fünf Würfel, drei Würfe, 13 Felder: Pasch, Full House, Straßen, Kniffel. Die höchste Summe gewinnt.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 1, maxPlayers: 6, duration: 25, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: dice([{ x: 6, y: 10, n: 5, rot: -10 }, { x: 36, y: 8, n: 6, rot: 12 }, { x: 20, y: 36, n: 3, rot: 4 }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '1–6 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – allein geht auch. Der Host startet das Spiel.',
  events: {
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 5) : []),
    score: (room, p, { field, column }) => room.score(p.id, String(field ?? '').slice(0, 20), column === undefined ? 0 : Number(column)),
  },
});
