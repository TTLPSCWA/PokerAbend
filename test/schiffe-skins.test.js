// ART-013: Schiffe versenken hat genau ein Spiel (`schiffe`) und wählbare Designs (Skins). Der Skin ändert nur das Aussehen:
// Er ist eine Raumeinstellung des Hosts, getrennt von der Spielvariante (classic/salvo), serverseitig geprüft und für alle am Tisch gleich.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { io } from 'socket.io-client';
import { GAMES, gameList } from '../games/index.js';
import { VARIANTS } from '../games/variants.js';
import { Room, SalvoRoom, randomFleet } from '../games/schiffe/room.js';
import { SKINS, DEFAULT_SKIN, skinIds, safeSkin } from '../games/schiffe/skins.js';

const game = GAMES.schiffe;
const H = (cell) => ({ cell, horizontal: true });
const FLEET_A = [H(0), H(20), H(40), H(60), H(80)], FLEET_B = [H(5), H(25), H(45), H(65), H(85)];

function setup(settings = {}, Type = Room) {
  const r = new Type('SK', { turnTime: 0, ...settings }, () => {});
  if (Type === SalvoRoom) r.variant = 'salvo';
  const ids = ['Anna', 'Ben', 'Zoe'].map((n) => r.addPlayer(n, null).id);
  r.sit(ids[0]); r.sit(ids[1]);
  r.start(ids[0]);
  return { r, a: ids[0], b: ids[1], z: ids[2] };
}

test('Skins: Standard ist das klassische Design, IDs sind stabil und unbekannte Werte fallen auf den Standard zurück', () => {
  assert.equal(DEFAULT_SKIN, 'naval');
  assert.ok(skinIds().includes('naval'));
  assert.equal(new Set(skinIds()).size, skinIds().length, 'keine doppelten IDs');
  for (const s of SKINS) assert.ok(s.name && s.description && s.preview, `${s.id}: Name, Beschreibung und Vorschau`);
  for (const bad of ['', 'unbekannt', 'NAVAL', ' naval', '__proto__', 'constructor', null, undefined, 7, {}, [], ['naval'], true]) assert.equal(safeSkin(bad), 'naval', String(JSON.stringify(bad)));
  for (const id of skinIds()) assert.equal(safeSkin(id), id);
});

test('Raum: skin ist Einstellung mit Standard naval; ungültige oder manipulierte Werte werden ignoriert', () => {
  assert.equal(new Room('A', {}, () => {}).settings.skin, 'naval');
  for (const bad of ['unbekannt', '', null, 5, {}, ['naval'], '<script>alert(1)</script>', '__proto__', 'NAVAL']) {
    assert.equal(new Room('B', { skin: bad }, () => {}).settings.skin, 'naval', JSON.stringify(bad));
  }
  for (const id of skinIds()) assert.equal(new Room('C', { skin: id }, () => {}).settings.skin, id);
  assert.equal(new Room('E', { skin: 'naval' }, () => {}).settings.skin, 'naval');
  assert.equal(Object.prototype.hasOwnProperty.call(new Room('D', {}, () => {}).settings, 'polluted'), false);
});

test('Skin und Spielvariante sind getrennt: classic und salvo laufen mit jedem Skin', () => {
  assert.deepEqual(VARIANTS.schiffe.map((v) => v.id), ['classic', 'salvo']);
  assert.ok(!skinIds().some((id) => ['classic', 'salvo'].includes(id)), 'Skin-IDs sind keine Variantennamen');
  for (const skin of skinIds()) for (const variant of ['classic', 'salvo']) {
    const r = game.create('KOMBI', { variant, skin }, () => {});
    assert.equal(r.variant, variant); assert.equal(r.settings.skin, skin, `${variant}/${skin}`);
    if (skinIds().length > 1) assert.ok(r.constructor.OPTIONS.some((o) => o.key === 'skin'), 'Skin-Option in beiden Räumen');
    else assert.ok(!r.constructor.OPTIONS.some((o) => o.key === 'skin'), 'mit nur einem Design gibt es keine Auswahl');
    r.dispose();
  }
  const info = gameList().find((g) => g.id === 'schiffe');
  assert.equal(info.variants.length, 2, 'keine zusätzliche Variante für Skins');
  for (const v of info.variants) assert.equal(v.defaults.skin, 'naval', `${v.id}: Standardwert`);
  assert.deepEqual(info.createChoices.map((c) => c.key), ['skin']);
  assert.deepEqual(info.createChoices[0].choices.map((c) => c.value), skinIds());
  assert.equal(info.createChoices[0].value, 'naval');
});

