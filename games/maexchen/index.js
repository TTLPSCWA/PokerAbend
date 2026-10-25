// Spielmodul Mäxchen (Würfeln und Bluffen; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'maexchen',
  name: 'Mäxchen',
  description: 'Verdeckt würfeln, höher ansagen, bluffen oder anzweifeln. Wer alle Leben verliert, ist raus.',
  players: '2–10 Spieler',
  createFields: [{ key: 'lives', label: 'Leben pro Spieler', type: 'number', min: 1, value: 3 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    roll: (room, p) => room.throwDice(p.id),
    announce: (room, p, { value }) => room.announce(p.id, value),
    doubt: (room, p) => room.doubt(p.id),
    accept: (room, p) => room.accept(p.id),
    blind: (room, p, { value }) => room.passBlind(p.id, value),
  },
};
