# Gemeinsame Idle-Engine

IDLE-ENGINE-01 ist das technische Fundament in PokerAbend 3.21.0. Entwicklungsbasis war Version 3.20.2 auf Commit `9a796fcca08eec79f08da63857eca7ab06ade378`.
Die Phasenkonfiguration folgt den bestätigten Fachregeln von IDLE-D00. IDLE-D03 dient als Entwurf für die spätere Oberfläche. Die Zahlen aus IDLE-D04.1 sind Vergleichswerte für Balancing und Tests.

## Module und Schnittstellen

| Datei | Verantwortung |
| --- | --- |
| [public/idle/engine.js](../public/idle/engine.js) | Reine Engine für Zeit, Ressourcen, Produktionszyklen, Preise, Upgrades, Automatisierung und Phasen. Läuft als ES-Modul ohne Node- oder DOM-Abhängigkeiten. |
| [public/idle/progression.js](../public/idle/progression.js) | Fünf Phasen pro Spiel mit messbaren Eintrittsbedingungen, Freischaltungen, Ressourcen, Engpässen, Automatisierung und Abschlusszielen. |
| [server/idle/savepoints.js](../server/idle/savepoints.js) | Autoritative Sitzungen, Tab-Übernahme, Savepoints, revisionsgebundene Kommandos, Importvorschau und lokaler Dateiadapter. |
| [server/idle/exports.js](../server/idle/exports.js) | Versionierte und auf Konto und Spiel gebundene HMAC-Exporte, kanonisches JSON und Prüfsummen. |

`createIdleEngine(module, phases)` stellt `create`, `validate`, `advance`, `view`, `command` und `migrate` bereit. Das Modul definiert Spiel-ID, Zustands- und Regelversion, Startzustand, Validierung, Fakten, Kommandos und Zeitsegmente. Die Fakten für Eintrittsbedingungen und Forschung stammen aus dem autoritativen Spielzustand. Die spätere HTTP-Schicht muss Konten über die vorhandene serverseitige Identität auflösen. Spiele und Module erhalten eine eigene Allowlist.

Für die Ansicht liefern `view` und optionale Modulmethoden Fortschritt je Ziel, kumulative Freischaltungen, verfügbare Automatisierung und Engpassgründe. Der Browser kann dieses Darstellungsmodell verwenden. Guthaben, Freischaltungen und Save-Rechte entscheidet der Server. Ein Spielmodul kann zusätzlich eigene Besitz-, Qualitäts- und Kapazitätsbedingungen erzwingen. Automatisierung prüft Freischaltung, ausdrückliche Aktivierung und Budget. Forschung schaltet die Studio-Testpipeline und die Release-Regeln individuell frei.

## Zeit und Wirtschaft

- Zeitanker sind UTC-Millisekunden. Sommer- und Winterzeit ändern das berechnete Intervall nicht. Ein Zeitpunkt vor dem Anker löst `clock-regressed` aus. Eine monotone Uhr steuert die Schreib-Lease unabhängig von der Spielzeit.
- Werte liegen als Dezimalstrings mit bis zu 80 Stellen vor. `BigInt` hält Mengen, Kosten und ganzzahlige Untereinheiten exakt. Spielmodule legen Einheiten und Darstellungsskalen fest. Eine Transaktion prüft Eingaben, Deckung und Lagergrenzen und übernimmt sie als Ganzes. Eine Ausgabe kann sich durch ihren eigenen Ertrag nicht vorfinanzieren.
- Ein Simulationssegment umfasst das Zeitintervall bis zur nächsten fachlichen Grenze oder bis zum Zielzeitpunkt. Bei einem Kommando gilt die bis zu diesem Zeitpunkt fällige Produktion zuerst. Ein Modul muss eigene gleichzeitige Ereignisse in stabiler Reihenfolge verarbeiten und an seinen Regelgrenzen segmentieren.
- `produceBatches` aggregiert unabhängige Zyklen ohne Schleife pro Takt. Es behält den begonnenen Takt in Millisekunden und begrenzt die Zahl fertiger Zyklen anhand von Eingaben, Lager und verfügbarer Absatzmenge. Ausgefallene Zyklen werden später nicht nachgezahlt. Mehrstufige Netze, konkurrierende Eingänge und andere dynamische Regeln liegen beim jeweiligen Spielmodul.
- Es gibt kein pauschales Offline-Zeitlimit. Das Ergebnis enthält Anker, Zielzeit und Segmentzahl. Standardmäßig begrenzt die Engine einen Aufruf auf 10.000 Segmente. Ungültige Segmente, Rückwärtszeit oder eine Überschreitung liefern einen Fehler ohne Teilergebnis. Vor der öffentlichen Nutzung müssen die echten Spielmodule lange Intervalle durch Aggregation nachweislich innerhalb des Rechenbudgets verarbeiten.

