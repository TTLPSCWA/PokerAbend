# Kartenaktionen: Audit aller Kartenspiele (CARD-ACTION-01/02)

Stand 25.11.2026, Version 3.28.1. Untersucht wurden alle 22 Spiele der Kategorie „karten“. Die Frage war: Können veraltete Clientzustände, parallele Fenster, mehrere Geräte desselben Kontos oder schnell aufeinanderfolgende Eingaben eine falsche Kartenaktion auslösen? Tests: [test/card-action.test.js](../test/card-action.test.js) und [test/ui/card-action.spec.js](../test/ui/card-action.spec.js). Die vorherige Zustandsmatrix steht in [card-flow-qa.md](card-flow-qa.md).

## Plattformverhalten (für alle Spiele)

- **Ein aktives Fenster je Konto und Raum:** Öffnet dasselbe Konto den Raum in einem zweiten Fenster oder auf einem zweiten Gerät, erhält die alte Verbindung `replaced`. Sie wird getrennt und zeigt „Du spielst gerade in einem anderen Tab weiter“ (`server/index.js`, `public/core.js`). Zwei gleichzeitig aktive Fenster gibt es also nicht.
- **Verbleibende Risiken:** Aktionen, die schon unterwegs waren oder aus einem alten Stand nach Rückkehr gesendet werden, sowie der zweite Klick eines Doppelklicks.
- **Reihenfolge:** Der Server verarbeitet Ereignisse eines Raums nacheinander. Jede Aktion prüft Phase, Zug und Karte am aktuellen Stand.
- **Behobener Fehler:** Nach `replaced` warf ein Sekundentimer in `public/core.js` jede Sekunde einen JavaScript-Fehler, weil `#game-root` nicht mehr existierte.

## Übersicht

| Spiel (ID) | Kartenidentität | Revision/Stand | Parallel und doppelt | Veralteter Client | Mehrere Geräte/Reconnect | Serverseitig | Befund |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skip-Bo (`stapelrennen`) | **neu:** eindeutige Kennung je Handkarte (`handIds`), Wert bei Stapel und Ablage | **neu:** Revision und Runde | nur die erste von mehreren gleichartigen Aktionen gilt | Kennung, Wert, Revision, Runde und erwartete Zahl der Baureihe | abgelöst bzw. abgelehnt | ja | **behoben** (CARD-ACTION-01): bisher nur Handindex |
| Blackjack (`blackjack`) | Hand-Index und Kartenzahl | **neu:** erwartete Hand und Kartenzahl | **neu:** zweiter Klick wird im Browser ignoriert und vom Server abgelehnt | Hand und Kartenzahl | abgelehnt | ja | **behoben**: Doppelklick auf „Karte“ zog zwei Karten, auf „Stehen“ beendete er bei geteilter Hand beide Hände |
| Mau-Mau (`maumau`) | Kartenwert (ein Blatt, eindeutig) | **neu:** Zugzähler `seq` | **neu:** zweiter Klick wird ignoriert | Zugzähler | abgelehnt | ja | **behoben**: Ein-Klick-Bedienung; nach „Ass – nochmal dran“ traf der zweite Klick die nächste Karte |
| UNO und Varianten (`farbenchaos`) | Wert, bei physischen Varianten Token mit `@` | Zug und Schritt (`drawn`, `pending`, Farbwahl) | Sperre bis zur Serverbestätigung, Auswahl wird danach gelöscht | Zugprüfung; gleiche Werte haben gleiche Wirkung | abgelöst | ja | kein Fehler |
| Phase 10 (`zehnetappen`) | eindeutige Karten-ID | Schritt (`draw`, `play`) | Sperre bis zur Bestätigung, zweites Ziehen abgelehnt | ID und Schritt | abgelöst | ja | kein Fehler |
| Doppelkopf (`doppelkopf`) | Kartenwert (gleiche Karten gleichwertig) | Spielschlüssel und Revision; Ansagen mit absoluter Zielstufe | doppelte Ansage abgelehnt, alte Revision beim Kartenspiel abgelehnt | ja | abgelöst | ja | kein Fehler |
| Skat, Hearts, Stichmeister, Exploding-Deck | eindeutige Karte | Revision, teils Spielschlüssel | alte Revision abgelehnt | ja | abgelöst | ja | kein Fehler |
| Poker, Omaha Hi/Lo, Short Deck, Seven Card Stud, Five Card Draw | – (Einsätze) | Poker: Aktions-ID gegen Doppelsendung; Varianten: Revision und Handschlüssel | ja | ja | abgelöst | ja | kein Fehler |
| Durak (`durak`) | Kartenwert (ein Blatt) und Angriffsplatz | Zug, Platz schon geschlagen | zweites Schlagen desselben Platzes abgelehnt | Platz- und Kartenprüfung | abgelöst | ja | kein Fehler |
| Mogeln, Präsident | Kartenwerte (ein Blatt) | Zug | gespielte Karten sind weg, Zug geht weiter | Zug- und Besitzprüfung | abgelöst | ja | kein Fehler |
| Schwimmen (`schwimmen`) | Hand- und Mittelindex | Zug; ein Tausch beendet den Zug | zweiter Tausch: „nicht dran“ | Zugprüfung | abgelöst | ja | kein Fehler (Restrisiko siehe unten) |
| 6 nimmt (`sechs-nimmt`) | Kartenwert (eindeutig 1–104) | Wahl je Runde einmal; Reihe nur im eigenen Zug | zweite Wahl abgelehnt | ja | abgelöst | ja | kein Fehler |
| Monopoly Deal (`monopoly-deal`) | Karten-Schlüssel, Satz-ID | Aktionszähler, offene Reaktion | Dialog schließt vor dem Senden | Besitzprüfung | abgelöst | ja | kein Fehler (Restrisiko siehe unten) |

