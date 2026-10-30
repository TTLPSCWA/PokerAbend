# Gemeinsame Spielpause

Der Host kann die gesamte laufende Partie in allen 46 Spielen einschließlich ihrer Varianten sofort pausieren und fortsetzen. Die Schaltfläche steht oben am Tisch und im Host-Menü. Poker/Omaha verwenden für das bisherige „Alle anhalten“ dieselbe Pause; die zusätzliche Option „Pause nach dieser Hand“ behält ihre eigene Bedeutung.

Alle Teilnehmer einschließlich Zuschauern sehen den Pausenhinweis. Die Spielbereiche sind währenddessen nicht bedienbar. Züge, automatische Entscheidungen, Bots, Party-Stufen, Zünder, Echtzeit-Simulationsschritte und die Spielzeit lokaler Minispiele warten. Beim Fortsetzen bleiben die Restzeiten erhalten. Auch die Gesamtzeitlimits von Monopoly und Wer bin ich?, Poker-Blindzeiten und offene Geschenkfristen verwenden die pausierbare Uhr.

## Rechte und Lebenszyklus

- `gamePause` mit `{ paused: true | false }` verlangt die aktuelle Host-ID und einen echten booleschen Wert. Wiederholungen desselben Werts sind wirkungslos. Vor Spielstart ist keine Pause möglich.
- Der Server lehnt Spielaktionen während der Pause ab, auch wenn sie direkt über Socket.IO gesendet werden. Das betrifft ebenso Programmwechsel, Einstellungen und das Hinzufügen/Entfernen von Bots. Der alte Poker-Event `freeze` bleibt kompatibel.
- Wiederverbinden, Zuschauen, Verlauf und Reaktionen funktionieren weiter. Der Pausezustand wird mit jedem persönlichen Zustandsupdate übertragen. Ein Hostwechsel erlaubt dem neuen Host das Fortsetzen; der vorherige Host verliert diese Berechtigung.
- Zur Startseite gehen und den Tisch ausdrücklich verlassen bleibt möglich. Ein bewusstes Verlassen kann wie bisher zum Ausscheiden oder Rundenende führen. Der Host kann die Runde gezielt abbrechen oder den Tisch schließen; beim Abbrechen wird die Pause aufgehoben.
- Automatisches Entfernen wegen Abwesenheit wartet während der Pause. Die bestehende Hostübergabe bei Verbindungsverlust und das Aufräumen vollständig verlassener Räume bleiben aktiv.
- Die Pause besteht im laufenden Serverprozess. Es wurden keine neuen laufenden Spielstände für Server-Neustarts eingeführt; bestehende Speicher- und Wiederherstellungsregeln gelten weiter. Keine Änderung an Datenvolumes oder `.env`, kein Produktivdeployment.

## Architektur

`server/room-clock.js` kapselt die Uhr jedes Raums sowie pausierbare Timeouts und Intervalle. Die logische Zeit hält während einer Pause an. Dadurch behalten Anfangszeiten und Fristen ihre Werte, und zeitbasierte Wertungen rechnen die Pause nicht als Spielzeit an. Alle Spieltimer nutzen diese Uhr. Sicherheitsfristen, Offline-Zeiten, Persistenz und Netzwerktimer verwenden weiterhin die reale Kalenderzeit.

Neue Spieltimer mit `room.clock.setTimeout` / `setInterval` erstellen und mit den entsprechenden Clock-Methoden entfernen. Für Spielzeit `room.clock.now()` verwenden. `dispose()` räumt auch pausierte Timer auf. Die gemeinsamen Räume veröffentlichen `gamePaused` und die logische Serverzeit `now`; die Clients verwenden `gameNow(state)` für Anzeigen und lokale Minispiele. Die bestehenden Testhelfer zum Stoppen von Spieltimern wurden auf dieselbe Clock-API umgestellt.

Der gemeinsame Browserrahmen zeigt den Hinweis, sperrt die Spielbereiche über `inert` und lässt Navigation und Hoststeuerung erreichbar. Auf schmalen Bildschirmen bekommt die Kopfzeile zwei Zeilen; auch der Poker-Pauseknopf bleibt sichtbar. Lokale Solo-Schleifen und Eingaben warten, Echtzeiteingaben werden ausgesetzt, noch nicht geteilte Zeichenentwürfe nach dem Fortsetzen erneut übertragen.

## Prüfungen

Die neuen Unit-Tests prüfen alle 46 Spiele und 17 zusätzliche Varianten, unveränderte Zustände während einer langen Pause, Rechte, idempotente Aufrufe, Restzeiten, Intervalle, Botzüge, Gesamtzeitlimits und die Solo-Wertung. Socket-Tests ergänzen echte Clientverbindungen, Zuschauer, Wiederverbinden, Hostwechsel, unerlaubte Rohereignisse und Rundenabbruch.

Browserprüfungen auf Desktop und Mobilgerät decken gemeinsame Pause, Poker, lokale Pfeilfieber-Zeit, Echtzeitframes, Zeichenentwürfe und die Bedienbarkeit nach Fortsetzen ab. Screenshots entstehen in `test-results/` (nicht versioniert). Die abschließenden Laufzahlen und CI-Ergebnisse werden im Abschlussbericht genannt. Kein V2-Paket wurde begonnen.

Abnahme am 30. Oktober 2026:

- `npm.cmd test`: **810/810 bestanden**, keine übersprungenen Tests, Exitcode 0, 64,5 Sekunden. Log: `artifacts/pause-final-all-tests.log`.
- Davon **72 neue Pause-Prüfungen**, darunter alle Spiele/Varianten und vier Socket-Integrationstests. Der gezielte Abschlusslauf ist ebenfalls grün (`artifacts/pause-final-unit.log`).
- `node node_modules/@playwright/test/cli.js test test/ui/game-pause.spec.js test/ui/drawing.spec.js test/ui/game-design.spec.js`: **36/36 bestanden**, Desktop und Mobilgerät, Exitcode 0, 2,1 Minuten. Einschließlich des Ladens aller 46 Spieloberflächen und der Brett-/Kartenlayouts in beiden Ausrichtungen. Log: `artifacts/pause-final-ui.log`.
- Zusätzlicher vorheriger Durchlauf für Pause, Zeichenspiele und Echtzeitspiele einschließlich Abendprogramm: **22/22 bestanden** (`artifacts/pause-ui-regression.log`). Der erste Browserlauf hatte den bisher per CSS versteckten Poker-Pauseknopf am Handy aufgedeckt; dieser wurde sichtbar gemacht und anschließend erfolgreich erneut geprüft. Die Sichtkontrolle führte außerdem zur Kopfzeile mit zwei Zeilen auf schmalen Bildschirmen.
- `git diff --check`: ohne Fehler. Die bestehenden Agent-Regeln, V2-Planungen, Abhängigkeiten und Docker-/Workflow-Dateien wurden nicht verändert.

Visuell geprüfte Screenshots des abschließenden Browserlaufs:

- Desktop: `test-results/game-pause-Pfeilfieber-lok-bbf9d--laufen-anschließend-weiter-desktop/pfeilfieber-pause.png`.
- Mobil: `test-results/game-pause-Gemeinsame-Paus-41274-r-Host-Rechte-und-Reconnect-mobil/gemeinsame-pause.png`.

Der bestehende Main-Workflow führt nach dem Push erneut die Node-Tests und den GHCR-Image-Build aus; er enthält keinen Produktivdeployment-Schritt. Das konkrete CI-Ergebnis wird im Abschlussbericht verlinkt.
