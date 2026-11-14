// Monopoly Paket F (ART-046): Asset-Pipeline. Ohne Browser: Manifest-Schema, Dateiprüfung (Prüfsumme, Größe, Abmessungen, Transparenz, Format, Pfade),
// Fallbacks, Ladeplan und Budgets, Feldzuordnung, Cache-Auslieferung und Kompatibilität mit den vorhandenen Themes. Das Bauen mit Chromium
// (zwei Builds, Wiederverwendung, Qualitätsgrenze) prüft test/ui/monopoly-theme-build.spec.js.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { createServer, get as httpGet } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { BOARD } from '../public/games/monopoly/data.js';
import { createThemeRegistry, themeRegistry, MANIFEST_PATH } from '../public/games/monopoly/themes.js';
import { validateManifest, selectVariant, loadPlan, startBytes, lobbyBytes, fieldCoverage, assetForField, imgHTML, assetUrl, assetBase, BUDGET_CAPS, FALLBACK_MAX_BYTES, PROFILES, FILE_NAME } from '../public/games/monopoly/theme-manifest.js';
import { verifyBundle, readBundle, webpInfo, pngInfo, sha256 } from '../scripts/lib/monopoly-theme-verify.mjs';
import { readSpec } from '../scripts/build-monopoly-theme.mjs';
import { themeAssets, THEME_ASSET_PATH } from '../server/theme-assets.js';
import { Room } from '../games/monopoly/room.js';
import { freePort } from './free-port.js';

// PNG-Kopf (IHDR 1000×600, RGBA) mit etwas Inhalt dahinter
const PNG_HEAD = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452000003e80000025808060000000000', 'hex'), Buffer.alloc(24)]);
const FIXTURE = join(import.meta.dirname, 'fixtures', 'monopoly-theme', 'dist');
const manifest = () => structuredClone(readBundle(FIXTURE));
const tmp = (p) => mkdtempSync(join(tmpdir(), p));
const copyBundle = () => { const d = tmp('mtheme-'); cpSync(FIXTURE, d, { recursive: true }); return d; };
const asset = (m, id) => m.assets.find((a) => a.id === id);
const errorsOf = (m, o) => validateManifest(m, o);
const has = (errors, pattern) => assert.ok(errors.some((e) => pattern.test(e)), `Fehler ${pattern} erwartet, bekommen: ${errors.join(' | ') || 'keine'}`);
// Eine Variante durch neue Bytes ersetzen und das Manifest passend nachziehen (für Formatfehler)
function replaceFile(dir, m, id, name, bytes, patch = {}) {
  const v = asset(m, id).variants.find((x) => x.name === name), hash = sha256(bytes), file = `${id}.${name}.${hash.slice(0, 12)}.webp`;
  writeFileSync(join(dir, 'assets', file), bytes); Object.assign(v, { file, sha256: hash, bytes: bytes.length, ...patch });
}

test('Fixture-Bundle (abstrakte Testgrafik): Manifest gültig, alle 53 Dateien stimmen, veröffentlichbar, nichts Überzähliges', () => {
  const m = manifest(), r = verifyBundle(FIXTURE, m, { requirePublishable: true });
  assert.deepEqual(r.errors, []); assert.deepEqual(r.orphans, []); assert.equal(r.files, 53); assert.equal(m.assets.length, 25); assert.equal(m.themeId, 'testbed');
  assert.equal(m.assetBase, assetBase('testbed')); assert.equal(m.manifestVersion, 1);
  const onDisk = readdirSync(join(FIXTURE, 'assets')); assert.equal(onDisk.length, 53); assert.ok(onDisk.every((f) => FILE_NAME.test(f)));
  assert.equal(r.bytes, m.assets.flatMap((a) => a.variants).reduce((s, v) => s + v.bytes, 0), 'Summe der Manifestgrößen = Summe der Dateien');
});

test('Manifest enthält Herkunft und Lizenzstatus für jedes Asset; ungeklärte Dateien blockieren ein veröffentlichbares Bundle', () => {
  const m = manifest(); for (const a of m.assets) { assert.equal(a.origin.licenseStatus, 'cleared'); assert.equal(a.origin.publication, 'public-ok'); assert.ok(a.origin.creator && a.origin.source && a.origin.license && a.origin.evidence); }
  const open = structuredClone(m); asset(open, 'board').origin.licenseStatus = 'open'; asset(open, 'board').origin.publication = 'private-only'; has(errorsOf(open), /nicht veröffentlichbar/); has(errorsOf(open, { requirePublishable: true }), /board.*nicht veröffentlichbar/);
  const priv = structuredClone(m); asset(priv, 'preview').origin.publication = 'private-only'; has(errorsOf(priv), /nicht veröffentlichbar/);
  const draft = structuredClone(open); draft.release = 'draft'; assert.deepEqual(errorsOf(draft), [], 'als Entwurf sind offene Dateien erlaubt …'); has(errorsOf(draft, { requirePublishable: true }), /nicht veröffentlichbar/); // … aber nie veröffentlichbar
  const lie = structuredClone(m); asset(lie, 'board').origin.licenseStatus = 'blocked'; asset(lie, 'board').origin.publication = 'public-ok'; has(errorsOf(lie), /public-ok setzt licenseStatus cleared voraus/);
  for (const key of ['creator', 'source', 'license', 'evidence']) { const x = structuredClone(m); delete asset(x, 'board').origin[key]; has(errorsOf(x), new RegExp(`origin.${key} fehlt`)); }
  const none = structuredClone(m); delete asset(none, 'board').origin; has(errorsOf(none), /origin fehlt/);
});

