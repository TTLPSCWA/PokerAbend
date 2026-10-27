// Gemeinsamer Baustein der Partyspiele (games/party-room.js), geprüft am Schätzmeister:
// Stufen mit Uhr, Geheimhaltung vor der Auflösung, Texteingabe, eigene Fragen, Zuschauer, Offline-Spieler, Bots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { cleanAnswer, MAX_ANSWER } from '../games/party-room.js';
import { addBot, nextBot, createBotRunner } from '../server/bots.js';

const SM = GAMES.schaetzmeister;
function room(names = ['Anna', 'Ben', 'Cara'], settings = {}) {
  const r = SM.create('PARTY', { rounds: 3, ...settings }, () => {});
  r.game = 'schaetzmeister';
  const ids = names.map((n) => { const p = r.addPlayer(n, null); p.connected = true; r.sit(p.id); return p.id; });
  return { r, ids, host: ids[0] };
}
// Eine eigene Frage mit auffälliger Antwort, damit man sie im JSON der Ansichten suchen kann
const SECRET = '987654.321';
function withSecretQuestion(r, host) {
  r.setCustom(host, `Wie viel ist die Geheimzahl? | ${SECRET} | Stück`);
}

test('Texteingabe: Steuerzeichen und unsichtbare Tricks raus, höchstens 120 Zeichen, HTML bleibt Text', () => {
  assert.equal(cleanAnswer('Hallo\nWelt\t!\u0000‮'), 'HalloWelt!');
  assert.equal(cleanAnswer('a'.repeat(500)).length, MAX_ANSWER);
  assert.equal(MAX_ANSWER, 120);
  const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
  assert.equal(cleanAnswer(evil), evil, 'der Server verändert Zeichen nicht – ausgegeben wird im Browser als Text');
  assert.equal(cleanAnswer(null), '');
});

test('Vor der Auflösung sieht niemand fremde Schätzungen oder die richtige Antwort', () => {
  const { r, ids: [a, b, c], host } = room(['Anna', 'Ben', 'Cara'], { spectators: true });
  const z = r.addPlayer('Zoe', null); z.connected = true; // schaut nur zu
  withSecretQuestion(r, host);
  r.start(host);
  assert.equal(r.stage, 'write');
  r.guess(a, '123456'); r.guess(b, '222333,5');
  for (const viewer of [a, b, c, z.id]) {
    const v = r.view(viewer);
    const json = JSON.stringify(v);
    assert.ok(!json.includes(SECRET), 'richtige Antwort vor der Auflösung sichtbar');
    assert.equal(v.g.reveal, null);
    if (viewer !== a) assert.ok(!json.includes('123456'), `fremde Schätzung sichtbar für ${viewer}`);
    if (viewer !== b) assert.ok(!json.includes('222333.5'), `fremde Schätzung sichtbar für ${viewer}`);
  }
  assert.equal(r.view(a).g.mine, 123456);
  assert.equal(r.view(c).g.mine, null);
  // „fertig“ ist öffentlich, die Zahl nicht
  assert.equal(r.view(c).players.find((p) => p.id === a).ready, true);
  r.guess(c, '5'); // alle Mitspieler fertig → Auflösung
  assert.equal(r.stage, 'reveal');
  const json = JSON.stringify(r.view(z.id));
  assert.ok(json.includes(SECRET) && json.includes('123456') && json.includes('222333.5'), 'nach der Auflösung sehen alle alles');
  r.dispose();
});

test('Stufen: alle fertig → sofort weiter; Zeit um → „keine Antwort“; Auflösung geht von selbst weiter; Ende nach den Runden', async () => {
  const { r, ids: [a, b] } = room(['Anna', 'Ben']);
  r.settings.writeSecs = 0.2; r.revealSecs = 0.2; // sehr kurz für den Test
  r.start(a);
  r.afterChange();
  assert.ok(r.deadline, 'Uhr läuft');
  r.guess(a, '10');
  assert.equal(r.stage, 'write', 'Ben fehlt noch');
  await wait(300);
  assert.equal(r.stage, 'reveal', 'Zeit abgelaufen');
  assert.deepEqual(r.reveal.missing, [b]);
  assert.equal(r.view(a).g.reveal.guesses.length, 1);
  await wait(200);
  assert.equal(r.q, 1, 'nächste Frage');
  assert.equal(r.stage, 'write');
  assert.equal(r.view(a).g.mine, null, 'neue Frage, alte Schätzung weg');
  const deadline = Date.now() + 4000;
  while (r.phase === 'playing' && Date.now() < deadline) await wait(20);
  assert.equal(r.phase, 'over');
  assert.equal(r.stage, null);
  assert.ok(r.result.text);
  assert.equal(r.deadline, null);
  r.dispose();
});

