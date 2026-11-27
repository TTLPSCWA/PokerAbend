// Stellt eine geprüfte Sicherung (data/backups/<name> oder BACKUP_DIR/<name>) wieder her. Der Server muss gestoppt sein.
// Aufruf:  node scripts/restore-data-backup.mjs <Datenordner> <Sicherungsordner> --ja
// Ohne --ja wird nur geprüft (Manifest, SHA-256 jeder Datei) und angezeigt, was passieren würde.
import { resolve } from 'node:path';
import { restoreDataBackup, verifyBackup } from '../server/backup.js';

const [dataDir, backupDir, flag] = process.argv.slice(2);
if (!dataDir || !backupDir) { console.error('Aufruf: node scripts/restore-data-backup.mjs <Datenordner> <Sicherungsordner> [--ja]'); process.exit(2); }
try {
  const files = verifyBackup(resolve(backupDir));
  console.log(`Sicherung geprüft: ${files.length} Datei(en), alle SHA-256-Summen stimmen.`);
  if (flag !== '--ja') { console.log('Nichts verändert. Mit --ja wiederherstellen (der aktuelle Stand wird vorher gesichert).'); process.exit(0); }
  const done = restoreDataBackup(resolve(dataDir), resolve(backupDir));
  console.log(`Wiederhergestellt: ${done.restored} Datei(en). Stand davor gesichert in: ${done.previous}`);
} catch (error) { console.error('Abgebrochen:', error.message); process.exit(1); }
