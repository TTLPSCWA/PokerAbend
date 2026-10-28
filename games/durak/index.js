// Spielmodul Durak (Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

const str = (v) => String(v ?? '').slice(0, 2);

export default turnGame(Room, {
  id: 'durak',
  name: 'Durak',
  description: 'Russisches Angriffs- und Abwehrspiel: Wer am Ende noch Karten hat, ist der Durak.',
  category: 'karten',
  minPlayers: 2, maxPlayers: 6, duration: 20,
  art: fan([{ fill: '#1F57C3' }, { fill: '#F7F3E8', kind: 'heart' }, { fill: '#F7F3E8', kind: 'dot', color: '#1A1A1A' }]),
  players: '2–6 Spieler',
  createFields: [],
  events: {
    attack: (room, p, { card }) => room.attack(p.id, str(card)),
    defend: (room, p, { card, index }) => room.defend(p.id, str(card), Math.floor(Number(index))),
    take: (room, p) => room.take(p.id),
    pass: (room, p) => room.pass(p.id),
  },
});
