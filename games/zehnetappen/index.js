// Spielmodul Phase 10 (interne ID bleibt „zehnetappen“; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';

export default turnGame(Room, {
  id: 'zehnetappen',
  name: 'Phase 10',
  description: 'Zehn Aufgaben nacheinander: Drillinge, Folgen, eine Farbe … Wer zuerst Phase 10 schafft, gewinnt.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  players: '2–6 Spieler',
  createFields: [],
  createHint: 'Ein Spiel geht über mehrere Runden. Wer mitspielen will, klickt am Tisch auf „Mitspielen“.',
  events: {
    draw: (room, p, { from }) => room.drawCard(p.id, from === 'discard' ? 'discard' : 'deck'),
    lay: (room, p, { cards }) => room.layPhase(p.id, Array.isArray(cards) ? cards.slice(0, 12) : []),
    hit: (room, p, { card, owner, group }) => room.hit(p.id, card, String(owner || ''), group),
    discard: (room, p, { card, target }) => room.throwAway(p.id, card, String(target || '')),
  },
});
