// ART-W0: zentrale Themenwelten-Registry und serverseitige Weltauswahl. Die Kartenwelten (ART-T) bleiben in Daten und Verhalten gleich.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { GAMES } from '../games/index.js';
import { WORLDS, CARD_WORLD_GAMES, worldOf, worldsFor } from '../public/games/card-worlds/worlds.js';
import { createRegistry, validateWorld, themeRegistry, BUILTIN, KINDS, EFFECTS } from '../public/games/theme-worlds/registry.js';

const gameIds = Object.keys(GAMES);
const generic = (over = {}) => ({ id: 'TW-TEST', kind: 'board', name: { de: 'Testwelt', en: 'Test world' }, description: { de: 'Nur für Tests', en: 'Tests only' }, games: ['viergewinnt'], variants: null,
  assets: { preview: null, css: [], preload: [] }, palette: { colors: ['#112233'] }, fonts: [], effects: [], fallback: 'standard', released: true, source: 'ART-W0', ...over });
const errs = (w, o) => validateWorld(w, o);
const has = (list, p) => assert.ok(list.some((e) => p.test(e)), `erwartet ${p}, bekommen ${list.join(' | ') || 'keine'}`);

test('Registry: die 40 Kartenwelten sind unverändert eingebunden und gelten genau wie bisher', () => {
  const reg = themeRegistry();
  const cards = reg.list().filter((w) => w.kind === 'card');
  assert.equal(cards.length, 40); assert.deepEqual(cards.map((w) => w.id), WORLDS.map((w) => w.id));
  assert.ok(cards.every((w) => w.released && w.fallback === 'standard'));
  // ART-W1: einzige weitere Welt ist TW-01 (Monopoly)
  assert.deepEqual(reg.list().filter((w) => w.kind !== 'card').map((w) => [w.id, w.kind, w.games.join()]), [['TW-01', 'board', 'monopoly']]);
  // Für jedes Spiel und jede ID dieselbe Entscheidung wie die bisherige Server-Prüfung worldOf()
  for (const game of gameIds) for (const id of [...WORLDS.map((w) => w.id), 'gibts-nicht', '', null, 42]) assert.equal(reg.worldFor(game, id)?.id ?? null, worldOf(game, id)?.id ?? null, `${game}/${id}`);
  for (const game of CARD_WORLD_GAMES) assert.deepEqual(reg.worldsFor(game).map((w) => w.id).sort(), worldsFor(game).map((w) => w.id).sort());
  assert.equal(reg.worldsFor('maumau').length, 0); assert.deepEqual(reg.worldsFor('monopoly').map((w) => w.id), ['TW-01']);
  // Winterwelten: Schnee und Musik als Effekte, eigene Welten ohne Effekte
  for (const w of cards) assert.deepEqual(w.effects.map((e) => e.type), WORLDS.find((x) => x.id === w.id).game === 'all' ? ['snow', 'music'] : []);
  assert.equal(reg.worldFor('farbenchaos', 'U-01').card.frame, WORLDS[0].frame);
});

test('Registry: Varianten – UNO-Varianten mit eigener Gestaltung behalten ihr Aussehen, Skip-Bo und Phase 10 alle Varianten', () => {
  const reg = themeRegistry(), uno = reg.worldFor('farbenchaos', 'U-01'), winter = reg.worldFor('stapelrennen', 'X-01');
  assert.equal(reg.appliesTo(uno, 'farbenchaos', 'classic'), true); assert.equal(reg.appliesTo(uno, 'farbenchaos', undefined), true);
  for (const v of ['flip', 'nomercy', 'allwild', 'spuk']) assert.equal(reg.appliesTo(uno, 'farbenchaos', v), false, v);
  assert.equal(reg.appliesTo(winter, 'stapelrennen', 'team'), true); assert.equal(reg.appliesTo(winter, 'farbenchaos', 'flip'), false); assert.equal(reg.appliesTo(winter, 'maumau', 'classic'), false); assert.equal(reg.appliesTo(null, 'farbenchaos'), false);
});

