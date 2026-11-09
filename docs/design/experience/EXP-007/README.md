# EXP-007 · Mensch ärgere Dich nicht

Implementierung: `4e2efb5df63ee4d5db1c1e2f844476f1eac5e774`, 09.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Gartentisch: Palette `huetchen` auf Basis von `holz`, Siegerbühne mit Laub-Konfetti in den vier Spielerfarben. |
| Figuren & Material | Die Pöppel haben bereits Lack und Glanzpunkt, der Würfel runde Augen; beides bleibt. Neu ist die Plakette „Glückspilz“ aus der Material-Bibliothek (EXP-F3). |
| Klang | Würfel (`dice`), Tock je Feld (`piece`), Rauswurf als „Plopp“ mit kurzem Grummeln (`plop`, `grumble`, beide erzeugt), Glöckchen bei einer Sechs (`six`) und im Ziel (`home`). |
| Animation | Figuren hüpfen Feld für Feld (150 ms je Feld). Geschlagene Figuren fliegen im Bogen zurück ins Haus, sobald die schlagende Figur gelandet ist. Der Würfel kippt in seine bestätigte Augenzahl. |
| Highlight | Drei Sechsen in Folge: Konfetti am Haus dieses Spielers und die Plakette „Glückspilz“. |

Die bisherige Zug-Animation bewegte Geisterfiguren über `left`/`top`. Sie ist durch `transform`-Bewegungen ersetzt; `huetchen.js` gibt dafür nur die Feldkoordinaten frei und überlässt die Bewegung dem Erlebnis-Modul. Spiellogik unverändert.

## Abweichungen

- Sechser-Brett (6 Farben): Klang und Würfel wie beschrieben, die Figuren setzen ohne Hüpfweg auf. Das Brett hat dort eine eigene Geometrie; der Weg folgt in einem späteren Schritt.
- Die Sechsen-Serie zählt die Darstellung aus den bestätigten Würfel-Aktionen mit. Nach einem Neuladen beginnt die Zählung neu.

## Prüfungen

- `test/ui/exp-huetchen.spec.js`: **6 bestanden** (Desktop und Mobilansicht): echte Würfe und Züge mit `expectSound`, nur `transform`/`opacity`, Bogen startet nach der Landung, Highlight, „Animationen reduzieren“ (≤ 150 ms, kein Konfetti), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- Rauswurf und Sechsen-Serie hängen vom Würfelglück ab. Der Test zeigt sie deshalb über den Darstellungs-Hook auf dem echten Tisch; die Erkennung selbst prüft `test/experience-huetchen.test.js`.
- `npm run test:fast`: **1928 bestanden, 3 übersprungen**, kein Fehler. `test/ui/visual-p1.spec.js` (huetchen), `test/ui/smoke.spec.js`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 176 | 3316.4 ms | 52.77 | ≥ 45 |
| Mobilansicht | 195 | 3266.4 ms | 59.39 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Glückspilz: [Desktop](glueckspilz-desktop.png), [Mobilansicht](glueckspilz-mobil.png)