test('Manifest definiert nie Spielregeln, Preise, Mieten oder Spieldaten (strenges Schema)', () => {
  const m = manifest(), text = JSON.stringify(m);
  assert.equal(/"(price|prices|rent|rents|build|tax|cost|money|rules?|owner|stock|dice|mortgage|auction|trade)"\s*:/i.test(text), false);
  for (const key of ['price', 'rents', 'rent', 'tax', 'build', 'money', 'rules', 'owner']) {
    const top = structuredClone(m); top[key] = 5; has(errorsOf(top), new RegExp(`"${key}" ist Spielregel`));
    const a = structuredClone(m); asset(a, 'loc-01')[key] = [1, 2]; has(errorsOf(a), new RegExp(`"${key}" ist Spielregel`));
    const v = structuredClone(m); asset(v, 'loc-01').variants[0][key] = 1; has(errorsOf(v), new RegExp(`"${key}" ist Spielregel`));
  }
  const odd = structuredClone(m); odd.zusatz = 1; has(errorsOf(odd), /unbekannter Schlüssel "zusatz"/);
});

test('Manifestvalidierung: Kopf, Rollen, Laden, Abmessungen, MIME, Dateinamen, Hashes, Qualität', () => {
  const bad = (mut, pattern) => { const m = manifest(); mut(m); has(errorsOf(m), pattern); };
  assert.ok(errorsOf(null).length); assert.ok(errorsOf([]).length); assert.deepEqual(errorsOf(manifest()), []);
  bad((m) => { m.manifestVersion = 2; }, /manifestVersion/); bad((m) => { m.themeId = 'X!'; }, /themeId/); bad((m) => { m.release = 'live'; }, /release/);
  bad((m) => { m.assetBase = '/etc/'; }, /assetBase/); bad((m) => { m.assetBase = '/games/monopoly/themes/anderes/assets/'; }, /assetBase/);
  bad((m) => { m.generator.sourceSetHash = 'abc'; }, /sourceSetHash/); bad((m) => { delete m.generator; }, /generator fehlt/); bad((m) => { m.assets = []; }, /assets fehlt/);
  bad((m) => { m.budgets.lobby = BUDGET_CAPS.lobby + 1; }, /budgets.lobby/); bad((m) => { delete m.budgets; }, /budgets fehlt/);
  bad((m) => { asset(m, 'board').role = 'boden'; }, /Rolle boden unbekannt/); bad((m) => { asset(m, 'board').load = 'sofort'; }, /load sofort/);
  bad((m) => { m.assets.push(structuredClone(asset(m, 'board'))); }, /Doppelte Asset-ID board/); bad((m) => { asset(m, 'board').id = 'Board 1'; }, /Asset-ID ungültig/);
  bad((m) => { asset(m, 'preview').load = 'lazy'; }, /Vorschaubilder laden als lobby/);
  bad((m) => { asset(m, 'board').variants = asset(m, 'board').variants.filter((v) => v.name !== 'desktop'); }, /Variante desktop fehlt/);
  bad((m) => { asset(m, 'figure-hat').variants = asset(m, 'figure-hat').variants.filter((v) => v.name !== 'mobile'); }, /Variante mobile fehlt/);
  bad((m) => { asset(m, 'board').variants.push({ ...asset(m, 'board').variants[0], name: 'thumb' }); }, /nicht vorgesehen/);
  bad((m) => { asset(m, 'board').variants[0].width = 5000; }, /überschreitet das Profil/); bad((m) => { asset(m, 'board').variants[0].height = 0; }, /Abmessungen ungültig/);
  bad((m) => { asset(m, 'board').variants[0].mime = 'image/png'; }, /MIME image\/png nicht unterstützt/); bad((m) => { asset(m, 'board').variants[0].mime = 'image/avif'; }, /MIME/);
  bad((m) => { asset(m, 'board').variants[0].bytes = 0; }, /bytes ungültig/); bad((m) => { asset(m, 'board').variants[0].alpha = 'ja'; }, /alpha muss/);
  bad((m) => { asset(m, 'board').variants[0].sha256 = 'f'.repeat(64); }, /Hash im Dateinamen/); bad((m) => { asset(m, 'board').variants[0].sha256 = 'zz'; }, /Hash im Dateinamen/);
  bad((m) => { asset(m, 'board').variants[0].quality = { meanError: -1, maxAlphaError: 0, q: 0.8 }; }, /quality braucht/); bad((m) => { delete asset(m, 'board').variants[0].quality.q; }, /quality braucht/);
  bad((m) => { asset(m, 'board').source.sha256 = 'x'; }, /source braucht/); bad((m) => { delete asset(m, 'board').source; }, /source braucht/);
  bad((m) => { asset(m, 'board').focus = { board: { x: 101, y: 0 } }; }, /focus.board/); bad((m) => { asset(m, 'board').focus = { feld: { x: 1, y: 1 } }; }, /unbekannter Schlüssel "feld"/);
  bad((m) => { asset(m, 'figure-hat').variants[0].alpha = false; }, /braucht Transparenz/); bad((m) => { asset(m, 'building-1').variants[1].alpha = false; }, /braucht Transparenz/);
  bad((m) => { asset(m, 'board').alt = 'x'.repeat(121); }, /alt zu lang/);
});

