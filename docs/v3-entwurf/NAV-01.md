# NAV-01 · Persönliche Anzeige

**Finalisierte Planung, Stand 20.11.2026.** N3 ist verbindlich. Umsetzung separat freigeben. Istbasis ist PokerAbend 3.17.0 bei Commit `c3d3cd6`.

### Istzustand

- `hub.hiddenCategories`, `hub.hiddenBlocks` und `hub.defaultFilter` existieren bereits in Client und Server. Lokaler Zustand, Kontosynchronisierung, `updatedAt`, Reset und Teiländerungen sind vorhanden. Die erlaubten Werte stehen doppelt in Client-/Serverlisten. Eine ungültige Kategorie kann heute bei der Sanitization eine komplette Liste auf Standard zurücksetzen. Neue Schlüssel brauchen kompatible Normalisierung und eine getestete Aktualisierungsreihenfolge. [Client-Einstellungen](../../public/settings.js#L8) · [Server-Einstellungen](../../server/settings.js) · [Einstellungs-API](../../server/settings-api.js#L22) · [Bestandstest](../../test/settings.test.js#L42)
- Die Seitenleiste filtert Kategorien. Der Bibliotheksfilter lässt ein explizit angewähltes, verstecktes Kategorie-Hash als Ausnahme zu. Die Mobilnavigation hat eine eigenständige Tab-Liste und nutzt im Mehr-Dialog die Seitenleistendarstellung. Der Startseiten-Block mit Abendplanung und Rückblick verwendet die Blockfilter aktuell nicht. `allGames()` filtert künftige „Bald“-Karten separat. Das geplante Angebot ist an der Prüfbasis leer. [Bibliothek und Navigation](../../public/hub.js#L99) · [Mobil und Routen](../../public/hub.js#L149) · [Startseite](../../public/hub.js#L267) · [Bald-Karten](../../public/hub.js#L289)
- 95 Mehrspieler- und 12 Einzelspieler-IDs. Bestehende Kategorien sind `karten`, `wuerfel`, `brett`, `party` und `einzelspieler`. Es gibt keine im produktiven Spielregister belegte Idle-Kategorie. Direkte Einzelspieler- und Tisch-Links nutzen bestehende Hash- und `?t=`-Routen. [Spielregister](../../games/index.js) · [Direkteinstiege](../../public/core.js#L304)

### Zielzustand und Umsetzungsstrategie

1. Eine gemeinsame Sichtbarkeitsentscheidung für Desktop, Mobil-Tabs und Mehr-Menü, Bibliothek, Startseite einschließlich Karten, Kategorie-Chips, Favoriten-/Zuletzt-gespielt-Vorschau und Abend-Links. Gleiche Kategorie-/Block-ID in jeder Darstellung. Leere Container und falsche Zähler entfallen. Die verfügbaren Spiele bleiben im Registry-/Host-Modell vollständig. Der Kategoriefilter in Host-Auswahl und Suche wirkt nur auf Einstiege und Listen. Bei direktem gültigem Tisch- bzw. Spielaufruf greifen weiterhin die Spielregeln und die bestehende Freischaltung.
2. Die bestehende Einstellung verwenden. Erlaubte Kategorien aus der registrierten, für den Hub verfügbaren Liste beziehen, dazu stabil zugeordnete Labels. Idle erst einblenden, wenn tatsächlich eine spielbare registrierte Idle-Kategorie gemeldet wird. Hub-Blöcke mit stabilen Keys erweitern, beispielsweise ein von der bestehenden Favoriten-Startseitenfläche getrenntes Merkmal für den Reiter. Beim Hinzufügen eines erlaubten Werts bestehende gültige Ausblendungen erhalten. Offene Tische und Einstellungen bleiben als Rückkehr-/Spielzugang erreichbar. Eine optionale Ausblendung ihres dekorativen Einstiegs bedarf eines sichtbaren Ersatzwegs.
3. Berechtigungen vor persönlichen Filtern anwenden. Im aktivierten Exklusivmodus blendet N3 geschützte Bereiche für Gäste in Desktop-Seitenleiste, Mobil-Tabs und Mehr-Menü aus. Die Regel umfasst auch Startseiten-Einstiege. Die serverseitige Capability aus AUTH-01 bestimmt, ob Inhalte angezeigt und geladen werden. `hiddenCategories` und `hiddenBlocks` werden weiterhin aus lokalen und serverseitigen Einstellungen zusammengesetzt. Direkte Links auf persönlich ausgeblendete optionale Seiten bleiben nutzbar. Ein Direkteinstieg in einen Discord-Bereich zeigt Gästen einen verständlichen Hinweis mit Anmeldeoption und erhält das interne Rücksprungziel. Ist Login fehlerhaft konfiguriert, zeigt die Seite stattdessen die Konfigurationsmeldung. Der Server verweigert unzulässige API- und Exportaufrufe unabhängig von Anzeigezuständen. Das Ausblenden einer Kategorie pausiert oder beendet keinen Raum und verändert keine Favoriten oder gespeicherte Auswahl.
4. Einstellungen selbst bleiben erreichbar. Änderung wirkt unmittelbar auf die sichtbaren Einstiege, behandelt passenden Fokus, Dialog- und Leerzustand und synchronisiert mit dem bestehenden Konto. Abgelaufene Sitzungen oder Kontoänderungen dürfen keinen alten Berechtigungszustand im Hub reaktivieren. Diese UI-Schicht kann auf read-only Testdaten entwickelt werden, gemeinsame Integration nach Freigabe von AUTH-01.

### Dateien, Abhängigkeiten, Aufwand und Abnahme

**Dateien.** `public/settings.js`, `hub.js`, `core.js`, `index.html`, Hub- und Mobilstil, i18n, `server/settings.js`, `settings-api.js` und die Bootstrap-Kategorieinformationen. Tests in `test/settings.test.js`, `test/ui/settings.spec.js` und bestehenden mobilen Smoke-/Deep-Link-/Reconnect-Fällen.

**Abhängigkeiten und Aufwand.** Mittel, ungefähr 2–4 Entwicklungstage. Die aktuelle Einstellungssynchronisierung ist Grundlage. Die Anzeigeänderung kann getrennt vorbereitet werden. AUTH-01 liefert Modus, Capability und Fehlercodes für die integrierte Abnahme. Fehlende oder veraltete Client-Capability führt im aktiven Modus zu keiner Datenabfrage. Hauptgefahren sind uneinheitliche Doppel-Listen, Browser-Caches bei Konto-Wechsel, unerreichbare Wiederherstellung der Einstellungen und History-Regressionen bei Raumlinks.

**Abnahme.** Jede der fünf vorhandenen Kategorien und jeder schaltbare Hub-Block ist konsistent in Desktop, Mobil, Bibliothek und Startseite ausgeblendet. Der Wert bleibt nach Reload, Synchronisierung auf ein verbundenes Gerät und bestehendem Offline/Online-Wechsel erhalten. Ein gültiger direkter Spiel-/Tischlink funktioniert im Rahmen der normalen Spielberechtigung. Eine Veränderung von Anzeigeprofilen erteilt Gästen keinen Zugriff auf Ticket-, Planungs- oder Ranglistendaten. Keine künstliche Idle-Kategorie vor deren Registrierung.

## Nachtrag 20.11.2026 (Stand Version 3.18.0)

Der obige Text ist der Planungsstand bei `c3d3cd6`. „Umsetzung separat freigeben“ ist erfüllt: NAV-01 wurde freigegeben, in Version 3.18.0 umgesetzt (Commit `0f14e19`) und mit grünem Push-Lauf #229 und grünem Volllauf #230 abgenommen. Produktiv bereitgestellt ist er laut Healthcheck noch nicht.

**Umgesetzt:** eine gemeinsame Sichtbarkeitsregel für Seitenleiste, Mobil-Tabs, Mobil-Menü, Kategorie-Chips, Zähler und Startseite; neue Schalter für „Offene Tische“ (`tables`) und „Favoriten“ (Reiter und Startseite); der Block „Eure Spieleabende“ folgt den Schaltern „Abend planen“ und „Rückblicke“; Leerzustand mit Hinweis, wenn alle Kategorien ausgeblendet sind; Kategorie `idle` erst bei einem registrierten Idle-Spiel; Direktlinks bleiben nutzbar.

**Abweichungen und Entscheidungen gegenüber dem Plan:**

- Die erlaubten Kategorien kommen weiterhin aus statischen Client- und Serverlisten (jetzt mit `idle`); ein Test vergleicht beide. Die Sichtbarkeit von Idle hängt an der Registrierung, nicht an der Liste.
- Entscheidung des Projektinhabers: Die Auswahl unter „Tisch erstellen“ bietet weiterhin alle Spiele an, auch aus ausgeblendeten Kategorien. Das ersetzt die Planaussage, der Kategoriefilter wirke auch auf die Host-Auswahl.
- Neue Einstellungs-IDs (`tables`, `idle`) werden von älteren Servern abgewiesen. Server und Seite gemeinsam aus- und zurückrollen; siehe `docs/betrieb.md`.
- Der historische Nachweis zu `public/hub.js` (V2-13/14) liegt jetzt als archivierte Datei vor; die Prüfung nutzt dafür zusätzlich den aktuellen Hash.

**Nicht erfüllt oder nicht automatisiert geprüft (Folgeaufgaben):**

- N03 (Exklusivmodus, Gast, Direktlink mit Anmeldeoption) bleibt von AUTH-01 abhängig und ist nicht umgesetzt.
- N02: Entfernen eines Favoriten per Stern, Reconnect an einem laufenden Tisch und zweite Browserinstanz für Favoriten (Favoriten liegen nur im lokalen Browserspeicher).
- N06: ein geöffnetes Mobil-Menü per Tastatur, Fokus nach Filteränderung im Menü, Überlaufen im Englischen mit allen Schaltern.
- Ein Idle-Spiel unter den Mehrspieler-Spielen (die Tests simulieren ein Solo-Spiel).
- Zwei bekannte Lastflakes in bestehenden Tests, nicht durch NAV-01 verursacht (siehe Nachtrag in [QA-CI-01](QA-CI-01.md)).
