// ART-W3 · Brettwelten TW-08 Götterberg, TW-09 Runen & Nordlicht (Brett-Facette), TW-10 Tafelrunde für sieben klassische Brettspiele:
// Registry mit Facetten, getrennte Würfel-/Brett-Dateien von TW-09, Zierformen-Prüfung, Scoping des CSS, Kontraste, eigene Grafiken, Lizenzen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES } from '../games/index.js';
import { BOARD_GAMES, TW08, TW10, TW09_BOARD_FACET } from '../public/games/theme-worlds/board-worlds.js';
import { DICE_GAMES } from '../public/games/theme-worlds/dice-worlds.js';
import { themeRegistry, createRegistry, validateWorld } from '../public/games/theme-worlds/registry.js';

const DIR = 'public/games/theme-worlds/board';
const IDS = ['TW-08', 'TW-09', 'TW-10'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const vars = (css) => Object.fromEntries([...css.matchAll(/--(twb-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const colors = (v) => v.match(/#[0-9a-fA-F]{6}\b/g) || [];
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = (css) => strip(css).replace(/@font-face\s*{[^}]*}/g, '').split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);

test('ART-W3: drei Brettwelten für genau die sieben Brettspiele; TW-09 bleibt eine Welt (keine doppelte ID)', () => {
  assert.deepEqual(BOARD_GAMES, ['schach', 'muehle', 'dame', 'reversi', 'hex', 'viergewinnt', 'backgammon']);
  for (const g of BOARD_GAMES) assert.ok(GAMES[g], g);
  const reg = themeRegistry();
  assert.equal(reg.list().filter((w) => w.id === 'TW-09').length, 1, 'TW-09 genau einmal');
  for (const w of [TW08, TW10]) assert.deepEqual(validateWorld(w, { gameIds: Object.keys(GAMES) }), []);
  for (const g of BOARD_GAMES) assert.deepEqual(reg.worldsForGame(g).map((w) => w.id), ['TW-09', 'TW-08', 'TW-10'], g);
  for (const g of ['monopoly', 'poker', 'uno', 'kniffel']) for (const id of ['TW-08', 'TW-10']) assert.equal(reg.worldForGame(g, id), null, `${id} nicht in ${g}`);
  // TW-09: Würfelspiele erhalten die Würfel-Ausprägung, Brettspiele die Brett-Ausprägung – Dateien vollständig getrennt
  for (const g of DICE_GAMES) { const w = reg.worldForGame(g, 'TW-09'); assert.equal(w.kind, 'dice'); assert.ok(w.assets.css.every((u) => u.includes('/dice/')), g); }
  for (const g of BOARD_GAMES) {
    const w = reg.worldForGame(g, 'TW-09'); assert.equal(w.id, 'TW-09'); assert.equal(w.kind, 'board'); assert.equal(w.name.de, 'Runen & Nordlicht');
    assert.deepEqual(w.assets.css, ['/games/theme-worlds/board/board-worlds.css', '/games/theme-worlds/board/tw-09.css']);
    assert.ok(Object.isFrozen(w)); assert.equal(reg.worldForGame(g, 'TW-09'), w, 'gleiche Ansicht bei jedem Aufruf (kein Neuaufbau)');
    assert.equal(reg.appliesTo(w, g, null), true);
  }
  // Alte Abfrage bleibt unverändert: worldFor kennt nur die Hauptform (ART-W2-Verträge)
  assert.equal(reg.worldFor('schach', 'TW-09'), null); assert.equal(reg.worldFor('kniffel', 'TW-09').kind, 'dice');
  assert.equal(reg.worldForGame('schach', 'TW-99'), null); assert.equal(reg.worldForGame('schach', { id: 'TW-08' }), null);
});

test('ART-W3: Facetten und Zierformen werden streng geprüft', () => {
  const ids = Object.keys(GAMES), base = themeRegistry().list().find((w) => w.id === 'TW-09');
  const { facets, ...dice } = base;
  const errs = (w) => validateWorld(w, { gameIds: ids }).join(' | ');
  assert.equal(errs({ ...dice, facets: [TW09_BOARD_FACET] }), '');
  assert.match(errs({ ...dice, facets: [{ ...TW09_BOARD_FACET, games: ['kniffel'] }] }), /.+/, 'Facette darf keine Spiele der Hauptform doppeln');
  assert.match(errs({ ...dice, facets: [{ ...TW09_BOARD_FACET, kind: 'card' }] }), /.+/, 'keine Kartenfacette');
  assert.match(errs({ ...dice, facets: [{ ...TW09_BOARD_FACET, extra: 1 }] }), /.+/, 'unbekannte Schlüssel');
  for (const bad of ['<script>x</script>', '<path onload="x" d="M0 0"/>', '<image href="http://x"/>', '<path style="fill:url(http://x)"/>', '<foreignObject/>']) assert.match(errs({ ...TW08, art: { chess: { all: bad } } }), /.+/, bad);
  assert.throws(() => createRegistry([TW08, { ...TW10, id: 'TW-08' }]), /doppelt|TW-08/);
});

test('ART-W3: gemeinsamer Baustein wirkt nur in Brettwelten und je Spiel; Welt-Dateien setzen nur Variablen; keine Animation', () => {
  const shared = readFileSync(join(DIR, 'board-worlds.css'), 'utf8');
  for (const sel of selectors(shared)) for (const s of sel.split(/,(?![^(]*\))/)) assert.match(s.trim(), /^body\[data-theme-kind="board"\] #kg(\.kg-[a-z]+|:is\(\.kg-[a-z]+(, \.kg-[a-z]+)*\)) /, s);
  for (const g of BOARD_GAMES) assert.ok(shared.includes(`.kg-${g}`), `Adapter für ${g}`);
  assert.doesNotMatch(strip(shared), /animation|transition|@keyframes|!important/);
  for (const id of IDS) {
    const slug = id.toLowerCase(), css = readFileSync(join(DIR, `${slug}.css`), 'utf8');
    assert.deepEqual(selectors(css), [`body[data-theme-world="${id}"]`]);
    for (const u of [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])) { assert.ok(u.includes(slug), `${id} nur eigene Dateien: ${u}`); assert.ok(existsSync(join('public', u)), u); }
    const used = [...strip(shared).matchAll(/var\(--(twb-[a-z0-9-]+)\)/g)].map((m) => m[1]), v = vars(css);
    for (const key of new Set(used)) assert.ok(v[key], `${id}: ${key}`);
  }
  // Bedeutungsfarben bleiben: Hex-Spielersteine und Vier-gewinnt-Steine werden nicht umgefärbt
  assert.doesNotMatch(shared, /\.hx-cell\.(red|blue)\s*{|\.vg-[01]\b/);
});

test('ART-W3: Kontraste – Figuren beider Seiten unterscheidbar, Kanten sichtbar, Text auf der Bühne lesbar', () => {
  for (const id of IDS) {
    const v = vars(readFileSync(join(DIR, `${id.toLowerCase()}.css`), 'utf8')), c = (k) => colors(v[k])[0];
    assert.ok(contrast(c('twb-chess-a'), c('twb-chess-b')) >= 3, `${id}: Weiß gegen Schwarz`);
    assert.ok(contrast(c('twb-chess-a'), c('twb-chess-a-edge')) >= 4.5, `${id}: Kante weiße Figur`);
    assert.ok(contrast(c('twb-chess-b'), c('twb-chess-b-edge')) >= 3, `${id}: Kante schwarze Figur`);
    assert.ok(contrast(c('twb-chess-a'), c('twb-orn-a')) >= 3, `${id}: Zier auf weißer Figur`);
    assert.ok(contrast(c('twb-chess-b'), c('twb-orn-b')) >= 3, `${id}: Zier auf schwarzer Figur`);
    assert.ok(contrast(c('twb-light'), c('twb-dark')) >= 3, `${id}: helle und dunkle Felder`);
    for (const s of colors(v['twb-stage'])) assert.ok(contrast(c('twb-ink'), s) >= 4.5, `${id}: Text auf der Bühne`);
    assert.ok(contrast(colors(v['twb-a'])[1], colors(v['twb-b'])[1]) >= 3, `${id}: Steine beider Seiten`);
    assert.ok(contrast(colors(v['twb-chk-a'])[0], colors(v['twb-chk-b'])[0]) >= 3, `${id}: Backgammon-Steine`);
    assert.ok(contrast(c('twb-die-pip'), c('twb-die-face')) >= 3, `${id}: Würfelaugen`);
    assert.ok(contrast(c('twb-cube-ink'), c('twb-cube-bg')) >= 4.5, `${id}: Verdopplungswürfel`);
    assert.ok(contrast(c('twb-hex-ink'), c('twb-hex-empty')) >= 4.5, `${id}: Hex-Beschriftung`);
  }
});

test('ART-W3: jede Schachfigur erhält je Welt eigene Zier; eigene SVG klein und ohne Skripte; in ART_LICENSES.md', () => {
  for (const w of [TW08, TW10, TW09_BOARD_FACET]) {
    assert.ok(w.art.chess.all, 'Sockelband');
    for (const k of ['k', 'q', 'n', 'b', 'r']) assert.ok(w.art.chess[k], k);
  }
  const want = ['board-worlds.css', ...IDS.flatMap((id) => { const s = id.toLowerCase(); return [`${s}.css`, `table-${s}.svg`, `light-${s}.svg`, `dark-${s}.svg`, `preview-${s}.svg`]; })].sort();
  assert.deepEqual(readdirSync(DIR).sort(), want);
  let total = 0;
  for (const f of readdirSync(DIR)) {
    const size = statSync(join(DIR, f)).size; total += size; assert.ok(size < 12 * 1024, `${f}: ${size}`);
    if (f.endsWith('.svg')) { const t = readFileSync(join(DIR, f), 'utf8'); assert.match(t, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.doesNotMatch(t, /<script|on[a-z]+=|href=|https?:\/\/(?!www\.w3\.org)/, f); }
  }
  assert.ok(total < 60 * 1024, `Brettwelten zusammen ${total} Bytes`);
  const lic = readFileSync('docs/design/ART_LICENSES.md', 'utf8');
  assert.ok(lic.includes('public/games/theme-worlds/board/') && lic.includes('build-board-worlds-art.mjs'));
  const shown = JSON.stringify([TW08, TW10].map((w) => [w.name, w.description])).toLowerCase();
  for (const bad of ['zeus', 'olymp', 'percy jackson', 'god of war', 'thor', 'marvel', 'vikings', 'excalibur', 'arthur', 'camelot', 'monty python']) assert.equal(shown.includes(bad), false, bad);
});
