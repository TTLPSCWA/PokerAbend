# EXP-081 · Doppelagent

Implementierung: `ba81929cc69ea599c08c34651f9368d3834d4d0c`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Geheimdienst-Lounge: Die Orte sind Postkarten mit Briefmarke. |
| Figuren & Material | Die eigene Ortsakte ist ein Umschlag mit Wachssiegel. Der enttarnte Agent trägt eine eigene Sonnenbrille. |
| Klang | Palette `doppelagent`: Schreibmaschine bei jeder Frage und Antwort, Akte öffnen, Klopfen bei der Anklage, Tock je Stimme, Spionage-Akkord bei der Enthüllung (erzeugt). |
| Animation | Anklage: Umschlag und Postkarten drehen sich um, die Abstimmung legt sich obenauf. Enthüllung: Der Agent erscheint und schiebt die Sonnenbrille hoch. |
| Highlight | Der Agent errät den Ort: Die Postkarte des Ortes fliegt ins Bild, Stempel „Mission erfüllt“. |

Spiellogik unverändert.

## Geheimnisse

Alles hängt an öffentlichen Ereignissen (Protokoll, Anklage, Stimmenzahl, Auflösung). Wer der Agent ist, zeigt die Darstellung erst mit der Auflösung des Servers. Zuschauer sehen weder Umschlag noch Agent vor der Auflösung.

## Abweichungen

- „Alle Akten drehen sich um“ betrifft den eigenen Umschlag und die Postkarten; fremde Akten liegen dieser Ansicht nie vor.
- Die Sonnenbrille ist ein eigenes kleines SVG statt des Avatar-Accessoires, damit sie ohne Nachladen sofort im Endzustand steht.

## Prüfungen

- `test/ui/exp-doppelagent.spec.js`: **6 bestanden** (Desktop und Mobilansicht), alles mit echten Spielzügen dreier Menschen: Frage und Antwort, Anklage, einstimmige Abstimmung, Enthüllung, richtig geratener Ort. Dazu nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-doppelagent.test.js`: 3 Tests zur Erkennung der Ereignisse.
- `npm run test:fast`: bestanden, kein Fehler.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 234 | 4183.0 ms | 55.70 | ≥ 45 |
| Mobilansicht | 245 | 4216.4 ms | 57.87 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Enthüllung: [Desktop](enthuellung-desktop.png), [Mobilansicht](enthuellung-mobil.png)
- Mission erfüllt: [Desktop](mission-desktop.png), [Mobilansicht](mission-mobil.png)
