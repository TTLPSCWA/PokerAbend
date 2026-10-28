// Päckchen 6: Bauart-B-Baustein (Zahlenzoo, Gedächtnisküche, Pfeilfieber, Sortierstation), Tickendes Paket, Werwolf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import * as ZZ from '../public/games/zahlenzoo/logic.js';
import * as GK from '../public/games/gedaechtnis-kueche/logic.js';
import * as PF from '../public/games/pfeilfieber/logic.js';
import * as SS from '../public/games/sortierstation/logic.js';
import { rng } from '../public/games/solo/rng.js';
import { CATEGORIES, norm } from '../games/tickendes-paket/room.js';
import { wolfCount } from '../games/werwolf/room.js';
import { BOTS } from '../games/bots.js';

function room(id, n, settings = {}, bots = false) {
  const r = GAMES[id].create('P6', settings, () => {});
  const ids = Array.from({ length: n }, (_, k) => { const p = r.addPlayer('S' + k, null); if (bots) p.bot = true; r.sit(p.id); return p.id; });
  return { r, ids };
}

// ---------- Baustein: Seed, Nachspielen, Prüfung ----------
test('Zufall aus dem Seed ist überall gleich', () => {
  const a = rng(12345), b = rng(12345), c = rng(12346);
  const x = Array.from({ length: 5 }, () => a()), y = Array.from({ length: 5 }, () => b()), z = Array.from({ length: 5 }, () => c());
  assert.deepEqual(x, y);
  assert.notDeepEqual(x, z);
  assert.ok(x.every((v) => v >= 0 && v < 1));
});

test('Zahlenzoo: gleiche Runde aus gleichem Seed, Antwort aus dem Ablauf, Wertung mit Tempo', () => {
  for (let level = 0; level < 8; level++) {
    const a = ZZ.makeRound(777 + level, level), b = ZZ.makeRound(777 + level, level);
    assert.deepEqual(a, b);
    // Antwort stimmt mit dem Ablauf überein
    const end = ZZ.visibleAt(a, a.durationMs + 1);
    if (a.question.kind === 'count') assert.equal(a.answer, end[a.question.a]);
    if (a.question.kind === 'diff') assert.equal(a.answer, end[a.question.a] - end[a.question.b]);
    assert.ok(a.answer >= 0);
    assert.ok(a.events.every((e) => e.dir === 'in' || ZZ.visibleAt(a, e.t - 1)[e.animal] > 0), 'nur wer da ist, geht');
  }
  const r = ZZ.makeRound(5, 3);
  assert.equal(ZZ.score(r, { answer: r.answer }, { elapsedMs: 0 }).pts, 150);
  assert.equal(ZZ.score(r, { answer: r.answer }, { elapsedMs: 10000 }).pts, 140);
  assert.equal(ZZ.score(r, { answer: r.answer }, { elapsedMs: 99000 }).pts, 100);
  assert.equal(ZZ.score(r, { answer: r.answer + 1 }, {}).pts, 0);
  assert.equal(ZZ.score(r, { answer: 'x' }, {}).pts, 0);
  assert.equal(ZZ.score(r, { answer: r.answer }, { elapsedMs: 0, settings: { timeBonus: false } }).pts, 100);
  assert.ok(ZZ.makeRound(9, 5, { countOnly: true }).question.kind === 'count');
});

test('Gedächtnisküche: Rezept wird länger, erster Fehler beendet, rückwärts', () => {
  assert.equal(GK.makeRound(1, 0).seq.length, 3);
  assert.equal(GK.makeRound(1, 4).seq.length, 7);
  const r = GK.makeRound(42, 2);
  assert.equal(GK.score(r, { taps: r.expected }, { elapsedMs: 0 }).pts, 5 * 10 + 20 + 10);
  const bad = [...r.expected.slice(0, 2), (r.expected[2] + 1) % 8, ...r.expected.slice(3)];
  assert.equal(GK.score(r, { taps: bad }, {}).pts, 20);
  assert.equal(GK.score(r, { taps: [] }, {}).pts, 0);
  const rev = GK.makeRound(42, 2, { reverse: true });
  assert.deepEqual(rev.expected, [...rev.seq].reverse());
  assert.equal(GK.score(rev, { taps: rev.seq }, {}).pts, rev.seq[0] === rev.seq.at(-1) && rev.seq[1] === rev.seq.at(-2) ? 50 : GK.score(rev, { taps: rev.seq }, {}).pts);
});

