// DOKO-WERTUNG-02: Wertung, Ansagen und Hochzeit nach den Turnierspielregeln des DDV (TSR, Stand 21.02.2026).
// Die erwarteten Werte sind von Hand aus dem Regelwerk abgeleitet (Abschnitt in jedem Fall genannt), nicht aus dem Code.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../games/doppelkopf/index.js';
import { Room } from '../games/doppelkopf/room.js';
import { announceOptions, base, dkDeck, scoreDeal } from '../games/doppelkopf/rules.js';

const team = { re: ['A', 'B'], kontra: ['C', 'D'] };
const lone = { re: ['A'], kontra: ['B', 'C', 'D'] };
const deal = (over = {}) => ({
  contract: { kind: 'normal' }, ...team, points: { re: 130, kontra: 110 }, tricks: { re: 7, kontra: 5 },
  levels: { re: 0, kontra: 0 }, specials: { re: 0, kontra: 0 }, ...over,
});
const total = (per) => Object.values(per).reduce((sum, n) => sum + n, 0);
const sameParity = (per) => new Set(Object.values(per).map((n) => Math.abs(n) % 2)).size === 1;
const teamPer = (v) => ({ A: v, B: v, C: -v || 0, D: -v || 0 });
const lonePer = (v) => ({ A: 3 * v, B: -v || 0, C: -v || 0, D: -v || 0 });
function expectScore(input, { winner, gamePoints, value, per }) {
  const r = scoreDeal(input);
  assert.equal(r.winner, winner, 'Sieger');
  if (gamePoints !== undefined) assert.equal(r.gamePoints, gamePoints, 'Spielpunkte');
  assert.equal(r.value, value, 'Wert');
  assert.deepEqual(r.per, per);
  assert.equal(total(r.per), 0, 'Nullsumme (7.3.3 Nr. 1)');
  assert.ok(sameParity(r.per), 'Gerade-Ungerade-Regel (7.3.3 Nr. 2)');
  return r;
}

test('DDV 7.1/7.2: Normalspiel ohne Absagen – 121/120, Ansagen und Sonderpunkt gegen die Kreuz-Damen', () => {
  expectScore(deal(), { winner: 're', gamePoints: 1, value: 1, per: teamPer(1) });
  expectScore(deal({ points: { re: 121, kontra: 119 } }), { winner: 're', gamePoints: 1, value: 1, per: teamPer(1) }); // 7.1.1 Nr. 1
  // Genau 120:120 mit allen Ansagekombinationen
  expectScore(deal({ points: { re: 120, kontra: 120 } }), { winner: 'kontra', gamePoints: 1, value: -2, per: teamPer(-2) }); // 7.1.2 Nr. 1 + Sonderpunkt 7.2.3
  expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 0, kontra: 1 } }), { winner: 're', gamePoints: 3, value: 3, per: teamPer(3) }); // 7.1.1 Nr. 4: 1 + Kontra 2
  expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 1, kontra: 0 } }), { winner: 'kontra', gamePoints: 3, value: -4, per: teamPer(-4) }); // 7.1.2 Nr. 2
  expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 1, kontra: 1 } }), { winner: 'kontra', gamePoints: 5, value: -6, per: teamPer(-6) }); // 7.1.2 Nr. 3
  // Nur Kontra angesagt: Kontra braucht 121 (7.1.2 Nr. 4)
  expectScore(deal({ points: { re: 119, kontra: 121 }, levels: { re: 0, kontra: 1 } }), { winner: 'kontra', gamePoints: 3, value: -4, per: teamPer(-4) });
  expectScore(deal({ points: { re: 121, kontra: 119 }, levels: { re: 0, kontra: 1 } }), { winner: 're', gamePoints: 3, value: 3, per: teamPer(3) });
});