test('Registry: jede Welt nennt nur vorhandene Spiele; der Server bricht sonst ab, Spiel-IDs bleiben unverändert', () => {
  assert.equal(themeRegistry().assertGames(gameIds), true);
  assert.throws(() => createRegistry([generic({ games: ['gibts-nicht'] })]).assertGames(gameIds), /unbekannte Spiele: TW-TEST: gibts-nicht/);
  assert.throws(() => createRegistry([generic({ games: ['gibts-nicht'] })], { gameIds }), /Spiel gibts-nicht gibt es nicht/);
  for (const w of BUILTIN) for (const g of w.games) assert.ok(gameIds.includes(g), g);
  assert.ok(gameIds.includes('farbenchaos') && gameIds.includes('stapelrennen') && gameIds.includes('zehnetappen'));
});

test('Datenvalidierung: Art, Namen, Spiele, Varianten, Assets, Farben, Schriften, Effekte, Fallback, Freigabe', () => {
  assert.deepEqual(errs(generic(), { gameIds }), []);
  assert.deepEqual(BUILTIN.flatMap((w) => errs(w, { gameIds })), []);
  has(errs(null), /kein Objekt/); has(errs(generic({ id: '1-x' })), /ID ungültig/); has(errs(generic({ id: 'x'.repeat(30) })), /ID ungültig/);
  has(errs(generic({ kind: 'film' })), /Art film unbekannt/); has(errs(generic({ name: { de: 'Nur deutsch' } })), /name braucht de und en/); has(errs(generic({ description: { de: '<b>x</b>', en: 'x' } })), /description/);
  has(errs(generic({ games: [] })), /games braucht/); has(errs(generic({ games: ['viergewinnt', 'viergewinnt'] })), /games braucht/); has(errs(generic({ games: ['Vier Gewinnt'] })), /games braucht/);
  has(errs(generic({ variants: { maumau: ['classic'] } })), /variants nennt maumau/); has(errs(generic({ variants: { viergewinnt: [] } })), /variants.viergewinnt/);
  for (const bad of ['../x.svg', 'http://x/a.svg', '/a.js', '/a b.svg', '//evil.example/a.svg']) has(errs(generic({ assets: { preview: null, css: [], preload: [bad] } })), /assets.preload/);
  has(errs(generic({ assets: { preview: null, css: ['/a.svg'], preload: [] } })), /assets.css nimmt nur .css/); has(errs(generic({ assets: { preview: null, css: [], preload: [], script: [] } })), /unbekannter Schlüssel "script"/); has(errs(generic({ assets: undefined })), /assets fehlt/);
  has(errs(generic({ palette: { colors: ['rot'] } })), /palette.colors/); has(errs(generic({ palette: { colors: ['#112233'], glow: '#ffffff' } })), /palette.glow/);
  has(errs(generic({ fonts: [{ family: 'X', url: '/fonts/x.ttf' }] })), /fonts braucht/);
  has(errs(generic({ effects: [{ type: 'feuerwerk' }] })), /Effekt unbekannt: feuerwerk/); has(errs(generic({ effects: [{ type: 'snow' }, { type: 'snow' }] })), /Effekt doppelt/); has(errs(generic({ effects: [{ type: 'snow', loop: true }] })), /unbekannter Schlüssel "loop"/);
  has(errs(generic({ fallback: 'none' })), /fallback muss "standard"/); has(errs(generic({ released: 'ja' })), /released/); has(errs(generic({ source: '' })), /source/);
  has(errs(generic({ kind: 'card' })), /card.frame fehlt/); has(errs(generic({ card: { frame: 'x' } })), /card nur für Kartenwelten/);
  // Spielmechanik gehört nie in eine Welt
  for (const key of ['rules', 'turnTime', 'bots', 'deck', 'seed', 'score']) has(errs(generic({ [key]: 1 })), new RegExp(`"${key}" ist Spielmechanik`));
  has(errs(generic({ extra: 1 })), /unbekannter Schlüssel "extra"/);
  assert.throws(() => createRegistry([generic(), generic()]), /doppelte Welt-ID/); assert.throws(() => createRegistry([generic({ kind: 'film' })]), /Themenwelten ungültig/);
  assert.deepEqual(KINDS, ['card', 'board', 'dice', 'party', 'generic']); assert.deepEqual(EFFECTS, ['snow', 'music']);
});

