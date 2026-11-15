// ART-W2 · Würfelwelten TW-14 Saloon, TW-11 Piratenbucht, TW-09 Runen & Nordlicht, TW-13 Neon-Arcade:
// erzeugt die eigenen SVG-Grafiken unter public/games/theme-worlds/dice/ (Tischkachel, Becher, Vorschau je Welt).
//   node scripts/build-dice-worlds-art.mjs
// Alles hier gezeichnet (Pfade, Verläufe, Muster) – keine Vorlage, keine fremden Motive, Marken oder Figuren.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dirname, '..', 'public', 'games', 'theme-worlds', 'dice');
mkdirSync(out, { recursive: true });
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const f1 = (n) => +n.toFixed(1);

// ---------- Tischkacheln (240 × 240, nahtlos wiederholbar) ----------
function planks(seed, colors, grain, extra = '') {
  const r = lcg(seed); let b = '';
  colors.forEach((c, i) => {
    const y = i * 40; b += `<rect y="${y}" width="240" height="39" fill="${c}"/><rect y="${y + 39}" width="240" height="1" fill="#0006"/>`;
    for (let k = 0; k < 4; k++) { const yy = y + 5 + r() * 30; b += `<path d="M0 ${f1(yy)}C80 ${f1(yy + r() * 3 - 1.5)} 160 ${f1(yy + r() * 3 - 1.5)} 240 ${f1(yy)}" stroke="${grain}" stroke-opacity=".35" fill="none"/>`; }
    const knot = 20 + r() * 200; if (r() > 0.5) b += `<ellipse cx="${f1(knot)}" cy="${y + 20}" rx="6" ry="3" fill="none" stroke="${grain}" stroke-opacity=".4"/>`;
  });
  return svg(240, 240, b + extra);
}
const TABLES = {
  'tw-14': () => planks(14, ['#4a2c18', '#43281a', '#4d2f1b', '#402516', '#4a2b17', '#452a19'], '#7a4d2c', '<circle cx="60" cy="100" r="2" fill="#2a170c"/><circle cx="180" cy="180" r="2" fill="#2a170c"/>'),
  'tw-11': () => planks(11, ['#2f2216', '#2a1e14', '#33251a', '#291d13', '#302318', '#2c2016'], '#5a432c',
    '<g fill="none" stroke="#c8b07a" stroke-opacity=".16"><circle cx="120" cy="120" r="70"/><circle cx="120" cy="120" r="44"/><path d="M120 30v180M30 120h180M56 56l128 128M184 56L56 184"/></g><path d="M120 62l7 58-7 58-7-58z" fill="#c8b07a" fill-opacity=".18"/>'),
  'tw-09': () => planks(9, ['#2a2622', '#26221e', '#2d2924', '#24201c', '#2b2723', '#27231f'], '#4d463d',
    '<g fill="none" stroke="#8fd3c4" stroke-opacity=".14" stroke-width="2"><path d="M40 60v34M40 70l12-8M40 82l12 8"/><path d="M190 150v34M190 150l12 12-12 12"/><path d="M110 200v28M100 210h20"/></g>'),
  'tw-13': () => svg(240, 240, '<rect width="240" height="240" fill="#120a26"/><g stroke="#ff4fd8" stroke-opacity=".22" stroke-width="1.2">' + [0, 40, 80, 120, 160, 200].map((v) => `<path d="M${v} 0V240M0 ${v}H240"/>`).join('') + '</g><g stroke="#22e3ff" stroke-opacity=".12"><path d="M20 0V240M60 0V240M100 0V240M140 0V240M180 0V240M220 0V240"/></g>'),
};

