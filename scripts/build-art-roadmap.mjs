// Erzeugt docs/design/game-art-roadmap.json aus GAME_ART_ROADMAP.md (Quelle ist die Markdown-Datei).
import { readFileSync, writeFileSync } from 'node:fs';
const md = readFileSync('docs/design/GAME_ART_ROADMAP.md', 'utf8');
const vis = JSON.parse(readFileSync('docs/design/game-visual-roadmap.json', 'utf8'));
const visId = Object.fromEntries(vis.packages.map((p) => [p.game_id, p.id]));
const keys = { 'Ziel': 'goal', 'Material': 'material', 'Umsetzung': 'implementation_note' };
const blocks = md.split('\n#### ').slice(1);
// ART-T: spielübergreifende Kartenwelten (UNO, Skip-Bo, Phase 10), eigene Liste ohne VIS-Kopplung
const worldPackages = blocks.filter((b) => b.startsWith('ART-T')).map((block) => {
  const [head, ...lines] = block.split('\n');
  const m = head.match(/^(ART-T\d+[a-z]?) · (.+?) · (P\d)$/);
  if (!m) throw new Error('Unlesbarer Eintrag: ' + head);
  const entry = { id: m[1], name: m[2], priority: m[3], games: [], status: 'planned', implementation_commit: null };
  for (const line of lines) { const f = line.match(/^- \*\*(.+?):\*\* (.+)$/); if (f && keys[f[1]]) entry[keys[f[1]]] = f[2]; if (f && f[1] === 'Spiele') entry.games = [...f[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]); }
  const body = lines.join('\n');
  if (/^- \*\*Status:\*\* done$/m.test(body)) {
    entry.status = 'done';
    entry.implementation_commit = body.match(/^- \*\*Implementierungscommit:\*\* `([a-f0-9]{40})`$/m)?.[1] || null;
    entry.evidence = [...(body.match(/^- \*\*Nachweise:\*\* (.+)$/m)?.[1] || '').matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    if (!entry.implementation_commit || !entry.evidence.length) throw new Error(entry.id + ': done braucht Commit und Nachweise');
  }
  return entry;
});
const packages = blocks.filter((b) => !b.startsWith('ART-T')).map((block) => {
  const [head, ...lines] = block.split('\n');
  const m = head.match(/^(ART-\d{3}) · (.+?) \(`([^`]+)`\) · (P\d)$/);
  if (!m) throw new Error('Unlesbarer Eintrag: ' + head);
  const entry = { id: m[1], game_id: m[3], game_name: m[2], priority: m[4], vis_id: visId[m[3]] || null, status: 'planned', implementation_commit: null };
  for (const line of lines) { const f = line.match(/^- \*\*(.+?):\*\* (.+)$/); if (f && keys[f[1]]) entry[keys[f[1]]] = f[2]; }
  const body = lines.join('\n');
  if (/^- \*\*Status:\*\* done$/m.test(body)) {
    entry.status = 'done';
    entry.implementation_commit = body.match(/^- \*\*Implementierungscommit:\*\* `([a-f0-9]{40})`$/m)?.[1] || null;
    entry.evidence = [...(body.match(/^- \*\*Nachweise:\*\* (.+)$/m)?.[1] || '').matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    if (!entry.implementation_commit || !entry.evidence.length) throw new Error(entry.id + ': done braucht Commit und Nachweise');
  }
  return entry;
});
writeFileSync('docs/design/game-art-roadmap.json', JSON.stringify({
  schema_version: 1, source: 'docs/design/GAME_ART_ROADMAP.md', generator: 'scripts/build-art-roadmap.mjs',
  status_policy: 'Ein Paket wird erst nach ausdrücklicher Freigabe seiner ID umgesetzt; danach status, implementation_commit und Nachweise eintragen. Alle übrigen Pakete sind nur geplant.',
  licenses: 'docs/design/ART_LICENSES.md', packages, world_packages: worldPackages,
}, null, 2) + '\n');
console.log(`${packages.length} ART-Pakete, ${worldPackages.length} Kartenwelt-Pakete`);