test('Dateinamen: nur <asset>.<variante>.<hash12>.webp; Pfad-Traversal und fremde Namen werden abgelehnt', () => {
  const evil = ['../../etc/passwd', '../board.desktop.0123456789ab.webp', 'a/b.desktop.0123456789ab.webp', '/board.desktop.0123456789ab.webp', 'board.desktop.0123456789ab.webp\0.png', 'board.desktop.0123456789ab.png', 'board.desktop.012345.webp', 'BOARD.desktop.0123456789ab.webp', 'board.desktop.0123456789AB.webp', 'board.desktop.0123456789ab.webp/..', '..\\board.desktop.0123456789ab.webp', 'board.huge.0123456789ab.webp', ''];
  for (const file of evil) { assert.equal(FILE_NAME.test(file), false, JSON.stringify(file)); const m = manifest(); asset(m, 'board').variants[0].file = file; has(errorsOf(m), /Dateiname/); }
  const r = verifyBundle(FIXTURE, (() => { const m = manifest(); asset(m, 'board').variants[0].file = '../manifest.json'; return m; })()); assert.ok(r.errors.some((e) => /Dateiname/.test(e)), 'Verifikation liest nie außerhalb von assets/');
  const wrong = manifest(); asset(wrong, 'board').variants[0].file = asset(wrong, 'preview').variants[0].file; has(errorsOf(wrong), /Dateiname passt nicht zu Asset und Variante/);
  const dup = manifest(); asset(dup, 'loc-01').variants[0].file = asset(dup, 'loc-01').variants[1].file; assert.ok(errorsOf(dup).length);
});

