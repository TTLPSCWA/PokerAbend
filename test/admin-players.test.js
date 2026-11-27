// ADMIN-GAMES-02: Spielerverwaltung (Liste, Vergleich, Zusammenführen, Löschen, alle löschen) und Statistik-Bereinigung.
// Alles läuft auf isolierten Testdaten (eigener Datenordner), nie auf echten Konten.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { createLeaderboard } from '../server/leaderboard.js';
import { createDataBackup } from '../server/backup.js';

const DATA = mkdtempSync(join(tmpdir(), 'poker-admin-players-'));
Object.assign(process.env, { POKER_NO_DOTENV: '1', PORT: '0', DATA_DIR: DATA, SITE_PASSWORD: 'Play2026', ADMIN_PASSWORD: 'Admin-Play-2026', TRUST_PROXY: '1', CREATE_LIMIT: '500', API_LIMIT: '100000' });
let http, BASE;
before(async () => {
  ({ http } = await import('../server/index.js'));
  if (!http.listening) await new Promise((r) => http.once('listening', r));
  BASE = `http://localhost:${http.address().port}`;
});
after(() => { http.closeAllConnections?.(); http.close(); setTimeout(() => process.exit(0), 50).unref(); });

let n = 1;
async function visitor(admin = false) {
  const jar = {}, ip = `10.9.${Math.floor(n / 250)}.${n++ % 250}`;
  const take = (res) => { for (const c of res.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = decodeURIComponent(kv.slice(i + 1)); if (v) jar[kv.slice(0, i)] = v; } };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  take(await fetch(BASE + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip }, body: new URLSearchParams({ password: 'Play2026' }) }));
  take(await fetch(BASE + '/', { headers: { cookie: cookie(), 'x-forwarded-for': ip, accept: 'text/html' } }));
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, { method, redirect: 'manual', headers: { cookie: cookie(), 'x-forwarded-for': ip, origin: BASE, 'x-requested-with': 'spieleabend', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    take(res); return res;
  };
  const v = { jar, cookie, ip, get: (p, h) => call('GET', p, undefined, h), post: (p, b = {}, h) => call('POST', p, b, h) };
  if (admin) assert.equal((await v.post('/admin/api/login', { password: 'Admin-Play-2026' })).status, 200);
  return v;
}
const gameIdOf = async (v) => (await (await v.get('/api/identity')).json()).gameId;
const socketOf = (v) => new Promise((res, rej) => { const s = io(BASE, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { cookie: v.cookie(), 'x-forwarded-for': v.ip } }); s.on('connect', () => res(s)); s.on('connect_error', rej); });
const ask = (s, event, data) => new Promise((res) => { const t = setTimeout(() => res({ ok: false, error: 'keine Antwort' }), 3000); s.emit(event, data, (r) => { clearTimeout(t); res(r); }); });

test('Spieler-API: nur mit Admin-Anmeldung und Herkunftsschutz', async () => {
  const anon = await visitor();
  for (const [m, p] of [['get', '/admin/api/players/list'], ['get', '/admin/api/players/ids'], ['get', '/admin/api/players/compare?from=a&to=b'], ['get', '/admin/api/players/delete-all-preview']]) assert.equal((await anon[m](p)).status, 401, p);
  for (const p of ['/admin/api/players/delete-preview', '/admin/api/players/delete', '/admin/api/players/delete-all', '/admin/api/stats/preview', '/admin/api/stats/delete']) assert.equal((await anon.post(p, {})).status, 401, p);
  const admin = await visitor(true);
  assert.equal((await admin.post('/admin/api/players/delete', { ids: [], token: 'x' }, { 'x-requested-with': '' })).status, 403, 'ohne Herkunftsnachweis kein Schreibzugriff');
});