test('DDV 6.3/7.1: Grenzwerte der Absagen keine 90, 60, 30', () => {
  // Re: keine 90 – erfüllt mit 151 (7.1.1 Nr. 5): 1 + unter 90 + Re 2 + keine 90 = 5
  expectScore(deal({ points: { re: 151, kontra: 89 }, levels: { re: 2, kontra: 0 } }), { winner: 're', gamePoints: 5, value: 5, per: teamPer(5) });
  // 150:90 – verfehlt, Kontra gewinnt mit 90 gegen keine 90 (7.1.2 Nr. 7): 1 + 2 + 1 = 4, dazu Sonderpunkt
  expectScore(deal({ points: { re: 150, kontra: 90 }, levels: { re: 2, kontra: 0 } }), { winner: 'kontra', gamePoints: 4, value: -5, per: teamPer(-5) });
  // Kontra erreicht 120 gegen keine 90: zusätzlicher Punkt (7.2.2 f)
  expectScore(deal({ points: { re: 100, kontra: 140 }, levels: { re: 2, kontra: 0 } }), { winner: 'kontra', gamePoints: 5, value: -6, per: teamPer(-6) });
  // Kontra sagt keine 90 ab: Re gewinnt schon mit 90 (7.1.1 Nr. 7): 1 + Kontra 2 + keine 90 = 4
  expectScore(deal({ points: { re: 90, kontra: 150 }, levels: { re: 0, kontra: 2 } }), { winner: 're', gamePoints: 4, value: 4, per: teamPer(4) });
  expectScore(deal({ points: { re: 89, kontra: 151 }, levels: { re: 0, kontra: 2 } }), { winner: 'kontra', gamePoints: 5, value: -6, per: teamPer(-6) });
  // keine 60: 181 erfüllt (1 + unter 90 + unter 60 + 2 + 2 = 7), 180 verfehlt – Kontra gewinnt mit 60 (1 + 2 + 2 = 5, Sonderpunkt)
  expectScore(deal({ points: { re: 181, kontra: 59 }, levels: { re: 3, kontra: 0 } }), { winner: 're', gamePoints: 7, value: 7, per: teamPer(7) });
  expectScore(deal({ points: { re: 180, kontra: 60 }, levels: { re: 3, kontra: 0 } }), { winner: 'kontra', gamePoints: 5, value: -6, per: teamPer(-6) });
  // keine 30: 211 erfüllt (1 + 3 + 2 + 3 = 9), 210 verfehlt (1 + 2 + 3 = 6, Sonderpunkt)
  expectScore(deal({ points: { re: 211, kontra: 29 }, levels: { re: 4, kontra: 0 } }), { winner: 're', gamePoints: 9, value: 9, per: teamPer(9) });
  expectScore(deal({ points: { re: 210, kontra: 30 }, levels: { re: 4, kontra: 0 } }), { winner: 'kontra', gamePoints: 6, value: -7, per: teamPer(-7) });
  // Kontra gewinnt mit eigener Absage keine 60: 1 + Re unter 90 + unter 60 + Kontra 2 + 2 = 7, dazu Sonderpunkt
  expectScore(deal({ points: { re: 59, kontra: 181 }, levels: { re: 0, kontra: 3 } }), { winner: 'kontra', gamePoints: 7, value: -8, per: teamPer(-8) });
});

test('DDV 6.3.1/7.1: schwarz ist eine Stichbedingung, nicht null Augen', () => {
  // Re sagt schwarz ab und bekommt alle Stiche: 1 + 4 + 2 + 4 = 11
  expectScore(deal({ points: { re: 240, kontra: 0 }, tricks: { re: 12, kontra: 0 }, levels: { re: 5, kontra: 0 } }), { winner: 're', gamePoints: 11, value: 11, per: teamPer(11) });
  // Kontra macht einen Stich ohne Augen: schwarz verfehlt, Kontra gewinnt mit dem ersten Stich (7.1.2 Nr. 8): 1 + 2 + 4 = 7, Sonderpunkt
  expectScore(deal({ points: { re: 240, kontra: 0 }, tricks: { re: 11, kontra: 1 }, levels: { re: 5, kontra: 0 } }), { winner: 'kontra', gamePoints: 7, value: -8, per: teamPer(-8) });
  // Ohne Absage: null Augen mit einem Stich ist unter 30, aber nicht schwarz gespielt (1 + 3 = 4)
  expectScore(deal({ points: { re: 240, kontra: 0 }, tricks: { re: 11, kontra: 1 } }), { winner: 're', gamePoints: 4, value: 4, per: teamPer(4) });
  expectScore(deal({ points: { re: 240, kontra: 0 }, tricks: { re: 12, kontra: 0 } }), { winner: 're', gamePoints: 5, value: 5, per: teamPer(5) });
  // Kontra sagt schwarz ab, Re macht einen Stich ohne Augen: Re gewinnt mit dem ersten Stich (7.1.1 Nr. 8): 1 + 2 + 4 = 7
  expectScore(deal({ points: { re: 0, kontra: 240 }, tricks: { re: 1, kontra: 11 }, levels: { re: 0, kontra: 5 } }), { winner: 're', gamePoints: 7, value: 7, per: teamPer(7) });
});