test('Genau ein Spiel: keine zweite Registrierung, keine zweite Kachel', () => {
  const ids = Object.keys(GAMES).filter((id) => /schiff|ship|space/.test(id));
  assert.deepEqual(ids, ['schiffe']);
  assert.equal(gameList().filter((g) => /schiff|ship|space/.test(g.id)).length, 1);
  assert.equal(game.name, 'Schiffe versenken');
});

test('Host ändert den Skin nur zwischen den Runden, Gäste nie, ungültige Werte bleiben wirkungslos', () => {
  const r = new Room('SET', { turnTime: 0 }, () => {});
  const host = r.addPlayer('Anna', null).id, guest = r.addPlayer('Ben', null).id;
  for (const id of skinIds()) { r.updateSettings(host, { skin: id }); assert.equal(r.settings.skin, id); }
  r.updateSettings(host, { skin: 'gibts-nicht' }); assert.equal(r.settings.skin, skinIds().at(-1), 'ungültig: alter Wert bleibt');
  assert.throws(() => r.updateSettings(guest, { skin: 'naval' }), /Host/);
  r.sit(host); r.sit(guest); r.start(host);
  assert.throws(() => r.updateSettings(host, { skin: 'naval' }), /zwischen den Runden/);
});

test('Spiellogik und Ansicht hängen nicht vom Skin ab (gleiche Aufstellung, gleiche Schüsse, gleiche Ergebnisse)', () => {
  const run = (skin, Type) => {
    const { r, a, b, z } = setup({ skin }, Type);
    r.place(a, FLEET_A); r.place(b, FLEET_B);
    const log = [];
    if (Type === SalvoRoom) {
      r.salvo(a, [5, 6, 7, 8, 9]); r.salvo(b, [0, 1, 2, 3, 4]);
    } else {
      r.shoot(a, 5); r.shoot(b, 99); r.shoot(a, 6); r.shoot(b, 98); r.shoot(a, 7); r.shoot(b, 97); r.shoot(a, 8); r.shoot(b, 96); r.shoot(a, 9); // 5er versenkt
    }
    // Spieler-IDs sind je Raum zufällig: für den Vergleich durch Namen ersetzen
    const norm = (v) => JSON.stringify(v).replaceAll(a, 'A').replaceAll(b, 'B').replaceAll(z, 'Z');
    for (const who of [a, b, z]) log.push(norm(r.gameView(who)));
    return { log, shots: norm(r.shots), sunk: norm(r.sunk), scores: norm(r.scores) };
  };
  for (const Type of [Room, SalvoRoom]) {
    const base = run('naval', Type);
    for (const skin of skinIds()) assert.deepEqual(run(skin, Type), base, `${Type.name}/${skin}`);
  }
});

test('GEHEIM: der Skin verrät nichts – gegnerische Schiffe, auch die Bildwahl, bleiben bis zum Spielende verdeckt', () => {
  for (const skin of skinIds()) {
    const { r, a, b, z } = setup({ skin });
    r.place(a, FLEET_A); r.place(b, FLEET_B);
    r.shoot(a, 5); // Treffer auf Bens 5er, nicht versenkt
    for (const viewer of [a, z]) {
      const v = r.gameView(viewer);
      assert.equal(v.seas[b].ships, null, `${skin}: Bens Schiffe sind für ${viewer === a ? 'Anna' : 'Zoe'} verdeckt`);
      assert.deepEqual(v.seas[b].sunk, [], 'noch nichts versenkt');
      const json = JSON.stringify(v);
      for (const cells of FLEET_B.map((s) => s.cell)) assert.ok(!json.includes(`"cells":[${cells}`), 'keine Zellenliste des Gegners');
      assert.ok(!('skin' in v), 'der Skin steckt nicht in der Spielansicht, sondern in den Einstellungen');
    }
    assert.ok(r.view(z).settings.skin === skin, 'Zuschauer kennen den Skin über die Raumeinstellungen');
  }
});

