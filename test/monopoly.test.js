import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Room, BOARD, PROPERTIES, EVENTS, CHEST, group } from '../games/monopoly/room.js';
import { createBoardStore } from '../games/monopoly/boards.js';
import { botMove } from '../games/monopoly/bot.js';
const seq = (...values) => () => { assert.ok(values.length, 'Wurf vorhanden'); return values.shift(); };
function table(n = 2, settings = {}) {
  const r = new Room('CITY', settings, () => {});
  const ids = Array.from({ length: n }, (_, i) => { const p = r.addPlayer('S' + i, null); r.sit(p.id); return p.id; }); r.start(ids[0]); return { r, ids };
}
function invariant(r) {
  assert.equal(r.bank + r.pot + Object.values(r.people).reduce((s, p) => s + p.money, 0), 10000000, 'Geld mit Bank und Parktopf erhalten');
  assert.ok(Object.values(r.people).every((p) => p.money >= 0 && Number.isSafeInteger(p.money)));
  const houses = PROPERTIES.reduce((s, i) => s + (r.owned[i].level < 5 ? r.owned[i].level : 0), 0), hotels = PROPERTIES.filter((i) => r.owned[i].level === 5).length;
  assert.equal(houses + r.stock.houses, 32); assert.equal(hotels + r.stock.hotels, 12);
  for (const color of new Set(BOARD.filter((f) => f.color).map((f) => f.color))) {
    const levels = BOARD.filter((f) => f.color === color).map((f) => r.owned[f.index].level); assert.ok(Math.max(...levels) - Math.min(...levels) <= 1);
  }
  for (const kind of ['event', 'chest']) { const held = Object.values(r.people).flatMap((p) => p.free.filter((c) => c.deck === kind).map((c) => c.index)); assert.equal(new Set([...r.decks[kind], ...held]).size, 16); }
}
test('Monopoly: 40 Felder, 28 Grundstücke, zwei Stapel mit je 16 Karten und Startgeld', () => {
  assert.equal(BOARD.length, 40); assert.equal(PROPERTIES.length, 28); assert.equal(EVENTS.length, 16); assert.equal(CHEST.length, 16);
  assert.equal(BOARD.filter((f) => f.type === 'street').length, 22); assert.equal(BOARD.filter((f) => f.type === 'rail').length, 4);
  const { r, ids: [a] } = table(); assert.equal(r.people[a].money, 1500); invariant(r); r.dispose();
});
test('Monopoly: Miete für ganze Gruppe, Häuser, Hotel, Bahnhöfe, Werke und Hypothek', () => {
  const { r, ids: [a] } = table(); r.owned[1].owner = a; assert.equal(r.rent(1), 2); r.owned[3].owner = a; assert.equal(r.rent(1), 4);
  r.owned[1].level = 1; assert.equal(r.rent(1), 10); r.owned[1].level = 5; assert.equal(r.rent(1), 250); r.owned[1].mortgage = true; assert.equal(r.rent(1), 0);
  for (const [i, value] of [[5, 25], [15, 50], [25, 100], [35, 200]]) { r.owned[i].owner = a; assert.equal(r.rent(5), value); }
  r.owned[12].owner = a; assert.equal(r.rent(12, 7), 28); r.owned[28].owner = a; assert.equal(r.rent(12, 7), 70); r.dispose();
});
test('Monopoly: gleichmäßig bauen und abbauen, Vorrat und Hotelrücktausch', () => {
  const { r, ids: [a] } = table(); for (const i of [1, 3]) r.owned[i].owner = a;
  r.manage(a, 1, 'build'); assert.throws(() => r.manage(a, 1, 'build'), /gleichmäßig/);
  r.manage(a, 3, 'build'); for (let n = 1; n < 4; n++) { r.manage(a, 1, 'build'); r.manage(a, 3, 'build'); }
  assert.equal(r.stock.houses, 24); r.manage(a, 1, 'build'); assert.equal(r.stock.hotels, 11); assert.equal(r.stock.houses, 28);
  assert.throws(() => r.manage(a, 3, 'sell'), /gleichmäßig/); r.stock.houses = 0; assert.throws(() => r.manage(a, 1, 'sell'), /vier Häuser/);
  r.stock.houses = 28; r.manage(a, 1, 'sell'); assert.equal(r.stock.houses, 24); assert.equal(r.stock.hotels, 12); invariant(r);
  r.stock.hotels = 0; assert.throws(() => r.manage(a, 3, 'build'), /vorrat/i); r.dispose();
});
test('Monopoly: Hypothek halber Wert, Auslösen mit zehn Prozent, Gebäude vorher verkaufen', () => {
  const { r, ids: [a] } = table(); r.owned[1].owner = a; r.manage(a, 1, 'mortgage'); assert.equal(r.people[a].money, 1530);
  r.manage(a, 1, 'unmortgage'); assert.equal(r.people[a].money, 1497); assert.equal(r.owned[1].mortgage, false);
  r.owned[3].owner = a; r.manage(a, 1, 'build'); assert.throws(() => r.manage(a, 3, 'mortgage'), /Gebäude/); invariant(r); r.dispose();
});

