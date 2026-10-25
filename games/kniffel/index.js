// Spielmodul Kniffel – Regeln in room.js
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'kniffel',
  name: 'Kniffel',
  description: 'Fünf Würfel, drei Würfe, 13 Felder: Pasch, Full House, Straßen, Kniffel. Die höchste Summe gewinnt.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '1–6 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – allein geht auch. Der Host startet das Spiel.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 5) : []),
    score: (room, p, { field }) => room.score(p.id, String(field ?? '').slice(0, 20)),
  },
};
