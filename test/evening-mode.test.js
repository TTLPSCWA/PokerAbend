import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { configureProgram, normalizeProgram, beginProgram, nextProgramStep, recordProgramResult, publicProgram, restoreProgram, programDefaults, programSeats } from '../server/party-program.js';

function table(game = 'maumau', n = 2, notify = () => {}) {
  const r = GAMES[game].create('ABEND', {}, notify); r.game = game;
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer('Spieler ' + i, null); if (r.table) r.sit(p.id, i); else r.sit(p.id); return p.id; });
  return { r, ids };
}
const config = (games) => ({ mode: 'abend', name: 'Bunter Abend', entries: games.map((game) => ({ game })) });

test('Abendprogramm: Varianten und Auswahloptionen bleiben erhalten; Spielergrenzen gelten je Variante', () => {
  const entries = [{ game: 'farbenchaos', variant: 'flip' }, { game: 'monopoly', variant: 'speed', settings: { theme: 'classic' } }];
  const normalized = normalizeProgram({ mode: 'abend', entries }); assert.equal(normalized.entries[0].variant, 'flip'); assert.equal(normalized.entries[1].settings.theme, 'classic');
  assert.throws(() => normalizeProgram({ mode: 'abend', entries: [{ game: 'monopoly', settings: { theme: 'falsch' } }] }));
  const { r, ids } = table('maumau', 5); configureProgram(r, ids[0], { mode: 'abend', entries: [{ game: 'monopoly', variant: 'junior' }] }); assert.throws(() => beginProgram(r, ids[0]), /Mitspieler/); r.dispose();
});

test('Abend-Modus: alle 46 Spiele und ihre gültigen Optionen sind auswählbar, Party-Modi bleiben auf Partyspiele begrenzt', () => {
  const defaults = programDefaults();
  for (const game of Object.values(GAMES)) {
    const normalized = normalizeProgram({ ...config([game.id]), entries: [{ game: game.id, settings: defaults[game.id] }] });
    assert.equal(normalized.entries[0].game, game.id);
    if (game.category !== 'party') assert.throws(() => normalizeProgram({ ...config([game.id]), mode: 'playlist' }));
  }
  assert.throws(() => normalizeProgram(config(['unbekannt'])));
  for (const settings of [{ smallBlind: 200, bigBlind: 100 }, { startStack: 100, bigBlind: 200 }, { startStack: 1000001 }, { turnTime: -1 }]) assert.throws(() => normalizeProgram({ ...config(['poker']), entries: [{ game: 'poker', settings }] }));
  const p = normalizeProgram({ ...config(['poker']), entries: [{ game: 'poker', settings: { autoNext: true, gifts: true, startStack: 2000 } }] });
  assert.deepEqual(p.entries[0].settings, { startStack: 2000 });
});

test('Abend-Modus: Planung von Karten-, Brett- und Pokertischen; feste Teilnehmer und Grenzen vor dem Start', () => {
  for (const game of ['maumau', 'poker', 'monopoly']) {
    const { r, ids } = table(game); configureProgram(r, ids[0], config(['poker', 'viergewinnt', 'maumau', 'zahlenzoo']));
    const p = beginProgram(r, ids[0]); assert.deepEqual(p.roster.map((x) => x.id), ids); assert.deepEqual(programSeats(r), ids);
    assert.ok(p.roster.every((person) => person.team === null));
    assert.throws(() => configureProgram(r, ids[1], config(['maumau'])), /Host/);
    configureProgram(r, ids[0], config(['werwolf', 'viergewinnt'])); assert.throws(() => beginProgram(r, ids[0]), /Mitspieler/); r.dispose();
  }
  const { r, ids } = table(); r.players.get(ids[1]).bot = true;
  configureProgram(r, ids[0], config(['malen-raten'])); assert.throws(() => beginProgram(r, ids[0]), /Mitspieler|menschliche/); r.dispose();
});

test('Abend-Modus: niedrige und hohe Punkteskalen, Gleichstände und Nullpunkte-Siege werden fair platziert', () => {
  for (const [game, raw] of [['maumau', [0, 40, 80]], ['monopoly', [1, 0, 0]], ['zahlenzoo', [9000, 50, 50]]]) {
    const { r, ids } = table(game, 3); configureProgram(r, ids[0], config([game])); r.partyProgram = beginProgram(r, ids[0]);
    const spectator = r.addPlayer('Zuschauer', null);
    r.result = { players: [...ids, spectator.id], winners: [ids[0]], points: { ...Object.fromEntries(ids.map((id, i) => [id, raw[i]])), [spectator.id]: 100000 } };
    assert.equal(recordProgramResult(r), true); assert.equal(recordProgramResult(r), false);
    const p = publicProgram(r); assert.equal(p.standings[0].points, 3); assert.equal(p.standings.length, 3);
    assert.equal(p.standings[1].points, game === 'maumau' ? 2 : p.standings[2].points); r.dispose();
  }
  const { r, ids } = table(); configureProgram(r, ids[0], config(['maumau'])); r.partyProgram = beginProgram(r, ids[0]);
  r.result = { players: ids, winners: [ids[1]], points: { [ids[0]]: 0, [ids[1]]: 0 } }; recordProgramResult(r);
  assert.equal(r.partyProgram.scores[ids[1]], 2); assert.equal(r.partyProgram.scores[ids[0]], 1); r.dispose();
});