## Phasen und spätere Spielmodule

| Spiel | Phasen | Fortschritt und Modulaufgaben |
| --- | --- | --- |
| Die Spielhalle | `SH-P1` bis `SH-P5` | Autogeber und bediente Gäste, Stationstypen und Run-Umsatz, kumulierter Casino-Umsatz und Ruf, zwei betriebene Standorte plus Filialforschung. Das Spielmodul berechnet Gästezuweisung, Personal, Standby und Wiederanlauf. Eine betriebene Filiale muss Gäste bedienen und ein nichtnegatives Ergebnis erzielen. |
| Game Studio Tycoon | `GS-P1` bis `GS-P5` | Releases und Fans, Wertung und Marketingforschung, Verkaufsumsatz und Mitarbeiterzahl, Engine III und Releases aus zwei Studios. Das Spielmodul verantwortet Projektbudgets, QA, Releases und endliche Märkte. |
| Factory Empire | `FE-P1` bis `FE-P5` | Erzverkauf, zwei Güterflüsse mit Banddiagnose, Motorenauftrag und Stromforschung, interregionale Lieferungen und Industrieforschung. Rezepte, Strom, Pflichtreserven, Produktionsgraph und Rettungspfade gehören zum Spielmodul. |

Die Engine wertet die Übergänge der Reihe nach aus und zeigt am Ende die jeweiligen Abschlussziele. Die Tests erreichen alle zwölf Übergänge über kontrollierte Zustandsfakten. Freiwilliges und gedeckeltes Prestige ist eine Fachvorgabe für die Spielmodule. Der dafür erforderliche atomare neue Run mit Anspruchsregister gehört in das zuständige Folgepaket.

## Speichern, Wiederaufnahme und Import

