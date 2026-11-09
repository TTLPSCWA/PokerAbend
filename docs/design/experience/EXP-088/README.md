# EXP-088 · Schach

Implementierung: `09d2f9ddedab2239a82a3409dd8c0fbe0228c7c6`, 09.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Schachcafé: warme Holzpalette, Standard-Atmosphäre „Kamin“ (im Mixer weiterhin standardmäßig aus). |
| Figuren & Material | Der vorhandene eigene Figurensatz bleibt. Die Uhren sind jetzt Messinguhren mit Drücker; der Drücker der laufenden Uhr ist oben. |
| Klang | Eigene Palette `schach` auf Basis von `holz`: Holzfigur setzen (`piece`), Schlagen als Doppelklack (`capture` + `piece` nach 90 ms), Schach als leiser Glockenton (`check`), Umwandlung (`promote`), Uhr-Ticken einmal pro Sekunde in den letzten 10 Sekunden (`tick`), fallender König (`highlight`). „Du bist dran“ kommt aus der Palette statt als Piepton. |
| Animation | Figuren gleiten vom Start- zum Zielfeld (260 ms). Rochade bewegt König und Turm in einer gemeinsamen Bewegung, auch in Chess960. Neue Partie: Figuren werden reihenweise aufgestellt. |
| Highlight | Schachmatt: Der König kippt um (1,1 s), das Brett dimmt bis auf den König und die mattsetzende Figur, dazu der Highlight-Klang. Das Ergebnisfenster wartet 1,9 s und zeigt dann die Siegerbühne mit Konfetti in Brettfarben. |

Alle Bewegungen laufen über `transform` und `opacity`. Die Darstellung leitet alles aus zwei bestätigten Serverstellungen ab (`moves()` in `public/games/schach/experience.js`); Spiellogik und Serveransichten sind unverändert.

## Gemeinsamer Anschluss für Spielpakete

Dieses Paket bringt den Anschluss mit, den alle weiteren kit-Spiele nutzen:

- `public/games/experience-kit.js`: lädt `/games/<id>/experience.js` für die in `public/games/experience-index.js` eingetragenen Spiele. Ein Modul liefert Palette, Siegerwelt und die Funktionen `still` (statischer Zustand nach jedem Zeichnen), `change` (Töne und Bewegungen bei einem frischen, bestätigten Zustandswechsel), optional `finale` (Highlight am Spielende) und `interval`.
- Neuladen, Wiederverbinden, Pause, verborgener Tab und „Animationen reduzieren“ zeigen sofort den Endzustand: kein Ton, keine Bewegung, kein wartendes Ergebnisfenster. Zuschauer sehen Züge mit Bewegung, aber ohne Siegerfeier (wie in EXP-F4).
- `kit.js`: Der Server schickt das Rundenende zweimal. Bisher brach die Siegerfeier aus EXP-F4 dadurch nach wenigen Millisekunden ab. Die Bühne bleibt jetzt beim erneuten Zeichnen desselben Ergebnisses erhalten.

## Abweichungen

- Kein neuer Figurensatz: Der vorhandene eigene Satz hat bereits klare Silhouetten; ein Tausch hätte alle VIS-Nachweise geändert.
- „Kaffeehausatmosphäre“ nutzt die vorhandene Szene „Kamin“ statt einer neuen Szene.
- Mattbild: Hervorgehoben bleiben König und mattsetzende Figur, nicht alle beteiligten Deckungsfiguren (die Darstellung rechnet keine Schachregeln nach).

## Prüfungen

- `test/ui/exp-schach.spec.js`: **10 bestanden** (5 Fälle, Desktop und Mobilansicht): Palette und Ereignisse per `expectSound`, nur `transform`/`opacity`, Rochade als eine gemeinsame Bewegung, Schachmatt mit wartendem Ergebnisfenster, Siegerfeier nach doppeltem Rundenende, Neuladen und Zuschauen ohne Rückstau, „Animationen reduzieren“ (alle Bewegungen ≤ 150 ms, kein Warten), Pause ohne nachlaufende Bewegung, `expectNoLeak`.
- `node --test test/experience-schach.test.js test/experience-roadmap.test.js`: bestanden (Zugableitung für Rochade, Chess960, en passant, Umwandlung; Palette vollständig).
- `npm run test:fast`: **1924 bestanden, 3 übersprungen**, kein Fehler.
- Bestehende Specs: `games/schach/ui.spec.js`, `test/ui/celebrate.spec.js`, `test/ui/smoke.spec.js`, `test/ui/evening-mode.spec.js`: **30 bestanden**.

## Bewegungsbudget

Gemessen mit `expectSmoothMotion` bei 4× gedrosselter CPU. Die Messung spielt die letzte Bewegung dreimal stumm nach und bewertet damit die Bewegung selbst, nicht Netzwerk und Neuzeichnen des Tisches.

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 70 | 1516,5 ms | 45,50 | ≥ 45 |
| Mobilansicht | 86 | 1649,9 ms | 51,52 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Die Mobilansicht wird vom Helfer ebenfalls 4× gedrosselt; jeder Bewegungsstart kostet dann zwei bis drei Bilder. Deshalb gilt dort 50 statt der ungedrosselten 60-Hz-Vorgabe. Es sind rAF-Messungen auf der Cloud-Testmaschine, keine Messung auf einem echten Telefon.

## Bilder

- Schachmatt: [Desktop](schachmatt-desktop.png), [Mobilansicht](schachmatt-mobil.png)
- Ergebnis mit Siegerbühne: [Desktop](ergebnis-desktop.png), [Mobilansicht](ergebnis-mobil.png)
