// Spielmodul Phase 10 (interne ID bleibt „zehnetappen“; Regeln in room.js)
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { fan } from '../art-kit.js';

export default turnGame(Room, {
  id: 'zehnetappen',
  name: 'Phase 10',
  description: 'Zehn Aufgaben nacheinander: Drillinge, Folgen, eine Farbe … Wer zuerst Phase 10 schafft, gewinnt.',
  category: 'karten', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 2, maxPlayers: 6, duration: 45, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: fan([{ fill: '#1C7A43', kind: 'bars', color: '#F7F3E8' }, { fill: '#1F57C3', kind: 'bars', color: '#F7F3E8' }, { fill: '#D33B35', kind: 'bars', color: '#F7F3E8' }]), // Spielbild für die Startseite (siehe games/art-kit.js)
  players: '2–6 Spieler',
  createFields: [],
  createHint: 'Ein Spiel geht über mehrere Runden. Wer mitspielen will, klickt am Tisch auf „Mitspielen“.',
  events: {
    draw: (room, p, { from }) => room.drawCard(p.id, from === 'discard' ? 'discard' : 'deck'),
    lay: (room, p, { cards, groups }) => room.layPhase(p.id, Array.isArray(cards) ? cards.slice(0, 12) : [], Array.isArray(groups) ? groups.slice(0, 2).map((g) => (Array.isArray(g) ? g.slice(0, 12) : [])) : null),
    hit: (room, p, { card, owner, group, end }) => room.hit(p.id, card, String(owner || ''), group, end === 'low' || end === 'high' ? end : null),
    takeJoker: (room) => room.takeJoker(),
    discard: (room, p, { card, target }) => room.throwAway(p.id, card, String(target || '')),
  },
});
