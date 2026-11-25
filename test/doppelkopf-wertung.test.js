// DOKO-WERTUNG-02: Wertungsmatrix, stille Hochzeit und Nullsumme.
import test from 'node:test';
import assert from 'node:assert/strict';
import '../games/doppelkopf/index.js';
import { Room } from '../games/doppelkopf/room.js';
import { base, dkDeck, scoreDeal } from '../games/doppelkopf/rules.js';

const team = { re: ['A', 'B'], kontra: ['C', 'D'] };
const lone = { re: ['A'], kontra: ['B', 'C', 'D'] };
const deal = (over = {}) => ({
  contract: { kind: 'normal' }, ...team, points: { re: 130, kontra: 110 }, tricks: { re: 7, kontra: 5 },
  levels: { re: 0, kontra: 0 }, specials: { re: 0, kontra: 0 }, ...over,
});
const total = (per) => Object.values(per).reduce((sum, n) => sum + n, 0);
function expectScore(input, { winner, gamePoints, value, per, detail }) {
  const r = scoreDeal(input);
  assert.equal(r.winner, winner);
  assert.equal(r.gamePoints, gamePoints);
  assert.equal(r.value, value);
  assert.deepEqual(r.per, per);
  assert.equal(total(r.per), 0, 'Nullsumme');
  if (detail) assert.deepEqual(r.detail, detail);
  return r;
}

test('DOKO-WERTUNG-02: Normalspiel 2 gegen 2 – Sieg, gegen die Alten und Grenzwerte 120/121', () => {
  expectScore(deal(), { winner: 're', gamePoints: 1, value: 1, per: { A: 1, B: 1, C: -1, D: -1 }, detail: ['Sieg'] });
  expectScore(deal({ points: { re: 121, kontra: 119 } }), { winner: 're', gamePoints: 1, value: 1, per: { A: 1, B: 1, C: -1, D: -1 } });
  expectScore(deal({ points: { re: 120, kontra: 120 } }),
    { winner: 'kontra', gamePoints: 2, value: -2, per: { A: -2, B: -2, C: 2, D: 2 }, detail: ['Sieg', 'gegen die Alten'] });
  // Projektregel: Kontra gewinnt mit 120 auch nach eigener Kontra-Ansage (DDV-Abweichung, siehe Entscheidungsvorlage).
  expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 0, kontra: 1 } }),
    { winner: 'kontra', gamePoints: 4, value: -4, per: { A: -4, B: -4, C: 4, D: 4 } });
});

test('DOKO-WERTUNG-02: stille Hochzeit 1 gegen 3 – Re-Sieg und Kontra-Sieg bleiben nullsummig', () => {
  // Fall 1 aus QA-DOKO-01: bisher A +7, übrige je −7 (Summe −14).
  expectScore(deal({ ...lone, points: { re: 180, kontra: 60 }, tricks: { re: 7, kontra: 3 }, levels: { re: 1, kontra: 0 }, specials: { re: 3, kontra: 0 } }),
    { winner: 're', gamePoints: 4, value: 7, per: { A: 21, B: -7, C: -7, D: -7 },
      detail: ['Sieg', 'Re', 'keine 90 gespielt', 'allein gegen drei (dreifach)'] });
  // Fall 2: Kontra schwarz, Re hatte angesagt. Bisher A −8, übrige je +8 (Summe +16).
  expectScore(deal({ ...lone, points: { re: 0, kontra: 240 }, tricks: { re: 0, kontra: 12 }, levels: { re: 1, kontra: 0 } }),
    { winner: 'kontra', gamePoints: 8, value: -8, per: { A: -24, B: 8, C: 8, D: 8 },
      detail: ['Sieg', 'gegen die Alten', 'Re', 'keine 90 gespielt', 'keine 60 gespielt', 'keine 30 gespielt', 'schwarz gespielt', 'allein gegen drei (dreifach)'] });
  // Ohne Wert gibt es keine Verteilung und keinen Hinweis.
  const tie = scoreDeal(deal({ ...lone, points: { re: 120, kontra: 120 }, levels: { re: 2, kontra: 2 } }));
  assert.equal(tie.winner, null);
  assert.equal(total(tie.per), 0);
  assert.equal(tie.detail.includes('allein gegen drei (dreifach)'), false);
});

