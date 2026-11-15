// ART-W1 · TW-01 „Schatten über Neuengland“: erzeugt die eigenen SVG-Grafiken unter public/games/theme-worlds/tw-01/.
//   node scripts/build-tw01-art.mjs
// Alles ist hier gezeichnet (Pfade, Verläufe, Muster) – keine Vorlage, kein fremdes Motiv, keine Schrift aus fremden Quellen.
// Motive: neblige Hafenstadt der 1920er, Leuchtturm, Lagerhäuser, Messing, Leder, alte Bücher; Unheimliches nur angedeutet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const out = process.argv[2] ? resolve(process.argv[2]) : join(import.meta.dirname, '..', 'public', 'games', 'theme-worlds', 'tw-01');
mkdirSync(out, { recursive: true });
const BRASS = '#c8a462', BRASS_D = '#8c6a33', INK = '#1d1a15', SEA = '#1b2a33', SLATE = '#2f4550', PAPER = '#e6dcc3', FOG = '#cfd6d4';
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>\n`;
const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);

// Leuchtturm (für Szene, Hotel-Marker und Kartenrücken), Fuß bei (x, y), Höhe h
function lighthouse(x, y, h, { light = true, color = '#e9e2cf', stripe = '#7a2a24' } = {}) {
  const w = h * 0.22, top = y - h, t = w * 0.62;
  return `<path d="M${x - w / 2} ${y}L${x - t / 2} ${top + h * 0.18}H${x + t / 2}L${x + w / 2} ${y}Z" fill="${color}"/>`
    + `<path d="M${x - w * 0.47} ${y - h * 0.22}L${x - w * 0.42} ${y - h * 0.38}H${x + w * 0.42}L${x + w * 0.47} ${y - h * 0.22}Z" fill="${stripe}"/>`
    + `<path d="M${x - w * 0.4} ${y - h * 0.55}L${x - w * 0.36} ${y - h * 0.68}H${x + w * 0.36}L${x + w * 0.4} ${y - h * 0.55}Z" fill="${stripe}"/>`
    + `<rect x="${x - t * 0.62}" y="${top + h * 0.13}" width="${t * 1.24}" height="${h * 0.05}" fill="#2a2420"/>`
    + `<rect x="${x - t * 0.38}" y="${top + h * 0.03}" width="${t * 0.76}" height="${h * 0.1}" fill="${light ? '#ffe7a3' : '#6d6a5e'}" stroke="#2a2420" stroke-width="${h * 0.012}"/>`
    + `<path d="M${x - t * 0.5} ${top + h * 0.03}Q${x} ${top - h * 0.06} ${x + t * 0.5} ${top + h * 0.03}Z" fill="#2a2420"/>`;
}

// ---------- Vorschau für das Host-Menü (288 × 180) ----------
function scene(W, H, { beam = true } = {}) {
  const r = lcg(11);
  let b = `<rect width="${W}" height="${H}" fill="url(#sky)"/><circle cx="${W * 0.78}" cy="${H * 0.22}" r="${H * 0.07}" fill="#e8e2c8" opacity=".85"/>`;
  if (beam) b += `<path d="M${W * 0.27} ${H * 0.33}L${W} ${H * 0.12}V${H * 0.36}Z" fill="url(#beam)"/>`;
  b += `<path d="M0 ${H * 0.62}L${W * 0.08} ${H * 0.5}L${W * 0.2} ${H * 0.47}L${W * 0.34} ${H * 0.58}L${W * 0.34} ${H}H0Z" fill="#1a2328"/>`;
  b += lighthouse(W * 0.27, H * 0.5, H * 0.36);
  // Häuserzeile mit Giebeln und Lagerhaus
  let x = W * 0.42; const base = H * 0.66;
  while (x < W) { const w = W * (0.05 + r() * 0.05), h = H * (0.08 + r() * 0.1); b += `<path d="M${x} ${base}V${base - h}L${x + w / 2} ${base - h - w * 0.45}L${x + w} ${base - h}V${base}Z" fill="#202b31"/>`; if (r() > 0.45) b += `<rect x="${x + w * 0.35}" y="${base - h * 0.6}" width="${w * 0.22}" height="${h * 0.22}" fill="#e8c46a" opacity=".8"/>`; x += w + W * 0.004; }
  b += `<rect y="${base}" width="${W}" height="${H - base}" fill="url(#sea)"/>`;
  for (let i = 0; i < 9; i++) { const y = base + (H - base) * (0.15 + i * 0.09); b += `<path d="M${r() * W * 0.3} ${y}h${W * (0.2 + r() * 0.4)}" stroke="#9fb4b5" stroke-opacity="${0.12 + r() * 0.12}" stroke-width="${H * 0.006}"/>`; }
  b += `<rect y="${H * 0.52}" width="${W}" height="${H * 0.22}" fill="url(#fog)"/>`;
  const defs = `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f171c"/><stop offset=".7" stop-color="${SLATE}"/><stop offset="1" stop-color="#5b6c6c"/></linearGradient>`
    + `<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3d44"/><stop offset="1" stop-color="#0c1316"/></linearGradient>`
    + `<linearGradient id="fog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${FOG}" stop-opacity="0"/><stop offset=".5" stop-color="${FOG}" stop-opacity=".35"/><stop offset="1" stop-color="${FOG}" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe7a3" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7a3" stop-opacity="0"/></linearGradient>`;
  return svg(W, H, b, defs);
}

