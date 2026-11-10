# EXP-001 · Scotland Yard

Implementierung: `b50d72a77e9b23c0dd2ae907e16fe9d1006d4935`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Die Stadt Aure bleibt. Neu: Die Tageszeit wechselt alle sechs Züge von Mr. X (Tag → Dämmerung → Nacht → Morgen) als getönte Ebene unter Linien und Haltestellen; Nummern und Farben bleiben lesbar. |
| Figuren & Material | Detektive tragen einen Hut mit Band in ihrer Ermittlerfarbe, Mr. X einen tief gezogenen Schattenhut mit Mantelkragen (reines CSS, keine Bilder). |
| Klang | Palette `scotland-yard`: Taxi-Hupe, Bus-Bremse, U-Bahn-Rauschen und Fährhorn (erzeugt), Papier beim Black-Ticket, Spannungston beim Auftauchen, Handschellen und Stempel bei der Festnahme. |
| Animation | Figuren fahren die gezeichnete Linie ihres Tickets entlang (gleiche Kurve wie im Stadtplan). Taucht Mr. X auf, erscheint seine Figur aus einer Nebelschwade (Verlauf, kein Weichzeichner). |
| Highlight | Festnahme: Alle Detektive springen auf das Feld von Mr. X, Handschellen klicken, der Stempel „GEFASST“ erscheint; das Ergebnisfenster wartet so lange. Das Feld bleibt auch nach Neuladen markiert. |

Spiellogik unverändert.

## Geheimnisse

- Mr. X fährt für Detektive und Zuschauer unsichtbar: Es bewegt sich nichts, zu hören ist nur das ohnehin öffentliche Ticket.
- Das Fährhorn würde bei einem Black-Ticket die Fähre verraten. Es erklingt deshalb nur in einer Ansicht, die die Fahrt ohnehin kennt (Mr. X selbst), und nur, wenn zwischen beiden Haltestellen ausschließlich die Fähre fährt. Alle anderen hören Papier.

## Abweichungen

- Die Hüte sind CSS-Formen an den vorhandenen Spielsteinen statt eigener SVG-Figuren. So bleiben Nummer und Ermittlerfarbe lesbar, und es gibt keine neuen Dateien zu laden.
- Der Stempel ist ein eigener Schriftzug; der Material-Stempel aus EXP-F3 trägt fest „GEPRÜFT“.
- Bei der Festnahme springen die Detektive zum Feld und kehren danach auf ihre bestätigten Haltestellen zurück, weil die Darstellung den Serverzustand nicht verändern darf.

## Prüfungen

- `test/ui/exp-scotland-yard.spec.js`: **6 bestanden** (Desktop und Mobilansicht): echte Züge mit `expectSound`, verdeckte Fahrt ohne Bewegung, nur `transform`/`opacity`, Highlight, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- Auftauchen und Festnahme hängen vom Spielverlauf ab. Der Test zeigt sie über den Darstellungs-Hook auf dem echten Tisch; die Erkennung prüft `test/experience-scotland-yard.test.js` (6 Tests).
- `npm run test:fast`: **1935 bestanden**, kein Fehler. `test/ui/scotland-visual.spec.js`: 12 bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 190 | 3283.1 ms | 57.57 | ≥ 45 |
| Mobilansicht | 193 | 3266.4 ms | 58.78 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Auftauchen: [Desktop](auftauchen-desktop.png), [Mobilansicht](auftauchen-mobil.png)
- Festnahme: [Desktop](festnahme-desktop.png), [Mobilansicht](festnahme-mobil.png)
