// Monopoly Paket A (ART-046): Theme-Fundament. Geprüft werden die Trennung von Regeln, Anzeigenamen und Ressourcen, die Rückwärtskompatibilität
// von `modern`/`classic`, Feldnamen und Kartentexte in Brett, Protokoll und Karten, eigene Bretter, Junior, Wiederherstellung und Reconnect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAMES } from '../games/index.js';
import { Room, BOARD, PROPERTIES, EVENTS, CHEST } from '../games/monopoly/room.js';
import { SpeedRoom } from '../games/monopoly/speed.js';
import { createBoardStore, configureBoards, boardStore } from '../games/monopoly/boards.js';
import { botMove } from '../games/monopoly/bot.js';
import { validateTheme, createThemeRegistry, useThemeRegistry, themeRegistry, fieldNames, cardText, DEFAULT_THEME, MANIFEST_PATH } from '../public/games/monopoly/themes.js';
import { normalizeProgram } from '../server/party-program.js';

// Ein Test-Theme für alle 40 Felder und beide Kartenstapel, so wie ein späteres Fantasy-Design aussehen könnte
const everyField = Object.fromEntries(BOARD.map((f) => [f.index, `Ort ${f.index}`]));
const deck = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix} ${i}`);
const FANTASY = { id: 'fantasy', name: 'Fantasy (Test)', released: true, fields: everyField, cards: { event: deck('Ereignis', EVENTS.length), chest: deck('Truhe', CHEST.length) }, manifest: MANIFEST_PATH('fantasy') };
const registry = (...extra) => createThemeRegistry([{ id: 'modern', name: 'Bisheriges Thema', released: true }, { id: 'classic', name: 'Klassik', released: true }, ...extra]);
function withRegistry(reg, fn) { const restore = useThemeRegistry(reg); try { return fn(); } finally { restore(); } }
function table(settings = {}, Type = Room, n = 2) {
  const r = new Type('THEM', settings, () => {});
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer('S' + i, null); r.sit(p.id); return p.id; }); r.start(ids[0]); return { r, ids };
}
const lines = (r) => r.log.map((l) => l.text);
const BASE_NAMES = BOARD.map((f) => f.name);

test('Theme-Registry: eingebaut sind genau modern und classic, beide freigegeben, nichts anderes wählbar', () => {
  const reg = themeRegistry();
  assert.deepEqual(reg.list().map((t) => t.id), ['modern', 'classic']); assert.deepEqual(reg.released().map((t) => t.id), ['modern', 'classic']);
  assert.equal(reg.safe('fantasy'), DEFAULT_THEME); assert.equal(reg.safe('classic'), 'classic'); assert.equal(reg.supports('fantasy', 'classic'), false);
  assert.deepEqual(Room.OPTIONS.find((o) => o.key === 'theme').values, [{ value: 'modern', label: 'Bisheriges Thema' }, { value: 'classic', label: 'Klassik' }]);
});

test('Theme-Definition wird streng geprüft: ID, Varianten (nie Junior), Feld-IDs, Namen, Karten, Manifestpfad', () => {
  assert.ok(validateTheme(FANTASY)); assert.equal(Object.isFrozen(validateTheme(FANTASY)), true);
  const bad = (patch, pattern) => assert.throws(() => validateTheme({ ...FANTASY, ...patch }), pattern);
  bad({ id: 'Fantasy!' }, /Ungültige Theme-ID/); bad({ id: undefined }, /Ungültige Theme-ID/); bad({ name: '' }, /Name/);
  bad({ released: 'ja' }, /released/); bad({ variants: ['junior'] }, /Junior/); bad({ variants: [] }, /Varianten/);
  bad({ fields: { 40: 'Zu viel' } }, /Feld-ID 40/); bad({ fields: { x: 'Name' } }, /Feld-ID/); bad({ fields: { 3: '' } }, /Feldname 3/); bad({ fields: { 3: 'x'.repeat(41) } }, /Feldname 3/); bad({ fields: { 3: 'Zeile\numbruch' } }, /Feldname 3/);
  bad({ cards: { event: deck('E', 15), chest: deck('T', 16) } }, /event braucht genau 16/); bad({ cards: { event: deck('E', 16) } }, /event und chest/);
  bad({ manifest: '/etc/passwd' }, /manifest muss/); bad({ manifest: MANIFEST_PATH('anderes') }, /manifest muss/);
  assert.throws(() => createThemeRegistry([{ id: 'modern', name: 'A', released: true }, { id: 'modern', name: 'B', released: true }]), /Doppelte/);
  assert.throws(() => createThemeRegistry([{ id: 'classic', name: 'Klassik', released: true }]), /Standardtheme/);
});

test('modern und classic: Standardwerte, Auswahl, Fehleingaben und Namen bleiben wie bisher', () => {
  const r = new Room('X', {}, () => {}); assert.equal(r.settings.theme, 'modern');
  assert.equal(new Room('X', { theme: 'classic' }, () => {}).settings.theme, 'classic');
  for (const wrong of ['fantasy', 'falsch', '', null, 5, {}, ['classic']]) assert.equal(new Room('X', { theme: wrong }, () => {}).settings.theme, 'modern', String(wrong));
  const host = r.addPlayer('Anna', null).id; r.updateSettings(host, { theme: 'classic' }); assert.equal(r.settings.theme, 'classic');
  r.updateSettings(host, { theme: 'fantasy' }); assert.equal(r.settings.theme, 'classic', 'ungültiger Wert lässt den bisherigen stehen');
  for (const theme of ['modern', 'classic']) {
    const { r: t } = table({ theme }); assert.deepEqual(t.fieldNames(), BASE_NAMES); assert.deepEqual(t.view(t.order[0]).g.names, BASE_NAMES);
    assert.deepEqual(fieldNames({ theme }), BASE_NAMES); t.dispose();
  }
  assert.equal(normalizeProgram({ mode: 'abend', entries: [{ game: 'monopoly', settings: { theme: 'classic' } }] }).entries.length, 1);
  assert.throws(() => normalizeProgram({ mode: 'abend', entries: [{ game: 'monopoly', settings: { theme: 'fantasy' } }] }));
});

test('Tempowürfel-Variante übernimmt das Theme-Verhalten unverändert', () => {
  const s = GAMES.monopoly.create('SP', { variant: 'speed', theme: 'classic', fantasy: true }, () => {}); assert.ok(s instanceof SpeedRoom);
  assert.equal(s.settings.theme, 'classic'); assert.equal(s.settings.startMoney, 2500); assert.equal(GAMES.monopoly.create('SP', { variant: 'speed', theme: 'fantasy' }, () => {}).settings.theme, 'modern');
});

test('ein neues Theme ist unsichtbar und wird abgelehnt, solange es nicht freigegeben ist', () => {
  withRegistry(registry({ ...FANTASY, released: false }), () => {
    assert.deepEqual(Room.OPTIONS.find((o) => o.key === 'theme').values.map((v) => v.value), ['modern', 'classic']);
    assert.equal(new Room('X', { theme: 'fantasy' }, () => {}).settings.theme, 'modern');
    const host = new Room('X', {}, () => {}); const id = host.addPlayer('A', null).id; host.updateSettings(id, { theme: 'fantasy' }); assert.equal(host.settings.theme, 'modern');
    assert.throws(() => normalizeProgram({ mode: 'abend', entries: [{ game: 'monopoly', settings: { theme: 'fantasy' } }] }));
  });
  withRegistry(registry({ ...FANTASY, released: true }), () => {
    assert.deepEqual(Room.OPTIONS.find((o) => o.key === 'theme').values.map((v) => v.value), ['modern', 'classic', 'fantasy']);
    assert.equal(new Room('X', { theme: 'fantasy' }, () => {}).settings.theme, 'fantasy');
    assert.equal(normalizeProgram({ mode: 'abend', entries: [{ game: 'monopoly', settings: { theme: 'fantasy' } }] }).entries.length, 1);
  });
  assert.equal(new Room('X', { theme: 'fantasy' }, () => {}).settings.theme, 'modern', 'nach dem Test wieder nur die beiden bisherigen Werte');
});

test('ein Theme gilt nur für die Varianten, die es nennt; Junior bekommt nie ein Theme', () => {
  withRegistry(registry({ ...FANTASY, variants: ['classic'] }), () => {
    assert.equal(GAMES.monopoly.create('A', { theme: 'fantasy' }, () => {}).settings.theme, 'fantasy');
    assert.equal(GAMES.monopoly.create('B', { variant: 'speed', theme: 'fantasy' }, () => {}).settings.theme, 'modern');
  });
  withRegistry(registry(FANTASY), () => {
    const j = GAMES.monopoly.create('J', { variant: 'junior', theme: 'fantasy' }, () => {});
    assert.equal(j.settings.theme, 'classic'); assert.equal(j.constructor.OPTIONS.some((o) => o.key === 'theme'), false);
    const jid = j.addPlayer('A', null).id, jid2 = j.addPlayer('B', null).id; j.sit(jid); j.sit(jid2);
    j.updateSettings(jid, { theme: 'fantasy' }); assert.equal(j.settings.theme, 'classic'); j.start(jid);
    const view = j.view(jid); assert.equal(view.g.board.id, 'junior'); assert.equal(view.g.names, undefined); assert.equal(Object.keys(view.g.owned).length, 16);
    j.dispose();
  });
});

test('Feldnamen: alle 40 Felder aus dem Theme, im Spielzustand, im Protokoll und bei Steuern', () => {
  withRegistry(registry(FANTASY), () => {
    const { r, ids: [a] } = table({ theme: 'fantasy' });
    assert.deepEqual(r.fieldNames(), BOARD.map((f) => `Ort ${f.index}`)); assert.deepEqual(r.view(a).g.names, BOARD.map((f) => `Ort ${f.index}`));
    r.people[a].position = 2; r.walk(a, 1); // Feld 3: Grundstück
    assert.ok(lines(r).some((t) => t.endsWith('landet auf Ort 3')), lines(r).join(' | '));
    r.people[a].position = 3; r.walk(a, 1); // Feld 4: Einkommensteuer
    assert.ok(lines(r).some((t) => t.endsWith('landet auf Ort 4')) && lines(r).some((t) => t.includes('· Ort 4')), 'Steuer nennt den Feldnamen des Themes');
    assert.equal(lines(r).some((t) => /Kastaniengasse|Lindengasse|Einkommensteuer/.test(t)), false, 'kein Standardname im Protokoll');
    r.people[a].position = 3; r.step = 'buy'; r.owned[3].owner = null; r.buy(a, true); assert.ok(lines(r).some((t) => t.includes('· Kauf Ort 3')));
    r.dispose();
  });
});

test('Kartentexte: Theme-Text in Karte und Protokoll, Wirkung und Stapel unverändert', () => {
  withRegistry(registry(FANTASY), () => {
    const { r, ids: [a] } = table({ theme: 'fantasy' });
    for (const kind of ['event', 'chest']) {
      const list = kind === 'event' ? EVENTS : CHEST;
      for (let i = 0; i < list.length; i++) {
        const t = table({ theme: 'fantasy' }); const id = t.ids[0], money = t.r.people[id].money; t.r.decks[kind] = [i, ...t.r.decks[kind].filter((n) => n !== i)];
        t.r.drawCard(id, kind); assert.equal(t.r.card.text, `${kind === 'event' ? 'Ereignis' : 'Truhe'} ${i}`); assert.ok(lines(t.r).includes(t.r.card.text));
        assert.equal(t.r.card.index, i); if (list[i].kind === 'bank') assert.equal(t.r.people[id].money, money + list[i].amount, 'Geldwirkung wie im Standard'); t.r.dispose();
      }
    }
    assert.equal(cardText('event', 0, { theme: 'fantasy', registry: registry(FANTASY) }), 'Ereignis 0'); assert.equal(cardText('chest', 1, { theme: 'modern' }), CHEST[1].text);
    r.dispose();
  });
  const { r, ids: [a] } = table({ theme: 'classic' }); r.decks.event = [0, ...r.decks.event.filter((n) => n !== 0)]; r.drawCard(a, 'event'); assert.equal(r.card.text, EVENTS[0].text); r.dispose();
});

test('eigene Bretter: ihre 28 Namen gewinnen immer, kein Brett wird verändert; Theme ergänzt nur die zwölf übrigen Felder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monopoly-theme-')), store = createBoardStore(dir), names = PROPERTIES.map((i) => 'Eigene ' + i);
  const saved = store.save({ title: 'Unser Abend', names }), before = JSON.stringify(store.list());
  configureBoards(dir);
  try {
    // modern + eigenes Brett: wie bisher
    const modern = table({ board: saved.id }); modern.r.validateStart(); assert.deepEqual(modern.r.fieldNames(), BOARD.map((f) => (PROPERTIES.includes(f.index) ? 'Eigene ' + f.index : f.name))); modern.r.dispose();
    withRegistry(registry(FANTASY), () => {
      const { r, ids: [a] } = table({ theme: 'fantasy', board: saved.id });
      const shown = r.fieldNames(), view = r.view(a).g.names;
      assert.deepEqual(shown, view);
      for (const f of BOARD) assert.equal(shown[f.index], PROPERTIES.includes(f.index) ? 'Eigene ' + f.index : `Ort ${f.index}`, 'Feld ' + f.index);
      r.people[a].position = 2; r.walk(a, 1); assert.ok(lines(r).some((t) => t.endsWith('landet auf Eigene 3')));
      // Standardbrett + Theme: Theme-Namen auch für die Grundstücke
      const std = table({ theme: 'fantasy' }); assert.equal(std.r.fieldNames()[3], 'Ort 3'); std.r.dispose(); r.dispose();
    });
    assert.equal(JSON.stringify(boardStore().list()), before, 'gespeicherte Bretter bleiben unverändert');
    assert.deepEqual(boardStore().get(saved.id).names, names);
  } finally { configureBoards(null); }
  assert.deepEqual(fieldNames({ theme: 'modern', board: { id: 'x', names: ['zu', 'wenige'] } }), BASE_NAMES, 'ein unvollständiges Brett wird ignoriert statt Namen zu zerstören');
});

test('Brettwechsel in der Lobby aktualisiert die Namen, ohne dass das Theme etwas überschreibt', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monopoly-theme-')), names = PROPERTIES.map((i) => 'Brett ' + i); configureBoards(dir);
  try {
    const saved = boardStore().save({ title: 'Zwei', names });
    withRegistry(registry(FANTASY), () => {
      const r = new Room('SW', { theme: 'fantasy' }, () => {}); const host = r.addPlayer('A', null).id; r.sit(host); const b = r.addPlayer('B', null).id; r.sit(b);
      r.validateStart(); assert.equal(r.fieldName(3), 'Ort 3'); r.chooseBoard(host, saved.id); assert.equal(r.fieldName(3), 'Brett 3'); assert.equal(r.fieldName(4), 'Ort 4');
      r.chooseBoard(host, 'default'); assert.equal(r.fieldName(3), 'Ort 3'); r.dispose();
    });
  } finally { configureBoards(null); }
});

test('gespeicherte Räume: classic bleibt, unbekanntes oder entferntes Theme fällt auf modern, Namen nach Neustart gleich', () => {
  const { r, ids: [a] } = table({ theme: 'classic', quick: true }); r.abortRound(a);
  const data = JSON.parse(JSON.stringify(r.snapshot())), restored = GAMES.monopoly.restore(data, () => {});
  assert.equal(restored.settings.theme, 'classic'); assert.equal(restored.settings.quick, true); assert.equal(restored.constructor, Room);
  assert.deepEqual(restored.fieldNames(), BASE_NAMES); r.dispose(); restored.dispose();
  for (const theme of ['fantasy', 'kaputt', undefined, 7]) {
    const old = JSON.parse(JSON.stringify(data)); old.settings.theme = theme; const back = GAMES.monopoly.restore(old, () => {});
    assert.equal(back.settings.theme, 'modern', String(theme)); assert.equal(back.settings.startMoney, data.settings.startMoney); back.dispose();
  }
  // Ein später eingeführtes Theme überlebt Neustart und wird nach einem Rückbau (nicht mehr freigegeben) sicher zu modern
  const saved = withRegistry(registry(FANTASY), () => { const t = table({ theme: 'fantasy' }); t.r.abortRound(t.ids[0]); const snap = JSON.parse(JSON.stringify(t.r.snapshot())); const again = GAMES.monopoly.restore(JSON.parse(JSON.stringify(snap)), () => {}); assert.equal(again.settings.theme, 'fantasy'); assert.equal(again.fieldName(3), 'Ort 3'); again.dispose(); t.r.dispose(); return snap; });
  const rolledBack = GAMES.monopoly.restore(saved, () => {}); assert.equal(rolledBack.settings.theme, 'modern'); assert.equal(rolledBack.fieldName(3), BASE_NAMES[3]); rolledBack.dispose();
});

test('Reconnect: derselbe Spielzustand und dieselben Namen für alle, auch nach Verbindungsabbruch', () => {
  withRegistry(registry(FANTASY), () => {
    const { r, ids: [a, b] } = table({ theme: 'fantasy' }); const before = JSON.stringify(r.view(b).g.names);
    r.players.get(b).connected = false; r.players.get(b).offlineSince = Date.now(); r.players.get(b).connected = true; r.players.get(b).offlineSince = null;
    assert.equal(JSON.stringify(r.view(b).g.names), before); assert.equal(JSON.stringify(r.view(a).g.names), before);
    assert.equal(r.view(b).settings.theme, 'fantasy'); r.dispose();
  });
});

test('Regeln bleiben unberührt: Partie mit Theme-Namen verläuft wie die Standardpartie, Geld und Gebäude bleiben erhalten', () => {
  const play = (theme, seedRolls) => {
    const { r } = table({ theme, quick: true }, Room, 4); let i = 0; r.roll = () => seedRolls[i++ % seedRolls.length]; let steps = 0;
    while (r.phase === 'playing' && steps++ < 20000) botMove(r, r.botDue() || r.currentId);
    const out = { phase: r.phase, steps, money: r.order.map((id) => r.people[id].money), owned: JSON.stringify(r.owned), rounds: r.turnNo }; r.dispose(); return out;
  };
  const rolls = Array.from({ length: 97 }, (_, k) => 1 + ((k * 7 + 3) % 6));
  const plain = play('modern', rolls), themed = withRegistry(registry(FANTASY), () => play('fantasy', rolls));
  assert.equal(plain.phase, 'over');
  // gleiche Würfel, gleiche Entscheidungen, gleiche Stapelreihenfolge nicht garantiert (Mischen ist zufällig): daher nur Invarianten
  assert.equal(themed.phase, 'over'); assert.ok(themed.money.every((m) => Number.isSafeInteger(m) && m >= 0));
});

test('keine Preise, Mieten oder Regelwerte im Theme: data.js bleibt die einzige Quelle', () => {
  assert.equal(BOARD.length, 40); assert.equal(PROPERTIES.length, 28); assert.equal(BOARD[39].price, 400); assert.deepEqual(BOARD[39].rents, [50, 200, 600, 1400, 1700, 2000]);
  for (const key of ['price', 'rents', 'build', 'tax', 'type', 'color']) assert.throws(() => validateTheme({ ...FANTASY, fields: { 1: 'Name', [key]: 5 } }), /Feld-ID/);
});
