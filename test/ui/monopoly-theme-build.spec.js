// Monopoly Paket F (ART-046): Bauen der Theme-Assets mit dem Browser-Encoder. Zwei Builds aus identischen Eingaben müssen bitgleich sein,
// Wiederverwendung darf nichts neu kodieren, schlechte Kodierungen und unbrauchbare Quellen brechen den Build ab. Die Dateiprüfungen ohne Browser
// stehen in test/monopoly-theme-assets.test.js. Läuft einmal (Desktop-Projekt); es wird kein Server gebraucht.
import { test, expect } from '@playwright/test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderTestArt } from '../../scripts/monopoly-test-art.mjs';
import { buildTheme } from '../../scripts/build-monopoly-theme.mjs';
import { verifyBundle } from '../../scripts/lib/monopoly-theme-verify.mjs';

test.describe.configure({ mode: 'serial' });
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const dirHashes = (d) => Object.fromEntries(readdirSync(d).sort().map((f) => [f, hash(join(d, f))]));
const dirs = [];
const tmp = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };
test.afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'Build-Prüfung läuft einmal'));

let srcA, srcB, outA, outB, builtA;
test('Quellgrafiken entstehen reproduzierbar: zweimal rendern ergibt dieselben PNG-Bytes', async () => {
  test.setTimeout(180000);
  srcA = tmp('mtb-srcA-'); srcB = tmp('mtb-srcB-');
  await renderTestArt(srcA); await renderTestArt(srcB);
  expect(readdirSync(srcA).length).toBeGreaterThan(20); expect(dirHashes(srcA)).toEqual(dirHashes(srcB));
});

