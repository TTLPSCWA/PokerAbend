import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';
export default turnGame(Room, {
  id: 'scotland-yard', name: 'Scotland Yard', category: 'brett', minPlayers: 3, maxPlayers: 6, duration: 45, players: '3–6 Spieler',
  description: 'Detektive jagen Mr. X mit Taxi, Bus und U-Bahn über einen eigenen Stadtplan. Seine Position bleibt meist geheim.',
  art: glyph('agent', '#2E3F57'), createFields: [{ key: 'rounds', label: 'Züge von Mr. X', type: 'number', min: 12, max: 24, value: 24 }],
  events: {
    syMove: (room, p, { to, ticket, double = false }) => room.move(p.id, to, ticket, double),
    syRole: (room, p, { target = null }) => room.chooseX(p.id, target),
  },
});
