import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createReviewStore, reviewFromRoom, summarizeReview, reviewMarkdown, MAX_REVIEWS } from '../server/evening-reviews.js';
import { GAMES } from '../games/index.js';
import { configureProgram, beginProgram, recordProgramResult, restoreProgram } from '../server/party-program.js';

const fixture = (scores = [[2, 1]], options = {}) => ({ unlisted: false, partyProgram: {
  id: randomUUID(), config: { name: 'Freitag', mode: 'abend' }, status: 'done', startedAt: 1000, endedAt: 9000,
  roster: [{ id: 'secret-player-a', name: 'Anna', avatar: '🦉', team: 'a' }, { id: 'secret-player-b', name: 'Ben', avatar: '🐱', team: 'b' }],
  plan: scores.map(() => ({ game: 'viergewinnt' })), scores: { 'secret-player-a': 999999 },
  results: scores.map(([a, b], index) => ({ index, game: 'viergewinnt', points: { 'secret-player-a': a, 'secret-player-b': b }, raw: { 'secret-player-a': 50, 'secret-player-b': 10 }, winners: ['secret-player-a'], at: 2000 + index, scoreLabel: 'Punkte', lowWins: false })),
  ...options,
} });
function store() { const dir = mkdtempSync(join(tmpdir(), 'evening-reviews-')); return { dir, archive: createReviewStore({ dir, games: GAMES, now: () => 10000 }) }; }

test('Rückblick: echte Spielwertung, stabile Programm-ID und neuer Abend mit eigener ID', () => {
  const room = GAMES.maumau.create('SECRET', {}, () => {}); room.game = 'maumau';
  try {
    const ids = ['Anna', 'Ben'].map((name) => { const p = room.addPlayer(name, null); room.sit(p.id); return p.id; });
    configureProgram(room, ids[0], { mode: 'abend', entries: [{ game: 'maumau' }] });
    const first = room.partyProgram.id; room.partyProgram = beginProgram(room, ids[0]); assert.equal(room.partyProgram.id, first);
    room.result = { players: ids, winners: [ids[0]], points: { [ids[0]]: 0, [ids[1]]: 25 } };
    assert.equal(recordProgramResult(room), true); assert.equal(recordProgramResult(room), false);
    const r = summarizeReview(reviewFromRoom(room, GAMES));
    assert.equal(r.stations[0].lowWins, true); assert.equal(r.stations[0].values[1].raw, 25);
    assert.ok(r.startedAt > 0 && r.endedAt >= r.startedAt && r.stations[0].at > 0);
    assert.deepEqual(r.winners, ['Anna']); assert.deepEqual(r.standings.map((p) => p.points), [2, 1]);
    configureProgram(room, ids[0], { mode: 'abend', entries: [{ game: 'maumau' }] }); assert.notEqual(room.partyProgram.id, first);
  } finally { room.dispose(); }
});

test('Rückblick: Whitelist entfernt Tokens, Hände, Rollen, Verlauf, Raumcode und interne Spieler-IDs', () => {
  const { archive, dir } = store(), room = fixture();
  room.code = 'SECRET-CODE'; room.token = 'SECRET-TOKEN'; room.log = ['SECRET-LOG'];
  room.partyProgram.saved = { maumau: { custom: 'SECRET-CUSTOM', cards: ['SECRET-CARD'], role: 'SECRET-ROLE' } };
  room.partyProgram.roster[0].token = 'SECRET-PLAYER-TOKEN'; room.partyProgram.results[0].secret = 'SECRET-RESULT';
  archive.capture(room);
  for (const payload of [JSON.stringify(archive.get(room.partyProgram.id)), readFileSync(join(dir, 'evening-reviews.json'), 'utf8')]) {
    assert.ok(!payload.includes('SECRET')); assert.ok(!payload.includes('secret-player')); assert.ok(!payload.includes('999999'));
  }
  assert.deepEqual(archive.get(room.partyProgram.id).players.map((p) => p.key), ['p0', 'p1']);
});

