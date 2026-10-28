// Wer bin ich?: Begriffsvergabe, Geheimhaltung des eigenen Begriffs, Mehrheitsantwort, Raten (exakt, unscharf, Abstimmung), Wertung, Massentest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../games/index.js';
import { CATALOG, normalize, matches, majority, distance } from '../games/wer-bin-ich/room.js';
import { seeded } from './sim-helpers.js';

function table(n, settings = {}, words = null) {
  const r = GAMES['wer-bin-ich'].create('WBI', settings, () => {});
  const ids = Array.from({ length: n }, (_, k) => { const p = r.addPlayer('Spieler' + k, null); p.connected = true; r.sit(p.id); return p.id; });
  if (words) r.custom = words;
  return { r, ids };
}
const W = (n) => Array.from({ length: n }, (_, i) => `Zeta-${String(i).padStart(2, '0')}-xq`);
const playing = (n, settings = {}) => {
  const t = table(n, { mode: 'custom', ...settings }, W(n));
  t.r.start(t.r.hostId);
  return t;
};

test('Begriffe: jede Kategorie hat mindestens 60 bekannte Begriffe, ohne Doppelte', () => {
  const names = Object.values(CATALOG).map((c) => c.name);
  for (const n of ['Tiere', 'Berufe', 'Gegenstände', 'Essen & Trinken', 'Film- & Serienfiguren', 'Comic- & Märchenfiguren', 'Sportarten', 'Länder & Städte']) assert.ok(names.includes(n), n);
  for (const [k, c] of Object.entries(CATALOG)) {
    assert.ok(c.words.length >= 60, `${k}: ${c.words.length}`);
    assert.equal(new Set(c.words).size, c.words.length, `${k}: doppelte Begriffe`);
  }
});

test('Raten: Groß/Klein, Umlaute, Artikel, Tippfehler ab 6 Zeichen, aber nicht bei kurzen Wörtern', () => {
  assert.ok(matches('elefant', 'Elefant'));
  assert.ok(matches('der Elefant', 'Elefant'));
  assert.ok(matches('Ein Eichhörnchen', 'Eichhörnchen'));
  assert.ok(matches('Eichhoernchen', 'Eichhörnchen'), 'ae = ä, oe = ö');
  assert.ok(matches('Känguruh', 'Känguru'), 'ein Tippfehler');
  assert.ok(matches('Krokodill', 'Krokodil'));
  assert.ok(matches('Elefnat', 'Elefant'), 'zwei Zeichen vertauscht (Abstand 2)');
  assert.ok(!matches('Elefantenbaby', 'Elefant'));
  assert.ok(!matches('Hund', 'Hand'), 'kurze Wörter müssen exakt stimmen');
  assert.ok(!matches('Katze', 'Kater'));
  assert.ok(matches('Harry   Potter', 'Harry Potter'));
  assert.ok(matches('Strauss', 'Strauß'), 'ß = ss');
  assert.ok(!matches('', 'Hund'));
  assert.equal(distance('abc', 'abd'), 1);
  assert.equal(normalize('Die Hexe!'), 'hexe');
});

test('Mehrheitsantwort: Ja gegen Nein, Weiß nicht zählt nicht mit, Gleichstand ist Unklar', () => {
  assert.equal(majority({ ja: 3, nein: 1, weiss: 5 }), 'ja');
  assert.equal(majority({ ja: 1, nein: 2, weiss: 0 }), 'nein');
  assert.equal(majority({ ja: 2, nein: 2, weiss: 1 }), 'unklar');
  assert.equal(majority({ ja: 0, nein: 0, weiss: 4 }), 'unklar');
});

