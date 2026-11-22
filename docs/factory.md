# Factory Empire

Factory Empire ist das dritte Idle-Spiel von PokerAbend. IDLE-07 umfasst die Werkstatt bis zum Motoren-Pilotauftrag, IDLE-08 den Ausbau zum regionsübergreifenden Industrienetz. Die Spiel-ID ist `factory`.

## Spielen und Speichern

Im Hub lässt sich die Fabrik auf PC und Smartphone bedienen. Kacheln lassen sich antippen oder mit den Pfeiltasten auswählen. Bauwerkzeuge, Inspektor, Material und Maschinen sind getrennte Ansichten. Strom, Forschung, Bahn und Blaupausen erscheinen mit dem jeweiligen Fortschritt. Der Inspektor zeigt Richtung, verbundenen Durchsatz und Maschinenzustand. Die Oberfläche ist auf Deutsch und Englisch verfügbar.

Der Server bestimmt Guthaben, Zeit, Flüsse und Freischaltungen. Vor einem Gerätewechsel den Stand manuell speichern. Ein signierter Export ist an Spiel und Konto gebunden, der Import kann den aktuell bestätigten Stand wieder öffnen. Eine ältere Datei erzeugt keine neue Gutschrift. Eine Tab-Übernahme entwertet die bisherige Schreibsitzung. Einzelheiten stehen in der [Idle-Speicherarchitektur](idle-engine.md#speichern-wiederaufnahme-und-import).

`IDLE_FACTORY_ENABLED` ist standardmäßig `off`. Auf einem ausdrücklich dafür freigegebenen isolierten Server sind ein gültiger Idle-Schlüsselring und ein eigenes persistentes Datenverzeichnis erforderlich. Die beiden anderen Idle-Spiele haben eigene Schalter. [Betriebsanleitung](betrieb.md)

## Phasen und nachgewiesener Spielweg

Der Browsertest startet mit einem neuen Konto und setzt die erste Maschine über die Oberfläche. Die weiteren Aufträge, Bauten und Freischaltungen laufen mit normalen autorisierten HTTP-Anfragen. Die isolierte Uhr beschleunigt das Warten. Die Minutenangaben sind Simulationszeit für den gewählten Aufbau und enthalten einen bewusst langen ersten Erzverkauf. Sie sind keine Zielwerte für die Spielzeit.

| Phase | Messbarer Übergang | Erreichter Teststand | Ansichten |
| --- | --- | --- | --- |
| FE-P1 · Erzabbau | 100 Eisenerz verkaufen | Start. Ein korrekt ausgerichteter Bohrer liefert direkt an das Dock, 10 Erz/s. | [Desktop](factory/FE-P1-desktop.png) · [Mobil](factory/FE-P1-mobil.png) |
| FE-P2 · Produktionsstraße | 50 Eisenbarren und 50 Zahnräder über Bänder liefern, 5/s-Engpass bestätigen | 40:00. Die gewählte Startförderung verkauft 24.000 Erz für den späteren Ausbau. | [Desktop](factory/FE-P2-desktop.png) · [Mobil](factory/FE-P2-mobil.png) |
| FE-P3 · Strom und Motoren | 100 Motoren zum Pilotauftrag liefern und Stromnetz I erforschen | 40:45. Die beiden Förderbandlieferungen und der Engpass sind bestätigt. | [Desktop](factory/FE-P3-desktop.png) · [Mobil](factory/FE-P3-mobil.png) |
| FE-P4 · Regionen und Bahn | Dreimal per Bahn nach Region 2 liefern und Industrieplanung III erforschen | 44:25. Der Pilotauftrag ist gebucht und ein 8-MW-Netz betreibt die Fertigung. | [Desktop](factory/FE-P4-desktop.png) · [Mobil](factory/FE-P4-mobil.png) |
| FE-P5 · Industrienetz | Vier verbundene Regionen, 10.000 Module, 100 MW in einem Netz, alle Aufträge, mindestens 50 % erneuerbare Förderung und alle Forschungen | 1:36:58. Alle sechs Abschlussziele nach 14:33:38, mit 15.389 Modulen, vier verbundenen Regionen und 104 MW. | [Desktop](factory/FE-P5-desktop.png) · [Mobil](factory/FE-P5-mobil.png) |

Die Ansichten stammen aus Chromium mit 1440 × 900 und 390 × 844 Pixeln im Testfenster. Die Aufnahmen zeigen die gesamte Seite mit den beim Phasenwechsel geöffneten Ansichten. Der Desktop-Test beendet den gesamten Spielweg. Mobil werden alle fünf Phasen und die Bedienung nach denselben Serverregeln geprüft.

## Material und Grenzen

- Der Start bietet 100 Credits, davon 40 frei und 60 für die erste Produktionslinie reserviert. Verkaufserlöse füllen die reservierten Finanzierungsziele von 180, 615 und 5.300 Credits. Weitere regulär erwirtschaftete Credits können Bau- und Forschungskosten decken. Die drei Startvorkommen umfassen 250.000 und 400.000 Eisenerz sowie 300.000 Kupfererz.
- Die Pflichtvorräte von 200 Eisenerz für die erste Linie, 280 Eisenerz und 200 Kupfererz für Pilot und Forschung sowie 680 Eisenerz und 230 Kupfererz für die Bahnziele sind Teil der realen Startfelder. Die Bindung bleibt in Zwischenprodukten, beim Umlagern und beim Abbau von Maschinen erhalten. Der Abschluss einer Phase gibt ihren verbliebenen Vorrat einmalig frei. Marktverkäufe entnehmen nur freie Materialien, abgesehen von den als Ziel gelieferten Eisenbarren und Zahnrädern aus der ersten Linie.
- Förderbänder schaffen 5, 15 oder 45 Stück pro Sekunde. Lager und Bahnhöfe fassen regulär 500 Stück je Bauwerk, die Lagerforschung verdoppelt die Lagerkapazität. Die Auslagerungsautomatik startet in Phase 3. Das Dock verarbeitet zusammen höchstens 20 Stück pro Sekunde für manuelle und automatische Buchungen. Die Kaufpreise, Rezepte, Forschungskosten und Aufträge stehen in [factory-config.js](../server/idle/factory-config.js).
- Jedes Kleinkraftwerk liefert 8 MW. Verbrauch wird vollständig oder gar nicht zugeteilt. Das Netz berücksichtigt zuerst als kritisch markierte Maschinen, dann die Baufolge. Kabel können auf einer gesonderten Ebene über Bändern verlaufen. Je Bahnhof sind 2 MW erforderlich. Eine Strecke liefert 50 Stück je Wagen in 120 Sekunden mit einem zusätzlichen Anlaufintervall. Der Lieferzähler steigt erst bei Ankunft. Stromlose Züge behalten ihren Frachtzustand. Der automatische Versand berücksichtigt ausschließlich die offenen Mengen der aktiven passenden Aufträge.
- Aufträge haben weder Frist noch Strafe. Es sind höchstens drei zugleich aktiv. Forschung benötigt Credits, Teile im zugeordneten Labor und ein versorgtes Stromnetz. Die kostenlose Förderung und das feste Dock bieten einen Rückweg bei Geldmangel. Noterz steht nur bei einer echten Startblockade bereit und wird bis zum Preis eines mechanischen Bohrers begrenzt. Falsch gedrehte Verbindungen lassen sich kostenlos korrigieren. Frei finanzierte Bauten erstatten bei Demontage die Hälfte, zweckgebundene Bauten bis zum Phasenabschluss auf ihr Pflichtkonto.
- Blaupausen erfassen Platzierungen, Ausrichtung und Konfiguration. Der Wiederaufbau kostet den vollständigen Baupreis. Der optionale Prestige-Neustart bewahrt die Bibliothek und bereits erworbene Industriepatente. Jeder Anspruch ist kontoweit einmalig. Ein Reset ohne neuen Patentanspruch ist derzeit nicht vorgesehen.

## Abrechnung und Offline-Fortschritt

Der [Materialgraph](../server/idle/factory-graph.js) verbindet tatsächlich benachbarte Ein- und Ausgänge in jeder Region. Layout, Drehung und Bauaktion werden serverseitig validiert. Gerichtete Materialkreise werden abgelehnt. Strom wird vor der Produktion geprüft. Der [Produktionssolver](../server/idle/factory-flow.js) reserviert zunächst Kapazität für vorliegende manuelle Dock-Buchungen. Er zieht anschließend Eingänge für gebundene Dock-Ziele, freie Dock-Buchungen und Lager in fester Reihenfolge ab. Splitter verteilen nach Gleichanteil oder Priorität, und freie Restkapazität wird in einem zweiten Durchgang verteilt. Eine Rezeptbuchung prüft ihre Zutaten gemeinsam. Alle Flüsse verwenden dieselben Bestands- und Durchsatzgrenzen.

Bei laufender Produktion bilanziert der Solver in ganzen UTC-Sekundengrenzen, mit ganzzahligen Tausendsteln für Mengen und Credits. Er summiert konstante Raten bis zum nächsten relevanten Ereignis. Wiederkehrende Rundungsfolgen werden nur gebündelt, solange die belegten Bestands-, Kapazitäts- und Fortschrittsgrenzen für jeden Zwischenschritt gelten. Produktion, Zugankunft, einmalige Auftragsbelohnung und gegebenenfalls Phasenwechsel folgen in dieser Reihenfolge. Die gemeinsame Engine hat kein zeitliches Offline-Limit. Ein überschrittenes Rechenbudget von 10.000 Segmenten bricht kontrolliert ohne Teilbuchung ab.

Die [Engine-Tests](../test/factory.test.js) vergleichen den vollständigen gespeicherten Zustand nach einer Minute, einer Stunde, einem Tag, 30 Tagen, 365 Tagen und 3.650 Tagen jeweils mit geteilter Berechnung. Das endliche Lager stoppt bei 500 Stück, auch nach 3.650 Tagen. Zusätzlich bleiben der Frachtstand beim Überschreiten der ersten Ankunft und ein laufendes erneuerbares Endgame-Netz über 3.650 Tage exakt gleich. Der erneuerbare Testfall benötigt dabei weniger als 60 Segmente. Ein getrenntes Szenario prüft den gebundenen Bestand bei erschöpftem freien Erz.

## Reproduzieren und weiter kalibrieren

```sh
node --test test/factory.test.js test/idle-engine.test.js test/idle-savepoints.test.js test/idle-integration.test.js test/spielhalle.test.js test/studio.test.js
npx playwright test test/ui/factory.spec.js test/ui/spielhalle.spec.js test/ui/studio.spec.js test/ui/nav-visibility.spec.js
npm run test:fast
```

Mit `FACTORY_EVIDENCE=1` erzeugt der [Browsernachweis](../test/ui/factory.spec.js) alle zehn Ansichten neu. Der Test benutzt den [reproduzierbaren Spielweg](../test/factory-playthrough.js), dessen Aktionen auch gegen den realen Speicherdienst laufen. Die Tests belegen einen vollständigen und regulären Pfad sowie die Segmentgrenzen der geprüften Layouts. Die Kosten für alternative späte Layouts, das Spieltempo außerhalb dieses Pfads und ein möglicher ersetzender Rollback bleiben vor einer öffentlichen Freigabe zu bewerten.
