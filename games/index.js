// Alle Spiele der Seite. Ein neues Spiel: Ordner games/<id>/ anlegen und hier eintragen (siehe README).
import poker from './poker/index.js';
import maumau from './maumau/index.js';
import farbenchaos from './farbenchaos/index.js';
import maexchen from './maexchen/index.js';
import schocken from './schocken/index.js';
import huetchen from './huetchen/index.js';
import zehnetappen from './zehnetappen/index.js';
import stapelrennen from './stapelrennen/index.js';
import schwimmen from './schwimmen/index.js';
import schiffe from './schiffe/index.js';
import blackjack from './blackjack/index.js';
import kniffel from './kniffel/index.js';
import viergewinnt from './viergewinnt/index.js';
import shutthebox from './shutthebox/index.js';
import zehntausend from './zehntausend/index.js';
import muehle from './muehle/index.js';
import schaetzmeister from './schaetzmeister/index.js';

export const GAMES = Object.fromEntries([poker, maumau, farbenchaos, maexchen, schocken, huetchen, zehnetappen, stapelrennen, schwimmen, blackjack, kniffel, schiffe, viergewinnt, shutthebox, zehntausend, muehle, schaetzmeister].map((g) => [g.id, g]));
export const DEFAULT_GAME = 'poker'; // alte Spielstände ohne Spielart sind Poker

// Was die Startseite über die Spiele wissen muss
export const gameList = () => Object.values(GAMES).map(({ id, name, description, players, category = 'karten', minPlayers, maxPlayers, duration, art, createFields, createHint, options = [] }) => ({
  id, name, description, players, category, minPlayers, maxPlayers, duration, art, createFields, createHint, options,
}));
export { PLANNED } from './planned.js';
// Kategorien der Startseite, in dieser Reihenfolge
export const CATEGORIES = [['karten', 'Kartenspiele'], ['wuerfel', 'Würfelspiele'], ['brett', 'Brettspiele'], ['party', 'Party Spiele']];

// Ereignisnamen aller Spiele – die Plattform meldet sie einmal pro Verbindung an
export const gameEvents = () => [...new Set(Object.values(GAMES).flatMap((g) => Object.keys(g.events)))];