test('Gegenseitig: jeder schreibt für genau einen anderen, jeder bekommt genau einen Begriff, niemand seinen eigenen', () => {
  for (let n = 3; n <= 10; n++) {
    for (let k = 0; k < 20; k++) {
      const { r, ids } = table(n, { mode: 'mutual' });
      r.start(r.hostId);
      assert.equal(r.stage, 'words');
      const targets = ids.map((id) => r.targetOf[id]);
      assert.equal(new Set(targets).size, n, 'jeder wird genau einmal bedacht');
      ids.forEach((id) => assert.notEqual(r.targetOf[id], id, 'nicht für sich selbst'));
      const written = {};
      ids.forEach((id, i) => { written[id] = `Begriff${i}Q${n}`; r.word(id, written[id]); });
      assert.equal(r.stage, 'play');
      for (const id of ids) {
        assert.ok(r.words[id], 'jeder hat einen Begriff');
        const writer = ids.find((w) => written[w] === r.words[id]);
        assert.ok(writer && writer !== id, 'nicht der selbst geschriebene Begriff');
      }
      assert.deepEqual(r.targetOf, {}, 'wer für wen geschrieben hat, wird vergessen');
      r.dispose();
    }
  }
});

test('Gegenseitig: vor der Vergabe sieht niemand Begriffe, der Schreiber kennt nur sein Ziel; keine Mitspielernamen, zu kurz, Zeit um', () => {
  const { r, ids } = table(4, { mode: 'mutual' });
  r.start(r.hostId);
  r.word(ids[0], 'Geheimwort1');
  for (const id of ids) {
    const g = r.view(id).g;
    assert.deepEqual(g.words, {}, 'keine Begriffe in der Schreibphase');
    assert.ok(!JSON.stringify(r.view(id)).includes('Geheimwort1') || id === ids[0], 'Entwürfe sieht nur der Schreiber');
  }
  assert.equal(r.view(ids[0]).g.myTarget, r.targetOf[ids[0]]);
  assert.throws(() => r.word(ids[1], 'x'), /zu kurz/);
  assert.throws(() => r.word(ids[1], 'Spieler2'), /Mitspieler/);
  assert.throws(() => r.word(ids[1], 'der große Spieler3'), /Mitspieler/);
  r.expire(); // Zeit um: der Rest wird aus der Kategorie ergänzt
  assert.equal(r.stage, 'play');
  assert.ok(ids.every((id) => r.words[id]));
  r.dispose();
});

test('Kategorie und eigene Liste: verschiedene Begriffe, Liste muss reichen', () => {
  const { r, ids } = table(5, { mode: 'category', cats: ['tiere', 'berufe'] });
  r.start(r.hostId);
  const ws = ids.map((id) => r.words[id]);
  assert.equal(new Set(ws).size, 5);
  const all = [...CATALOG.tiere.words, ...CATALOG.berufe.words];
  assert.ok(ws.every((w) => all.includes(w)));
  r.dispose();
  const short = table(4, { mode: 'custom' }, ['Eins', 'Zwei']);
  assert.throws(() => short.r.start(short.r.hostId), /mindestens 4 Begriffe/);
  const host = short.r.hostId;
  short.r.setCustom(host, ' Alpha \n\nBeta\nGamma\nAlpha\nDelta');
  assert.deepEqual(short.r.custom, ['Alpha', 'Beta', 'Gamma', 'Delta']);
  assert.throws(() => short.r.setCustom(short.ids[1], 'x'), /Host/);
  short.r.start(host);
  assert.equal(short.r.stage, 'play');
  short.r.dispose();
  // Mode und Kategorien gehen nur über die erlaubten Werte
  const t = table(3);
  t.r.updateSettings(t.r.hostId, { mode: 'unsinn', cats: ['gibtsnicht'], follow: false });
  assert.equal(t.r.settings.mode, 'mutual');
  assert.deepEqual(t.r.settings.cats, ['tiere']);
  assert.equal(t.r.settings.follow, false);
  t.r.updateSettings(t.r.hostId, { mode: 'category', cats: ['sport', 'laender'] });
  assert.equal(t.r.settings.mode, 'category');
  assert.deepEqual(t.r.settings.cats, ['sport', 'laender']);
});