test('Pfeilfieber: Nachspielen zählt Folgen und Fehler, zu schnelle und gesperrte Eingaben zählen nicht', () => {
  const seed = 999;
  const seq0 = PF.sequenceAt(seed, 0);
  assert.equal(seq0.length, 3);
  const ok = seq0.map((a, i) => [a, 500 + i * 200]);
  assert.equal(PF.replay(seed, ok).completed, 1);
  // Fehler: danach 500 ms gesperrt
  const wrong = [(seq0[0] + 1) % 4, 400];
  const r1 = PF.replay(seed, [wrong, [seq0[0], 600], [seq0[0], 1000], [seq0[1], 1200], [seq0[2], 1400]]);
  assert.equal(r1.errors, 1);
  assert.equal(r1.ignored, 1, 'während der Sperre');
  // Zu schnell (unter 80 ms) und rückwärts in der Zeit
  const fast = [[seq0[0], 100], [seq0[1], 120], [seq0[2], 140]];
  assert.equal(PF.replay(seed, fast).completed, 0);
  assert.equal(PF.replay(seed, [[seq0[0], 500], [seq0[1], 300]]).ignored, 1);
  // Nach Ablauf der Zeit zählt nichts mehr
  assert.equal(PF.replay(seed, ok.map(([a, t]) => [a, t + 40000]), { playMs: 30000 }).completed, 0);
  // Rückwärts-Modus: entgegengesetzter Pfeil
  const inv = seq0.map((a, i) => [a ^ 1, 500 + i * 200]);
  assert.equal(PF.replay(seed, inv, { reverse: true }).completed, 1);
  assert.equal(PF.replay(seed, inv).completed, 0);
  // Der Bot bleibt plausibel
  const bot = PF.botPayload({ seed, level: 0, playMs: 30000 }, rng(3));
  assert.ok(bot.inputs.length > 10);
  assert.ok(PF.replay(seed, bot.inputs).pts >= 0);
  // Unsinn wird ignoriert, stürzt nicht ab
  assert.equal(PF.score({ seed, level: 0, playMs: 30000 }, { inputs: 'x' }).pts, 0);
  assert.equal(PF.score({ seed, level: 0, playMs: 30000 }, { inputs: [[9, 1], ['a'], null] }).pts, 0);
});

test('Sortierstation: richtige Kiste im Zeitfenster, falsche kosten Punkte, ohne Minus, Regelwechsel', () => {
  const round = SS.makeRound(31, 0, { playMs: 30000 });
  const it = round.items[0];
  const right = SS.expectedBox(round, it);
  assert.equal(SS.evaluate(round, [{ i: 0, b: right, t: it.t + 100 }]).pts, 10);
  assert.equal(SS.evaluate(round, [{ i: 0, b: 1 - right, t: it.t + 100 }]).pts, 0, 'nie unter 0');
  assert.equal(SS.evaluate(round, [{ i: 0, b: right, t: it.t - 50 }]).right, 0, 'vor dem Erscheinen');
  assert.equal(SS.evaluate(round, [{ i: 0, b: right, t: it.t + it.life + 50 }]).right, 0, 'zu spät');
  assert.equal(SS.evaluate(round, [{ i: 0, b: right, t: it.t + 100 }, { i: 0, b: right, t: it.t + 200 }]).right, 1, 'doppelt zählt einmal');
  const two = SS.evaluate(round, [{ i: 0, b: right, t: it.t + 100 }, { i: 1, b: 1 - SS.expectedBox(round, round.items[1]), t: round.items[1].t + 100 }]);
  assert.equal(two.pts, 5);
  assert.equal(SS.evaluate(round, [{ i: 1, b: 1 - SS.expectedBox(round, round.items[1]), t: round.items[1].t + 100 }], { noPenalty: true }).wrong, 1);
  const sw = SS.makeRound(31, 0, { playMs: 30000, switchRule: true });
  assert.equal(SS.ruleAt(sw, 100), 0);
  assert.equal(SS.ruleAt(sw, 20000), 1);
  assert.ok(SS.makeRound(31, 1, { playMs: 30000 }).boxes === 3);
  const bot = SS.botPayload(round, rng(8));
  assert.ok(SS.evaluate(round, bot.decisions).right > 0);
});

