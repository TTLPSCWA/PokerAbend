# Scotland Yard – visuelles Pilot-Redesign

Stand: 31.10.2026. Auftrag: ausschließlich Scotland Yard visuell implementieren; die anderen Spiele anschließend individuell planen. Ausgangspunkt: `bea4e0d`. Visuelle Paket-ID: `VIS-001`.

## Umgesetzt

- Eigenständige Ermittlungszentrale in dunklem Blau und Anthrazit, mit warmen Papier-/Brauntönen, feinen Messingkanten und zurückhaltenden Glasflächen.
- Vollständig gestaltete Lobby mit einer illustrierten Ermittlungsakte, Stadtkarte, verständlichem Warte-/Bereitstatus, Teamübersicht, Anzeige der gewählten Mr.-X-Rolle und Zugang zur bestehenden Host-Rollenwahl. Die Regeln werden in drei kurzen Hinweisen erklärt.
- Originales lokales SVG-Stadtmaterial: Altburg, Parkviertel, Museumsufer, Osthafen, Westend und Südstadt, mit Fluss Aure, Parkanlagen, Häuserblöcken, Brücken, Museum, Bahnhofstürmen, Kuppel und Hafenkran. Keine offiziellen Grafiken oder fremden Stadtplandaten.
- Eigene unregelmäßige Darstellungskoordinaten für alle 49 nummerierten Stationen. Die gültigen Verkehrsverbindungen werden ausschließlich aus den vorhandenen Server-Kanten gezeichnet. Diese Kanten bleiben unverändert; Darstellung und Regelgraph sind getrennt.
- Gekrümmte Verkehrslinien mit unterscheidbaren Farben, Strichmustern und Icons: Taxi, Bus, U-Bahn und Fähre. Dekorative Straßen sind schmal, hell und ohne Verkehrslinienfarbe.
- Fünf nummerierte Ermittlerfarben mit Zuordnung zu Spielern, eigener Mr.-X-Marker, gestrichelte letzte öffentliche Sichtung und deutliche legale Reiseziele. Farben werden durch Nummern, Namen und Symbole ergänzt.
- Ermittlungsprotokoll mit Zugnummern, Ticket-Icons, Doppelzugkennzeichnung und öffentlichen Sichtungen; separate öffentliche Spur und persönlicher Ticketvorrat.
- Fahrkartensteuerung mit Ticketanzahl, ausgewähltem Verkehrsmittel, eindeutigen Black-/Doppeltickets und mindestens 44 Pixel großen alternativen Zielknöpfen. Tastaturfokus und horizontale Fahrkartenscrollposition bleiben beim lokalen Neuzeichnen erhalten.
- Gestaltete Warteansicht und Abschlussakte mit unterscheidbarer persönlicher Sieg-/Niederlagenmeldung. Vorhandene Punkte- und Ergebnisanzeige bleibt erhalten.
- Deutsche und englische neue Bedienoberfläche; keine neue Übersetzungslogik für freie Spielernamen.

## Dateien und gemeinsame Integration

- `public/games/scotland-yard/scotland-yard.js`: Lobby, Stadtplan, Marker, Ticketsteuerung, Protokoll, Ergebniszusatz und persönliche Ansichten.
- `public/games/scotland-yard/scotland-yard.css`: ausschließlich auf Scotland Yard bzw. seine `sy-`-Komponenten begrenzte Styles, einschließlich Tablet, Handy und Querformat.
- `public/games/scotland-yard/city-board.svg`: selbst gezeichnetes lokales Stadtmaterial, für diesen Auftrag erstellt; keine externen Bildanfragen und keine zusätzlichen Bibliotheken.
- `public/games/kit.js`: ein optionaler `lobby(S)`-Haken. Ohne diesen Haken wird exakt die bisherige gemeinsame Lobby verwendet. Nur Scotland Yard verwendet ihn in diesem Auftrag.
- `test/scotland-visual.test.js`: zusätzliche Darstellungs-, Sicherheits- und Sprachregressionen.
- `test/ui/scotland-visual.spec.js`: isolierte echte Räume mit Mr. X, zwei Detektiven und Zuschauer; Screenshot- und Zustandsprüfung.

Keine Änderungen an `games/scotland-yard/map.js`, `room.js` oder `index.js`. Zugmöglichkeiten, Stationsnummern, Tickets, Doppelzüge, Siegbedingungen, Bots, Rollenrechte, Pause, Reconnect, Ergebnisse und Bestenlisten benutzen die bisherigen Funktionen. Andere Spiele erhalten kein neues CSS, Frontend oder Bildmaterial.

## Geheimhaltung

Das Frontend verwendet nur `S.g` aus der persönlichen Serveransicht. Eine geheime Position wird nur dann als Marker, eigener Standort oder Ausgangspunkt eigener Verbindungen gerendert, wenn der Server sie diesem Betrachter liefert. Zuschauer und Detektive sehen ausschließlich freigegebene Sichtungen und das Spielende.

Die Hintergrundgrafik und die Verkehrsgeometrie sind statisch. Sie werden niemals aus einer geheimen Position erzeugt. Die anfängliche Kartenzentrierung benutzt bei Detektiven deren eigene öffentliche Station, bei Mr. X dessen persönliche Station und bei Zuschauern einen festen Kartenmittelpunkt. Es gibt keine Animation zu einer verdeckten Mr.-X-Position.

Regressionen vergleichen das vollständige erzeugte HTML für alternative verdeckte Positionen und Ticketvorräte. Außerdem werden Marker bei öffentlicher Sichtung/Spielende und das Escaping von Namen in Spielerlisten sowie Stationsbeschriftungen geprüft.

## Bildschirmgrößen und Bildnachweise