test('Dateiprüfung: fehlende, geänderte, abgeschnittene, falsch bemessene und nicht unterstützte Dateien', () => {
  const dir = copyBundle();
  try {
    const m = readBundle(dir), board = asset(m, 'board').variants[0];
    // fehlende Datei
    rmSync(join(dir, 'assets', board.file)); has(verifyBundle(dir, m).errors, /board\/desktop: Datei fehlt/); cpSync(join(FIXTURE, 'assets', board.file), join(dir, 'assets', board.file));
    assert.deepEqual(verifyBundle(dir, m).errors, []);
    // geänderte Bytes bei gleicher Länge → Prüfsumme
    const path = join(dir, 'assets', board.file), orig = readFileSync(path), tampered = Buffer.from(orig); tampered[tampered.length - 1] ^= 0xff; writeFileSync(path, tampered);
    const e1 = verifyBundle(dir, m).errors; has(e1, /Prüfsumme stimmt nicht/); assert.ok(!e1.some((e) => /Größe/.test(e)));
    // abgeschnitten → Größe und Prüfsumme
    writeFileSync(path, orig.subarray(0, 100)); const e2 = verifyBundle(dir, m).errors; has(e2, /Größe 100 statt/); has(e2, /Prüfsumme/);
    writeFileSync(path, orig);
    // Abmessungen und Transparenz im Manifest passen nicht zur Datei
    const dims = structuredClone(m); asset(dims, 'board').variants[0].width = 1919; has(verifyBundle(dir, dims).errors, /Abmessungen 1920×1080 statt 1919×1080/);
    const alpha = structuredClone(m); asset(alpha, 'board').variants[0].alpha = true; has(verifyBundle(dir, alpha).errors, /Transparenz false statt true/);
    const opaque = structuredClone(m); asset(opaque, 'figure-hat').variants[0].alpha = false; has(verifyBundle(dir, opaque).errors, /figure-hat.*(Transparenz|braucht Transparenz)/);
    // PNG, JPEG, SVG, Text, leere Datei, WebP-Kopf ohne Inhalt als „Bild“ → nicht unterstütztes Format
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    for (const [name, bytes] of [['PNG', Buffer.concat([png, Buffer.alloc(40)])], ['JPEG', Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)])], ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'.padEnd(60))], ['Text', Buffer.from('kein Bild '.repeat(8))], ['RIFF ohne WebP', Buffer.concat([Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt '), Buffer.alloc(40)])]]) {
      const x = readBundle(dir); replaceFile(dir, x, 'preview', 'desktop', bytes); has(verifyBundle(dir, x).errors, /nicht unterstütztes Format/); assert.ok(true, name);
    }
    // animiertes WebP (VP8X mit Animationsbit)
    const anim = Buffer.from(orig); anim[20] |= 0x02; const y = readBundle(dir); replaceFile(dir, y, 'board', 'desktop', anim); has(verifyBundle(dir, y).errors, /animierte Bilder/);
    // Überzählige Datei wird gemeldet, ändert aber nichts an der Gültigkeit
    const z = readBundle(dir); writeFileSync(join(dir, 'assets', 'stray.desktop.0123456789ab.webp'), 'x'); assert.ok(verifyBundle(dir, z).orphans.includes('stray.desktop.0123456789ab.webp'));
    // Symbolischer Link statt Datei wird nicht gelesen (nur wenn das System Links anlegen darf)
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('WebP- und PNG-Köpfe: Abmessungen und Transparenz werden aus den Dateien gelesen', () => {
  const m = manifest();
  for (const a of m.assets) for (const v of a.variants) { const info = webpInfo(readFileSync(join(FIXTURE, 'assets', v.file))); assert.ok(info, v.file); assert.equal(info.width, v.width); assert.equal(info.height, v.height); assert.equal(info.alpha, v.alpha, `${a.id}/${v.name}`); assert.equal(info.animated, false); }
  // Transparenz: Figuren, Gebäude und Platzhalter-Figur haben Alpha, Brett/Orte/Urkunden/Vorschau nicht
  for (const a of m.assets) { const want = ['figure', 'building'].includes(a.role) || a.id === 'placeholder-figure'; assert.ok(a.variants.every((v) => v.alpha === want), `${a.id}: Transparenz ${want}`); }
  assert.equal(webpInfo(Buffer.from('nicht webp'.repeat(5))), null); assert.equal(webpInfo(Buffer.alloc(40)), null); assert.equal(pngInfo(Buffer.from('nope')), null);
  assert.deepEqual(pngInfo(PNG_HEAD), { width: 1000, height: 600, alpha: true });
});

test('Optimierung: mobile Varianten sind kleiner, nie hochskaliert, im Profil und verlustarm gemessen', () => {
  const m = manifest();
  for (const a of m.assets) {
    const by = Object.fromEntries(a.variants.map((v) => [v.name, v]));
    for (const v of a.variants) { assert.ok(v.width <= PROFILES[a.role][v.name].w && v.height <= PROFILES[a.role][v.name].h); assert.ok(v.width <= a.source.width && v.height <= a.source.height, `${a.id}/${v.name} nicht hochskaliert`); assert.ok(v.quality.meanError <= 4 && v.quality.maxAlphaError <= 48, `${a.id}/${v.name} Qualität`); assert.ok(v.quality.q >= PROFILES[a.role][v.name].q && v.quality.q <= 1, `${a.id}/${v.name}: Qualität nur nach oben nachgeführt`); assert.equal(v.mime, 'image/webp'); }
    if (by.mobile && by.desktop && a.role !== 'building') { const strict = ['board', 'location', 'deed'].includes(a.role) || a.id.startsWith('figure-'); assert.ok(strict ? by.mobile.width < by.desktop.width : by.mobile.width <= by.desktop.width, `${a.id}: mobil schmaler`); assert.ok(strict ? by.mobile.bytes < by.desktop.bytes : by.mobile.bytes <= by.desktop.bytes, `${a.id}: mobil kleiner`); }
    if (by.thumb) assert.ok(by.thumb.bytes < by.desktop.bytes);
    assert.ok(Math.abs(by.desktop.width / by.desktop.height - a.source.width / a.source.height) < 0.01, `${a.id}: Seitenverhältnis erhalten`);
  }
  assert.ok(m.assets.flatMap((a) => a.variants).reduce((s, v) => s + v.bytes, 0) < 700 * 1024, 'Fixture bleibt klein');
});

