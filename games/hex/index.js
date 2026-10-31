import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { hexBoard } from '../art-kit.js';
export default turnGame(Room, {
  id: 'hex', name: 'Hex', description: 'Verbinde deine beiden Ränder auf einem Hex-Brett. Jeder Stein zählt, ein Remis gibt es nicht.', category: 'brett', minPlayers: 2, maxPlayers: 2, duration: 15, players: '2 Spieler', art: hexBoard(),
  createFields: [], events: { hexPlace: (room, p, { cell }) => room.place(p.id, cell), hexSwap: (room, p) => room.swapSides(p.id) },
});
