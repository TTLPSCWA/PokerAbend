import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROADMAP, resolvedRoadmap } from '../games/roadmap.js';
import { PLANNED } from '../games/planned.js';

test('Roadmap: gültige Stufen und Arten, eindeutige IDs und Abschlussdaten', () => {
  const stages = ['jetzt', 'naechstes', 'danach', 'spaeter', 'gross', 'erledigt'];
  const arts = ['spiel', 'funktion', 'design', 'discord', 'betrieb', 'fehler'];
  const list = resolvedRoadmap();
  assert.equal(new Set(list.map((e) => e.id)).size, list.length);
  const points = list.flatMap((e) => e.punkte);
  assert.equal(new Set(points.map((p) => p.id)).size, points.length);
  for (const e of list) {
    assert.ok(stages.includes(e.stufe) && e.titel && e.satz, e.id);
    if (e.stufe === 'erledigt') { assert.match(e.datum, /^\d{4}-\d{2}-\d{2}$/); assert.ok(e.punkte.every((p) => p.erledigt)); }
    for (const p of e.punkte) { assert.ok(p.id && p.titel && p.text && arts.includes(p.art), p.id); if (p.art === 'spiel') assert.match(p.spiel.art, /^<svg/); }
  }
  assert.equal(ROADMAP.filter((e) => e.stufe === 'jetzt').length, 1);
});

test('Jeder Backlog-Eintrag kommt genau einmal vor, mit automatisch übernommenen Informationen', () => {
  const points = resolvedRoadmap().flatMap((e) => e.punkte);
  for (const planned of PLANNED) {
    const matches = points.filter((p) => p.plannedId === planned.id);
    assert.equal(matches.length, 1, planned.id);
    assert.equal(matches[0].titel, planned.name);
    assert.equal(matches[0].text, planned.beschreibung || planned.description);
  }
  for (const [pkg, target] of [['spaeter', 'spaetere-spiele'], ['gross', 'grosse-projekte'], ['unbekannt', 'spaetere-spiele']]) {
    const added = { id: 'zukunft', name: 'Neue Idee', type: 'feature', paeckchen: pkg, beschreibung: 'Ein automatisch zugeordneter Backlog-Eintrag.' };
    const resolved = resolvedRoadmap([...PLANNED, added]);
    assert.equal(resolved.find((e) => e.id === target).punkte.filter((p) => p.id === 'zukunft').length, 1);
  }
  assert.ok(!points.some((p) => p.titel === 'Stille Post Deluxe'));
  const extras = resolvedRoadmap().find((e) => e.id === 'poker-extras').punkte;
  assert.ok(extras.find((p) => p.id === 'pre-actions').erledigt);
  assert.ok(extras.find((p) => p.id === 'turnier-blinds').erledigt);
  assert.ok(!extras.find((p) => p.id === 'time-bank').erledigt);
});
