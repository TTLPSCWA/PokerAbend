// Geprüfte Sicherung des Datenordners vor Masseneingriffen (Spieler löschen, Bestenliste zurücksetzen) und Wiederherstellung.
//
// Sicherung: kopiert alles außer dem Ordner backups/ in <Ziel>/<label>-<Zeitstempel>/, schreibt MANIFEST.json mit der SHA-256-Summe jeder
// Datei, vergleicht danach Quelle und Kopie und meldet nur bei vollständiger Übereinstimmung Erfolg. Ein halber Ordner gilt nie als Sicherung
// (Zwischenordner, dann Umbenennen); eine vorhandene Sicherung wird nie überschrieben.
// Ziel: standardmäßig <Datenordner>/backups; mit BACKUP_DIR (absoluter Pfad, z. B. ein anderes Volume) außerhalb des Datenvolumes.
//
// Wiederherstellung: Server stoppen, dann restoreDataBackup(). Sie prüft die Sicherung gegen ihr Manifest, sichert vorher den aktuellen Stand
// unter <Ziel>/vor-wiederherstellung-<Zeitstempel>/ und stellt erst dann Datei für Datei wieder her (Datei wird atomar ersetzt).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

const MANIFEST = 'MANIFEST.json';
const hashOf = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });

function walk(dir, base = dir, out = [], skip = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(base, full);
    if (skip.some((s) => rel === s || rel.startsWith(s + '/') || rel.startsWith(s + '\\'))) continue;
    if (statSync(full).isDirectory()) walk(full, base, out, skip); else out.push(rel);
  }
  return out;
}
export function backupRoot(dataDir, root = process.env.BACKUP_DIR) {
  if (!root) return join(dataDir, 'backups');
  if (!isAbsolute(root)) throw fail(500, 'BACKUP_DIR muss ein absoluter Pfad sein');
  return resolve(root);
}
const skipFor = (dataDir, root) => { const rel = relative(dataDir, root); return rel && !rel.startsWith('..') && !isAbsolute(rel) ? [rel] : []; };

export function createDataBackup(dataDir, label = 'admin', { now = () => new Date(), root = process.env.BACKUP_DIR } = {}) {
  if (!/^[a-z0-9-]{1,40}$/.test(label)) throw fail(400, 'Ungültiger Sicherungsname');
  if (!existsSync(dataDir)) return { ok: true, files: 0, dir: null, empty: true };
  const base = backupRoot(dataDir, root), skip = skipFor(dataDir, base);
  const stamp = now().toISOString().replace(/[:.]/g, '-');
  let target = join(base, `${label}-${stamp}`);
  for (let n = 2; existsSync(target); n++) target = join(base, `${label}-${stamp}-${n}`); // nie eine vorhandene Sicherung überschreiben
  const temp = `${target}.tmp`;
  mkdirSync(base, { recursive: true, mode: 0o700 });
  rmSync(temp, { recursive: true, force: true });
  const files = walk(dataDir, dataDir, [], skip);
  mkdirSync(temp, { recursive: true, mode: 0o700 });
  const manifest = { version: 1, label, created: now().toISOString(), files: {} };
  try {
    for (const rel of files) {
      mkdirSync(join(temp, rel, '..'), { recursive: true });
      cpSync(join(dataDir, rel), join(temp, rel));
      manifest.files[rel.replace(/\\/g, '/')] = hashOf(join(temp, rel));
      if (hashOf(join(dataDir, rel)) !== manifest.files[rel.replace(/\\/g, '/')]) throw fail(503, 'Die Sicherung konnte nicht geprüft werden – nichts wurde verändert');
    }
    writeFileSync(join(temp, MANIFEST), JSON.stringify(manifest, null, 2), { mode: 0o600 });
    renameSync(temp, target);
  } catch (error) { rmSync(temp, { recursive: true, force: true }); throw error.status ? error : fail(503, 'Die Sicherung konnte nicht angelegt werden – nichts wurde verändert'); }
  return { ok: true, files: files.length, dir: relative(root ? base : dataDir, target).replace(/\\/g, '/'), path: target, verified: true };
}

/** Prüft eine Sicherung gegen ihr Manifest: gibt die Dateiliste zurück oder wirft. */
export function verifyBackup(dir) {
  if (!existsSync(join(dir, MANIFEST))) throw fail(400, 'Kein Manifest – das ist keine geprüfte Sicherung');
  const manifest = JSON.parse(readFileSync(join(dir, MANIFEST), 'utf8'));
  const names = Object.keys(manifest.files || {});
  for (const rel of names) {
    if (rel.includes('..') || isAbsolute(rel)) throw fail(400, 'Ungültiger Pfad im Manifest');
    if (!existsSync(join(dir, rel)) || hashOf(join(dir, rel)) !== manifest.files[rel]) throw fail(409, `Die Sicherung ist beschädigt: ${rel}`);
  }
  const extra = walk(dir, dir).map((r) => r.replace(/\\/g, '/')).filter((r) => r !== MANIFEST && !(r in manifest.files));
  if (extra.length) throw fail(409, `Die Sicherung enthält unerwartete Dateien: ${extra[0]}`);
  return names;
}

/**
 * Stellt eine geprüfte Sicherung wieder her. Der Server muss gestoppt sein (die Funktion kann das nicht erkennen).
 * Reihenfolge: Sicherung prüfen → aktuellen Stand sichern → Dateien wiederherstellen → Ergebnis prüfen.
 */
export function restoreDataBackup(dataDir, backupDir, { now = () => new Date(), root = process.env.BACKUP_DIR } = {}) {
  const names = verifyBackup(backupDir);
  const before = createDataBackup(dataDir, 'vor-wiederherstellung', { now, root });
  const manifest = JSON.parse(readFileSync(join(backupDir, MANIFEST), 'utf8'));
  const base = backupRoot(dataDir, root), skip = skipFor(dataDir, base);
  for (const rel of walk(dataDir, dataDir, [], skip)) if (!(rel.replace(/\\/g, '/') in manifest.files)) rmSync(join(dataDir, rel), { force: true }); // nicht zur Sicherung gehörende Dateien entfernen
  for (const rel of names) {
    const dest = join(dataDir, rel), temp = dest + '.restore';
    mkdirSync(join(dest, '..'), { recursive: true });
    cpSync(join(backupDir, rel), temp);
    renameSync(temp, dest);
  }
  for (const rel of names) if (hashOf(join(dataDir, rel)) !== manifest.files[rel]) throw fail(500, `Wiederherstellung unvollständig: ${rel}. Stand vor dem Versuch: ${before.path}`);
  return { restored: names.length, previous: before.path };
}
