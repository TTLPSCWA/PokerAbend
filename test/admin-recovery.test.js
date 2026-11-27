// QA-ADMIN-RELEASE-01: Fehlerfälle der administrativen Löschfunktionen – Teilausführung, Wiederherstellung, veraltete Voranzeigen,
// zusammengeführte Konten, Neustart. Alles auf isolierten Testdaten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountStore } from '../server/account-store.js';
import { createLeaderboard } from '../server/leaderboard.js';
import { createAdminTools } from '../server/admin-tools.js';
import { createDataBackup, restoreDataBackup, verifyBackup } from '../server/backup.js';

const tmp = (name) => mkdtempSync(join(tmpdir(), name));
const NOW = new Date('2026-11-15T12:00:00Z');

function world() {
  const dir = tmp('poker-qa-');
  const accounts = createAccountStore(dir), leaderboard = createLeaderboard(dir, { now: () => NOW });
  const make = (name) => { const id = accounts.newId(); const a = accounts.ensure(id); accounts.touch(id, { name }); return a; };
  const people = { anna: make('Anna'), ben: make('Ben'), cem: make('Cem'), dora: make('Dora') };
  const round = (id, a, b) => leaderboard.recordRound({ id, game: 'maumau', ranked: true, players: [{ accountId: a.id, name: a.name, win: true, points: 3 }, { accountId: b.id, name: b.name, win: false, points: 1 }] });
  round('1'.repeat(16), people.anna, people.ben); round('2'.repeat(16), people.ben, people.cem); round('3'.repeat(16), people.cem, people.dora);
  const calls = { erase: [], backup: 0 };
  let failFor = null, online = new Set();
  const erase = (id) => {
    calls.erase.push(id);
    if (id === failFor) throw Object.assign(new Error('Speicher nicht erreichbar'), { status: 503 });
    const removed = accounts.deleteAccount(id); leaderboard.forgetAccounts(removed);
  };
  const tools = createAdminTools({ leaderboard, accounts, erase, activeAccounts: () => online, backup: () => { calls.backup++; return { ok: true, verified: true, dir: 'backups/x' }; }, mergeAccounts: () => {}, changed: () => { leaderboard.save(); accounts.save({ flush: true }); }, gameIds: () => new Set(['maumau']) });
  return { dir, accounts, leaderboard, people, tools, calls, setFail: (a) => { failFor = a?.id; }, setOnline: (set) => { online = set; } };
}
const table = (lb) => lb.rankedTable('all', 'all', false, { withOwner: true }).map((r) => r.name).sort().join(',');

test('Mehrfachlöschung mit Fehler bei einem Konto: die übrigen werden gelöscht, der Fehler wird genau gemeldet, nichts wird verschwiegen', () => {
  const w = world(), ids = [w.people.anna, w.people.ben, w.people.cem].map((a) => a.gameId);
  w.setFail(w.people.ben);
  const pre = w.tools.players.deletePreview(ids);
  const done = w.tools.players.remove(ids, pre.token);
  assert.equal(done.deleted, 2); assert.deepEqual(done.failed.map((f) => f.gameId), [w.people.ben.gameId]); assert.match(done.failed[0].error, /Speicher/);
  assert.equal(w.accounts.byGameId(w.people.anna.gameId), null); assert.ok(w.accounts.byGameId(w.people.ben.gameId), 'das fehlgeschlagene Konto bleibt vollständig erhalten');
  assert.equal(w.calls.backup, 1, 'eine Sicherung vor dem Eingriff');
  assert.equal(w.tools.players.list({}).all, 2);
});

