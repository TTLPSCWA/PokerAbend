import { KritzelRoom, drawingEvents } from '../drawing-room.js';
import { partyEvents } from '../party-room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';

export default turnGame(KritzelRoom, {
  id: 'kritzelpost', name: 'Kritzelpost', description: 'Ein Begriff wandert als Bild und Beschreibung durch die Runde.', category: 'party',
  minPlayers: 3, maxPlayers: 12, duration: 15, players: '3–12 Spieler', art: glyph('pen'),
  createFields: [{ key: 'rounds', label: 'Anzahl Runden', type: 'number', min: 1, max: 3, value: 1 }],
  createHint: 'Mindestens drei Menschen spielen mit. Zeichnen geht mit Maus, Stift oder Finger; der Host startet und kann bei Bedarf weiterschalten.',
  events: { ...partyEvents, ...drawingEvents },
});
