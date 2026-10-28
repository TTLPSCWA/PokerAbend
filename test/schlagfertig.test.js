// Schlagfertig: Aufgabenverteilung, Geheimhaltung, Abstimmen, Punkte (Stimmen × 100, Volltreffer +200), Finale, Anstupsen, Massentest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { NO_ANSWER } from '../games/party-room.js';

const SF = GAMES.schlagfertig;
const CATALOG = JSON.parse(readFileSync(new URL('../games/schlagfertig/aufgaben.json', import.meta.url), 'utf8'));
const BAD = /scheiß|arsch|fick|\bsex|nackt|\btot\b|töten|umbringen|mord|krieg|nazi|hitler|porno|\bblut|vergewalt|drogen|selbstmord/i;

function room(n = 3, settings = {}, names) {
  const events = [];
  const r = SF.create('SCHLAG', { rounds: 2, ...settings }, (kind, data) => { if (kind === 'nudge') events.push(data); });
  r.game = 'schlagfertig';
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer(names?.[i] || ['Anna', 'Ben', 'Cara', 'Dirk', 'Eva', 'Finn', 'Gina', 'Hans'][i], null); p.connected = true; r.sit(p.id); return p.id; });
  return { r, ids, events };
}
const writeAll = (r, ids, tag = 'T') => { for (const id of ids) for (const k of r.myTasks(id)) r.answer(id, k, `${tag} ${r.name(id)} ${k}`); };
const display = (r, id) => r.step().display.indexOf(id); // Position der Antwort von id in der aktuellen Abstimmung

test('Katalog: mindestens 150 harmlose Aufgaben, keine doppelten, jede mit Lücke', () => {
  assert.ok(CATALOG.length >= 150, `${CATALOG.length} Aufgaben`);
  assert.equal(new Set(CATALOG.map((c) => c.id)).size, CATALOG.length);
  assert.equal(new Set(CATALOG.map((c) => c.q)).size, CATALOG.length);
  for (const c of CATALOG) {
    assert.ok(c.q.includes('___') && c.q.length >= 15 && c.q.length <= 120, c.id);
    assert.ok(!BAD.test(c.q), `${c.id}: heikles Wort in „${c.q}“`);
  }
});

test('Jede Runde bekommt jeder 2 Aufgaben und jede Aufgabe geht an genau 2 Spieler (3 bis 8 Spieler)', () => {
  for (let n = 3; n <= 8; n++) {
    const { r, ids } = room(n, { rounds: 3 });
    r.start(ids[0]);
    assert.equal(r.cur.kind, 'duel');
    assert.equal(r.tasks.length, n);
    for (const t of r.tasks) { assert.equal(t.authors.length, 2); assert.notEqual(t.authors[0], t.authors[1]); }
    for (const id of ids) assert.equal(r.myTasks(id).length, 2, `${n} Spieler`);
    assert.equal(new Set(r.tasks.map((t) => t.q)).size, n, 'lauter verschiedene Aufgaben');
    assert.equal(r.picks.length, 3);
    assert.equal(r.picks[2].kind, 'final', 'die letzte Runde ist das Finale');
    assert.equal(r.picks[2].tasks.length, 1);
    r.dispose();
  }
});

test('Schreibphase: jeder sieht nur die eigenen Aufgaben und Antworten, nichts von den anderen', () => {
  const { r, ids: [a, b, c] } = room(3);
  const z = r.addPlayer('Zoe', null).id; // schaut zu
  r.start(a);
  const v = (id) => r.view(id);
  assert.equal(v(a).g.tasks.length, 2);
  assert.equal(v(z).g.tasks.length, 0);
  r.answer(a, 0, 'Streng geheim A0');
  r.answer(b, 0, 'Streng geheim B0');
  for (const id of [a, b, c, z]) {
    const json = JSON.stringify(v(id));
    if (id !== a) assert.ok(!json.includes('Streng geheim A0'), 'Antwort von Anna sichtbar');
    if (id !== b) assert.ok(!json.includes('Streng geheim B0'), 'Antwort von Ben sichtbar');
  }
  // Aufgaben, die man nicht hat, stehen nicht im Zustand
  const taskOf = (k) => r.tasks[k].q;
  assert.ok(!JSON.stringify(v(a).g).includes(taskOf(1)) || r.tasks[1].authors.includes(a));
  assert.ok(!JSON.stringify(v(z)).includes(taskOf(0)), 'Zuschauer sieht keine Aufgaben');
  assert.throws(() => r.answer(c, 0, 'nicht meine'), /gehört dir nicht/);
  assert.throws(() => r.answer(a, 0, '  \u0000 '), /schreib etwas/);
  r.dispose();
});