test('Rückblick: automatische Aktualisierung statt Duplikaten, dauerhaft nach Tischende und Neustart', () => {
  const { archive, dir } = store(), room = fixture(); const id = room.partyProgram.id;
  assert.equal(archive.capture(room), id); archive.capture(room); assert.equal(archive.list().total, 1);
  room.unlisted = true; archive.capture(room);
  const restored = createReviewStore({ dir, games: GAMES }); assert.equal(restored.list({ known: [id] }).total, 1); assert.equal(restored.get(id).private, true);
  assert.equal(existsSync(join(dir, 'evening-reviews.json.tmp')), false);
  room.partyProgram.id = randomUUID(); room.unlisted = false; archive.capture(room); assert.equal(archive.list({ known: [id] }).total, 2);
});

test('Rückblick: private Abende nur über bekannte UUID oder direkten Link; Suche verrät sie nicht', () => {
  const { archive } = store(), room = fixture(); room.unlisted = true; archive.capture(room); const id = room.partyProgram.id;
  assert.equal(archive.list().total, 0); assert.equal(archive.list({ query: 'Anna' }).total, 0);
  assert.equal(archive.list({ known: ['SECRET-CODE'] }).total, 0); assert.equal(archive.list({ known: [id] }).total, 1);
  assert.equal(archive.get(id).private, true);
  room.unlisted = false; archive.capture(room); assert.equal(archive.list().total, 1);
});

test('Rückblick: ein älterer Raum-Snapshot nach Absturz überschreibt keinen archivierten Abschluss', () => {
  const { archive, dir } = store(), room = fixture([[2, 1], [1, 2]]); room.unlisted = true; archive.capture(room);
  room.partyProgram.results.pop(); room.partyProgram.status = 'between'; room.unlisted = false;
  const restored = createReviewStore({ dir, games: GAMES }); restored.capture(room);
  const r = restored.get(room.partyProgram.id); assert.equal(r.status, 'done'); assert.equal(r.stations.length, 2); assert.equal(r.private, true);
  assert.deepEqual(r.winners, ['Anna', 'Ben']);
  room.partyProgram.results.push({ ...room.partyProgram.results[0], index: 1 }); room.partyProgram.status = 'done';
  restored.capture(room, { restoring: true });
  assert.equal(restored.get(r.id).private, true); assert.deepEqual(restored.get(r.id).winners, ['Anna', 'Ben'], 'ein wiederholter Abschluss schreibt das Original nicht um');
});

test('Rückblick: Zwischenstand ohne Sieger, Abbruch behält ausschließlich fertige Stationen', () => {
  const { archive } = store(), room = fixture([[2, 1]], { status: 'between', plan: [{ game: 'viergewinnt' }, { game: 'poker' }], endedAt: null });
  archive.capture(room); assert.equal(archive.list().total, 0); assert.deepEqual(archive.get(room.partyProgram.id).winners, []);
  room.partyProgram.status = 'stopped'; room.partyProgram.endedAt = 8000; archive.capture(room);
  const r = archive.get(room.partyProgram.id); assert.equal(archive.list().total, 1); assert.equal(r.stations.length, 1); assert.equal(r.planned, 2); assert.deepEqual(r.winners, []);
  assert.equal(archive.capture({ partyProgram: { results: [] } }), null);
});

test('Rückblick: Führung, Aufholjagd, knapper Sieg und Punkteverlauf stammen aus Einzelwertungen', () => {
  const r = summarizeReview(reviewFromRoom(fixture([[1, 3], [3, 1], [3, 2]]), GAMES));
  assert.deepEqual(r.standings.map((p) => p.points), [7, 6]);
  assert.deepEqual(r.timeline.map((t) => t.scores.p0), [0, 1, 4, 7]);
  assert.deepEqual(r.moments.find((m) => m.kind === 'opening').players, ['p1']);
  assert.equal(r.moments.find((m) => m.kind === 'close').gap, 1);
  assert.equal(r.moments.find((m) => m.kind === 'comeback').gap, 2);
  const change = summarizeReview(reviewFromRoom(fixture([[1, 3], [3, 0]]), GAMES));
  assert.deepEqual(change.moments.find((m) => m.kind === 'lead'), { kind: 'lead', station: 2, players: ['p0'] });
});