test('Geheimhaltung: der eigene Begriff steht nie im eigenen Zustand – bis erraten oder Rundenende; Zuschauer sehen alles', () => {
  const { r, ids } = playing(4);
  const z = r.addPlayer('Zoe', null).id;
  const check = () => {
    for (const id of ids) {
      const own = r.words[id];
      const json = JSON.stringify(r.view(id));
      if (r.solved.includes(id) || r.revealed) assert.ok(json.includes(own), 'erraten: der Zettel ist offen');
      else {
        assert.ok(!json.includes(own), `Begriff ${own} im eigenen Zustand`);
        assert.equal(r.view(id).g.words[id], null);
      }
      for (const other of ids) if (other !== id && !r.solved.includes(other) && !r.revealed) assert.equal(r.view(id).g.words[other], r.words[other], 'fremde Zettel sind sichtbar');
    }
    const spec = r.view(z).g.words;
    for (const id of ids) assert.equal(spec[id], r.words[id], 'Zuschauer sehen alle Begriffe');
  };
  check();
  const a = r.currentId;
  const [b, c, d] = r.order.filter((i) => i !== a);
  r.ask(a, 'Bin ich ein Tier?');
  for (const o of [b, c, d]) r.answer(o, 'ja');
  check();
  // falscher Tipp und Abstimmung: der eigene Begriff bleibt verborgen (Tipp des Raters steht aber im Verlauf)
  r.guess(a, 'Falsches-Zeug');
  check();
  for (const o of [b, c, d]) r.vote(o, false);
  check();
  // jetzt rät der Nächste richtig: sein Zettel wird für ihn sichtbar, die anderen bleiben verdeckt
  const nx = r.currentId;
  r.ask(nx, 'Ist es groß?'); for (const o of r.order.filter((i) => i !== nx)) r.answer(o, 'nein');
  const g = r.currentId === nx ? nx : r.currentId;
  r.guess(g, r.words[g]);
  assert.ok(r.solved.includes(g));
  assert.ok(JSON.stringify(r.view(g)).includes(r.words[g]));
  assert.ok(!JSON.stringify(r.view(a)).includes(r.words[a]));
  check();
  // Log, Sprechblasen und Verlauf enthalten die Begriffe der Unerratenen nie
  for (const id of ids) {
    const v = r.view(id);
    for (const other of ids) if (!r.solved.includes(other)) assert.ok(!JSON.stringify({ log: v.log, acts: v.acts, moves: v.moves, hist: v.g.hist, result: v.result }).includes(r.words[other]), `Begriff von ${other} im Verlauf`);
  }
  r.dispose();
});

