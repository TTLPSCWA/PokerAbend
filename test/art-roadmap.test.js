// Grafik-Roadmap (ART, Stufe 3): eindeutig, an VIS-Nummern gekoppelt, aus der Markdown-Quelle aktuell, Lizenzen dokumentiert.
import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));

test('ART-Nummern folgen den VIS-Nummern, jedes Paket hat Ziel und Material', () => {
  const art = json('docs/design/game-art-roadmap.json'), vis = json('docs/design/game-visual-roadmap.json');
  const ids = art.packages.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'doppelte IDs');
  for (const p of art.packages) {
    const v = vis.packages.find((x) => x.game_id === p.game_id);
    assert.ok(v, 'unbekanntes Spiel: ' + p.game_id);
    assert.equal(p.id.slice(4), v.id.slice(4), p.id);
    assert.ok(p.goal?.length >= 10 && p.material?.length >= 5, p.id);
    if (p.status === 'planned') assert.equal(p.implementation_commit, null, p.id);
  }
});

test('game-art-roadmap.json ist aus der Markdown-Quelle erzeugt und aktuell', () => {
  const before = readFileSync('docs/design/game-art-roadmap.json', 'utf8');
  execFileSync(process.execPath, ['scripts/build-art-roadmap.mjs']);
  assert.equal(readFileSync('docs/design/game-art-roadmap.json', 'utf8'), before, 'node scripts/build-art-roadmap.mjs ausführen');
});

test('Abgeschlossene ART-Pakete tragen Commit und vorhandene Nachweise', () => {
  const roadmap = json('docs/design/game-art-roadmap.json');
  for (const p of [...roadmap.packages, ...roadmap.world_packages].filter((p) => p.status === 'done')) {
    assert.match(p.implementation_commit, /^[a-f0-9]{40}$/, p.id);
    for (const path of p.evidence) assert.ok(existsSync(path), path);
    assert.ok(p.evidence.some((path) => path.endsWith('.md') && readFileSync(path, 'utf8').includes(p.implementation_commit)), p.id + ': Commit fehlt im Nachweis');
  }
});

test('Jede Grafik unter public/games/*/art/ steht in der Lizenzliste, Dateien bleiben klein', () => {
  const licenses = readFileSync('docs/design/ART_LICENSES.md', 'utf8');
  for (const game of readdirSync('public/games')) {
    const dir = `public/games/${game}/art`;
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      // ART-T1: Kartenwelten liegen je Welt in einem Unterordner (<Welt>/0–3, w, back.svg)
      if (statSync(`${dir}/${file}`).isDirectory()) {
        const world = licenses.includes(`${dir}/<Welt>/`);
        // Kartenwelten: ein Sammeleintrag je Ordner. Alle anderen Unterordner (z. B. Designs/Skins wie schiffe/art/naval/): jede Datei einzeln
        if (world) assert.ok(licenses.includes(file), `${dir}/${file}/ fehlt in docs/design/ART_LICENSES.md`);
        for (const inner of readdirSync(`${dir}/${file}`)) {
          if (!world) assert.ok(licenses.includes(`${dir}/${file}/${inner}`), `${dir}/${file}/${inner} fehlt in docs/design/ART_LICENSES.md`);
          assert.ok(readFileSync(`${dir}/${file}/${inner}`).length < 60_000, `${dir}/${file}/${inner} ist zu groß`);
        }
        continue;
      }
      const listed = licenses.includes(`${dir}/${file}`) || licenses.includes(`${dir}/${file.replace(/c[1-5]\.svg$/, 'c1…c5.svg')}`);
      assert.ok(listed, `${dir}/${file} fehlt in docs/design/ART_LICENSES.md`);
      assert.ok(readFileSync(`${dir}/${file}`).length < 60_000, `${dir}/${file} ist zu groß`);
    }
  }
});

test('Kartenwelt-Pakete (ART-T) sind eindeutig, nennen ihre Spiele und haben Ziel und Material', () => {
  const list = json('docs/design/game-art-roadmap.json').world_packages;
  assert.ok(list.length >= 1);
  assert.equal(new Set(list.map((p) => p.id)).size, list.length);
  for (const p of list) {
    assert.match(p.id, /^ART-T\d+[a-z]?$/);
    assert.ok(p.games.length >= 1 && p.games.every((g) => ['farbenchaos', 'stapelrennen', 'zehnetappen'].includes(g)), p.id);
    assert.ok(p.goal?.length >= 10 && p.material?.length >= 5, p.id);
    if (p.status === 'planned') assert.equal(p.implementation_commit, null, p.id);
  }
});
