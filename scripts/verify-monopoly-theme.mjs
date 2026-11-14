// Gebautes Monopoly-Theme-Bundle prüfen (ART-046, Paket F): Manifest, Dateien, Prüfsummen, Abmessungen, Transparenz, Budgets, Herkunft.
//   node scripts/verify-monopoly-theme.mjs <Bundle-Ordner> [--publish]
// --publish verlangt für jede Datei licenseStatus „cleared“ und publication „public-ok“ (Voraussetzung für alles unter public/).
import { resolve } from 'node:path';
import { readBundle, verifyBundle } from './lib/monopoly-theme-verify.mjs';
import { startBytes, lobbyBytes, BUDGET_CAPS } from '../public/games/monopoly/theme-manifest.js';

const args = process.argv.slice(2), dir = args.find((a) => !a.startsWith('--'));
if (!dir) { console.error('Aufruf: node scripts/verify-monopoly-theme.mjs <Bundle-Ordner> [--publish]'); process.exit(2); }
try {
  const manifest = readBundle(resolve(dir)), r = verifyBundle(resolve(dir), manifest, { requirePublishable: args.includes('--publish') });
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(`Theme ${manifest.themeId} (${manifest.release}): ${r.files} Dateien, ${kb(r.bytes)}`);
  if (!r.errors.length) console.log(`Lobby ${kb(lobbyBytes(manifest))}/${kb(BUDGET_CAPS.lobby)} · Mobil-Start ${kb(startBytes(manifest, 'mobile'))}/${kb(BUDGET_CAPS.mobileStart)} · Desktop-Start ${kb(startBytes(manifest, 'desktop'))}/${kb(BUDGET_CAPS.desktopStart)}`);
  if (r.orphans.length) console.log('Nicht im Manifest: ' + r.orphans.join(', '));
  if (r.errors.length) { console.error('FEHLER:\n  ' + r.errors.join('\n  ')); process.exit(1); }
  console.log('OK');
} catch (e) { console.error('Fehler: ' + e.message); process.exit(1); }
