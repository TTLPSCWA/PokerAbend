// ART-W4 · Kartenwelten für die klassischen Kartenspiele außerhalb von ART-T (Konzept: docs/design/THEME_WORLDS.md, Abschnitt 3.2).
// Art „deck“ (französisches bzw. deutsches Blatt, Poker-Familie). Nicht zu verwechseln mit der Art „card“ der ART-T-Kartenwelten
// (UNO, Skip-Bo, Phase 10), die eigene Karten zeichnen und unverändert bleiben.
// Poker-Familie und Blackjack: TW-14 Saloon, TW-03 Dampf & Messing, TW-13 Neon-Arcade, TW-01 Schatten über Neuengland.
// Klassische Kartenspiele: TW-02 Baker Street, TW-09 Runen & Nordlicht, TW-10 Tafelrunde, TW-14 Saloon.
// Vorhandene Welten (TW-01, TW-09, TW-10, TW-13, TW-14) bekommen eine Karten-Facette (gleiche ID); TW-02 und TW-03 sind neu.
// Ein gemeinsamer Baustein (deck/deck-worlds.css) gestaltet Kartenfront, Bildkarten, Rücken, Fächer, Tisch und Zugmarkierung über Variablen.
export const POKER_GAMES = ['poker', 'omaha', 'omaha-hi-lo', 'seven-card-stud', 'short-deck', 'five-card-draw', 'blackjack'];
export const CLASSIC_GAMES = ['skat', 'doppelkopf', 'schwimmen', 'maumau', 'durak', 'hearts', 'stichmeister', 'praesident', 'mogeln'];
export const DECK_GAMES = [...POKER_GAMES, ...CLASSIC_GAMES];
const BASE = '/games/theme-worlds/deck/';
const assets = (slug) => ({
  preview: `${BASE}preview-${slug}.svg`,
  css: [`${BASE}deck-worlds.css`, `${BASE}${slug}.css`],
  preload: ['preview', 'table', 'back', 'frame', 'emblem'].map((k) => `${BASE}${k}-${slug}.svg`),
});
// Keine Weltschrift auf Karten: Werte und Farben bleiben in der gewohnten, gut lesbaren Schrift
const facet = (slug, games, palette) => ({ kind: 'deck', games: [...games], variants: null, source: 'ART-W4', assets: assets(slug), palette, fonts: [] });

// Neue Welten (Hauptform: Karten)
export const TW02 = {
  id: 'TW-02', kind: 'deck', name: { de: 'Baker Street', en: 'Baker Street' },
  description: { de: 'Viktorianisches London: Ruß, Backstein, Gaslicht und Lupe.', en: 'Victorian London: soot, brick, gaslight and a magnifying glass.' },
  games: [...CLASSIC_GAMES], variants: null, assets: assets('tw-02'),
  palette: { colors: ['#2a2622', '#7a3b2e', '#e8c766', '#efe6d2', '#1d1b19'], background: '#1d1b19', text: '#1d1b19' },
  fonts: [], effects: [], fallback: 'standard', released: true, source: 'ART-W4',
};
export const TW03 = {
  id: 'TW-03', kind: 'deck', name: { de: 'Dampf & Messing', en: 'Steam & Brass' },
  description: { de: 'Kupfer, Messing und Ozeanblau, Zahnräder und Seeinstrumente.', en: 'Copper, brass and ocean blue, gears and nautical instruments.' },
  games: [...POKER_GAMES], variants: null, assets: assets('tw-03'),
  palette: { colors: ['#b87333', '#c9a24a', '#1d4e63', '#f1e7d0', '#2a2018'], background: '#13262f', text: '#2a2018' },
  fonts: [], effects: [], fallback: 'standard', released: true, source: 'ART-W4',
};

// Karten-Facetten vorhandener Welten (Hauptform und andere Facetten bleiben unverändert)
export const DECK_FACETS = {
  'TW-14': facet('tw-14', DECK_GAMES, { colors: ['#5a1f1c', '#c79a4a', '#1f3b2c', '#f3e6c8', '#2b1a10'], background: '#2b1a10', text: '#2b1a10' }),
  'TW-13': facet('tw-13', POKER_GAMES, { colors: ['#0d0b1f', '#ff3fb4', '#2de2e6', '#f4f6ff', '#1a1640'], background: '#0d0b1f', text: '#0d0b1f' }),
  'TW-01': facet('tw-01', POKER_GAMES, { colors: ['#1d2a2a', '#3b2a1f', '#b08d4a', '#efe3c6', '#0f1716'], background: '#0f1716', text: '#0f1716' }),
  'TW-09': facet('tw-09', CLASSIC_GAMES, { colors: ['#2b3236', '#6fe0b0', '#8fc4e8', '#ece6d8', '#5a3e28'], background: '#1d2226', text: '#1d2226' }),
  'TW-10': facet('tw-10', CLASSIC_GAMES, { colors: ['#9e2a2b', '#23408e', '#d4a83c', '#f4ead2', '#2a1d14'], background: '#2a1d14', text: '#2a1d14' }),
};
// Welten je Spielgruppe laut Konzept (Reihenfolge im Host-Menü folgt der Registry)
export const DECK_WORLD_IDS = { poker: ['TW-14', 'TW-03', 'TW-13', 'TW-01'], classic: ['TW-02', 'TW-09', 'TW-10', 'TW-14'] };
