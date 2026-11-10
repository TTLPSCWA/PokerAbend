# EXP-003 · Mau-Mau

Implementierung: `68220eeb97e16fed3cf54d28db68b6767336c4b0`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Küchentisch: Wachstuch-Karo über dem Tisch, eigene Zeichnungen von Kaffeetasse mit Löffel und Brotkorb am Rand. |
| Figuren & Material | Der Bube trägt in der Hand eine Wunschfahne. Fliegende Kartenrücken in den Tischfarben. |
| Klang | Palette `maumau`: lockeres Kartenschnippen, Löffelklirren bei „Mau“ (letzte Karte), Doppelklirr bei „Mau-Mau“, Tock je 7 der Kette, absinkender Ton beim Aussetzen (erzeugt). |
| Animation | Die 7er-Kette zählt über der Ablage sichtbar hoch (+2, +4 …, gestapelt größer). Die 8 lässt den nächsten Platz kurz blass „einschlafen“ („z z z“). Gezogene Karten fächern in die Hand oder fliegen als Rücken zum Platz. |
| Highlight | „Mau-Mau!“: Die Tasse hüpft, Kaffee schwappt, Herz-Stempel mit dem Namen des Gewinners; das Ergebnisfenster wartet so lange. |

Spiellogik unverändert.

## Geheimnisse

Fremde Karten fliegen nur als Kartenrücken. Alle Ereignisse werden aus öffentlichen Angaben abgelesen (Kartenzahl, Ablage, offene Strafe, Zugfolge).

## Abweichungen

- Das deutsche Blatt aus VIS-003 bleibt unverändert; neu sind nur Wunschfahne und Tischwelt.
- Der Herz-Stempel erscheint in der Tischmitte mit dem Namen, nicht am Platz, damit er auf dem Handy lesbar bleibt.

## Prüfungen

- `test/ui/exp-maumau.spec.js`: **6 bestanden** (Desktop und Mobilansicht) mit drei Menschen: echte Züge (Ablegen, Ziehen), dazu 7er-Kette, 8, „Mau“ und „Mau-Mau!“ über den Darstellungs-Hook auf dem echten Tisch; nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-shedding.test.js`: 5 Tests. `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 168 | 3033.1 ms | 55.06 | ≥ 45 |
| Mobilansicht | 170 | 3116.4 ms | 54.23 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- 7er-Kette: [Desktop](siebenerkette-desktop.png), [Mobilansicht](siebenerkette-mobil.png)
- Mau-Mau!: [Desktop](maumau-desktop.png), [Mobilansicht](maumau-mobil.png)