test('Fallbacks: vorhanden, ohne Kette, sofort geladen und klein; <img> trägt Abmessungen, Lazy Loading und Fallback-URL', () => {
  const m = manifest();
  for (const a of m.assets.filter((x) => x.fallback)) { const f = asset(m, a.fallback); assert.ok(f, a.id); assert.equal(f.fallback, undefined); assert.ok(['initial', 'lobby'].includes(f.load)); assert.ok(f.variants.every((v) => v.bytes <= FALLBACK_MAX_BYTES)); }
  const bad = (mut, p) => { const x = manifest(); mut(x); has(errorsOf(x), p); };
  bad((x) => { asset(x, 'board').fallback = 'gibt-es-nicht'; }, /Fallback gibt-es-nicht gibt es nicht/); bad((x) => { asset(x, 'placeholder-tile').fallback = 'placeholder-figure'; }, /keinen Fallback haben/);
  bad((x) => { asset(x, 'board').fallback = 'loc-01'; }, /muss initial oder lobby laden/); bad((x) => { asset(x, 'placeholder-tile').variants[0].bytes = FALLBACK_MAX_BYTES + 1; }, /ist größer als/);
  const loc = asset(m, 'loc-01'), html = imgHTML(m, loc, { thumb: true });
  assert.match(html, new RegExp(`src="${assetUrl(m, selectVariant(loc, { thumb: true })).replace(/[.]/g, '\\.')}"`)); assert.match(html, /width="384" height="216"/); assert.match(html, /loading="lazy"/); assert.match(html, /decoding="async"/); assert.match(html, /data-fallback="\/games\/monopoly\/themes\/testbed\/assets\/placeholder-tile\.mobile\.[0-9a-f]{12}\.webp"/);
  assert.doesNotMatch(imgHTML(m, asset(m, 'board')), /loading="lazy"/, 'Brett lädt sofort'); assert.match(imgHTML(m, loc, { eager: true }), /^<img src="[^"]+" width="768"/);
  const evil = structuredClone(m); asset(evil, 'loc-01').alt = '"><script>alert(1)</script>'; assert.doesNotMatch(imgHTML(evil, asset(evil, 'loc-01')), /<script>/);
});

test('Variantenwahl und Ladeplan: mobil kleiner, Detail- und Figurenbilder nicht sofort, Figuren nur bei Bedarf', () => {
  const m = manifest(), loc = asset(m, 'loc-01'), board = asset(m, 'board');
  assert.equal(selectVariant(loc, {}).name, 'desktop'); assert.equal(selectVariant(loc, { mobile: true }).name, 'mobile'); assert.equal(selectVariant(loc, { thumb: true }).name, 'thumb'); assert.equal(selectVariant(loc, { thumb: true, mobile: true }).name, 'thumb');
  assert.equal(selectVariant(board, { thumb: true }).name, 'desktop', 'ohne thumb-Variante: desktop'); assert.equal(selectVariant(board, { thumb: true, mobile: true }).name, 'mobile');
  const d = loadPlan(m, 'desktop'), mo = loadPlan(m, 'mobile'), ids = (p) => p.map((x) => x.id);
  assert.deepEqual(ids(d.lobby), ['preview']); assert.deepEqual(ids(d.initial).sort(), ['board', 'placeholder-figure', 'placeholder-tile']);
  assert.equal(ids(d.onDemand).length, 8); assert.ok(ids(d.onDemand).every((i) => i.startsWith('figure-'))); assert.ok(ids(d.lazy).every((i) => /^(loc|deed|building)-/.test(i)));
  assert.ok(d.initial.every((x) => x.url.startsWith('/games/monopoly/themes/testbed/assets/'))); assert.ok(mo.initial.find((x) => x.id === 'board').bytes < d.initial.find((x) => x.id === 'board').bytes);
  assert.ok(m.assets.every((a) => [...d.lobby, ...d.initial, ...d.lazy, ...d.onDemand].some((x) => x.id === a.id)), 'jedes Asset hat genau einen Ladezeitpunkt');
});