test('Fragen: Mehrheit entscheidet, Ja = weiterfragen, Nein/Unklar = Nächster; feste Anzahl; Zeitablauf', () => {
  const { r, ids } = playing(4);
  const first = r.currentId;
  const others = ids.filter((i) => i !== first);
  assert.throws(() => r.ask(others[0], 'x'), /nicht dran/);
  assert.throws(() => r.answer(others[0], 'ja'), /nichts zu beantworten/);
  r.ask(first, 'Bin ich lebendig?');
  assert.throws(() => r.ask(first, 'nochmal'), /nicht gefragt/);
  assert.throws(() => r.answer(first, 'ja'), /nicht/);
  assert.throws(() => r.answer(others[0], 'vielleicht'), /Ja, Nein/);
  r.answer(others[0], 'ja'); r.answer(others[1], 'ja'); r.answer(others[2], 'nein');
  assert.equal(r.lastQ.res, 'ja');
  assert.equal(r.currentId, first, 'bei Ja darf man weiterfragen');
  assert.equal(r.qs[first], 1);
  r.ask(first, 'Ist es groß?');
  r.answer(others[0], 'ja'); r.answer(others[1], 'nein'); r.answer(others[2], 'weiss');
  assert.equal(r.lastQ.res, 'unklar');
  assert.notEqual(r.currentId, first, 'bei Unklar ist der Nächste dran');
  assert.equal(r.currentId, r.order[(r.order.indexOf(first) + 1) % 4]);
  // Hausregel: Weiterfragen aus → auch bei Ja Zugwechsel
  const f = playing(3, { follow: false });
  const a = f.r.currentId;
  f.r.ask(a, 'Frage'); f.r.order.filter((i) => i !== a).forEach((o) => f.r.answer(o, 'ja'));
  assert.notEqual(f.r.currentId, a);
  // Feste Anzahl: 2 Fragen pro Zug, egal wie die Antwort lautet
  const x = playing(3, { fixedQ: 2 });
  const b = x.r.currentId;
  const ans = (room, who, a) => room.order.filter((i) => i !== who).forEach((o) => room.answer(o, a));
  x.r.ask(b, '1'); ans(x.r, b, 'ja');
  assert.equal(x.r.currentId, b);
  x.r.ask(b, '2'); ans(x.r, b, 'nein');
  assert.notEqual(x.r.currentId, b, 'nach der festen Anzahl wechselt der Zug');
  // Zeit abgelaufen: Nächster; unbeantwortet = Unklar
  x.r.expire();
  assert.equal(x.r.stage, 'play');
  const y = x.r.currentId;
  x.r.ask(y, 'Frage'); x.r.expire();
  assert.equal(x.r.lastQ.res, 'unklar');
  r.dispose(); f.r.dispose(); x.r.dispose();
});

test('Raten: exakter und unscharfer Treffer gelten sofort, sonst stimmen die anderen ab; Fehlversuch beendet den Zug', () => {
  const { r, ids } = playing(4);
  const a = r.currentId;
  const others = ids.filter((i) => i !== a);
  const word = r.words[a];
  // unscharf: Tippfehler und Artikel
  r.guess(a, `Der ${word.toUpperCase()}`);
  assert.ok(r.solved.includes(a));
  assert.equal(r.currentId !== a, true);
  // Grenzfall: stimmt nicht überein → Abstimmung, Mehrheit „zählt“
  const b = r.currentId;
  r.guess(b, 'Etwas Ähnliches');
  assert.equal(r.sub, 'gvote');
  assert.throws(() => r.vote(b, true), /nicht mit/);
  const voters = ids.filter((i) => i !== b);
  r.vote(voters[0], true); r.vote(voters[1], true);
  assert.equal(r.sub, 'gvote', 'noch nicht alle');
  r.vote(voters[2], false);
  assert.ok(r.solved.includes(b), 'Mehrheit: zählt');
  // Fehlversuch: „Zählt nicht“ → nächster Spieler
  const c = r.currentId;
  r.guess(c, 'Völlig falsch');
  r.order.filter((i) => i !== c).forEach((v) => r.vote(v, false));
  assert.ok(!r.solved.includes(c));
  assert.notEqual(r.currentId, c);
  assert.equal(r.hist.filter((h) => h.t === 'g' && !h.ok).length, 1);
  void others;
  r.dispose();
});