test('Veraltete Voranzeige und fremde Auswahl werden abgelehnt; gleichzeitige Eingriffe laufen nie verschachtelt', () => {
  const w = world(), a = w.people.anna.gameId, b = w.people.ben.gameId;
  const pre = w.tools.players.deletePreview([a]);
  assert.throws(() => w.tools.players.remove([b], pre.token), (e) => e.status === 409, 'Prüfwert gilt nur für diese Auswahl');
  assert.throws(() => w.tools.players.remove([a], 'falsch'), (e) => e.status === 409);
  assert.equal(w.accounts.all().length, 4);
  // Wiedereintritt während eines Eingriffs (zweite Admin-Aktion im selben Moment) wird abgewiesen
  const tools2 = createAdminTools({ leaderboard: w.leaderboard, accounts: w.accounts, erase: () => { assert.throws(() => tools2.players.remove([b], 'x'), (e) => e.status === 409 && /läuft schon/.test(e.message)); }, backup: () => ({ verified: true, dir: 'b' }), activeAccounts: () => new Set(), changed: () => {} });
  tools2.players.remove([a], tools2.players.deletePreview([a]).token);
  // Aktive Sitzung blockiert vollständig, ohne Teilausführung
  w.setOnline(new Set([w.people.ben.id]));
  const both = w.tools.players.deletePreview([a, b]);
  assert.throws(() => w.tools.players.remove([a, b], both.token), (e) => e.status === 409 && /Tisch/.test(e.message));
  assert.ok(w.accounts.byGameId(a) && w.calls.backup === 0, 'weder gelöscht noch gesichert');
});

test('Zusammengeführte Konten: die alte Game-ID löscht nie das Zielkonto; nach der Zusammenführung ist die Voranzeige ungültig', () => {
  const w = world(), from = w.people.anna.gameId, to = w.people.ben.gameId;
  const pre = w.tools.players.deletePreview([to]);
  w.accounts.merge(w.people.anna.id, w.people.ben.id); w.leaderboard.merge(w.people.anna.id, w.people.ben.id, 'Ben');
  assert.throws(() => w.tools.players.remove([to], pre.token), (e) => e.status === 409, 'Zusammenführung nach der Voranzeige macht sie ungültig');
  assert.throws(() => w.tools.players.deletePreview([from]), (e) => e.status === 404, 'aufgelöstes Konto ist über seine alte Game-ID nicht mehr ansprechbar');
  assert.throws(() => w.tools.players.compare(from, w.people.cem.gameId), (e) => e.status === 404);
  assert.equal(w.accounts.all().length, 3, 'Anna ist in Ben aufgegangen');
  const fresh = w.tools.players.deletePreview([to]);
  const done = w.tools.players.remove([to], fresh.token);
  assert.equal(done.deleted, 1); assert.deepEqual(done.failed, []);
  assert.equal(w.accounts.all().length, 2, 'die ganze Gruppe (Ben und das aufgegangene Konto) ist weg, Cem und Dora bleiben');
  assert.ok(!table(w.leaderboard).includes('Ben') && !table(w.leaderboard).includes('Anna'));
});

test('Neustart: gelöschte Konten und Statistik kehren nicht zurück', () => {
  const w = world();
  const pre = w.tools.players.deletePreview([w.people.cem.gameId]);
  w.tools.players.remove([w.people.cem.gameId], pre.token);
  const scope = { gameIds: [w.people.dora.gameId], game: 'maumau' };
  const sp = w.tools.stats.preview(scope);
  w.tools.stats.remove(scope, sp.token);
  w.leaderboard.save(); w.accounts.save({ flush: true });
  const accounts = createAccountStore(w.dir), leaderboard = createLeaderboard(w.dir, { now: () => NOW });
  assert.equal(accounts.all().length, 3); assert.equal(accounts.byGameId(w.people.cem.gameId), null);
  assert.ok(!table(leaderboard).includes('Cem') && !table(leaderboard).includes('Dora'), 'weder Cem (Konto) noch Doras Statistik erscheinen wieder');
  assert.ok(table(leaderboard).includes('Anna') && table(leaderboard).includes('Ben'));
});

test('Statistik-Bereinigung ist atomar: schlägt das Schreiben fehl, bleibt der Speicher unverändert; alte Voranzeige wird abgelehnt', () => {
  const w = world();
  const scope = { gameIds: [w.people.anna.gameId], game: 'all' };
  const preview = w.tools.stats.preview(scope);
  w.leaderboard.save();
  const file = join(w.dir, 'leaderboard.json'), good = readFileSync(file, 'utf8');
  // Schreibfehler erzwingen: der Zielpfad der temporären Datei ist ein Ordner
  mkdirSync(file + '.tmp');
  const before = table(w.leaderboard);
  assert.throws(() => w.tools.stats.remove(scope, preview.token));
  assert.equal(table(w.leaderboard), before, 'Speicher unverändert'); assert.equal(readFileSync(file, 'utf8'), good, 'Datei unverändert');
  // später klappt es; eine zwischenzeitlich geänderte Datenlage macht die Voranzeige ungültig
  w.leaderboard.recordRound({ id: '4'.repeat(16), game: 'maumau', ranked: true, players: [{ accountId: w.people.anna.id, name: 'Anna', win: true, points: 1 }, { accountId: w.people.dora.id, name: 'Dora', win: false, points: 0 }] });
  assert.throws(() => w.tools.stats.remove(scope, preview.token), (e) => e.status === 409, 'veraltet');
});

