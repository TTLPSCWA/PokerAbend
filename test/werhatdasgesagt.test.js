// Wer hat das gesagt?: Fragenkatalog, Geheimhaltung der Autoren, Raten, Punkte (+100 richtig, +50 je Fehltipp für den Autor), Hausregel, Massentest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { NO_ANSWER } from '../games/party-room.js';

const WH = GAMES.werhatdasgesagt;
const CATALOG = JSON.parse(readFileSync(new URL('../games/werhatdasgesagt/fragen.json', import.meta.url), 'utf8'));
// Keine Fragen zu Gesundheit, Beziehungen, Politik, Religion, Geld-Details
const PRIVATE = /krank|gesundheit|arzt|medikament|diagnose|depress|therapie|beziehung|partner|freund(in)?\b|ehe\b|verlieb|scheidung|politik|partei|wähl|regierung|religion|glaube|gott|kirche|gehalt|schulden|einkommen|vermögen|kredit|steuer/i;

function room(n = 4, settings = {}) {
  const r = WH.create('WERHAT', { rounds: 2, ...settings }, () => {});
  r.game = 'werhatdasgesagt';
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer(['Anna', 'Ben', 'Cara', 'Dirk', 'Eva', 'Finn', 'Gina', 'Hans', 'Ida', 'Jan'][i], null); p.connected = true; r.sit(p.id); return p.id; });
  return { r, ids };
}
const answerAll = (r, ids) => { for (const id of ids) r.answer(id, `Antwort von ${r.name(id)}`); };
const asked = (r) => r.step().author; // wer die aktuelle Antwort geschrieben hat (nur Test-Wissen)

test('Katalog: mindestens 100 lockere Fragen, nicht zu privat, keine doppelten', () => {
  assert.ok(CATALOG.length >= 100, `${CATALOG.length} Fragen`);
  assert.equal(new Set(CATALOG.map((c) => c.id)).size, CATALOG.length);
  assert.equal(new Set(CATALOG.map((c) => c.q)).size, CATALOG.length);
  for (const c of CATALOG) {
    assert.ok(c.q.endsWith('?') && c.q.length >= 12 && c.q.length <= 120, c.id);
    assert.ok(!PRIVATE.test(c.q), `${c.id}: zu privat – „${c.q}“`);
  }
});

test('Schreibphase: alle antworten anonym, niemand sieht fremde Antworten', () => {
  const { r, ids: [a, b, c, d] } = room();
  const z = r.addPlayer('Zoe', null).id;
  r.start(a);
  r.answer(a, 'Geheimnis Eins'); r.answer(b, 'Geheimnis Zwei');
  for (const id of [a, b, c, d, z]) {
    const json = JSON.stringify(r.view(id));
    if (id !== a) assert.ok(!json.includes('Geheimnis Eins'));
    if (id !== b) assert.ok(!json.includes('Geheimnis Zwei'));
  }
  assert.equal(r.view(a).g.mine, 'Geheimnis Eins');
  assert.equal(r.view(c).g.mine, null);
  assert.equal(r.view(z).g.canWrite, false);
  assert.throws(() => r.answer(z, 'Ich auch'), /nicht mit/);
  assert.throws(() => r.answer(c, '   '), /schreib etwas/);
  assert.equal(r.view(c).players.find((p) => p.id === a).ready, true, '„fertig“ ist öffentlich, der Text nicht');
  r.dispose();
});

test('Raten: jede Antwort einzeln, der Autor bleibt verborgen, Autoren raten nicht, nicht sich selbst', () => {
  const { r, ids: [a, b, c, d] } = room();
  r.start(a);
  answerAll(r, [a, b, c, d]);
  assert.equal(r.stage, 'vote');
  assert.equal(r.steps.length, 4, 'jede Antwort kommt einzeln dran');
  const author = asked(r);
  const others = [a, b, c, d].filter((x) => x !== author);
  for (const id of [a, b, c, d]) {
    const g = r.view(id).g;
    assert.ok(!('author' in g) && !('results' in g) && !('guesses' in g), 'Zustand verrät den Autor nicht');
    assert.equal(g.text, `Antwort von ${r.name(author)}`);
    assert.equal(g.mine, id === author);
    assert.equal(g.canGuess, id !== author);
    assert.deepEqual(g.candidates, id === author ? [] : [a, b, c, d].filter((x) => x !== id), 'Spielerliste ohne mich, ohne Hinweis');
  }
  assert.throws(() => r.guess(author, others[0]), /deine Antwort/);
  assert.throws(() => r.guess(others[0], others[0]), /anderen Mitspieler/);
  assert.throws(() => r.guess(others[0], 'unbekannt'), /anderen Mitspieler/);
  r.guess(others[0], others[1]);
  assert.equal(r.view(others[0]).g.myGuess, others[1]);
  assert.equal(r.view(others[1]).g.myGuess, null, 'fremde Tipps sieht niemand');
  assert.equal(r.view(others[0]).players.find((p) => p.id === author).ready, false, 'der Autor gilt nicht als „fertig“');
  r.guess(others[0], author); // umentscheiden
  r.guess(others[1], author);
  assert.equal(r.sub, 0);
  r.guess(others[2], author);
  assert.equal(r.sub, 1, 'alle haben getippt → nächste Antwort');
  r.dispose();
});