test('Spielerliste: vollständig, paginiert (>100 Konten), gefiltert und ohne interne IDs', async () => {
  const admin = await visitor(true);
  const players = [];
  for (let i = 0; i < 110; i++) players.push(await visitor());
  const first = await (await admin.get('/admin/api/players/list?pageSize=100&sort=created')).json();
  assert.ok(first.all >= 110 && first.total >= 110 && first.pages >= 2 && first.items.length === 100);
  const second = await (await admin.get('/admin/api/players/list?pageSize=100&sort=created&page=2')).json();
  assert.ok(second.items.length >= 10);
  const seen = new Set([...first.items, ...second.items].map((i) => i.gameId));
  assert.equal(seen.size, first.items.length + second.items.length, 'keine Doppelten zwischen den Seiten');
  const raw = JSON.stringify(first);
  assert.ok(!/"id"|accountId|externals|discordId|externalId/i.test(raw), 'keine internen Kennungen');
  assert.deepEqual(Object.keys(first.items[0]).sort(), ['avatar', 'createdAt', 'discord', 'gameId', 'lastSeen', 'name', 'played', 'status', 'type', 'wins']);
  assert.equal((await (await admin.get('/admin/api/players/list?filter=discord')).json()).total, 0);
  const one = await gameIdOf(players[0]);
  assert.equal((await (await admin.get('/admin/api/players/list?q=' + encodeURIComponent(one))).json()).total, 1);
  const byName = await (await admin.get('/admin/api/players/list?sort=name&pageSize=25')).json();
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
  const names = byName.items.map((i) => i.name || '~');
  assert.deepEqual(names, [...names].sort(collator.compare));
  assert.equal((await admin.get('/admin/api/players/list?filter=nix')).status, 400);
  const ids = await (await admin.get('/admin/api/players/ids?filter=guest')).json();
  assert.ok(ids.ids.length >= 110 && ids.total === ids.ids.length);
});

