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
import schlagfertig from './schlagfertig/index.js';
import werhatdasgesagt from './werhatdasgesagt/index.js';
import mogeln from './mogeln/index.js';
import praesident from './praesident/index.js';
import durak from './durak/index.js';
import omaha from './omaha/index.js';
import wuerfelpoker from './wuerfelpoker/index.js';
import luegenwuerfel from './luegenwuerfel/index.js';
import chicago from './chicago/index.js';
import reversi from './reversi/index.js';
import dame from './dame/index.js';
import domino from './domino/index.js';
import zahlenzoo from './zahlenzoo/index.js';
import gedaechtnisKueche from './gedaechtnis-kueche/index.js';
import pfeilfieber from './pfeilfieber/index.js';
import sortierstation from './sortierstation/index.js';
import tickendesPaket from './tickendes-paket/index.js';
import werwolf from './werwolf/index.js';
import werBinIch from './wer-bin-ich/index.js';

export const GAMES = Object.fromEntries([poker, maumau, farbenchaos, maexchen, schocken, huetchen, zehnetappen, stapelrennen, schwimmen, blackjack, kniffel, schiffe, viergewinnt, shutthebox, zehntausend, muehle, schaetzmeister, schlagfertig, werhatdasgesagt, mogeln, praesident, durak, omaha, wuerfelpoker, luegenwuerfel, chicago, reversi, dame, domino, zahlenzoo, gedaechtnisKueche, pfeilfieber, sortierstation, tickendesPaket, werwolf, werBinIch].map((g) => [g.id, g]));
export const DEFAULT_GAME = 'poker'; // alte Spielstände ohne Spielart sind Poker

// Was die Startseite über die Spiele wissen muss
export const gameList = () => Object.values(GAMES).map(({ id, name, description, players, category = 'karten', minPlayers, maxPlayers, duration, art, createFields, createHint, options = [] }) => ({
  id, name, description, players, category, minPlayers, maxPlayers, duration, art, createFields, createHint, options,
}));
export { PLANNED, plannedGames } from './planned.js';
// Kategorien der Startseite, in dieser Reihenfolge
export const CATEGORIES = [['karten', 'Kartenspiele'], ['wuerfel', 'Würfelspiele'], ['brett', 'Brettspiele'], ['party', 'Party Spiele']];

// Ereignisnamen aller Spiele – die Plattform meldet sie einmal pro Verbindung an
export const gameEvents = () => [...new Set(Object.values(GAMES).flatMap((g) => Object.keys(g.events)))];
