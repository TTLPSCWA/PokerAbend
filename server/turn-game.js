import { turnEvents } from './turn-room.js';

// Gemeinsame Plattform-Anbindung; Regeln und Eingabeprüfung bleiben im Spielmodul.
export function turnGame(Room, { events, ...info }) {
  return {
    createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“. Der Host startet die Runde.',
    ...info,
    create: (code, settings, onChange) => new Room(code, settings, onChange),
    restore: (data, onChange) => Room.restore(data, onChange),
    options: Room.OPTIONS,
    events: { ...turnEvents, ...events },
  };
}
