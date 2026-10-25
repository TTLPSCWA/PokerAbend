// Spielmodul Mensch ärgere Dich nicht (interne ID bleibt „huetchen“; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'huetchen',
  name: 'Mensch ärgere Dich nicht',
  description: 'Würfeln, rauskommen mit der 6, andere rauswerfen. Wer zuerst alle vier Figuren im Ziel hat, gewinnt.',
  category: 'brett', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–4 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    roll: (room, p) => room.throwDice(p.id),
    move: (room, p, { piece }) => room.move(p.id, piece),
  },
};