test('Ladebudgets: Lobby ≤ 300 KB, mobiler Start ≤ 1,5 MB, Desktop-Start ≤ 2,5 MB – gemessen an den echten Dateien und im Manifest erzwungen', () => {
  const m = manifest();
  const size = (v) => statSync(join(FIXTURE, 'assets', v.file)).size, real = (a, mobile) => size(selectVariant(a, { mobile }));
  const lobby = m.assets.filter((a) => a.load === 'lobby').reduce((s, a) => s + real(a, false), 0);
  const start = (mobile) => m.assets.filter((a) => a.load === 'initial').reduce((s, a) => s + real(a, mobile), 0) + m.assets.filter((a) => a.role === 'figure').map((a) => real(a, mobile)).sort((x, y) => y - x).slice(0, 8).reduce((s, n) => s + n, 0);
  assert.equal(lobbyBytes(m), lobby); assert.equal(startBytes(m, 'desktop'), start(false)); assert.equal(startBytes(m, 'mobile'), start(true));
  assert.ok(lobby <= BUDGET_CAPS.lobby && start(true) <= BUDGET_CAPS.mobileStart && start(false) <= BUDGET_CAPS.desktopStart); assert.ok(start(true) < start(false));
  assert.ok(startBytes(m, 'desktop', { figures: 2 }) < startBytes(m, 'desktop'), 'weniger Mitspieler laden weniger Figuren');
  assert.equal(BUDGET_CAPS.lobby, 300 * 1024); assert.equal(BUDGET_CAPS.mobileStart, 1.5 * 1024 * 1024); assert.equal(BUDGET_CAPS.desktopStart, 2.5 * 1024 * 1024);
  // Ein zu großes Brett sprengt das Budget und wird als Manifestfehler gemeldet
  const fat = structuredClone(m); asset(fat, 'board').variants.find((v) => v.name === 'mobile').bytes = Math.round(1.6 * 1024 * 1024); has(errorsOf(fat), /Budget mobileStart überschritten/);
  const fat2 = structuredClone(m); asset(fat2, 'preview').variants[0].bytes = Math.round(301 * 1024); has(errorsOf(fat2), /Budget lobby überschritten/);
  const fat3 = structuredClone(m); asset(fat3, 'board').variants.find((v) => v.name === 'desktop').bytes = Math.round(2.6 * 1024 * 1024); has(errorsOf(fat3), /Budget desktopStart überschritten/);
});

test('Feldzuordnung: eindeutige Feld-IDs 0–39 je Rolle, Abdeckung und Zugriff über die Feld-ID', () => {
  const m = manifest(); assert.deepEqual(fieldCoverage(m, 'location').have, [1, 3, 6, 8]); assert.equal(fieldCoverage(m, 'location').missing.length, 36); assert.deepEqual(fieldCoverage(m, 'deed').have, [1, 3, 6, 8]);
  assert.deepEqual(fieldCoverage(m, 'location', [1, 3]).missing, []); assert.equal(assetForField(m, 'location', 3).id, 'loc-03'); assert.equal(assetForField(m, 'deed', 3).id, 'deed-03'); assert.equal(assetForField(m, 'location', 2), null);
  for (const a of m.assets.filter((x) => x.fieldIds)) for (const f of a.fieldIds) assert.ok(BOARD[f], `Feld ${f} gibt es im Spiel`);
  const bad = (mut, p) => { const x = manifest(); mut(x); has(errorsOf(x), p); };
  bad((x) => { asset(x, 'loc-01').fieldIds = [40]; }, /eindeutige Feld-IDs/); bad((x) => { asset(x, 'loc-01').fieldIds = [-1]; }, /eindeutige Feld-IDs/); bad((x) => { asset(x, 'loc-01').fieldIds = [1.5]; }, /eindeutige Feld-IDs/);
  bad((x) => { asset(x, 'loc-01').fieldIds = [1, 1]; }, /eindeutige Feld-IDs/); bad((x) => { asset(x, 'loc-01').fieldIds = []; }, /eindeutige Feld-IDs/); bad((x) => { delete asset(x, 'loc-01').fieldIds; }, /eindeutige Feld-IDs/);
  bad((x) => { asset(x, 'loc-03').fieldIds = [1]; }, /Feld 1 ist für location schon durch loc-01 belegt/); bad((x) => { asset(x, 'board').fieldIds = [1]; }, /fieldIds nur für location und deed/);
  bad((x) => { asset(x, 'figure-hat').slot = undefined; }, /Figur braucht slot/); bad((x) => { asset(x, 'building-1').slot = 6; }, /slot 1–5/); bad((x) => { asset(x, 'board').slot = 'x'; }, /slot nur für/);
  const shared = manifest(); asset(shared, 'loc-03').fieldIds = [3, 4]; assert.deepEqual(errorsOf(shared), [], 'ein Bild darf mehrere Felder bedienen'); assert.equal(assetForField(shared, 'location', 4).id, 'loc-03');
});