test('DDV 7.1.3: beidseitig verfehlte Absagen – kein Sieger, nur (a), (e), (f) und Sonderpunkte', () => {
  // 120:120 bei keine 90 gegen keine 90: je 1 Punkt für 120 gegen keine 90 – heben sich auf
  const tie = expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 2, kontra: 2 } }), { winner: null, gamePoints: 0, value: 0, per: teamPer(0) });
  assert.deepEqual(tie.breakdown.map((b) => b.party).sort(), ['kontra', 're']);
  // Re keine 60 (verfehlt mit 170), Kontra keine 90 (verfehlt mit 70): Re +1 Kontra unter 90, +1 für 120 gegen keine 90
  expectScore(deal({ points: { re: 170, kontra: 70 }, levels: { re: 3, kontra: 2 } }), { winner: null, gamePoints: 0, value: 2, per: teamPer(2) });
  // Sonderpunkte zählen auch ohne Sieger, ein Punkt „gegen die Kreuz-Damen“ entsteht nicht
  const sp = expectScore(deal({ points: { re: 170, kontra: 70 }, levels: { re: 3, kontra: 2 }, specials: { re: 0, kontra: 1 } }), { winner: null, gamePoints: 0, value: 1, per: teamPer(1) });
  assert.equal(sp.breakdown.some((b) => /Kreuz-Damen/.test(b.text)), false);
  // Re keine 90 (140), Kontra keine 60 (100): Re erreicht 120 gegen keine 90 und 90 gegen keine 60
  expectScore(deal({ points: { re: 140, kontra: 100 }, levels: { re: 2, kontra: 3 } }), { winner: null, gamePoints: 0, value: 2, per: teamPer(2) });
  // Ansagen und Absagen selbst zählen nicht (6.3.3)
  const r = scoreDeal(deal({ points: { re: 140, kontra: 100 }, levels: { re: 2, kontra: 3 } }));
  assert.equal(r.breakdown.some((b) => /angesagt|abgesagt/.test(b.text)), false);
});

test('DDV 7.2.3/7.2.4: Sonderpunkte nur im Normalspiel – Solo, stille Hochzeit und Hochzeit ohne Partner dreifach ohne Sonderpunkte', () => {
  const specials = { re: 3, kontra: 0 };
  // Normalspiel: Sonderpunkte gehen als Differenz in den Wert ein, auch gegen den Sieger
  expectScore(deal({ specials: { re: 0, kontra: 3 } }), { winner: 're', gamePoints: 1, value: -2, per: teamPer(-2) });
  expectScore(deal({ specials }), { winner: 're', gamePoints: 1, value: 4, per: teamPer(4) });
  // Hochzeit mit Partner ist Normalspiel: Sonderpunkt gegen die Kreuz-Damen
  expectScore(deal({ contract: { kind: 'hochzeit' }, points: { re: 120, kontra: 120 } }), { winner: 'kontra', gamePoints: 1, value: -2, per: teamPer(-2) });
  // Stille Hochzeit wie ein Solo (4.4.5): Re-Sieg 180:60 mit Re-Ansage = 1 + unter 90 + 2 = 4
  const sw = expectScore(deal({ ...lone, points: { re: 180, kontra: 60 }, levels: { re: 1, kontra: 0 }, specials }), { winner: 're', gamePoints: 4, value: 4, per: lonePer(4) });
  assert.equal(sw.kind, 'stille-hochzeit'); assert.equal(sw.specialsCounted, false);
  // Stille Hochzeit, Kontra schwarz nach Re-Ansage: 1 + 4 + 2 = 7 → −21/+7
  expectScore(deal({ ...lone, points: { re: 0, kontra: 240 }, tricks: { re: 0, kontra: 12 }, levels: { re: 1, kontra: 0 } }), { winner: 'kontra', gamePoints: 7, value: -7, per: lonePer(-7) });
  // 120:120 in der stillen Hochzeit: Kontra gewinnt, ohne Sonderpunkt
  expectScore(deal({ ...lone, points: { re: 120, kontra: 120 }, specials: { re: 0, kontra: 2 } }), { winner: 'kontra', gamePoints: 1, value: -1, per: lonePer(-1) });
  // Hochzeit ohne Partner wie ein Karo-Solo (4.4.3 b)
  const hz = expectScore(deal({ contract: { kind: 'hochzeit' }, ...lone, points: { re: 100, kontra: 140 }, specials }), { winner: 'kontra', gamePoints: 1, value: -1, per: lonePer(-1) });
  assert.equal(hz.kind, 'hochzeit-allein');
});

