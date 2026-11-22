# Die Spielhalle

Spiel-ID `spielhalle`, Version 3.23.0. IDLE-04 verwendet die vorhandene Idle-Engine und die Konto-API aus 3.22.0. Wirtschaft und Freischaltungen werden auf dem Server berechnet. Das Szenenbild zeigt die betriebsbereiten und pausierten Typen am gewählten Standort. Die Oberfläche hat deutsche und englische Texte. Das Spiel simuliert einen Betrieb mit fiktiven Münzen.

## Spielweg und Nachweise

Der reproduzierbare [Spielweg](../test/spielhalle-playthrough.js) startet mit einem neuen Konto. Er setzt eine kontrollierte Uhr und verwendet normale autorisierte Aktionen. Die Spalten zeigen die beobachteten Kontrollpunkte. Ein Phasenwechsel kann innerhalb des davorliegenden Zeitintervalls früher eintreten.

| Phase | Kontrollpunkt seit Start | Aktionen und Nachweise |
| --- | --- | --- |
| S1 Kartenzimmer | 0 min, 25 Münzen, 0 Gäste | Der erste Gast bringt 5 Münzen. Der Autogeber kostet 30. [Desktop](spielhalle/SH-P1-desktop.png) · [Mobil](spielhalle/SH-P1-mobil.png) |
| S2 Spielhalle | 35 min, 106 Gäste | Würfelbar und Schach bauen, den echten Service-Engpass ansehen und durch Einstellung beseitigen. [Desktop](spielhalle/SH-P2-desktop.png) · [Mobil](spielhalle/SH-P2-mobil.png) |
| S3 Casino | 1 Tag und 35 min, 4.563 Gäste | Karten, Würfel und Schach bedienen Gäste. Der Run-Umsatz erreicht 25.000. Poker und Croupier erzeugen danach Casino-Umsatz. [Desktop](spielhalle/SH-P3-desktop.png) · [Mobil](spielhalle/SH-P3-mobil.png) |
| S4 Entertainment-Komplex | 8 Tage und 35 min, 176.702 Gäste | 250.000 Casino-Umsatz und Rufstufe 3. Filialverwaltung erforschen und Hafenstandort eröffnen. [Desktop](spielhalle/SH-P4-desktop.png) · [Mobil](spielhalle/SH-P4-mobil.png) |
| S5 Imperium | 8 Tage, 35 min und 30 s, 176.717 Gäste | Beide Standorte haben tatsächlich Gäste bedient und tragen ihren jeweiligen laufenden Betrieb. Ausbau auf fünf Standorte und neun Stationstypen, komplette Forschung und VIP-Etage an der Altstadt. [Desktop](spielhalle/SH-P5-desktop.png) · [Mobil](spielhalle/SH-P5-mobil.png) |
| Endgame | Nach weiteren 500 simulierten Tagen, 41.576.877 Gäste | Alle sechs Einzelziele sind zugleich erfüllt. Jeder Standort hat Rufstufe 5. Renommee wird separat und freiwillig bestätigt. |

Desktop-Nachweise wurden mit einer 1440×900-Ansicht, Mobil-Nachweise mit 390×844 erfasst. Die Aufnahmen zeigen jeweils die ganze scrollbare Seite. Die beiden Playwright-Projekte prüfen die horizontalen Grenzen, den ersten Spielzug per Tastatur beziehungsweise Touch und den vollständigen Ablauf über die echte HTTP-API. Weitere Fälle decken Speichern, Download, bestätigten Import, Browser-Neuladen, Sprachwahl, Geräteverknüpfung und Tab-Übernahme ab.

## Wirtschaft, Forschung und Automatisierung

Die bestätigten Phasenschwellen bleiben maßgeblich. Die Zuteilung nimmt VIP-Anfragen zuerst und verbraucht Plätze und Rollenkapazität jeweils einmal am zugehörigen Standort. Unerfüllte Anfragen haben genau einen Ausweichdurchgang. Der Lohn hängt an zugewiesener Bedienkapazität. Schachgäste zählen dreifach für Know-how. Preisstufen verändern Erlös und Nachfragegewicht. Die Diagnose zeigt eine reale Engstelle und zwei dafür vorgesehene Handlungswege.

Bei negativer Gesamtrate endet kostenpflichtiger Betrieb am Erreichen von null Münzen. Der Algorithmus pausiert zuerst Kampagnen und Ereignisse und danach unrentable Stationen in der festgelegten Reihenfolge. Der Basiskartentisch bleibt verfügbar. Ein manueller Wiederanlauf mit negativer prognostizierter Rate erfordert positives Guthaben und eine zusätzliche Bestätigung. Die Automatik wartet in jedem Fall auf ausreichende Reserve und eine nichtnegative Gesamtrate.

Die fünf Automatisierungen umfassen Kartengeber, priorisierte Personalzuweisung mit optionaler Verlustbremse, begrenztes Marketing, Filialstrategien und genehmigte Standort-Baulisten. Filialstrategien und Bauaufträge werden an Ereignisgrenzen bewertet. Die Kosten gehen vom gewählten Budget und von der Kasse ab. Geplante Ereignisse starten per Spieleraktion und enden auch offline zur berechneten Zeit.