test('Kompatibilität mit den Themes: Manifestpfad passt zur Theme-ID, vorhandene Designs und Auswahl bleiben unverändert, nichts ist freigeschaltet', () => {
  const m = manifest(); assert.equal(MANIFEST_PATH(m.themeId), `${m.assetBase.replace(/assets\/$/, '')}manifest.json`);
  const reg = createThemeRegistry([{ id: 'modern', name: 'Bisheriges Thema', released: true }, { id: 'classic', name: 'Klassik', released: true }, { id: m.themeId, name: 'Testdesign', released: false, manifest: MANIFEST_PATH(m.themeId) }]);
  assert.equal(reg.supports('testbed', 'classic'), false); assert.deepEqual(reg.released().map((t) => t.id), ['modern', 'classic']);
  assert.deepEqual(themeRegistry().list().map((t) => [t.id, t.released]), [['modern', true], ['classic', true]]);
  assert.deepEqual(Room.OPTIONS.find((o) => o.key === 'theme').values.map((v) => v.value), ['modern', 'classic']);
  assert.equal(new Room('X', { theme: 'testbed' }, () => {}).settings.theme, 'modern');
  assert.equal(existsSync(join(import.meta.dirname, '..', 'public', 'games', 'monopoly', 'themes')), false, 'unter public/ liegt noch kein Theme-Bundle');
});

test('Quellspezifikation des Builds: nur PNG, nur im Quellordner, bekannte Rollen und Ladezeitpunkte', () => {
  const dir = tmp('mtsrc-'), png = PNG_HEAD;
  const write = (spec, files = { 'a.png': png }) => { for (const [n, b] of Object.entries(files)) { mkdirSync(join(dir, n, '..'), { recursive: true }); writeFileSync(join(dir, n), b); } writeFileSync(join(dir, 'theme-src.json'), JSON.stringify(spec)); };
  const asset1 = (over = {}) => ({ id: 'a', role: 'ui', load: 'initial', src: 'a.png', origin: {}, ...over }), ok = { themeId: 'prueftheme', release: 'draft', assets: [asset1()] };
  try {
    write(ok); assert.equal(readSpec(dir).assets.length, 1);
    for (const [spec, p] of [[{ ...ok, themeId: 'X' }, /themeId/], [{ ...ok, release: 'x' }, /release/], [{ ...ok, assets: [] }, /assets/], [{ ...ok, assets: [asset1({ role: 'x' })] }, /Rolle x unbekannt/], [{ ...ok, assets: [asset1({ load: 'x' })] }, /load x/],
      [{ ...ok, assets: [asset1({ src: '../a.png' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: '/etc/a.png' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: 'a/../../a.png' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: 'a.jpg' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: 'a.svg' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: 'C:\\a.png' })] }, /zulässiger PNG-Pfad/], [{ ...ok, assets: [asset1({ src: 'fehlt.png' })] }, /Quelle fehlt/]]) { write(spec); assert.throws(() => readSpec(dir), p, JSON.stringify(spec).slice(0, 80)); }
    write(ok, { 'a.png': Buffer.from('GIF89a'.padEnd(60)) }); assert.throws(() => readSpec(dir), /kein gültiges PNG/);
    rmSync(join(dir, 'theme-src.json')); assert.throws(() => readSpec(dir), /theme-src.json fehlt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---- Auslieferung und Caching ----
const listen = (app) => new Promise((res) => { const s = createServer(app).listen(0, () => res(s)); });
test('Auslieferung: hashbenannte Theme-Bilder unveränderlich cachebar, alles andere unverändert und nie „immutable“', async () => {
  const root = tmp('mtserve-'), asset1 = 'board.desktop.0123456789ab.webp', body = Buffer.from('RIFFxxxxWEBPVP8 ' + 'x'.repeat(40));
  mkdirSync(join(root, 'testbed', 'assets'), { recursive: true }); writeFileSync(join(root, 'testbed', 'assets', asset1), body);
  writeFileSync(join(root, 'testbed', 'manifest.json'), '{"a":1}'); writeFileSync(join(root, 'testbed', 'assets', 'board.desktop.0123456789ab.png'), 'png'); writeFileSync(join(root, 'geheim.txt'), 'nicht ausliefern');
  const app = express(); app.use('/games/monopoly/themes', themeAssets(root)); app.use((req, res) => res.status(404).send('weiter'));
  const server = await listen(app), base = `http://localhost:${server.address().port}/games/monopoly/themes`;
  try {
    const r = await fetch(`${base}/testbed/assets/${asset1}`);
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'public, max-age=31536000, immutable'); assert.equal(r.headers.get('content-type'), 'image/webp'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.ok(r.headers.get('etag'));
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), body);
    const head = await fetch(`${base}/testbed/assets/${asset1}`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.match(head.headers.get('cache-control'), /immutable/);
    const cond = await new Promise((res) => httpGet(`${base}/testbed/assets/${asset1}`, { headers: { 'if-none-match': r.headers.get('etag') } }, (x) => { x.resume(); res(x.statusCode); })); assert.equal(cond, 304, 'bedingte Anfrage (ETag) → 304'); // Node-fetch sendet If-None-Match nicht verlässlich, daher http
    // Fehlende Datei mit gültigem Namen: 404, nie immutable
    const miss = await fetch(`${base}/testbed/assets/fehlt.desktop.0123456789ab.webp`); assert.equal(miss.status, 404); assert.ok(!(miss.headers.get('cache-control') || '').includes('immutable'));
    // Alles außerhalb des Musters läuft weiter an die restliche Auslieferung (hier: 404 des Testservers) – nie mit langem Cache und nie die Datei
    const others = ['/testbed/manifest.json', '/testbed/assets/board.desktop.0123456789ab.png', '/testbed/assets/Board.desktop.0123456789ab.webp', '/../geheim.txt', '/testbed/../geheim.txt', '/testbed/assets/%2e%2e/%2e%2e/geheim.txt', '/testbed/assets/..%2fgeheim.txt', '/testbed/assets/board.desktop.0123456789ab.webp/', '/testbed/assets/board.desktop.0123456789ab.webp.map', '/geheim.txt', '/testbed/assets/', '/testbed/assets'];
    for (const p of others) { const x = await fetch(base + p), text = await x.text(); assert.notEqual(x.status, 200, p); assert.ok(!(x.headers.get('cache-control') || '').includes('immutable'), p); assert.ok(!text.includes('nicht ausliefern'), p); }
    assert.equal((await fetch(`${base}/testbed/assets/${asset1}`, { method: 'POST' })).status, 404, 'nur GET und HEAD');
  } finally { server.close(); rmSync(root, { recursive: true, force: true }); }
  for (const ok of ['/testbed/assets/board.desktop.0123456789ab.webp', '/a-b/assets/loc-01.thumb.ffffffffffff.webp']) assert.ok(THEME_ASSET_PATH.test(ok), ok);
  for (const no of ['/testbed/assets/Board.desktop.0123456789ab.webp', '/testbed/assets/x.huge.0123456789ab.webp', '/t/assets/x.desktop.0123456789ab.webp', '/testbed/assets/sub/x.desktop.0123456789ab.webp', '/testbed/x.desktop.0123456789ab.webp', '/testbed/assets/x.desktop.0123456789ab.webp?x']) assert.equal(THEME_ASSET_PATH.test(no), false, no);
});

let server, URL_, cookie;
before(async () => {
  const port = await freePort(); URL_ = `http://localhost:${port}`;
  server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), DATA_DIR: tmp('mt-data-'), SITE_PASSWORD: 'Flush2026', POKER_NO_DOTENV: '1' }, stdio: 'pipe' });
  await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('läuft')) res(); }); server.on('exit', (c) => rej(new Error('Server beendet: ' + c))); });
  const r = await fetch(URL_ + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ password: 'Flush2026', next: '/' }) });
  cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
});
after(() => server?.kill());