test('Sicherung: Manifest mit SHA-256, vorhandene Sicherungen werden nie überschrieben, Ziel außerhalb des Datenordners möglich', () => {
  const data = tmp('poker-bk-data-'), elsewhere = tmp('poker-bk-ext-');
  writeFileSync(join(data, 'accounts.json'), '{"a":1}'); mkdirSync(join(data, 'idle')); writeFileSync(join(data, 'idle', 'save.enc'), 'geheim');
  const fixed = () => new Date('2026-11-27T10:00:00Z');
  const a = createDataBackup(data, 'test', { now: fixed }), b = createDataBackup(data, 'test', { now: fixed });
  assert.notEqual(a.path, b.path, 'gleicher Zeitstempel überschreibt nichts'); assert.ok(existsSync(a.path) && existsSync(b.path));
  assert.deepEqual(verifyBackup(a.path).sort(), ['accounts.json', 'idle/save.enc']);
  const ext = createDataBackup(data, 'extern', { now: fixed, root: elsewhere });
  assert.ok(ext.path.startsWith(elsewhere) && !ext.path.startsWith(data), 'Sicherung außerhalb des Datenvolumes');
  assert.ok(!readdirSync(data).includes('backups') || !readdirSync(join(data, 'backups')).some((n) => n.startsWith('extern')));
  assert.throws(() => createDataBackup(data, 'x', { root: 'relativ/pfad' }), (e) => /absolut/.test(e.message));
});

test('Isolierte Wiederherstellung: Manifest wird geprüft, beschädigte Sicherungen abgelehnt, vorheriger Stand bleibt gesichert', () => {
  const data = tmp('poker-restore-');
  writeFileSync(join(data, 'accounts.json'), '{"konten":3}'); writeFileSync(join(data, 'leaderboard.json'), '{"runden":9}');
  const snap = createDataBackup(data, 'vorher', { now: () => new Date('2026-11-27T11:00:00Z') });
  // Schaden anrichten: Konten löschen, Bestenliste ändern, fremde Datei anlegen
  writeFileSync(join(data, 'accounts.json'), '{"konten":0}'); writeFileSync(join(data, 'leaderboard.json'), '{}'); writeFileSync(join(data, 'neu.json'), 'x');
  const done = restoreDataBackup(data, snap.path, { now: () => new Date('2026-11-27T12:00:00Z') });
  assert.equal(done.restored, 2);
  assert.equal(readFileSync(join(data, 'accounts.json'), 'utf8'), '{"konten":3}'); assert.equal(readFileSync(join(data, 'leaderboard.json'), 'utf8'), '{"runden":9}');
  assert.ok(!existsSync(join(data, 'neu.json')), 'Dateien, die nicht zur Sicherung gehören, werden entfernt');
  assert.equal(readFileSync(join(done.previous, 'accounts.json'), 'utf8'), '{"konten":0}', 'der beschädigte Stand vor der Wiederherstellung ist gesichert');
  assert.ok(readFileSync(join(snap.path, 'accounts.json'), 'utf8') === '{"konten":3}', 'die Sicherung selbst bleibt unverändert');
  // beschädigte Sicherung wird nicht angewendet
  writeFileSync(join(snap.path, 'accounts.json'), '{"manipuliert":1}');
  assert.throws(() => restoreDataBackup(data, snap.path), (e) => e.status === 409 && /beschädigt/.test(e.message));
  assert.equal(readFileSync(join(data, 'accounts.json'), 'utf8'), '{"konten":3}', 'bei abgelehnter Sicherung bleibt der Datenordner unberührt');
  assert.throws(() => verifyBackup(tmp('poker-leer-')), (e) => e.status === 400);
});
