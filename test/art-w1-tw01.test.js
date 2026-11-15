// ART-W1 · TW-01 „Schatten über Neuengland“ (Monopoly): Daten, Darstellungstexte, Namensrangfolge, unveränderte Regeln, eigene Grafiken.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BOARD, EVENTS, CHEST, PROPERTIES } from '../public/games/monopoly/data.js';
import { TOKENS } from '../public/games/monopoly/tokens.js';
import { TW01, TW01_FIELDS, TW01_CARDS, TW01_TOKENS } from '../public/games/theme-worlds/tw-01.js';
import { themeRegistry, validateWorld } from '../public/games/theme-worlds/registry.js';
import { Room } from '../games/monopoly/room.js';
import { GAMES } from '../games/index.js';
import { configureBoards, boardStore } from '../games/monopoly/boards.js';
import { botMove } from '../games/monopoly/bot.js';

const DIR = 'public/games/theme-worlds/tw-01';
function table(world = 'TW-01', settings = {}, n = 2) {
  const r = new Room('TW01', settings, () => {}); r.cardWorld = world;
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer('S' + i, null); r.sit(p.id); return p.id; }); r.start(ids[0]); return { r, ids };
}

test('TW-01: gültige Welt nur für Monopoly Standard und Tempowürfel, nie Junior; in der Registry freigegeben', () => {
  assert.deepEqual(validateWorld(TW01, { gameIds: Object.keys(GAMES) }), []);
  const reg = themeRegistry(), w = reg.worldFor('monopoly', 'TW-01');
  assert.ok(w); assert.equal(w.kind, 'board'); assert.equal(w.released, true); assert.equal(w.name.de, 'Schatten über Neuengland');
  assert.equal(reg.appliesTo(w, 'monopoly', 'classic'), true); assert.equal(reg.appliesTo(w, 'monopoly', 'speed'), true); assert.equal(reg.appliesTo(w, 'monopoly', 'junior'), false);
  for (const g of ['monopoly-deal', 'farbenchaos', 'staedtehandel']) assert.equal(reg.worldFor(g, 'TW-01'), null, g);
});

test('TW-01: Darstellungstexte vollständig – 40 Feldnamen, 16 + 16 Kartentexte, 8 Figurennamen; keine geschützten Namen', () => {
  assert.deepEqual(Object.keys(TW01_FIELDS).map(Number), BOARD.map((f) => f.index));
  for (const n of Object.values(TW01_FIELDS)) assert.ok(n.length >= 3 && n.length <= 40, n);
  const props = PROPERTIES.map((i) => TW01_FIELDS[i]); assert.equal(new Set(props).size, 28, 'Grundstücke eindeutig benannt');
  assert.equal(TW01_CARDS.event.length, EVENTS.length); assert.equal(TW01_CARDS.chest.length, CHEST.length);
  assert.deepEqual(Object.keys(TW01_TOKENS).sort(), Object.keys(TOKENS).sort());
  const all = JSON.stringify([TW01.name, TW01.description, TW01.texts]).toLowerCase(); // nur sichtbare Texte (die Spiel-ID games: monopoly ist kein Anzeigetext)
  for (const bad of ['cthulhu', 'arkham', 'innsmouth', 'miskatonic', 'dunwich', 'lovecraft', 'necronomicon', 'elder sign', 'chaosium', 'monopoly', 'hasbro']) assert.equal(all.includes(bad), false, bad);
});

test('TW-01: jeder Kartentext beschreibt dieselbe Wirkung wie die Standardkarte (Beträge, Ziele, Gefängnis, Freikarte)', () => {
  for (const [deck, list] of [['event', EVENTS], ['chest', CHEST]]) list.forEach((c, i) => {
    const text = TW01_CARDS[deck][i], at = `${deck}[${i}]`;
    if (c.kind === 'bank' || c.kind === 'each') assert.ok(text.includes(String(Math.abs(c.amount))), `${at}: Betrag ${Math.abs(c.amount)}`);
    if (c.kind === 'each') assert.match(text, c.amount > 0 ? /geben dir/ : /Zahle jedem/, at);
    if (c.kind === 'bank') assert.match(text, c.amount > 0 ? /(von der Bank|für dich|für deine Kasse|erhältst|zahlt dir|Preis|finden sich|hinterlässt|Erbe)/ : /(Zahle|bezahlen|an die Bank)/, at);
    if (c.kind === 'repairs') { assert.ok(text.includes(String(c.house)) && text.includes(String(c.hotel)), at); assert.match(text, /je Haus/); }
    if (c.kind === 'move') assert.ok(text.includes(`{field:${c.field}}`), `${at}: Ziel Feld ${c.field}`);
    if (c.kind === 'back') assert.match(text, /drei Felder zurück/, at);
    if (c.kind === 'jail') assert.match(text, /Zollturm/, at);
    if (c.kind === 'free') assert.match(text, /Behalte diese Karte/, at);
    if (c.kind === 'rail') assert.match(text, /nächsten Verbindung/, at);
    if (c.kind === 'utility') assert.match(text, /nächsten Werk/, at);
  });
});

