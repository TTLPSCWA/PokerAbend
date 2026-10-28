// Spielmodul Lügenwürfel – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { dice } from '../art-kit.js';

export default turnGame(Room, {
  id: 'luegenwuerfel',
  name: 'Lügenwürfel',
  description: 'Verdeckt würfeln, Gebote über alle Würfel am Tisch abgeben und Lügen aufdecken.',
  category: 'wuerfel',
  minPlayers: 2, maxPlayers: 6, duration: 15,
  art: dice([{ x: 10, y: 20, n: 4, s: 20, rot: -8, fill: '#2A2A2A', pip: '#F7F3E8' }, { x: 34, y: 18, n: 2, s: 20, rot: 10, fill: '#2A2A2A', pip: '#F7F3E8' }]),
  players: '2–6 Spieler',
  createFields: [{ key: 'dice', label: 'Würfel pro Spieler', type: 'number', min: 2, value: 5 }],
  events: {
    bid: (room, p, { n, face }) => room.makeBid(p.id, n, face),
    doubt: (room, p) => room.doubt(p.id),
  },
});