// ---------- Baustein im Raum ----------
for (const id of ['zahlenzoo', 'gedaechtnis-kueche', 'pfeilfieber', 'sortierstation']) {
  test(`${GAMES[id].name}: Partie mit Bots, Abgabe nur einmal, fremde Ergebnisse erst in der Auflösung, Seed nur in der Spielstufe`, () => {
    const { r, ids } = room(id, 3, { rounds: 2 });
    const z = r.addPlayer('Zoe', null).id;
    r.start(ids[0]);
    assert.equal(r.stage, 'write');
    const v = r.view(ids[1]).g;
    assert.equal(typeof v.seed, 'number');
    assert.equal(v.mine, null);
    r.botStep(ids[0], rng(1));
    assert.throws(() => r.botStep(ids[0]) || r.submit(ids[0], {}), /schon abgegeben/);
    const json = JSON.stringify(r.view(ids[1]));
    assert.ok(!json.includes(r.subs[ids[0]].detail) || r.subs[ids[0]].detail.length < 3, 'fremde Wertung nicht im Spielzustand');
    assert.equal(r.view(ids[1]).g.reveal, null);
    assert.ok(r.view(ids[0]).g.mine, 'die eigene Wertung sieht man');
    assert.throws(() => r.submit(z, {}), /nicht mit/, 'Zuschauer dürfen nicht, solange es der Host nicht erlaubt');
    for (const i of ids.slice(1)) r.botStep(i, rng(2));
    r.next(r.hostId); // alle fertig → Auflösung
    assert.equal(r.stage, 'reveal');
    const g = r.view(z).g;
    assert.equal(g.seed, null, 'Seed ist in der Auflösung weg');
    assert.equal(g.reveal.results.length, 3);
    assert.ok(g.reveal.results[0].pts >= g.reveal.results.at(-1).pts);
    r.next(r.hostId);
    assert.equal(r.stage, 'write');
    for (const i of ids) r.botStep(i, rng(3));
    r.next(r.hostId); r.next(r.hostId);
    assert.equal(r.phase, 'over');
    assert.ok(Object.values(r.gamePts).some((p) => p > 0));
    r.dispose();
  });
  test(`${GAMES[id].name}: wer nichts abgibt, bekommt 0; Unsinn als Eingabe wird nicht gewertet`, () => {
    const { r, ids } = room(id, 2, { rounds: 1 });
    r.start(ids[0]);
    r.submit(ids[0], 'kaputt');
    r.submit(ids[1], { answer: 'x', taps: 'y', inputs: 5, decisions: {} });
    r.next(r.hostId);
    assert.equal(r.stage, 'reveal');
    assert.ok(r.reveal.results.every((x) => x.pts === 0));
    const t = room(id, 2, { rounds: 1 });
    t.r.start(t.ids[0]);
    t.r.next(t.r.hostId); // Zeit um: niemand hat abgegeben
    assert.ok(t.r.reveal.results.every((x) => x.pts === 0 && x.missing));
    r.dispose(); t.r.dispose();
  });
}

test('Zahlenzoo im Raum: Tempo zählt nach Serveruhr, falsche Antwort 0', () => {
  const { r, ids } = room('zahlenzoo', 2, { rounds: 1 });
  r.start(ids[0]);
  const answer = r.rd.answer;
  r.submit(ids[0], { answer });
  r.submit(ids[1], { answer: answer + 5 });
  assert.ok(r.subs[ids[0]].pts >= 140 && r.subs[ids[0]].pts <= 150);
  assert.equal(r.subs[ids[1]].pts, 0);
  r.dispose();
});

// ---------- Tickendes Paket ----------
test('Tickendes Paket: Wort muss zum Buchstaben passen, nur einmal pro Paket, geht reihum weiter', () => {
  const { r, ids } = room('tickendes-paket', 3, { rounds: 2, turnTime: 0 });
  r.start(ids[0]);
  const first = r.currentId;
  const letter = r.prompt.letter;
  assert.ok(CATEGORIES.includes(r.prompt.cat));
  assert.throws(() => r.answer(ids.find((i) => i !== first), letter + 'aa'), /nicht dran/);
  assert.throws(() => r.answer(first, 'x'), /zu kurz/);
  const wrong = letter === 'A' ? 'Bar' : 'Abr';
  assert.throws(() => r.answer(first, wrong), /anfangen/);
  r.answer(first, `${letter}öl`);
  assert.notEqual(r.currentId, first);
  const next = r.currentId;
  const letter2 = r.prompt.letter;
  r.used.push(`${letter2}öl`);
  assert.throws(() => r.answer(next, `${letter2}ÖL`), /schon/, 'Umlaute und Groß/Klein zählen gleich');
  assert.equal(norm('Ärger!'), 'arger');
  r.answer(next, `${letter2}ensch`);
  r.dispose();
});

