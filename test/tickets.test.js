import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTicketStore } from '../server/tickets.js';

const a = { id: 'a'.repeat(32), name: 'Anna', avatar: '🦉' }, b = { id: 'b'.repeat(32), name: 'Ben', avatar: '🐻' };
const admin = { ...b, admin: true };
const payload = { title: 'Eine gute neue Idee', description: 'Hier steht eine ausführliche Beschreibung.\nMit einer zweiten Zeile.', type: 'idea', game: '' };
function setup(extra = {}) { const dir = mkdtempSync(join(tmpdir(), 'ticket-store-')); let time = 1793271600000; return { dir, store: createTicketStore({ dir, games: ['poker'], now: () => time++, ...extra }) }; }

test('Tickets: validierte Texte, feste IDs und neue Tickets haben immer Status Neu', () => {
  const { store } = setup();
  for (const data of [null, [], {}, { ...payload, title: 'abc' }, { ...payload, title: 'x'.repeat(101) }, { ...payload, description: 'zu kurz' }, { ...payload, description: 'x'.repeat(4001) }, { ...payload, type: '__proto__' }, { ...payload, game: 'gibt-es-nicht' }, { ...payload, game: false }]) assert.throws(() => store.create(data, a), (e) => e.status === 400);
  assert.throws(() => store.create(payload, { ...a, name: '' }), /Profil/);
  const row = store.create({ ...payload, title: '\u0000Eine <b>Idee</b>', status: 'done', author: b, voters: [b.id] }, a);
  assert.equal(row.id, 1); assert.equal(row.status, 'new'); assert.equal(row.author.name, 'Anna'); assert.equal(row.votes, 0);
  assert.equal(row.title, 'Eine <b>Idee</b>'); assert.ok(row.description.includes('\n'));
  assert.equal(store.create(payload, a).id, 2);
});

test('Stimmen: eine je Browser-Identität, wiederholtes Setzen zählt nicht doppelt, Zurücknehmen funktioniert', () => {
  const { store } = setup(); store.create(payload, a);
  const first = store.vote(1, true, a); assert.equal(first.votes, 1); assert.equal(first.voted, true);
  const repeated = store.vote(1, true, a); assert.equal(repeated.votes, 1); assert.equal(repeated.revision, first.revision);
  assert.equal(store.vote(1, true, b).votes, 2);
  assert.equal(store.vote(1, false, a).votes, 1); assert.equal(store.detail(1, a).voted, false);
  assert.equal(store.detail(1, b).voted, true);
  assert.throws(() => store.vote(1, 'true', a), (e) => e.status === 400);
  assert.ok(!JSON.stringify(store.list({}, a)).includes(a.id));
});

test('Eigentum und Verwaltung: gleicher Name genügt nicht; Status und Löschen bleiben Admin-Sache', () => {
  const { store } = setup(); store.create(payload, a);
  assert.throws(() => store.update(1, { revision: 1, title: 'Fremder Entwurf' }, { ...b, name: 'Anna' }), (e) => e.status === 403);
  assert.throws(() => store.update(1, { revision: 1, status: 'done' }, a), (e) => e.status === 403);
  const updated = store.update(1, { revision: 1, title: 'Meine verbesserte Idee', author: b, voters: [b.id], id: 100 }, a);
  assert.equal(updated.id, 1); assert.equal(updated.votes, 0); assert.equal(updated.author.name, 'Anna');
  const planned = store.update(1, { revision: updated.revision, status: 'planned' }, admin);
  assert.equal(planned.status, 'planned'); assert.deepEqual(planned.history.map((h) => [h.from, h.to, h.by]), [['new', 'planned', 'Ben']]);
  assert.throws(() => store.update(1, { revision: planned.revision, status: 'constructor' }, admin), (e) => e.status === 400);
  assert.throws(() => store.remove(1, a), (e) => e.status === 403);
  store.remove(1, admin); assert.throws(() => store.detail(1, a), (e) => e.status === 404);
  assert.equal(store.create(payload, a).id, 2, 'gelöschte IDs werden nicht erneut vergeben');
});