test('Abend-Modus: Poker und Omaha zählen ausschließlich abgeschlossene Hände nach Chipgewinn und ohne private Karten', () => {
  for (const game of ['poker', 'omaha']) {
    let r;
    const setup = table(game, 2, (kind) => { if (kind === 'result') recordProgramResult(r); });
    r = setup.r; const ids = setup.ids;
    configureProgram(r, ids[0], config([game])); r.partyProgram = beginProgram(r, ids[0]);
    r.settings.autoNext = false; r.start(ids[0]);
    assert.equal(recordProgramResult(r), false);
    const cards = r.view(ids[0]).seats.find((s) => s?.id === ids[0]).cards;
    const seat = r.table.hand.toAct, folded = r.table.seats[seat].id, winner = ids.find((id) => id !== folded);
    r.act(folded, { type: 'fold' });
    assert.equal(r.partyProgram.status, 'done'); assert.equal(r.partyProgram.scores[winner], 2); assert.equal(r.partyProgram.scores[folded], 1);
    const shown = JSON.stringify(publicProgram(r)); assert.ok(cards.every((card) => !shown.includes('"' + card + '"')));
    const score = { ...r.partyProgram.scores }; r.afterChange(); assert.deepEqual(r.partyProgram.scores, score); r.dispose();
  }
});

test('Abend-Modus: unterbrochene Station wiederholen, fertige Wertungen und private Vorlagen beim Neustart trennen', () => {
  const { r, ids } = table(); configureProgram(r, ids[0], config(['maumau', 'poker'])); r.partyProgram = beginProgram(r, ids[0]);
  r.result = { players: ids, winners: [ids[0]], points: { [ids[0]]: 0, [ids[1]]: 10 } }; recordProgramResult(r);
  r.partyProgram.saved.maumau = { settings: {}, extra: { custom: ['GEHEIM'] } };
  r.partyProgram = restoreProgram(JSON.parse(JSON.stringify(r.partyProgram)));
  const next = nextProgramStep(r, ids[0]); assert.equal(next.index, 1); assert.equal(next.results.length, 1);
  assert.ok(!JSON.stringify(publicProgram(r)).includes('GEHEIM'));
  next.status = 'running'; r.partyProgram = next; r.result = null;
  const retry = nextProgramStep(r, ids[0]); assert.equal(retry.index, 1); assert.deepEqual(retry.scores, next.scores); r.dispose();
});

test('Abend-Modus: nach dem letzten Fold entfernter Pokerspieler behält seine Platzierung unter seiner ursprünglichen ID', () => {
  let r;
  const setup = table('poker', 2, (kind) => { if (kind === 'result') recordProgramResult(r); });
  r = setup.r; const ids = setup.ids;
  configureProgram(r, ids[0], config(['poker'])); r.partyProgram = beginProgram(r, ids[0]); r.settings.autoNext = false;
  r.start(ids[0]); const removed = r.table.seats[r.table.hand.toAct].id;
  r.remove(removed); r.afterChange(); r.afterChange();
  assert.equal(r.players.has(removed), false); assert.equal(r.partyProgram.results.length, 1);
  assert.equal(r.partyProgram.scores[removed], 1); assert.equal(r.partyProgram.scores[ids.find((id) => id !== removed)], 2); r.dispose();
});

test('Abend-Modus: gleicher Netto-Chipgewinn teilt beim Poker den Platz, unabhängig von einer Pot-Rückzahlung', () => {
  const { r, ids } = table('poker', 3); configureProgram(r, ids[0], config(['poker'])); r.partyProgram = beginProgram(r, ids[0]);
  // Gleiches finanzielles Ergebnis: ein Spieler bekommt lediglich seinen Einsatz zurück.
  r.handIds = Object.fromEntries(ids.map((id, i) => [i, id]));
  r.table.hand = { done: true, seats: [0, 1, 2], players: { 0: { total: 10 }, 1: { total: 0 }, 2: { total: 0 } }, result: { pots: [{ winners: [0], payouts: { 0: 10 } }] } };
  assert.equal(recordProgramResult(r), true); assert.deepEqual(Object.values(r.partyProgram.scores), [3, 3, 3]); r.dispose();
});
