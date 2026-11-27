// ADMIN-GAMES-02: vollständige, geprüfte Sicherung des Datenordners vor Masseneingriffen (Spieler löschen, Bestenliste zurücksetzen).
// Kopiert alles außer dem Ordner backups/ in backups/<label>-<Zeitstempel>/, vergleicht danach jede Datei per SHA-256 und meldet
// nur dann Erfolg, wenn alle Dateien übereinstimmen. Ein halber Ordner gilt nie als Sicherung (Zwischenordner, dann Umbenennen).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const hashOf = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (relative(base, full).split(/[\\/]/)[0] === 'backups') continue;
    if (statSync(full).isDirectory()) walk(full, base, out); else out.push(relative(base, full));
  }
  return out;
}

export function createDataBackup(dataDir, label = 'admin', now = () => new Date()) {
  if (!/^[a-z0-9-]{1,30}$/.test(label)) throw Object.assign(new Error('Ungültiger Sicherungsname'), { status: 400 });
  if (!existsSync(dataDir)) return { ok: true, files: 0, dir: null, empty: true };
  const stamp = now().toISOString().replace(/[:.]/g, '-');
  const root = join(dataDir, 'backups'), target = join(root, `${label}-${stamp}`), temp = `${target}.tmp`;
  mkdirSync(root, { recursive: true, mode: 0o700 });
  rmSync(temp, { recursive: true, force: true });
  const files = walk(dataDir);
  mkdirSync(temp, { recursive: true, mode: 0o700 });
  for (const rel of files) { mkdirSync(join(temp, rel, '..'), { recursive: true }); cpSync(join(dataDir, rel), join(temp, rel)); }
  const bad = files.filter((rel) => hashOf(join(dataDir, rel)) !== hashOf(join(temp, rel)));
  if (bad.length) { rmSync(temp, { recursive: true, force: true }); throw Object.assign(new Error('Die Sicherung konnte nicht geprüft werden – nichts wurde verändert'), { status: 503 }); }
  renameSync(temp, target);
  return { ok: true, files: files.length, dir: relative(dataDir, target).replace(/\\/g, '/'), verified: true };
}