test('Monopoly: Hypothekenzinsen werden ohne Gleitkomma-Aufschlag für alle 28 Grundstücke berechnet', () => {
  const { r, ids: [a] } = table();
  for (const i of PROPERTIES) {
    r.owned[i].owner = a; const before = r.people[a].money;
    r.manage(a, i, 'mortgage'); r.manage(a, i, 'unmortgage');
    assert.equal(r.people[a].money, before - Math.ceil(BOARD[i].price / 20), r.fieldName(i));
  }
  invariant(r); r.dispose();
});
test('Monopoly: drei Pasche, Gefängnis bezahlen/Freikarte/Pasch/dritter Versuch', () => {
  const { r, ids: [a] } = table(2, { noAuction: true });
  r.roll = seq(1, 1, 2, 2, 3, 3); r.decks.chest = [3, ...r.decks.chest.filter((i) => i !== 3)];
  r.throwDice(a); if (r.step === 'buy') r.buy(a, true); r.throwDice(a); if (r.step === 'buy') r.buy(a, true); r.throwDice(a);
  assert.equal(r.people[a].jail, true); assert.equal(r.people[a].position, 10);
  r.step = 'jail'; r.leaveJail(a, 'pay'); assert.equal(r.step, 'roll'); assert.equal(r.people[a].jail, false);
  r.jail(a); r.step = 'jail'; r.people[a].free = [{ deck: 'event', index: 7 }]; r.decks.event = r.decks.event.filter((i) => i !== 7); r.leaveJail(a, 'card'); assert.equal(r.people[a].free.length, 0);
  r.jail(a); r.step = 'jail'; r.roll = seq(2, 2); r.throwDice(a); assert.equal(r.people[a].position, 14); assert.equal(r.again, false);
  r.jail(a); r.step = 'jail'; r.people[a].tries = 2; const before = r.people[a].money; r.roll = seq(1, 2); r.throwDice(a); assert.equal(r.people[a].money, before - 50); assert.equal(r.people[a].position, 13); r.dispose();
});
test('Monopoly: Versteigerung ab 1, alle dürfen bieten, kein Gebot über Bargeld', () => {
  const { r, ids: [a, b] } = table(); r.people[a].position = 1; r.step = 'buy'; r.buy(a, false);
  r.bid(a, 1); assert.throws(() => r.bid(b, 1), /mindestens/); assert.throws(() => r.bid(b, 2000), /Bargeld/);
  r.bid(b, 20); r.passAuction(a); assert.equal(r.auction, null); assert.equal(r.owned[1].owner, b); assert.equal(r.people[b].money, 1480); invariant(r); r.dispose();
});
test('Monopoly: Handel, Gegenangebot, Eigentumsprüfung und sofortige Übernahmezinsen', () => {
  const { r, ids: [a, b] } = table(); r.owned[1].owner = a; r.owned[3].owner = b; r.manage(a, 1, 'mortgage');
  r.proposeTrade(a, b, { properties: [1] }, { money: 50 });
  r.proposeTrade(b, a, { money: 40 }, { properties: [1] }); r.respondTrade(a, true);
  assert.equal(r.owned[1].owner, b); assert.equal(r.people[b].money, 1457); assert.equal(r.people[a].money, 1570); invariant(r);
  assert.throws(() => r.proposeTrade(a, b, { properties: [1] }, {}), /eigene/); r.dispose();
});
test('Monopoly: Bankrott überträgt Besitz an Spieler, Bankbesitz wird mit drei Spielern versteigert', () => {
  for (const bank of [false, true]) {
    const { r, ids: [a, b] } = table(3); r.owned[1].owner = a; r.cash(a, null, 1490, 'Testausgabe'); r.charge(a, bank ? null : b, 1000, 'Testforderung');
    r.bankrupt(a); assert.equal(r.people[a].out, true); assert.equal(r.people[a].money, 0); assert.ok(!r.order.includes(a));
    if (bank) { assert.equal(r.auction.field, 1); r.bid(b, 1); for (const id of [...r.auction.participants]) if (id !== b) r.passAuction(id); assert.equal(r.owned[1].owner, b); }
    else assert.equal(r.owned[1].owner, b);
    invariant(r); r.dispose();
  }
});
test('Monopoly: kein verfrühter Bankrott, automatische Liquidation und Zeitwertung', () => {
  const { r, ids: [a, b] } = table(); r.owned[39].owner = a; r.cash(a, null, 1490, 'Testausgabe'); r.charge(a, b, 100, 'Miete');
  assert.throws(() => r.bankrupt(a), /Hypotheken/); r.onTimeout(a); assert.equal(r.debt, null); assert.equal(r.owned[39].mortgage, true); invariant(r);
  r.finishWealth(); assert.equal(r.phase, 'over'); assert.ok(r.result.winners.includes(b)); r.dispose();
});