test('zwei vollständige Builds ohne Cache aus identischen Eingaben sind bitgleich (Dateien und Manifest)', async () => {
  test.setTimeout(240000);
  outA = tmp('mtb-outA-'); outB = tmp('mtb-outB-');
  builtA = await buildTheme({ src: srcA, out: outA, cache: false });
  const b = await buildTheme({ src: srcB, out: outB, cache: false });
  expect(builtA.stats.encoded).toBe(53); expect(builtA.stats.reused).toBe(0); expect(b.stats.encoded).toBe(53);
  expect(dirHashes(join(outA, 'assets'))).toEqual(dirHashes(join(outB, 'assets')));
  expect(readFileSync(join(outA, 'manifest.json'), 'utf8')).toBe(readFileSync(join(outB, 'manifest.json'), 'utf8'));
  expect(builtA.manifest.generator.sourceSetHash).toBe(b.manifest.generator.sourceSetHash);
  for (const dir of [outA, outB]) { const r = verifyBundle(dir, JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')), { requirePublishable: true }); expect(r.errors).toEqual([]); expect(r.orphans).toEqual([]); }
  // Messwerte und Qualität des Builds
  expect(builtA.stats.outBytes).toBeLessThan(builtA.stats.sourceBytes / 4);
  expect(builtA.stats.budgets.lobby).toBeLessThanOrEqual(300 * 1024); expect(builtA.stats.budgets.mobileStart).toBeLessThanOrEqual(1.5 * 1024 * 1024); expect(builtA.stats.budgets.desktopStart).toBeLessThanOrEqual(2.5 * 1024 * 1024);
  test.info().annotations.push({ type: 'messwerte', description: JSON.stringify({ quellenKB: Math.round(builtA.stats.sourceBytes / 1024), webpKB: Math.round(builtA.stats.outBytes / 1024), budgetsKB: Object.fromEntries(Object.entries(builtA.stats.budgets).map(([k, v]) => [k, +(v / 1024).toFixed(1)])) }) });
});

test('Wiederverwendung: ein erneuter Build kodiert nichts neu, fehlt eine Datei, wird nur sie in gleicher Form ersetzt', async () => {
  test.setTimeout(240000);
  const before = dirHashes(join(outA, 'assets')), manifestBefore = readFileSync(join(outA, 'manifest.json'), 'utf8');
  const again = await buildTheme({ src: srcA, out: outA, cache: true });   // Cache wird jetzt gefüllt (erster Build lief ohne)
  expect(again.stats.encoded).toBe(53);
  const reuse = await buildTheme({ src: srcA, out: outA, cache: true });
  expect(reuse.stats.encoded).toBe(0); expect(reuse.stats.reused).toBe(53); expect(dirHashes(join(outA, 'assets'))).toEqual(before); expect(readFileSync(join(outA, 'manifest.json'), 'utf8')).toBe(manifestBefore);
  const victim = readdirSync(join(outA, 'assets'))[0]; rmSync(join(outA, 'assets', victim));
  const partial = await buildTheme({ src: srcA, out: outA, cache: true });
  expect(partial.stats.encoded).toBe(1); expect(partial.stats.reused).toBe(52); expect(dirHashes(join(outA, 'assets'))).toEqual(before);
  // beschädigte Datei im Cache-Treffer wird erkannt und neu erzeugt
  const damaged = readdirSync(join(outA, 'assets'))[3]; writeFileSync(join(outA, 'assets', damaged), 'kaputt');
  const heal = await buildTheme({ src: srcA, out: outA, cache: true });
  expect(heal.stats.encoded).toBe(1); expect(dirHashes(join(outA, 'assets'))).toEqual(before);
  // --prune räumt Überzähliges mit Hash-Namen weg, fremde Dateien bleiben
  writeFileSync(join(outA, 'assets', 'alt.desktop.0123456789ab.webp'), 'x'); writeFileSync(join(outA, 'assets', 'notiz.txt'), 'bleibt');
  const pruned = await buildTheme({ src: srcA, out: outA, cache: true, prune: true });
  expect(readdirSync(join(outA, 'assets'))).not.toContain('alt.desktop.0123456789ab.webp'); expect(readdirSync(join(outA, 'assets'))).toContain('notiz.txt'); expect(pruned.orphans).toEqual(['notiz.txt']);
});

test('Qualität wird nachgeführt: Rauschen (schwer zu komprimieren) erhält eine höhere WebP-Qualität statt sichtbarer Fehler; das Budget begrenzt die Größe', async ({ page }) => {
  test.setTimeout(120000);
  const src = tmp('mtb-noise-'), out = tmp('mtb-noiseout-'), origin = { creator: 'Test', source: 'Rauschen', license: 'eigene Arbeit', licenseStatus: 'cleared', evidence: 'Test', publication: 'public-ok' };
  const b64 = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), d = x.createImageData(256, 256); let s = 12345; for (let i = 0; i < d.data.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d.data[i] = i % 4 === 3 ? 255 : s >>> 24; } x.putImageData(d, 0, 0); return c.toDataURL('image/png').split(',')[1]; });
  writeFileSync(join(src, 'rauschen.png'), Buffer.from(b64, 'base64'));
  const spec = (budgets) => writeFileSync(join(src, 'theme-src.json'), JSON.stringify({ themeId: 'rauschen', release: 'draft', ...(budgets ? { budgets } : {}), assets: [{ id: 'noise', role: 'ui', load: 'initial', src: 'rauschen.png', origin }, { id: 'vorschau', role: 'preview', load: 'lobby', src: 'rauschen.png', origin }] }));
  spec(); const built = await buildTheme({ src, out });
  const v = built.manifest.assets.find((a) => a.id === 'noise').variants.find((x) => x.name === 'desktop');
  expect(v.quality.q).toBeGreaterThan(0.8); expect(v.quality.meanError).toBeLessThanOrEqual(4); expect(v.quality.maxAlphaError).toBeLessThanOrEqual(48); expect(verifyBundle(out, built.manifest).errors).toEqual([]);
  // Ein Lobby-Bild, das über das vereinbarte Budget wächst, bricht den Build ab
  spec({ lobby: 1024 }); await expect(buildTheme({ src, out: tmp('mtb-noiseout2-') })).rejects.toThrow(/Budget lobby überschritten/);
});

test('Unbrauchbare Quellen: JPEG unter PNG-Namen, Pfad außerhalb und fehlende Datei brechen vor dem Kodieren ab', async () => {
  const src = tmp('mtb-bad-'), out = tmp('mtb-badout-'), origin = { creator: 'T', source: 'T', license: 'T', licenseStatus: 'cleared', evidence: 'T', publication: 'public-ok' };
  const spec = (s) => writeFileSync(join(src, 'theme-src.json'), JSON.stringify({ themeId: 'kaputt', release: 'draft', assets: [{ id: 'a', role: 'ui', load: 'initial', src: s, origin }] }));
  writeFileSync(join(src, 'a.png'), Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(80)]));
  spec('a.png'); await expect(buildTheme({ src, out })).rejects.toThrow(/kein gültiges PNG/);
  spec('../a.png'); await expect(buildTheme({ src, out })).rejects.toThrow(/zulässiger PNG-Pfad/);
  spec('fehlt.png'); await expect(buildTheme({ src, out })).rejects.toThrow(/Quelle fehlt/);
});

test('Encoder-Voraussetzung: der Browser kodiert WebP; AVIF kann er nicht (toBlob liefert PNG) und wird deshalb nicht erzeugt', async ({ page }) => {
  const r = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8); const t = (type) => new Promise((res) => c.toBlob((b) => res(b.type), type, 0.8)); return { webp: await t('image/webp'), avif: await t('image/avif') }; });
  expect(r.webp).toBe('image/webp'); test.info().annotations.push({ type: 'avif', description: `toBlob(image/avif) liefert ${r.avif}` });
});