test('Offline-Spieler blockieren nichts; wer wieder da ist, schätzt mit', () => {
  const { r, ids: [a, b, c] } = room();
  r.start(a);
  r.players.get(c).connected = false;
  r.guess(a, '1');
  assert.equal(r.stage, 'write');
  r.guess(b, '2'); // Cara ist offline → es geht sofort weiter
  assert.equal(r.stage, 'reveal');
  assert.deepEqual(r.reveal.missing, [c]);
  r.dispose();
});

test('Zuschauer dürfen nur mitmachen, wenn der Host es erlaubt – ohne Punkte', () => {
  for (const allowed of [false, true]) {
    const { r, ids: [a, b] } = room(['Anna', 'Ben'], { spectators: allowed, rounds: 1 });
    const z = r.addPlayer('Zoe', null).id;
    r.start(a);
    assert.equal(r.view(z).g.canAnswer, allowed);
    if (!allowed) assert.throws(() => r.guess(z, '5'), /nicht mit/);
    else {
      r.guess(z, '5');
      assert.equal(r.stage, 'write', 'Zuschauer halten die Stufe nicht auf und beenden sie nicht');
      assert.equal(r.view(a).players.find((p) => p.id === z).ready, false);
    }
    r.guess(a, '1'); r.guess(b, '2');
    if (allowed) {
      const g = r.reveal.guesses.find((x) => x.id === z);
      assert.equal(g.spectator, true);
      assert.equal(r.gamePts[z], undefined, 'Zuschauer bekommen keine Punkte');
    }
    r.dispose();
  }
});

test('Eigene Fragen: nur der Host, nur zwischen den Partien, Format, Grenzen, bleiben nach dem Neustart, nur der Host sieht sie', () => {
  const { r, ids: [a, b] } = room();
  assert.throws(() => r.setCustom(b, 'Wie viele? | 5 | x'), /Host/);
  const res = r.setCustom(a, 'Wie viele Stufen hat der Turm? | 56 | Stufen\nkaputt ohne Zahl\n<b>Fett</b> oder nicht? | 3,5\n\n | 4');
  assert.deepEqual(res.reply, { count: 2, skipped: 2 });
  assert.equal(r.custom[0].a, 56);
  assert.equal(r.custom[0].unit, 'Stufen');
  assert.equal(r.custom[1].q, '<b>Fett</b> oder nicht?');
  assert.deepEqual(r.view(a).custom, ['Wie viele Stufen hat der Turm? | 56 | Stufen', '<b>Fett</b> oder nicht? | 3,5']);
  assert.equal(r.view(b).custom, undefined, 'andere sehen die Liste nicht');
  r.start(a);
  assert.equal(r.view(a).custom, undefined, 'während der Partie sieht auch der Host die Antworten nicht');
  r.phase = 'over'; r.stage = null;
  const many = Array.from({ length: 150 }, (_, i) => `Frage Nummer ${i} hier | ${i}`).join('\n');
  assert.equal(r.setCustom(a, many).reply.count, 100);
  r.setCustom(a, 'Erste eigene Frage? | 1\nZweite eigene Frage? | 2');
  const back = SM.restore(JSON.parse(JSON.stringify({ ...r.snapshot(), game: 'schaetzmeister', code: r.code })), () => {});
  assert.deepEqual(back.custom.map((c) => c.a), [1, 2], 'überlebt Neustart');
  r.start(a);
  assert.throws(() => r.setCustom(a, 'Mitten drin? | 1'), /zwischen/);
  // Eigene Fragen kommen zuerst dran
  assert.ok(['Erste eigene Frage?', 'Zweite eigene Frage?'].includes(r.cur.q));
  r.dispose(); back.dispose();
});

test('Der Host kann eine Stufe vorzeitig beenden, andere nicht', () => {
  const { r, ids: [a, b] } = room();
  r.start(a);
  assert.throws(() => r.next(b), /Host/);
  r.next(a);
  assert.equal(r.stage, 'reveal');
  assert.equal(r.reveal.guesses.length, 0);
  assert.match(r.log.at(-1).text, /niemand/);
  r.next(a);
  assert.equal(r.q, 1);
  r.dispose();
});

test('Punkte-Ziel beendet die Partie früher; Abendpunkte wachsen über mehrere Partien', () => {
  const { r, ids: [a, b] } = room(['Anna', 'Ben'], { rounds: 10, target: 3 });
  r.setCustom(a, 'Eine Testfrage hier? | 100');
  r.start(a);
  r.guess(a, '100'); r.guess(b, '90'); // Anna: 3 + 2 Bonus
  assert.equal(r.gamePts[a], 5);
  assert.equal(r.phase, 'playing');
  r.next(a);
  assert.equal(r.phase, 'over', 'Ziel erreicht');
  assert.deepEqual(r.result.winners, [a]);
  assert.equal(r.scores[a], 5);
  assert.equal(r.wins[a], 1);
  r.dispose();
});

