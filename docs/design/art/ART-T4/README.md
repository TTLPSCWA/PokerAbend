# ART-T4 · Restliche Skip-Bo- und Phase-10-Welten

Implementierungscommit: `IMPL_COMMIT`

## Ergebnis

Feinschliff der Welten, die nach den Pilotwelten noch fehlten (nur Aussehen, Spiellogik unverändert, Pilot-, Winter- und andere Welten unberührt).

- **Skip-Bo (SB-02, SB-03, SB-05, SB-06, SB-07, SB-08, SB-10):** Bauplätze als Weltmotiv (Klötzchen-Noppen, Pergamentkarte, Tiefsee-Blasen, Bauplan-Raster, Eintrittskarte, Startrampe mit Warnstreifen, Schmiede mit Nieten). Fortschrittsbalken in Weltfarben, leere Plätze zeigen das Weltbild, Joker mit Streifen und großem Medaillon. Helle Welten (SB-03, SB-07) mit dunkler Schrift. Datei: `public/games/card-worlds/more-skipbo.css`.
- **Phase 10 (P-01, P-02, P-04, P-05, P-07, P-08, P-09):** Phasenanzeige als Reise (Flammen, Blöcke mit Flagge, Goldmünzen, Zahnräder, Tempelsteine, Sterne, Teller), Joker und Aussetzen mit Streifen und Querstrich, Rückseite mit Zahlenband, Planungsfelder in Weltfarben. P-07 und P-09 mit dunkler Schrift auf hellem Panel. Datei: `public/games/card-worlds/more-phase10.css`.

## Nachweise

| Datei | Inhalt |
|---|---|
| `skipbo-uebersicht.webp` | alle sieben Skip-Bo-Welten (Bauplätze, Joker) |
| `phase10-uebersicht.webp` | alle sieben Phase-10-Welten (Reise, Hand mit Joker und Aussetzen) |
| `P-02-mobil.webp`, `P-09-mobil.webp` | Handy-Ansicht |
| `test/ui/art-t4-skipbo-worlds.spec.js`, `test/ui/art-t4-phase10-worlds.spec.js` | Stationen/Bauplätze unterscheidbar, Textkontrast, Joker/Aussetzen, Rückseite, Weltbild auf den Karten |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t4-*.spec.js`.
