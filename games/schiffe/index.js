// Spielmodul Schiffe versenken – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { battle } from '../art-kit.js';

export default turnGame(Room, {
  id: 'schiffe',
  name: 'Schiffe versenken',
  description: 'Flotte verstecken, abwechselnd schießen: Wasser, Treffer, versenkt. Wer zuerst alle Schiffe des anderen versenkt, gewinnt.',
  category: 'brett', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 2, duration: 15, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: battle(), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2 Spieler (weitere schauen zu)',
  createFields: [{ key: 'turnTime', label: 'Sekunden pro Schuss (0 = ohne)', type: 'number', min: 0, value: 60 }],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – genau zwei. Der Host startet das Spiel.',
  events: {
    place: (room, p, { ships }) => room.place(p.id, Array.isArray(ships) ? ships.slice(0, 12).map((s) => ({ cell: Number(s?.cell), horizontal: !!s?.horizontal })) : null),
    unplace: (room, p) => room.unplace(p.id),
    shoot: (room, p, { cell }) => room.shoot(p.id, cell),
  },
});