test('Wiederherstellen: alte Räume ohne Skin erhalten naval, bekannte Werte bleiben, unbekannte werden naval', () => {
  const { r } = setup({});
  const snap = JSON.parse(JSON.stringify(r.snapshot()));
  delete snap.settings.skin; // Stand vor dieser Einführung
  assert.equal(Room.restore(snap, () => {}).settings.skin, 'naval');
  for (const id of skinIds()) {
    const s2 = JSON.parse(JSON.stringify(r.snapshot())); s2.settings.skin = id;
    assert.equal(Room.restore(s2, () => {}).settings.skin, id);
  }
  const s3 = JSON.parse(JSON.stringify(r.snapshot())); s3.settings.skin = 'veraltet';
  assert.equal(Room.restore(s3, () => {}).settings.skin, 'naval');
  const viaGame = game.restore({ ...JSON.parse(JSON.stringify(r.snapshot())), settings: { turnTime: 0, classic: false, touch: false, again: false } }, () => {});
  assert.equal(viaGame.settings.skin, 'naval');
  viaGame.dispose();
});

test('Dateien: jeder Skin hat seine Vorschau, die klassischen Schiffsbilder liegen vollständig vor und bleiben klein', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const s of SKINS) assert.ok(existsSync(join(root, 'public', s.preview)), `${s.id}: Vorschau ${s.preview}`);
  let bytes = 0;
  for (const model of ['ship-ocean-liner', 'ship-ocean-liner-small', 'ship-cargo-a', 'ship-cargo-b', 'boat-tow-a']) for (const o of ['h', 'v']) {
    const f = join(root, 'public/games/schiffe/art/naval', `stahl-${model}-${o}.webp`);
    assert.ok(existsSync(f), f); bytes += statSync(f).size;
  }
  assert.ok(bytes < 110 * 1024, `alle zehn Schiffsbilder zusammen ${bytes} Bytes`);
  // Pro Ansicht laden nur die tatsächlich gezeichneten Bilder (Standardflotte 5-4-3-3-2 in einer Lage): unter dem Budget von 60 KB
  const one = ['ship-ocean-liner', 'ship-ocean-liner-small', 'ship-cargo-a', 'ship-cargo-b', 'boat-tow-a'].reduce((n, m) => n + statSync(join(root, 'public/games/schiffe/art/naval', `stahl-${m}-h.webp`)).size, 0);
  assert.ok(one < 60 * 1024, `eine Lage: ${one} Bytes`);
});

// ---------- Server: Anlegen mit Skin, Prüfung, Verteilung an alle, mehrere Räume, Wiederverbinden ----------
let BASE, server;
const dataDir = mkdtempSync(join(tmpdir(), 'schiffe-skins-'));
before(async () => {
  server = spawn(process.execPath, ['--input-type=module', '-e', `
    const {http}=await import('./server/index.js');
    const ready=()=>console.log('TEST_READY:'+http.address().port);
    if(http.listening)ready();else http.once('listening',ready);
  `], { env: { ...process.env, PORT: '0', DATA_DIR: dataDir, POKER_NO_DOTENV: '1', SITE_PASSWORD: '', CREATE_LIMIT: '500' }, stdio: 'pipe' });
  let output = '';
  BASE = await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(output)), 20000);
    server.stderr.on('data', (d) => { output += d; });
    server.stdout.on('data', (d) => { output += d; const m = output.match(/TEST_READY:(\d+)/); if (m) { clearTimeout(timer); res('http://localhost:' + m[1]); } });
  });
});
const clients = [];
after(() => { clients.forEach((c) => c.close()); server.kill(); });
function client() {
  const s = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false });
  s.state = null; s.on('state', (st) => { s.state = st; });
  s.ask = (ev, d = {}) => new Promise((r) => s.emit(ev, d, r));
  clients.push(s); return s;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await wait(25); } throw new Error('Zeitüberschreitung'); }
async function table(settings, variant, name = 'Anna') {
  const host = client();
  const t = await host.ask('create', { game: 'schiffe', name, settings, ...(variant ? { variant } : {}) });
  assert.ok(t.ok, JSON.stringify(t));
  await until(() => host.state?.game === 'schiffe');
  return { host, t };
}