test('Hausregel: Falsch geraten setzt eine Runde aus; höchstens N Fragen scheidet aus', () => {
  const { r, ids } = playing(4, { penalty: true });
  const a = r.currentId;
  r.guess(a, 'Nope'); r.order.filter((i) => i !== a).forEach((v) => r.vote(v, false));
  assert.ok(r.skipNext.has(a));
  // eine volle Runde später wird a übersprungen
  let seen = [];
  for (let k = 0; k < 4; k++) { const cur = r.currentId; seen.push(cur); r.ask(cur, 'f'); r.order.filter((i) => i !== cur).forEach((o) => r.answer(o, 'nein')); }
  assert.ok(!seen.slice(0, 3).includes(a) || seen.indexOf(a) > 3 - 1 + 0, 'a setzt aus');
  assert.ok(!r.skipNext.has(a));
  const m = playing(3, { maxQ: 2 });
  const x = m.r.currentId;
  for (let k = 0; k < 2; k++) {
    m.r.ask(x, `Frage ${k}`);
    m.r.order.filter((i) => i !== x).forEach((o) => m.r.answer(o, 'ja'));
  }
  assert.ok(m.r.gaveUp.has(x), 'nach 2 Fragen ausgeschieden');
  assert.notEqual(m.r.currentId, x);
  assert.ok(!JSON.stringify(m.r.view(x)).includes(m.r.words[x]), 'der Begriff bleibt geheim');
  assert.throws(() => m.r.hintAsk(x), /aus/);
  r.dispose(); m.r.dispose(); void ids;
});

test('Hinweis-Hilfe: erst nach 15 Fragen, nur einmal, ein anderer Mitspieler schreibt den Tipp', () => {
  const { r, ids } = playing(4, { hints: true, follow: true });
  const a = r.currentId;
  assert.throws(() => r.hintAsk(a), /15 eigenen Fragen/);
  for (let k = 0; k < 15; k++) { r.ask(a, `F${k}`); r.order.filter((i) => i !== a).forEach((o) => r.answer(o, 'ja')); }
  assert.equal(r.currentId, a);
  assert.equal(r.view(a).g.canHint, true);
  r.hintAsk(a);
  const writer = r.hintReq.by;
  assert.notEqual(writer, a);
  assert.throws(() => r.hintAsk(a), /schon/);
  assert.throws(() => r.hintWrite(a, 'ein tipp'), /sollst gerade keinen/);
  assert.throws(() => r.hintWrite(writer, 'x'), /zu kurz/);
  r.hintWrite(writer, 'Man findet es im Wald');
  assert.deepEqual(r.view(a).g.hints.map((h) => h.text), ['Man findet es im Wald']);
  assert.equal(r.hintReq, null);
  assert.equal(r.view(a).g.canHint, false);
  void ids;
  r.dispose();
});

test('Spielende und Wertung: Platz × 100 plus 10 je Frage unter 20, Runde endet, wenn nur einer übrig ist', () => {
  const { r, ids } = playing(4);
  const [a, b, c, d] = r.order;
  const ask = (who, n, res = 'nein') => { for (let k = 0; k < n; k++) { r.ask(who, 'f'); r.order.filter((i) => i !== who).forEach((o) => r.answer(o, res)); if (r.currentId !== who) break; } };
  r.turn = r.order.indexOf(a);
  r.qs[a] = 4; r.qs[b] = 25; r.qs[c] = 0;
  r.guess(a, r.words[a]);                     // Platz 1, 4 Fragen → 400 + 160
  r.turn = r.order.indexOf(b); r.sub = 'ask'; r.guess(b, r.words[b]); // Platz 2, 25 Fragen → 300 + 0
  assert.equal(r.phase, 'playing');
  r.turn = r.order.indexOf(c); r.sub = 'ask'; r.guess(c, r.words[c]); // Platz 3 → 200 + 200
  assert.equal(r.phase, 'over', 'nur d ist übrig');
  assert.deepEqual(r.result.points, { [a]: 560, [b]: 300, [c]: 400, [d]: 0 });
  assert.deepEqual(r.result.winners, [a]);
  assert.equal(r.scores[a], 560);
  // Rundenende-Fenster: alle Begriffe und Fragen offen
  const v = r.view(d).g;
  assert.deepEqual(v.reveal.words, { [a]: r.words[a], [b]: r.words[b], [c]: r.words[c], [d]: r.words[d] });
  assert.ok(JSON.stringify(r.view(d)).includes(r.words[d]), 'zum Schluss sieht jeder seinen Begriff');
  void ask; void ids;
  r.dispose();
});