test('Auswahl: kompatible Welt wird gefunden, inkompatible, unbekannte und nicht freigegebene ergeben den Standard (null)', () => {
  const reg = createRegistry([...BUILTIN, generic(), generic({ id: 'TW-ENTWURF', released: false, games: ['viergewinnt', 'muehle'] })], { gameIds });
  assert.equal(reg.worldFor('viergewinnt', 'TW-TEST').id, 'TW-TEST'); assert.equal(reg.worldFor('muehle', 'TW-TEST'), null, 'anderes Spiel');
  assert.equal(reg.worldFor('viergewinnt', 'TW-ENTWURF'), null, 'Entwurf'); assert.deepEqual(reg.worldsFor('viergewinnt').map((w) => w.id), ['TW-TEST']);
  assert.equal(reg.worldFor('viergewinnt', 'U-01'), null); assert.equal(reg.worldFor('farbenchaos', 'TW-TEST'), null); assert.equal(reg.worldFor('viergewinnt', { id: 'TW-TEST' }), null);
  assert.ok(Object.isFrozen(reg.worldFor('viergewinnt', 'TW-TEST')), 'Welten sind unveränderlich');
});

// ---------- Server: Rechte, Räume, späte Spieler, Wiederverbindung, Neustart ----------
let URL, server;
const dataDir = mkdtempSync(join(tmpdir(), 'theme-worlds-'));
const clients = [];
async function startServer() {
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
}
const stopServer = () => new Promise((res) => { server.once('exit', res); server.kill(); });
before(startServer);
after(() => { clients.forEach((c) => c.close()); server.kill(); });
function client() {
  const s = io(URL, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.state = null; s.states = 0; s.on('state', (st) => { s.state = st; s.states++; });
  s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
  clients.push(s); return s;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await wait(25); } throw new Error('Zeitüberschreitung'); }

test('Server: zwei Räume gleichzeitig – Raum A beeinflusst Raum B nicht; nur der Host wählt; Gäste und Späte sehen die Welt', async () => {
  const hostA = client(), guestA = client(), hostB = client(), guestB = client();
  const a = await hostA.ask('create', { game: 'farbenchaos', name: 'Anna' }), b = await hostB.ask('create', { game: 'farbenchaos', name: 'Ben' });
  assert.ok(a.ok && b.ok); assert.notEqual(a.code, b.code);
  assert.ok((await guestA.ask('join', { code: a.code, name: 'Gina' })).ok); assert.ok((await guestB.ask('join', { code: b.code, name: 'Gerd' })).ok);
  await until(() => hostA.state && guestA.state && hostB.state && guestB.state);
  assert.ok((await hostA.ask('setCardWorld', { world: 'X-01' })).ok);
  assert.ok((await hostB.ask('setCardWorld', { world: 'U-04' })).ok);
  await until(() => guestA.state.cardWorld === 'X-01' && guestB.state.cardWorld === 'U-04');
  // Gast darf nicht wählen – weder im eigenen noch (über den eigenen Raum) im fremden Raum
  const before_ = guestA.state.cardWorld;
  assert.equal((await guestA.ask('setCardWorld', { world: 'U-01' })).ok, false); assert.equal((await guestA.ask('setCardWorld', { world: '' })).ok, false);
  await wait(150); assert.equal(guestA.state.cardWorld, before_); assert.equal(hostB.state.cardWorld, 'U-04');
  // Wechsel in A ändert B nicht
  const statesB = guestB.states;
  assert.ok((await hostA.ask('setCardWorld', { world: 'X-02' })).ok); await until(() => guestA.state.cardWorld === 'X-02');
  await wait(150); assert.equal(guestB.state.cardWorld, 'U-04'); assert.equal(guestB.states, statesB, 'Raum B bekommt keinen Stand aus Raum A');
  // Spät beitretende Spielerin bekommt sofort den aktuellen Zustand
  const late = client(); assert.ok((await late.ask('join', { code: a.code, name: 'Lena' })).ok); await until(() => late.state); assert.equal(late.state.cardWorld, 'X-02');
  // Inkompatibel (Skip-Bo-Welt in UNO), unbekannt, falscher Typ: abgelehnt, Welt bleibt
  for (const world of ['SB-01', 'gibts-nicht', 42, { id: 'X-01' }, 'x'.repeat(500)]) assert.equal((await hostA.ask('setCardWorld', { world })).ok, false, JSON.stringify(world).slice(0, 20));
  await wait(100); assert.equal(hostA.state.cardWorld, 'X-02');
  // Protokoll nennt die Kartenwelt wie bisher
  assert.ok(hostA.state.log.some((l) => /Kartenwelt: /.test(l.text)));
});

