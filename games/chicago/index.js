// Spielmodul Chicago – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'chicago',
  name: 'Chicago',
  description: 'Elf Runden, zwei Würfel: Wer die Rundenzahl trifft, sammelt Punkte.',
  category: 'wuerfel',
  minPlayers: 2, maxPlayers: 6, duration: 15,
  art: dice([{ x: 10, y: 22, n: 6, s: 20, rot: -10 }, { x: 34, y: 20, n: 6, s: 20, rot: 8 }]),
  players: '2–6 Spieler',
  createFields: [],
  events: {
    throw: (room, p) => room.throwDice(p.id),
  },
});