test('DDV 7.2.4: alle Soloarten werden gleich abgerechnet', () => {
  for (const solo of ['queens', 'jacks', 'plain', 'c', 's', 'h', 'd']) {
    const contract = { kind: 'solo', solo };
    expectScore(deal({ contract, ...lone }), { winner: 're', gamePoints: 1, value: 1, per: lonePer(1) });
    expectScore(deal({ contract, ...lone, points: { re: 120, kontra: 120 }, specials: { re: 0, kontra: 4 } }), { winner: 'kontra', gamePoints: 1, value: -1, per: lonePer(-1) });
    expectScore(deal({ contract, ...lone, points: { re: 190, kontra: 50 }, levels: { re: 1, kontra: 0 } }), { winner: 're', gamePoints: 5, value: 5, per: lonePer(5) });
    expectScore(deal({ contract, ...lone, points: { re: 110, kontra: 130 }, levels: { re: 0, kontra: 1 } }), { winner: 'kontra', gamePoints: 3, value: -3, per: lonePer(-3) });
    // Beide verfehlen ihre Absage im Solo: Solist 140 erreicht 120 gegen keine 90 → +1, dreifach
    expectScore(deal({ contract, ...lone, points: { re: 140, kontra: 100 }, levels: { re: 2, kontra: 2 } }), { winner: null, gamePoints: 0, value: 1, per: lonePer(1) });
  }
});

test('DOKO-WERTUNG-02: jede Kombination aus Augen, Stichen, Ansagen, Sonderpunkten und Parteien ist nullsummig und gerade/ungerade', () => {
  let cases = 0;
  for (const contract of [{ kind: 'normal' }, { kind: 'hochzeit' }, { kind: 'solo', solo: 'c' }, { kind: 'solo', solo: 'plain' }]) {
    for (const parties of contract.kind === 'solo' ? [lone] : [team, lone]) {
      for (let re = 0; re <= 240; re += 10) for (const extra of [0, 1]) {
        const points = { re: Math.min(240, re + extra), kontra: 240 - Math.min(240, re + extra) };
        for (const zeroTrick of [false, true]) {
          const tricks = { re: points.re || zeroTrick ? 6 : 0, kontra: points.kontra || zeroTrick ? 6 : 0 };
          for (let lr = 0; lr <= 5; lr++) for (let lk = 0; lk <= 5; lk++) for (const sr of [0, 2]) for (const sk of [0, 3]) {
            const r = scoreDeal(deal({ contract, ...parties, points, tricks, levels: { re: lr, kontra: lk }, specials: { re: sr, kontra: sk } }));
            const why = JSON.stringify({ contract, parties, points, tricks, lr, lk, sr, sk });
            assert.equal(total(r.per), 0, why);
            assert.ok(sameParity(r.per), why);
            // Höchstens eine Partei erreicht ihr Ziel; ohne zwei Absagen gibt es immer einen Sieger (7.1)
            assert.ok(!(r.reMet && r.kMet), why);
            if (lr < 2 || lk < 2) assert.ok(r.winner, why);
            cases++;
          }
        }
      }
    }
  }
  assert.ok(cases > 20_000, String(cases));
});