test('Abstimmen: Antworten ohne Namen, Autoren stimmen nicht mit ab, Stimmen erst in der Auflösung sichtbar', () => {
  const { r, ids: [a, b, c, d] } = room(4);
  r.start(a);
  writeAll(r, [a, b, c, d]);
  assert.equal(r.stage, 'vote');
  const s = r.step();
  assert.deepEqual([...s.display].sort(), [a, b].sort(), 'Aufgabe 0 gehört Anna und Ben');
  for (const id of [a, b, c, d]) {
    const g = r.view(id).g;
    assert.deepEqual(Object.keys(g.answers[0]).sort(), ['empty', 'i', 'mine', 'text'], 'keine Namen, keine IDs');
    assert.ok(!('votes' in g) && !('results' in g));
  }
  assert.equal(r.view(a).g.isAuthor, true);
  assert.equal(r.view(c).g.isAuthor, false);
  assert.equal(r.view(c).g.canVote, true);
  assert.equal(r.view(a).g.canVote, false);
  assert.deepEqual(r.view(a).g.answers.map((x) => x.mine).sort(), [false, true], 'eigene Antwort ist nur für einen selbst markiert');
  assert.deepEqual(r.view(c).g.answers.map((x) => x.mine), [false, false]);
  assert.throws(() => r.vote(a, 0), /Autoren/);
  assert.throws(() => r.vote(c, 2), /eine der beiden/);
  // Autoren gelten nicht als „fertig“ – die Anzeige verrät nicht, wer geschrieben hat
  assert.equal(r.view(c).players.find((p) => p.id === a).ready, false);
  r.vote(c, 1); r.vote(c, 0); // umentscheiden geht, solange nicht alle fertig sind
  assert.equal(r.view(c).g.myVote[0], 0);
  assert.equal(r.view(c).players.find((p) => p.id === c).ready, true);
  assert.equal(r.sub, 0, 'Dirk fehlt noch');
  assert.equal(r.view(d).g.myVote, null, 'fremde Stimmen sieht niemand');
  r.vote(d, 1);
  assert.equal(r.sub, 1, 'alle fertig → nächste Aufgabe');
  r.dispose();
});

