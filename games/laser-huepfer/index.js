import { LaserRoom, realtimeEvents } from '../realtime-room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';

export default turnGame(LaserRoom, {
  id: 'laser-huepfer', name: 'Laser-Hüpfer', description: 'Spring über wandernde Laser oder weiche aus. Wer zuletzt übrig bleibt, gewinnt.', category: 'party', bauart: 'C',
  minPlayers: 2, maxPlayers: 8, duration: 5, players: '2–8 Spieler', art: glyph('laser', '#B8433F'),
  createFields: [{ key: 'playSecs', label: 'Spielzeit in Sekunden', type: 'number', min: 10, max: 180, value: 60 }],
  createHint: 'Mit Pfeiltasten oder WASD bewegen, am Handy die Richtungsknöpfe halten. Springen mit Leertaste oder Sprungknopf, wenn das Spiel es erlaubt. Der Host startet, Bots sind optional.',
  events: realtimeEvents,
});
