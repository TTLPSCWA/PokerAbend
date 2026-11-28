// Spielmodul Kniffel – Regeln in room.js
import { Room } from './room.js';
import { TripleRoom } from './triple.js';
import { turnGame } from '../../server/turn-game.js';
const lobbyArt = `<svg class="game-art" viewBox="0 0 64 64" aria-hidden="true">
  <path fill="#8c603e" d="M6 12h52v41H6z"/><rect x="8" y="13" width="48" height="38" rx="8" fill="#dec18c"/>
  <rect x="10" y="15" width="44" height="33" rx="7" fill="#234f42"/><path d="M12 23h40" fill="none" stroke="#c2a670" stroke-width="1.2"/>
  <g transform="rotate(-19 22 33)"><rect x="14" y="26" width="18" height="18" rx="4" fill="#9c8056"/>
  <rect x="14" y="24" width="18" height="17" rx="4" fill="#f5e6c6"/><path d="M19 29h.01m8 0h.01m-4 4h.01m-4 4h.01m8 0h.01" stroke="#24483a" stroke-width="2.4" stroke-linecap="round"/></g>
  <g transform="rotate(16 41 34)"><rect x="33" y="27" width="18" height="17" rx="4" fill="#a78961"/>
  <rect x="33" y="25" width="18" height="16" rx="4" fill="#f9eccf"/><path d="M38 30h.01m8 6h.01m-4-3h.01" stroke="#24483a" stroke-width="2.5" stroke-linecap="round"/></g>
</svg>`;


export default turnGame(Room, {
  id: 'kniffel',
  variantRooms: { triple: TripleRoom },
  name: 'Kniffel',
  description: 'Fünf Würfel, drei Würfe, 13 Felder: Pasch, Full House, Straßen, Kniffel. Die höchste Summe gewinnt.',
  category: 'wuerfel', // Karten, Würfel oder Brett – gruppiert die Startseite
  minPlayers: 1, maxPlayers: 6, duration: 25, // Spielerzahl und ungefähre Dauer in Minuten – für Filter und Anzeige auf der Startseite
  art: lobbyArt, // Eigenes Motiv für Kniffel auf der Startseite und im Host-Dialog
  players: '1–6 Spieler',
  createFields: [],
  createHint: 'Wer mitspielen will, klickt am Tisch auf „Mitspielen“ – allein geht auch. Der Host startet das Spiel.',
  events: {
    roll: (room, p, { keep }) => room.throwDice(p.id, Array.isArray(keep) ? keep.slice(0, 5) : []),
    score: (room, p, { field, column }) => room.score(p.id, String(field ?? '').slice(0, 20), column === undefined ? 0 : Number(column)),
  },
});