Renommee verwendet die bestätigten Rekordleitern mit einmaligen Ansprüchen, freiwilliger Vorschau und höchstens 50 % Nachfragebonus. Die Freischaltungen für Würfelbar, Raum 2 und goldenen Standort-Rahmen beginnen bei 5, 15 und 30 Sternen. Die Würfelbar kann im Startvorteil früh gebaut werden. Regulärer Service bleibt an S2 gebunden. Ein bestätigter Neustart speichert eine neue, aufsteigende Revision, eine neue Lauf-ID und die zusammen erhaltenen Rekorde. Ein Neustart ohne neuen Anspruch bleibt bis zur Fachentscheidung gesperrt.

## Modellwerte und offene Kalibrierung

D04.1 liefert Startkapital, Auto-Kosten, Personal-, Stations- und Nachfrageparameter, Preisfaktoren, Wechselquoten, Rufschwellen und Filialkosten. Der konkrete Produktionskatalog steht in [spielhalle-config.js](../server/idle/spielhalle-config.js). Referenzwerte sind Modellparameter. Alle Betriebs- und Phasenregeln werden zusätzlich im ausgeführten Spiel geprüft.

Wo D04.1 keine Einzelwerte festlegt, verwendet 3.23.0 nachvollziehbare Startwerte für Playtests. Dazu gehören Raumpreise, Forschungsstaffel 3/6/9/12 mit 18 kumuliertem Know-how für die Filialverwaltung, Schulungs- und Schaufensterfaktor, Marketingkosten sowie Preise für Turnier und Gruppenbuchung. Die dokumentierten Flächen der fünf Raum-/Etagenmodule gelten einheitlich. Standortabhängige zusätzliche Flächenwerte brauchen noch eine Kalibrierung. Eine erneute manuelle Runde bedient den nächsten Gast nach 20 Sekunden entsprechend der D04.1-Startrate. Das Rechenmodell fügt dem bestätigten Basistisch keinen Warteabzug für den ersten Gast hinzu.

Der getestete D04.1-Außenanteil bei Einzelangeboten und der 200-Gäste-Pilot für S5 warten auf eine Produktentscheidung. 3.23.0 verlangt für den Filialnachweis mindestens einen tatsächlich bedienten Gast an jedem der beiden Standorte sowie aktuelle Bedienung und eine nichtnegative Rate. Die D04.1-Modellzeiten sind Vergleichswerte. Der Prüfpfad nutzt bewusst deutlich längere Zeitfenster und enthält damit keine Aussage über ideale Sitzungszeiten oder finales Balancing.

## Offline-Zeit und sichere Spielstände

Die Abrechnung verwendet ganzzahlige Untereinheiten und analytische Segmente bis zur nächsten fachlichen Grenze. Nachfrageanteile werden mit stabiler Restverteilung auf ein Milliardstel Gast pro Sekunde aufgelöst. Guthaben bleibt auch beim Überqueren einer Nullgrenze nichtnegativ. Gebühren, Rufschwellen, Ereignisende, Reserve, Phasenwechsel und Konstruktionsbudget begrenzen die Segmente. Das Spiel schreibt keine teilweise berechnete Rückkehr. Der exakte S3→S4-Übergang wird im Test zusätzlich am Millisekundenrand geprüft. VIP steht ab S4 zur Verfügung.

| Autobetrieb ab erstem Kartentisch | 1 min | 1 h | 24 h | 30 Tage | 1 Jahr | 10 Jahre |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Berechnungssegmente | 1 | 2 | 4 | 6 | 7 | 7 |
| Ganze Münzen | 21 | 1.260 | 31.169 | 1.014.938 | 13.322.892 | 137.495.892 |

Ein geteilter Zeithorizont muss denselben Zustand ergeben. Die Offline-Probe führt ausschließlich den bereits autorisierten Betrieb fort. Neue Standorte und vom Spieler zu kaufende Freischaltungen entstehen durch die vorgesehenen Aktionen.

Spielstände verwenden den [Idle-Speichervertrag](idle-engine.md). Bestätigte Revision, flüchtige Aktionen und schreibgeschützte Ansichten werden in der Oberfläche unterschieden. Der Import derselben sauberen Revision zeigt eine Meldung. Bei ungespeicherten Aktionen kann der Spieler ausdrücklich zurück zum bestätigten Stand. Ältere Revisionen und Wiederherstellung ohne Ledger bleiben gesperrt.

## Freigabe und lokale Prüfung

`IDLE_SPIELHALLE_ENABLED` ist standardmäßig aus. Mit einem gültigen `IDLE_SAVE_KEYRING` und ausdrücklichem Schalter erscheint die Karte unter **Spiele → Idle**. Das Testprofil verwendet ein eigenes temporäres Datenverzeichnis. Konfiguration und Volume-Hinweise stehen in der [Betriebsanleitung](betrieb.md). Die Version ändert den Freigabestatus der öffentlichen Roadmap oder des Discord-Exklusivmodus nicht.

Gezielt prüfen mit `node --test test/spielhalle.test.js test/idle-integration.test.js` und `npx playwright test test/ui/spielhalle.spec.js`. Der Browsernachweis übernimmt `HALL_EVIDENCE=1` nur beim ausdrücklich angeforderten Erzeugen der zehn Screenshots.
