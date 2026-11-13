// Exportiert SVG-Entwürfe aus docs/design/drafts/ als PNG (doppelte Breite) und PDF (Vektor, SVG-Größe).
// Regeln: docs/design/DESIGN_DRAFTS.md. Nutzt das vorhandene Playwright-Chromium, keine weitere Abhängigkeit.
//
//   npm run export:design                     alle *.svg in docs/design/drafts/
//   npm run export:design -- datei.svg …      nur diese Dateien (oder Ordner)
//   Optionen: --scale=2  --format=png,pdf  --out=docs/design/drafts/export
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dirname, '..');
const draftsDir = join(root, 'docs', 'design', 'drafts');
const opts = { scale: 2, format: ['png', 'pdf'], out: join(draftsDir, 'export') };
const inputs = [];
for (const arg of process.argv.slice(2)) {
  const m = /^--(scale|format|out)=(.+)$/.exec(arg);
  if (!m) { inputs.push(resolve(arg)); continue; }
  if (m[1] === 'scale') opts.scale = Number(m[2]);
  if (m[1] === 'format') opts.format = m[2].split(',').map((f) => f.trim().toLowerCase());
  if (m[1] === 'out') opts.out = resolve(m[2]);
}
if (!(opts.scale > 0)) throw new Error('--scale muss eine positive Zahl sein');
if (!opts.format.length || opts.format.some((f) => !['png', 'pdf'].includes(f))) throw new Error('--format: png, pdf oder png,pdf');

const svgsIn = (dir) => readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.svg')).sort().map((f) => join(dir, f));
const files = (inputs.length ? inputs : [draftsDir]).flatMap((p) => {
  if (!existsSync(p)) throw new Error(`Nicht gefunden: ${p}`);
  return statSync(p).isDirectory() ? svgsIn(p) : [p];
});
if (!files.length) { console.log(`Keine SVG-Entwürfe in ${relative(root, draftsDir)}/ gefunden.`); process.exit(0); }
mkdirSync(opts.out, { recursive: true });

const rel = (p) => relative(root, p).replaceAll('\\', '/');
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: true });
let failed = 0;
try {
  for (const file of files) {
    const name = basename(file).replace(/\.svg$/i, '');
    // Hinweis für ART_LICENSES.md: extern eingebundene Bilder brauchen einen Herkunftseintrag.
    const external = [...readFileSync(file, 'utf8').matchAll(/href\s*=\s*["'](https?:[^"']+)["']/gi)].map((m) => m[1]);
    if (external.length) console.warn(`  ! ${rel(file)}: externe Bilder (${external.join(', ')}) – Eintrag in docs/design/ART_LICENSES.md nötig`);
    // Skripte im SVG werden nicht ausgeführt.
    const context = await browser.newContext({ javaScriptEnabled: false, deviceScaleFactor: opts.scale });
    try {
      const page = await context.newPage();
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      const size = await page.evaluate(() => {
        const svg = document.documentElement;
        if (!(svg instanceof SVGSVGElement)) return null;
        const vb = svg.viewBox.baseVal, PCT = SVGLength.SVG_LENGTHTYPE_PERCENTAGE;
        const dim = (attr, fallback) => (svg.hasAttribute(attr) && svg[attr].baseVal.unitType !== PCT ? svg[attr].baseVal.value : fallback);
        return { width: dim('width', vb?.width || 0), height: dim('height', vb?.height || 0) };
      });
      if (!size?.width || !size?.height) throw new Error('keine Größe (width/height oder viewBox fehlt)');
      const w = Math.ceil(size.width), h = Math.ceil(size.height);
      await page.setViewportSize({ width: w, height: h });
      const written = [];
      if (opts.format.includes('png')) {
        const out = join(opts.out, `${name}.png`);
        await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
        written.push(`${rel(out)} (${Math.round(w * opts.scale)}×${Math.round(h * opts.scale)} px)`);
      }
      if (opts.format.includes('pdf')) {
        const out = join(opts.out, `${name}.pdf`);
        await page.pdf({ path: out, width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: '1', margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        written.push(`${rel(out)} (${w}×${h} px, Vektor)`);
      }
      console.log(`✓ ${rel(file)}\n    ${written.join('\n    ')}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${rel(file)}: ${e.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exitCode = 1;
