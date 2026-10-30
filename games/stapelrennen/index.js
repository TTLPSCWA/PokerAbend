// Spielmodul Skip-Bo (interne ID bleibt „stapelrennen“; Regeln in room.js)
import { Room, ShortRoom } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { stairs } from '../art-kit.js';

const from = (f) => ({ kind: ['hand', 'stock', 'pile'].includes(f?.kind) ? f.kind : '', index: Number(f?.index) || 0, owner: typeof f?.owner === 'string' ? f.owner : null });

export default turnGame(Room, {
  id: 'stapelrennen',
  variantRooms: { short: ShortRoom },
  implementedVariants: ['team'],
  name: 'Skip-Bo',
  description: 'Reihen von 1 bis 12 bauen, Joker helfen. Wer zuerst seinen eigenen Stapel los ist, gewinnt.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 6, duration: 25, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: stairs(['#9DB7E8', '#7FD39A', '#F2C230']), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–6 Spieler',
  createFields: [{ key: 'stockSize', label: 'Karten im eigenen Stapel', type: 'number', min: 5, value: 20 }],
  events: {
    play: (room, p, { from: f, to }) => room.play(p.id, from(f), to),
    discard: (room, p, { index, pile }) => room.throwAway(p.id, index, pile),
    pass: (room, p) => room.pass(p.id),
  },
});
