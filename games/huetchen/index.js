// Spielmodul Hütchenrennen (Brettspiel, Mensch-ärgere-dich-ähnlich; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'huetchen',
  name: 'Hütchenrennen',
  description: 'Würfeln, rauskommen mit der 6, andere rauswerfen. Wer zuerst alle vier Hütchen im Ziel hat, gewinnt.',
  players: '2–4 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  events: {
    ...turnEvents,
    roll: (room, p) => room.throwDice(p.id),
    move: (room, p, { piece }) => room.move(p.id, piece),
  },
};
