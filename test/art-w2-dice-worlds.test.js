// ART-W2 · Würfelwelten TW-14, TW-11, TW-09, TW-13: Registry, Zielspiele, gemeinsamer Baustein, Kontraste, eigene Grafiken, Schriftlizenzen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES } from '../games/index.js';
import { DICE_GAMES, DICE_WORLDS } from '../public/games/theme-worlds/dice-worlds.js';
import { themeRegistry, validateWorld } from '../public/games/theme-worlds/registry.js';

const DIR = 'public/games/theme-worlds/dice';
const IDS = ['TW-14', 'TW-11', 'TW-09', 'TW-13'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const vars = (css) => Object.fromEntries([...css.matchAll(/--(twd-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const colors = (v) => v.match(/#[0-9a-fA-F]{6}\b/g) || [];

test('ART-W2: vier Würfelwelten aus dem Konzept, gültig, freigegeben, für genau die 13 Würfelspiele', () => {
  assert.deepEqual(DICE_WORLDS.map((w) => w.id), IDS);
  assert.deepEqual(DICE_WORLDS.map((w) => w.name.de), ['Saloon', 'Piratenbucht', 'Runen & Nordlicht', 'Neon-Arcade']);
  assert.equal(DICE_GAMES.length, 13);
  for (const g of DICE_GAMES) assert.ok(GAMES[g], `Spiel ${g} existiert`);
  const reg = themeRegistry();
  for (const w of DICE_WORLDS) {
    assert.deepEqual(validateWorld(w, { gameIds: Object.keys(GAMES) }), []);
    assert.equal(w.kind, 'dice'); assert.equal(w.variants, null); assert.deepEqual(w.effects, []);
    for (const g of DICE_GAMES) assert.equal(reg.worldFor(g, w.id)?.id, w.id, `${w.id} in ${g}`);
    for (const g of ['monopoly', 'farbenchaos', 'poker', 'schach', 'viergewinnt']) assert.equal(reg.worldFor(g, w.id), null, `${w.id} nicht in ${g}`);
    assert.equal(reg.appliesTo(w, 'kniffel', 'triple'), true, 'auch Kniffel Dreifach');
  }
  for (const g of DICE_GAMES) assert.deepEqual(reg.worldsFor(g).map((w) => w.id), IDS);
});

test('ART-W2: gemeinsamer Baustein und Welt-Dateien wirken nur innerhalb der Welt; jede Welt lädt nur ihre Dateien', () => {
  const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = (css) => strip(css).replace(/@font-face\s*{[^}]*}/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);
  for (const sel of selectors(readFileSync(join(DIR, 'dice-worlds.css'), 'utf8'))) for (const s of sel.split(/,(?![^(]*\))/)) assert.match(s.trim(), /^body\[data-theme-kind="dice"\] #kg /, s);
  for (const w of DICE_WORLDS) {
    const slug = w.id.toLowerCase(), css = readFileSync(join(DIR, `${slug}.css`), 'utf8');
    for (const sel of selectors(css)) assert.equal(sel, `body[data-theme-world="${w.id}"]`);
    assert.deepEqual(w.assets.css, ['/games/theme-worlds/dice/dice-worlds.css', `/games/theme-worlds/dice/${slug}.css`]);
    for (const u of [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])) {
      assert.ok(u.includes(slug) || u.startsWith('/fonts/worlds/'), `${w.id} verweist nur auf eigene Dateien: ${u}`);
      assert.ok(existsSync(join('public', u)), u);
    }
    for (const u of [w.assets.preview, ...w.assets.preload]) assert.ok(existsSync(join('public', u)), u);
  }
});

test('ART-W2: Zahlen und Augen bleiben lesbar – Kontraste je Welt (Augen ≥ 3:1, Text ≥ 4,5:1)', () => {
  for (const w of DICE_WORLDS) {
    const v = vars(readFileSync(join(DIR, `${w.id.toLowerCase()}.css`), 'utf8'));
    const pip = colors(v['twd-pip'])[0];
    for (const face of colors(v['twd-face'])) assert.ok(contrast(pip, face) >= 3, `${w.id}: Auge ${pip} auf ${face} = ${contrast(pip, face).toFixed(2)}`);
    for (const f of colors(v['twd-flap'])) assert.ok(contrast(colors(v['twd-flap-ink'])[0], f) >= 4.5, `${w.id}: Klappenzahl auf ${f}`);
    for (const f of colors(v['twd-flap-shut'])) assert.ok(contrast(colors(v['twd-flap-shut-ink'])[0], f) >= 4.5, `${w.id}: geschlossene Klappe auf ${f}`);
    assert.ok(contrast(colors(v['twd-sheet-head-ink'])[0], colors(v['twd-sheet-head'])[0]) >= 4.5, `${w.id}: Kopf des Blocks`);
    for (const s of colors(v['twd-stage'])) assert.ok(contrast(colors(v['twd-ink'])[0], s) >= 4.5, `${w.id}: Text auf der Bühne`);
    assert.ok(contrast(colors(v['twd-kept'])[0], colors(v['twd-stage'])[0]) >= 3, `${w.id}: Markierung „bleibt“ sichtbar`);
    for (const key of ['twd-table', 'twd-face', 'twd-pip', 'twd-kept', 'twd-hidden', 'twd-cup', 'twd-tray', 'twd-flap', 'twd-font', 'twd-stage']) assert.ok(v[key], `${w.id}: ${key}`);
  }
});

test('ART-W2: eigene SVG-Grafiken vollständig, klein, ohne Skripte; Schriften mit OFL-Lizenztext; alles in ART_LICENSES.md', () => {
  const want = ['dice-worlds.css', ...IDS.flatMap((id) => { const s = id.toLowerCase(); return [`${s}.css`, `table-${s}.svg`, `cup-${s}.svg`, `preview-${s}.svg`]; })].sort();
  assert.deepEqual(readdirSync(DIR).sort(), want);
  let total = 0;
  for (const f of readdirSync(DIR)) {
    total += statSync(join(DIR, f)).size;
    if (f.endsWith('.svg')) { const t = readFileSync(join(DIR, f), 'utf8'); assert.match(t, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.doesNotMatch(t, /<script|on[a-z]+=|href=|https?:\/\/(?!www\.w3\.org)/, f); }
  }
  assert.ok(total < 60 * 1024, `Würfelwelten zusammen ${total} Bytes`);
  for (const font of ['rye', 'pirata-one']) {
    const b = readFileSync(`public/fonts/worlds/${font}.woff2`); assert.equal(b.subarray(0, 4).toString('latin1'), 'wOF2', font);
    const ofl = readFileSync(`public/fonts/worlds/${font}-OFL.txt`, 'utf8'); assert.match(ofl, /SIL Open Font License, Version 1\.1/); assert.match(ofl, /Reserved Font Name/);
  }
  const lic = readFileSync('docs/design/ART_LICENSES.md', 'utf8');
  assert.ok(lic.includes('public/games/theme-worlds/dice/') && lic.includes('build-dice-worlds-art.mjs'));
  assert.ok(lic.includes('public/fonts/worlds/rye.woff2') && lic.includes('public/fonts/worlds/pirata-one.woff2'));
  const shown = JSON.stringify(DICE_WORLDS.map((w) => [w.name, w.description])).toLowerCase();
  for (const bad of ['red dead', 'outrun', 'tron', 'pirates of the caribbean', 'jack sparrow', 'thor', 'marvel', 'vikings', 'cthulhu']) assert.equal(shown.includes(bad), false, bad);
});
