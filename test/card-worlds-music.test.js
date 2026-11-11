// ART-T6: Wiedergabeliste, Dateien und Lizenzliste der Wintermusik gehören zusammen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';

const js = readFileSync('public/card-worlds.js', 'utf8');
const tracks = [...js.match(/const TRACKS = \[(.*?)\];/s)[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
const DIR = 'public/games/card-worlds/music';

test('Jedes Stück der Wiedergabeliste existiert als MP3, es liegt keine Datei ohne Eintrag herum', () => {
  assert.ok(tracks.length >= 5);
  assert.equal(new Set(tracks).size, tracks.length);
  for (const t of tracks) assert.ok(existsSync(`${DIR}/${t}.mp3`), t);
  assert.deepEqual(readdirSync(DIR).sort(), tracks.map((t) => `${t}.mp3`).sort());
});

test('Dateien sind echte MP3 und klein genug (höchstens 2 MB je Stück, 14 MB gesamt)', () => {
  let sum = 0;
  for (const t of tracks) {
    const b = readFileSync(`${DIR}/${t}.mp3`), size = statSync(`${DIR}/${t}.mp3`).size;
    assert.ok(b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0), `${t}: kein MP3`);
    assert.ok(size < 2_000_000, `${t} ist zu groß`);
    sum += size;
  }
  assert.ok(sum < 14_000_000, 'Musik insgesamt zu groß');
});

test('Alle Stücke stehen mit Urheber, Quelle und Lizenz in ART_LICENSES.md', () => {
  const lic = readFileSync('docs/design/ART_LICENSES.md', 'utf8');
  assert.ok(lic.includes('Musik'), 'Abschnitt Musik fehlt');
  for (const t of tracks) assert.ok(lic.includes(`${t}.mp3`), `${t}.mp3 fehlt in ART_LICENSES.md`);
  assert.ok(lic.includes('CC0') && lic.includes('Pixabay'));
});

test('Musik startet nie von allein: Standard ist aus, gespeichert wird nur "on"', () => {
  assert.match(js, /getItem\(MUSIC_KEY\) === 'on'/);
});