test('Monopoly: sämtliche Ereignis- und Gemeinschaftskarten erhalten Geld, Gebäude und Stapel', () => {
  for (const kind of ['event', 'chest']) for (let index = 0; index < 16; index++) {
    const { r, ids: [a] } = table(3, { startMoney: 5000 });
    r.roll = () => 3; r.people[a].position = kind === 'event' ? 7 : 2;
    r.decks[kind] = [index, ...r.decks[kind].filter((i) => i !== index)];
    r.drawCard(a, kind); invariant(r); assert.equal(r.debt, null); r.dispose();
  }
});

test('Monopoly: Los, doppelt auf Los und Steuern im Frei-Parken-Topf', () => {
  const { r, ids: [a] } = table(2, { doubleGo: true, parkingPot: true });
  r.people[a].position = 39; r.walk(a, 1); assert.equal(r.people[a].money, 1900);
  r.people[a].position = 3; r.walk(a, 1); assert.equal(r.pot, 200); assert.equal(r.people[a].money, 1700);
  r.people[a].position = 19; r.walk(a, 1); assert.equal(r.pot, 0); assert.equal(r.people[a].money, 1900); invariant(r); r.dispose();
});
test('Monopoly: verdeckte Stapel und Zufallsfolge stehen nicht im Mitspieler-JSON; Snapshot zwischen Partien', () => {
  const { r, ids: [a, b] } = table(); const view = r.view(b);
  assert.equal(view.g.decks, undefined); assert.equal(view.g.bank, undefined); assert.equal(view.g.roll, undefined);
  assert.ok(!JSON.stringify(view).includes('decks')); r.abortRound(a); const restored = Room.restore(JSON.parse(JSON.stringify(r.snapshot())), () => {});
  assert.equal(restored.seats.length, 2); assert.equal(restored.phase, 'lobby'); r.dispose(); restored.dispose();
});
test('Monopoly: 20 eigene Bretter, bereinigte Namen, atomare Datei und Neustart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monopoly-boards-')), s = createBoardStore(dir), names = PROPERTIES.map((i) => 'Straße ' + i + '\n');
  const b = s.save({ title: 'Unser Abend\n', names }); assert.equal(b.title, 'Unser Abend'); assert.ok(b.names.every((n) => !n.includes('\n')));
  assert.equal(createBoardStore(dir).get(b.id).names[0], names[0].trim()); assert.throws(() => s.save({ title: 'x', names: [] }), /28/);
  for (let i = 1; i < 20; i++) s.save({ title: 'Brett ' + i, names }); assert.throws(() => s.save({ title: 'Mehr', names }), /20/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'monopoly-boards.json'), 'utf8')).boards.length, 20);
});
test('Monopoly: 100 Bot-Partien enden, Geld und Gebäude bleiben erhalten und nie negativ', () => {
  for (let k = 0; k < 100; k++) {
    const { r } = table(2 + k % 7, { quick: k % 2 === 0 }); let steps = 0;
    while (r.phase === 'playing' && steps++ < 40000) {
      const id = r.botDue() || r.currentId; botMove(r, id); if (steps % 30 === 0) invariant(r);
    }
    assert.equal(r.phase, 'over', `Partie ${k}: ${steps} Schritte, ${JSON.stringify(r.order.map((id) => ({ money: r.people[id].money, wealth: r.wealth(id) })))}`); invariant(r); r.dispose();
  }
});
