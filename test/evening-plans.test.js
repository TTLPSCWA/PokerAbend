import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { GAMES } from '../games/index.js';
import { createPlanStore } from '../server/evening-plans.js';

const a = { id: 'a'.repeat(32), name: 'Anna', avatar: '🦉' }, b = { id: 'b'.repeat(32), name: 'Ben', avatar: '🐻' };
const time = Date.UTC(2026, 9, 30, 12), games = Object.values(GAMES);
const payload = () => ({ title: 'Unser Spieleabend', description: 'Am Wochenende spielen wir zusammen.', slots: [time + 86400000, time + 2 * 86400000], games: ['maumau', 'poker'] });
function setup(extra = {}) { const dir = mkdtempSync(join(tmpdir(), 'evening-plans-')); return { dir, store: createPlanStore({ dir, games, now: () => time, ...extra }) }; }
const status = (n) => (e) => e.status === n;
const ballot = (p, answers, selected = ['maumau'], revision = 0) => ({ answers: Object.fromEntries(Object.entries(answers).map(([i, answer]) => [p.slots[i].id, answer])), games: selected, voteRevision: revision });

test('Planung: Termine, Grenzen und verfügbare Spiele validieren; ausschließlich erlaubte Felder übernehmen', () => {
  const { store } = setup(), good = payload();
  for (const bad of [null, [], {}, { ...good, title: 'ab' }, { ...good, title: 'a'.repeat(81) }, { ...good, description: 'x'.repeat(1001) }, { ...good, slots: [] }, { ...good, slots: [time] }, { ...good, slots: [time + 367 * 86400000] }, { ...good, slots: [time + .5] }, { ...good, slots: [good.slots[0], good.slots[0]] }, { ...good, slots: Array.from({ length: 9 }, (_, i) => time + i + 1) }, { ...good, games: ['maumau', 'maumau'] }, { ...good, games: ['__proto__'] }, { ...good, private: 'true' }]) assert.throws(() => store.create(bad, a), status(400));
  assert.throws(() => store.create(good, { ...a, name: '' }), status(400));
  const p = store.create({ ...good, title: '\0Abend <b>Hi</b>', slots: [...good.slots].reverse(), status: 'fixed', owner: b, ballots: [b] }, a);
  assert.equal(p.title, 'Abend <b>Hi</b>'); assert.equal(p.status, 'open'); assert.equal(p.owner.name, 'Anna'); assert.equal(p.participants, 0);
  assert.deepEqual(p.slots.map((s) => s.at), good.slots); assert.equal(p.selected, null); assert.ok(p.canManage);
  assert.equal(store.create({ ...good, games: [] }, a).games.length, 0);
});

test('Zusagen: Ja, Vielleicht, Nein und unbeantwortet bleiben getrennt; je Browser nur eine Stimme', () => {
  const { store } = setup(); let p = store.create(payload(), a);
  p = store.vote(p.id, ballot(p, { 0: 'yes', 1: 'maybe' }), a);
  p = store.vote(p.id, ballot(p, { 0: 'no' }, ['poker']), b);
  assert.equal(p.participants, 2); assert.deepEqual(p.slots.map(({ yes, maybe, no }) => [yes, maybe, no]), [[1, 0, 1], [0, 1, 0]]);
  assert.equal(p.games.find((g) => g.id === 'maumau').votes, 1); assert.equal(p.games.find((g) => g.id === 'poker').votes, 1);
  p = store.vote(p.id, ballot(p, {}, [], 1), { ...a, name: 'Anderer Name' });
  assert.equal(p.participants, 2); assert.equal(p.slots[0].yes, 0); assert.equal(p.people.filter((v) => v.mine).length, 1);
  assert.equal(p.people.find((v) => v.mine).name, 'Anderer Name');
});

test('Stimmen: ungültige Optionen und veraltete eigene Tabs werden ohne Datenverlust abgewiesen', () => {
  const { store } = setup(); const p = store.create(payload(), a);
  for (const bad of [{ answers: { unknown: 'yes' }, games: [], voteRevision: 0 }, ballot(p, { 0: 'ja' }), ballot(p, {}, ['viergewinnt']), ballot(p, {}, ['maumau', 'maumau']), { answers: [], games: [], voteRevision: 0 }]) assert.throws(() => store.vote(p.id, bad, a), status(400));
  store.vote(p.id, ballot(p, { 0: 'yes' }), a);
  assert.throws(() => store.vote(p.id, ballot(p, { 0: 'no' }), a), status(409));
  assert.equal(store.detail(p.id, a).mine.answers[p.slots[0].id], 'yes');
  store.vote(p.id, ballot(p, { 0: 'no' }), b); assert.equal(store.detail(p.id, a).mine.revision, 1, 'andere Teilnehmer blockieren die eigene Stimmabgabe nicht');
});

