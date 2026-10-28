// Spielmodul Präsident (Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

const cards = (v) => (Array.isArray(v) ? v.slice(0, 4).map((c) => String(c ?? '').slice(0, 2)) : []);

export default turnGame(Room, {
  id: 'praesident',
  name: 'Präsident',
  description: 'Wer zuerst alle Karten los ist, wird Präsident – wer zuletzt übrig bleibt, hat das Nachsehen.',
  category: 'karten',
  minPlayers: 3, maxPlayers: 8, duration: 20,
  art: fan([{ fill: '#F7F3E8', kind: 'bars', color: '#C99A45' }, { fill: '#F7F3E8', kind: 'diamond' }, { fill: '#F7F3E8', kind: 'dot', color: '#1A1A1A' }]),
  players: '3–8 Spieler',
  createFields: [],
  events: {
    play: (room, p, { cards: c }) => room.play(p.id, cards(c)),
    pass: (room, p) => room.pass(p.id),
  },
});