test('Punkte: richtig +100, Autor +50 je Fehltipp; Zuschauer tippen ohne Punkte mit', () => {
  const { r, ids: [a, b, c, d] } = room(4, { spectators: true });
  const z = r.addPlayer('Zoe', null).id;
  r.start(a);
  answerAll(r, [a, b, c, d]);
  for (let k = 0; k < 4; k++) {
    const author = asked(r);
    const others = [a, b, c, d].filter((x) => x !== author);
    // Der erste Rater tippt richtig, die anderen beiden falsch
    r.guess(others[0], author);
    r.guess(others[1], others[2]);
    if (k === 0) r.guess(z, others[0]); // Zuschauer-Fehltipp: gibt dem Autor nichts
    r.guess(others[2], others[1]);
  }
  assert.equal(r.stage, 'reveal');
  // Jeder war einmal Autor (2 Fehltipps = +100) und hat als Rater einmal je 3 Antworten fremder Autoren getippt – hier gezielt gezählt
  const results = r.view(a).g.results;
  assert.equal(results.length, 4);
  for (const res of results) {
    assert.equal(res.disguise, 100, '2 Fehltipps × 50, Zuschauer zählt nicht');
    assert.equal(res.guesses.filter((g) => g.right).length, 1);
  }
  const total = Object.values(r.gamePts).reduce((x, y) => x + y, 0);
  assert.equal(total, 4 * (100 + 100), 'je Antwort 100 für den Richtigen und 100 für den Autor');
  assert.equal(r.gamePts[z], undefined);
  assert.ok(results[0].guesses.some((g) => g.spectator), 'der Zuschauer-Tipp steht in der Auflösung, aber ohne Wirkung');
  r.dispose();
});

test('Der Autor steht erst in der Auflösung im Zustand', () => {
  const { r, ids: [a, b, c] } = room(3);
  r.start(a);
  answerAll(r, [a, b, c]);
  const authors = r.steps.map((s) => s.author);
  for (let k = 0; k < 3; k++) {
    for (const id of [a, b, c]) assert.ok(!('author' in r.view(id).g));
    const author = asked(r);
    const voters = [a, b, c].filter((x) => x !== author);
    r.guess(voters[0], voters[1]); r.guess(voters[1], voters[0]);
  }
  assert.equal(r.stage, 'reveal');
  const res = r.view(c).g.results;
  assert.deepEqual(res.map((x) => x.author), authors, 'in der Reihenfolge der Abstimmung');
  assert.ok(res.every((x) => x.text.startsWith('Antwort von ')));
  r.dispose();
});

test('Nicht abgegebene Antworten: kein Raten dafür, alle leer = direkt zur Auflösung', () => {
  const { r, ids: [a, b, c] } = room(3);
  r.start(a);
  r.answer(a, 'Nur ich habe geantwortet');
  r.next(a);
  assert.equal(r.stage, 'vote');
  assert.equal(r.steps.length, 1);
  assert.equal(r.view(b).g.text, 'Nur ich habe geantwortet');
  r.next(a); // Raten beenden
  assert.equal(r.stage, 'reveal');
  assert.equal(r.view(b).g.results[0].guesses.length, 0);
  r.next(a); // nächste Frage, diesmal schreibt niemand
  r.next(a);
  assert.equal(r.stage, 'reveal', 'ohne Antworten gibt es nichts zu raten');
  assert.equal(r.view(a).g.results.length, 0);
  assert.equal(NO_ANSWER, '(keine Antwort)');
  r.dispose();
});

test('Hausregel „nur eigene Fragen“: ohne Liste kein Start, mit Liste nur diese Fragen; Liste bleibt im Raum', () => {
  const { r, ids: [a, b] } = room(3, { ownOnly: true, rounds: 3 });
  assert.throws(() => r.start(a), /eigene Frage/);
  assert.throws(() => r.setCustom(b, 'Meine Frage hier?'), /Host/);
  r.setCustom(a, 'Was ist dein Lieblingsplatz im Garten?\nWelches Gericht kocht Oma am besten?\nzu\n');
  assert.equal(r.custom.length, 2);
  r.start(a);
  assert.equal(r.total, 2, 'nur 2 Fragen vorhanden: die Partie hat 2 Runden');
  assert.ok(r.picks.every((p) => /Garten|Oma/.test(p.q)));
  r.dispose();
  const open = room(3, { ownOnly: false, rounds: 3 });
  open.r.setCustom(open.ids[0], 'Was ist dein Lieblingsplatz im Garten?');
  open.r.start(open.ids[0]);
  assert.equal(open.r.total, 3, 'ohne die Hausregel füllt der Katalog auf');
  assert.equal(open.r.picks[0].q, 'Was ist dein Lieblingsplatz im Garten?', 'eigene zuerst');
  open.r.dispose();
});

