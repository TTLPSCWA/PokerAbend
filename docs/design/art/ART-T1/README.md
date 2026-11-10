# ART-T1 · Kartenwelten-Fundament

Implementierungscommit: `361294f68aa1b99de6999cf69ad83a778db21ff5`

## Ergebnis

- Host-Menü → **Kartenwelt**: Standard, 10 Welten des Spiels und 10 Winterwelten. Gilt für alle am Tisch, nur Aussehen, auch mitten in der Runde.
- UNO (Classic), Skip-Bo und Phase 10 nutzen dieselbe Kartenvorlage: Weltfarbe als Kartenfläche, Weltbild im Fenster, Wert als Medaillon unten, Ecke oben links, Farbsymbol oben rechts.
- Tisch und Flächen nehmen den Ton der Welt an. UNO-Varianten mit eigener Gestaltung bleiben unverändert.
- Aufbau und Regeln: `docs/design/CARD_WORLDS.md`.

## Nachweise

| Datei | Inhalt |
|---|---|
| `farbenchaos-desktop.webp` | alle 20 UNO-Welten (Desktop 1440 × 900) |
| `stapelrennen-desktop.webp` | alle 20 Skip-Bo-Welten |
| `zehnetappen-desktop.webp` | alle 20 Phase-10-Welten |
| `*-mobil.webp` | Pilotwelten und X-07 am Handy (390 × 844) |
| `host-menu-desktop.webp`, `host-menu-mobil.webp` | Auswahl im Host-Menü |
| `fps-desktop.json` | Rechenzeit und Bildrate mit/ohne Welt bei 4× gedrosselter CPU |

Übersichtsbilder: `ART_CAPTURE=1 npx playwright test test/ui/art-card-worlds.spec.js` legt die Einzelbilder unter `test-results/art-t1/` ab; daraus wurden die Übersichten zusammengesetzt (Kacheln mit Welt-ID).

Leistung (U-01, Hand und Ablage in Bewegung):

```json
{
  "fps": 50.497,
  "baselineFps": 47.292,
  "workSeconds": 1.793,
  "baselineWorkSeconds": 1.832,
  "cpuThrottle": 4,
  "minRatio": 0.9,
  "method": "Hauptthread-Rechenzeit ohne/mit Kartenwelt U-01 (Median aus 5 Läufen, Reihenfolge wechselnd); ratio = Rechenzeit ohne / mit",
  "ratio": 1.022,
  "fpsRatio": 1.068
}
```

## Tests

- `test/card-worlds.test.js`: 40 Welten, je Spiel 10 + 10 Winter, Farbtöne der Spielfarben (max. 45°), erzeugte Bilder/Variablen/Schriften, Server (nur Host, ungültige Welten, Speichern, Spielwechsel).
- `test/ui/art-card-worlds.spec.js`: jede Welt jedes Spiels am Desktop (Pilotwelten am Handy), Gäste sehen dieselbe Welt, Standard stellt das bisherige Aussehen her, UNO Flip bleibt unverändert, Bildrate.
- Unverändert grün: `art-farbenchaos`, `art-stapelrennen`, `art-zehnetappen`, Smoke, Card-UX (Desktop), `npm test`.