test('Zusammenführen: Vergleich vor der Aktion, danach gehört alles dem Ziel', async () => {
  const admin = await visitor(true), a = await visitor(), b = await visitor();
  const from = await gameIdOf(a), to = await gameIdOf(b);
  const cmp = await (await admin.get(`/admin/api/players/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)).json();
  assert.equal(cmp.from.gameId, from); assert.equal(cmp.to.gameId, to); assert.ok(cmp.effects.length >= 2);
  assert.equal((await admin.get(`/admin/api/players/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(from)}`)).status, 400);
  assert.equal((await admin.get(`/admin/api/players/compare?from=${encodeURIComponent(from)}&to=ZZZZZZZZ`)).status, 400);
  const merged = await admin.post('/admin/api/players/merge', { from, to });
  assert.equal(merged.status, 200);
  const list = await (await admin.get('/admin/api/players/list?q=' + encodeURIComponent(from))).json();
  assert.equal(list.total, 0, 'das Quellkonto erscheint nicht mehr als eigener Spieler');
});

test('Löschen: Voranzeige und Prüfwert Pflicht, aktive Tische blockieren, Sicherung entsteht, Daten verschwinden', async () => {
  const admin = await visitor(true), a = await visitor(), b = await visitor(), c = await visitor();
  const [ga, gb, gc] = [await gameIdOf(a), await gameIdOf(b), await gameIdOf(c)];
  assert.equal((await admin.post('/admin/api/players/delete', { ids: [ga] })).status, 409, 'ohne Prüfwert');
  assert.equal((await admin.post('/admin/api/players/delete-preview', { ids: ['kaputt'] })).status, 400);
  assert.equal((await admin.post('/admin/api/players/delete-preview', { ids: ['#ZZZZZ'] })).status, 404);
  const pre = await (await admin.post('/admin/api/players/delete-preview', { ids: [ga, gb] })).json();
  assert.equal(pre.count, 2); assert.equal(pre.active, 0); assert.ok(pre.token && pre.effects.length);
  // c sitzt an einem Tisch: Löschung verweigert, nichts ändert sich
  const s = await socketOf(c);
  try {
    assert.equal((await ask(s, 'create', { game: 'maumau', name: 'Cora', avatar: '🦊' })).ok, true);
    const blocked = await (await admin.post('/admin/api/players/delete-preview', { ids: [gc] })).json();
    assert.equal(blocked.active, 1);
    const refuse = await admin.post('/admin/api/players/delete', { ids: [gc], token: blocked.token });
    assert.equal(refuse.status, 409); assert.match((await refuse.json()).error, /Tisch/);
    assert.equal((await (await admin.get('/admin/api/players/list?q=' + encodeURIComponent(gc))).json()).total, 1);
  } finally { await ask(s, 'closeTable', {}); s.close(); }
  const stale = await admin.post('/admin/api/players/delete', { ids: [ga], token: pre.token });
  assert.equal(stale.status, 409, 'Prüfwert gilt nur für genau diese Auswahl');
  const done = await (await admin.post('/admin/api/players/delete', { ids: [ga, gb], token: pre.token })).json();
  assert.equal(done.deleted, 2); assert.match(done.backup, /^backups\/spieler-loeschen-/);
  assert.ok(existsSync(join(DATA, done.backup, 'accounts.json')), 'Sicherung enthält die Konten');
  assert.equal((await (await admin.get('/admin/api/players/list?q=' + encodeURIComponent(ga))).json()).total, 0);
  assert.equal((await (await admin.get('/admin/api/players/list?q=' + encodeURIComponent(gc))).json()).total, 1, 'andere Konten bleiben');
  const log = (await (await admin.get('/admin/api/log')).json()).entries.map((e) => `${e.action} ${e.detail || ''}`).join('|');
  assert.match(log, /Spieler gelöscht/); assert.ok(!log.includes(ga), 'das Protokoll nennt keine Game-ID');
});

test('Alle Spieler löschen: Passwort, Bestätigungstext, frische Voranzeige und Sicherung – isolierte Testdaten', async () => {
  const admin = await visitor(true);
  const pre = await (await admin.get('/admin/api/players/delete-all-preview')).json();
  assert.ok(pre.count > 100 && pre.phrase === 'ALLE SPIELER LÖSCHEN' && pre.token);
  const send = (body) => admin.post('/admin/api/players/delete-all', body);
  assert.equal((await send({ confirm: pre.phrase, token: pre.token })).status, 401, 'ohne Passwort');
  assert.equal((await send({ confirm: pre.phrase, token: pre.token, password: 'falsch' })).status, 401);
  assert.equal((await send({ confirm: 'alle spieler löschen', token: pre.token, password: 'Admin-Play-2026' })).status, 400, 'Text genau');
  assert.equal((await send({ confirm: pre.phrase, token: 'veraltet0000', password: 'Admin-Play-2026' })).status, 409);
  const holder = await visitor(), s = await socketOf(holder);
  try {
    assert.equal((await ask(s, 'create', { game: 'maumau', name: 'Hanna', avatar: '🦉' })).ok, true);
    const fresh = await (await admin.get('/admin/api/players/delete-all-preview')).json();
    assert.ok(fresh.active >= 1);
    const refuse = await send({ confirm: fresh.phrase, token: fresh.token, password: 'Admin-Play-2026' });
    assert.equal(refuse.status, 409);
    assert.ok((await (await admin.get('/admin/api/players/list')).json()).all >= 100, 'bei Ablehnung bleibt alles erhalten');
  } finally { await ask(s, 'closeTable', {}); s.close(); }
  await new Promise((r) => setTimeout(r, 200));
  const ready = await (await admin.get('/admin/api/players/delete-all-preview')).json();
  const ok = await send({ confirm: ready.phrase, token: ready.token, password: 'Admin-Play-2026' });
  const body = await ok.json();
  assert.equal(ok.status, 200, body.error); assert.ok(body.deleted > 100); assert.match(body.backup, /^backups\/alle-spieler-loeschen-/);
  assert.ok(existsSync(join(DATA, body.backup, 'accounts.json')));
  assert.equal((await (await admin.get('/admin/api/players/list')).json()).all, 0);
  assert.ok(readdirSync(join(DATA, 'backups')).some((d) => d.startsWith('alle-spieler-loeschen-')));
});

test('Bestenlisten-Bereinigung: nur Statistik, Konten bleiben, überlebt Neustart; Teilmengen lassen andere unberührt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poker-lb-'));
  const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);
  const lb = createLeaderboard(dir, { now: () => new Date('2026-11-15T12:00:00Z') });
  const round = (id, game, players) => lb.recordRound({ id, game, ranked: true, players });
  round('1'.repeat(16), 'maumau', [{ accountId: A, name: 'Anna', win: true, points: 3 }, { accountId: B, name: 'Ben', win: false, points: 1 }]);
  round('2'.repeat(16), 'maumau', [{ accountId: B, name: 'Ben', win: true, points: 3 }, { accountId: C, name: 'Cem', win: false, points: 1 }]);
  round('3'.repeat(16), 'viergewinnt', [{ accountId: A, name: 'Anna', win: false, points: 0 }, { accountId: C, name: 'Cem', win: true, points: 1 }]);
  lb.record('maumau', [{ accountId: A, name: 'Anna', win: true, points: 3 }, { accountId: B, name: 'Ben', win: false, points: 1 }]);
  const table = (g = 'all') => lb.rankedTable(g, 'all', false, { withOwner: true }).map((r) => `${r.owner[0]}:${r.played}`).sort().join(',');
  assert.equal(table(), 'a:2,b:2,c:2');
  const preview = lb.statsPreview({ owners: new Set([A]), game: 'all', month: null });
  assert.deepEqual([preview.rounds, preview.entries, preview.players], [0, 2, 1]);
  assert.equal(table(), 'a:2,b:2,c:2', 'die Voranzeige ändert nichts');
  const done = lb.statsDelete({ owners: new Set([A]), game: 'all', month: null });
  assert.equal(done.entries, 2); assert.ok(done.counters >= 1);
  assert.equal(table(), 'b:2,c:2', 'nur Annas Statistik ist weg; Ben und Cem behalten ihre Runden');
  lb.save();
  const again = createLeaderboard(dir, { now: () => new Date('2026-11-15T12:00:00Z') });
  assert.equal(again.rankedTable('all', 'all', false, { withOwner: true }).map((r) => `${r.owner[0]}:${r.played}`).sort().join(','), 'b:2,c:2', 'nach dem Neustart bleibt alles weg');
  assert.ok(again.roundCount() === 3, 'Runden bleiben für die anderen erhalten');
  const game = again.statsDelete({ owners: null, game: 'maumau', month: null });
  assert.equal(game.rounds, 2); assert.equal(again.rankedTable('viergewinnt', 'all').length, 2 - 1 /* Cem allein, Anna entfernt */);
  assert.equal(again.statsDelete({ owners: null, game: 'all', month: '2026-10' }).rounds, 0, 'anderer Monat: nichts betroffen');
  const all = again.statsDelete({ owners: null, game: 'all', month: null });
  assert.equal(all.rounds, 1); assert.equal(again.roundCount(), 0);
  again.save();
  assert.equal(createLeaderboard(dir).roundCount(), 0);
});

test('Datensicherung: prüft jede Datei und lässt nie einen halben Ordner zurück', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poker-bk-'));
  assert.equal(createDataBackup(dir).empty, undefined);
  assert.throws(() => createDataBackup(dir, 'Ungültig Name'), (e) => e.status === 400);
  const copy = createDataBackup(mkdtempSync(join(tmpdir(), 'poker-bk-empty-')), 'test');
  assert.equal(copy.files, 0);
});
