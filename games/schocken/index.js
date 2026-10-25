// Spielmodul Schocken (drei Würfel, 13 Deckel; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'schocken',
  name: 'Schocken',
  description: 'Drei Würfel, bis zu drei Würfe, 13 Deckel. Wer am Ende alle Deckel hat, verliert die Halbzeit.',
  players: '2–8 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 3).map(Number) : []),
    stop: (room, p) => room.stop(p.id),
    sixes: (room, p) => room.turnSixes(p.id),
  },
};