test('Punkte: Stimmen × 100, Volltreffer (alle Stimmen, mindestens 2) +200, Zuschauer zählen für die Autoren', () => {
  const { r, ids: [a, b, c] } = room(3, { spectators: true });
  const z = r.addPlayer('Zoe', null).id;
  r.start(a);
  for (const [id, k] of [[a, 0], [a, 2], [b, 0], [b, 1], [c, 1], [c, 2]]) r.answer(id, k, `Text ${r.name(id)}${k}`);
  // Aufgabe 0 (Anna/Ben): Cara stimmt für Anna, Zoe auch → 2 von 2 Stimmen = Volltreffer
  assert.equal(r.step().task, 0);
  r.vote(z, display(r, a)); r.vote(c, display(r, a));
  // Aufgabe 1 (Ben/Cara): Anna stimmt für Ben, Zoe für Cara → je 1 Stimme, kein Volltreffer
  assert.equal(r.step().task, 1);
  r.vote(z, display(r, c)); r.vote(a, display(r, b));
  // Aufgabe 2 (Cara/Anna): Ben stimmt für Cara (1 Stimme, kein Volltreffer: nur eine Stimme insgesamt)
  assert.equal(r.step().task, 2);
  r.vote(b, display(r, c));
  assert.equal(r.stage, 'reveal');
  const [t0, t1, t2] = r.results;
  assert.deepEqual(t0.answers.map((x) => [x.id, x.votes, x.pts, x.fullHit]).sort(), [[a, 2, 400, true], [b, 0, 0, false]].sort());
  assert.deepEqual(t1.answers.map((x) => [x.id, x.pts]).sort(), [[b, 100], [c, 100]].sort());
  assert.ok(t1.answers.every((x) => !x.fullHit));
  assert.deepEqual(t2.answers.map((x) => [x.id, x.pts, x.fullHit]).sort(), [[a, 0, false], [c, 100, false]].sort(), 'eine einzelne Stimme ist kein Volltreffer');
  assert.equal(r.gamePts[a], 400);
  assert.equal(r.gamePts[b], 100);
  assert.equal(r.gamePts[c], 200);
  assert.equal(r.gamePts[z], undefined, 'Zuschauer bekommen keine Punkte');
  // In der Auflösung stehen Namen und Wähler
  const view = r.view(c).g;
  assert.deepEqual(view.results[0].answers.find((x) => x.id === a).voters.sort(), [c, z].sort());
  r.dispose();
});

test('Finale: eine Aufgabe für alle, bis zu 3 Stimmen auf verschiedene fremde Antworten, 100 je Stimme ohne Bonus', () => {
  const { r, ids } = room(5, { rounds: 1 });
  const [a, b, c, d, e] = ids;
  r.start(a);
  assert.equal(r.cur.kind, 'final');
  assert.equal(r.tasks.length, 1);
  assert.equal(r.tasks[0].authors.length, 5);
  for (const id of ids) assert.equal(r.view(id).g.tasks.length, 1);
  for (const id of ids) r.answer(id, 0, `Final ${r.name(id)}`);
  assert.equal(r.stage, 'vote');
  const g = r.view(a).g;
  assert.equal(g.final, true);
  assert.equal(g.answers.length, 5);
  assert.equal(g.maxPicks, 3);
  const pos = (id) => r.step().display.indexOf(id);
  assert.throws(() => r.vote(a, [pos(a)]), /bis zu 3 fremde/, 'nicht für die eigene Antwort');
  assert.throws(() => r.vote(a, [pos(b), pos(c), pos(d), pos(e)]), /bis zu 3/);
  assert.throws(() => r.vote(a, []), /bis zu 3/);
  r.vote(a, [pos(b), pos(c), pos(d)]);
  r.vote(b, [pos(a), pos(c), pos(c)]); // doppelte Wahl zählt einmal
  r.vote(c, [pos(a)]);
  r.vote(d, [pos(a), pos(b), pos(c)]);
  r.vote(e, [pos(a), pos(b)]);
  assert.equal(r.stage, 'reveal');
  const pts = Object.fromEntries(r.results[0].answers.map((x) => [x.id, x.pts]));
  assert.deepEqual(pts, { [a]: 400, [b]: 300, [c]: 300, [d]: 100, [e]: 0 }, 'Stimmen × 100');
  assert.ok(r.results[0].answers.every((x) => !x.fullHit), 'im Finale kein Volltreffer-Bonus');
  r.dispose();
});

