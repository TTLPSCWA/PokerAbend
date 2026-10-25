// Spielmodul Skip-Bo (interne ID bleibt „stapelrennen“; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

const from = (f) => ({ kind: ['hand', 'stock', 'pile'].includes(f?.kind) ? f.kind : '', index: Number(f?.index) || 0 });

export default {
  id: 'stapelrennen',
  name: 'Skip-Bo',
  description: 'Reihen von 1 bis 12 bauen, Joker helfen. Wer zuerst seinen eigenen Stapel los ist, gewinnt.',
  players: '2–6 Spieler',
  createFields: [{ key: 'stockSize', label: 'Karten im eigenen Stapel', type: 'number', min: 5, value: 20 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    play: (room, p, { from: f, to }) => room.play(p.id, from(f), to),
    discard: (room, p, { index, pile }) => room.throwAway(p.id, index, pile),
    pass: (room, p) => room.pass(p.id),
  },
};