test('Server: Wiederverbindung mit Token und Neustart stellen die Welt her; unbekannte gespeicherte Welt fällt auf Standard', async () => {
  const host = client(), other = client();
  const a = await host.ask('create', { game: 'stapelrennen', name: 'Rita' }), b = await other.ask('create', { game: 'zehnetappen', name: 'Udo' });
  await until(() => host.state && other.state);
  assert.ok((await host.ask('setCardWorld', { world: 'X-05' })).ok); assert.ok((await other.ask('setCardWorld', { world: 'P-03' })).ok);
  await until(() => host.state.cardWorld === 'X-05' && other.state.cardWorld === 'P-03');
  // Verbindungsabbruch und Wiederverbindung mit demselben Token
  host.disconnect(); const again = client();
  assert.ok((await again.ask('join', { code: a.code, token: a.token })).ok); await until(() => again.state); assert.equal(again.state.cardWorld, 'X-05');
  // Neustart: gespeicherte Welten bleiben; eine unbekannte ID (z. B. nach Entfernen einer Welt) ergibt Standard
  await until(() => { try { const list = JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8')); return list.find((r) => r.code === a.code)?.cardWorld === 'X-05' && list.find((r) => r.code === b.code)?.cardWorld === 'P-03'; } catch { return false; } });
  clients.forEach((c) => c.close()); clients.length = 0;
  await stopServer();
  const file = join(dataDir, 'rooms.json'), list = JSON.parse(readFileSync(file, 'utf8'));
  list.find((r) => r.code === b.code).cardWorld = 'TW-ENTFERNT';
  writeFileSync(file, JSON.stringify(list));
  await startServer();
  const r1 = client(), r2 = client();
  assert.ok((await r1.ask('join', { code: a.code, token: a.token })).ok); assert.ok((await r2.ask('join', { code: b.code, token: b.token })).ok);
  await until(() => r1.state && r2.state);
  assert.equal(r1.state.cardWorld, 'X-05'); assert.equal(r2.state.cardWorld, null);
});

test('Roadmap: ART-W0 steht als Themenwelt-Paket in der Grafik-Roadmap, die Kartenwelt-Pakete bleiben unverändert', () => {
  const roadmap = JSON.parse(readFileSync('docs/design/game-art-roadmap.json', 'utf8'));
  const w0 = roadmap.theme_packages.find((p) => p.id === 'ART-W0');
  assert.ok(w0); assert.deepEqual(w0.games, ['farbenchaos', 'stapelrennen', 'zehnetappen']); assert.ok(['in_progress', 'done'].includes(w0.status));
  assert.deepEqual(roadmap.world_packages.map((p) => p.id), ['ART-T1', 'ART-T2a', 'ART-T2b', 'ART-T2c', 'ART-T3', 'ART-T4', 'ART-T5', 'ART-T6']);
  assert.ok(roadmap.world_packages.every((p) => p.status === 'done'));
  // Paketstruktur nach dem Konzept (THEME_WORLDS.md): W0 umgesetzt, W1 teilweise (Monopoly ja, Monopoly Deal offen), W2–W4 geplant; alle Spiel-IDs existieren
  assert.deepEqual(roadmap.theme_packages.map((p) => [p.id, p.status]), [['ART-W0', 'done'], ['ART-W1', 'partial'], ['ART-W2', 'planned'], ['ART-W3', 'planned'], ['ART-W4', 'planned']]);
  for (const p of roadmap.theme_packages) for (const g of p.games) assert.ok(gameIds.includes(g), p.id + ': ' + g);
  assert.ok(roadmap.theme_packages.find((p) => p.id === 'ART-W1').implementation_commit);
});
