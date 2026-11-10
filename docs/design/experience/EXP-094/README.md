# EXP-094 · Reaktor-Notfall

Implementierung: `ed319a141a1b471defe843faa5d48877a83a9480`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Retro-Kontrollraum einer fiktiven Anlage: genietete Paneele, Kühlrohre über dem Pult. |
| Figuren & Material | Temperatursäule mit Skala im Pult; ein Zeigerinstrument je Person bei den eingetragenen Codes (Ruhe, Code steht, Grün bei Erfolg). |
| Klang | Palette `reaktor-notfall`: weicher Doppelton-Alarm ab 60 % der Zeit, in drei Stufen höher, nie schrill; Zischen der Kühlung bei jedem eingetragenen Code; Fehlerton bei falschem gemeinsamem Code; Entwarnung bei Erfolg (erzeugt). |
| Animation | Die Säule steigt mit der Überhitzungsuhr (läuft auch zwischen zwei Zuständen weiter), die Rohre glühen ab etwa 45 % rot, bei einem Fehler zuckt das Pult, bei Erfolg steigt eine Dampfwolke auf und die Zeiger fallen zurück. |
| Highlight | Gerettet bei 99 %: alle Instrumente auf Grün, die Anlage seufzt, Schriftzug „Gerettet – in letzter Sekunde!“. |

Spiellogik unverändert.

## Geheimnisse

Nur Öffentliches löst Ton und Bewegung aus (Uhr, Vorschläge, Fehlversuche, Ergebnis). Die eigenen Hinweise bleiben privat; Zuschauer sehen keine.

## Abweichungen

- Die Temperatur ist die verbrauchte Zeit der Überhitzungsuhr; eine eigene Temperatur gibt es im Spiel nicht.
- Der Alarm schweigt in der Pause, im Hintergrund-Tab und bei der Auflösung.

## Prüfungen

- `test/ui/exp-reaktor-notfall.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Menschen: echte falsche Codes (Zischen, Fehlerton, Strafsekunden), Säule über 60 % mit echtem Alarm, glühende Rohre; Rettung bei 99 % und normale Lösung über den Darstellungs-Hook; nur `transform`/`opacity` für Bewegungen, „Animationen reduzieren“, Pause ohne Alarm, private Hinweise, Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-reaktor-notfall.test.js`: 4 Tests. `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 304 | 5066.4 ms | 59.81 | ≥ 45 |
| Mobilansicht | 304 | 5166.5 ms | 58.65 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Kontrollraum: [Desktop](kontrollraum-desktop.png), [Mobilansicht](kontrollraum-mobil.png)
- Gerettet: [Desktop](gerettet-desktop.png), [Mobilansicht](gerettet-mobil.png)
