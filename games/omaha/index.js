// Spielmodul Omaha: Poker wie Texas Hold'em (gleicher Raum, gleiche Oberfläche), aber mit vier eigenen Karten,
// von denen genau zwei zählen – und standardmäßig Pot-Limit. Regeln: games/poker (Variante 'omaha') und engine/table.js.
import poker from '../poker/index.js';
import { Room } from '../poker/room.js';
import { cardsChip } from '../art-kit.js';

export default {
  ...poker,
  id: 'omaha',
  name: 'Omaha',
  description: 'Poker mit vier eigenen Karten – genau zwei davon zählen. Pot-Limit, Blinds, Side Pots, Abendstand.',
  art: cardsChip({ kind: 'diamond' }, { kind: 'dot', color: '#1A1A1A' }, '#D33B35'),
  create: (code, settings, onChange) => new Room(code, { ...settings, variant: 'omaha', potLimit: true, oddsMode: 'off' }, onChange),
};