// ---------- Tisch: dunkle, verwitterte Hafenplanken (Kachel 240 × 240) ----------
function table() {
  const r = lcg(5); let b = `<rect width="240" height="240" fill="#141b1f"/>`;
  for (let i = 0; i < 6; i++) {
    const y = i * 40, shade = ['#1a2328', '#172025', '#1c262b', '#161e22', '#1b2429', '#182126'][i];
    b += `<rect y="${y}" width="240" height="39" fill="${shade}"/><rect y="${y + 39}" width="240" height="1" fill="#0b0f11"/>`;
    for (let k = 0; k < 5; k++) { const yy = y + 4 + r() * 32; b += `<path d="M0 ${yy.toFixed(1)}C80 ${(yy + r() * 4 - 2).toFixed(1)} 160 ${(yy + r() * 4 - 2).toFixed(1)} 240 ${yy.toFixed(1)}" stroke="#2a363c" stroke-opacity=".5" fill="none"/>`; }
    const nail = 20 + r() * 200; b += `<circle cx="${nail.toFixed(0)}" cy="${y + 8}" r="1.6" fill="#3d4a4f"/><circle cx="${nail.toFixed(0)}" cy="${y + 31}" r="1.6" fill="#3d4a4f"/>`;
  }
  return svg(240, 240, b);
}

// ---------- Brettmitte: Hafen bei Nacht mit Leuchtturm (Bild hinter Würfeln und Text) ----------
const center = () => scene(600, 600, { beam: false });

// ---------- Kartenrücken: Leder, Messingrahmen, Leuchtturm-Emblem mit Kompassrose ----------
function cardBack() {
  let rays = '';
  for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8, l = i % 2 ? 26 : 40; rays += `<path d="M120 168L${(120 + Math.cos(a) * l).toFixed(1)} ${(168 + Math.sin(a) * l).toFixed(1)}" stroke="${BRASS}" stroke-width="${i % 2 ? 1 : 2}" stroke-opacity=".7"/>`; }
  const body = `<rect width="240" height="336" rx="14" fill="#3a2a22"/><rect width="240" height="336" rx="14" fill="url(#grain)"/>`
    + `<rect x="10" y="10" width="220" height="316" rx="9" fill="none" stroke="${BRASS}" stroke-width="3"/><rect x="18" y="18" width="204" height="300" rx="6" fill="none" stroke="${BRASS_D}" stroke-width="1.5" stroke-dasharray="4 4"/>`
    + `<circle cx="120" cy="168" r="58" fill="${SEA}" stroke="${BRASS}" stroke-width="3"/>${rays}`
    + lighthouse(120, 206, 92, { color: '#e6dcc3', stripe: '#7a2a24' })
    + `<path d="M62 206Q120 196 178 206" stroke="#9fb4b5" stroke-width="2" fill="none" stroke-opacity=".6"/>`
    + ['M40 52l10-10 10 10-10 10z', 'M180 52l10-10 10 10-10 10z', 'M40 284l10-10 10 10-10 10z', 'M180 284l10-10 10 10-10 10z'].map((d) => `<path d="${d}" fill="${BRASS}"/>`).join('');
  return svg(240, 336, body, `<pattern id="grain" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 6h24M0 15h24" stroke="#000" stroke-opacity=".12"/><path d="M3 0v24" stroke="#fff" stroke-opacity=".03"/></pattern>`);
}

