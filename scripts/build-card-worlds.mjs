// ART-T1: erzeugt die Bilder und Variablen der Kartenwelten aus public/games/card-worlds/worlds.js.
//   node scripts/build-card-worlds.mjs
// Ausgabe: public/games/card-worlds/art/<ID>/{0,1,2,3,w,back}.svg und public/games/card-worlds/worlds.css.
// Die Bilder sind statische SVG-Dateien (vom Browser zwischengespeichert, kein SVG pro Karte im DOM).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLDS, FONTS, roles } from '../public/games/card-worlds/worlds.js';
import { M, TERRAIN, PARTICLES } from './card-worlds/motifs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/games/card-worlds');

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (a) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ink = (h) => (lum(h) > 0.45 ? '#1b1408' : '#ffffff');

// Fensterform je Rahmen (viewBox 60×64)
const CLIP = {
  gilded: '<path d="M2 62V22C2 8 16 2 30 2s28 6 28 20v40Z"/>',
  voxel: '<rect x="1" y="1" width="58" height="62"/>',
  crystal: '<path d="M10 1h40l9 9v44l-9 9H10l-9-9V10Z"/>',
  storybook: '<rect x="1" y="1" width="58" height="62" rx="12"/>',
};
const clip = (frame) => CLIP[frame] || '<rect x="1" y="1" width="58" height="62" rx="6"/>';

// Kartenfenster: Himmel (in Kartenfarbe getönt), Teilchen, Gelände, Lichthof und großes Motiv
function windowSVG(w, color, motif, seed) {
  const [s1, s2] = w.sky, ground = mix(w.tbl, '#000000', 0.3), id = `${w.id}-${seed}`;
  const shape = clip(w.frame);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 64"><defs><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset=".8" stop-color="${mix(s2, color, 0.3)}"/></linearGradient>`
    + `<radialGradient id="h${id}" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><clipPath id="c${id}">${shape}</clipPath></defs>`
    + `<g clip-path="url(#c${id})"><rect width="60" height="64" fill="url(#s${id})"/>${(PARTICLES[w.par] || PARTICLES.none)(seed)}<circle cx="30" cy="30" r="27" fill="url(#h${id})"/>${(TERRAIN[w.ter] || TERRAIN.none)(ground)}`
    + `<g transform="translate(5 3) scale(.84)">${motif}</g></g>`
    + `<g fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="2">${shape}</g></svg>`;
}

// Farbwahl / Joker / Aussetzen: Rückseitenmotiv mit Vier-Farben-Ring
function wildSVG(w, order) {
  const id = `${w.id}-w`, c = order.map((i) => w.cols[i][1]), shape = clip(w.frame);
  const arc = (k) => { const a0 = (k * 90 - 90) * Math.PI / 180, a1 = ((k + 1) * 90 - 90) * Math.PI / 180, r = 20;
    return `<path d="M${30 + r * Math.cos(a0)} ${32 + r * Math.sin(a0)}A${r} ${r} 0 0 1 ${30 + r * Math.cos(a1)} ${32 + r * Math.sin(a1)}" stroke="${c[k]}" stroke-width="5" fill="none"/>`; };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 64"><defs><radialGradient id="g${id}" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="${mix(w.tbl, '#ffffff', 0.25)}"/><stop offset="1" stop-color="${mix(w.tbl, '#000000', 0.55)}"/></radialGradient><clipPath id="c${id}">${shape}</clipPath></defs>`
    + `<g clip-path="url(#c${id})"><rect width="60" height="64" fill="url(#g${id})"/>${(PARTICLES[w.par] || PARTICLES.none)(5)}${[0, 1, 2, 3].map(arc).join('')}`
    + `<g transform="translate(15 17) scale(.5)">${(M[w.back] || M.star)(c[0])}</g></g><g fill="none" stroke="#ffffff" stroke-opacity=".85" stroke-width="2">${shape}</g></svg>`;
}

// Rückseite (5:7)
function backSVG(w) {
  const id = `${w.id}-b`, c = w.cols[0][1], c2 = w.cols[1][1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 84"><defs><radialGradient id="g${id}" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${mix(w.tbl, '#000000', 0.45)}"/></radialGradient>`
    + `<pattern id="p${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="8" fill="#ffffff" fill-opacity=".07"/></pattern></defs>`
    + `<rect width="60" height="84" fill="url(#g${id})"/><rect width="60" height="84" fill="url(#p${id})"/>${(PARTICLES[w.par] || PARTICLES.none)(3)}`
    + `<rect x="4" y="4" width="52" height="76" rx="5" fill="none" stroke="#ffffff" stroke-opacity=".8" stroke-width="1.5"/>`
    + `<circle cx="30" cy="40" r="19" fill="${mix(w.tbl, '#000000', 0.3)}" fill-opacity=".55" stroke="${c2}" stroke-width="2.5" stroke-dasharray="4 3"/>`
    + `<g transform="translate(15 25) scale(.5)">${(M[w.back] || M.star)(c2)}</g></svg>`;
}

rmSync(join(OUT, 'art'), { recursive: true, force: true });
const css = [
  '/* Erzeugt von scripts/build-card-worlds.mjs (ART-T1) – nicht von Hand ändern. */',
  ...Object.entries(FONTS).map(([family, file]) => `@font-face{font-family:'${family}';src:url('/fonts/worlds/${file}.woff2') format('woff2');font-display:swap}`),
];
let files = 0;
for (const w of WORLDS) {
  const dir = join(OUT, 'art', w.id);
  mkdirSync(dir, { recursive: true });
  w.cols.forEach(([, color, motif], i) => { writeFileSync(join(dir, `${i}.svg`), windowSVG(w, color, (M[motif] || M.star)(color), i)); files++; });
  const role = roles(w);
  writeFileSync(join(dir, 'w.svg'), wildSVG(w, [role.r, role.y, role.g, role.b]));
  writeFileSync(join(dir, 'back.svg'), backSVG(w));
  files += 2;
  const art = (n) => `url('/games/card-worlds/art/${w.id}/${n}.svg')`;
  const v = [];
  w.cols.forEach(([, color], i) => v.push(`--cw-c${i}:${color}`, `--cw-i${i}:${ink(color)}`, `--cw-a${i}:${art(i)}`));
  for (const k of ['r', 'y', 'g', 'b']) { const i = role[k]; v.push(`--cw-c${k}:${w.cols[i][1]}`, `--cw-i${k}:${ink(w.cols[i][1])}`, `--cw-a${k}:${art(i)}`); }
  const accent = mix(w.cols[0][1], '#ffffff', 0.35);
  v.push(`--cw-aw:${art('w')}`, `--cw-back:${art('back')}`, `--cw-font:'${w.font}'`,
    `--cwt-sky:${w.sky[0]}`, `--cwt-bg:${mix(w.tbl, '#000000', 0.55)}`, `--cwt-panel:${mix(w.tbl, '#000000', 0.38)}`,
    `--cwt-table:${w.tbl}`, `--cwt-table-hi:${mix(w.tbl, '#ffffff', 0.18)}`, `--cwt-table-lo:${mix(w.tbl, '#000000', 0.42)}`,
    `--cwt-accent:${accent}`, `--cwt-edge:${mix(accent, '#000000', 0.3)}55`);
  css.push(`body[data-card-world="${w.id}"]{${v.join(';')}}`);
}
writeFileSync(join(OUT, 'worlds.css'), css.join('\n') + '\n');
console.log(`${WORLDS.length} Welten, ${files} Bilder, worlds.css geschrieben`);
