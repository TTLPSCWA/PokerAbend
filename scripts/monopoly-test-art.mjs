// Abstrakte Testgrafiken für die Monopoly-Theme-Pipeline (ART-046, Paket F): erzeugt PNG-Quellen und theme-src.json für das Test-Theme „testbed“.
//   node scripts/monopoly-test-art.mjs --out <Ordner> [--channel chrome|chromium]
// Alles ist prozedural gezeichnet (Farbverläufe, Polygone, Kreise, weiche Schatten) – keine Vorlage, keine Figur, keine Marke, nichts aus einem fremden Spiel.
// Zweck: Skalierung, Transparenz, Kanten und Dateigrößen der Pipeline mit realistischen Abmessungen prüfen. Das Theme wird nie ausgeliefert oder freigeschaltet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const lcg = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const hsl = (h, s, l, a = 1) => `hsla(${Math.round(h) % 360},${s}%,${l}%,${a})`;
const svg = (w, h, body, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

function board(w = 2560, h = 1440) {
  const r = lcg(7); let b = `<rect width="${w}" height="${h}" fill="url(#bg)"/>`;
  for (let i = 0; i <= 11; i++) { const t = i / 11; b += `<path d="M${w * 0.22 + t * w * 0.56} ${h * 0.14} L${w * 0.05 + t * w * 0.9} ${h * 0.94}" stroke="${hsl(190, 40, 70, 0.28)}" stroke-width="2"/><path d="M${w * (0.22 - 0.17 * t)} ${h * (0.14 + 0.8 * t)} L${w * (0.78 + 0.17 * t)} ${h * (0.14 + 0.8 * t)}" stroke="${hsl(190, 40, 70, 0.28)}" stroke-width="2"/>`; }
  for (let i = 0; i < 900; i++) b += `<circle cx="${r() * w}" cy="${r() * h}" r="${4 + r() * 26}" fill="${hsl(180 + r() * 60, 50, 60, 0.07 + r() * 0.08)}"/>`;
  b += `<rect x="${w * 0.3}" y="${h * 0.3}" width="${w * 0.4}" height="${h * 0.34}" rx="30" fill="${hsl(40, 40, 85, 0.1)}" stroke="${hsl(40, 60, 80, 0.5)}" stroke-width="4"/>`;
  return svg(w, h, b, `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(215, 45, 16)}"/><stop offset=".55" stop-color="${hsl(190, 40, 26)}"/><stop offset="1" stop-color="${hsl(35, 45, 30)}"/></linearGradient>`);
}
function scene(n, w = 1672, h = 941) {
  const r = lcg(100 + n), hue = (n * 47) % 360; let b = `<rect width="${w}" height="${h}" fill="url(#sky)"/><circle cx="${w * (0.25 + r() * 0.5)}" cy="${h * 0.3}" r="${h * 0.11}" fill="${hsl(hue + 40, 80, 80, 0.9)}"/>`;
  for (let layer = 0; layer < 4; layer++) { let d = `M0 ${h}`; const base = h * (0.5 + layer * 0.1); for (let x = 0; x <= w; x += w / 9) d += ` L${x} ${base - r() * h * 0.22}`; b += `<path d="${d} L${w} ${h}Z" fill="${hsl(hue + layer * 12, 35 + layer * 8, 38 - layer * 7)}"/>`; }
  for (let i = 0; i < 1500; i++) b += `<rect x="${r() * w}" y="${h * 0.3 + r() * h * 0.7}" width="${2 + r() * 9}" height="${2 + r() * 9}" fill="${hsl(hue + r() * 90, 40 + r() * 40, 20 + r() * 70, 0.08 + r() * 0.22)}"/>`; // feine Körnung wie in gemalten Bildern
  return svg(w, h, b, `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue + 200, 50, 22)}"/><stop offset="1" stop-color="${hsl(hue, 60, 62)}"/></linearGradient>`);
}
function figure(i, w = 389, h = 662) {
  const hue = i * 45, cx = w / 2;
  const body = `<ellipse cx="${cx}" cy="${h - 40}" rx="${w * 0.42}" ry="34" fill="url(#shadow)"/><ellipse cx="${cx}" cy="${h - 60}" rx="${w * 0.36}" ry="26" fill="${hsl(hue, 35, 30)}" stroke="${hsl(hue, 50, 75)}" stroke-width="4"/>`
    + `<path d="M${cx - w * 0.3} ${h - 70} C${cx - w * 0.28} ${h * 0.55} ${cx - w * 0.12} ${h * 0.42} ${cx} ${h * 0.4} C${cx + w * 0.12} ${h * 0.42} ${cx + w * 0.28} ${h * 0.55} ${cx + w * 0.3} ${h - 70}Z" fill="url(#cloth)" stroke="${hsl(hue, 50, 80)}" stroke-width="3"/>`
    + `<circle cx="${cx}" cy="${h * 0.3}" r="${w * 0.17}" fill="${hsl(hue + 20, 45, 72)}" stroke="${hsl(hue, 50, 30)}" stroke-width="3"/><circle cx="${cx - w * 0.05}" cy="${h * 0.29}" r="5" fill="#123"/><circle cx="${cx + w * 0.05}" cy="${h * 0.29}" r="5" fill="#123"/>`
    + `<g fill="${hsl(hue + 180, 70, 70, 0.8)}">${i % 2 ? `<polygon points="${cx},${h * 0.08} ${cx + 28},${h * 0.16} ${cx - 28},${h * 0.16}"/>` : `<rect x="${cx - 26}" y="${h * 0.09}" width="52" height="30" rx="8"/>`}</g>`
    + `<circle cx="${cx}" cy="${h * 0.5}" r="${w * 0.3}" fill="url(#glow)"/>` + Array.from({ length: 160 }, (_, k) => { const q = lcg(i * 1000 + k); return `<circle cx="${cx + (q() - 0.5) * w * 0.5}" cy="${h * (0.42 + q() * 0.4)}" r="${1.5 + q() * 4}" fill="${hsl(hue + q() * 60, 60, 40 + q() * 40, 0.5)}"/>`; }).join("");
  return svg(w, h, body, `<radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hsl(hue, 55, 55)}"/><stop offset="1" stop-color="${hsl(hue + 25, 55, 26)}"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="${hsl(hue, 90, 80)}" stop-opacity=".3"/><stop offset="1" stop-color="${hsl(hue, 90, 80)}" stop-opacity="0"/></radialGradient>`);
}
function building(level, w = 192, h = 192) {
  let b = `<ellipse cx="96" cy="170" rx="70" ry="12" fill="#000" fill-opacity=".35"/>`;
  if (level < 5) for (let k = 0; k < level; k++) { const x = 28 + k * 36; b += `<rect x="${x}" y="${96 - k * 6}" width="30" height="64" fill="${hsl(20 + k * 12, 55, 55)}" stroke="#321" stroke-width="3"/><polygon points="${x - 3},${96 - k * 6} ${x + 15},${70 - k * 6} ${x + 33},${96 - k * 6}" fill="${hsl(8, 60, 42)}" stroke="#321" stroke-width="3"/>`; }
  else b += `<rect x="24" y="80" width="144" height="82" fill="${hsl(210, 40, 55)}" stroke="#123" stroke-width="4"/><polygon points="16,80 96,28 176,80" fill="${hsl(350, 60, 42)}" stroke="#123" stroke-width="4"/><rect x="82" y="118" width="28" height="44" fill="${hsl(40, 60, 70)}"/>`;
  return svg(w, h, b);
}
const preview = () => scene(9, 576, 360);
const flat = (w, h, hue) => svg(w, h, `<rect width="${w}" height="${h}" fill="${hsl(hue, 20, 40)}"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="${hsl(hue, 20, 60)}" stroke-width="3"/>`);

const TOKEN_SLOTS = ['hat', 'car', 'dog', 'ship', 'thimble', 'barrow', 'shoe', 'cat'], FIELDS = [1, 3, 6, 8];
const origin = { creator: 'PokerAbend-Projekt (Claude Code)', source: 'scripts/monopoly-test-art.mjs: prozedural gezeichnete abstrakte Formen', license: 'eigene Arbeit des Projekts, keine Fremdvorlage', licenseStatus: 'cleared', evidence: 'scripts/monopoly-test-art.mjs; docs/design/ART_LICENSES.md', publication: 'public-ok' };
const focus = { board: { x: 50, y: 46 }, deed: { x: 50, y: 50 }, mobile: { x: 50, y: 44 } };

export function testArt() {
  const files = {}, assets = [], two = (n) => String(n).padStart(2, '0');
  const add = (id, role, load, file, markup, extra = {}) => { if (markup) files[file] = markup; assets.push({ id, role, load, src: file, origin, ...extra }); };
  add('placeholder-tile', 'ui', 'initial', 'placeholder-tile.png', flat(96, 54, 210), { alt: 'Platzhalter' });
  add('placeholder-figure', 'ui', 'initial', 'placeholder-figure.png', svg(64, 110, `<ellipse cx="32" cy="98" rx="26" ry="8" fill="#0006"/><path d="M12 92C14 50 24 40 32 38S50 50 52 92Z" fill="${hsl(210, 20, 55)}"/><circle cx="32" cy="26" r="14" fill="${hsl(210, 20, 65)}"/>`), { alt: 'Platzhalter' });
  add('board', 'board', 'initial', 'board.png', board(), { alt: 'Abstraktes Testbrett', focus, fallback: 'placeholder-tile' });
  add('preview', 'preview', 'lobby', 'preview.png', preview(), { alt: 'Vorschau des Testdesigns' });
  for (const f of FIELDS) {
    add(`loc-${two(f)}`, 'location', 'lazy', `loc-${two(f)}.png`, scene(f), { fieldIds: [f], alt: `Abstraktes Ortsbild ${f}`, focus, fallback: 'placeholder-tile' });
    add(`deed-${two(f)}`, 'deed', 'lazy', `loc-${two(f)}.png`, null, { fieldIds: [f], alt: `Abstraktes Urkundenbild ${f}`, focus, fallback: 'placeholder-tile' });
  }
  TOKEN_SLOTS.forEach((slot, i) => add(`figure-${slot}`, 'figure', 'onDemand', `figure-${slot}.png`, figure(i), { slot, alt: `Abstrakte Figur ${slot}`, fallback: 'placeholder-figure' }));
  for (let l = 1; l <= 5; l++) add(`building-${l}`, 'building', 'lazy', `building-${l}.png`, building(l), { slot: l, alt: l === 5 ? 'Abstraktes Hotel' : `Abstrakte Gebäude ${l}` });
  return { files, spec: { themeId: 'testbed', release: 'publishable', assets: assets.map((a) => ({ ...a })) } };
}

export async function renderTestArt(out, channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome') {
  const dir = resolve(out); mkdirSync(dir, { recursive: true });
  const { files, spec } = testArt(), { chromium } = await import('@playwright/test'), browser = await chromium.launch({ channel });
  try {
    for (const [file, markup] of Object.entries(files)) {
      if (!markup) continue; // Wiederverwendung derselben Quelle (Urkundenbild = Ortsbild)
      const [, w, h] = /width="(\d+)" height="(\d+)"/.exec(markup), page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
      await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${markup}`);
      writeFileSync(join(dir, file), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: +w, height: +h } })); await page.close();
    }
  } finally { await browser.close(); }
  writeFileSync(join(dir, 'theme-src.json'), JSON.stringify(spec, null, 2) + '\n');
  return spec;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), i = a.indexOf('--out'), c = a.indexOf('--channel');
  if (i < 0) { console.error('Aufruf: node scripts/monopoly-test-art.mjs --out <Ordner> [--channel chrome|chromium]'); process.exit(2); }
  renderTestArt(a[i + 1], c >= 0 ? a[c + 1] : undefined).then((s) => console.log(`${s.assets.length} Assets in ${a[i + 1]}`)).catch((e) => { console.error(e.message); process.exit(1); });
}
