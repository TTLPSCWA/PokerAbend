import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';
export default turnGame(Room, {
  id: 'wuerfelduell', name: 'Würfelduell', description: 'Angreifen, abwehren und als Letzter mit Lebenspunkten übrig bleiben.', category: 'wuerfel', minPlayers: 2, maxPlayers: 4, duration: 10, players: '2–4 Spieler', art: glyph('shield'),
  createFields: [], events: { duelAttack: (room, p, { target }) => room.attack(p.id, target) },
});
