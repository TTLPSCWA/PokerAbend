// Spielmodul Mogeln (Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

const cards = (v) => (Array.isArray(v) ? v.slice(0, 4).map((c) => String(c ?? '').slice(0, 2)) : []);

export default turnGame(Room, {
  id: 'mogeln',
  name: 'Mogeln',
  description: 'Karten verdeckt ablegen, den Wert ansagen – und hoffen, dass niemand die Lüge durchschaut.',
  category: 'karten',
  minPlayers: 3, maxPlayers: 8, duration: 15,
  art: fan([{ fill: '#1F57C3', kind: 'bars', color: '#F7F3E8' }, { fill: '#1F57C3', kind: 'bars', color: '#F7F3E8' }, { fill: '#F7F3E8', kind: 'diamond' }]),
  players: '3–8 Spieler',
  createFields: [{ key: 'maxCards', label: 'Karten pro Zug (höchstens)', type: 'number', min: 1, value: 4 }],
  events: {
    play: (room, p, { cards: c }) => room.play(p.id, cards(c)),
    call: (room, p) => room.call(p.id),
  },
});
