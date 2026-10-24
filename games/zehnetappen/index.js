// Spielmodul Zehn Etappen (Phase-10-ähnlich, eigene Gestaltung; Regeln in room.js)
import { Room } from './room.js';
import { turnEvents } from '../../server/turn-room.js';

export default {
  id: 'zehnetappen',
  name: 'Zehn Etappen',
  description: 'Zehn Aufgaben nacheinander: Drillinge, Folgen, eine Farbe … Wer zuerst Etappe 10 schafft, gewinnt.',
  players: '2–6 Spieler',
  createFields: [],
  createHint: 'Ein Spiel geht über mehrere Runden. Wer mitspielen will, klickt am Tisch auf „Mitspielen“.',
  create: (code, settings, onChange) => new Room(code, settings, onChange),
  restore: (data, onChange) => Room.restore(data, onChange),
  events: {
    ...turnEvents,
    draw: (room, p, { from }) => room.drawCard(p.id, from === 'discard' ? 'discard' : 'deck'),
    lay: (room, p, { cards }) => room.layPhase(p.id, Array.isArray(cards) ? cards.slice(0, 12) : []),
    hit: (room, p, { card, owner, group }) => room.hit(p.id, card, String(owner || ''), group),
    discard: (room, p, { card, target }) => room.throwAway(p.id, card, String(target || '')),
  },
};