test('Server: Skin und Variante beim Erstellen, alle (auch Zuschauer) sehen denselben Skin', async () => {
  for (const skin of skinIds()) for (const variant of ['classic', 'salvo']) {
    const { host, t } = await table({ turnTime: '0', skin }, variant);
    assert.equal(host.state.settings.skin, skin); assert.equal(host.state.variant, variant);
    const guest = client(), watcher = client();
    assert.ok((await guest.ask('join', { code: t.code, name: 'Ben' })).ok);
    assert.ok((await watcher.ask('join', { code: t.code, name: 'Zoe' })).ok);
    await until(() => guest.state && watcher.state);
    assert.ok((await host.ask('sit')).ok); assert.ok((await guest.ask('sit')).ok); assert.ok((await host.ask('start')).ok);
    await until(() => watcher.state?.phase === 'playing');
    for (const c of [host, guest, watcher]) { assert.equal(c.state.settings.skin, skin, `${variant}/${skin}`); assert.equal(c.state.variant, variant); }
    // Zuschauer: keine Schiffspositionen, aber der Skin
    for (const sea of Object.values(watcher.state.g.seas)) assert.equal(sea.ships, null);
  }
});

test('Server: ungültige und manipulierte Skin-Werte beim Erstellen und in den Einstellungen ergeben sicher naval bzw. bleiben wirkungslos', async () => {
  for (const bad of ['unbekannt', '', '<img src=x onerror=alert(1)>', 7, null, ['naval'], { a: 1 }, 'NAVAL']) {
    const { host } = await table({ turnTime: '0', skin: bad });
    assert.equal(host.state.settings.skin, 'naval', JSON.stringify(bad));
  }
  const { host, t } = await table({ turnTime: '0' });
  assert.equal(host.state.settings.skin, 'naval', 'ohne Angabe: Standard');
  const guest = client();
  assert.ok((await guest.ask('join', { code: t.code, name: 'Ben' })).ok);
  await until(() => guest.state);
  for (const bad of ['unbekannt', 42, null, { x: 1 }]) { await host.ask('settings', { skin: bad }); }
  await wait(100);
  assert.equal(host.state.settings.skin, 'naval', 'ungültige Einstellung ändert nichts');
  const r = await guest.ask('settings', { skin: skinIds().at(-1) });
  assert.equal(r.ok, false, 'ein Gast darf das Design nicht ändern');
  await wait(100);
  assert.equal(host.state.settings.skin, 'naval');
});

test('Server: zwei Räume gleichzeitig mit verschiedenen Skins, nichts läuft über', async () => {
  const skins = skinIds(), a = skins[0], b = skins.at(-1);
  const r1 = await table({ turnTime: '0', skin: a }, 'classic', 'Eins'), r2 = await table({ turnTime: '0', skin: b }, 'salvo', 'Zwei');
  assert.equal(r1.host.state.settings.skin, a); assert.equal(r2.host.state.settings.skin, b);
  assert.notEqual(r1.t.code, r2.t.code);
  if (a !== b) {
    const g1 = client(); assert.ok((await g1.ask('join', { code: r1.t.code, name: 'Gast' })).ok); await until(() => g1.state);
    assert.equal(g1.state.settings.skin, a, 'Gast im ersten Raum sieht den ersten Skin');
    // Wechsel des Raums: neuer Beitritt in Raum zwei zeigt dessen Skin, nicht den vorherigen
    const g2 = client(); assert.ok((await g2.ask('join', { code: r2.t.code, name: 'Gast2' })).ok); await until(() => g2.state);
    assert.equal(g2.state.settings.skin, b);
    assert.ok((await r1.host.ask('settings', { skin: b })).ok); await wait(150);
    assert.equal(r2.host.state.settings.skin, b); assert.equal(g1.state.settings.skin, b, 'Raum eins wechselt, Raum zwei bleibt');
    assert.ok((await r1.host.ask('settings', { skin: a })).ok);
  }
});

test('Server: Wiederverbinden (gleiches Token) zeigt denselben Skin; gespeichert in rooms.json', async () => {
  const skin = skinIds().at(-1);
  const { host, t } = await table({ turnTime: '0', skin });
  const token = t.token;
  host.close();
  const back = client();
  const j = await back.ask('join', { code: t.code, name: 'Anna', token });
  assert.ok(j.ok, JSON.stringify(j));
  await until(() => back.state?.settings);
  assert.equal(back.state.settings.skin, skin);
  await until(() => { try { return JSON.parse(readFileSync(join(dataDir, 'rooms.json'), 'utf8')).find((r) => r.code === t.code)?.settings?.skin === skin; } catch { return false; } });
});