test('DDV 6.2–6.4: Ansagefristen, Überspringen, Erwiderung und Hochzeitsverschiebung', () => {
  const N = 12, opt = (o) => announceOptions({ N, ...o });
  // Erstansage bis 11 Karten, danach nicht mehr; überspringen ist erlaubt (6.2.2, 6.4.3)
  assert.deepEqual(opt({ cards: 12, own: 0, opp: 0 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 11, own: 0, opp: 0 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 10, own: 0, opp: 0 }), []);
  // Absagen: keine 90 bis 10, keine 60 bis 9, keine 30 bis 8, schwarz bis 7 Karten (6.3.4)
  assert.deepEqual(opt({ cards: 10, own: 1, opp: 0 }), [2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 9, own: 1, opp: 0 }), []);
  assert.deepEqual(opt({ cards: 9, own: 2, opp: 0 }), [3, 4, 5]);
  assert.deepEqual(opt({ cards: 8, own: 3, opp: 0 }), [4, 5]);
  assert.deepEqual(opt({ cards: 7, own: 4, opp: 0 }), [5]);
  assert.deepEqual(opt({ cards: 6, own: 4, opp: 0 }), []);
  assert.deepEqual(opt({ cards: 12, own: 5, opp: 0 }), []);
  // Erwiderung mit einer Karte weniger, nur Re/Kontra (6.4.4)
  assert.deepEqual(opt({ cards: 10, own: 0, opp: 1 }), [1]);
  assert.deepEqual(opt({ cards: 9, own: 0, opp: 1 }), []);
  assert.deepEqual(opt({ cards: 9, own: 0, opp: 2 }), [1]); // gegen keine 90 (10 Karten) bis 9 Karten
  assert.deepEqual(opt({ cards: 8, own: 0, opp: 3 }), [1]);
  assert.deepEqual(opt({ cards: 7, own: 0, opp: 3 }), []);
  // Nach verspäteter Erwiderung keine Absage der eigenen Partei
  assert.deepEqual(opt({ cards: 10, own: 1, opp: 1, late: true }), []);
  // Angemeldete Hochzeit: Klärungsstich 2 bzw. 3 verringert die Kartenzahl um 1 bzw. 2 (6.4.2)
  assert.deepEqual(opt({ cards: 10, own: 0, opp: 0, shift: 1 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 9, own: 0, opp: 0, shift: 1 }), []);
  assert.deepEqual(opt({ cards: 9, own: 0, opp: 0, shift: 2 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 8, own: 1, opp: 0, shift: 2 }), [2, 3, 4, 5]);
  assert.deepEqual(opt({ cards: 8, own: 0, opp: 1, shift: 2 }), [1]);
  assert.deepEqual(opt({ cards: 7, own: 0, opp: 1, shift: 2 }), []);
  // Ohne Neunen (10 Karten) verschieben sich alle Fristen um zwei
  assert.deepEqual(announceOptions({ N: 10, cards: 9, own: 0, opp: 0 }), [1, 2, 3, 4, 5]);
  assert.deepEqual(announceOptions({ N: 10, cards: 8, own: 0, opp: 0 }), []);
});

// ---------- Raumtests ----------
function makeRoom(hands) {
  const table = new Room('DK-DDV', { turnTime: 0 }, () => {});
  const ids = Array.from({ length: 4 }, (_, i) => { const p = table.addPlayer('P' + i, null); table.sit(p.id); return p.id; });
  const key = () => ({ key: table.dealKey, revision: table.revision });
  if (hands) {
    const rest = dkDeck(true).filter((c) => !hands.flat().includes(c));
    const full = hands.map((h) => [...h]);
    for (const h of full) while (h.length < 12) h.push(rest.shift());
    table.deckFactory = () => full.flat();
  }
  return { table, ids, key };
}
const playOne = (table, key, card) => { const id = table.currentId; table.play(id, { ...key(), card: card || table.allowed(id)[0] }); return id; };
const finishTrick = (table, key) => { do playOne(table, key); while (table.trick.length); };
const snapshot = (table, ids) => JSON.stringify(ids.map((id) => table.view(id).g));

