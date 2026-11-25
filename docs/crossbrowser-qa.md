# Firefox und WebKit in der CI (QA-CROSSBROWSER-01)

Stand 25.11.2026. Die volle Browsermatrix läuft weiter nur in Chromium: `playwright.config.js` mit Desktop und Mobil, nachts in 12 Teilen. Firefox und WebKit prüfen nachts gezielt repräsentative Fälle, statt die gesamte Matrix zu verdreifachen. Konfiguration: [playwright.crossbrowser.config.js](../playwright.crossbrowser.config.js). Workflow-Job: `nightly-crossbrowser` in `.github/workflows/docker.yml`, eine Matrix mit `firefox` und `webkit`. Er läuft zusammen mit dem Volllauf nachts, per Hand oder bei `[pokerabend:full-ci]`; der Push-Schnelltest bleibt unverändert.

## Was läuft wo

| Bereich | Quelle | Firefox | WebKit |
| --- | --- | --- | --- |
| Responsive-Regressionen | B24, `responsive.spec.js` | Desktop 1440×900 | Desktop 1440×900 und iPhone-Emulation mit Touch |
| Tastatur, Touchziele, Safe Areas, Bildschirmtastatur | B24, `b24-a11y.spec.js` | Desktop | Desktop und iPhone mit Touch |
| Zoom und vergrößerte Schrift | `b24-a11y.spec.js` mit echter Firefox-Schriftgröße 24 px; `card-ux-audit.spec.js` mit 720×450 (entspricht 200 % auf 1440×900) | ja | ja |
| Kartenbedienung (Auswahl, Ziele, Doppelklick, Überlauf, 44-px-Karten, sichtbare Auswahl) | CARD-UX-01, `card-ux-audit.spec.js` | Desktop und schmal 390×844 | Desktop und iPhone |
| Kartenaktionen (Tastatur, Touch, Ziehen, fehlende Bestätigung, Reconnect, Zuschauer) | `card-ux-actions.spec.js` | Desktop | iPhone mit Touch |
| Zweites Fenster desselben Kontos | CARD-ACTION-01, `card-action.spec.js` | Desktop | iPhone mit Touch |
| Startseite, Navigation und Dialoge | B24, „Hub, Navigation und Dialoge“ aus `b24-responsive-audit.spec.js` | Desktop | Desktop |
| UNO Flip: Materialatlas mit Kontrastprüfung ≥ 4,5:1 | `uno-ultimate.spec.js` (nur Flip) | – | iPhone mit Touch |

## UNO-Ultimate-Flip-Kontrast in WebKit

**Befund:** Der Test scheiterte in WebKit mit „0 Elemente“ (`.fc-material-atlas .fc-w .v`) oder mit `getComputedStyle` auf einem bereits entfernten Element. Unter Last reproduziert: 2 von 6 Läufen mit 4 parallelen Workern. Einzeln bestand er meist.

**Ursache:** Es war kein Kontrastfehler der Karten, sondern ein Rennen im Test.

- Der Test springt von 900×450 auf 1440×1000 und setzt sofort den Materialatlas in `#kg-main` ein.
- Der Wechsel kippt die Media-Query „breit“ (`min-width: 900px` und `min-height: 620px`), auf die der Kit mit einem Neuzeichnen reagiert.
- In WebKit kam dieses Neuzeichnen unter Last erst nach dem Einsetzen und löschte den Atlas vor der Messung.
- Eine Diagnose zeigte in Chromium und Firefox dasselbe Verhalten, nur seltener zum falschen Zeitpunkt.
- Das Kartenrendering ist in WebKit und Chromium identisch.

**Korrektur:** Der Test wartet nach dem Größenwechsel zwei Frames, bis der Layoutwechsel verarbeitet ist, und prüft, dass der Atlas vorhanden ist. Die Kontrastschwelle 4,5:1 und die gemessenen Elemente sind unverändert. Nachweis: 8 von 8 Läufen unter derselben Last.

## Ergebnisse lokal

Die gesamte Auswahl umfasst 167 Fälle (163 beim ersten Lauf, vor dem Fall aus CARD-ACTION-01), viele überspringen sich bewusst je Gerät.

- **Erster Lauf:**
  - 106 bestanden, 51 bewusst übersprungen, 4 wackelig (im Wiederholungsversuch grün), 2 fehlgeschlagen.
  - Beide Fehlschläge entstanden, weil ich gleichzeitig einen zweiten Playwright-Lauf gestartet hatte, der `test-results/` leerte (ENOENT beim Speichern der Traces).
- **Wiederholung ohne Parallelbetrieb:** WebKit, WebKit-Touch und Firefox mit großer Schrift ergaben 58 bestanden, 37 bewusst übersprungen, 0 fehlgeschlagen, 0 wackelig.
- **Zweites Fenster:** Der Fall aus CARD-ACTION-01 (`card-action.spec.js`) kam danach zur Auswahl hinzu. Er ist lokal in Chromium Desktop und Mobil grün; Firefox und WebKit weist der erste nächtliche Lauf nach.

## Verbleibende Abdeckungslücken

- Die Spiel- und Solo-Matrix aus B24 („Lobby und laufende Partie in allen Viewports“, „Solo in allen Viewports“, Performance beim Größenwechsel) läuft nur in Chromium.
- Die übrigen Browserspezifikationen laufen nur in Chromium, darunter Spiele, Erlebnis- und Grafikpakete sowie Brettspiele.
- UNO Ultimate läuft in WebKit nur in der Variante Flip. Die anderen vier Varianten laufen in Chromium.
- In Firefox überspringen sich die Mobilfälle, weil Firefox kein browserseitiges `isMobile` kennt. Touch wird in WebKit geprüft.
- Kein echtes iOS-Safari und kein Android-Chrome, sondern Emulation. Echter Browser-Zoom und Screenreader bleiben manuell zu prüfen.
- Der Push-Schnelltest bleibt bei der Chromium-Rauchprobe. Firefox und WebKit melden sich erst im nächtlichen oder ausgelösten Volllauf.

## CI-Nachweis für `7e73e66` (QA-CARD-FLOW-01)

- **Kein eigener Lauf:** Für den Push von `7e73e66` hat GitHub keinen eigenen Workflow-Lauf angelegt.
- **Schnelltests:** Lauf #272 auf dem Folgecommit `1fa16e5` bestand mit `npm run test:fast`. Er enthält `test/card-flow.test.js` unverändert.
- **Volllauf:** Lauf #273 auf `a8d49f0` (`[pokerabend:full-ci]`) enthält `7e73e66` unverändert.
  - Alle vier Node-Teile sind grün, einschließlich `test/card-flow.test.js`.
  - Die Browser-Teile 5 und 8 waren rot. Sie enthalten keine Tests aus `7e73e66`; Codex untersucht die Wackler unter QA-FLAKE-02.
  - Die folgenden Volläufe ab `cf43be3` decken die Tests erneut ab.
