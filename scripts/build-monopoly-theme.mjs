// Monopoly-Theme-Assets bauen (ART-046, Paket F): PNG-Quellen → optimierte, hashbenannte WebP-Dateien + manifest.json.
//
//   node scripts/build-monopoly-theme.mjs --src <Ordner mit theme-src.json und PNGs> --out <Ausgabeordner> [--prune] [--no-cache] [--channel chrome|chromium] [--json]
//
// Es werden keine Pakete installiert: Playwright ist schon Entwicklungsabhängigkeit, der Browser entpackt, skaliert und kodiert (canvas.toBlob → WebP).
// AVIF kann dieser Encoder nicht (toBlob liefert PNG zurück) und wird deshalb nicht erzeugt; ein neuer Encoder als Abhängigkeit wäre nötig.
// Ablauf je Datei: Quelle prüfen (nur PNG, Pfad im Quellordner) → in Stufen auf das Profil der Rolle verkleinern (nie hochskalieren) → WebP kodieren →
// dekodieren und gegen das verkleinerte Original messen (Farb- und Alphafehler, Grenzwerte unten; bei Überschreitung höhere Qualität bis verlustfrei) → als <asset>.<variante>.<sha256-12>.webp ablegen.
// Wiederverwendung: Schlüssel = Hash aus Quelle, Profil und Encoder; trifft er und stimmt die Datei, wird nichts neu kodiert (.build-cache.json im Ausgabeordner).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync, renameSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { PROFILES, BUDGET_CAPS, MANIFEST_VERSION, FILE_NAME, ROLES, LOADS, assetBase, validateManifest, startBytes, lobbyBytes } from '../public/games/monopoly/theme-manifest.js';
import { pngInfo, sha256, verifyBundle } from './lib/monopoly-theme-verify.mjs';

export const QUALITY_LIMITS = { meanError: 4, maxAlphaError: 48 }; // 0–255: Ziel je Variante; wird es verfehlt, steigt die WebP-Qualität schrittweise (Größe wächst, das Budget prüft sie)
const TOOL = 'scripts/build-monopoly-theme.mjs@1', ENCODER = 'chromium-canvas-webp', ORDER = ['desktop', 'mobile', 'thumb'];
const SRC_PATH = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.png$/;