- Konto und Spiel haben genau einen aktuellen bestätigten Datensatz. `open` und `view` berechnen Offline-Fortschritt ohne Schreibzugriff. `command` verändert nur den flüchtigen Stand. `save` und `saveAndExport` bestätigen einen neuen Zeitanker und eine neue Revision per Compare-and-Set. Nach Prozessneustart wird ab dem letzten bestätigten Stand gerechnet. Ungespeicherte Aktionen verfallen.
- Ein weiterer Tab sieht den Stand lesend. Explizite Übernahme ab der bestätigten Revision tauscht den Schreib-Token aus und verwirft ungespeicherte Aktionen der alten Sitzung. Die Lease läuft regulär nach fünf Minuten ab und ist erneuerbar. Commands halten die jüngsten 128 Anfragebelege innerhalb der Sitzung. Der letzte erfolgreiche Save enthält die persistente Anfrage-ID und ihren Digest für einen verlorenen ACK. Ein alter Schreib-Token oder eine obsolet gewordene Revision darf nichts überschreiben.
- Beide Save-Pfade prüfen die Exportierbarkeit vor dem Schreibvorgang. Der kanonische Nutzinhalt ist auf 256 KiB begrenzt. `saveAndExport` gibt den signierten Spielstand direkt zurück, `exportConfirmed` exportiert die aktuell bestätigte Revision. Der Export enthält Spiel-ID, Run-ID, Revision, Zeitanker, Zustands- und Regelversion und eine HMAC-Kontobindung. Er enthält weder den Schreib-Token noch die rohe Konto-ID. Die Signatur schützt die Integrität. Das Format ist lesbar und enthält Spielstandsdaten. Die HMAC-Schlüssel gehören in eine spätere serverseitige Konfiguration mit definierter Rotation.
- `previewImport` prüft Signatur, Schlüssel, Konto, Spiel, Version, Zeit und den bestätigten Datensatz. Eine kurzlebige Bestätigung bindet die Vorschau an den Inhalt des Datensatzes und die flüchtige Sitzungsrevision. Der bekannte aktuelle Stand kann die Sitzung neu aufbauen. Die Bestätigung ist idempotent und verbucht nichts dauerhaft. Ältere Revisionen oder eine Datei ohne bestätigten Datensatz werden abgelehnt. Neuaufsetzen und Wiederherstellung ohne vorhandenen Datensatz brauchen eine gesonderte Regel.
- Historische Schemen brauchen eine registrierte Prüfung und eine explizite Migration. Die Migration arbeitet auf einer Kopie und behält den Zeitanker. Erst ein manueller Save schreibt den migrierten Zustand. Unbekannte oder beschädigte Formate bleiben unangetastet.

Vor der Umsetzung der Speicheroberfläche ist zu klären, wann sie für die bereits aktive Revision einen Hinweis zeigt und wann sie das erneute Laden zur Rücknahme ungespeicherter Aktionen anbietet. Der Service unterstützt das in der technischen Planung vorgesehene erneute Laden eines bekannten aktuellen Stands.

Ältere manuelle Sicherungen können mit 3.21.0 bewusst nicht wiederhergestellt werden. Der Rollback-Ablauf aus dem frühen UX-Entwurf ist separat freizugeben. Dafür sind ein neuer Lauf mit aktuellem Zeitanker, eine fortgeführte Revision und der Schutz vor erneuten Gutschriften und Prestigeansprüchen zu spezifizieren. Der Verlust des bestätigten Serverdatensatzes erfordert einen gesonderten Betreiber-Wiederherstellungsweg.

Der Signierer wird ausschließlich serverseitig mit einem expliziten Schlüsselring initialisiert. Ein fehlender aktiver Schlüssel, ein ungültiger Schlüssel oder eine unbekannte Signaturkennung führt zur Ablehnung. Der Browsercode enthält keine Schlüssel. Die produktive Einbindung und Rotation des Schlüsselrings sind Teil späterer Arbeiten. Spielmodule müssen exportierbaren Zustand von Zugangsdaten und anderen Geheimnissen getrennt halten.

## Grenzen und Nachweise

Der Dateiadapter unterstützt einen Node-Prozess und ein lokales Dateisystem. Er schreibt eine exklusive temporäre Datei, synchronisiert deren Inhalt und ersetzt den Zielpfad atomar. Garantien für einen Stromausfall oder mehrere Prozesse erfordern eine separate Prüfung und gegebenenfalls einen transaktionalen Adapter. Konto-Löschung, Kontozusammenführung, produktiver Schlüsselbetrieb, Autorisierung der Routen und API-Limits sind Integrationsaufgaben.

Die Idle-Kategorie bleibt verborgen, bis ein Spiel registriert ist. Der Engine-Auftrag registriert kein Spiel und bindet keine HTTP-Routen ein. Echte Langzeitwerte, Bedienung, Mobil-Performance der drei Spiele und das offene Balancing benötigen eigene Abnahmen.

Die gezielte Prüfung läuft mit `node --test test/idle-engine.test.js test/idle-savepoints.test.js`. Beide Dateien sind Teil von `npm run test:fast`. Der vorhandene Playwright-Fall N05 prüft die Sichtbarkeit im Hub mit und ohne registriertes Idle-Spiel.
