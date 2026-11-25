import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractRestoreArchive } from './restore-archive.mjs';

const loopback = '127.0.0.1';
const dataError = /Laden fehlgeschlagen|nicht lesbar|konnten nicht geladen/;
const marker = '--restore-child';

function selectArchive(argument, directory) {
  if (argument) return resolve(argument);
  let files;
  try {
    files = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    files = [];
  }
  const backups = files.filter((entry) => entry.isFile() && /^spieleabend-.*\.tar\.gz$/.test(entry.name))
    .map(({ name }) => ({ path: join(directory, name), modified: lstatSync(join(directory, name)).mtimeMs }));
  backups.sort((a, b) => b.modified - a.modified);
  if (!backups.length) throw new Error('Kein Backup im Sicherungsverzeichnis gefunden.');
  return backups[0].path;
}

async function serve() {
  if (!process.connected) throw new Error('Der Restore-Test benötigt seinen lokalen Prüfprozess.');
  // Also clean up if the parent is terminated without running its finally block.
  const stop = () => process.emit('SIGTERM');
  process.once('disconnect', stop);
  process.once('message', stop);
  const { http, rooms } = await import('../server/index.js');
  if (!http.listening) await once(http, 'listening');
  const address = http.address();
  if (address?.address !== loopback || address.family !== 'IPv4' || !address.port) {
    throw new Error('Loopback-Bindung des Restore-Tests nicht bestätigt.');
  }
  process.send({ address: address.address, port: address.port, rooms: rooms.size });
}

export async function launchRestoreCheck(dataDir, signal) {
  const password = randomBytes(32).toString('hex');
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(?:systemroot|windir|path|temp|tmp|comspec)$/i.test(key)));
  const child = fork(fileURLToPath(import.meta.url), [marker], {
    execArgv: [], stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true,
    env: { ...environment, DATA_DIR: dataDir, POKER_RESTORE_CHECK: '1', POKER_NO_DOTENV: '1', PORT: '0',
      SITE_PASSWORD: password, SESSION_SECRET: randomBytes(32).toString('hex') },
  });
  const ended = new Promise((done) => {
    child.once('exit', done);
    child.once('error', done);
  });
  let invalidData = false, tail = '';
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    if (dataError.test(tail + chunk)) invalidData = true;
    tail = chunk.slice(-32);
  });
  async function stop() {
    if (child.connected) child.send('stop', () => {});
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await ended; } finally { clearTimeout(timer); }
  }
  try {
    const ready = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
    const [address] = await Promise.race([
      once(child, 'message', { signal: ready }),
      ended.then(() => { throw new Error('Der Restore-Prüfserver konnte nicht starten.'); }),
    ]);
    if (address?.address !== loopback || !Number.isInteger(address.port) || address.port < 1 || address.port > 65535) {
      throw new Error('Loopback-Bindung des Restore-Tests nicht bestätigt.');
    }
    const url = `http://${loopback}:${address.port}`;
    async function request(path, options = {}) {
      return fetch(url + path, { ...options, redirect: 'manual', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) });
    }
    return { url, request, address, password, stop, dataFailed: () => invalidData };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function restore(argument, signal) {
  const archive = selectArchive(argument, process.env.BACKUP_DIR || '/var/backups/spieleabend');
  if (!lstatSync(archive, { throwIfNoEntry: false })?.isFile()) throw new Error('Das Backup ist keine reguläre Datei.');
  const work = mkdtempSync(join(tmpdir(), 'pokerabend-restore-'));
  const data = join(work, 'data');
  const present = (name) => lstatSync(join(data, name), { throwIfNoEntry: false })?.isFile();
  let server;
  try {
    try {
      await extractRestoreArchive(archive, data, signal);
    } catch {
      signal.throwIfAborted();
      throw new Error('Das Sicherungsarchiv lässt sich nicht sicher entpacken.');
    }
    const hasRooms = present('rooms.json');
    const expectedRooms = hasRooms ? JSON.parse(readFileSync(join(data, 'rooms.json'), 'utf8')) : [];
    if (!Array.isArray(expectedRooms)) throw new Error('rooms.json hat ein unerwartetes Format.');
    signal.throwIfAborted();
    server = await launchRestoreCheck(data, signal);
    const health = await (await server.request('/health')).json();
    if (health.ok !== true || typeof health.version !== 'string') throw new Error('/health antwortet nicht in Ordnung.');
    console.log('/health ok, Version ' + health.version);
    const login = await server.request('/login', { method: 'POST', body: new URLSearchParams({ password: server.password }) });
    const cookie = login.headers.getSetCookie().find((entry) => entry.startsWith('pa_auth='))?.split(';')[0];
    if (login.status !== 303 || !cookie) throw new Error('Lokale Restore-Anmeldung fehlgeschlagen.');
    async function get(path, label) {
      const response = await server.request(path, { headers: { cookie } });
      if (!response.ok) throw new Error(label + ' lassen sich nicht laden.');
      return response.json();
    }
    if (present('leaderboard.json')) {
      const board = await get('/api/leaderboard?game=poker&period=all', 'Bestenliste');
      if (!Array.isArray(board.rows)) throw new Error('Bestenliste hat ein unerwartetes Format.');
      console.log('Bestenliste geladen');
    }
    if (present('tickets.json')) {
      const tickets = await get('/api/tickets', 'Tickets');
      if (!Array.isArray(tickets.tickets)) throw new Error('Tickets haben ein unerwartetes Format.');
      console.log(`Tickets geladen (${tickets.counts?.total ?? tickets.total})`);
    }
    if (hasRooms) {
      if (server.address.rooms !== expectedRooms.length) throw new Error('Nicht alle gesicherten Tische wurden geladen.');
      console.log(`Tische geladen (${expectedRooms.length})`);
    }
    if (server.dataFailed()) throw new Error('Der Server meldet beim Laden Probleme mit den Daten.');
    console.log(`OK: Die Sicherung ${JSON.stringify(basename(archive))} lässt sich wiederherstellen.`);
  } finally {
    try {
      await server?.stop();
    } finally {
      rmSync(work, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
    }
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const abort = new AbortController();
  if (args[0] !== marker) {
    for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => abort.abort(new Error('Restore-Test abgebrochen.')));
  }
  try {
    if (args.length > 1) throw new Error('Aufruf: restore-test.sh [Sicherungsarchiv]');
    if (args[0] === marker) await serve();
    else await restore(args[0], abort.signal);
  } catch (error) {
    console.error('FEHLER: ' + (error instanceof SyntaxError ? 'Gesicherte Daten sind kein gültiges JSON.' : error.message));
    // A failed child must close its IPC channel and any listener immediately.
    if (args[0] === marker) process.exit(1);
    process.exitCode = 1;
  }
}
