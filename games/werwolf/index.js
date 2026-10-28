// Spielmodul Werwolf – Regeln in room.js
import { Room } from './room.js';
import { turnGame } from '../../server/turn-game.js';
import { partyEvents } from '../party-room.js';
import { glyph } from '../art-kit.js';

const id = (v) => String(v ?? '').slice(0, 40);
const orNull = (v) => (v === null || v === undefined || v === '' ? null : id(v));

export default turnGame(Room, {
  id: 'werwolf',
  name: 'Werwolf',
  description: 'Dorf gegen Werwölfe: Nachts wird gejagt, tagsüber diskutiert und abgestimmt. Der Server ist Spielleiter.',
  category: 'party',
  minPlayers: 6, maxPlayers: 18, duration: 30,
  art: glyph('mask', '#4A3A6B'),
  players: '6–18 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – mindestens 6. Besprecht euch am Tisch, am besten per Voice. Der Host startet die Partie.',
  events: {
    next: partyEvents.next,
    amor: (room, p, { a, b }) => room.amor(p.id, id(a), id(b)),
    wolfVote: (room, p, { target }) => room.wolfVote(p.id, orNull(target)),
    seer: (room, p, { target }) => room.seer(p.id, id(target)),
    witch: (room, p, { action, target }) => room.witch(p.id, id(action), orNull(target)),
    vote: (room, p, { target }) => room.vote(p.id, orNull(target)),
    shoot: (room, p, { target }) => room.shoot(p.id, id(target)),
  },
});