// Läuft im Browser: entpackt das PNG, verkleinert in Stufen, kodiert WebP, misst den Fehler gegen das verkleinerte Original
async function encodeInPage({ b64, spec }) {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const opt = { premultiplyAlpha: 'none', colorSpaceConversion: 'none' };
  const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }), opt);
  const sw = bmp.width, sh = bmp.height;
  const mk = (w, h, alpha = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { alpha, willReadFrequently: true })]; };
  let hasAlpha = false;
  { const [, x] = mk(sw, sh); x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, sw, sh).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 255) { hasAlpha = true; break; } }
  const scale = Math.min(1, spec.w / sw, spec.h / sh), tw = Math.max(1, Math.round(sw * scale)), th = Math.max(1, Math.round(sh * scale));
  let cur = bmp, cw = sw, ch = sh;
  while (cw / 2 >= tw && ch / 2 >= th) { const nw = Math.max(tw, Math.floor(cw / 2)), nh = Math.max(th, Math.floor(ch / 2)), [c, x] = mk(nw, nh); x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, nw, nh); cur = c; cw = nw; ch = nh; }
  const [out, ox] = mk(tw, th, hasAlpha); ox.imageSmoothingQuality = 'high'; ox.drawImage(cur, 0, 0, tw, th);
  const ref = ox.getImageData(0, 0, tw, th).data, [, x2] = mk(tw, th, hasAlpha);
  // Qualität nachführen: ab dem Profilwert in 0,05-Schritten bis zum Grenzwert (zuletzt verlustfrei), damit Detailreiches nicht sichtbar leidet
  const steps = []; for (let q = spec.q; q < 1; q = Math.round((q + 0.05) * 100) / 100) steps.push(q); steps.push(1);
  for (const q of steps) {
    const blob = await new Promise((r) => out.toBlob(r, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') throw new Error('Der Browser kann kein WebP kodieren');
    const dec = await createImageBitmap(blob, opt); x2.clearRect(0, 0, tw, th); x2.drawImage(dec, 0, 0); const got = x2.getImageData(0, 0, tw, th).data;
    let sum = 0, weight = 0, maxA = 0;
    for (let i = 0; i < ref.length; i += 4) { const a = ref[i + 3], da = Math.abs(a - got[i + 3]); if (da > maxA) maxA = da; if (a > 0) { const w = a / 255; sum += w * (Math.abs(ref[i] - got[i]) + Math.abs(ref[i + 1] - got[i + 1]) + Math.abs(ref[i + 2] - got[i + 2])); weight += 3 * w; } }
    const meanError = Math.round((weight ? sum / weight : 0) * 1000) / 1000;
    if ((meanError <= spec.meanLimit && maxA <= spec.alphaLimit) || q === 1) {
      const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
      return { b64: btoa(s), width: tw, height: th, alpha: hasAlpha, meanError, maxAlphaError: maxA, q };
    }
  }
}

export function readSpec(srcDir) {
  const file = join(srcDir, 'theme-src.json');
  if (!existsSync(file)) throw new Error('theme-src.json fehlt in ' + srcDir);
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  if (!/^[a-z][a-z0-9-]{1,23}$/.test(spec.themeId || '')) throw new Error('themeId ungültig');
  if (!['draft', 'publishable'].includes(spec.release)) throw new Error('release muss draft oder publishable sein');
  if (!Array.isArray(spec.assets) || !spec.assets.length) throw new Error('assets fehlt');
  const root = resolve(srcDir);
  for (const a of spec.assets) {
    if (!ROLES.includes(a.role)) throw new Error(`Asset ${a.id}: Rolle ${a.role} unbekannt`);
    if (!LOADS.includes(a.load)) throw new Error(`Asset ${a.id}: load ${a.load} unbekannt`);
    if (typeof a.src !== 'string' || !SRC_PATH.test(a.src)) throw new Error(`Asset ${a.id}: Quelle ${a.src} ist kein zulässiger PNG-Pfad (nur PNG, relativ, ohne ..)`);
    const p = resolve(root, a.src); if (!p.startsWith(root + sep)) throw new Error(`Asset ${a.id}: Quelle liegt außerhalb des Quellordners`);
    if (!existsSync(p) || !statSync(p).isFile()) throw new Error(`Asset ${a.id}: Quelle fehlt (${a.src})`);
    if (!pngInfo(readFileSync(p))) throw new Error(`Asset ${a.id}: ${a.src} ist kein gültiges PNG (nicht unterstütztes Bildformat)`);
  }
  return spec;
}

export async function buildTheme({ src, out, prune = false, cache = true, channel = process.env.PLAYWRIGHT_CHANNEL || 'chrome' }) {
  const srcDir = resolve(src), outDir = resolve(out), spec = readSpec(srcDir);
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  const cacheFile = join(outDir, '.build-cache.json');
  const store = cache && existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ channel });
  const stats = { encoded: 0, reused: 0, sourceBytes: 0, outBytes: 0, assets: [] };
  try {
    const page = await browser.newPage(), encoderVersion = browser.version();
    await page.setContent('<!doctype html><meta charset="utf-8">');
    const assets = [], used = new Set();
    for (const a of [...spec.assets].sort((x, y) => (x.id < y.id ? -1 : 1))) {
      const bytes = readFileSync(resolve(srcDir, a.src)), info = pngInfo(bytes);
      if (!info) throw new Error(`Asset ${a.id}: ${a.src} ist kein gültiges PNG (nicht unterstütztes Bildformat)`);
      const srcHash = sha256(bytes); stats.sourceBytes += bytes.length;
      const variants = [], row = { id: a.id, role: a.role, source: bytes.length, variants: {} };
      for (const name of ORDER.filter((n) => PROFILES[a.role][n])) {
        const prof = PROFILES[a.role][name], key = sha256(Buffer.from(`${srcHash}|${a.role}|${name}|${prof.w}x${prof.h}@${prof.q}<${QUALITY_LIMITS.meanError}/${QUALITY_LIMITS.maxAlphaError}|${ENCODER}|${encoderVersion}|${TOOL}`));
        let hit = store[key];
        if (hit && !(existsSync(join(outDir, 'assets', hit.file)) && sha256(readFileSync(join(outDir, 'assets', hit.file))) === hit.sha256)) hit = null;
        let r;
        if (hit) { r = hit; stats.reused++; }
        else {
          const e = await page.evaluate(encodeInPage, { b64: bytes.toString('base64'), spec: { ...prof, meanLimit: QUALITY_LIMITS.meanError, alphaLimit: QUALITY_LIMITS.maxAlphaError } }).catch((err) => { throw new Error(`Asset ${a.id}/${name}: ${err.message}`); });
          const buf = Buffer.from(e.b64, 'base64'), hash = sha256(buf), file = `${a.id}.${name}.${hash.slice(0, 12)}.webp`;
          if (!FILE_NAME.test(file)) throw new Error(`Asset ${a.id}: ID ergibt keinen gültigen Dateinamen`);
          const target = join(outDir, 'assets', file);
          if (!existsSync(target) || sha256(readFileSync(target)) !== hash) { writeFileSync(target + '.tmp', buf); renameSync(target + '.tmp', target); } // auch eine beschädigte Datei gleichen Namens wird ersetzt
          r = { file, sha256: hash, bytes: buf.length, width: e.width, height: e.height, alpha: e.alpha, quality: { meanError: e.meanError, maxAlphaError: e.maxAlphaError, q: e.q } };
          store[key] = r; stats.encoded++;
        }
        used.add(r.file); stats.outBytes += r.bytes; row.variants[name] = r.bytes;
        variants.push({ name, file: r.file, mime: 'image/webp', width: r.width, height: r.height, bytes: r.bytes, sha256: r.sha256, alpha: r.alpha, quality: r.quality });
      }
      const m = { id: a.id, role: a.role, load: a.load };
      if (a.fieldIds) m.fieldIds = a.fieldIds; if (a.slot !== undefined) m.slot = a.slot; if (a.alt) m.alt = a.alt; if (a.focus) m.focus = a.focus; if (a.fallback) m.fallback = a.fallback;
      m.source = { width: info.width, height: info.height, sha256: srcHash }; m.origin = a.origin; m.variants = variants;
      assets.push(m); stats.assets.push(row);
    }
    const sourceSetHash = createHash('sha256').update(assets.map((x) => `${x.id}:${x.source.sha256}`).join('\n')).digest('hex');
    const manifest = { manifestVersion: MANIFEST_VERSION, themeId: spec.themeId, release: spec.release, assetBase: assetBase(spec.themeId), generator: { tool: TOOL, encoder: ENCODER, encoderVersion, sourceSetHash },
      budgets: { lobby: spec.budgets?.lobby ?? BUDGET_CAPS.lobby, mobileStart: spec.budgets?.mobileStart ?? BUDGET_CAPS.mobileStart, desktopStart: spec.budgets?.desktopStart ?? BUDGET_CAPS.desktopStart }, assets };
    const errors = validateManifest(manifest); if (errors.length) throw new Error('Manifest ungültig:\n  ' + errors.join('\n  '));
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    if (cache) writeFileSync(cacheFile, JSON.stringify(Object.fromEntries(Object.entries(store).sort(([a], [b]) => (a < b ? -1 : 1))), null, 1) + '\n');
    if (prune) for (const f of readdirSync(join(outDir, 'assets'))) if (!used.has(f) && FILE_NAME.test(f)) rmSync(join(outDir, 'assets', f));
    const check = verifyBundle(outDir, manifest); if (check.errors.length) throw new Error('Prüfung der gebauten Dateien fehlgeschlagen:\n  ' + check.errors.join('\n  '));
    stats.budgets = { lobby: lobbyBytes(manifest), mobileStart: startBytes(manifest, 'mobile'), desktopStart: startBytes(manifest, 'desktop') };
    return { manifest, stats, orphans: check.orphans };
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
  if (!opt('src') || !opt('out')) { console.error('Aufruf: node scripts/build-monopoly-theme.mjs --src <Ordner> --out <Ordner> [--prune] [--no-cache] [--channel chrome|chromium] [--json]'); process.exit(2); }
  buildTheme({ src: opt('src'), out: opt('out'), prune: args.includes('--prune'), cache: !args.includes('--no-cache'), channel: opt('channel') || process.env.PLAYWRIGHT_CHANNEL || 'chrome' }).then(({ manifest, stats, orphans }) => {
    if (args.includes('--json')) return console.log(JSON.stringify({ stats, orphans }, null, 1));
    console.log(`Theme ${manifest.themeId}: ${manifest.assets.length} Assets, ${stats.encoded} kodiert, ${stats.reused} wiederverwendet`);
    console.log(`Quellen ${(stats.sourceBytes / 1024).toFixed(0)} KB → WebP ${(stats.outBytes / 1024).toFixed(0)} KB`);
    console.log(`Lobby ${(stats.budgets.lobby / 1024).toFixed(1)} KB · Mobil-Start ${(stats.budgets.mobileStart / 1024).toFixed(1)} KB · Desktop-Start ${(stats.budgets.desktopStart / 1024).toFixed(1)} KB`);
    if (orphans.length) console.log('Nicht im Manifest (mit --prune entfernen): ' + orphans.join(', '));
  }).catch((e) => { console.error('Fehler: ' + e.message); process.exit(1); });
}
