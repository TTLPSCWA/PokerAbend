import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { lifeJourney } from '../art-kit.js';
export default turnGame(Room, {
  id: 'spiel-des-lebens', name: 'Spiel des Lebens', category: 'brett', minPlayers: 2, maxPlayers: 6, duration: 45, players: '2–6 Spieler',
  description: 'Studium oder Beruf, Familie, Häuser und große Lebensmomente: Drehen und gemeinsam durchs Leben fahren.',
  art: lifeJourney(), createFields: [], implementedVariants: ['short'],
  events: {
    spin: (r, p) => r.throwWheel(p.id), choose: (r, p, { value }) => r.choose(p.id, value),
    borrow: (r, p, { units = 1 }) => r.borrow(p.id, units), repay: (r, p, { units = 1 }) => r.repay(p.id, units),
  },
});
