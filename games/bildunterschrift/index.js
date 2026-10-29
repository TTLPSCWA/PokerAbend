import { CaptionRoom, drawingEvents } from '../drawing-room.js';
import { partyEvents } from '../party-room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';

export default turnGame(CaptionRoom, {
  id: 'bildunterschrift', name: 'Bildunterschrift', description: 'Lustige Beschriftungen zu selbst gezeichneten Bildern finden.', category: 'party',
  minPlayers: 3, maxPlayers: 12, duration: 15, players: '3–12 Spieler', art: glyph('pen'),
  createFields: [{ key: 'rounds', label: 'Anzahl Runden', type: 'number', min: 1, max: 30, value: 3 }],
  createHint: 'Mindestens drei Menschen spielen mit. Zeichnen geht mit Maus, Stift oder Finger; der Host startet und kann bei Bedarf weiterschalten.',
  events: { ...partyEvents, ...drawingEvents },
});