test('Mitspieler steigt mitten in der Partie aus: die Partie läuft weiter, bei zu wenigen endet sie', () => {
  const { r, ids: [a, b, c] } = room();
  r.start(a);
  r.stand(c);
  assert.equal(r.phase, 'playing');
  assert.deepEqual(r.order, [a, b]);
  r.guess(a, '1'); r.guess(b, '2');
  assert.equal(r.stage, 'reveal', 'Cara wird nicht mehr abgewartet');
  r.stand(b);
  assert.equal(r.phase, 'over');
  assert.match(r.result.text, /zu wenige/i);
  r.dispose();
});

test('Ungültige Eingaben werden abgelehnt', () => {
  const { r, ids: [a, b] } = room();
  r.start(a);
  for (const bad of ['', 'abc', '1e5', '1,2,3', '12abc', '--5', '9'.repeat(40), null, {}, '1.2.3']) assert.throws(() => r.guess(a, bad), /Zahl|nicht/, String(bad));
  assert.throws(() => r.guess('nobody', '5'), /nicht mit/);
  r.next(a);
  assert.throws(() => r.guess(a, '5'), /nicht geschätzt/);
  r.dispose();
});

test('Bots geben ihre Antwort ab (auch vor dem Menschen), halten die Runde nicht auf', async () => {
  const { r, ids: [a] } = room(['Anna']);
  r.opts.minPlayers = 2;
  addBot(r, a); addBot(r, a);
  r.start(a);
  const bots = r.order.filter((id) => r.players.get(id).bot);
  assert.equal(bots.length, 2);
  assert.ok(nextBot(r), 'ein Bot ist dran, obwohl niemand „am Zug“ ist');
  assert.equal(r.currentId, null);
  const runner = createBotRunner({ isCurrent: () => true, notify: () => {}, delay: 1 });
  try {
    runner.sync(r);
    const t = Date.now() + 2000;
    while (nextBot(r) && Date.now() < t) { await wait(5); runner.sync(r); }
    assert.equal(nextBot(r), null);
    assert.ok(bots.every((id) => r.isReady(id)));
    assert.equal(r.stage, 'write', 'der Mensch fehlt noch');
    r.guess(a, '42');
    assert.equal(r.stage, 'reveal');
  } finally { runner.stop(r); r.dispose(); }
});

test('Massentest Schätzmeister: 300 zufällige Partien mit 2–12 Spielern, Bots und Lücken', () => {
  let seed = 4242;
  const rng = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let games = 0, steps = 0;
  for (let n = 0; n < 300; n++) {
    const count = 2 + Math.floor(rng() * 11);
    const r = SM.create('MASS' + n, {
      rounds: 1 + Math.floor(rng() * 8), target: rng() < 0.3 ? 5 + Math.floor(rng() * 20) : 0, spectators: rng() < 0.5, percent: rng() < 0.5,
    }, () => {});
    const ids = Array.from({ length: count }, (_, k) => { const p = r.addPlayer('Bot' + k, null); p.connected = true; r.sit(p.id); return p.id; });
    const z = r.addPlayer('Zuschauer', null).id;
    r.start(ids[0]);
    let k = 0;
    while (r.phase === 'playing') {
      if (++k > 200) assert.fail(`Partie ${n} endet nicht`);
      if (r.stage === 'write') {
        for (const id of ids) {
          if (rng() < 0.15 || !r.order.includes(id)) continue; // manche geben nichts ab
          BOTS.schaetzmeister(r, id, rng);
          assert.equal(r.view(id).g.mine !== null, true);
        }
        if (r.stage === 'write' && r.settings.spectators && rng() < 0.5) r.guess(z, String(Math.floor(rng() * 1000)));
        // Niemand sieht fremde Schätzungen in der Schreibstufe
        if (r.stage === 'write') assert.equal(r.view(z).g.reveal, null);
        if (r.stage === 'write') r.next(ids[0]);
      } else r.next(ids[0]);
      for (const id of ids) assert.ok((r.gamePts[id] ?? 0) >= 0);
    }
    assert.equal(r.phase, 'over');
    const total = Object.values(r.gamePts).reduce((a, b) => a + b, 0);
    assert.equal(Object.values(r.scores).reduce((a, b) => a + b, 0), total, 'Abendpunkte = Partiepunkte');
    assert.ok(r.result.text);
    steps += k; games++;
    r.dispose();
  }
  console.log(`  Schätzmeister: ${games} Partien, Ø ${Math.round(steps / games)} Schritte`);
});
