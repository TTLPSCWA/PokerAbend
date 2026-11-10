// ART-T1 Kartenwelten: Daten, erzeugte Bilder/Variablen und die Host-Auswahl am Server.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { WORLDS, FONTS, CARD_WORLD_GAMES, worldsFor, worldOf, roles, hue } from '../public/games/card-worlds/worlds.js';
import { M } from '../scripts/card-worlds/motifs.mjs';

const ART = 'public/games/card-worlds';

test('Welten: je Spiel 10 eigene und 10 Winterwelten, eindeutige IDs, gültige Daten', () => {
  assert.equal(WORLDS.length, 40);
  assert.equal(new Set(WORLDS.map((w) => w.id)).size, 40);
  for (const game of CARD_WORLD_GAMES) {
    assert.equal(worldsFor(game).filter((w) => w.game === game).length, 10, game);
    assert.equal(worldsFor(game).filter((w) => w.game === 'all').length, 10, game);
  }
  assert.deepEqual(worldsFor('poker'), []);
  assert.equal(worldOf('farbenchaos', 'SB-01'), null, 'Welt eines anderen Spiels');
  assert.equal(worldOf('stapelrennen', 'X-07').id, 'X-07', 'Winter gilt überall');
  for (const w of WORLDS) {
    assert.equal(w.cols.length, 4, w.id);
    for (const [name, color, motif] of w.cols) { assert.ok(name, w.id); assert.match(color, /^#[0-9a-f]{6}$/i, w.id); assert.ok(M[motif], `${w.id}: Motiv ${motif}`); }
    assert.ok(M[w.back], `${w.id}: Rückseite ${w.back}`);
    assert.ok(FONTS[w.font], `${w.id}: Schrift ${w.font}`);
    assert.match(w.frame, /^(gilded|leather|steel|neon|voxel|parchment|holo|crystal|blueprint|storybook|cartoon|stone|frost)$/, w.id);
    // Keine Namen der Vorbilder in der Oberfläche
    assert.doesNotMatch(`${w.name} ${w.world}`, /Minecraft|Mario|Pokémon|Potter|Witcher|Portal|Zelda|Fortnite|Overwatch|Satisfactory|LEGO|Anno/i, w.id);
  }
});

test('Spielfarben bleiben erkennbar: Rot bleibt rötlich, Blau bläulich (UNO, Phase 10, Winter)', () => {
  const target = { r: 0, y: 50, g: 135, b: 215 };
  for (const w of WORLDS.filter((x) => x.game !== 'stapelrennen')) {
    const r = roles(w);
    assert.equal(new Set(Object.values(r)).size, 4, w.id);
    for (const [k, i] of Object.entries(r)) {
      const d = Math.abs(hue(w.cols[i][1]) - target[k]) % 360;
      assert.ok(Math.min(d, 360 - d) <= 45, `${w.id}: ${k} → ${w.cols[i][0]} ${w.cols[i][1]}`);
    }
  }
});

test('Erzeugte Bilder, Variablen und Schriften liegen vor (node scripts/build-card-worlds.mjs)', () => {
  const css = readFileSync(`${ART}/worlds.css`, 'utf8');
  for (const w of WORLDS) {
    for (const f of ['0', '1', '2', '3', 'w', 'back']) assert.ok(existsSync(`${ART}/art/${w.id}/${f}.svg`), `${w.id}/${f}.svg`);
    assert.ok(css.includes(`body[data-card-world="${w.id}"]{`), w.id);
  }
  for (const file of Object.values(FONTS)) {
    assert.ok(existsSync(`public/fonts/worlds/${file}.woff2`), file);
    assert.ok(existsSync(`public/fonts/worlds/${file}-OFL.txt`), `${file} Lizenz`);
  }
  // Bilder sind reine Grafik: keine Skripte, keine Verweise nach außen
  for (const w of WORLDS) {
    const svg = readFileSync(`${ART}/art/${w.id}/0.svg`, 'utf8');
    assert.doesNotMatch(svg, /<script|href=|https?:\/\/(?!www\.w3\.org)/, w.id);
  }
  const shared = readFileSync('public/games/card-worlds.css', 'utf8');
  assert.match(shared, /@import url\('\/games\/card-worlds\/template\.css'\)/);
  assert.match(shared, /@import url\('\/games\/card-worlds\/worlds\.css'\)/);
});

// ---------- Server: Auswahl, Rechte, Spielwechsel, Speichern ----------
let URL, server;
const dataDir = mkdtempSync(join(tmpdir(), 'card-worlds-'));
before(async () => {
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const {http}=await import('./server/index.js');
    const ready=()=>console.log('TEST_READY:'+http.address().port);
    if(http.listening)ready();else http.once('listening',ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: '', CREATE_LIMIT: '500' }, stdio: 'pipe' });
  let output = '';
  URL = await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(output)), 15000);
    server.stderr.on('data', (d) => { output += d; });
    server.stdout.on('data', (d) => { output += d; const m = output.match(/TEST_READY:(\d+)/); if (m) { clearTimeout(timer); res('http://localhost:' + m[1]); } });
  });
});
const clients = [];
after(() => { clients.forEach((c) => c.close()); server.kill(); });
function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.state = null; s.on('state', (st) => { s.state = st; });
  s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
  clients.push(s); return s;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await wait(25); } throw new Error('Zeitüberschreitung'); }

test('Server: nur der Host wählt, ungültige Welten werden abgelehnt, alle sehen die Welt', async () => {
  const host = client(), guest = client();
  const t = await host.ask('create', { game: 'farbenchaos', name: 'Tobi' });
  assert.ok(t.ok);
  assert.ok((await guest.ask('join', { code: t.code, name: 'Sebi' })).ok);
  await until(() => host.state && guest.state);
  assert.equal(host.state.cardWorld, null);
  assert.equal((await guest.ask('setCardWorld', { world: 'U-04' })).ok, false, 'kein Host');
  assert.equal((await host.ask('setCardWorld', { world: 'SB-01' })).ok, false, 'Skip-Bo-Welt in UNO');
  assert.equal((await host.ask('setCardWorld', { world: 'gibts-nicht' })).ok, false);
  assert.equal((await host.ask('setCardWorld', { world: 42 })).ok, false);
  assert.ok((await host.ask('setCardWorld', { world: 'U-04' })).ok);
  await until(() => guest.state?.cardWorld === 'U-04');
  // Gespeichert (rooms.json), damit ein Neustart die Welt behält
  await until(() => { try { return JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8')).find((r) => r.code === t.code)?.cardWorld === 'U-04'; } catch { return false; } });
  // Spielwechsel: UNO-Welt gilt in Skip-Bo nicht, Winterwelt bleibt
  assert.ok((await host.ask('switchGame', { game: 'stapelrennen' })).ok);
  await until(() => host.state?.game === 'stapelrennen');
  assert.equal(host.state.cardWorld, null);
  assert.ok((await host.ask('setCardWorld', { world: 'X-07' })).ok);
  assert.ok((await host.ask('switchGame', { game: 'zehnetappen' })).ok);
  await until(() => host.state?.game === 'zehnetappen');
  assert.equal(host.state.cardWorld, 'X-07');
  // Standard
  assert.ok((await host.ask('setCardWorld', { world: '' })).ok);
  await until(() => host.state?.cardWorld === null);
  // Andere Spiele kennen keine Welten
  assert.ok((await host.ask('switchGame', { game: 'maumau' })).ok);
  await until(() => host.state?.game === 'maumau');
  assert.equal((await host.ask('setCardWorld', { world: 'X-07' })).ok, false);
});
