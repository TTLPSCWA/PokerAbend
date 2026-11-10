# EXP-038 · Kritzelpost

Implementierung: `69193fce1614ff09ebf9dc59e95aec6089358a2a`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Postamt: Jeder Schritt kommt als Umschlag aus dem Nachbarfach an. |
| Figuren & Material | Poststempel mit der Schrittnummer auf dem Umschlag, eigene Eulen-Briefmarke an jedem Beitrag der Auflösung. |
| Klang | Palette `kritzelpost`: Stempel-Klatsch, sobald jemand abgibt, Umschlag-Rascheln je Schritt, Postsirene bei der Auflösung (erzeugt), Papier je aufgedeckter Seite. |
| Animation | Bei der Auflösung spulen die Ketten Seite für Seite ab, wie beim Postboten. |
| Highlight | Erreicht eine Kette wieder ihren Anfangsbegriff, bekommt sie den Stempel „Zugestellt!“ mit Konfetti; der Stempel bleibt an der Kette stehen. |

Spiellogik und Zeichenwerkzeug unverändert.

## Geheimnisse

Fremde Beiträge erscheinen erst mit der Auflösung des Servers. Vorher reagiert die Darstellung nur darauf, wer abgegeben hat.

## Abweichungen

- Der Poststempel zeigt die Schrittnummer statt der Rundennummer: Eine Partie hat meist nur eine Runde, die Schritte wechseln ständig.
- Die Seiten erscheinen nacheinander von selbst (alle Ketten bleiben aufgeklappt), statt dass der Umschlag einzeln geöffnet werden muss. So kann jeder im eigenen Tempo zurückscrollen.
- „Zugestellt“ vergleicht die letzte Beschreibung mit dem Anfangsbegriff ohne Groß-/Kleinschreibung und Satzzeichen.

## Prüfungen

- `test/ui/exp-kritzelpost.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit drei Menschen und einer echten, vollständigen Kette: Stempel, Umschlag, Sirene, gestaffelte Seiten, „Zugestellt!“ mit Konfetti, nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, fremde Beiträge vor der Auflösung nicht im Zustand, `expectNoLeak`.
- `test/experience-kritzelpost.test.js`: 2 Tests.
- `npm run test:fast`: bestanden, kein Fehler.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 512 | 8666.2 ms | 58.96 | ≥ 45 |
| Mobilansicht | 509 | 8632.9 ms | 58.84 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Zugestellt: [Desktop](zugestellt-desktop.png), [Mobilansicht](zugestellt-mobil.png)