// ---------- Figuren: Messing auf dunklem Grund, klar unterscheidbare Umrisse (40 × 40) ----------
const fig = (inner) => svg(40, 40, `<g fill="${BRASS}" stroke="#2a2018" stroke-width="1.4" stroke-linejoin="round">${inner}</g>`);
const TOKENS = {
  hat: fig('<path d="M14 9h12l2 4H12z"/><rect x="13" y="13" width="14" height="16" rx="2" fill="#ffe7a3"/><path d="M13 13h14M20 13v16M13 21h14" fill="none"/><path d="M11 29h18l-2 4H13z"/><path d="M18 9q2-5 4 0" fill="none"/>'), // Laterne
  car: fig('<circle cx="20" cy="20" r="14"/><circle cx="20" cy="20" r="10" fill="#e6dcc3"/><path d="M20 10l3 10-3 10-3-10z" fill="#7a2a24"/><path d="M20 10l3 10h-6z" fill="#2a2018"/>'), // Kompass
  dog: fig('<path d="M8 25q4-12 15-12l5-4 4 3-3 2q4 4 2 10l4 6-8-2q-8 4-19-3z" fill="#2c2f36"/><circle cx="27" cy="13" r="1.4" fill="#ffe7a3" stroke="none"/><path d="M13 30l-2 5M19 31l1 4" fill="none"/>'), // Rabe
  ship: fig('<circle cx="20" cy="8" r="3.5" fill="none"/><path d="M20 11.5v21"/><path d="M13 16h14"/><path d="M8 24q2 9 12 9t12-9l-4 2M8 24l4 2" fill="none" stroke-width="2.6"/>'), // Anker
  thimble: fig('<rect x="18" y="4" width="4" height="4" rx="1"/><circle cx="20" cy="22" r="13"/><circle cx="20" cy="22" r="10" fill="#e6dcc3"/><path d="M20 22V15M20 22l5 3" fill="none" stroke="#2a2018" stroke-width="2"/>'), // Taschenuhr
  barrow: fig('<circle cx="13" cy="13" r="7" fill="none" stroke-width="3.4"/><path d="M18 18l14 14M26 26l3-3M29 29l3-3" fill="none" stroke-width="3.4"/>'), // Schlüssel
  shoe: fig('<path d="M6 25l26-12 2 5-26 12z"/><path d="M4 26l4-2 3 6-4 2z" fill="#2a2018"/><path d="M31 13l4-2 2 5-4 2z"/><path d="M17 26l-4 9M19 25l5 10" fill="none"/>'), // Fernrohr
  cat: fig('<path d="M11 34V20l-2-10 6 5h10l6-5-2 10v14z" fill="#2c2f36"/><path d="M27 34q10 0 6-10" fill="none" stroke="#2c2f36" stroke-width="3"/><circle cx="16.5" cy="20" r="1.5" fill="#ffe7a3" stroke="none"/><circle cx="23.5" cy="20" r="1.5" fill="#ffe7a3" stroke="none"/>'), // Katze
};

// ---------- Gebäude: Fischerhütte (Haus) und Leuchtturm (Hotel) ----------
const house = () => svg(24, 24, '<path d="M3 12L12 4l9 8v9H3z" fill="#7a5a3c" stroke="#2a2018" stroke-width="1.2"/><path d="M3 12L12 4l9 8" fill="none" stroke="#5b2b26" stroke-width="2.4"/><rect x="10" y="14" width="4" height="7" fill="#2a2018"/><rect x="5.5" y="13.5" width="3" height="3" fill="#ffe7a3"/>');
const tower = () => svg(24, 24, lighthouse(12, 23, 21));

const files = { 'preview.svg': scene(288, 180), 'table.svg': table(), 'center.svg': center(), 'card-back.svg': cardBack(), 'house.svg': house(), 'lighthouse.svg': tower(), ...Object.fromEntries(Object.entries(TOKENS).map(([id, s]) => [`token-${id}.svg`, s])) };
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${Object.keys(files).length} Dateien in ${out}`);