// Hochzeiter P0: beide Kreuz-Damen, beide Dullen und zwei Kreuz-Neunen; P1 hat die Kreuz-Asse und gewinnt jeden Kreuz-Stich.
const WEDDING = [['Qc0', 'Qc1', 'Th0', 'Th1', '9c0', '9c1'], ['Ac0', 'Ac1'], ['Kc0', 'Kc1'], ['Tc0', 'Tc1']];
function wedding(clarifyAt) {
  const r = makeRoom(WEDDING);
  r.table.start(r.ids[0]);
  r.table.reserve(r.ids[0], { ...r.key(), choice: 'hochzeit' });
  for (const id of r.ids.slice(1)) r.table.reserve(id, { ...r.key(), choice: 'healthy' });
  const leads = { 1: ['9c0'], 2: ['Th0', '9c0'], 3: ['Th0', 'Th1', '9c0'], 0: ['Th0', 'Th1', 'Qc0'] }[clarifyAt];
  return { ...r, leads };
}

test('DDV 4.4.4/6.4.2: angemeldete Hochzeit – Erstansage erst nach dem Klärungsstich 1, 2 oder 3, Fristen verschoben', () => {
  for (const at of [1, 2, 3]) {
    const { table, ids, key, leads } = wedding(at);
    leads.forEach((card, i) => {
      // Vor und während des Klärungsstichs darf niemand ansagen – auch der Hochzeiter nicht.
      for (const id of ids) assert.deepEqual(table.announceLevels(id), [], `Stich ${i + 1} von ${at}`);
      assert.throws(() => table.announce(ids[0], { ...key(), level: 1 }), /nicht möglich/);
      playOne(table, key, card); finishTrick(table, key);
    });
    assert.equal(table.partner, ids[1]); assert.equal(table.clarifyTrick, at);
    // Unmittelbar danach hat jeder 12 − at Karten: Erstansage für alle zulässig (Frist 11 − (at − 1)).
    for (const id of ids) assert.deepEqual(table.announceLevels(id), [1, 2, 3, 4, 5], `nach Klärungsstich ${at}`);
    // Nach der nächsten eigenen Karte ist die Erstansage zu spät.
    const leader = playOne(table, key);
    assert.deepEqual(table.announceLevels(leader), [], `Spieler nach seiner Karte, Klärungsstich ${at}`);
    // Erwiderung: Re sagt an, der Gegner darf noch mit einer Karte weniger „Kontra“ sagen.
    const reId = ids.find((id) => table.partyMap[id] === 're' && id !== leader) || ids[0];
    if (table.announceLevels(reId).includes(1)) table.announce(reId, { ...key(), level: 1 });
    const kontraLeader = table.partyMap[leader] === 'kontra' ? leader : null;
    if (kontraLeader) assert.deepEqual(table.announceLevels(kontraLeader), [1]);
  }
});

test('DDV 4.4.3 b: Hochzeit ohne Partner wird nach Stich 3 zum Karo-Solo – Ansage mit 9 Karten, Abrechnung dreifach ohne Sonderpunkte', () => {
  const { table, ids, key, leads } = wedding(0);
  for (const card of leads) { playOne(table, key, card); finishTrick(table, key); }
  assert.equal(table.partner, null); assert.equal(table.clarifyTrick, 3);
  assert.deepEqual(ids.map((id) => table.partyMap[id]), ['re', 'kontra', 'kontra', 'kontra']);
  assert.deepEqual(table.announceLevels(ids[0]), [1, 2, 3, 4, 5]);
  table.announce(ids[1], { ...key(), level: 1 });
  while (table.stage === 'play') playOne(table, key);
  const d = table.lastDeal;
  assert.equal(d.kind, 'hochzeit-allein'); assert.deepEqual(d.specials, []);
  assert.equal(d.per[ids[0]], 3 * d.value);
  for (const id of ids.slice(1)) assert.equal(d.per[id], -d.value);
  assert.equal(total(d.per), 0); assert.ok(sameParity(d.per));
});

