// Spielmodul Zehntausend – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'zehntausend',
  name: 'Zehntausend',
  description: 'Sechs Würfel: Einser, Fünfer und Päsche herauslegen, weiterzocken oder anschreiben. Wer zuerst 10.000 hat, gewinnt.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–8 Spieler',
  createFields: [{ key: 'target', label: 'Zielpunktzahl', type: 'number', min: 1000, step: 1000, value: 10000 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet das Spiel.',
  events: {
    roll: (room, p) => room.throwDice(p.id),
    take: (room, p, { dice }) => room.take(p.id, Array.isArray(dice) ? dice.slice(0, 6) : []),
    bank: (room, p) => room.bank(p.id),
  },
});
