// Monopoly-Theme-Assets: Dateien gegen das Manifest prüfen (Paket F). Ohne Abhängigkeiten: WebP- und PNG-Köpfe werden selbst gelesen.
//   verifyBundle(dir, manifest) → { errors, orphans, files, bytes }   dir enthält manifest.json und assets/
import { readFileSync, readdirSync, existsSync, statSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { validateManifest, FILE_NAME, MIME } from '../../public/games/monopoly/theme-manifest.js';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// WebP-Kopf: Abmessungen, Transparenz, Animation. null = kein (lesbares) WebP.
export function webpInfo(b) {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('latin1', 12, 16);
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), alpha: !!(b[20] & 0x10), animated: !!(b[20] & 0x02) };
  if (kind === 'VP8 ') { if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null; return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, alpha: false, animated: false }; }
  if (kind === 'VP8L') { if (b[20] !== 0x2f) return null; const v = b.readUInt32LE(21); return { width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1, alpha: !!((v >>> 28) & 1), animated: false }; }
  return null;
}
// PNG-Kopf (Quellen des Builds): Abmessungen und ob Transparenz möglich ist
export function pngInfo(b) {
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('latin1', 12, 16) !== 'IHDR') return null;
  const type = b[25];
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), alpha: type === 4 || type === 6 || b.includes(Buffer.from('tRNS')) };
}

export function verifyBundle(dir, manifest, { requirePublishable = false } = {}) {
  const errors = validateManifest(manifest, { requirePublishable }), root = resolve(dir, 'assets'), listed = new Set();
  let files = 0, bytes = 0;
  if (errors.length) return { errors, orphans: [], files, bytes };
  for (const a of manifest.assets) for (const v of a.variants) {
    const w = `${a.id}/${v.name}`;
    // Pfadsicherheit zusätzlich zum strengen Dateinamen: nie außerhalb von assets/
    const path = resolve(root, v.file);
    if (!FILE_NAME.test(v.file) || !path.startsWith(root + sep)) { errors.push(`${w}: unzulässiger Pfad ${v.file}`); continue; }
    listed.add(v.file);
    if (!existsSync(path)) { errors.push(`${w}: Datei fehlt (${v.file})`); continue; }
    if (lstatSync(path).isSymbolicLink() || !statSync(path).isFile()) { errors.push(`${w}: keine reguläre Datei`); continue; }
    const buf = readFileSync(path); files++; bytes += buf.length;
    if (buf.length !== v.bytes) errors.push(`${w}: Größe ${buf.length} statt ${v.bytes}`);
    const hash = sha256(buf);
    if (hash !== v.sha256) errors.push(`${w}: Prüfsumme stimmt nicht`);
    const info = webpInfo(buf);
    if (!info) { errors.push(`${w}: kein gültiges WebP (nicht unterstütztes Format)`); continue; }
    if (!MIME.includes(v.mime)) errors.push(`${w}: MIME ${v.mime}`);
    if (info.animated) errors.push(`${w}: animierte Bilder sind nicht vorgesehen`);
    if (info.width !== v.width || info.height !== v.height) errors.push(`${w}: Abmessungen ${info.width}×${info.height} statt ${v.width}×${v.height}`);
    if (info.alpha !== v.alpha) errors.push(`${w}: Transparenz ${info.alpha} statt ${v.alpha}`);
  }
  const orphans = existsSync(root) ? readdirSync(root).filter((f) => !listed.has(f)) : [];
  return { errors, orphans, files, bytes };
}

export function readBundle(dir) {
  const file = join(dir, 'manifest.json');
  if (!existsSync(file)) throw new Error('manifest.json fehlt in ' + dir);
  return JSON.parse(readFileSync(file, 'utf8'));
}