test('DDV 6.4.1/6.4.4/6.4.7: Ansage außerhalb des Zugs, Erwiderung, abgelehnte und doppelte Ansagen ändern nichts', () => {
  // P0 und P1 sind Re (je eine Kreuz-Dame), P2 und P3 Kontra.
  const { table, ids, key } = makeRoom([['Qc0'], ['Qc1'], [], []]);
  table.start(ids[0]);
  for (const id of ids) table.reserve(id, { ...key(), choice: 'healthy' });
  const stale = key();
  playOne(table, key); // P0 legt die erste Karte
  // P1 sagt mit der Revision von vor dem Kartenzug „Re“ an: zulässig, der Kartenzug bleibt beim Spieler, der dran ist.
  const due = table.currentId;
  table.announce(ids[1], { ...stale, level: 1 });
  assert.equal(table.levels.re, 1); assert.equal(table.currentId, due);
  // Doppelte Ansage derselben Partei, falsche Partie und künftige Revision werden abgelehnt, ohne den Stand zu ändern.
  for (const [id, data, re] of [
    [ids[0], { ...key(), level: 1 }, /nicht möglich/],
    [ids[1], { ...key(), level: 1 }, /nicht möglich/],
    [ids[2], { key: 'alt', revision: table.revision, level: 1 }, /nicht mehr aktuell/],
    [ids[2], { ...key(), revision: table.revision + 1, level: 1 }, /nicht mehr aktuell/],
  ]) {
    const before = snapshot(table, ids);
    assert.throws(() => table.announce(id, data), re);
    assert.equal(snapshot(table, ids), before);
  }
  // Kontra (12 Karten) darf rechtzeitig sogar mit Sprung ansagen; hier warten wir bis zur Erwiderungsfrist.
  while (table.hands[ids[2]].length > 10) playOne(table, key);
  assert.equal(table.hands[ids[2]].length, 10);
  assert.deepEqual(table.announceLevels(ids[2]), [1]); // nur noch Erwiderung „Kontra“
  assert.throws(() => table.announce(ids[2], { ...key(), level: 2 }), /nicht möglich/);
  table.announce(ids[2], { ...key(), level: 1 });
  assert.equal(table.levels.kontra, 1);
  // Erwiderung war nicht mehr als Erstansage rechtzeitig: keine Absage der Kontra-Partei (6.4.4)
  assert.deepEqual(table.announceLevels(ids[2]), []);
  assert.deepEqual(table.announceLevels(ids[3]), []);
  // Spieler mit 9 Karten darf gar nicht mehr erwidern
  const { table: t2, ids: i2, key: k2 } = makeRoom([['Qc0'], ['Qc1'], [], []]);
  t2.start(i2[0]);
  for (const id of i2) t2.reserve(id, { ...k2(), choice: 'healthy' });
  t2.announce(i2[0], { ...k2(), level: 1 });
  while (t2.hands[i2[2]].length > 9) playOne(t2, k2);
  assert.deepEqual(t2.announceLevels(i2[2]), []);
});

test('DDV 4.4.5: stille Hochzeit bleibt geheim, behält die Normalspielfristen und wird wie ein Solo abgerechnet', () => {
  const { table, ids, key } = makeRoom([['Qc0', 'Qc1'], [], [], []]);
  table.start(ids[0]);
  const spectator = table.addPlayer('Zuschauer', null).id;
  for (const id of ids) table.reserve(id, { ...key(), choice: 'healthy' });
  for (const id of [...ids.slice(1), spectator]) {
    const g = table.view(id).g;
    assert.equal(g.contract.kind, 'normal'); assert.equal(g.hochzeit, null); assert.deepEqual(g.known, {});
    assert.ok(!/stille|hochzeit-allein/.test(JSON.stringify(table.view(id))));
  }
  // Fristen wie im Normalspiel: Erstansage bis 11 Karten für beide Seiten
  assert.deepEqual(table.announceLevels(ids[0]), [1, 2, 3, 4, 5]);
  assert.deepEqual(table.announceLevels(ids[1]), [1, 2, 3, 4, 5]);
  table.announce(ids[0], { ...key(), level: 1 });
  assert.deepEqual(table.knownParties(), { [ids[0]]: 're' });
  while (table.stage === 'play') playOne(table, key);
  const d = table.lastDeal;
  assert.equal(d.kind, 'stille-hochzeit'); assert.deepEqual(d.specials, []);
  assert.equal(d.per[ids[0]], 3 * d.value);
  assert.equal(total(d.per), 0); assert.equal(total(table.totals), 0); assert.ok(sameParity(d.per));
});