test('Spielvorschläge: verfügbare Spiele ergänzen, doppelte Vorschläge und fremde Felder abweisen', () => {
  const { store } = setup(); let p = store.create(payload(), a);
  p = store.propose(p.id, 'viergewinnt', b); assert.equal(p.games.length, 3); assert.equal(p.games.find((g) => g.id === 'viergewinnt').votes, 0);
  assert.throws(() => store.propose(p.id, 'viergewinnt', a), status(409)); assert.throws(() => store.propose(p.id, 'unknown', a), status(400));
});

test('Festlegung: nur der Ersteller, aktuelle Revision, vorgeschlagene Auswahl und gemeinsame Spielerzahl', () => {
  const { store } = setup(); let p = store.create({ ...payload(), games: ['viergewinnt', 'werwolf', 'maumau'] }, a);
  const fix = { revision: p.revision, action: 'fix', slot: p.slots[0].id, games: ['maumau'] };
  assert.throws(() => store.manage(p.id, fix, { ...b, name: 'Anna' }), status(403));
  for (const change of [{ revision: 0 }, { slot: randomUUID() }, { games: [] }, { games: ['poker'] }, { games: ['werwolf', 'viergewinnt'] }, { games: ['maumau', 'maumau'] }]) assert.throws(() => store.manage(p.id, { ...fix, ...change }, a), status(change.revision === 0 ? 409 : 400));
  store.vote(p.id, ballot(p, { 0: 'yes' }), b); assert.throws(() => store.manage(p.id, fix, a), status(409));
  p = store.detail(p.id, a); p = store.manage(p.id, { ...fix, revision: p.revision }, a);
  assert.equal(p.status, 'fixed'); assert.deepEqual(store.program(p.id).games, ['maumau']);
  assert.throws(() => store.vote(p.id, ballot(p, {}), b), status(409)); assert.throws(() => store.propose(p.id, 'poker', b), status(409));
});

test('Wieder öffnen, Absagen und Löschen bewahren Rechte, Stimmen und Status korrekt', () => {
  const { store } = setup(); let p = store.create(payload(), a); p = store.vote(p.id, ballot(p, { 0: 'yes' }), b);
  assert.throws(() => store.program(p.id), status(409));
  p = store.manage(p.id, { revision: p.revision, action: 'fix', slot: p.slots[0].id, games: ['poker', 'maumau'] }, a);
  assert.deepEqual(store.program(p.id).games, ['poker', 'maumau']);
  p = store.manage(p.id, { revision: p.revision, action: 'reopen' }, a); assert.equal(p.status, 'open'); assert.equal(p.selected, null); assert.equal(p.participants, 1);
  p = store.manage(p.id, { revision: p.revision, action: 'cancel' }, a); assert.equal(p.status, 'cancelled'); assert.throws(() => store.program(p.id), status(409));
  assert.throws(() => store.remove(p.id, p.revision, b), status(403)); assert.throws(() => store.remove(p.id, 0, a), status(409));
  store.remove(p.id, p.revision, a); assert.throws(() => store.detail(p.id, a), status(404));
});

test('Verstrichene Termine dürfen nicht nachträglich festgelegt werden', () => {
  let clock = time; const { store } = setup({ now: () => clock }); const p = store.create(payload(), a); clock += 4 * 86400000;
  assert.throws(() => store.manage(p.id, { revision: p.revision, action: 'fix', slot: p.slots[0].id, games: ['maumau'] }, a), status(400));
});

test('Private Planungen: Ersteller und bekannte Links sehen sie, allgemeine Suche und Zähler verraten nichts', () => {
  const { store } = setup(); const p = store.create({ ...payload(), private: true }, a);
  assert.equal(store.list({}, b).total, 0); assert.equal(store.list({ q: 'Spieleabend' }, b).total, 0); assert.equal(store.list({}, a).total, 1);
  assert.equal(store.list({ known: [p.id] }, b).total, 1); assert.equal(store.detail(p.id, b).canManage, false);
  store.vote(p.id, ballot(p, { 0: 'yes' }), b);
  for (const data of [store.detail(p.id, a), store.list({ known: [p.id] }, b)]) {
    const json = JSON.stringify(data) || ''; assert.ok(!json.includes(a.id)); assert.ok(!json.includes(b.id)); assert.ok(!json.includes('ballots')); assert.ok(!json.includes('by'));
  }
});