test('Texteingabe: höchstens 120 Zeichen, Steuerzeichen raus, HTML bleibt Text', () => {
  const { r, ids: [a] } = room(3);
  r.start(a);
  r.answer(a, '<script>alert(1)</script>' + 'y'.repeat(300) + '\u0007‮');
  assert.equal(r.answers[a].length, 120);
  assert.ok(r.answers[a].startsWith('<script>alert(1)</script>'));
  assert.ok(!/[\u0000-\u001f‮]/.test(r.answers[a]));
  r.dispose();
});

test('Rundenzahl und Punkte-Ziel: Partie endet nach den Fragen oder bei Zielpunkten', () => {
  const { r, ids } = room(3, { rounds: 2, target: 100 });
  r.start(ids[0]);
  answerAll(r, ids);
  for (let k = 0; k < 3; k++) { const author = asked(r); const v = ids.filter((x) => x !== author); r.guess(v[0], author); r.guess(v[1], author); }
  assert.equal(r.stage, 'reveal');
  r.next(ids[0]);
  assert.equal(r.phase, 'over', 'Ziel nach der ersten Frage erreicht');
  assert.ok(r.result.text);
  r.dispose();
});

test('Massentest Wer hat das gesagt?: 300 zufällige Partien mit 3–10 Spielern, Lücken, Zuschauern und Bots', () => {
  let seed = 31337;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let games = 0, steps = 0;
  for (let n = 0; n < 300; n++) {
    const count = 3 + Math.floor(rng() * 8);
    const r = WH.create('MASS' + n, { rounds: 1 + Math.floor(rng() * 5), target: rng() < 0.2 ? 200 : 0, spectators: rng() < 0.5, ownOnly: false }, () => {});
    const ids = Array.from({ length: count }, (_, k) => { const p = r.addPlayer('Bot' + k, null); p.connected = true; r.sit(p.id); return p.id; });
    const z = r.addPlayer('Zuschauer', null).id;
    r.start(ids[0]);
    let k = 0;
    while (r.phase === 'playing') {
      if (++k > 500) assert.fail(`Partie ${n} endet nicht`);
      if (r.stage === 'reveal') { r.next(ids[0]); continue; }
      const key = `${r.q}:${r.stage}:${r.sub}`;
      for (const id of ids) {
        if (rng() < 0.12) continue; // manche geben nichts ab
        try { BOTS.werhatdasgesagt(r, id, rng); } catch (e) { assert.fail(`Partie ${n}, ${r.stage}: ${e.message}`); }
        if (`${r.q}:${r.stage}:${r.sub}` !== key) break;
      }
      if (r.stage === 'vote' && r.settings.spectators && rng() < 0.5) { try { r.guess(z, ids[0]); } catch { /* schon vorbei */ } }
      if (`${r.q}:${r.stage}:${r.sub}` === key && (r.stage === 'write' || r.stage === 'vote')) {
        assert.ok(!/"author"|"guesses"/.test(JSON.stringify((({ past, ...open }) => open)(r.view(z).g))), 'Autor oder Tipps vor der Auflösung sichtbar');
        r.next(ids[0]);
      }
      for (const id of ids) assert.ok((r.gamePts[id] ?? 0) >= 0);
    }
    assert.equal(r.phase, 'over');
    assert.equal(Object.values(r.scores).reduce((a, b) => a + b, 0), Object.values(r.gamePts).reduce((a, b) => a + b, 0));
    steps += k; games++;
    r.dispose();
  }
  console.log(`  Wer hat das gesagt?: ${games} Partien, Ø ${Math.round(steps / games)} Schritte`);
});

test('Ansicht: Rundennummer und Rundenzahl bleiben in jeder Stufe erhalten (kein Feld überschreibt sie)', () => {
  const { r, ids } = room(4, { rounds: 2 });
  r.start(ids[0]);
  const check = (stage) => { const g = r.view(ids[0]).g; assert.equal(g.stage, stage); assert.equal(typeof g.q, 'number', `${stage}: q`); assert.equal(g.of, 2); assert.equal(g.q, 1); assert.equal(typeof g.prompt, 'string'); };
  check('write');
  answerAll(r, ids);
  check('vote');
  while (r.stage === 'vote') r.next(ids[0]);
  check('reveal');
  r.dispose();
});
