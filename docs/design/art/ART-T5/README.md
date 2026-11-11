# ART-T5 · Winterwelten

Implementierungscommit: `IMPL_COMMIT`

## Ergebnis

Feinschliff der zehn Winterwelten X-01 bis X-10 in UNO (Classic), Skip-Bo und Phase 10 (`public/games/card-worlds/pilot-winter.css`, nur für Welten mit ID `X-…`) und ruhiger Schneefall.

- **Karten:** Schneehaube am oberen Rand, Ecksymbole darunter. Aktionskarten (UNO-Aktionen, Skip-Bo-Joker, Phase-10-Joker und Aussetzen) tragen Zuckerstangen-Streifen, größeres Symbol und doppelten Medaillon-Ring.
- **UNO-Rückseite:** Kartenzahl als Marke unten, das Motiv bleibt frei.
- **Tisch:** Schneeverwehung am Rand der Spielflächen. Rahmendetails: X-01 und X-08 feine Innenlinie, X-04 harte Pixelkanten.
- **Schneefall:** drei Ebenen (fern, mittel, nah), nur `transform`-Animation, ohne zusätzliche Elemente pro Karte, ohne Mausfang. Knopf ❄ links unten schaltet ihn ab; die Wahl gilt pro Gerät (localStorage, Standard: an). Bei „weniger Bewegung“ im System stehen die Flocken still. Außerhalb der Winterwelten gibt es weder Schnee noch Knopf.

## Nachweise

| Datei | Inhalt |
|---|---|
| `farbenchaos-desktop.webp`, `stapelrennen-desktop.webp`, `zehnetappen-desktop.webp` | alle 10 Winterwelten je Spiel (Desktop 1440 × 900) |
| `*-mobil.webp` | X-01, X-04, X-07 am Handy (390 × 844) |
| `test/ui/art-t5-winter.spec.js` | je Welt und Spiel: Weltbild, Medaillon in der Karte, Schnee vorhanden; Abschalten und Merken; Gäste sehen Schnee; kein Schnee außerhalb Winter; Eingabe nicht blockiert; nur `transform` animiert |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t5-winter.spec.js` (Einzelbilder unter `test-results/art-t5/`).
