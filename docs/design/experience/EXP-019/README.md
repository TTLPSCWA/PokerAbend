# EXP-019 · Schlagfertig

Implementierung: `71c647ad2e39a2b37154c82face6465a74010a9d`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Comedy-Club: Backsteinwand hinter der Bühne, eigener Mikrofonständer am Rand, Spotlicht in der Auflösung. |
| Figuren & Material | Antworten sind Karteikarten (rote Kopflinie, blaue Schreiblinien). Jede Stimme ist ein eigenes Lach-Symbol neben der Stimmenzahl. |
| Klang | Palette `schlagfertig`: Publikumslachen in drei Stärken nach Stimmenzahl, Rimshot bei Gleichstand, Applaus beim Volltreffer (alle erzeugt und kurz), Mikrofon-Klopfen je Abstimmung, Papier beim Abgeben. |
| Animation | Abstimmung: Die Karteikarten kommen von beiden Seiten. Auflösung: Duell für Duell strahlt ein Lichtkegel die bessere Antwort an, die andere bleibt abgedunkelt. |
| Highlight | Alle Stimmen für eine Antwort: Standing Ovation mit Applaus, Rosenregen und Schriftzug. |

Spiellogik unverändert.

## Geheimnisse

Autoren und Stimmen erscheinen erst mit der Auflösung des Servers; in der Abstimmung stehen im Zustand nur die Texte.

## Abweichungen

- Im Finale (mehrere Stimmen auf viele Antworten) gibt es keinen Spot und keine Abdunklung, nur Lach-Symbole und Lachen.
- Das Lachen ist bewusst kurz (unter 0,6 Sekunden) und wird je Duell einmal gespielt.

## Prüfungen

- `test/ui/exp-schlagfertig.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit vier Menschen und einer echten Runde: Schreiben, vier Duelle (einstimmig, Gleichstand), Auflösung mit Spot, Lachen, Rimshot und Standing Ovation; nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, keine Autoren im Zustand vor der Auflösung, `expectNoLeak`.
- `test/experience-schlagfertig.test.js`: 3 Tests. `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 573 | 9749.6 ms | 58.67 | ≥ 45 |
| Mobilansicht | 556 | 9832.9 ms | 56.44 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Standing Ovation: [Desktop](ovation-desktop.png), [Mobilansicht](ovation-mobil.png)