// ---------- Becher (120 × 110, Öffnung oben, wie der Mäxchen-Becher) ----------
const CUPS = {
  'tw-14': () => svg(120, 110, '<path d="M16 12h88l-10 88H26z" fill="#5a3320"/><path d="M16 12h88l-2 14H18z" fill="#3e2214"/><path d="M22 44h76M20 70h80" stroke="#c89a52" stroke-width="3"/><g fill="#c89a52"><circle cx="30" cy="44" r="3"/><circle cx="90" cy="44" r="3"/><circle cx="28" cy="70" r="3"/><circle cx="92" cy="70" r="3"/></g><path d="M40 28v66M80 28v66" stroke="#2c180c" stroke-width="1.5" stroke-dasharray="4 4"/><ellipse cx="60" cy="100" rx="34" ry="6" fill="#2c180c"/>'),
  'tw-11': () => svg(120, 110, '<path d="M18 12h84l-6 88H24z" fill="#6b4a2a"/><path d="M18 12h84l-1 12H19z" fill="#4a321c"/><g stroke="#3a2614" stroke-width="2"><path d="M38 24l-3 76M60 24v76M82 24l3 76"/></g><path d="M20 40h80M22 82h76" stroke="#8a8f94" stroke-width="5"/><path d="M20 40h80M22 82h76" stroke="#c6cbcf" stroke-width="1.5"/><ellipse cx="60" cy="100" rx="36" ry="6" fill="#2a1a0e"/>'),
  'tw-09': () => svg(120, 110, '<path d="M14 12h92l-12 88H26z" fill="#4a4038"/><path d="M14 12h92l-2 12H16z" fill="#c9b38a"/><path d="M14 12h92l-1 6H15z" fill="#e9dcbc"/><g fill="none" stroke="#8fd3c4" stroke-width="2.4" stroke-linecap="round"><path d="M42 40v34M42 48l10-7M42 60l10 7"/><path d="M62 40v34M62 40l10 10-10 10"/><path d="M82 40v34M74 52h16"/></g><ellipse cx="60" cy="100" rx="34" ry="6" fill="#1e1915"/>'),
  'tw-13': () => svg(120, 110, '<path d="M16 12h88l-10 88H26z" fill="#1a1036"/><path d="M16 12h88l-10 88H26z" fill="none" stroke="#22e3ff" stroke-width="3"/><path d="M16 12h88" stroke="#ff4fd8" stroke-width="4"/><path d="M24 46h72M22 74h76" stroke="#ff4fd8" stroke-width="2" stroke-opacity=".8"/><path d="M40 30l40 0M46 90l28 0" stroke="#ffe14d" stroke-width="2" stroke-opacity=".7"/><ellipse cx="60" cy="100" rx="34" ry="6" fill="#07040f"/>'),
};

// ---------- Vorschau (288 × 180): Tisch, Becher und drei Würfel in Weltfarben ----------
const LOOK = {
  'tw-14': { face: '#efe3c6', pip: '#2a1a10', edge: '#8a6a3a' },
  'tw-11': { face: '#ecdcb4', pip: '#1f2a33', edge: '#7a5a34' },
  'tw-09': { face: '#bfc4c0', pip: '#16232b', edge: '#59646a' },
  'tw-13': { face: '#150f2e', pip: '#ff4fd8', edge: '#22e3ff' },
};
const PIPS = { 1: [[0.5, 0.5]], 3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], 6: [[0.27, 0.22], [0.27, 0.5], [0.27, 0.78], [0.73, 0.22], [0.73, 0.5], [0.73, 0.78]] };
const die = (x, y, s, n, l, rot) => `<g transform="translate(${x} ${y}) rotate(${rot} ${s / 2} ${s / 2})"><rect width="${s}" height="${s}" rx="${s * 0.2}" fill="${l.face}" stroke="${l.edge}" stroke-width="2"/>${PIPS[n].map(([px, py]) => `<circle cx="${f1(px * s)}" cy="${f1(py * s)}" r="${f1(s * 0.09)}" fill="${l.pip}"/>`).join('')}</g>`;
function preview(id) {
  const tile = TABLES[id]().replace(/^<svg[^>]*>|<\/svg>\n$/g, ''), cup = CUPS[id]().replace(/^<svg[^>]*>|<\/svg>\n$/g, ''), l = LOOK[id];
  return svg(288, 180, `<g transform="scale(1.2 .75)">${tile}</g><g transform="translate(20 46) scale(.9)">${cup}</g>${die(140, 70, 44, 5, l, -8)}${die(196, 92, 44, 6, l, 6)}${die(166, 30, 40, 3, l, 14)}`);
}

const files = {};
for (const id of Object.keys(TABLES)) { files[`table-${id}.svg`] = TABLES[id](); files[`cup-${id}.svg`] = CUPS[id](); files[`preview-${id}.svg`] = preview(id); }
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${Object.keys(files).length} Dateien in ${out}`);