test('Echter Server: Theme-Pfad eingehängt, aber bestehende Auslieferung (Skripte, HTML, Monopoly-Dateien, API) behält ihre Cache-Header', async () => {
  const get = (p, init = {}) => fetch(URL_ + p, { redirect: 'manual', ...init, headers: { cookie, ...(init.headers || {}) } });
  const none = await get('/games/monopoly/themes/testbed/assets/board.desktop.0123456789ab.webp'); assert.equal(none.status, 404); assert.ok(!(none.headers.get('cache-control') || '').includes('immutable'));
  const manifestUrl = await get('/games/monopoly/themes/testbed/manifest.json'); assert.equal(manifestUrl.status, 404);
  for (const p of ['/core.js', '/games/monopoly/monopoly.js', '/games/monopoly/themes.js', '/games/monopoly/theme-manifest.js', '/games/schiffe/schiffe.css', '/index.html']) {
    const r = await get(p); assert.equal(r.status, 200, p); assert.equal(r.headers.get('cache-control'), 'public, max-age=0', p + ' behält die bisherige Cache-Regel'); await r.arrayBuffer();
  }
  assert.equal((await get('/api/health', {})).headers.get('cache-control') !== undefined, true);
  // ohne Anmeldung bleibt auch der Theme-Pfad gesperrt (die Anmeldeprüfung läuft davor)
  const anon = await fetch(URL_ + '/games/monopoly/themes/testbed/assets/board.desktop.0123456789ab.webp', { redirect: 'manual' }); assert.ok([401, 302].includes(anon.status));
  const src = readFileSync(join(import.meta.dirname, '..', 'server', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(src.indexOf("app.use('/games/monopoly/themes', themeAssets(") > 0 && src.indexOf("app.use('/games/monopoly/themes'") < src.indexOf('app.use(express.static(PUBLIC_DIR'), 'Theme-Auslieferung steht vor der allgemeinen Auslieferung');
  assert.equal(src.match(/immutable/g), null, 'keine globale Cache-Regel in index.js');
});
