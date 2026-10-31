// Spielmodul UNO (interne ID bleibt „farbenchaos“, damit gespeicherte Tische weiter laden; Regeln in room.js)
import { Room } from './room.js';
import { VariantRoom } from './variants.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

const str = (v) => String(v ?? '').slice(0, 20);

export default turnGame(Room, {
  id: 'farbenchaos',
  variantRooms: { flip: VariantRoom, 'no-mercy': VariantRoom, 'all-wild': VariantRoom },
  implementedVariants: ['halloween-ghosthunt'], // The existing Classic Room, including every house rule.
  name: 'UNO',
  description: 'Farbe oder Zahl ablegen, Aussetzen, Richtungswechsel, +2 und Farbwahl. Der Gewinner kassiert die Punkte.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 8, duration: 15, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: fan([{ fill: '#D33B35' }, { fill: '#F2C230' }, { fill: '#1F57C3' }, { fill: '#1C7A43' }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–8 Spieler',
  createFields: [{ key: 'handSize', label: 'Karten pro Spieler', type: 'number', min: 3, value: 7 }],
  events: {
    play: (room, p, { card, wish, call, target }) => room.play(p.id, str(card), str(wish) || null, !!call, str(target) || null),
    chooseColor: (room, p, { color }) => { if (!room.chooseColor) throw new Error('Keine Farbwahl offen'); return room.chooseColor(p.id, str(color)); },
    challenge: (room, p, { challenge }) => { if (!room.challengeDraw) throw new Error('Keine Anfechtung offen'); return room.challengeDraw(p.id, challenge === true); },
    draw: (room, p) => room.draw(p.id),
    pass: (room, p) => room.pass(p.id),
    catch: (room, p) => room.catchForgot(p.id), // Erwischen: vergessenes „UNO“ melden
    late: (room, p) => room.lateCall(p.id),     // … oder selbst noch schnell sagen
  },
});