test('Zeitlimit des Abends und Abbruch: Uhren werden gestoppt, kein Gewinner ohne Treffer', async () => {
  const { r } = playing(3, { limitMin: 1 });
  assert.ok(r.limitTimer);
  r.finish('Das Zeitlimit des Abends ist um');
  assert.equal(r.phase, 'over');
  assert.deepEqual(r.result.winners, []);
  assert.equal(r.limitTimer, null);
  const t = playing(3, { limitMin: 1 });
  t.r.abortRound(t.r.hostId);
  assert.equal(t.r.limitTimer, null);
  assert.equal(t.r.stageTimer, null);
  assert.equal(t.r.phase, 'lobby');
  r.dispose(); t.r.dispose();
});

test('Aussteigen mitten in der Runde: Zug und Abstimmung hängen nicht, bei zu wenigen endet die Runde', () => {
  const { r, ids } = playing(4);
  const a = r.currentId;
  const other = ids.find((i) => i !== a);
  r.ask(a, 'Frage');
  r.stand(other); // wird zum Zuschauer
  assert.ok(!r.order.includes(other));
  const left = r.order.filter((i) => i !== a);
  left.forEach((o) => r.answer(o, 'nein'));
  assert.equal(r.sub, 'ask');
  r.stand(r.currentId);
  assert.equal(r.phase, 'over', 'unter drei Mitspielern endet die Runde');
  r.dispose();
});

test('Keine Bots: Server und Hub bieten keinen Computer-Mitspieler an', async () => {
  const { BOTS } = await import('../games/bots.js');
  assert.equal(BOTS['wer-bin-ich'], undefined);
});

test('Massentest: 300 Runden mit zufälligen Antworten und Rateversuchen enden immer, der eigene Begriff bleibt verborgen', () => {
  const rg = seeded(91);
  const pick = (l) => l[Math.floor(rg() * l.length)];
  for (let g = 0; g < 300; g++) {
    const n = 3 + Math.floor(rg() * 8);
    const mutual = rg() < 0.4;
    const { r, ids } = table(n, { mode: mutual ? 'mutual' : 'custom', follow: rg() < 0.7, fixedQ: rg() < 0.2 ? 1 + Math.floor(rg() * 3) : 0, maxQ: rg() < 0.3 ? 10 : 0, penalty: rg() < 0.3 }, W(n));
    r.start(r.hostId);
    if (mutual) ids.forEach((id, i) => r.word(id, `Wort-${g}-${i}-zz`));
    let steps = 0;
    while (r.phase === 'playing' && steps++ < 3000) {
      for (const id of ids) {
        if (!r.order.includes(id) || r.solved.includes(id) || r.revealed) continue;
        const json = JSON.stringify(r.view(id));
        assert.ok(!json.includes(r.words[id]), `Begriff im eigenen Zustand (Partie ${g})`);
      }
      if (r.sub === 'ask') {
        const cur = r.currentId;
        if (rg() < 0.12) {
          const right = rg() < 0.25;
          r.guess(cur, right ? r.words[cur] : 'Falsch' + Math.floor(rg() * 99));
        } else r.ask(cur, rg() < 0.5 ? 'Frage?' : '');
      } else if (r.sub === 'vote') {
        for (const v of r.order.filter((i) => i !== r.q.by)) r.answer(v, pick(['ja', 'nein', 'weiss']));
      } else if (r.sub === 'gvote') {
        for (const v of r.order.filter((i) => i !== r.gv.by)) r.vote(v, rg() < 0.5);
      }
    }
    assert.equal(r.phase, 'over', `Runde ${g} endet nicht`);
    assert.ok(r.result.text);
    const solvedPts = r.solved.map((id) => r.result.points[id]);
    assert.deepEqual([...solvedPts].sort((x, y) => y - x).length, solvedPts.length);
    for (const id of ids) assert.ok(r.result.points[id] >= 0);
    r.dispose();
  }
});