test('Neustart erhält Termine, Festlegung, Stimmen und Eigentum; beschädigte Dateien bleiben erhalten', () => {
  const { store, dir } = setup(); let p = store.create(payload(), a); p = store.vote(p.id, ballot(p, { 0: 'yes' }), b);
  p = store.manage(p.id, { revision: p.revision, action: 'fix', slot: p.slots[0].id, games: ['poker'] }, a);
  const restored = createPlanStore({ dir, games }); const loaded = restored.detail(p.id, b);
  assert.equal(loaded.status, 'fixed'); assert.equal(loaded.mine.answers[p.slots[0].id], 'yes'); assert.equal(restored.detail(p.id, a).canManage, true);
  const file = join(dir, 'evening-plans.json'); writeFileSync(file, '{broken'); assert.throws(() => createPlanStore({ dir, games }), /bleibt erhalten/); assert.equal(readFileSync(file, 'utf8'), '{broken');
});

test('Speicherfehler bestätigen keine Änderung und verändern den Stand nicht', () => {
  let fail = false; const { store, dir } = setup({ persist: (file, data) => { if (fail) throw new Error('Platte voll'); writeFileSync(file, JSON.stringify(data)); } });
  const p = store.create(payload(), a), before = readFileSync(join(dir, 'evening-plans.json'), 'utf8'); fail = true;
  assert.throws(() => store.vote(p.id, ballot(p, { 0: 'yes' }), b), /Platte voll/); assert.equal(store.detail(p.id, a).participants, 0);
  assert.throws(() => store.remove(p.id, p.revision, a), /Platte voll/); assert.equal(store.list({}, a).total, 1); assert.equal(readFileSync(join(dir, 'evening-plans.json'), 'utf8'), before);
});

test('Suche, Pagination und Obergrenze sind begrenzt; höchstens zwölf Spiele werden festgelegt', () => {
  const { store, dir } = setup(); const p = store.create({ ...payload(), games: games.slice(0, 30).map((g) => g.id) }, a);
  assert.throws(() => store.manage(p.id, { revision: p.revision, action: 'fix', slot: p.slots[0].id, games: p.games.slice(0, 13).map((g) => g.id) }, a), status(400));
  const original = JSON.parse(readFileSync(join(dir, 'evening-plans.json'), 'utf8')).plans[0];
  writeFileSync(join(dir, 'evening-plans.json'), JSON.stringify({ version: 1, plans: Array.from({ length: 300 }, (_, i) => ({ ...original, id: randomUUID(), title: 'Abend ' + i, updatedAt: time + i })) }));
  const full = createPlanStore({ dir, games, now: () => time });
  assert.equal(full.list({}, a).items.length, 20); assert.equal(full.list({ page: 999 }, a).page, 15); assert.equal(full.list({ page: -2 }, a).page, 1); assert.equal(full.list({ q: 'ABEND 299' }, a).total, 1);
  assert.throws(() => full.create(payload(), a), status(409));
});

test('Teilnehmer- und Vorschlagsgrenzen gelten auch nach dem Laden; zusätzliche gespeicherte Felder bleiben privat', () => {
  const { store, dir } = setup(); const p = store.create({ ...payload(), games: games.slice(0, 30).map((g) => g.id) }, a);
  const file = join(dir, 'evening-plans.json'), saved = JSON.parse(readFileSync(file, 'utf8'));
  saved.plans[0].ballots = Array.from({ length: 200 }, (_, i) => ({ person: { id: i.toString(16).padStart(32, '0'), name: 'Gast', avatar: '🦉' }, answers: {}, games: [], revision: 1 }));
  saved.plans[0].slots[0].token = 'PRIVATE-SLOT-TOKEN'; writeFileSync(file, JSON.stringify(saved));
  const restored = createPlanStore({ dir, games, now: () => time });
  assert.throws(() => restored.vote(p.id, ballot(p, {}), b), status(409));
  assert.throws(() => restored.propose(p.id, games[30].id, b), status(409));
  assert.ok(!JSON.stringify(restored.detail(p.id, a)).includes('PRIVATE-SLOT-TOKEN'));
});
