// scripts/restore-test.sh: neuestes Backup entpacken, Server darauf starten, Bestenliste, Tickets und Tische prüfen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { createConnection } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { io } from 'socket.io-client';
import { createLeaderboard } from '../server/leaderboard.js';
import { extractRestoreArchive } from '../scripts/restore-archive.mjs';
import { launchRestoreCheck } from '../scripts/restore-test.mjs';
import { createAccountStore } from '../server/account-store.js';
import { createIdleExportCodec } from '../server/idle/exports.js';
import { createIdleSaveService } from '../server/idle/savepoints.js';
import { openIdleStorage } from '../server/idle/storage.js';
import { spielhalleEngine } from '../server/idle/spielhalle.js';
import { studioEngine } from '../server/idle/studio.js';
import { factoryEngine } from '../server/idle/factory.js';

const gitBash = join(process.env.ProgramFiles || 'C:/Program Files', 'Git', 'bin', 'bash.exe');
const shell = process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash';
const hasBash = spawnSync(shell, ['-c', 'tar --version >/dev/null && echo ok']).stdout?.toString().trim() === 'ok';
const repo = fileURLToPath(new URL('..', import.meta.url));
const slash = (p) => p.replace(/\\/g, '/');
const bash = (args, options = {}) => spawnSync(shell, args, { encoding: 'utf8', cwd: repo, timeout: 45_000, ...options });
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'restore-fixture-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Echten Server mit Daten füllen (Tisch, Ticket) und sauber beenden – so entsteht ein realistisches Daten-Verzeichnis */
async function realisticData(t) {
  const dataDir = scratch(t);
  const check = await launchRestoreCheck(dataDir, AbortSignal.timeout(30_000));
  const login = await check.request('/login', { method: 'POST', body: new URLSearchParams({ password: check.password }) });
  const cookie = login.headers.getSetCookie()[0]?.split(';')[0];
  assert.equal(login.status, 303);
  const socket = io(check.url, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { cookie } });
  try {
  const ask = (event, data) => new Promise((resolve) => socket.timeout(5000).emit(event, data, (e, r) => resolve(e ? { ok: false } : r)));
  assert.ok((await ask('create', { game: 'viergewinnt', name: 'Anna' })).ok);
  const ticket = await check.request('/api/tickets', { method: 'POST', headers: { cookie, 'content-type': 'application/json', 'x-requested-with': 'spieleabend' }, body: JSON.stringify({ title: 'Sicherung testen', type: 'idea', description: 'Ein Ticket für den Wiederherstellungs-Test.', name: 'Anna', avatar: '🦉' }) });
  assert.equal(ticket.status, 201);
  } finally {
    socket.disconnect();
    await check.stop();
  }
  const board = createLeaderboard(dataDir); // ein gespeichertes Ergebnis, wie nach einem echten Abend
  board.record('viergewinnt', [{ name: 'Anna', win: true, points: 1 }, { name: 'Ben', win: false, points: 0 }]);
  board.save();
  return dataDir;
}
const archiveOf = (t, dataDir, name = 'spieleabend-2026-11-01_0430.tar.gz') => {
  const dir = scratch(t);
  // Über stdout archivieren: GNU-tar (Git Bash) deutet „C:/…“ als Rechnernamen
  const made = spawnSync(shell, ['-c', 'tar cz .'], { cwd: dataDir, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(made.status, 0, String(made.stderr));
  writeFileSync(join(dir, name), made.stdout);
  return { dir, file: join(dir, name) };
};

test('restore-test.sh: neuestes Backup wird entpackt, Server startet, Bestenliste, Tickets und Tische laden', { skip: !hasBash && 'bash nicht verfügbar' }, async (t) => {
  const data = await realisticData(t);
  const { dir } = archiveOf(t, data);
  // Ein älteres Backup liegt auch da – das neueste muss gewinnen
  const old = archiveOf(t, scratch(t), 'spieleabend-2020-01-01_0000.tar.gz');
  writeFileSync(join(dir, 'spieleabend-2020-01-01_0000.tar.gz'), readFileSync(old.file));
  utimesSync(join(dir, 'spieleabend-2020-01-01_0000.tar.gz'), new Date('2020-01-01'), new Date('2020-01-01'));
  const result = bash(['scripts/restore-test.sh'], { env: { ...process.env, BACKUP_DIR: slash(dir) } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /spieleabend-2026-11-01_0430\.tar\.gz/);
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version; // die gebaute Version, nicht fest eingetragen
  assert.ok(result.stdout.includes(`/health ok, Version ${version}`), result.stdout);
  assert.match(result.stdout, /Bestenliste geladen/);
  assert.match(result.stdout, /Tickets geladen \(1\)/);
  assert.match(result.stdout, /Tische geladen \(1\)/);
  assert.match(result.stdout, /OK: Die Sicherung/);
});

test('restore-test.sh: aufgeräumt wird immer, die Archivquelle bleibt unberührt', { skip: !hasBash && 'bash nicht verfügbar' }, async (t) => {
  const data = await realisticData(t);
  const before = readFileSync(join(data, 'rooms.json'), 'utf8');
  const { file } = archiveOf(t, data);
  const archive = readFileSync(file);
  const temp = scratch(t);
  const result = bash(['scripts/restore-test.sh', slash(file)], { env: { ...process.env, TMPDIR: temp, TEMP: temp, TMP: temp } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(readFileSync(join(data, 'rooms.json'), 'utf8'), before);
  assert.deepEqual(readFileSync(file), archive);
  assert.deepEqual(readdirSync(temp), []);
});

test('B11: konsistentes Archiv enthält Konto, Sitzungsschlüssel und alle drei Idle-Savepoints', { skip: !hasBash && 'bash nicht verfügbar' }, async (t) => {
  const data = await realisticData(t);
  const accounts = createAccountStore(data);
  const account = accounts.ensure(accounts.newId());
  accounts.save({ flush: true });
  const secret = 'synthetic-restore-cookie-key';
  writeFileSync(join(data, 'secret.key'), secret, { mode: 0o600 });
  const engines = [spielhalleEngine, studioEngine, factoryEngine];
  const makeCodec = () => createIdleExportCodec({ current: 'restore-fixture', keys: { 'restore-fixture': Buffer.alloc(32, 84) } });
  const savedAt = 1_790_000_000_000;
  function recoverableStore(root, owners) {
    return openIdleStorage(join(root, 'idle'), { enabled: true, accountMembers: owners.members });
  }
  const originalStore = recoverableStore(data, accounts);
  const exports = new Map();
  try {
    const service = createIdleSaveService({ engines, store: originalStore, codec: makeCodec(), now: () => savedAt });
    for (const { gameId } of engines) {
      const open = service.open(account.id, gameId);
      exports.set(gameId, service.saveAndExport(account.id, gameId, {
        token: open.token, sessionVersion: open.sessionVersion, revision: open.revision, id: 'before-backup',
      }));
    }
  } finally { originalStore.close(); }

  const { file } = archiveOf(t, data);
  const originalBytes = readFileSync(file);
  const restored = join(scratch(t), 'restored');
  await extractRestoreArchive(file, restored, AbortSignal.timeout(5000));
  for (const filename of ['accounts.json', 'rooms.json', 'leaderboard.json', 'tickets.json', 'secret.key']) {
    assert.deepEqual(readFileSync(join(restored, filename)), readFileSync(join(data, filename)));
    if (process.platform !== 'win32') assert.equal(statSync(join(restored, filename)).mode & 0o777, 0o600);
  }
  const recoveredAccounts = createAccountStore(restored);
  assert.equal(recoveredAccounts.loadedFromDisk, true);
  assert.equal(recoveredAccounts.get(account.id).gameId, account.gameId);
  const recoveredStore = recoverableStore(restored, recoveredAccounts);
  try {
    const codec = makeCodec();
    const service = createIdleSaveService({ engines, store: recoveredStore, codec, now: () => savedAt });
    for (const { gameId } of engines) {
      const expected = exports.get(gameId);
      assert.deepEqual(service.exportConfirmed(account.id, gameId), expected);
      assert.equal(service.preview(account.id, gameId).revision, 1);
      assert.equal(codec.decode(account.id, gameId, expected.file).revision, 1);
    }
  } finally { recoveredStore.close(); }
  const check = await launchRestoreCheck(restored, AbortSignal.timeout(30_000));
  try {
    assert.equal((await (await check.request('/health')).json()).ok, true);
    assert.equal(check.address.rooms, 1);
    assert.equal(check.dataFailed(), false);
  } finally { await check.stop(); }
  assert.deepEqual(readFileSync(file), originalBytes);
});

test('restore-test.sh: kaputtes Archiv, fehlendes Backup und beschädigte Daten schlagen mit Fehler fehl', { skip: !hasBash && 'bash nicht verfügbar' }, async (t) => {
  const empty = scratch(t);
  const none = bash(['scripts/restore-test.sh'], { env: { ...process.env, BACKUP_DIR: slash(empty) } });
  assert.notEqual(none.status, 0);
  assert.match(none.stderr, /Kein Backup/);

  const garbage = join(empty, 'spieleabend-kaputt.tar.gz');
  writeFileSync(garbage, 'das ist kein Archiv');
  const broken = bash(['scripts/restore-test.sh', slash(garbage)]);
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /entpacken/);

  const data = await realisticData(t);
  writeFileSync(join(data, 'tickets.json'), '{kaputt');
  const damaged = archiveOf(t, data);
  const temp = scratch(t);
  const result = bash(['scripts/restore-test.sh', slash(damaged.file)], { env: { ...process.env, TMPDIR: temp, TEMP: temp, TMP: temp } });
  assert.notEqual(result.status, 0, 'defekte Ticket-Datei muss auffallen');
  assert.match(result.stderr, /Tickets|Probleme/);
  assert.deepEqual(readdirSync(temp), []);
});

function acceptsTcp(host, port) {
  return new Promise((resolve) => {
    const client = createConnection({ host, port });
    const done = (connected) => { client.destroy(); resolve(connected); };
    client.once('connect', () => done(true));
    client.once('error', () => done(false));
    client.setTimeout(800, () => done(false));
  });
}

test('Restore bindet nur Loopback, schützt die API und schließt den Listener', async (t) => {
  const check = await launchRestoreCheck(scratch(t), AbortSignal.timeout(30_000));
  const { address, port } = check.address;
  try {
    assert.equal(address, '127.0.0.1');
    assert.equal(await acceptsTcp(address, port), true);
    const other = Object.values(networkInterfaces()).flat().filter(({ family, internal }) => family === 'IPv4' && !internal);
    for (const { address: host } of other) assert.equal(await acceptsTcp(host, port), false);
    const response = await check.request('/api/tickets');
    assert.ok([302, 401, 403].includes(response.status));
  } finally {
    await check.stop();
  }
  assert.equal(await acceptsTcp(address, port), false);
});

test('Restore-Server verweigert unvollständige Startkonfiguration vor Datenzugriff', (t) => {
  const dir = scratch(t);
  const bad = spawnSync(process.execPath, ['server/index.js'], { cwd: repo, encoding: 'utf8', timeout: 5000,
    env: { ...process.env, POKER_RESTORE_CHECK: '1', POKER_NO_DOTENV: '1', PORT: '0', DATA_DIR: dir, SITE_PASSWORD: '' } });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Ungültige Konfiguration/);
  assert.deepEqual(readdirSync(dir), []);
});

function tarHeader(name, type = '0') {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write('0000600', 100);
  header.write('00000000000', 124);
  header.fill(32, 148, 156);
  header.write(type, 156);
  header.write(header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0'), 148);
  header[154] = 0;
  return header;
}

test('Archivgrenzen lehnen nicht unterstützte Pfade und Typen ab', async (t) => {
  const root = scratch(t);
  const file = join(root, 'synthetic.tar.gz');
  const sentinel = join(root, 'sentinel');
  writeFileSync(sentinel, 'unverändert');
  const cases = [
    [tarHeader('../sentinel')], [tarHeader('/absolute')], [tarHeader('datei', '2')],
    [tarHeader('datei', '1')], [tarHeader('datei', '6')], [tarHeader('aux.txt')],
    [tarHeader('Akten'), tarHeader('akten')],
  ];
  for (const [index, headers] of cases.entries()) {
    writeFileSync(file, gzipSync(Buffer.concat([...headers, Buffer.alloc(1024)])));
    await assert.rejects(extractRestoreArchive(file, join(root, 'case-' + index), AbortSignal.timeout(5000)));
  }
  assert.equal(readFileSync(sentinel, 'utf8'), 'unverändert');
});