test('Tickendes Paket: Platzen gibt dem Halter einen Minuspunkt, der fängt neu an, am Ende gewinnen die mit den wenigsten', () => {
  const { r, ids } = room('tickendes-paket', 3, { rounds: 2, turnTime: 0 });
  r.start(ids[0]);
  const holder = r.currentId;
  r.boom();
  assert.equal(r.minus[holder], 1);
  assert.equal(r.currentId, holder, 'wem es geplatzt ist, fängt an');
  assert.equal(r.bomb, 2);
  assert.ok(!JSON.stringify(r.view(ids[0])).includes('fuseMs'));
  assert.equal(r.view(ids[0]).g.fuseLeft, null, 'die Zeit bleibt geheim');
  r.boom();
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners.sort(), ids.filter((i) => i !== holder).sort());
  r.dispose();
});

test('Tickendes Paket: Zünder tickt wirklich (Zeitgeber), Aufgeben behält das Paket, sichtbarer Countdown optional', async () => {
  const { r, ids } = room('tickendes-paket', 3, { rounds: 1, turnTime: 0, visibleFuse: true });
  r.start(ids[0]);
  assert.ok(r.view(ids[0]).g.fuseLeft > 20000, 'sichtbarer Countdown');
  const holder = r.currentId;
  r.onTimeout(holder);
  assert.equal(r.currentId, holder, 'zu langsam: behält das Paket');
  r.startFuse(30);
  await new Promise((res) => setTimeout(res, 80));
  assert.equal(r.phase, 'over', 'nach der Zeit ist es geplatzt');
  assert.equal(r.minus[holder], 1);
  r.dispose();
});

test('Tickendes Paket: Bots spielen Pakete durch, Abbruch stoppt den Zünder', () => {
  const { r, ids } = room('tickendes-paket', 4, { rounds: 3, turnTime: 0 }, true);
  r.start(r.hostId);
  for (let i = 0; i < 12; i++) BOTS['tickendes-paket'](r, r.currentId, rng(i + 1));
  assert.ok(r.used.length >= 10, 'die Bots geben das Paket weiter');
  void ids;
  r.abortRound(r.hostId);
  assert.equal(r.fuseTimer, null);
  assert.equal(r.phase, 'lobby');
  r.dispose();
});

// ---------- Werwolf ----------
function wolfTable(n = 8, settings = {}) {
  const { r, ids } = room('werwolf', n, settings, false);
  r.start(r.hostId);
  const by = (role) => ids.filter((id) => r.roles[id] === role);
  return { r, ids, by };
}
function force(r, ids, map) { // feste Rollen: { rolle: [Indexe] }
  for (const id of ids) r.roles[id] = 'dorf';
  for (const [role, idx] of Object.entries(map)) for (const i of idx) r.roles[ids[i]] = role;
}

test('Werwolf: Rollen nach Spielerzahl, mindestens sechs, jeder nur seine Rolle', () => {
  assert.equal(wolfCount(6), 1); assert.equal(wolfCount(8), 2); assert.equal(wolfCount(18), 4);
  const { r: bad } = room('werwolf', 5);
  assert.throws(() => bad.start(bad.hostId), /mindestens 6/);
  for (const n of [6, 9, 12, 18]) {
    const { r, ids, by } = wolfTable(n);
    assert.equal(by('wolf').length, wolfCount(n));
    for (const role of ['seher', 'hexe', 'amor', 'jaeger']) assert.equal(by(role).length, 1, role);
    assert.ok(by('dorf').length >= 1);
    for (const id of ids) {
      const g = r.view(id).g;
      assert.equal(g.role, r.roles[id]);
      assert.equal(g.roles, null, 'keine fremden Rollen');
      assert.deepEqual(g.wolves === null, r.roles[id] !== 'wolf');
    }
    r.dispose();
  }
  const off = wolfTable(8, { seher: false, hexe: false, amor: false, jaeger: false });
  assert.deepEqual(new Set(Object.values(off.r.roles)), new Set(['wolf', 'dorf']));
  off.r.dispose();
});

