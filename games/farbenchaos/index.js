// Spielmodul UNO (interne ID bleibt „farbenchaos“, damit gespeicherte Tische weiter laden; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

const str = (v) => String(v ?? '').slice(0, 20);

export default {
  id: 'farbenchaos',
  name: 'UNO',
  description: 'Farbe oder Zahl ablegen, Aussetzen, Richtungswechsel, +2 und Farbwahl. Der Gewinner kassiert die Punkte.',
  players: '2–8 Spieler',
  createFields: [{ key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, value: 7 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  options: Room.OPTIONS, // Regel-Optionen fürs Host-Menü
  events: {
    ...turnEvents,
    play: (room, p, { card, wish, call }) => room.play(p.id, str(card), str(wish) || null, !!call),
    draw: (room, p) => room.draw(p.id),
    pass: (room, p) => room.pass(p.id),
    catch: (room, p) => room.catchForgot(p.id), // Erwischen: vergessenes „UNO“ melden
    late: (room, p) => room.lateCall(p.id),     // … oder selbst noch schnell sagen
  },
};
