# Kartenspiele: Multiplayer- und Zustandsregressionen (QA-CARD-FLOW-01)

Stand 25.11.2026, Version 3.27.3. Gilt für UNO (`farbenchaos`), Skip-Bo (`stapelrennen`), Phase 10 (`zehnetappen`) und Doppelkopf. Die Bedienung im Browser beschreibt [CARD_INTERACTION_UX.md](design/CARD_INTERACTION_UX.md), die Doppelkopf-Wertung [doppelkopf-wertung.md](doppelkopf-wertung.md).

## Grundprinzip

Der Server ist autoritativ. Jede Aktion prüft Zug, Spielstand und Karte (`requireTurn`; Doppelkopf zusätzlich Spielschlüssel und Revision). Der Client ändert nichts vorab: Die Karten-UX-Sperre (`CardInteraction.gate`) lässt nur eine Anfrage gleichzeitig zu. Ohne Bestätigung bleibt sie bis zum bewussten Neuladen gesperrt und wiederholt nichts automatisch. Jeder Empfänger erhält `room.view(id)` mit ausschließlich seiner eigenen Hand.

## Testmatrix

| Fall | UNO | Skip-Bo | Phase 10 | Doppelkopf | Nachweis |
| --- | --- | --- | --- | --- | --- |
| Spielstart, Reihenfolge, Zugwechsel | ✓ | ✓ | ✓ | ✓ | `test/card-flow.test.js`, bestehende Spieltests |
| Aktion außerhalb des eigenen Zugs (Gegner, Zuschauer) wird abgelehnt, Nutzlast aller Empfänger unverändert | ✓ | ✓ | ✓ | ✓ | `card-flow.test.js` |
| Doppelklick bzw. dieselbe Aktion zweimal: zweite abgelehnt, Stand wie nach der ersten | ✓ | ✓ | ✓ (Ziehen) | ✓ (alte Revision) | `card-flow.test.js`; Browser: `card-ux-audit.spec.js` |
| Veraltete Clientrevision bzw. altes Spiel | – (Zug- und Kartenprüfung) | – | – | ✓ | `card-flow.test.js` |
| Aktion unmittelbar vor Timerablauf: Zeitablauf handelt genau einmal, verspätete Aktion abgelehnt | kein Timer in Klassik | kein Timer | kein Timer | ✓ | `card-flow.test.js`; UNO-Varianten: `onTimeout` → Bot-Zug |
| Verdeckte Informationen: keine fremde Hand in Spieler- oder Zuschaueransicht, Kartenzahl öffentlich korrekt | ✓ | ✓ (auch Spielstapel) | ✓ (Karten-IDs) | ✓ | `card-flow.test.js` |
| Wiederverbindung: gleiche Ansicht für dieselbe ID | ✓ | über Browserfall | über Browserfall | über EXP-087 | `card-flow.test.js`, `card-ux-actions.spec.js` („readonly clocks … disconnect“), `exp-doppelkopf.spec.js` |
| Reconnect während Kartenwahl: Auswahl verworfen, kein Zug eingereiht | ✓ | ✓ | ✓ | – | `card-ux-actions.spec.js` |
| Fehlende Bestätigung: Sperre bis Neuladen, keine Wiederholung | ✓ | ✓ | ✓ | – | `card-ux-actions.spec.js` („missing acknowledgement“) |
| Ungültiger Drop bei Drag-and-Drop sendet nichts | – | ✓ | ✓ (Joker-Ende) | – | `card-ux-actions.spec.js` |
| Spielende und neue Runde: alte Aktionen ungültig, Gesamtstand nullsummig | – | – | – | ✓ | `card-flow.test.js` |
| Zuschaueransicht im Browser | ✓ | ✓ | ✓ | ✓ | `card-ux-actions.spec.js`, `exp-doppelkopf.spec.js` |
| Verlassen des Tisches während laufender Töne | gemeinsamer Experience-Kit (Raum- und Generationsprüfung) | | | ✓ | `experience-kit`-Tests (QA-DOKO-01) |

## Browsermatrix (lokal, Karten-UX-Suite)

Chromium Desktop und Touch, WebKit iPhone 13, Firefox Desktop und schmal: 251 bestanden, 47 bewusst übersprungen, 2 Fehler. Der Phase-10-Fall in Firefox besteht einzeln (3/3, lastbedingt). Der UNO-Ultimate-Fall in WebKit scheitert auch ohne die Änderungen dieses Auftrags (siehe Risiken). Die CI prüft Browser ausschließlich mit Chromium.

## Server-/Client-Konsistenz

- Abgelehnte Aktionen ändern die Nutzlast keines Empfängers. Geprüft wird die vollständige `room.view(id)` aller Spieler und eines Zuschauers. Nur der Serverzeitstempel `now` und die Frist `deadline` sind flüchtig.
- Der Client übernimmt nur bestätigte Zustände. Ein Kartenknoten bleibt bei unveränderter Identität erhalten (DOM-Abgleich), Auswahlen fallen bei Hand-, Zug- oder Rundenwechsel weg.

## Verbleibende Risiken

1. **UNO Ultimate (Flip) auf WebKit:** Die Kontrastprüfung im Materialatlas findet keine Elemente (`.fc-material-atlas .fc-w .v`). Reproduzierbar, auch ohne diesen Auftrag. Firefox und WebKit laufen nicht in der CI.
2. **Skip-Bo spielt nach Handindex:** Die Sperre verhindert parallele Anfragen. Ein zweites Gerät desselben Kontos mit veraltetem Stand könnte jedoch einen anderen Index treffen. Der Server prüft Zug und Bauregel, nicht den gemeinten Kartenwert.
3. **CI #270 (`de6d769`):** Browser-Teil 1 scheiterte einmal und war lokal auf exakt diesem Stand nicht reproduzierbar (132/132). Das Protokoll ist ohne Anmeldung nicht einsehbar.

## Empfehlungen

- Firefox- und WebKit-Profile der Karten-UX-Suite in die nächtliche CI aufnehmen.
- Skip-Bo-Aktionen zusätzlich mit dem erwarteten Kartenwert senden und serverseitig vergleichen (eigene Freigabe, Protokolländerung).
- Echte Mehrgeräte-Sitzungen mit gleichem Konto und Netzunterbrechungen manuell prüfen.
