// ART-W4 · Kartenwelten TW-14, TW-03, TW-13, TW-01 (Poker-Familie, Blackjack) und TW-02, TW-09, TW-10, TW-14 (klassische Kartenspiele):
// erzeugt die eigenen SVG-Grafiken unter public/games/theme-worlds/deck/ – je Welt Tischkachel, Kartenrücken, Kartenrahmen,
// Emblem für Bildkarten (Bube, Dame, König) und Vorschau.
//   node scripts/build-deck-worlds-art.mjs
// Alles hier gezeichnet (einfache Pfade) – keine Vorlage, keine fremden Motive, Marken oder Figuren.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dirname, '..', 'public', 'games', 'theme-worlds', 'deck');
mkdirSync(out, { recursive: true });
const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;

// Motive je Welt im Raster 0..40 (Mitte 20/20), nur Pfade
const MOTIF = {
  // Saloon: Sheriffstern
  'tw-14': '<path d="M20 3l4.2 8.6 9.5.6-7.3 6.1 2.4 9.2L20 22.4l-8.8 5.1 2.4-9.2-7.3-6.1 9.5-.6z"/><circle cx="20" cy="17" r="3.2" fill-opacity=".0" stroke-width="1.6"/>',
  // Dampf & Messing: Zahnrad
  'tw-03': '<path d="M17.5 3h5l.8 4.2 3 1.3 3.6-2.4 3.5 3.5-2.4 3.6 1.3 3 4.2.8v5l-4.2.8-1.3 3 2.4 3.6-3.5 3.5-3.6-2.4-3 1.3-.8 4.2h-5l-.8-4.2-3-1.3-3.6 2.4-3.5-3.5 2.4-3.6-1.3-3L3 22.5v-5l4.2-.8 1.3-3-2.4-3.6 3.5-3.5 3.6 2.4 3-1.3zM20 13a7 7 0 100 14 7 7 0 000-14z"/>',
  // Neon-Arcade: Pixelkrone
  'tw-13': '<path d="M6 12h4v4h4v-6h4v4h4v-4h4v6h4v-4h4v18H6zM10 28h20v4H10z"/>',
  // Schatten über Neuengland: Leuchtturm
  'tw-01': '<path d="M17 6h6l1 4h-8zM15.5 11h9l2 22h-13zM12 34h16v3H12zM23 7l9-3v6zM17 7l-9-3v6z"/>',
  // Baker Street: Lupe
  'tw-02': '<path d="M17 4a12 12 0 110 24 12 12 0 010-24zm0 4a8 8 0 100 16 8 8 0 000-16zM25 27l4-4 8 8-4 4z"/>',
  // Runen & Nordlicht: Runenknoten
  'tw-09': '<path d="M18 4h4v32h-4zM22 9l9-5 2 3.5-11 6zM22 19l9 5-2 3.5-9-5zM18 14l-9-5-2 3.5 11 6z"/>',
  // Tafelrunde: Wappenschild mit Balken
  'tw-10': '<path d="M6 5h28v14c0 9-6 14-14 17C12 33 6 28 6 19z"/><path d="M6 15h28v5H6z" opacity=".45"/>',
};
// Farben je Welt: Rücken (Grund, Muster, Rand, Medaillon), Rahmenfarbe, Tisch (Grund, Muster), Emblemfarbe
const LOOK = {
  'tw-14': { back: '#5a1f1c', pat: '#c79a4a', edge: '#f3e6c8', medal: '#2b1a10', frame: '#a0742e', table: '#1f3b2c', tpat: '#2c5a3f', emblem: '#7a4a1c', face: '#f3e6c8' },
  'tw-03': { back: '#1d4e63', pat: '#b87333', edge: '#e2c189', medal: '#13262f', frame: '#9a5b28', table: '#13262f', tpat: '#1f3d4a', emblem: '#9a5b28', face: '#f1e7d0' },
  'tw-13': { back: '#1a1640', pat: '#ff3fb4', edge: '#2de2e6', medal: '#0d0b1f', frame: '#7a2fff', table: '#0d0b1f', tpat: '#2de2e6', emblem: '#7a2fff', face: '#f4f6ff' },
  'tw-01': { back: '#1d2a2a', pat: '#b08d4a', edge: '#d9c79a', medal: '#0f1716', frame: '#6b5530', table: '#0f1716', tpat: '#22302e', emblem: '#3c4e4a', face: '#efe3c6' },
  'tw-02': { back: '#2a2622', pat: '#e8c766', edge: '#efe6d2', medal: '#1d1b19', frame: '#5a4636', table: '#3a2420', tpat: '#4c2e27', emblem: '#5a4636', face: '#efe6d2' },
  'tw-09': { back: '#2b3236', pat: '#6fe0b0', edge: '#d9d2c3', medal: '#1d2226', frame: '#4a6f7f', table: '#1d2226', tpat: '#2b3a3a', emblem: '#4a6f7f', face: '#ece6d8' },
  'tw-10': { back: '#23408e', pat: '#d4a83c', edge: '#f4ead2', medal: '#9e2a2b', frame: '#9e2a2b', table: '#2a1d14', tpat: '#3a2618', emblem: '#23408e', face: '#f4ead2' },
};
// Muster der Rückseite je Welt (100 × 140)
const PATTERN = {
  'tw-14': (c) => `<path d="${[...Array(12)].map((_, i) => `M${i * 12 - 40} 0l${70} 140M${i * 12 + 30} 0l-70 140`).join('')}" stroke="${c.pat}" stroke-opacity=".45" stroke-width="1.4"/>`, // Messing-Rautengitter
  'tw-03': (c) => [...Array(6)].map((_, i) => `<circle cx="${(i % 2) * 100}" cy="${i * 28}" r="20" fill="none" stroke="${c.pat}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 3"/>`).join('') + `<path d="M0 70h100M50 0v140" stroke="${c.pat}" stroke-opacity=".35"/>`, // Zahnkränze, Peilkreuz
  'tw-13': (c) => `<path d="${[...Array(11)].map((_, i) => `M0 ${i * 14}h100`).join('')}" stroke="${c.edge}" stroke-opacity=".25"/><path d="${[...Array(8)].map((_, i) => `M${i * 14} 0v140`).join('')}" stroke="${c.pat}" stroke-opacity=".3"/>`, // Neonraster
  'tw-01': (c) => `<path d="${[...Array(10)].map((_, i) => `M0 ${i * 15 + 8}q12-6 25 0t25 0 25 0 25 0`).join('')}" fill="none" stroke="${c.pat}" stroke-opacity=".35" stroke-width="1.2"/>`, // Hafenwellen
  'tw-02': (c) => `<path d="${[...Array(10)].map((_, i) => `M0 ${i * 14}h100`).join('')}${[...Array(10)].map((_, i) => `M${(i % 2) * 12 + 6} ${i * 14}v14M${(i % 2) * 12 + 30} ${i * 14}v14M${(i % 2) * 12 + 54} ${i * 14}v14M${(i % 2) * 12 + 78} ${i * 14}v14`).join('')}" stroke="${c.pat}" stroke-opacity=".22"/>`, // Backsteinfugen im Gaslicht
  'tw-09': (c) => `<path d="${[...Array(7)].map((_, i) => `M${i * 16 + 4} 8v14l6-5M${i * 16 + 4} 118v14l6-5`).join('')}" fill="none" stroke="${c.pat}" stroke-opacity=".6" stroke-width="1.6"/><path d="M0 52q25-14 50 0t50 0M0 60q25-14 50 0t50 0" fill="none" stroke="${c.pat}" stroke-opacity=".3" stroke-width="3"/>`, // Runenband, Polarlicht
  'tw-10': (c) => `<path d="M0 0h50v70H0zM50 70h50v70H50z" fill="${c.medal}" fill-opacity=".55"/><path d="M50 0v140M0 70h100" stroke="${c.pat}" stroke-width="2"/>`, // geviertet
};
function back(id) {
  const c = LOOK[id];
  return svg(100, 140, `<rect width="100" height="140" rx="8" fill="${c.back}"/>${PATTERN[id](c)}<rect x="5" y="5" width="90" height="130" rx="5" fill="none" stroke="${c.edge}" stroke-width="2"/><circle cx="50" cy="70" r="21" fill="${c.medal}" stroke="${c.pat}" stroke-width="2.5"/><g transform="translate(34 54) scale(.8)" fill="${c.pat}" stroke="${c.pat}">${MOTIF[id]}</g>`, ' preserveAspectRatio="none"');
}
// Kartenrahmen: feine Doppellinie und Eckzier; wird auf die Kartengröße gestreckt (Linien behalten ihre Stärke)
function frame(id) {
  const c = LOOK[id], k = 'vector-effect="non-scaling-stroke"';
  return svg(100, 140, `<rect x="3.5" y="3.5" width="93" height="133" rx="5" fill="none" stroke="${c.frame}" stroke-width="1.5" ${k}/><rect x="6.5" y="6.5" width="87" height="127" rx="3" fill="none" stroke="${c.frame}" stroke-opacity=".45" stroke-width="1" ${k}/><g fill="${c.frame}"><path d="M3 3h9l-9 9zM97 3h-9l9 9zM3 137h9l-9-9zM97 137h-9l9-9z"/></g>`, ' preserveAspectRatio="none"');
}
// Blasses Wasserzeichen: Wert und Farbsymbol liegen darüber und bleiben voll lesbar (Deckkraft 0,16)
const emblem = (id) => svg(40, 40, `<g fill="${LOOK[id].emblem}" fill-opacity=".16" stroke="${LOOK[id].emblem}" stroke-opacity=".3" stroke-width=".6">${MOTIF[id]}</g>`);
const TABLE = {
  'tw-14': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(24)].map((_, i) => `M0 ${i * 10 + 3}h240`).join('')}" stroke="${c.tpat}" stroke-opacity=".5"/>`, // Filz mit Strich
  'tw-03': (c) => `<rect width="240" height="240" fill="${c.table}"/><g fill="none" stroke="${c.tpat}" stroke-width="2"><circle cx="60" cy="60" r="40"/><circle cx="180" cy="180" r="40"/><path d="M60 20v80M20 60h80M180 140v80M140 180h80"/></g>`, // Seekarte mit Peilrosen
  'tw-13': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(12)].map((_, i) => `M0 ${i * 20}h240M${i * 20} 0v240`).join('')}" stroke="${c.tpat}" stroke-opacity=".12"/>`, // Neonraster
  'tw-01': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(12)].map((_, i) => `M0 ${i * 20 + 10}q30-8 60 0t60 0 60 0 60 0`).join('')}" fill="none" stroke="${c.tpat}" stroke-width="2"/>`, // dunkles Hafenwasser
  'tw-02': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(12)].map((_, i) => `M0 ${i * 20}h240${[...Array(5)].map((_, k) => `M${k * 48 + (i % 2) * 24} ${i * 20}v20`).join('')}`).join('')}" stroke="${c.tpat}" stroke-width="2"/>`, // Backstein
  'tw-09': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(12)].map((_, i) => `M0 ${i * 20 + 6}C80 ${i * 20 + 3} 160 ${i * 20 + 9} 240 ${i * 20 + 6}`).join('')}" fill="none" stroke="${c.tpat}" stroke-width="1.5"/>`, // Langhausdielen
  'tw-10': (c) => `<rect width="240" height="240" fill="${c.table}"/><path d="${[...Array(12)].map((_, i) => `M0 ${i * 20 + 6}C80 ${i * 20 + 3} 160 ${i * 20 + 9} 240 ${i * 20 + 6}`).join('')}" fill="none" stroke="${c.tpat}" stroke-width="1.5"/><rect y="114" width="240" height="10" fill="#2a2a2e"/>`, // Burgholz mit Eisenband
};
function preview(id) {
  const c = LOOK[id];
  const card = (x, rot, inner) => `<g transform="translate(${x} 30) rotate(${rot} 40 56)">${inner}</g>`;
  const face = `<rect width="80" height="112" rx="7" fill="${c.face}" stroke="${c.frame}" stroke-width="3"/><g transform="translate(20 34)" fill="${c.emblem}" fill-opacity=".35">${MOTIF[id]}</g><text x="9" y="24" font-family="Georgia,serif" font-weight="700" font-size="20" fill="#9e1c1c">K</text>`;
  const bk = `<rect width="80" height="112" rx="7" fill="${c.back}" stroke="${c.edge}" stroke-width="3"/><circle cx="40" cy="56" r="17" fill="${c.medal}" stroke="${c.pat}" stroke-width="2"/><g transform="translate(27 43) scale(.65)" fill="${c.pat}">${MOTIF[id]}</g>`;
  return svg(288, 180, `<rect width="288" height="180" fill="${c.table}"/>${card(70, -8, bk)}${card(138, 6, face)}`);
}
const files = {};
for (const id of Object.keys(LOOK)) Object.assign(files, { [`table-${id}.svg`]: svg(240, 240, TABLE[id](LOOK[id])), [`back-${id}.svg`]: back(id), [`frame-${id}.svg`]: frame(id), [`emblem-${id}.svg`]: emblem(id), [`preview-${id}.svg`]: preview(id) });
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${Object.keys(files).length} Dateien in ${out}`);