test('Zeit abgelaufen: leere Antworten stehen als „(keine Antwort)“ zur Wahl, beide leer = keine Abstimmung', () => {
  const { r, ids: [a, b, c] } = room(3);
  r.start(a);
  r.answer(a, 0, 'Nur eine Antwort');
  r.next(a); // Host beendet die Schreibphase: alles andere bleibt leer
  assert.equal(r.stage, 'vote', 'Aufgabe 0 hat eine Antwort');
  assert.equal(r.steps.length, 1, 'die anderen Aufgaben sind komplett leer');
  const texts = r.view(c).g.answers.map((x) => x.text).sort();
  assert.deepEqual(texts, [NO_ANSWER, 'Nur eine Antwort'].sort());
  r.next(a); // Abstimmen beenden → Auflösung
  assert.equal(r.stage, 'reveal');
  assert.equal(r.gamePts[a], 0);
  // Gar nichts geschrieben: direkt zur Auflösung
  r.next(a);
  r.next(a);
  assert.equal(r.stage, 'reveal', 'Finale ohne Antworten: kein Abstimmen');
  assert.equal(r.view(a).g.results.length, 0);
  r.dispose();
});

test('Anstupsen: nur wer fertig ist, höchstens alle 10 s, mit Spruch; Autoren in der Abstimmung bleiben unverraten; abschaltbar', () => {
  const { r, ids: [a, b, c], events } = room(3);
  r.start(a);
  assert.throws(() => r.nudge(a, b), /selbst fertig/);
  r.answer(a, 0, 'x1'); r.answer(a, 2, 'x2');
  r.nudge(a, b);
  assert.equal(events.length, 1);
  assert.equal(events[0].to, b);
  assert.equal(events[0].from, 'Anna');
  assert.ok(events[0].text.length > 3 && !/Karten/.test(events[0].text));
  assert.throws(() => r.nudge(a, c), /höchstens alle 10 Sekunden/);
  assert.throws(() => r.nudge(a, a), /geht nicht/);
  // Automatisches Anstupsen: nur Trödler, die online sind
  events.length = 0;
  r.players.get(b).nudgedAt = 0;
  r.players.get(c).connected = false;
  r.autoNudge();
  assert.deepEqual(events.map((x) => x.to), [b], 'Ben ist online und fehlt noch, Cara ist offline');
  assert.equal(events[0].from, null);
  r.settings.nudge = false;
  assert.throws(() => r.nudge(a, b), /aus/);
  r.dispose();
  // Abstimmung: ein Autor als Ziel – es geht nichts raus, und es gibt keine Fehlermeldung, die ihn verrät
  const g = room(4);
  const [p0, p1, p2, p3] = g.ids;
  g.r.start(p0);
  writeAll(g.r, g.ids);
  assert.equal(g.r.stage, 'vote');
  assert.deepEqual([...g.r.step().display].sort(), [p0, p1].sort());
  g.r.vote(p2, 0); // Cara ist fertig, Dirk fehlt noch
  g.events.length = 0;
  g.r.nudge(p2, p0); // Anna ist Autorin dieser Aufgabe
  assert.equal(g.events.length, 0, 'nichts gesendet');
  g.r.nudge(p2, p3); // Dirk trödelt wirklich
  assert.deepEqual(g.events.map((x) => x.to), [p3]);
  g.r.dispose();
});

test('Texteingabe: höchstens 120 Zeichen, Steuerzeichen raus, HTML bleibt Text', () => {
  const { r, ids: [a] } = room(3);
  r.start(a);
  r.answer(a, 0, '<img src=x onerror=alert(1)>' + 'x'.repeat(300) + '\n‮');
  assert.equal(r.tasks[0].answers[a].length, 120);
  assert.ok(r.tasks[0].answers[a].startsWith('<img src=x onerror=alert(1)>'));
  assert.ok(!/[\u0000-\u001f‮]/.test(r.tasks[0].answers[a]));
  r.dispose();
});

test('Eigene Aufgaben: kommen zuerst dran, nur für diesen Raum, Format frei', () => {
  const { r, ids: [a] } = room(3, { rounds: 1 });
  r.setCustom(a, 'Der beste Name für unser Sofa: ___\nzu kurz');
  assert.equal(r.custom.length, 1);
  r.start(a);
  assert.equal(r.tasks[0].q, 'Der beste Name für unser Sofa: ___');
  r.dispose();
});

