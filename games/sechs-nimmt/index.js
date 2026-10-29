import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { bullCards } from '../art-kit.js';
export default turnGame(Room, {
  id: 'sechs-nimmt', name: '6 nimmt!', category: 'karten', minPlayers: 2, maxPlayers: 10, duration: 20, players: '2–10 Spieler',
  description: 'Alle wählen verdeckt. Die sechste Karte bringt eine Reihe voller Hornochsen.', art: bullCards(), createFields: [],
  events: { choose: (r, p, { card }) => r.choose(p.id, Number(card)), takeRow: (r, p, { row }) => r.takeRow(p.id, Number(row)) },
});
