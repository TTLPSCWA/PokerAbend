// ART-W2 · Würfelwelten aus dem Konzept (docs/design/THEME_WORLDS.md): TW-14 Saloon, TW-11 Piratenbucht, TW-09 Runen & Nordlicht,
// TW-13 Neon-Arcade – für alle 13 Würfelspiele. Ein gemeinsamer Baustein (dice/dice-worlds.css) gestaltet Würfel, Becher, Klappen
// und Tisch über Variablen; jede Welt liefert nur ihre Variablen, Texturen und Schrift (dice/tw-xx.css). Nur Darstellung.
export const DICE_GAMES = ['kniffel', 'maexchen', 'schocken', 'zehntausend', 'wuerfelpoker', 'luegenwuerfel', 'chicago', 'wuerfelduell', 'risiko-wuerfeln', 'wuerfeljagd', 'monsterwuerfel', 'wuerfel-auktion', 'shutthebox'];
const BASE = '/games/theme-worlds/dice/';
const world = (id, slug, name, description, palette, fonts) => ({
  id, kind: 'dice', source: 'ART-W2', released: true, fallback: 'standard',
  name, description, games: [...DICE_GAMES], variants: null,
  assets: { preview: `${BASE}preview-${slug}.svg`, css: [`${BASE}dice-worlds.css`, `${BASE}${slug}.css`], preload: [`${BASE}preview-${slug}.svg`, `${BASE}table-${slug}.svg`, `${BASE}cup-${slug}.svg`] },
  palette, fonts, effects: [],
});
export const DICE_WORLDS = [
  world('TW-14', 'tw-14', { de: 'Saloon', en: 'Saloon' }, { de: 'Holzdielen, Leder und Messing: Knochenwürfel im Lederbecher.', en: 'Plank floors, leather and brass: bone dice in a leather cup.' },
    { colors: ['#3b2414', '#5a3320', '#e0b04a', '#f6ecd4', '#2a1a10'], background: '#3b2414', text: '#2a1a10' }, [{ family: 'TW Rye', url: '/fonts/worlds/rye.woff2' }]),
  world('TW-11', 'tw-11', { de: 'Piratenbucht', en: 'Pirate Cove' }, { de: 'Alter Kneipentisch mit Seekarte, Walbein-Würfel, Holzbecher mit Eisenringen.', en: 'Old tavern table with a sea chart, whalebone dice, iron-banded wooden cup.' },
    { colors: ['#2a1e14', '#6b4a2a', '#f2c14e', '#f1e3bf', '#1f2a33'], background: '#2a1e14', text: '#1f2a33' }, [{ family: 'TW Pirata One', url: '/fonts/worlds/pirata-one.woff2' }]),
  world('TW-09', 'tw-09', { de: 'Runen & Nordlicht', en: 'Runes & Northern Lights' }, { de: 'Langhausdielen, Runensteine als Würfel, Hornbecher und Polarlicht.', en: 'Longhouse planks, rune stones as dice, a horn cup and northern lights.' },
    { colors: ['#24201c', '#4a4038', '#6fe0b0', '#d3d7d3', '#16232b'], background: '#24201c', text: '#16232b' }, [{ family: 'Cinzel', url: '/fonts/worlds/cinzel.woff2' }]),
  world('TW-13', 'tw-13', { de: 'Neon-Arcade', en: 'Neon Arcade' }, { de: 'Dunkles Raster, leuchtende Augen, Neon-Becher – ohne Blinken.', en: 'Dark grid, glowing pips, a neon cup – no flashing.' },
    { colors: ['#120a26', '#1e1640', '#22e3ff', '#ff6fe0', '#ffe14d'], background: '#120a26', text: '#8ff5ff' }, [{ family: 'Righteous', url: '/fonts/worlds/righteous.woff2' }]),
];
