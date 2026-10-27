// Spielmodul Mau-Mau (siehe room.js für die Regeln)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

const str = (v) => String(v ?? '').slice(0, 20);

export default turnGame(Room, {
  id: 'maumau',
  name: 'Mau-Mau',
  description: 'Ablegen nach Farbe oder Wert. 7 zieht 2, 8 setzt aus, Bube wünscht. Wenig Punkte gewinnen.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 8, duration: 10, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: fan([{ kind: 'heart' }, { kind: 'dot', color: '#1A1A1A' }, { kind: 'diamond' }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–8 Spieler',
  createFields: [{ key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, value: 5 }],
  events: {
    play: (room, p, { card, wish, call }) => room.play(p.id, str(card), str(wish) || null, !!call),
    draw: (room, p) => room.draw(p.id),
    pass: (room, p) => room.pass(p.id),
  },
});
