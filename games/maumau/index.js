// Spielmodul Mau-Mau (siehe room.js für die Regeln)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

const str = (v) => String(v ?? '').slice(0, 20);

export default {
  id: 'maumau',
  name: 'Mau-Mau',
  description: 'Ablegen nach Farbe oder Wert. 7 zieht 2, 8 setzt aus, Bube wünscht. Wenig Punkte gewinnen.',
  players: '2–8 Spieler',
  createFields: [{ key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, value: 5 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    play: (room, p, { card, wish, call }) => room.play(p.id, str(card), str(wish) || null, !!call),
    draw: (room, p) => room.draw(p.id),
    pass: (room, p) => room.pass(p.id),
  },
};
