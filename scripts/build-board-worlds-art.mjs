// ART-W3 · Brettwelten TW-08 Götterberg, TW-09 Runen & Nordlicht (Brett), TW-10 Tafelrunde:
// erzeugt die eigenen SVG-Grafiken unter public/games/theme-worlds/board/ (Tischkachel, helle/dunkle Feldtextur, Vorschau je Welt).
//   node scripts/build-board-worlds-art.mjs
// Alles hier gezeichnet (Pfade, Verläufe) – keine Vorlage, keine fremden Motive, Marken oder Figuren.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dirname, '..', 'public', 'games', 'theme-worlds', 'board');
mkdirSync(out, { recursive: true });
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const f1 = (n) => +n.toFixed(1);

// Marmor: Grundton mit weichen Adern (Kachel 120 × 120, nahtlos genug durch an den Rändern auslaufende Adern)
function marble(seed, base, vein, alpha) {
  const r = lcg(seed); let b = `<rect width="120" height="120" fill="${base}"/>`;
  for (let i = 0; i < 6; i++) { let x = r() * 120, y = -10, d = `M${f1(x)} ${y}`; for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 34; y += 24; d += ` Q${f1(x + (r() - 0.5) * 20)} ${f1(y - 12)} ${f1(x)} ${y}`; } b += `<path d="${d}" fill="none" stroke="${vein}" stroke-opacity="${alpha}" stroke-width="${f1(0.6 + r() * 1.6)}"/>`; }
  return svg(120, 120, b);
}
// Holz: Maserung quer (Kachel 120 × 120)
function wood(seed, base, grain, alpha) {
  const r = lcg(seed); let b = `<rect width="120" height="120" fill="${base}"/>`;
  for (let i = 0; i < 12; i++) { const y = i * 10 + r() * 6; b += `<path d="M0 ${f1(y)}C40 ${f1(y + r() * 4 - 2)} 80 ${f1(y + r() * 4 - 2)} 120 ${f1(y)}" stroke="${grain}" stroke-opacity="${alpha}" fill="none"/>`; }
  if (r() > 0.3) b += `<ellipse cx="${f1(20 + r() * 80)}" cy="${f1(20 + r() * 80)}" rx="7" ry="3" fill="none" stroke="${grain}" stroke-opacity="${alpha + 0.1}"/>`;
  return svg(120, 120, b);
}
// Stein: Körnung
function stone(seed, base, speck, alpha) {
  const r = lcg(seed); let b = `<rect width="120" height="120" fill="${base}"/>`;
  for (let i = 0; i < 70; i++) b += `<circle cx="${f1(r() * 120)}" cy="${f1(r() * 120)}" r="${f1(0.4 + r() * 1.4)}" fill="${speck}" fill-opacity="${f1(alpha * (0.4 + r()))}"/>`;
  return svg(120, 120, b);
}
const TABLE = {
  // Götterberg: Steinplatten mit Mäanderfries
  'tw-08': () => svg(240, 240, '<rect width="240" height="240" fill="#1d2a36"/><g fill="#22323f" stroke="#2c4152" stroke-width="2"><rect x="4" y="4" width="112" height="112"/><rect x="124" y="4" width="112" height="112"/><rect x="4" y="124" width="112" height="112"/><rect x="124" y="124" width="112" height="112"/></g><path d="M0 120h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8v-6h8v6h8" fill="none" stroke="#c9a24a" stroke-opacity=".35" stroke-width="2"/>'),
  // Runen & Nordlicht: dunkle Langhausdielen mit Runenritzung
  'tw-09': () => { const w = wood(9, '#1f2428', '#3a444a', 0.6).replace(/^<svg[^>]*>|<\/svg>\n$/g, ''); return svg(240, 240, `<g transform="scale(2)">${w}</g><g fill="none" stroke="#8fd3c4" stroke-opacity=".16" stroke-width="2"><path d="M40 50v30M40 58l10-7M40 70l10 7"/><path d="M180 170v30M180 170l10 10-10 10"/></g>`); },
  // Tafelrunde: Burgholz mit Eisenbeschlägen
  'tw-10': () => { const w = wood(10, '#3a2618', '#6a4428', 0.5).replace(/^<svg[^>]*>|<\/svg>\n$/g, ''); return svg(240, 240, `<g transform="scale(2)">${w}</g><g fill="#2a2a2e" stroke="#55555c" stroke-width="1.5"><rect x="0" y="108" width="240" height="10"/><circle cx="30" cy="113" r="3"/><circle cx="120" cy="113" r="3"/><circle cx="210" cy="113" r="3"/></g>`); },
};
const FIELDS = {
  'tw-08': { light: () => marble(81, '#f2efe8', '#9aa3ab', 0.45), dark: () => marble(82, '#3d4650', '#aab4bd', 0.35) },
  'tw-09': { light: () => wood(91, '#d9d2c3', '#a49478', 0.5), dark: () => stone(92, '#2b3236', '#7d8a91', 0.6) },
  'tw-10': { light: () => wood(101, '#e9dcc0', '#b89c6a', 0.45), dark: () => wood(102, '#2a2f45', '#46506e', 0.6) },
};
// Vorschau (288 × 180): Brettausschnitt 4 × 4, zwei Figurenkreise in den Weltfarben
const LOOK = {
  'tw-08': { frame: '#c9a24a', light: '#f2efe8', dark: '#3d4650', a: '#f6f2ea', b: '#1f5f8b', bg: '#1d2a36' },
  'tw-09': { frame: '#6fe0b0', light: '#d9d2c3', dark: '#2b3236', a: '#e8e2d4', b: '#2b3236', bg: '#1d2226' },
  'tw-10': { frame: '#d4a83c', light: '#e9dcc0', dark: '#2a2f45', a: '#f1e6cc', b: '#9e2a2b', bg: '#2a1d14' },
};
function preview(id) {
  const l = LOOK[id]; let b = `<rect width="288" height="180" fill="${l.bg}"/><rect x="74" y="10" width="140" height="160" rx="6" fill="${l.frame}"/>`;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) b += `<rect x="${80 + c * 32}" y="${18 + r * 36}" width="32" height="36" fill="${(r + c) % 2 ? l.dark : l.light}"/>`;
  b += `<circle cx="112" cy="72" r="11" fill="${l.a}" stroke="#111" stroke-width="2"/><circle cx="176" cy="108" r="11" fill="${l.b}" stroke="#eee" stroke-width="2"/>`;
  b += `<path d="M30 160V40h14v120M244 160V40h14v120" fill="${l.frame}" fill-opacity=".55"/>`;
  return svg(288, 180, b);
}
const files = {};
for (const id of Object.keys(TABLE)) { files[`table-${id}.svg`] = TABLE[id](); files[`light-${id}.svg`] = FIELDS[id].light(); files[`dark-${id}.svg`] = FIELDS[id].dark(); files[`preview-${id}.svg`] = preview(id); }
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${Object.keys(files).length} Dateien in ${out}`);
