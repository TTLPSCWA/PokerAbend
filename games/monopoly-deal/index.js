import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { propertyCards } from '../art-kit.js';
export default turnGame(Room, {
  implementedVariants: ['quick'],
  id: 'monopoly-deal', name: 'Monopoly Deal', category: 'karten', minPlayers: 2, maxPlayers: 5, duration: 20, players: '2–5 Spieler',
  description: 'Grundstücke, Mieten und Gegenaktionen: Drei verschiedene volle Sätze gewinnen.', art: propertyCards(), createFields: [],
  events: {
    bankCard: (r, p, { card }) => r.bankCard(p.id, card), property: (r, p, { card, color, group }) => r.property(p.id, card, color, group),
    recolor: (r, p, { card, color, group }) => r.recolor(p.id, card, color, group), dealAction: (r, p, { card, ...args }) => r.play(p.id, card, args),
    respond: (r, p, { no }) => r.respond(p.id, no === true), pay: (r, p, { cards }) => r.pay(p.id, cards), endTurn: (r, p, { cards }) => r.endTurn(p.id, cards),
  },
});
