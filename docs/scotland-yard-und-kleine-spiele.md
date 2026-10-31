# Scotland Yard, Hex und Würfelduell

Stand: 31.10.2026. Beauftragt wurden zuerst Scotland Yard und anschließend neue kleinere Spiele aus der bestehenden Roadmap. Gewählt wurden Hex und Würfelduell. Der Katalog enthält jetzt 49 Spiele. Die drei Einträge wurden aus `games/planned.js` entfernt und als abgeschlossene Etappe in `games/roadmap.js` aufgenommen. Die historische V2-Konsolidierungsbasis mit 46 Spielen und alle 18 geplanten V2-Pakete bleiben unverändert.

## Scotland Yard

Ein Mr. X gegen zwei bis fünf Detektive. Die Fahndungsmechanik orientiert sich am vorhandenen Backlog und an [Ravensburger Scotland Yard](https://www.ravensburger.co.uk/en-GB/pdp/27514). Stadtplan, Darstellung und die folgende konkrete Ausgestaltung sind eigene Implementierungen. Es wurden keine Originalgrafiken oder Original-Stationsdaten übernommen.

- Eigener zusammenhängender Stadtplan mit 49 nummerierten Haltestellen, Taxi-, Bus-, U-Bahn- und Fährverbindungen. Auf kleinen Displays wird innerhalb des Plans gescrollt. Alternativ lassen sich alle erreichbaren Ziele über Knöpfe auswählen.
- Der Host weist Mr. X vor der Partie zu oder lässt die Rolle mit dem Startspieler wechseln. Rollenwahl während einer Partie und Rollenwahl durch Gäste werden abgewiesen.
- Mr. X beginnt; dann zieht jeder Detektiv einmal. Besetzte Detektiv-Stationen sind für alle anderen gesperrt. Ein Detektiv darf auf Mr. Xs Station ziehen und gewinnt damit für das Team.
- Detektive starten mit 10 Taxi-, 8 Bus- und 4 U-Bahn-Tickets. Verbrauchte Tickets gehen an Mr. X. Dieser beginnt mit 4 Taxi, 3 Bus, 3 U-Bahn, 5 Black- und 2 Doppel-Tickets. Sein Vorrat ist privat.
- Black ersetzt ein Fahrticket, verschweigt das Verkehrsmittel und erlaubt Fähren. Doppelzüge benötigen zwei legale Teilzüge; beide zählen zur Zugzahl. Die erste Etappe eines unmöglichen Doppelzugs wird ohne Verbrauch oder Bewegung abgewiesen.
- Standard: 24 Mr.-X-Züge; Sichtungen nach 3, 8, 13, 18, 24 sowie immer beim letzten Zug. Der Host kann 12–24 Züge sowie Sichtungen alle 3 oder 6 Züge einstellen. Eine Sichtung zwischen zwei Doppelzug-Etappen bleibt im Verlauf erhalten.
- Nach dem letzten Mr.-X-Zug erhalten die Detektive noch ihre Antwortzüge. Erst danach ist Mr. X entkommen. Eingeschlossen kann Mr. X verlieren; vollständig bewegungsunfähige Detektive verlieren. Einzelne blockierte Detektive werden übersprungen.
- Bei Aufgabe von Mr. X gewinnt das Detektivteam; ohne Detektive gewinnt Mr. X. Gewinner erhalten je einen Sieg und einen Wertungspunkt.

### Geheimhaltung

Nur Mr. X erhält seine aktuelle geheime Station und seinen Ticketvorrat. Detektive und Zuschauer erhalten die Station nur beim Auftauchen oder nach dem Spielende. Öffentlich sind die Detektiv-Positionen und -Tickets, benutzte Mr.-X-Tickets, erlaubte Sichtungen und daraus abgeleitete mögliche Stationen. Diese Kandidaten sind eine zulässige Übermenge, keine Auswertung der tatsächlichen versteckten Position.

Verlauf, Sprechblasen und Zugdetails nennen bei verdeckten Fahrten kein Ziel. Die Tests vergleichen sogar die kompletten öffentlichen Zustände zweier unterschiedlicher verdeckter Ziele: Sie müssen identisch bleiben. Detektiv-Bots und automatische Zeitablaufzüge entscheiden ausschließlich aus der persönlichen Ansicht; sie greifen nicht auf die interne Mr.-X-Position zu.

## Hex

- 11×11 Felder als Standard, 9×9 optional. Blau verbindet oben mit unten, Rot links mit rechts. Sechs echte Hex-Nachbarn; keine Bewegung, kein Schlagen und kein Remis.
- Optionale Tauschregel: Nach dem ersten Stein kann Spieler zwei die Seiten übernehmen. Der Stein bleibt stehen, die Spieler tauschen Farben und Ziele; Spieler eins ist wieder dran. Danach ist kein erneuter Tausch erlaubt.
- Der Server prüft die komplette Verbindung und übermittelt den Gewinnpfad. Pfeile unterstützen die Farbzuordnung. Die Ansicht behält ihren verschobenen Ausschnitt auch nach Zügen und Sprachwechseln.
- Bots erkennen unmittelbare Siege und Blockaden und bewerten ansonsten Verbindungswege. Bei einem starken zentralen Eröffnungsstein können sie die Tauschregel nutzen.

## Würfelduell

Eigene Umsetzung der knappen Backlog-Regeln, kein behauptetes Regelwerk eines anderen Produkts:

- 2–4 Spieler, standardmäßig 10 Lebenspunkte und drei Würfel pro Angriff und Verteidigung; einstellbar 5–20 Leben und 2–5 Würfel.
- Wer dran ist, wählt einen lebenden Gegner. Der Server würfelt beide Seiten mit dem bestehenden kryptografischen Würfelbaustein. Angriff trifft auf 4–6, Verteidigung blockt auf 5–6.
- Schaden ist die Anzahl ungeblockter Treffer, mindestens null, plus der offen angezeigte Druckbonus. Dieser steigt nach je zehn Angriffen um eins, damit vollständig geblockte Würfe kein endloses Spiel erzeugen.
- Lebenspunkte fallen nicht unter null. Ausgeschiedene Spieler werden übersprungen; der letzte Überlebende gewinnt. Bots greifen anhand der öffentlichen Lebenspunkte an.

## Gemeinsame Einbindung

Normale Raum-, Socket-, Rollen-, Ergebnis-, Abendprogramm-, Bestenlisten-, Bot-, Timer-, Pause- und Reconnect-Bausteine. Keine separate Demo, kein neuer Build-Schritt und keine Produktionsdatenmigration. Alle drei Spiele haben eigene Katalogmotive, responsive Oberflächen und deutsche/englische Bedienung einschließlich ihrer Spielregeln.

Eine Browser-Wiederverbindung erhält die laufende Partie im bestehenden Raum. Für einen Server-Neustart gilt wie bei den anderen `TurnRoom`-Spielen: gespeichert werden Einstellungen, Teilnehmer und Abendstand zwischen den Runden; eine laufende Partie wird nicht als neuer dauerhafter Spielstand persistiert.

## Prüfung

- Engine-Tests für Geheimhaltung, illegale Aktionen ohne Mutation, Black/Fähre, Doppelzüge, Auftauchen, Fang- und Endregeln, Aufgabe, Rollenwahl und Wiederherstellung.
- Hex-Verbindungen in beiden Richtungen, Seitentausch, Gewinnpfad sowie alle vollständigen 2×2- und 3×3-Bretter ohne Remis.
- Würfelduell-Treffer, Schilde, Druckbonus, Lebenspunkte und Ausscheiden; ferner 92 vollständige Botpartien über die Spielerzahlen und beide Hex-Größen.
- Neue Browserprüfungen: echte Spielaktionen, zwei persönliche Scotland-Yard-Ansichten, Hostrechte, Pause, Wiederverbindung, Sprache, Tastatur und mehrere Größen einschließlich Handy/Querformat.
- Bestehende Katalog-, Backlog-, Erfolgs-, Abendprogramm- und historische Roadmap-Prüfungen wurden um den neuen Stand ergänzt. Die frühere Konsolidierung wird als historische Basis geprüft; neue Etappen dürfen hinzukommen, ohne alte Etappen zu entfernen oder umzuschreiben.
- Screenshots entstehen unter `artifacts/new-games/`; insbesondere `scotland-yard-desktop-1440x900.png`, `scotland-yard-mobil-390x844.png`, `hex-mobil-390x844.png` und `wuerfelduell-mobil-390x844.png`. Artefakte bleiben wie bisher unversioniert.

## Abschließende Ergebnisse

- `npm test`: **851 bestanden, 0 fehlgeschlagen** (78,1 Sekunden). Protokoll: `artifacts/new-games-node-final.log`.
- Die 20 gezielten Engine-Prüfungen einschließlich der zusätzlichen Pause zwischen Doppelzug-Etappen sind ebenfalls grün; sie enthalten die 92 vollständigen Botpartien. Protokoll: `artifacts/new-games-engine-final.log`.
- `node node_modules/@playwright/test/cli.js test --workers=2 --output=artifacts/new-games-full-results`: **309 bestanden, 1 bestehender planmäßiger Skip, 0 fehlgeschlagen** (15,0 Minuten). Enthält den deutschen und englischen Start-/Paneldurchlauf durch alle 49 Spiele auf Desktop und Handy sowie die sechs neuen Spiele-Browserprüfungen. Protokoll: `artifacts/new-games-full-ui.log`.
- Screenshots auf Desktop, Tablet, schmalem Handy und im Querformat visuell kontrolliert. Dabei die zu breite Hex-Ansicht korrigiert, echte sechseckige Nachbarschaft sichtbar gemacht und die Karten-/Brettverschiebung bei Aktualisierungen erhalten.
- Ursprüngliche Testfehler: starre Listen mit 46 Spielen, historische Planung mit dem aktuellen Katalog gleichgesetzt und ein mehrdeutiger Wiederaufnehmen-Selektor. Die Erwartungen sind jetzt auf die drei tatsächlichen Ergänzungen und die unveränderte historische Basis abgestimmt. Es wurden keine Tests ausgeschaltet.
- Syntaxprüfung und `git diff --check`: bestanden. Keine neuen Abhängigkeiten und keine `.env`-, Passwort-, Cookie-, Token-, Spielstands- oder V2-Paketmigration.

Nicht enthalten sind ein Original-Stadtplan, mehrere gleichzeitige Mr. X oder eine Wiederherstellung laufender Partien über einen Server-Neustart. Die beauftragten drei Basisspiele sind umgesetzt. Kein manuelles Produktivdeployment.