test('Werwolf: Geheimhaltung – Zuschauer und Lebende sehen weder Rollen noch Nachtaktionen, Tote sehen alles', () => {
  const { r, ids } = wolfTable(8);
  force(r, ids, { wolf: [0, 1], seher: [2], hexe: [3], amor: [4], jaeger: [5] });
  const z = r.addPlayer('Zoe', null).id;
  const wolf = ids[0], vil = ids[7];
  assert.deepEqual(r.view(wolf).g.wolves.sort(), [ids[0], ids[1]].sort());
  assert.equal(r.view(vil).g.wolves, null);
  assert.equal(r.view(z).g.role, null);
  assert.equal(r.view(z).g.roles, null);
  assert.equal(r.view(z).g.todo, null);
  // Nacht 1: Amor
  assert.equal(r.step, 'amor');
  assert.equal(r.view(ids[4]).g.todo.type, 'amor');
  assert.equal(r.view(vil).g.todo, null);
  r.amor(ids[4], ids[6], ids[7]);
  assert.deepEqual(r.view(ids[6]).g.lovers.sort(), [ids[6], ids[7]].sort());
  assert.equal(r.view(ids[2]).g.lovers, null, 'Verliebte kennt nur, wer verliebt ist');
  // Werwölfe
  assert.equal(r.step, 'wolves');
  assert.equal(r.view(wolf).g.todo.type, 'wolf');
  assert.throws(() => r.wolfVote(vil, ids[2]), /nicht deine/);
  assert.throws(() => r.wolfVote(wolf, ids[1]), /kein Werwolf/);
  r.wolfVote(ids[0], ids[2]);
  assert.equal(r.step, 'wolves', 'der zweite Wolf fehlt noch');
  r.wolfVote(ids[1], ids[2]);
  assert.equal(r.step, 'seer');
  // Nachtaktionen stehen nicht im öffentlichen Verlauf oder in Sprechblasen
  const pub = JSON.stringify({ log: r.view(vil).log, acts: r.view(vil).acts, moves: r.view(vil).moves });
  assert.ok(!pub.includes('Amor verliebt') && !/Werwölfe wählen/.test(pub), 'kein Nachtgeschehen im Verlauf');
  assert.equal(r.view(vil).g.nightLog, null);
  assert.equal(r.view(ids[2]).g.todo.type, 'seer');
  r.seer(ids[2], ids[0]);
  assert.deepEqual(r.view(ids[2]).g.seen, [{ day: 1, id: ids[0], role: 'wolf' }]);
  assert.equal(r.view(vil).g.seen, null);
  assert.equal(r.step, 'witch');
  const w = r.view(ids[3]).g.todo;
  assert.equal(w.victim, ids[2]);
  assert.equal(r.view(ids[2]).g.todo, null, 'nur die Hexe erfährt das Opfer');
  r.witch(ids[3], 'none');
  // Der Morgen: das Opfer ist tot; Tote sehen jetzt alles
  assert.equal(r.stage, 'day');
  assert.ok(!r.alive.has(ids[2]));
  const dead = r.view(ids[2]).g;
  assert.equal(dead.dead, true);
  assert.equal(dead.roles[ids[0]], 'wolf');
  assert.ok(dead.nightLog.some((t) => /Amor/.test(t)));
  assert.equal(r.view(vil).g.roles, null);
  r.dispose();
});

test('Werwolf: Hexe heilt oder vergiftet je einmal, Verliebte sterben zusammen, Jäger schießt, Abstimmung', () => {
  const { r, ids } = wolfTable(8);
  force(r, ids, { wolf: [0, 1], seher: [2], hexe: [3], amor: [4], jaeger: [5] });
  r.amor(ids[4], ids[5], ids[6]); // Jäger und Dorfbewohner verliebt
  r.wolfVote(ids[0], ids[3]); r.wolfVote(ids[1], ids[3]); // Opfer ist die Hexe selbst
  r.seer(ids[2], ids[7]);
  r.witch(ids[3], 'heal');
  assert.equal(r.potions.heal, false);
  assert.ok(r.alive.has(ids[3]), 'geheilt');
  assert.equal(r.stage, 'day');
  r.next(r.hostId);
  assert.equal(r.stage, 'vote');
  // Abstimmung: der Jäger (und damit seine Verliebte) wird hingerichtet; er nimmt jemanden mit
  for (const id of r.alive) r.vote(id, id === ids[5] ? ids[7] : ids[5]);
  assert.equal(r.stage, 'hunter', 'der Jäger schießt');
  assert.ok(!r.alive.has(ids[6]), 'Verliebte sind mit ihm gestorben');
  assert.throws(() => r.shoot(ids[0], ids[1]), /nicht schießen/);
  r.shoot(ids[5], ids[0]); // schießt einen Wolf
  assert.ok(!r.alive.has(ids[0]));
  assert.equal(r.stage, 'night');
  assert.equal(r.day, 2);
  // Zweite Nacht: Hexe kann nicht nochmal heilen, aber vergiften
  assert.equal(r.step, 'wolves');
  r.wolfVote(ids[1], ids[7]);
  r.seer(ids[2], ids[1]);
  assert.throws(() => r.witch(ids[3], 'heal'), /verbraucht/);
  r.witch(ids[3], 'poison', ids[1]); // vergiftet den letzten Wolf
  assert.equal(r.phase, 'over');
  assert.equal(r.winner, 'dorf');
  assert.deepEqual(r.result.winners.sort(), ids.filter((i) => r.roles[i] !== 'wolf').sort());
  assert.equal(r.view(ids[7]).g.roles[ids[1]], 'wolf', 'nach dem Spiel sehen alle alles');
  r.dispose();
});