test('TW-01 am Tisch: Brett, Protokoll, Karten und Figurennamen in der Welt; Wirkung der Karte unverändert', () => {
  const { r, ids: [a] } = table();
  assert.deepEqual(r.fieldNames(), BOARD.map((f) => TW01_FIELDS[f.index])); assert.deepEqual(r.view(a).g.names, r.fieldNames());
  r.people[a].position = 2; r.walk(a, 1); assert.ok(r.log.some((l) => l.text.endsWith('landet auf Netzmacherweg')));
  r.people[a].position = 3; r.walk(a, 1); assert.ok(r.log.some((l) => l.text.includes('· Hafengebühr')));
  // Karte „Ziehe vor auf Los“ mit Weltnamen, Wirkung wie Standard
  r.decks.event = [0, ...r.decks.event.filter((n) => n !== 0)]; const before = r.people[a].money; r.people[a].position = 7; r.drawCard(a, 'event');
  assert.equal(r.card.text, 'Ein Telegramm ruft dich zurück zum Hafen: ziehe vor auf Los · Alter Kai und kassiere den Startbonus.');
  assert.equal(r.people[a].position, 0); assert.equal(r.people[a].money, before + 200);
  r.decks.chest = [1, ...r.decks.chest.filter((n) => n !== 1)]; const m = r.people[a].money; r.drawCard(a, 'chest'); assert.equal(r.people[a].money, m + 200);
  r.dispose();
  // Figurenname beim Wählen
  const lobby = new Room('TOK', {}, () => {}); lobby.cardWorld = 'TW-01'; const p = lobby.addPlayer('Anna', null); lobby.chooseToken(p.id, 'cat');
  assert.equal(lobby.acts[p.id].text, 'wählt Schwarze Katze'); lobby.dispose();
});

test('TW-01: Standard („Standard“-Auswahl) stellt alle Standardnamen wieder her; eigene Bretter behalten ihre 28 Namen', () => {
  const { r } = table(); assert.equal(r.fieldName(1), 'Fischergasse');
  r.cardWorld = null; assert.deepEqual(r.fieldNames(), BOARD.map((f) => f.name)); r.dispose();
  const dir = mkdtempSync(join(tmpdir(), 'tw01-')); configureBoards(dir);
  try {
    const own = boardStore().save({ title: 'Unser Abend', names: PROPERTIES.map((i) => 'Eigen ' + i) });
    const r2 = new Room('OWN', { board: own.id }, () => {}); r2.cardWorld = 'TW-01'; r2.validateStart();
    for (const f of BOARD) assert.equal(r2.fieldName(f.index), PROPERTIES.includes(f.index) ? 'Eigen ' + f.index : TW01_FIELDS[f.index]);
    assert.deepEqual(boardStore().get(own.id).names, PROPERTIES.map((i) => 'Eigen ' + i), 'gespeichertes Brett unverändert'); r2.dispose();
  } finally { configureBoards(null); }
});

test('TW-01 ändert keine Regeln: Bot-Partien mit Welt enden regulär, Geld und Gebäude bleiben erhalten', () => {
  for (let k = 0; k < 20; k++) {
    const { r } = table('TW-01', { quick: k % 2 === 0 }, 2 + (k % 5)); let steps = 0;
    while (r.phase === 'playing' && steps++ < 40000) botMove(r, r.botDue() || r.currentId);
    assert.equal(r.phase, 'over', `Partie ${k}`);
    assert.equal(r.bank + r.pot + Object.values(r.people).reduce((s, p) => s + p.money, 0), 10000000);
    assert.ok(Object.values(r.people).every((p) => p.money >= 0)); r.dispose();
  }
  assert.deepEqual(BOARD.filter((f) => f.price).map((f) => f.price).slice(0, 3), [60, 60, 200]); // Preise unverändert (Stichprobe)
});

test('TW-01: eigene Grafiken vollständig, klein, ohne Skripte oder fremde Verweise; jede Datei mit Herkunft in ART_LICENSES.md', () => {
  const files = readdirSync(DIR).sort();
  const want = ['card-back.svg', 'center.svg', 'house.svg', 'lighthouse.svg', 'preview.svg', 'table.svg', 'tw-01.css', ...Object.keys(TOKENS).map((t) => `token-${t}.svg`)].sort();
  assert.deepEqual(files, want);
  let total = 0;
  for (const f of files) {
    const text = readFileSync(join(DIR, f), 'utf8'); total += statSync(join(DIR, f)).size;
    if (f.endsWith('.svg')) { assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.doesNotMatch(text, /<script|on[a-z]+=|href=|https?:\/\/(?!www\.w3\.org)/, f); }
  }
  assert.ok(total < 60 * 1024, `TW-01 zusammen ${total} Bytes`);
  const css = readFileSync(join(DIR, 'tw-01.css'), 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.trim()).filter((r) => r && !r.startsWith('@keyframes') && !/^(from|to|\d+%)/.test(r) && !r.startsWith('@media'));
  for (const r of rules) { const sel = r.split('{')[0].trim(); if (!sel || /^(from|to|\d)/.test(sel)) continue; for (const s of sel.split(',')) assert.match(s.trim(), /^body\[data-theme-world="TW-01"\]/, `Regel ohne Weltbezug: ${s}`); }
  for (const u of css.match(/url\('([^']+)'\)/g) || []) assert.match(u, /\/games\/theme-worlds\/tw-01\/[a-z0-9-]+\.svg/);
  const lic = readFileSync('docs/design/ART_LICENSES.md', 'utf8'); assert.ok(lic.includes('public/games/theme-worlds/tw-01/') && lic.includes('build-tw01-art.mjs'));
});
