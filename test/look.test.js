// „Ansehen“: nur offene Informationen. Zugliste, Skip-Bo-Ablagen, Tauschverlauf, Ansagen und frühere Partyrunden
// dürfen nichts enthalten, was ein Mitspieler oder Zuschauer nicht ohnehin sehen darf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { BOTS } from '../games/bots.js';
import { seeded, PLAN } from './sim-helpers.js';

function table(id, count, rng, settings = {}) {
  const room = GAMES[id].create('LOOK', settings, () => {});
  if ('roll' in room) room.roll = () => Math.floor(rng() * 6) + 1;
  const ids = Array.from({ length: count }, (_, k) => { const p = room.addPlayer('S' + k, null); room.sit(p.id); return p.id; });
  const z = room.addPlayer('Zuschauer', null).id;
  return { room, ids, z };
}

for (const [id, plan] of Object.entries(PLAN)) {
  test(`Zugliste ${GAMES[id].name}: für alle Mitspieler und Zuschauer gleich (nichts Privates), höchstens 40 Einträge`, () => {
    const rng = seeded(99 + id.length);
    for (let n = 0; n < 12; n++) {
      const count = Math.max(plan.players[0], 2 > plan.players[1] ? 1 : 2);
      const { room, ids, z } = table(id, Math.min(count + (n % 2), plan.players[1]), rng, plan.settings);
      room.start(ids[0]);
      let k = 0;
      while (room.phase === 'playing' && k++ < 200) {
        BOTS[id](room, room.currentId, rng);
        const seen = [...ids, z].map((v) => JSON.stringify(room.view(v).moves));
        assert.ok(seen.every((x) => x === seen[0]), `${id}: Zugliste hängt vom Betrachter ab`);
        assert.ok(room.view(z).moves.length <= 40);
      }
      room.dispose();
    }
  });
}

test('Mäxchen: Zugliste enthält nur Ansagen, nie den echten Wurf unter dem Becher', () => {
  const rng = seeded(5);
  const OK = /^(würfelt|glaubt und würfelt|sagt .+|zweifelt!|ungesehen: .+|lässt gelten)$/;
  for (let n = 0; n < 40; n++) {
    const { room, ids, z } = table('maexchen', 3, rng, { lives: 3 });
    room.start(ids[0]);
    for (let k = 0; k < 60 && room.phase === 'playing'; k++) {
      BOTS.maexchen(room, room.currentId, rng);
      for (const m of room.view(z).moves) { assert.ok(OK.test(m.t), `unerwarteter Eintrag: ${m.t}`); assert.equal(m.d, undefined, 'keine Einzelheiten'); }
      assert.equal(room.view(z).g?.cup ?? null, null, 'Zuschauer sieht den Becher nicht');
    }
    room.dispose();
  }
});

test('Skip-Bo: fremde Ansicht enthält Ablagen, Baureihen und Joker, aber keine Handkarten, keinen Nachziehstapel und nur die oberste Stapelkarte', () => {
  const rng = seeded(11);
  for (let n = 0; n < 15; n++) {
    const { room, ids, z } = table('stapelrennen', 3, rng, { stockSize: 10 });
    room.start(ids[0]);
    for (let k = 0; k < 120 && room.phase === 'playing'; k++) {
      BOTS.stapelrennen(room, room.currentId, rng);
      const v = room.view(ids[1]);
      const g = v.g;
      assert.equal(typeof g.deck, 'number', 'Nachziehstapel nur als Zahl');
      assert.ok(g.build.every((b) => Array.isArray(b.jokers) && b.jokers.every((j) => j >= 0 && j < b.count)), 'Joker liegen in der Reihe');
      for (const p of v.players.filter((p) => p.inRound)) {
        assert.equal(typeof p.stock, 'number', 'Stapel nur als Anzahl');
        assert.equal(typeof p.cards, 'number', 'Hand nur als Anzahl');
        assert.ok(Array.isArray(p.piles) && p.piles.length === 4, 'Ablagen sind offen');
        assert.ok(!('hand' in p) && !('stockCards' in p));
      }
      // Zuschauer: gar keine Handkarten
      assert.equal(room.view(z).g.hand, null);
      // fremde Handkarten stehen nirgends im Text der Ansicht des Mitspielers (Anzahl ja, Inhalt nein)
      assert.deepEqual(g.hand, room.hand[ids[1]], 'nur die eigene Hand');
    }
    room.dispose();
  }
});

test('Schwimmen: Tauschverlauf zeigt nur Karten, die in der Mitte lagen oder dorthin gelegt wurden', () => {
  const rng = seeded(21);
  for (let n = 0; n < 40; n++) {
    const { room, ids, z } = table('schwimmen', 3, rng);
    room.start(ids[0]);
    for (let k = 0; k < 40 && room.phase === 'playing'; k++) {
      const before = [...room.middle];
      const hands = Object.fromEntries(room.order.map((i) => [i, [...room.hands[i]]]));
      const cur = room.currentId;
      BOTS.schwimmen(room, cur, rng);
      const last = room.view(z).moves.at(-1);
      if (last?.d) {
        assert.ok(last.d.took.every((c) => before.includes(c)), 'genommene Karten lagen offen in der Mitte');
        assert.ok(last.d.gave.every((c) => hands[cur].includes(c)), 'abgegebene Karten kamen vom Spieler');
      }
    }
    room.dispose();
  }
});

test('Partyspiele: frühere Runden sind nur schon aufgelöste Fragen', () => {
  const rng = seeded(31);
  for (const id of ['schlagfertig', 'werhatdasgesagt', 'schaetzmeister']) {
    for (let n = 0; n < 10; n++) {
      const { room, ids, z } = table(id, 4, rng);
      room.start(ids[0]);
      for (let k = 0; k < 400 && room.phase === 'playing'; k++) {
        for (const pid of ids) { try { BOTS[id](room, pid, rng); } catch { /* schon vorbei */ } }
        try { room.next(ids[0]); } catch { /* keine Stufe */ }
        const g = room.view(z).g;
        if (!g) continue;
        assert.ok((g.past || []).every((p) => p.q < g.q || g.stage === null), `${id}: unaufgelöste Frage in der Vergangenheit`);
      }
      room.dispose();
    }
  }
});