## Umgesetzte Korrekturen

1. **Skip-Bo (CARD-ACTION-01):** Jede Handkarte hat eine eindeutige Kennung, und der Raum führt eine Revision. Der Browser sendet Revision, Runde, Kartenkennung bzw. erwarteten Wert (Stapel, Ablage) und die erwartete Zahl der Baureihe mit. Der Server prüft das vor jeder Änderung und lehnt sonst mit „Diese Kartenaktion ist nicht mehr aktuell – der Spielstand wurde aktualisiert“ ab. Der aktuelle Stand liegt dann im Browser bereits vor, die Auswahl wird verworfen. Bots und interne Aufrufe handeln weiter direkt am aktuellen Stand.
2. **Blackjack:** „Karte“, „Stehen“, „Verdoppeln“ und „Teilen“ senden die angezeigte Hand und deren Kartenzahl. Der zweite Klick eines Doppelklicks wird im Browser ignoriert, eine veraltete Aktion vom Server abgelehnt.
3. **Mau-Mau:** Eine Kartenaktion sendet den Zugzähler. Der zweite Klick eines Doppelklicks wird in der Ein-Klick-Bedienung ignoriert.
4. **Zweites Fenster:** Der Sekundentimer in `public/core.js` bricht nach `replaced` ab, statt Fehler zu werfen.

## Nachweise

- `test/card-action.test.js` (10 Tests):
  - **Skip-Bo:**
    - identische Werte
    - zwei Fenster bzw. Geräte
    - gleichzeitige und wiederholte Aktionen
    - veränderter Handindex
    - alte Revision
    - Ziel und Wert
    - Zugwechsel
    - Rundenwechsel
    - Wiederverbindung
    - Vertraulichkeit der Kennungen
    - Bots mit konsistenten Kennungen
  - **Blackjack:** Doppelklick auf „Karte“ und auf „Stehen“ bei geteilter Hand.
  - **Mau-Mau:** veraltete Aktion nach „Ass – nochmal dran“.
  - **Unverändert:** Jede Ablehnung prüft, dass sich die Nutzlast aller Empfänger einschließlich Zuschauer nicht ändert.
- `test/ui/card-action.spec.js` (Browser): zweites Fenster desselben Kontos.
  - Das alte Fenster zeigt den Hinweis und bleibt fehlerfrei.
  - Nach seiner Rückkehr wird die Aktion aus dem alten Stand abgelehnt: Index 0 auf Reihe 1 hätte sonst die 2 statt der gemeinten 1 gespielt.
  - Danach handelt das Fenster normal.
- Bestehende Bedienungsprüfungen (Auswahl, Ziehen, Touch, Tastatur) für Skip-Bo, UNO und Phase 10 laufen unverändert: `card-ux-actions.spec.js`, `card-ux-audit.spec.js`.

## Verbleibende Risiken

- **Schwimmen:** Die Aktion nutzt Hand- und Mittelindex. Weil jeder Tausch den Zug beendet und nur eine Verbindung je Konto aktiv ist, ist kein falscher Tausch nachweisbar. Eine Revision wäre zusätzlicher Schutz.
- **Monopoly Deal:** Die Ein-Klick-Aktionen im Dialog haben keine Revision. Der Dialog schließt vor dem Senden, die Besitzprüfung greift. Ein falscher Ablauf ist nicht nachweisbar.
- **UNO und Mau-Mau:** Gleiche Kartenwerte werden nicht unterschieden. Weil sie dieselbe Wirkung haben, ist das kein Fehler.
- **Echte Geräte:** Zwei Geräte wurden durch zwei Browserkontexte bzw. zwei Ansichten im Servertest nachgebildet; echte Mobilgeräte mit Netzunterbrechung bleiben manuell zu prüfen.
- **Doppelklick-Schutz:** Er wirkt im Browser über `event.detail` und betrifft Maus und Touch. Tastatureingaben (Enter) lösen keinen Doppelklick aus.
