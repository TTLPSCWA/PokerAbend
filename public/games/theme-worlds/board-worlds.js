// ART-W3 · Brettwelten aus dem Konzept (docs/design/THEME_WORLDS.md): TW-08 Götterberg, TW-09 Runen & Nordlicht (als Brett-Facette der
// Würfelwelt aus ART-W2, gleiche ID), TW-10 Tafelrunde – für sieben klassische Brettspiele. Ein gemeinsamer Baustein
// (board/board-worlds.css) gestaltet Brett, Felder, Steine, Figuren und Rahmen über Variablen; jede Welt liefert nur Variablen und Texturen.
// Schachfiguren behalten ihre Silhouetten; die Welt fügt Zierformen hinzu (art.chess) – geprüft in registry.js (validArtFragment).
export const BOARD_GAMES = ['schach', 'muehle', 'dame', 'reversi', 'hex', 'viergewinnt', 'backgammon'];
const BASE = '/games/theme-worlds/board/';
const assets = (slug) => ({ preview: `${BASE}preview-${slug}.svg`, css: [`${BASE}board-worlds.css`, `${BASE}${slug}.css`], preload: [`${BASE}preview-${slug}.svg`, `${BASE}table-${slug}.svg`, `${BASE}light-${slug}.svg`, `${BASE}dark-${slug}.svg`] });

// Zierformen im 80×80-Raster der Schachfiguren. Klasse tw-o = Fläche, tw-l = Linie; Farben setzt die Welt-CSS. Fuß (y 60–69) und Kopf bleiben frei lesbar.
const CHESS_TW08 = {
  all: '<path class="tw-l" fill="none" d="M24 66h4v-3h4v3h4v-3h4v3h4v-3h4v3h4v-3h4v3h4"/>', // Mäanderband am Sockel
  k: '<path class="tw-o" d="M29 26c-5-1-8-5-8-9 4 1 7 4 8 9zM51 26c5-1 8-5 8-9-4 1-7 4-8 9z"/>', // Lorbeer
  q: '<path class="tw-o" d="M30 40c-4-1-6-4-6-7 3 1 5 3 6 7zM50 40c4-1 6-4 6-7-3 1-5 3-6 7z"/>',
  n: '<path class="tw-o" d="M41 13c6-6 14-6 17 0-6-2-11-1-17 3z"/>', // Helmbusch
  b: '<circle class="tw-o" cx="40" cy="30" r="2.6"/>',
  r: '<path class="tw-l" fill="none" d="M29 50h22M29 53h22"/>',
  p: '',
};
const CHESS_TW09 = {
  all: '<path class="tw-l" fill="none" d="M27 63v5M27 64.5l3-2M36 63v5l3-2.5-3-2.5M45 63v5M42.5 65.5h5M53 63v5l3-3"/>', // Runenband
  k: '<path class="tw-l" fill="none" d="M37 33v10M37 35l5-3M37 39l5 3"/>',
  q: '<path class="tw-l" fill="none" d="M38 44v8M38 44l4 4-4 4"/>',
  n: '<path class="tw-l" fill="none" d="M44 40l6 2M45 45l6 2"/>', // Mähnenflechte
  b: '<path class="tw-l" fill="none" d="M36 36h8M40 32v8"/>',
  r: '<path class="tw-l" fill="none" d="M33 48l5 4 5-4 5 4"/>',
  p: '',
};
const CHESS_TW10 = {
  all: '<path class="tw-l" fill="none" d="M24 67l4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 3 4-3 4 3"/>', // Zickzackborte
  k: '<path class="tw-o" d="M34 34h12v7c0 4-3 7-6 8-3-1-6-4-6-8z"/>', // Wappenschild
  q: '<path class="tw-o" d="M36 44h8v4c0 3-2 5-4 6-2-1-4-3-4-6z"/>',
  n: '<path class="tw-o" d="M48 18l7-3-2 6z"/>', // Wimpel
  b: '<path class="tw-l" fill="none" d="M34 32l12 0M40 26l0 12"/>',
  r: '<path class="tw-o" d="M36 46h8v6h-8z"/>', // Fahne am Turm
  p: '',
};

const common = { kind: 'board', source: 'ART-W3', released: true, fallback: 'standard', games: [...BOARD_GAMES], variants: null, effects: [] };
export const TW08 = {
  ...common, id: 'TW-08', name: { de: 'Götterberg', en: 'Mount of the Gods' },
  description: { de: 'Weißer und dunkler Marmor, Gold und Ägäisblau, Säulen und Mäander.', en: 'White and dark marble, gold and Aegean blue, columns and meanders.' },
  assets: assets('tw-08'), palette: { colors: ['#f2efe8', '#3d4650', '#c9a24a', '#1f5f8b', '#e9e4d8'], background: '#1d2a36', text: '#1d2a36' },
  fonts: [{ family: 'Cinzel', url: '/fonts/worlds/cinzel.woff2' }], art: { chess: CHESS_TW08 },
};
export const TW10 = {
  ...common, id: 'TW-10', name: { de: 'Tafelrunde', en: 'Round Table' },
  description: { de: 'Burghölzer, Wappenrot, Königsblau und Gold, Schilde und Banner.', en: 'Castle timber, heraldic red, royal blue and gold, shields and banners.' },
  assets: assets('tw-10'), palette: { colors: ['#e9dcc0', '#2a2f45', '#9e2a2b', '#23408e', '#d4a83c'], background: '#2a1d14', text: '#2a1d14' },
  fonts: [{ family: 'Cinzel', url: '/fonts/worlds/cinzel.woff2' }], art: { chess: CHESS_TW10 },
};
// TW-09 Runen & Nordlicht: Brett-Ausprägung derselben Welt (Facette); die Würfel-Ausprägung bleibt unverändert in dice-worlds.js
export const TW09_BOARD_FACET = {
  kind: 'board', games: [...BOARD_GAMES], variants: null, source: 'ART-W3', assets: assets('tw-09'),
  palette: { colors: ['#d9d2c3', '#2b3236', '#6fe0b0', '#8fc4e8', '#5a3e28'], background: '#1d2226', text: '#1d2226' },
  fonts: [{ family: 'Cinzel', url: '/fonts/worlds/cinzel.woff2' }], art: { chess: CHESS_TW09 },
};
