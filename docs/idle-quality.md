# QA-IDLE-01 · Qualitätsprüfung der drei Idle-Spiele

Basis ist 3.25.0 auf `bdfc9421b72bab1f10cf4f08dcbb2c623304743a` mit 19 erfolgreichen Jobs im [Workflow #249](https://github.com/TTLPSCWA/PokerAbend/actions/runs/45048661580). Die Korrekturen gehören in 3.25.1. Der Push-Lauf des Releases enthält den vollständigen CI-Nachweis. Die Betriebsfreigaben bleiben ausgeschaltet.

## Quellen und Prüfverfahren

Fachgrundlage waren die drei aktuellen GDDs und der bestätigte Review IDLE-D00. Die Bedienung wurde mit IDLE-D03 abgeglichen. Die D04.1-Modellrechnung wurde mit `simulieren.mjs --verify` reproduziert. D04.1 liefert Versuchsparameter, die bestätigten Phasen- und Speicherregeln gehen vor. Maßgeblich für die Befunde sind der ausgeführte Quellcode, die [Phasenkonfiguration](../public/idle/progression.js), der [Speichervertrag](idle-engine.md) und die drei vorhandenen Spielberichte [Spielhalle](spielhalle.md), [Studio](studio.md) und [Factory](factory.md).

Die [neuen Wirtschaftstests](../test/idle-quality.test.js) beginnen entweder in einem neuen Run oder bauen ihre Varianten aus unveränderten Referenz-Spielständen auf. Die selbst entwickelten Frühspielstrategien, der späte Studio-Pfad sowie die verzweigten Hallen- und Fabrikzustände sind im Test getrennt erkennbar. Es werden ausschließlich gültige Aktionen ausgeführt und Zeiten kontrolliert weitergeschaltet. Die bisherigen Endgame-Tests bleiben erhalten.

## Reproduzierte Befunde

| Schweregrad und Spiel | Reproduktion und Istzustand auf 3.25.0 | Erwartetes Verhalten und Korrektur | Nachweis |
| --- | --- | --- | --- |
| Mittel · Factory, mobiles Menü | Bei 300 px „Maschinen“ antippen. Beim nächsten Hintergrund-GET blieb der Tab ausgewählt und fokussiert, sein Scrolloffset fiel aber von 94 px auf 0. Das Neurendern ersetzte die gesamte Tableiste und stellte nur die Kartenscrollposition wieder her. | Die Tableiste übernimmt ihren horizontalen Offset auch nach Hintergrundaktualisierung. Home und Pfeiltasten bleiben bedienbar. | [Browser-Gegenprobe](../test/ui/idle-quality.spec.js) · [Factory-Client](../public/idle/factory.js) |
| Mittel · Studio, mobiles Menü | Zwei reguläre Mini-Releases schalten G2 frei. Bei 300 px die rechts liegende Forschung antippen. Nach dem Neuaufbau der Leiste blieb der Fokus gesetzt, die Leiste sprang dennoch auf 0. Erneutes Fokussieren eines bereits fokussierten Elements scrollte den Tab nicht zurück. | Scrolloffset beim Neurendern erhalten. Beim gewollten Tabwechsel den neuen Tab ausdrücklich in den sichtbaren Bereich scrollen. | [Browser-Gegenprobe](../test/ui/idle-quality.spec.js) · [Studio-Client](../public/idle/studio.js) |
| Niedrig · Factory, Produktionsdiagnose | Mechanischen Bohrer auf Kachel 9/5 mit Auslass nach Westen bauen. Nach einem Tag ist kein Erz verkauft. Der Inspektor meldete „Wartet“ und verwies allgemein auf Gut, Ausrichtung und Lager. Der Materialgraph hatte tatsächlich keine Ausgangskante. | Der Inspektor benennt den offenen Auslass auf Deutsch und Englisch und bietet Drehen oder ein passendes Band als Abhilfe an. Nach Drehen nach Osten verschwindet der Grund. | [Alternativlauf](../test/idle-quality.test.js) · [Serveransicht](../server/idle/factory.js) · [Inspektor](../public/idle/factory-view.js) |
| Niedrig · gemeinsamer Hub-Kopf | In der 300-px-Ansicht überschneidet das Sprachmenü den Schriftzug „Spieleabend“. In den 390-px-Nachweisen ist der Schriftzug vollständig. | Den globalen Kopf bei sehr kleinen Breiten separat prüfen. Der zuvor betroffene Spielbereich ist jetzt bedienbar. | [300-px-Ansicht](idle-quality/studio-mobil-scroll.png) |

Die Korrekturen betreffen Navigation und Diagnose. Die Gegenproben bestätigen weiterhin die bisherigen Kosten, Fördermengen, Phasenschwellen und Speichergrenzen.

## Wirtschaft und Fortschritt

### Die Spielhalle

Drei manuell bediente Gäste an drei Tagen ließen den Run in S1. Eine anschließende Stunde mit gekauftem Autogeber genügte im Test für S2. Aus demselben S2-Stand mit identischem Guthaben ergaben sich diese Varianten:

| Ausrichtung | Netto pro Sekunde | Gäste pro Sekunde | Phase nach fünf Tagen |
| --- | ---: | ---: | --- |
| Günstige Kartentische | 0,190 | 0,050 | S2 |
| Teure Würfelbar ohne Service, übrige Einnahmen am Kartentisch | 0,225 | 0,039 | S2 |
| Karten, Würfel, Schach, Service und Schaufenster | 0,343 | 0,058 | S3 |

Die unbesetzte Würfelbar bediente keinen Gast und machte für sich Verlust. Pausieren verbesserte die Gesamtrate. Sieben unbesetzte Würfelstationen mit günstigen Kartentarifen brachten die Gesamtrate ins Minus. Nach 60 Tagen hatte der Standby eingegriffen, die Kasse blieb nichtnegativ und der Basistisch erwirtschaftete wieder einen positiven Nettoertrag. Raumöffnung und Stationskäufe wurden regulär geprüft.

Für den separaten 200-Gäste-Pilot wurden aus demselben S4-Stand zwei alternative Filialen eröffnet. Der Basiskartentisch bediente im Kurort und Bahnhof den ersten Gast nach 12,5 Sekunden und den 200. nach 2.500 Sekunden. Im gültigen Spiel löst bereits der erste Gast bei laufendem positivem Betrieb und erfüllter Forschung S5 aus. Die vorgeschlagene höhere Schwelle würde in diesem isolierten Fall **41 min 27,5 s** Wartezeit ergänzen. Bei identischer VIP-Lounge mit Service und Sicherheit erzielte der Kurort 0,096 VIP-Gäste/s und 6,154 Münzen/s netto, der Bahnhof 0,0525 und 3,003. Ohne Sicherheit beziehungsweise Service zeigte die Diagnose die jeweils fehlende Rolle. Nach einem Jahr ohne weitere Käufe blieben vier der sechs Endgame-Ziele offen. Der 200-Gäste-Pilot ist eine Produktentscheidung.

### Game Studio Tycoon

Ein kleines Projekt mit Deckel von 1 Kredit blieb auch nach 30 Tagen ohne Abbuchung im Konzept. Ein bestätigter Abbruch gab noch nicht verbrauchte Löhne zurück. Ein regulärer Nebenauftrag zahlte genau 150 Kredite nach einer Minute. Solo-Mini bei gleicher guter Kombination:

| QA | Entwicklungszeit bis Freigabegate | Wertung | Endliches Absatzpotenzial |
| --- | ---: | ---: | ---: |
| Eilrelease | 80 s | 71 | 200 |
| Normal | 100 s | 84 | 237 |
| Gründlich | 113 s | 91 | 256 |
| Kleiner Titel, gründlich | 1.865 s | 91 | 2.119 |

Ein einzelner Eilrelease war schneller, gründliche QA erhöhte Bewertung und den endlichen Absatz. Der Vergleich zeigt keine dauerhafte Dominanz. In G3 erreichte ein Großtitel mit sechs Beschäftigten in beiden Fällen Wertung 97 und 21.594 s Entwicklungszeit. Die Kampagne der Stufe 10 kostete 1.200 Kredite. Bei sonst gleichen Bedingungen stieg der Markt von 45.591 auf 56.989 Einheiten und der Spielumsatz im Vergleichsfenster von 1.139.775 auf 1.424.725 Kredite. Die hohen zusätzlichen Erlöse relativ zu den unmittelbaren Kampagnenkosten verdienen einen Vergleich über mehrere Genres, Marktgrößen und knappe Startbudgets.

Der alternative Lauf ohne Verlagsvorschuss erreichte G3 nach rund 4 h 5 min, G4 am Kontrollpunkt nach 26,63 und G5 nach 26,82 simulierten Tagen. Zwei organische Großtitel finanzierten den Übergang. Laborarbeit finanzierte die Forschung in Zeit und Credits, ein kleiner Release des zweiten Studios genügte für den Standortnachweis. Nach danach fünf Jahren ohne weitere Releases waren vier Studios und zehn Lizenzen erfüllt. Die anderen vier Ziele blieben offen. Das grenzt Investition und Zeitablauf von Wiederverkauf, Serienaufbau und Qualitätsarbeit ab. Die Einzelläufe belegen erreichbare Strategien. Marktwerte, Qualitätskurve und die Abstände der späten Ziele bleiben Kalibrierungsthemen.

### Factory Empire

Zehn manuelle Abbauten mit Verkauf erreichten F2 nach **28 s**. Ein passend ausgerichteter mechanischer Bohrer benötigte **10 s reine Produktionszeit**. Westausrichtung führte nach einem Tag weiterhin zu null Verkäufen. Ein kollidierender Zweifachbau blieb ohne Teilabbuchung. Demontage des frei finanzierten Bohrers erstattete 15 Credits.

Ein eigenes F2-Layout versorgte einen Ofen über ein Band mit 5 statt nominal 10 Erz/s. Gebundenes Eisenerz wurde zu exakt 100 gebundenen Barren im Lager verarbeitet. Ohne Dockanschluss blieben nach zehn Jahren sämtliche Pflichtlieferzähler unverändert. Der geteilte Lauf stimmte mit der Einmalrechnung überein, die zwei Segmente benötigte.

Im abgezweigten, vollständig aufgebauten F5-Stand reduzierte ein stromloser Empfänger in Region 4 die verbundenen Regionen von vier auf drei. Die übrige Produktion lief weiter. Das Abschalten des Modulwerks stoppte neue Module und das Wiederzuschalten stellte die Voraussetzungen wieder her. Die alternative Kupferroute von Region 2 zum Plateau transportierte bei gleicher Ladung mit einem Wagen 50 Stück nach 240 s und 60 nach 360 s. Mit drei Wagen kamen alle 60 nach 240 s an. Eine Pause des Empfängers 1 s vor Ankunft hielt die Fracht einen ganzen Tag zurück und setzte die Fahrt nach Wiederanlauf fort. Der Zusatzaufwand für mehr Wagen lohnt in diesem Test nur bei Ladungen über 50 Stück. Die getesteten Alternativen decken keine beliebige Fabriktopologie ab.

## Desktop, Smartphone und große Stände

Sprachwechsel, Spielwechsel im selben Hub, Speichern per Tastatur beziehungsweise Touch und horizontale Seitengrenzen sind in Chromium geprüft. Die schmale 300-px-Ansicht enthält die Belege für die beiden korrigierten Tableisten:

| Spiel | Desktop 1440 px | Mobil 390 px | Scrollprobe 300 px |
| --- | --- | --- | --- |
| Spielhalle | [Desktop](idle-quality/spielhalle-desktop-de.png) | [Mobil](idle-quality/spielhalle-mobil-de.png) | — |
| Studio | [Desktop](idle-quality/studio-desktop-de.png) | [Mobil](idle-quality/studio-mobil-de.png) | [Forschung](idle-quality/studio-mobil-scroll.png) |
| Factory | [Desktop](idle-quality/factory-desktop-de.png) | [Mobil](idle-quality/factory-mobil-de.png) | [Maschinen](idle-quality/factory-mobil-scroll.png) |

Zusätzlich ausgewertet wurden die vorhandenen P5-Aufnahmen der Spielberichte und die vollständig ausgespielten Endgame-Stände. Auf dem lokalen Rechner lagen die Mediane aus 20 Engine-Aufrufen bei 0,86/0,59 ms für Spielhalle, 0,30/0,40 ms für Studio und 6,40/14,60 ms für Factory, jeweils Ansichtsaufbereitung beziehungsweise 30-Tage-Abrechnung. Die geprüften Snapshot-Größen waren 3.943, 8.364 und 39.134 Bytes. Diese Messung liefert einen Vergleich der konkreten großen Stände. Ladezeiten, Akkulast, mobile Rendering-Budgets und maximale unterstützte Layouts wurden damit noch nicht vermessen.

## Gemeinsamer Speicher- und Kontonachweis

Der [Integrationstest](../test/idle-integration.test.js) startet alle drei Produktivmodule im selben isolierten Serverprozess. Ein Konto erzeugt getrennte Revisionen und Leases. Eine Factory-Tabübernahme ließ die Studio- und Spielhalle-Leases gültig. Ungespeicherte Aktionen verhinderten die Zusammenführung. Nach Neustart mit zehn Jahren Zeitfortschritt und aktivem Nachfolgeschlüssel wurden nur gespeicherte Ausgangszustände abgerechnet. Dateien des zulässigen Vorgängerschlüssels blieben prüfbar. Eine veränderte Signatur, eine Datei des falschen Spiels und ein Import nach Anstieg der Revision wurden jeweils abgewiesen.

Zwei Studio-Stände auf zwei Konten blockierten die Zusammenführung. Das Verknüpfen mit einem leeren Konto machte die drei vorhandenen Stände am neuen Gerät zugänglich. Ein absichtlich beschädigter Factory-Datensatz blieb unverändert und blockierte nur den betroffenen Spielstand. Die Kontolöschung entfernte alle zugehörigen drei Stände und Aliase. Der fremde Studio-Stand blieb erhalten. Die vorhandenen Prestige-Tests und die Factory-Gegenprobe bestätigen, dass eine identische Anforderung keinen zweiten Anspruch erzeugt. Ein zweiter regulärer Endgame-Neustart setzt neue Rekorde voraus. Ein kompletter zweiter Run bis zu neuen Rekorden wurde hier nicht nachgespielt.

### Entscheidungsvorlage für ältere Spielstände

**Empfehlung:** Die Beschränkung auf die aktuelle bestätigte Revision zunächst beibehalten. Falls Wiederherstellung nötig ist, zuerst einen betreibergeführten Vorgang mit überprüfbarer Ledger-Historie freigeben. Eine selbstbediente Ersetzung ist eine getrennte Produktentscheidung.

1. Signatur, aktuellen Schlüsselstatus, kanonisches Konto, Spiel, Schema, frühere Run-ID und bestätigte Quellrevision prüfen. Vorschau zeigt beide Revisionen, Bestand, Verluste und erhaltene Prestigeansprüche. Bestätigung bindet genau diese Vorschau und die unveränderte aktuelle Zielrevision.
2. Unter dem Schreibschutz aus dem aktuellen Ledger eine neue, streng höhere Revision und Run-ID erzeugen. Nur den zulässigen wirtschaftlichen Snapshot übernehmen. Den Abrechnungsanker auf bestätigte monotone Serverzeit setzen. Zwischen alter Dateizeit und Wiederherstellung entsteht keine Gutschrift. Bei rückläufiger Serveruhr wird der Vorgang abgewiesen.
3. Kontoweit bereits verbuchte Prestigeansprüche und ausgezahlte Einmalansprüche zusammen mit einem dauerhaften, zweckgebundenen Wiederholungsbeleg erhalten. Auch künftige Erträge aus bereits abgerechneten Zeit- oder Anspruchsbereichen brauchen einen Nachweis. Falls das jeweilige Spiel dessen Abgrenzung noch nicht liefern kann, den Import verweigern. Persistieren, Leases entwerten und ACK idempotent machen.
4. Ohne nachweisbare letzte Revision, Zeitanker, Anspruchshistorie bzw. geeignete konsistente Betreiber-Sicherung bleibt Recovery gesperrt. Eine gültig signierte Einzeldatei weist deren Integrität nach, jedoch keine vollständige Konto-Historie. Aufbewahrungsdauer, Zugriff und Nachvollziehbarkeit vor Umsetzung entscheiden.

Vor einer Umsetzung prüfen: Doppelklick und Retry nach verlorenem ACK, konkurrierender Save oder Gerätewechsel, Schlüsselrotation, ältere Datei nach Prestige, beschädigtes oder verlorenes Ledger, rückläufige Uhr, keine zweite Gutschrift beim nächsten Save und definierter Abbruch bei einer fehlgeschlagenen Persistenz.

## Menschlicher Playtest und Freigabereife

Die technischen Pfade eignen sich für einen begrenzten internen Playtest mit Testkonten und ausdrücklich aktivierten Spielschaltern. Für eine öffentliche Freigabe sind die Spielzeit, die Attraktivität verschiedener Strategien und die Bedienbarkeit hoher Phasen durch Menschen noch zu bestätigen.

Empfohlen sind sechs Personen mit und ohne Idle-Erfahrung, je zur Hälfte am Desktop und auf einem eigenen Smartphone. In 25 Minuten ohne Einweisung sollen sie in jedem zugeteilten Spiel erste Einnahmen erzielen, einen absichtlichen Engpass diagnostizieren und einen Savepoint finden. Nach zwei bis drei echten Tagen öffnen sie den unveränderten Testaccount erneut und erklären den Offline-Fortschritt. In einem getrennten späten Stand wählen sie eine Filiale, ein Projekt oder eine Fabrikroute und begründen ihre Entscheidung. Erfassen sollte man Zeit bis zur ersten sinnvollen Aktion, korrekt erkannte Engpässe, unbeabsichtigte Fehlkäufe, Sichtbarkeit der nächsten Ziele, Beweggründe für oder gegen Prestige und den Wunsch nach einer weiteren Sitzung. Spielspaß, wahrgenommener Zeitdruck und Fairness brauchen diese Beobachtungen.

Reproduktion:

```sh
node --test test/idle-quality.test.js test/idle-engine.test.js test/idle-savepoints.test.js test/idle-integration.test.js test/spielhalle.test.js test/studio.test.js test/factory.test.js
npx playwright test test/ui/idle-quality.spec.js test/ui/spielhalle.spec.js test/ui/studio.spec.js test/ui/factory.spec.js test/ui/nav-visibility.spec.js
npm run test:fast
```

Mit `IDLE_QA_SCREENSHOTS=docs/idle-quality` schreibt der neue Browser-Test die Acht-Bilder-Serie neu. Die Dokumentation enthält keine Zugangsdaten oder Testspielstände.

Gezielt bestanden 51 Node- und 48 Browserfälle. Zwei Browserfälle prüfen ausschließlich die schmale Tableiste und sind im Desktop-Projekt entsprechend ausgelassen.
