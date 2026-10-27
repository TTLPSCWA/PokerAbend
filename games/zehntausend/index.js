// Spielmodul Zehntausend – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'zehntausend',
  name: 'Zehntausend',
  description: 'Sechs Würfel: Einser, Fünfer und Päsche herauslegen, weiterzocken oder anschreiben. Wer zuerst 10.000 hat, gewinnt.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 8, duration: 20, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: dice([{ x: 6, y: 8, n: 1, s: 18, rot: -10 }, { x: 36, y: 6, n: 5, s: 18, rot: 12 }, { x: 8, y: 36, n: 6, s: 18, rot: 6 }, { x: 36, y: 36, n: 4, s: 18, rot: -8 }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–8 Spieler',
  createFields: [{ key: 'target', label: 'Zielpunktzahl', type: 'number', min: 1000, step: 1000, value: 10000 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet das Spiel.',
  events: {
    roll: (room, p) => room.throwDice(p.id),
    take: (room, p, { dice }) => room.take(p.id, Array.isArray(dice) ? dice.slice(0, 6) : []),
    bank: (room, p) => room.bank(p.id),
  },
});