test('DOKO-WERTUNG-02: Hochzeit mit und ohne Partner, Solo mit Sieg und Niederlage', () => {
  expectScore(deal({ contract: { kind: 'hochzeit' } }), { winner: 're', gamePoints: 1, value: 1, per: { A: 1, B: 1, C: -1, D: -1 } });
  // Ohne Partner zählt die Hochzeit wie ein Solo: kein „gegen die Alten“, dreifacher Wert.
  expectScore(deal({ contract: { kind: 'hochzeit' }, ...lone, points: { re: 100, kontra: 140 } }),
    { winner: 'kontra', gamePoints: 1, value: -1, per: { A: -3, B: 1, C: 1, D: 1 }, detail: ['Sieg'] });
  expectScore(deal({ contract: { kind: 'solo', solo: 'queens' }, ...lone, points: { re: 190, kontra: 50 }, levels: { re: 1, kontra: 0 } }),
    { winner: 're', gamePoints: 5, value: 5, per: { A: 15, B: -5, C: -5, D: -5 }, detail: ['Sieg', 'Re', 'keine 90 gespielt', 'keine 60 gespielt'] });
  expectScore(deal({ contract: { kind: 'solo', solo: 'plain' }, ...lone, points: { re: 110, kontra: 130 }, levels: { re: 0, kontra: 1 } }),
    { winner: 'kontra', gamePoints: 3, value: -3, per: { A: -9, B: 3, C: 3, D: 3 }, detail: ['Sieg', 'Kontra'] });
});

test('DOKO-WERTUNG-02: Ansagen, verfehlte Ansagen und Sonderpunkte', () => {
  // Re sagt keine 90 an und verfehlt: Kontra gewinnt trotz 140 Re-Augen.
  expectScore(deal({ points: { re: 140, kontra: 100 }, levels: { re: 2, kontra: 0 } }),
    { winner: 'kontra', gamePoints: 5, value: -5, per: { A: -5, B: -5, C: 5, D: 5 } });
  // Beide verfehlen: kein Sieger, Wert 0 (Projektregel; DDV verteilt Restpunkte, siehe Entscheidungsvorlage).
  expectScore(deal({ points: { re: 120, kontra: 120 }, levels: { re: 2, kontra: 2 } }), { winner: null, gamePoints: 0, value: 0, per: { A: 0, B: 0, C: 0, D: 0 } });
  // Sonderpunkte gehen als Differenz in den Wert ein, auch gegen den Sieger.
  expectScore(deal({ specials: { re: 0, kontra: 3 } }), { winner: 're', gamePoints: 1, value: -2, per: { A: -2, B: -2, C: 2, D: 2 } });
  expectScore(deal({ ...lone, specials: { re: 1, kontra: 2 } }), { winner: 're', gamePoints: 1, value: 0, per: { A: 0, B: 0, C: 0, D: 0 } });
});

test('DOKO-WERTUNG-02: jede Kombination aus Augen, Ansagen, Sonderpunkten und Parteien ist nullsummig', () => {
  let cases = 0;
  for (const contract of [{ kind: 'normal' }, { kind: 'hochzeit' }, { kind: 'solo', solo: 'c' }]) {
    for (const parties of contract.kind === 'solo' ? [lone] : [team, lone]) {
      for (let re = 0; re <= 240; re += 10) for (const extra of [0, 1]) {
        const points = { re: Math.min(240, re + extra), kontra: 240 - Math.min(240, re + extra) };
        for (let lr = 0; lr <= 5; lr++) for (let lk = 0; lk <= 5; lk++) for (const sr of [0, 2]) for (const sk of [0, 3]) {
          const tricks = { re: points.re ? 6 : 0, kontra: points.kontra ? 6 : 0 };
          const r = scoreDeal(deal({ contract, ...parties, points, tricks, levels: { re: lr, kontra: lk }, specials: { re: sr, kontra: sk } }));
          assert.equal(total(r.per), 0, JSON.stringify({ contract, parties, points, lr, lk, sr, sk }));
          cases++;
        }
      }
    }
  }
  assert.ok(cases > 20_000);
});

