import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { configureProgram, normalizeProgram, beginProgram, nextProgramStep, recordProgramResult, publicProgram, restoreProgram, programGames, programDefaults } from '../server/party-program.js';

function setup(count = 4) {
  const room = GAMES.schaetzmeister.create('PROGX', {}, () => {}); room.game = 'schaetzmeister';
  const ids = Array.from({ length: count }, (_, i) => { const p = room.addPlayer(['Anna', 'Ben', 'Cara', 'David'][i], null); p.connected = true; room.sit(p.id); return p.id; });
  return { room, ids, host: ids[0] };
}
const config = (mode = 'playlist') => ({ mode, name: 'Unser Abend', entries: [{ game: 'schaetzmeister', settings: { rounds: 1, writeSecs: 10 } }, { game: 'zahlenzoo', settings: { rounds: 2 } }] });

test('Programme prüfen Modi, Grenzen, Spiele und Regeln statt beliebige Daten zu übernehmen', () => {
  for (const bad of [null, {}, { ...config(), mode: 'constructor' }, { ...config(), entries: [] }, { ...config(), entries: Array(13).fill(config().entries[0]) }, { ...config(), entries: [{ game: 'poker' }] }, { ...config(), entries: [{ game: 'schaetzmeister', settings: { rounds: 100 } }] }, { ...config(), entries: [{ game: 'schaetzmeister', settings: { spectators: 'ja' } }] }]) assert.throws(() => normalizeProgram(bad));
  for (const mode of ['mix', 'turnier', 'playlist', 'team']) assert.equal(normalizeProgram(config(mode)).mode, mode);
  const defaults = programDefaults();
  for (const g of programGames()) assert.ok(normalizeProgram({ mode: 'playlist', entries: [{ game: g.id, settings: defaults[g.id] }] }));
  assert.ok(!programGames(true).some((g) => ['werwolf', 'wer-bin-ich'].includes(g.id)));
  const clean = normalizeProgram({ ...config(), name: '\u0000 Test', entries: [{ game: 'zahlenzoo', settings: { rounds: 2, fremd: 'geheim' } }] });
  assert.equal(clean.name, 'Test'); assert.equal(clean.entries[0].settings.fremd, undefined);
});

test('Start ist Host-Sache, braucht passende Plätze und lässt bei Fehlern den Raum unverändert', () => {
  const { room, ids, host } = setup(2);
  assert.throws(() => configureProgram(room, ids[1], config()), /Host/);
  configureProgram(room, host, { ...config(), entries: [{ game: 'werwolf' }] });
  assert.throws(() => beginProgram(room, host), /Mitspieler/);
  assert.equal(room.partyProgram.status, 'ready'); assert.equal(room.phase, 'lobby');
  configureProgram(room, host, config('mix'));
  const started = beginProgram(room, host);
  assert.equal(started.plan.length, 2);
  assert.deepEqual(started.plan.map((e) => e.game).sort(), config().entries.map((e) => e.game).sort());
  assert.equal(room.partyProgram.status, 'ready', 'Vorbereitung ist transaktional');
  room.dispose();
});

test('Platzierungspunkte, Gleichstände, Zuschauer und doppelte Ergebnis-Meldungen', () => {
  const { room, ids, host } = setup();
  const spectator = room.addPlayer('Zoe', null);
  configureProgram(room, host, config('turnier')); room.partyProgram = beginProgram(room, host);
  room.result = { players: [...ids, spectator.id], winners: [ids[0], ids[1]], points: { [ids[0]]: 1000, [ids[1]]: 1000, [ids[2]]: 50, [ids[3]]: 0, [spectator.id]: 9000 } };
  assert.equal(recordProgramResult(room), true);
  assert.deepEqual(room.partyProgram.scores, { [ids[0]]: 4, [ids[1]]: 4, [ids[2]]: 2, [ids[3]]: 1 });
  assert.equal(recordProgramResult(room), false);
  assert.equal(room.partyProgram.status, 'between');
  const next = nextProgramStep(room, host); assert.equal(next.index, 1);
  room.game = 'zahlenzoo'; room.partyProgram = next;
  room.result = { players: ids, winners: [ids[2]], points: { [ids[0]]: 0, [ids[1]]: 20, [ids[2]]: 40, [ids[3]]: 10 } };
  recordProgramResult(room);
  const shown = publicProgram(room);
  assert.equal(shown.status, 'done'); assert.deepEqual(shown.winners, ['Ben']);
  assert.equal(shown.standings.find((p) => p.name === 'Ben').points, 7);
  assert.throws(() => nextProgramStep(room, host), /Programm/);
  room.dispose();
});

test('Team-Duell: feste Zuordnung, zwei Teams und gemeinsame Gesamtwertung', () => {
  const { room, ids, host } = setup();
  configureProgram(room, host, config('team')); assert.throws(() => beginProgram(room, host), /Team/);
  const teams = Object.fromEntries(ids.map((id, i) => [id, i % 2 ? 'b' : 'a']));
  configureProgram(room, host, { ...config('team'), teams, entries: [{ game: 'schaetzmeister' }] });
  room.partyProgram = beginProgram(room, host);
  room.result = { players: ids, winners: [ids[0]], points: Object.fromEntries(ids.map((id, i) => [id, 100 - i])) };
  recordProgramResult(room);
  const shown = publicProgram(room);
  assert.deepEqual(shown.teams.map((t) => t.points), [6, 4]); assert.deepEqual(shown.winners, ['Team 1']);
  assert.throws(() => normalizeProgram({ ...config('team'), entries: [{ game: 'werwolf' }] }), /eignet/);
  room.dispose();
});

test('Abbruch und Neustart wiederholen nur die noch nicht gewertete Partie; private Inhalte bleiben privat', () => {
  const { room, ids, host } = setup();
  configureProgram(room, host, config()); room.partyProgram = beginProgram(room, host);
  room.partyProgram.saved = { schaetzmeister: { extra: { custom: ['GEHEIME FRAGE | 987654321'] } } };
  assert.equal(recordProgramResult(room), false);
  const retry = nextProgramStep(room, host); assert.equal(retry.index, 0); assert.deepEqual(retry.results, []);
  const restored = restoreProgram(JSON.parse(JSON.stringify(room.partyProgram)));
  assert.equal(restored.status, 'running'); assert.deepEqual(restored.roster.map((p) => p.id), ids);
  room.partyProgram = restored;
  assert.ok(!JSON.stringify(publicProgram(room)).includes('987654321'));
  assert.equal(restoreProgram({ config: {} }), null);
  room.dispose();
});