test('Kommentare bleiben Text, eigene Kommentare und Moderation sind getrennt', () => {
  const { store } = setup(); store.create(payload, a);
  const row = store.comment(1, '<script>window.TEST = 1</script>\nZweite Zeile', b);
  assert.equal(row.comments[0].text, '<script>window.TEST = 1</script>\nZweite Zeile');
  assert.equal(store.detail(1, a).comments[0].canDelete, false);
  assert.throws(() => store.removeComment(1, 1, a), (e) => e.status === 403);
  assert.throws(() => store.comment(1, '', a), (e) => e.status === 400);
  assert.throws(() => store.comment(1, 'x'.repeat(2001), a), (e) => e.status === 400);
  store.comment(1, 'Ein anderer Kommentar', a);
  const removed = store.removeComment(1, 1, b); assert.equal(removed.comments.length, 1); assert.equal(removed.comments[0].id, 2);
  store.removeComment(1, 2, admin); assert.equal(store.detail(1, a).commentCount, 0);
});

test('Konflikte und fehlgeschlagenes Speichern verändern weder Datei noch bestätigten Stand', () => {
  let fail = false;
  const { store, dir } = setup({ persist: (file, data) => { if (fail) throw new Error('Platte voll'); writeFileSync(file, JSON.stringify(data)); } });
  store.create(payload, a); store.comment(1, 'Ein neuer Kommentar', b);
  assert.throws(() => store.update(1, { revision: 1, title: 'Veraltete Änderung' }, a), (e) => e.status === 409);
  const before = readFileSync(join(dir, 'tickets.json'), 'utf8'); fail = true;
  assert.throws(() => store.comment(1, 'Dieser Text wird nicht bestätigt', a), /Platte voll/);
  assert.equal(store.detail(1, a).commentCount, 1); assert.equal(readFileSync(join(dir, 'tickets.json'), 'utf8'), before);
});

test('Neustart lädt Stimmen, Kommentare, Status und Berechtigungen; defekte Datei wird nie überschrieben', () => {
  const { store, dir } = setup(); store.create(payload, a); store.vote(1, true, b); store.comment(1, 'Bleibt nach Neustart', a);
  store.update(1, { revision: store.detail(1, admin).revision, status: 'progress' }, admin);
  const restored = createTicketStore({ dir, games: ['poker'] });
  const row = restored.detail(1, b); assert.equal(row.voted, true); assert.equal(row.status, 'progress'); assert.equal(row.comments.length, 1); assert.equal(row.canEdit, false);
  assert.ok(!JSON.stringify(row).includes(a.id)); assert.ok(!JSON.stringify(row).includes(b.id));
  writeFileSync(join(dir, 'tickets.json'), '{ kaputt');
  assert.throws(() => createTicketStore({ dir, games: ['poker'] }), /bleibt erhalten/);
  assert.equal(readFileSync(join(dir, 'tickets.json'), 'utf8'), '{ kaputt');
});

test('Filter, Suche, Sortierung und Pagination liefern deterministische Ausschnitte', () => {
  const { store } = setup();
  for (let i = 0; i < 25; i++) store.create({ ...payload, title: `Vorschlag Nummer ${i}`, type: i % 2 ? 'bug' : 'idea', game: i % 3 ? '' : 'poker' }, a);
  assert.equal(store.list({}, a).tickets.length, 20); assert.equal(store.list({ page: 2 }, a).tickets.length, 5);
  assert.equal(store.list({ page: 99 }, a).page, 2);
  assert.equal(store.list({ type: 'bug' }, a).total, 12);
  assert.equal(store.list({ game: 'poker' }, a).total, 9);
  assert.equal(store.list({ q: 'Nummer 24' }, a).tickets[0].id, 25);
  store.vote(1, true, b); assert.equal(store.list({ sort: 'votes' }, a).tickets[0].id, 1);
  const row = store.update(2, { revision: 1, status: 'done' }, admin);
  assert.equal(store.list({ status: 'done' }, a).tickets[0].id, row.id); assert.equal(store.list({}, a).counts.done, 1);
});

test('Markdown enthält Beschreibung, Kommentare und Verlauf, aber keine Identitäten oder aktives HTML', () => {
  const { store } = setup(); store.create({ ...payload, title: '[Link](javascript:alert(1))', description: '<script>evil()</script>\nEine Beschreibung' }, a);
  store.vote(1, true, b); store.comment(1, 'Kommentar mit <img onerror=evil()>', b); store.update(1, { revision: 3, status: 'done' }, admin);
  const md = store.markdown({}, 1);
  assert.match(md, /#1/); assert.ok(md.includes('Erledigt') && md.includes('Kommentare') && md.includes('Statusverlauf'));
  assert.ok(md.includes('Stimmen: 1') && md.includes('&lt;script&gt;'));
  assert.ok(!md.includes('<script>') && !md.includes(a.id) && !md.includes(b.id));
  assert.ok(!md.includes('[Link](javascript:'));
  assert.match(store.markdown({ status: 'new' }), /0 Ticket/);
});
