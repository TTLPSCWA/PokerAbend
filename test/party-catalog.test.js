import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES, gameList } from '../games/index.js';
import { PARTY_GAMES } from '../games/party-catalog.js';

test('Bestehende Spiel-IDs bleiben unverändert und startbar', () => {
  assert.deepEqual(Object.keys(GAMES), [
    'poker', 'maumau', 'farbenchaos', 'maexchen', 'schocken', 'huetchen', 'zehnetappen', 'stapelrennen',
  ]);
  for (const game of gameList()) {
    assert.equal(game.status, 'spielbar');
    assert.ok(['karten', 'wuerfel', 'brett'].includes(game.category));
    assert.equal(typeof GAMES[game.id].create, 'function');
    assert.equal(typeof GAMES[game.id].restore, 'function');
  }
});

test('Geplante Partyspiele sind reine Katalogdaten ohne spielbare Servermodule', () => {
  assert.ok(PARTY_GAMES.length >= 25);
  const ids = new Set();
  for (const game of PARTY_GAMES) {
    assert.match(game.id, /^[a-z0-9-]{1,30}$/);
    assert.ok(!ids.has(game.id));
    ids.add(game.id);
    assert.equal(game.category, 'party');
    assert.equal(game.status, 'geplant');
    assert.equal(typeof game.description, 'string');
    assert.ok(game.players);
    assert.ok(game.duration);
    assert.ok(game.subtype);
    assert.equal(GAMES[game.id], undefined);
    assert.equal(gameList().some((entry) => entry.id === game.id), false);
  }
});

test('Alle vier Kategorien sind abgedeckt', () => {
  const categories = new Set([...gameList().map((g) => g.category), ...PARTY_GAMES.map((g) => g.category)]);
  assert.deepEqual([...categories].sort(), ['brett', 'karten', 'party', 'wuerfel']);
});