test('Zeit pro Stufe: Schreiben und Abstimmen laufen über die Uhr weiter', async () => {
  const { r, ids: [a, b, c] } = room(3, { rounds: 1 });
  r.settings.writeSecs = 0.15; r.settings.voteSecs = 0.15; r.revealTime = () => 0.15;
  r.start(a);
  r.afterChange();
  for (const id of [a, b, c]) r.answer(id, 0, 'Antwort ' + r.name(id)); // Finale: eine Aufgabe, alle fertig → Abstimmen
  assert.equal(r.stage, 'vote');
  const deadline = Date.now() + 3000;
  r.afterChange();
  while (r.phase === 'playing' && Date.now() < deadline) await wait(20);
  assert.equal(r.phase, 'over', 'ohne Stimmen läuft die Partie über die Uhr zu Ende');
  r.dispose();
});

test('Massentest Schlagfertig: 300 zufällige Partien mit 3–8 Spielern, Lücken, Zuschauern und Bots', () => {
  let seed = 777;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let games = 0, steps = 0;
  for (let n = 0; n < 300; n++) {
    const count = 3 + Math.floor(rng() * 6);
    const r = SF.create('MASS' + n, { rounds: 1 + Math.floor(rng() * 4), target: rng() < 0.2 ? 300 : 0, spectators: rng() < 0.5 }, () => {});
    const ids = Array.from({ length: count }, (_, k) => { const p = r.addPlayer('Bot' + k, null); p.connected = true; r.sit(p.id); return p.id; });
    const z = r.addPlayer('Zuschauer', null).id;
    r.start(ids[0]);
    let k = 0;
    while (r.phase === 'playing') {
      if (++k > 400) assert.fail(`Partie ${n} endet nicht`);
      if (r.stage === 'reveal') { r.next(ids[0]); continue; }
      const key = `${r.q}:${r.stage}:${r.sub}`;
      for (const id of ids) {
        if (rng() < 0.12) continue; // manche geben nichts ab
        try { BOTS.schlagfertig(r, id, rng); } catch (e) { assert.fail(`Partie ${n}, ${r.stage}: ${e.message}`); }
        if (`${r.q}:${r.stage}:${r.sub}` !== key) break;
      }
      if (r.stage === 'vote' && r.settings.spectators && rng() < 0.5) { try { r.vote(z, r.isFinal ? [0] : 0); } catch { /* schon vorbei */ } }
      if (`${r.q}:${r.stage}:${r.sub}` === key && (r.stage === 'write' || r.stage === 'vote')) {
        // Niemand sieht fremde Antworten oder Autoren
        const { past, ...open } = r.view(z).g; // frühere, schon aufgelöste Fragen sind offen
        assert.ok((past || []).every((x) => x.q < r.q + 1), 'nur frühere Fragen');
        const json = JSON.stringify(open);
        assert.ok(!/"author"|"authors"|"voters"/.test(json));
        r.next(ids[0]);
      }
      for (const id of ids) assert.ok((r.gamePts[id] ?? 0) >= 0);
    }
    assert.equal(r.phase, 'over');
    assert.equal(Object.values(r.scores).reduce((a, b) => a + b, 0), Object.values(r.gamePts).reduce((a, b) => a + b, 0));
    steps += k; games++;
    r.dispose();
  }
  console.log(`  Schlagfertig: ${games} Partien, Ø ${Math.round(steps / games)} Schritte`);
});

test('Ansicht: Rundennummer und Rundenzahl bleiben in jeder Stufe erhalten (kein Feld überschreibt sie)', () => {
  const { r, ids } = room(4, { rounds: 2 });
  r.start(ids[0]);
  const check = (stage) => { const g = r.view(ids[0]).g; assert.equal(g.stage, stage); assert.equal(typeof g.q, 'number', `${stage}: q`); assert.equal(g.of, 2); assert.equal(g.q, 1); };
  check('write');
  writeAll(r, ids);
  check('vote');
  while (r.stage === 'vote') r.next(ids[0]);
  check('reveal');
  r.dispose();
});
