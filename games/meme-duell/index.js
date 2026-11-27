import { MemeDuelRoom } from './room.js';
import { partyEvents } from '../party-room.js';
import { turnGame } from '../../server/turn-game.js';
import { glyph } from '../art-kit.js';

export default turnGame(MemeDuelRoom, {
  id: 'meme-duell',
  name: 'Meme-Duell',
  description: 'Wählt witzige Reaktionen, kombiniert Bilder mit Text oder erstellt eigene Memes.',
  category: 'party',
  minPlayers: 3,
  maxPlayers: 12,
  players: '3–12 Spieler',
  duration: 12,
  art: glyph('pen'),
  createFields: [{...MemeDuelRoom.OPTIONS[1], value:3}],
  events: {
    next: partyEvents.next,
    'meme-image-begin': (room, player, data) => room.beginImage(player.id, data.title),
    'meme-image-chunk': (room, player, data) => room.acceptImageChunk(player.id, data),
    'meme-image-remove': (room, player, data) => room.removeImage(player.id, data.id),
    'meme-submit': (room, player, data) => room.submit(player.id, data),
    'meme-vote': (room, player, data) => room.ballot(player.id, data),
  },
});
