// Spielmodul Skip-Bo (interne ID bleibt „stapelrennen“; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

const from = (f) => ({ kind: ['hand', 'stock', 'pile'].includes(f?.kind) ? f.kind : '', index: Number(f?.index) || 0 });

export default turnGame(Room, {
  id: 'stapelrennen',
  name: 'Skip-Bo',
  description: 'Reihen von 1 bis 12 bauen, Joker helfen. Wer zuerst seinen eigenen Stapel los ist, gewinnt.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–6 Spieler',
  createFields: [{ key: 'stockSize', label: 'Karten im eigenen Stapel', type: 'number', min: 5, value: 20 }],
  events: {
    play: (room, p, { from: f, to }) => room.play(p.id, from(f), to),
    discard: (room, p, { index, pile }) => room.throwAway(p.id, index, pile),
    pass: (room, p) => room.pass(p.id),
  },
});
