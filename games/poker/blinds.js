// Steigende Blinds: Level-Listen und die Rechnung, welches Level gerade dran ist.
// Reine Funktionen ohne Zustand – den Zustand (verstrichene Zeit, gespielte Hände) hält der Raum.

// Vorlagen: Faktor auf die Start-Blinds je Level, dazu passende Abstände in Minuten bzw. Händen
export const BLIND_PRESETS = {
  fast: { label: 'Schnell', minutes: 6, hands: 8, steps: [1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 120, 200] },
  normal: { label: 'Normal', minutes: 12, hands: 15, steps: [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 100] },
  long: { label: 'Lang', minutes: 20, hands: 25, steps: [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50] },
};
export const BLIND_MODES = ['off', 'minutes', 'hands'];
export const MAX_LEVELS = 40;
const MAX_BLIND = 1e7;

// Auf zwei gültige Stellen runden (125 → 130, 1.234 → 1.200), damit die Beträge glatt aussehen
export function nice(n) {
  if (n < 20) return Math.max(1, Math.round(n));
  const m = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / m) * m;
}

// Eigene Liste aus dem Host-Menü: eine Zeile pro Level, „50/100“ (auch „50 100“ oder „50-100“)
export function parseBlindList(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(/\r?\n/);
  const out = [];
  for (const line of raw.slice(0, 200)) {
    const m = String(line).trim().match(/^(\d{1,8})\s*[/\s\-–]\s*(\d{1,8})$/);
    if (!m) continue;
    const sb = Number(m[1]), bb = Number(m[2]);
    if (sb < 1 || bb < 2 || sb > bb || bb > MAX_BLIND) continue;
    out.push({ sb, bb });
    if (out.length >= MAX_LEVELS) break;
  }
  return out;
}

// Alle Level für die aktuellen Einstellungen. Vorlagen starten bei den eingestellten Blinds,
// eine eigene Liste ist vollständig (Level 1 = erste Zeile). Level werden nie kleiner.
export function blindLevels(settings) {
  const base = { sb: settings.smallBlind, bb: settings.bigBlind };
  if (settings.blindPreset === 'custom') {
    const list = parseBlindList(settings.blindList);
    const out = [];
    for (const l of list) if (!out.length || l.bb > out[out.length - 1].bb) out.push(l);
    if (out.length) return out;
  }
  const preset = BLIND_PRESETS[settings.blindPreset] || BLIND_PRESETS.normal;
  const ratio = base.sb / base.bb;
  const out = [];
  for (const f of preset.steps) {
    const bb = Math.min(MAX_BLIND, f === 1 ? base.bb : nice(base.bb * f));
    const sb = f === 1 ? base.sb : Math.max(1, Math.min(bb, Math.round(bb * ratio)));
    const prev = out[out.length - 1];
    if (prev && bb <= prev.bb) continue; // nie kleiner werden, keine doppelten Level
    out.push({ sb, bb });
  }
  return out;
}

// Welches Level gilt nach so viel Zeit bzw. so vielen Händen? (0 = erstes Level, höchstens das letzte)
export function levelIndex({ mode, every, elapsedMs = 0, hands = 0, count }) {
  if (mode === 'off' || !every || count <= 1) return 0;
  const i = mode === 'minutes' ? Math.floor(elapsedMs / (every * 60000)) : Math.floor(hands / every);
  return Math.max(0, Math.min(count - 1, i));
}

// Wie lange noch bis zum nächsten Level? null = aus oder schon das höchste Level
export function untilNext({ mode, every, elapsedMs = 0, hands = 0, count }) {
  const i = levelIndex({ mode, every, elapsedMs, hands, count });
  if (mode === 'off' || i >= count - 1) return null;
  if (mode === 'minutes') return { index: i + 1, msLeft: Math.max(0, (i + 1) * every * 60000 - elapsedMs) };
  return { index: i + 1, handsLeft: Math.max(0, (i + 1) * every - hands) };
}