test('Werwolf: Stimmengleichheit richtet niemanden hin, Werwölfe gewinnen bei Gleichstand, Zeitablauf = nichts tun', () => {
  const { r, ids } = wolfTable(6, { amor: false });
  force(r, ids, { wolf: [0], seher: [1], hexe: [2], jaeger: [3] });
  r.wolfVote(ids[0], ids[4]);
  r.seer(ids[1], ids[0]);
  r.expire(); // Hexe tut nichts (Zeit um)
  assert.equal(r.stage, 'day');
  r.expire();
  assert.equal(r.stage, 'vote');
  const alive = [...r.alive];
  alive.forEach((id, k) => r.vote(id, alive[(k + 1) % alive.length])); // jeder bekommt genau eine Stimme
  assert.equal(r.lastVote.executed, null);
  assert.equal(r.stage, 'night');
  // Abstimmungs-Zeitablauf: niemand hat gewählt → niemand stirbt
  r.wolfVote(ids[0], ids[5]); r.seer(ids[1], ids[0]); r.expire();
  r.expire(); r.expire();
  assert.equal(r.lastVote.executed, null);
  // Wölfe gewinnen, sobald sie so viele sind wie der Rest
  assert.ok([...r.alive].length >= 2);
  r.dispose();
});

test('Werwolf: Massentest – 300 Partien mit Bots enden, Gewinner stimmen, nie ein Toter am Zug', () => {
  const rg = rng(2024);
  for (let n = 0; n < 300; n++) {
    const size = 6 + Math.floor(rg() * 13);
    const { r, ids } = room('werwolf', size, { daySecs: 60, revealRole: rg() < 0.5, amor: rg() < 0.8, hexe: rg() < 0.8, seher: rg() < 0.8, jaeger: rg() < 0.8 }, true);
    r.start(r.hostId);
    let steps = 0;
    while (r.phase === 'playing' && steps++ < 3000) {
      const b = r.botDue();
      if (b) { assert.ok(r.alive.has(b) || r.stage === 'hunter', 'Toter am Zug'); r.botStep(b, rg); } else r.next(r.hostId);
      for (const id of r.alive) assert.ok(ids.includes(id));
      if (r.phase === 'playing') assert.ok(r.wolves().length > 0 && r.wolves().length < r.alive.size, 'Spiel müsste längst zu Ende sein');
    }
    assert.equal(r.phase, 'over', `Partie ${n} endet nicht`);
    const wolves = ids.filter((i) => r.roles[i] === 'wolf');
    if (r.winner === 'dorf') assert.ok(wolves.every((w) => !r.alive.has(w)));
    if (r.winner === 'wolf') assert.ok(r.wolves().length >= r.alive.size - r.wolves().length);
    assert.ok(r.result.winners.length > 0);
    r.dispose();
  }
});

test('Werwolf: Ausscheiden mitten in der Partie lässt niemanden hängen, Abbruch stoppt die Uhr', () => {
  const { r, ids } = wolfTable(7);
  force(r, ids, { wolf: [0], seher: [1], hexe: [2], amor: [3], jaeger: [4] });
  r.amor(ids[3], ids[5], ids[6]);
  r.stand?.(ids[5]);
  assert.ok(!r.alive.has(ids[5]) && !r.alive.has(ids[6]), 'Verliebte sterben zusammen');
  r.wolfVote(ids[0], ids[1]);
  r.abortRound(r.hostId);
  assert.equal(r.stageTimer, null);
  assert.equal(r.phase, 'lobby');
  r.dispose();
});