test('DOKO-WERTUNG-02: stille Hochzeit im Raum – vollständige Partie, Re schwarz', () => {
  for (const [announce, value] of [[true, -7], [false, -5]]) {
    const { table, ids, key } = makeRoom();
    const cards = dkDeck(true);
    table.deckFactory = () => [...cards.filter((c) => base(c) === 'Qc'), ...cards.filter((c) => base(c) !== 'Qc')];
    table.start(ids[0]);
    for (const id of ids) table.reserve(id, { ...key(), choice: 'healthy' });
    if (announce) table.announce(ids[0], { ...key(), level: 1 });
    while (table.stage === 'play') playOne(table, key);
    const d = table.lastDeal;
    // Diese feste Verteilung endet 0:240 Augen, Re ohne Stich: Kontra 1 + unter 90/60/30 + schwarz = 5, mit Re-Ansage + 2 = 7.
    assert.deepEqual(d.points, { re: 0, kontra: 240 }); assert.deepEqual(d.tricks, { re: 0, kontra: 12 });
    assert.equal(d.winner, 'kontra'); assert.equal(d.value, value);
    assert.equal(d.per[ids[0]], 3 * value);
    for (const id of ids.slice(1)) assert.equal(d.per[id], -value);
    assert.deepEqual(table.gameView(ids[1]).lastDeal.per, d.per);
    assert.ok(d.breakdown.length > 0 && d.breakdown.every((b) => ['re', 'kontra'].includes(b.party) && b.points > 0));
  }
});

test('DOKO-WERTUNG-02: alle Soloarten im Raum – Solist dreifach, keine Sonderpunkte, nullsummig', () => {
  for (const solo of ['queens', 'jacks', 'plain', 'c', 's', 'h', 'd']) {
    const { table, ids, key } = makeRoom();
    table.start(ids[0]);
    table.reserve(ids[0], { ...key(), choice: solo });
    assert.equal(table.contract.solo, solo);
    while (table.stage === 'play') playOne(table, key);
    const d = table.lastDeal;
    assert.equal(d.kind, 'solo'); assert.deepEqual(d.specials, []);
    assert.equal(d.per[ids[0]], 3 * d.value);
    assert.equal(total(d.per), 0); assert.ok(sameParity(d.per));
  }
});

test('DOKO-WERTUNG-02: Ansageton – Mehrstufensprung ein Ton, verspätete ältere oder abgelehnte Zustände keinen', async () => {
  const { events } = await import('../public/games/doppelkopf/experience.js');
  const G = (g) => ({ g: { dealKey: 'k', stage: 'play', levels: { re: 0, kontra: 0 }, known: {}, trick: [], lastTrick: null, ...g } });
  assert.deepEqual(events(G({}), G({ levels: { re: 2, kontra: 0 } })), [{ type: 'call', party: 're' }]);
  const newer = G({ levels: { re: 1, kontra: 1 } }), older = G({ levels: { re: 1, kontra: 0 } });
  assert.deepEqual(events(newer, older), []);
  assert.deepEqual(events(older, newer), [{ type: 'call', party: 'kontra' }]);
  // Eine abgelehnte Ansage ändert den Zustand nicht: kein Ton.
  const { table, ids, key } = makeRoom([['Qc0'], ['Qc1'], [], []]);
  table.start(ids[0]);
  for (const id of ids) table.reserve(id, { ...key(), choice: 'healthy' });
  table.announce(ids[0], { ...key(), level: 1 });
  const before = table.view(ids[2]);
  assert.throws(() => table.announce(ids[1], { ...key(), level: 1 }));
  assert.deepEqual(events(before, table.view(ids[2])), []);
});