Geprüft: **1920×1080, 1440×900, 768×1024, 390×844, 360×800, 900×450**. Die Nachprüfung umfasst zusätzlich echte mobile Browseremulation. Die Karte lässt sich in beiden Richtungen verschieben. Die Seite selbst läuft horizontal nicht über; Aktionen bleiben im Dock erreichbar. Reiseprotokoll und Team sind bei Platzmangel im normalen Hauptbereich scrollbar. Auf kleinen Handys steht die öffentliche Spur vor der Karte.

Aufnahmen vor der Implementierung: `artifacts/scotland-redesign/before/` – 46 Bilder. Nach der ersten Nachbesserung: `artifacts/scotland-redesign/after/` – 48 Bilder. Die reproduzierbare abschließende Aufnahme legt pro Browserprojekt einen eigenen Unterordner an, um Überschreiben zu vermeiden.

Erfasste Zustände: Lobby mit fehlenden Spielern, bereite Lobby mit Rollenanzeige, aktiver Mr. X, wartender/aktiver Detektiv, Zuschauer, Black-Ticket, Doppelzug, öffentliche Sichtung und Protokoll, gemeinsame Pause, Englisch, Reconnect, Ermittlersieg und Mr.-X-Niederlage. Die detaillierten Zustände sind auf Desktop 1440×900 und Handy 390×844 aufgenommen, die Kernzustände auf allen sechs Größen. Eine zusätzliche Protokoll-Nahaufnahme macht den Verlauf auch auf dem Handy überprüfbar.

Ausgewählte dauerhafte Vergleiche unter `docs/design/screenshots/scotland-yard/`:

| Ansicht | Vorher | Nachher |
| --- | --- | --- |
| Lobby, 1440×900 | [Vorher](screenshots/scotland-yard/before-lobby-desktop.png) | [Nachher](screenshots/scotland-yard/after-lobby-desktop.png) |
| Mr. X, 1440×900 | [Vorher](screenshots/scotland-yard/before-map-desktop.png) | [Nachher](screenshots/scotland-yard/after-map-desktop.png) |
| Aktiver Detektiv, 390×844 | [Vorher](screenshots/scotland-yard/before-detective-mobile.png) | [Nachher](screenshots/scotland-yard/after-detective-mobile.png) |

Das versionierte `scotland-yard-screenshots.json` listet die aufgenommenen Dateien mit Prüfsummen auf. Die sechs ausgewählten PNGs sind dauerhaft im Repository; vollständige lokale Testartefakte bleiben unversioniert. Sie entstehen mit:

```powershell
$env:SCOTLAND_CAPTURE='after'
node node_modules/@playwright/test/cli.js test test/ui/scotland-visual.spec.js --workers=2
```

## Sichtprüfung und Nachbesserungen

Die erste Umsetzung wurde anhand echter Screenshots geprüft. Nachgebessert wurden die Platzierung öffentlicher Hinweise auf dem Handy, Erhaltung der Fahrkartenscrollposition und des Tastaturfokus sowie ein zunächst mehrdeutiger Testzugriff auf das Host-Menü. Die neue Rollen-Schaltfläche delegiert jetzt über eine eigene Spielaktion an das vorhandene Host-Menü. Das Ergebnis bleibt für andere Spiele unverändert.

Die Karte bleibt auf schmalen Geräten bewusst verschiebbar, damit Stationen mindestens 44 Pixel groß bleiben. Es gibt keinen neuen Zoommodus, keine 3D-Darstellung und keine neue Spielmechanik.

## Tatsächliche Prüfungen des Pilotstands

- Vorher-Aufnahme: **6 Browserprüfungen bestanden**, 37,0 Sekunden.
- Erster UI-Durchlauf: **8 bestanden, 1 fehlgeschlagen**. Ursache: der Test sprach zwei Host-Schaltflächen gleichzeitig an. Nach der oben beschriebenen Korrektur erneut geprüft.
- Nachgebesserter UI-Durchlauf: **18 bestanden, 0 fehlgeschlagen**, 1,4 Minuten. Enthält Scotland-Yard-Zustände und Größen auf Desktop/Mobil sowie die bestehenden Scotland-Yard-, Hex- und Würfelduell-Tests. Protokoll: `artifacts/scotland-refined.log`.
- Engine und neue HTML-Geheimhaltungsprüfungen: **27 bestanden, 0 fehlgeschlagen**; einschließlich der bestehenden 92 vollständigen Botpartien. Protokoll: `artifacts/scotland-privacy.log`.
- Vollständiger Node-Gesamtlauf: **861 bestanden, 0 fehlgeschlagen**, 50,3 Sekunden. Protokoll: `artifacts/scotland-all-node.log`.
- Abschließende Screenshotprüfung in getrennten Projektordnern: **12 bestanden, 0 fehlgeschlagen**, 54,0 Sekunden. Protokoll: `artifacts/scotland-final-captures.log`; 48 Aufnahmen je Projekt unter `artifacts/scotland-redesign/after/desktop/` und `after/mobil/`.
- Gemeinsame Browser-Regressionen werden nach Abschluss ebenfalls dokumentiert. Der Pilotstatus in der zentralen Designplanung wird mit diesen geprüften Nachweisen und einer echten Implementierungs-Commitreferenz als `done` eingetragen.

## Veröffentlichung

Direkt auf `main`, keine Branches/PRs und kein Force-Push. Der bekannte Workflow `.github/workflows/docker.yml` führt Tests und GHCR-Veröffentlichung aus. In den geprüften Compose-Dateien und im bekannten Workflow gibt es keinen automatischen Produktivdeploy bzw. Watchtower-Konfiguration. Externe, außerhalb dieses Repositorys eingerichtete Automatik lässt sich daraus nicht ausschließen; es ist keine solche Automatik bekannt. Kein manuelles Produktivdeployment.
