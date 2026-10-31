# Fehlerprüfung vom 31. Oktober 2026

Geprüft wurden die neuen Spiele Scotland Yard, Hex und Würfelduell sowie ihre gemeinsamen Raum-, Browser-, Sprach-, Bot-, Pause- und Reconnect-Bausteine. Die bestehenden Tests beziehen außerdem die früheren Spiele und Varianten ein. Ausgangspunkt: `1ac5950` auf `main`.

## Behobene Fehler

- **Zahlenentwürfe beim Sprachwechsel:** Eine noch nicht abgegebene deutsche Schätzung `1.234` wurde nach dem Wechsel zu Englisch als `1.234` statt `1234` eingereicht. Gültige Dezimalentwürfe werden nun anhand der bisherigen Sprache in die neue Schreibweise übertragen. Beispiel zurück: Englisch `1,234.5` wird Deutsch `1234,5`. Unvollständige und ungültige Eingaben bleiben bearbeitbar. Namen und andere Texte werden unverändert übernommen. Kleine Zahlen werden ohne die vom Eingabeparser abgewiesene Exponentialschreibweise formatiert. Der bestehende serverseitige Zahlenbereich und die Rundung bleiben erhalten.
- **Beschädigte lokale Einstellungen:** Gültiges JSON mit falschem Datentyp, etwa `null` für Einstellungen, `{}` für Favoriten oder ein String für zuletzt gespielte Spiele, konnte den Start bzw. die Tischnutzung mit einem JavaScript-Fehler blockieren. Der Speicherleser prüft nun bei Objekt-/Array-Standardwerten die passende Struktur und fällt bei falscher Struktur auf den Standard zurück. Gültige Einstellungen und skalare Werte wie Sitzungstoken werden weiter gelesen.
- **Scotland-Yard-Rollen:** Zuschauer und erst für die nächste Runde sitzende Spieler wurden als Detektive gekennzeichnet. Nur Teilnehmer der aktuellen Partie erhalten jetzt eine Rolle; nach Abbruch/neuem Spiel erscheinen keine alten Rollen. Geheime Position und Ticketvorrat von Mr. X bleiben weiterhin geschützt.
- **Scotland-Yard-Distanzcache:** Der erste Aufruf gab die interne Cache-Map direkt zurück, spätere Aufrufe dagegen Kopien. Eine Änderung des ersten Ergebnisses konnte dadurch spätere Bot-Distanzen verfälschen. Jetzt liefern alle Aufrufe unabhängige Maps. Die bisherigen Bot-Aufrufer lesen ihre Ergebnisse nur; dies war ein reproduzierbarer Fehler der Hilfsfunktion, kein nachgewiesener Fehler einer laufenden Botpartie.
- **Zugwechsel beim Aussteigen:** Bei rückwärts laufender Spielrichtung bekam nach dem Ausstieg des aktiven Spielers der falsche Nachbar den Zug. Die gemeinsame `TurnRoom`-Klasse berücksichtigt jetzt die Spielrichtung auch beim Entfernen des aktiven Sitzes. Ein wartender Aussteiger verändert den aktiven Spieler weiterhin nicht.
- **Zufälliger Monopoly-Deal-Testfehler:** Der Zahlungstest legte eine feste Karte in die Bank, konnte aber genau dieselbe zufällig ausgeteilte Karte als vermeintlich reine Handkarte prüfen. Der Test verwendet jetzt garantiert eine andere Handkarte. Die Zahlungsregeln wurden nicht geändert.
- **Instabiler Verlaufstest:** Vor dem Neustart wartete der Test nur auf existierende Dateien und weitere 100 Millisekunden. Unter Last konnten die Dateien noch den Stand vor dem Beitritt bzw. Handende enthalten. Er wartet jetzt auf den tatsächlich gespeicherten Teilnehmer, die abgeschlossene Hand und den Gewinneintrag. Die bestehende verzögerte Speicherung wurde nicht geändert.
- **Navigation in Browserprüfungen:** Der englische Spieldurchlauf prüfte das neue Spielfeld teilweise schon während des Neuladens. Der Echtzeit-Abendprogrammtest konnte nach „Weiter“ noch das alte Ergebnisfenster auswerten. Beide Prüfungen warten jetzt ausdrücklich auf das Laden der nächsten Seite; vorhandene Fehlerprüfungen und Spielregeln bleiben bestehen.

## Regressionstests

- Fehler vor der Korrektur mit Node- und Browserprüfungen nachvollzogen; Protokolle unter `artifacts/bug-review-before-*` und `artifacts/bug-review-turn-before.log`.
- Sprach-Unit-Test vergleicht die konvertierten Zahlen mit dem echten deutschen Serverparser, einschließlich Tausendertrennung, Vorzeichen, kleiner Werte und Dezimalstellen.
- Browserprüfungen auf Desktop und Handy testen beschädigte Browserdaten, Favoriten, Roadmap und Tischbeitritt sowie die tatsächliche Abgabe einer Schätzung nach dem Sprachwechsel. Der vorhandene zweisprachige Mehrspielertest prüft auch den Rückwechsel.
- Engine-Tests prüfen Zuschauer, wartende Spieler, Abbruch und neue Partie sowie die Unabhängigkeit der Distanz-Ergebnisse.
- Zugwechseltests prüfen alle vier aktiven Sitzpositionen in beiden Spielrichtungen und alle 24 Kombinationen eines wartenden Aussteigers.
- Die ersten 32 gezielten Sprach-/Browserprüfungen waren erfolgreich. Später gefundene Fehler der Testabläufe sind oben separat aufgeführt.

## Testergebnisse

- Abschließender Node-Gesamtlauf: **856 bestanden, 0 fehlgeschlagen**, 127,9 Sekunden. Protokoll: `artifacts/bug-review-final-unit.log`.
- Vollständiger Browserlauf: **311 bestanden, 2 fehlgeschlagen, 1 bestehender geplanter Skip**, 18,0 Minuten. Die zwei Fehler betrafen die oben beschriebenen Navigationsprüfungen auf Desktop. Protokoll und Fehleraufzeichnungen: `artifacts/bug-review-all-ui.log` und `artifacts/bug-review-all-ui/`.
- Nachprüfung der korrigierten Sprach-, Entwurfs-, Speicher- und Echtzeit-Browserprüfungen auf Desktop und Handy: **40 bestanden, 0 fehlgeschlagen**, 2,7 Minuten. Beide zuvor fehlgeschlagenen Desktopprüfungen sind darin enthalten. Protokoll: `artifacts/bug-review-final-ui.log`.
- Damit sind alle 313 ausgeführten Browserprüfungen über Gesamtlauf und Nachprüfung erfolgreich bestätigt; der eine bestehende Skip bleibt unverändert. Der ursprüngliche Gesamtlauf hatte zwei Fehler und wird hier ausdrücklich nicht als vollständig grün ausgewiesen.
- `git diff --check`: erfolgreich. Testartefakte bleiben wie bisher unversioniert.

Keine neuen Abhängigkeiten, Spielpakete oder Datenmigrationen. Kein manuelles Produktivdeployment. Der Push auf `main` startet den vorhandenen Test-/GHCR-Workflow.
