// ART-W4 · Kartenwelten (Art „deck“) für die 16 klassischen Kartenspiele: Zuordnung laut Konzept, keine doppelten IDs,
// Facetten vorhandener Welten, getrennte Dateien je Ausprägung, Scoping des CSS, Kontraste, eigene Grafiken, Lizenzen, Geheimhaltung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { GAMES } from '../games/index.js';
import { POKER_GAMES, CLASSIC_GAMES, DECK_GAMES, DECK_WORLD_IDS, TW02, TW03, DECK_FACETS } from '../public/games/theme-worlds/deck-worlds.js';
import { DICE_GAMES } from '../public/games/theme-worlds/dice-worlds.js';
import { BOARD_GAMES } from '../public/games/theme-worlds/board-worlds.js';
import { CARD_WORLD_GAMES } from '../public/games/card-worlds/worlds.js';
import { themeRegistry, validateWorld } from '../public/games/theme-worlds/registry.js';

const DIR = 'public/games/theme-worlds/deck';
const SLUGS = ['tw-14', 'tw-03', 'tw-13', 'tw-01', 'tw-02', 'tw-09', 'tw-10'];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const vars = (css) => Object.fromEntries([...css.matchAll(/--(twk-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const colors = (v) => v.match(/#[0-9a-fA-F]{6}\b/g) || [];
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = (css) => strip(css).split('}').map((r) => r.split('{')[0].trim()).filter(Boolean);

test('ART-W4: 16 Kartenspiele, je vier Welten laut Konzept; UNO, Skip-Bo, Phase 10 unberührt', () => {
  assert.deepEqual(POKER_GAMES, ['poker', 'omaha', 'omaha-hi-lo', 'seven-card-stud', 'short-deck', 'five-card-draw', 'blackjack']);
  assert.deepEqual(CLASSIC_GAMES, ['skat', 'doppelkopf', 'schwimmen', 'maumau', 'durak', 'hearts', 'stichmeister', 'praesident', 'mogeln']);
  assert.equal(DECK_GAMES.length, 16);
  for (const g of DECK_GAMES) { assert.ok(GAMES[g], g); assert.equal(CARD_WORLD_GAMES.includes(g), false, `${g} ist kein ART-T-Spiel`); }
  const reg = themeRegistry();
  for (const g of POKER_GAMES) assert.deepEqual(reg.worldsForGame(g).map((w) => w.id).sort(), [...DECK_WORLD_IDS.poker].sort(), g);
  for (const g of CLASSIC_GAMES) assert.deepEqual(reg.worldsForGame(g).map((w) => w.id).sort(), [...DECK_WORLD_IDS.classic].sort(), g);
  for (const g of DECK_GAMES) for (const w of reg.worldsForGame(g)) { assert.equal(w.kind, 'deck'); assert.equal(reg.appliesTo(w, g, 'classic'), true); }
  // ART-T-Spiele sehen weiterhin nur ihre Kartenwelten
  for (const g of CARD_WORLD_GAMES) assert.ok(reg.worldsForGame(g).every((w) => w.kind === 'card'), g);
});

test('ART-W4: keine doppelten IDs; vorhandene Welten als Facette, jede Ausprägung lädt nur ihre Dateien', () => {
  const reg = themeRegistry(), ids = reg.list().map((w) => w.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const w of [TW02, TW03]) assert.deepEqual(validateWorld(w, { gameIds: Object.keys(GAMES) }), []);
  assert.deepEqual(Object.keys(DECK_FACETS).sort(), ['TW-01', 'TW-09', 'TW-10', 'TW-13', 'TW-14']);
  const kindIn = (g, id) => reg.worldForGame(g, id)?.kind ?? null;
  // Dieselbe ID in mehreren Spielgruppen: Hauptform und andere Facetten unverändert
  assert.equal(kindIn('monopoly', 'TW-01'), 'board'); assert.equal(kindIn('poker', 'TW-01'), 'deck');
  for (const id of ['TW-14', 'TW-13']) { assert.equal(kindIn('kniffel', id), 'dice'); assert.equal(kindIn('blackjack', id), 'deck'); }
  assert.equal(kindIn('kniffel', 'TW-09'), 'dice'); assert.equal(kindIn('schach', 'TW-09'), 'board'); assert.equal(kindIn('skat', 'TW-09'), 'deck'); assert.equal(kindIn('poker', 'TW-09'), null);
  assert.equal(kindIn('schach', 'TW-10'), 'board'); assert.equal(kindIn('hearts', 'TW-10'), 'deck'); assert.equal(kindIn('poker', 'TW-10'), null);
  assert.equal(kindIn('skat', 'TW-14'), 'deck'); assert.equal(kindIn('skat', 'TW-13'), null); assert.equal(kindIn('poker', 'TW-02'), null); assert.equal(kindIn('skat', 'TW-03'), null);
  const dir = (w) => [...new Set([...w.assets.css, ...w.assets.preload].map((u) => u.split('/')[3]))];
  for (const g of DECK_GAMES) for (const w of reg.worldsForGame(g)) assert.deepEqual(dir(w), ['deck'], `${g}/${w.id}`);
  for (const g of DICE_GAMES) for (const w of reg.worldsForGame(g)) assert.deepEqual(dir(w), ['dice'], `${g}/${w.id}`);
  for (const g of BOARD_GAMES) for (const w of reg.worldsForGame(g)) assert.deepEqual(dir(w), ['board'], `${g}/${w.id}`);
  // Alte Abfrage (nur Hauptform) unverändert: ART-W2/W3-Verträge
  assert.equal(reg.worldFor('poker', 'TW-14'), null); assert.equal(reg.worldFor('skat', 'TW-09'), null); assert.equal(reg.worldFor('skat', 'TW-02').id, 'TW-02');
});

test('ART-W4: Baustein wirkt nur unter Art „deck“ und nur in Spiel-Kit bzw. Poker-Tisch; Welt-Dateien nur Variablen; keine Animation', () => {
  const shared = readFileSync(join(DIR, 'deck-worlds.css'), 'utf8');
  for (const sel of selectors(shared)) for (const s of sel.split(/,(?![^(]*\))/)) assert.match(s.trim(), /^body\[data-theme-kind="deck"\] (#kg |#game(\[data-art-poker\]|:not\(\[data-art-poker\]\))? |\.xp-fly\.xp-mm-back$)/, s);
  assert.doesNotMatch(strip(shared), /animation|transition|@keyframes|!important|display\s*:|width\s*:|height\s*:|transform/);
  const used = new Set([...strip(shared).matchAll(/var\(--(twk-[a-z0-9-]+)\)/g)].map((m) => m[1]));
  for (const slug of SLUGS) {
    const id = slug.toUpperCase(), css = readFileSync(join(DIR, `${slug}.css`), 'utf8');
    assert.deepEqual(selectors(css), [`body[data-theme-world="${id}"]`]);
    for (const u of [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1])) { assert.ok(u.startsWith('/games/theme-worlds/deck/') && u.includes(slug), `${id}: ${u}`); assert.ok(existsSync(join('public', u)), u); }
    const v = vars(css); for (const key of used) assert.ok(v[key], `${id}: ${key}`);
  }
});

test('ART-W4: Kontraste – Werte und Farben auf jeder Kartenfront lesbar, Rot klar von Schwarz getrennt, Zugmarkierung sichtbar', () => {
  for (const slug of SLUGS) {
    const v = vars(readFileSync(join(DIR, `${slug}.css`), 'utf8')), c = (k) => colors(v[k])[0];
    assert.ok(contrast(c('twk-ink'), c('twk-face')) >= 7, `${slug}: Schwarz auf Karte ${contrast(c('twk-ink'), c('twk-face')).toFixed(2)}`);
    assert.ok(contrast(c('twk-red'), c('twk-face')) >= 4.5, `${slug}: Rot auf Karte ${contrast(c('twk-red'), c('twk-face')).toFixed(2)}`);
    const [r, g, b] = hex(c('twk-red')); assert.ok(r > g + 60 && r > b + 30, `${slug}: Rot bleibt rot`);
    assert.ok(contrast(c('twk-back-ink'), colors(v['twk-back'])[0]) >= 4.5, `${slug}: Zahl auf Rückseite`);
    assert.ok(contrast(c('twk-turn'), colors(v['twk-table'])[0]) >= 3, `${slug}: Zugmarkierung auf Tisch`);
  }
});

test('ART-W4: Geheimhaltung – Rückseiten tragen keine Kartendaten; Bildkarten-Kennung nur auf offenen Karten', () => {
  const kit = readFileSync('public/games/kit.js', 'utf8'), poker = readFileSync('public/games/poker/poker.js', 'utf8');
  assert.match(kit, /const backCard = \(label = ''\) => `<div class="kc kc-back" aria-hidden="true">\$\{label\}<\/div>`;/);
  assert.match(poker, /if \(!c \|\| c === '\?\?'\) return I18n\.html`<div class="card back \$\{extra\}" aria-label="verdeckte Karte"><\/div>`;/);
  assert.equal((kit.match(/faceAttr\(c\)/g) || []).length, 2, 'nur französische und deutsche offene Karte');
  const rx = /^const faceAttr = \(c\) => \('JQK'\.includes\(c\[0\]\) \? ' data-face' : ''\);$/m; assert.match(kit, rx);
  // Welten enthalten keine Spielmechanik und keine Kartendaten
  for (const w of [TW02, TW03, ...Object.values(DECK_FACETS)]) assert.doesNotMatch(JSON.stringify(w), /"(deck|cards|rules?|seed|random|score)"\s*:/);
});

test('ART-W4: eigene SVG klein und ohne Skripte; Herkunft in ART_LICENSES.md; keine fremden Marken in Namen', () => {
  const want = ['deck-worlds.css', ...SLUGS.flatMap((s) => [`${s}.css`, ...['table', 'back', 'frame', 'emblem', 'preview'].map((k) => `${k}-${s}.svg`)])].sort();
  assert.deepEqual(readdirSync(DIR).sort(), want);
  let total = 0;
  for (const f of readdirSync(DIR)) {
    const size = statSync(join(DIR, f)).size; total += size; assert.ok(size < 8 * 1024, `${f}: ${size}`);
    if (f.endsWith('.svg')) { const t = readFileSync(join(DIR, f), 'utf8'); assert.match(t, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.doesNotMatch(t, /<script|on[a-z]+=|href=|https?:\/\/(?!www\.w3\.org)/, f); }
  }
  assert.ok(total < 60 * 1024, `Kartenwelten zusammen ${total} Bytes`);
  const lic = readFileSync('docs/design/ART_LICENSES.md', 'utf8');
  assert.ok(lic.includes('public/games/theme-worlds/deck/') && lic.includes('build-deck-worlds-art.mjs'));
  const shown = JSON.stringify([TW02, TW03].map((w) => [w.name, w.description])).toLowerCase();
  for (const bad of ['sherlock', 'holmes', 'watson', 'nautilus', 'nemo', 'bioshock', 'pac-man', 'cthulhu', 'lovecraft', 'red dead', 'tron']) assert.equal(shown.includes(bad), false, bad);
});
