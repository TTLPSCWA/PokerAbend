// Alle Spiele der Seite. Ein neues Spiel: Ordner games/<id>/ anlegen und hier eintragen (siehe README).
import poker from './poker/index.js';

export const GAMES = Object.fromEntries([poker].map((g) => [g.id, g]));
export const DEFAULT_GAME = 'poker'; // alte Spielstände ohne Spielart sind Poker

// Was die Startseite über die Spiele wissen muss
export const gameList = () => Object.values(GAMES).map(({ id, name, description, players, createFields, createHint }) => ({
  id, name, description, players, createFields, createHint,
}));

// Ereignisnamen aller Spiele – die Plattform meldet sie einmal pro Verbindung an
export const gameEvents = () => [...new Set(Object.values(GAMES).flatMap((g) => Object.keys(g.events)))];