test('Rückblick: geteilte Siege, korrekte Plätze und Teamwertung', () => {
  const r = summarizeReview(reviewFromRoom(fixture([[2, 1], [1, 2]]), GAMES));
  assert.deepEqual(r.winners, ['Anna', 'Ben']); assert.deepEqual(r.standings.map((p) => p.place), [1, 1]); assert.ok(r.moments.some((m) => m.kind === 'tie'));
  const team = fixture([[2, 1], [1, 2]], { config: { name: 'Teams', mode: 'team' } });
  const t = summarizeReview(reviewFromRoom(team, GAMES)); assert.deepEqual(t.teams.map((p) => p.points), [3, 3]); assert.deepEqual(t.winners, ['Team 1', 'Team 2']);
  assert.ok(t.moments.every((m) => m.kind === 'tie'));
});

test('Rückblick: Altbestände erhalten dieselbe ID nach erneutem Laden, unbekannte Zeiten bleiben unbekannt', () => {
  const room = fixture(); const p = room.partyProgram;
  p.config.entries = p.plan; p.saved = {}; p.index = 0; delete p.id; delete p.startedAt; delete p.endedAt; delete p.results[0].at;
  const a = restoreProgram(p), b = restoreProgram(p); assert.ok(a); assert.equal(a.id, b.id);
  const r = reviewFromRoom({ partyProgram: a }, GAMES); assert.equal(r.startedAt, null); assert.equal(r.endedAt, null); assert.equal(r.stations[0].at, null);
});

test('Rückblick: beschädigtes Archiv wird nicht überschrieben, unbekannte IDs liefern 404', () => {
  const { dir, archive } = store(); assert.throws(() => archive.get('../rooms.json'), { status: 404 }); assert.throws(() => archive.get(randomUUID()), { status: 404 });
  const path = join(dir, 'evening-reviews.json'); writeFileSync(path, '{broken');
  assert.throws(() => createReviewStore({ dir, games: GAMES })); assert.equal(readFileSync(path, 'utf8'), '{broken');
});

test('Rückblick: Aufbewahrung, Suchfilter und Pagination sind begrenzt', () => {
  const { dir } = store(); const rows = Array.from({ length: MAX_REVIEWS }, (_, i) => reviewFromRoom(fixture([[2, 1]], { config: { name: `Abend ${i}`, mode: 'abend' } }), GAMES, i + 1));
  writeFileSync(join(dir, 'evening-reviews.json'), JSON.stringify({ version: 1, evenings: rows }));
  const archive = createReviewStore({ dir, games: GAMES, now: () => 10000 }), newest = fixture(); archive.capture(newest);
  assert.equal(archive.list().total, MAX_REVIEWS); assert.equal(archive.list().items[0].id, newest.partyProgram.id);
  assert.throws(() => archive.get(rows[0].id), { status: 404 }); assert.equal(archive.list().items.length, 20);
  assert.equal(archive.list({ page: 999 }).page, 25); assert.equal(archive.list({ page: -2 }).page, 1); assert.equal(archive.list({ query: 'ANNA' }).total, 500);
  assert.equal(archive.list({ query: 'Freitag' }).total, 1); assert.equal(archive.list({ query: 'NICHTVORHANDEN' }).total, 0);
});

test('Rückblick: Markdown-Export ist lesbar und maskiert Namen statt HTML oder Markdown auszuführen', () => {
  const room = fixture(); room.partyProgram.config.name = '<script>alert(1)</script>'; room.partyProgram.roster[0].name = 'A|B **Hi**';
  const text = reviewMarkdown(summarizeReview(reviewFromRoom(room, GAMES)));
  assert.ok(text.includes('Gesamtwertung')); assert.ok(text.includes('Abendpunkte')); assert.ok(text.includes('Vier gewinnt'));
  assert.ok(!text.includes('<script>')); assert.ok(!text.includes('secret-player')); assert.ok(text.includes('A\\|B'));
});
