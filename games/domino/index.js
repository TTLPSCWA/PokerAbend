// Spielmodul Domino – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dominoes } from '../art-kit.js';

const str = (v) => String(v ?? '').slice(0, 8);

export default turnGame(Room, {
  id: 'domino',
  name: 'Domino',
  description: 'Steine mit gleichen Augen aneinanderlegen – wer zuerst alle los ist, gewinnt die Runde.',
  category: 'brett',
  minPlayers: 2, maxPlayers: 4, duration: 15,
  art: dominoes(),
  players: '2–4 Spieler',
  createFields: [],
  events: {
    play: (room, p, { tile, side }) => room.play(p.id, str(tile), str(side)),
    draw: (room, p) => room.draw(p.id),
    pass: (room, p) => room.pass(p.id),
  },
});
