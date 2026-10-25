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

export const GAMES = Object.fromEntries([poker, maumau, farbenchaos, maexchen, schocken, huetchen, zehnetappen, stapelrennen, schwimmen].map((g) => [g.id, g]));
export const DEFAULT_GAME = 'poker'; // alte Spielstände ohne Spielart sind Poker

// Was die Startseite über die Spiele wissen muss
export const gameList = () => Object.values(GAMES).map(({ id, name, description, players, category = 'karten', createFields, createHint, options = [] }) => ({
  id, name, description, players, category, createFields, createHint, options,
}));
// Kategorien der Startseite, in dieser Reihenfolge
export const CATEGORIES = [['karten', 'Kartenspiele'], ['wuerfel', 'Würfelspiele'], ['brett', 'Brettspiele']];

// Ereignisnamen aller Spiele – die Plattform meldet sie einmal pro Verbindung an
export const gameEvents = () => [...new Set(Object.values(GAMES).flatMap((g) => Object.keys(g.events)))];
