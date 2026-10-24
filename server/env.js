// Liest die .env im Projektordner ein – ohne Zusatzpaket.
// Bereits gesetzte Umgebungsvariablen gewinnen (z. B. aus Docker). Tests schalten das mit POKER_NO_DOTENV=1 ab.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');

if (process.env.POKER_NO_DOTENV !== '1' && existsSync(file)) {
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1); // "Wert" oder 'Wert'
    else value = value.replace(/\s+#.*$/, '');                  // Kommentar am Zeilenende
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