// Vollständige Partie im Raum: Spieler A erhält beide Kreuz-Damen und meldet „gesund“.
function silentWedding({ announce }) {
  const table = new Room('DK-WERTUNG', { turnTime: 0 }, () => {});
  const ids = Array.from({ length: 4 }, (_, i) => { const p = table.addPlayer('P' + i, null); table.sit(p.id); return p.id; });
  const key = () => ({ key: table.dealKey, revision: table.revision });
  const cards = dkDeck(true);
  table.deckFactory = () => [...cards.filter((c) => base(c) === 'Qc'), ...cards.filter((c) => base(c) !== 'Qc')];
  table.start(ids[0]);
  for (const id of ids) table.reserve(id, { ...key(), choice: 'healthy' });
  assert.equal(table.hands[ids[0]].filter((c) => base(c) === 'Qc').length, 2);
  if (announce) table.announce(ids[0], { ...key(), level: 1 });
  for (let turn = 0; turn < 48; turn++) { const id = table.currentId; table.play(id, { ...key(), card: table.allowed(id)[0] }); }
  return { table, ids, deal: table.lastDeal, view: table.gameView(ids[1]) };
}

test('DOKO-WERTUNG-02: stille Hochzeit im Raum – Abrechnung, Gesamtstand und Anzeige sind nullsummig', () => {
  const { table, ids, deal: result, view } = silentWedding({ announce: true });
  assert.equal(result.contract.kind, 'normal');
  assert.deepEqual(result.re, [ids[0]]);
  assert.equal(result.kontra.length, 3);
  assert.equal(result.winner, 'kontra');
  assert.equal(result.value, -8);
  assert.equal(result.per[ids[0]], -24);
  for (const id of ids.slice(1)) assert.equal(result.per[id], 8);
  assert.equal(total(result.per), 0);
  assert.equal(total(table.totals), 0);
  assert.ok(result.detail.includes('allein gegen drei (dreifach)'));
  // Die Abschlussansicht der Mitspieler enthält dieselben Werte.
  assert.deepEqual(view.lastDeal.per, result.per);
  assert.equal(total(view.totals), 0);
  const quiet = silentWedding({ announce: false }).deal;
  assert.equal(quiet.value, -6);
  assert.deepEqual(Object.values(quiet.per).sort((a, b) => a - b), [-18, 6, 6, 6]);
});

test('DOKO-WERTUNG-02: Ansageton – Mehrstufensprung ergibt einen Ton, verspätete ältere Zustände keinen', async () => {
  const { events } = await import('../public/games/doppelkopf/experience.js');
  const G = (g) => ({ g: { dealKey: 'k', stage: 'play', levels: { re: 0, kontra: 0 }, known: {}, trick: [], lastTrick: null, ...g } });
  // Zwei Re-Ansagen zwischen zwei Zuständen (Re und keine 90): genau ein Re-Ton, kein doppelter.
  assert.deepEqual(events(G({}), G({ levels: { re: 2, kontra: 0 } })), [{ type: 'call', party: 're' }]);
  // Ein verspätet eintreffender älterer Zustand löst keinen Ton aus und wiederholt keinen.
  const newer = G({ levels: { re: 1, kontra: 1 } }), older = G({ levels: { re: 1, kontra: 0 } });
  assert.deepEqual(events(newer, older), []);
  assert.deepEqual(events(older, newer), [{ type: 'call', party: 'kontra' }]);
});
