# Gemeinsame Idle-Engine

IDLE-ENGINE-01 ist das technische Fundament in PokerAbend 3.21.0. Entwicklungsbasis war Version 3.20.2 auf Commit `9a796fcca08eec79f08da63857eca7ab06ade378`.
Version 3.22.0 integriert Kontoauflösung, HTTP, Datenträger und Schlüsselrotation als IDLE-01A und IDLE-01B. Der Abgleich erfolgte gegen 3.21.0 auf Commit `6a2dda21d05fe2bb9f0d72ddc5f7aff72e59e7d3`.
Die Phasenkonfiguration folgt den bestätigten Fachregeln von IDLE-D00. IDLE-D03 dient als Entwurf für die spätere Oberfläche. Die Zahlen aus IDLE-D04.1 sind Vergleichswerte für Balancing und Tests.

## Module und Schnittstellen

| Datei | Verantwortung |
| --- | --- |
| [public/idle/engine.js](../public/idle/engine.js) | Reine Engine für Zeit, Ressourcen, Produktionszyklen, Preise, Upgrades, Automatisierung und Phasen. Läuft als ES-Modul ohne Node- oder DOM-Abhängigkeiten. |
| [public/idle/progression.js](../public/idle/progression.js) | Fünf Phasen pro Spiel mit messbaren Eintrittsbedingungen, Freischaltungen, Ressourcen, Engpässen, Automatisierung und Abschlusszielen. |
| [server/idle/savepoints.js](../server/idle/savepoints.js) | Autoritative Sitzungen, Tab-Übernahme, Savepoints, revisionsgebundene Kommandos, Importvorschau und lokaler Dateiadapter. |
| [server/idle/exports.js](../server/idle/exports.js) | Versionierte und auf Konto und Spiel gebundene HMAC-Exporte, kanonisches JSON und Prüfsummen. |
| [server/idle/api.js](../server/idle/api.js) und [runtime.js](../server/idle/runtime.js) | API-Vertrag, Fehlercodes, konfigurierter Schlüsselring und Kontolebenszyklus. |
| [server/idle/storage.js](../server/idle/storage.js) und [registry.js](../server/idle/registry.js) | Exklusiver Einprozessbetrieb mit Konto-Aliasen und ausdrückliche Spielregistrierung. |

`createIdleEngine(module, phases)` stellt `create`, `validate`, `advance`, `view`, `command` und `migrate` bereit. Das Modul definiert Spiel-ID, Zustands- und Regelversion, Startzustand, Validierung, Fakten, Kommandos und Zeitsegmente. Die Fakten für Eintrittsbedingungen und Forschung stammen aus dem autoritativen Spielzustand. HTTP verwendet die vorhandene serverseitige Identität. Die Spiel-Allowlist kommt aus der Idle-Registry.

Für die Ansicht liefern `view` und optionale Modulmethoden Fortschritt je Ziel, kumulative Freischaltungen, verfügbare Automatisierung und Engpassgründe. Der Browser kann dieses Darstellungsmodell verwenden. Guthaben, Freischaltungen und Save-Rechte entscheidet der Server. Ein Spielmodul kann zusätzlich eigene Besitz-, Qualitäts- und Kapazitätsbedingungen erzwingen. Automatisierung prüft Freischaltung, ausdrückliche Aktivierung und Budget. Forschung schaltet die Studio-Testpipeline und die Release-Regeln individuell frei.

## Zeit und Wirtschaft

- Zeitanker sind UTC-Millisekunden. Sommer- und Winterzeit ändern das berechnete Intervall nicht. Ein Zeitpunkt vor dem Anker löst `clock-regressed` aus. Eine monotone Uhr steuert die Schreib-Lease unabhängig von der Spielzeit.
- Werte liegen als Dezimalstrings mit bis zu 80 Stellen vor. `BigInt` hält Mengen, Kosten und ganzzahlige Untereinheiten exakt. Spielmodule legen Einheiten und Darstellungsskalen fest. Eine Transaktion prüft Eingaben, Deckung und Lagergrenzen und übernimmt sie als Ganzes. Eine Ausgabe kann sich durch ihren eigenen Ertrag nicht vorfinanzieren.
- Ein Simulationssegment umfasst das Zeitintervall bis zur nächsten fachlichen Grenze oder bis zum Zielzeitpunkt. Bei einem Kommando gilt die bis zu diesem Zeitpunkt fällige Produktion zuerst. Ein Modul muss eigene gleichzeitige Ereignisse in stabiler Reihenfolge verarbeiten und an seinen Regelgrenzen segmentieren.
- `produceBatches` aggregiert unabhängige Zyklen ohne Schleife pro Takt. Es behält den begonnenen Takt in Millisekunden und begrenzt die Zahl fertiger Zyklen anhand von Eingaben, Lager und verfügbarer Absatzmenge. Ausgefallene Zyklen werden später nicht nachgezahlt. Mehrstufige Netze, konkurrierende Eingänge und andere dynamische Regeln liegen beim jeweiligen Spielmodul.
- Es gibt kein pauschales Offline-Zeitlimit. Das Ergebnis enthält Anker, Zielzeit und Segmentzahl. Standardmäßig begrenzt die Engine einen Aufruf auf 10.000 Segmente. Ungültige Segmente, Rückwärtszeit oder eine Überschreitung liefern einen Fehler ohne Teilergebnis. Vor der öffentlichen Nutzung müssen die echten Spielmodule lange Intervalle durch Aggregation nachweislich innerhalb des Rechenbudgets verarbeiten.

## Phasen und Spielmodule

| Spiel | Phasen | Fortschritt und Modulaufgaben |
| --- | --- | --- |
| Die Spielhalle | `SH-P1` bis `SH-P5` | Autogeber und bediente Gäste, Stationstypen und Run-Umsatz, kumulierter Casino-Umsatz und Ruf, zwei betriebene Standorte plus Filialforschung. Das Spielmodul berechnet Gästezuweisung, Personal, Standby und Wiederanlauf. Eine betriebene Filiale muss Gäste bedienen und ein nichtnegatives Ergebnis erzielen. |
| Game Studio Tycoon | `GS-P1` bis `GS-P5` | Releases und Fans, Wertung und Marketingforschung, Verkaufsumsatz und Mitarbeiterzahl, Engine III und Releases aus zwei Studios. Das Spielmodul verantwortet Projektbudgets, QA, Releases und endliche Märkte. |
| Factory Empire | `FE-P1` bis `FE-P5` | Erzverkauf, zwei Güterflüsse mit Banddiagnose, Motorenauftrag und Stromforschung, interregionale Lieferungen und Industrieforschung. Rezepte, Strom, Pflichtreserven, Produktionsgraph und Rettungspfade gehören zum Spielmodul. |

Die Engine wertet die Übergänge der Reihe nach aus und zeigt am Ende die jeweiligen Abschlussziele. Die Tests prüfen alle zwölf Übergänge anhand kontrollierter Zustandsfakten und zusätzlich über reguläre Spielaktionen. Die drei Spielmodule bieten freiwilliges und gedeckeltes Prestige mit atomarem Neustart und Anspruchsregister.

## Speichern, Wiederaufnahme und Import

- Konto und Spiel haben genau einen aktuellen bestätigten Datensatz. `open` und `view` berechnen Offline-Fortschritt ohne Schreibzugriff. `command` verändert nur den flüchtigen Stand. `save` und `saveAndExport` bestätigen einen neuen Zeitanker und eine neue Revision per Compare-and-Set. Nach Prozessneustart wird ab dem letzten bestätigten Stand gerechnet. Ungespeicherte Aktionen verfallen.
- Ein weiterer Tab sieht den Stand lesend. Explizite Übernahme ab der bestätigten Revision tauscht den Schreib-Token aus und verwirft ungespeicherte Aktionen der alten Sitzung. Die Lease läuft regulär nach fünf Minuten ab und ist erneuerbar. Commands halten die jüngsten 128 Anfragebelege innerhalb der Sitzung. Der letzte erfolgreiche Save enthält die persistente Anfrage-ID und ihren Digest für einen verlorenen ACK. Ein alter Schreib-Token oder eine obsolet gewordene Revision darf nichts überschreiben.
- Beide Save-Pfade prüfen die Exportierbarkeit vor dem Schreibvorgang. Der kanonische Nutzinhalt ist auf 256 KiB begrenzt. `saveAndExport` gibt den signierten Spielstand direkt zurück, `exportConfirmed` exportiert die aktuell bestätigte Revision. Der Export enthält Spiel-ID, Run-ID, Revision, Zeitanker, Zustands- und Regelversion und eine HMAC-Kontobindung. Er enthält weder den Schreib-Token noch die rohe Konto-ID. Die Signatur schützt die Integrität. Das Format ist lesbar und enthält Spielstandsdaten. Die HMAC-Schlüssel gehören in eine spätere serverseitige Konfiguration mit definierter Rotation.
- `previewImport` prüft Signatur, Schlüssel, Konto, Spiel, Version, Zeit und den bestätigten Datensatz. Eine kurzlebige Bestätigung bindet die Vorschau an den Inhalt des Datensatzes und die flüchtige Sitzungsrevision. Der bekannte aktuelle Stand kann die Sitzung neu aufbauen. Die Bestätigung ist idempotent und verbucht nichts dauerhaft. Ältere Revisionen oder eine Datei ohne bestätigten Datensatz werden abgelehnt. Neuaufsetzen und Wiederherstellung ohne vorhandenen Datensatz brauchen eine gesonderte Regel.
- Historische Schemen brauchen eine registrierte Prüfung und eine explizite Migration. Die Migration arbeitet auf einer Kopie und behält den Zeitanker. Erst ein manueller Save schreibt den migrierten Zustand. Unbekannte oder beschädigte Formate bleiben unangetastet.

Vor der Umsetzung der Speicheroberfläche ist zu klären, wann sie für die bereits aktive Revision einen Hinweis zeigt und wann sie das erneute Laden zur Rücknahme ungespeicherter Aktionen anbietet. Der Service unterstützt das in der technischen Planung vorgesehene erneute Laden eines bekannten aktuellen Stands.

## HTTP und Konten

Endpunkte unter `/api/idle` werden erst mit einem ausdrücklich im Servercode registrierten und in der Betriebsumgebung freigegebenen Modul bereitgestellt. Registrierbar sind `spielhalle` seit 3.23.0, `studio` seit 3.24.0 und `factory` seit 3.25.0. Die drei Schalter sind unabhängig und standardmäßig aus. Die isolierten Infrastrukturtests registrieren ihr synthetisches Modul ausschließlich im Testprozess.

Es gelten der vorhandene Seitenzugang und ein gültiges Gast-Cookie für ein bereits bestehendes Konto. Das gilt auch für ein mit Discord verknüpftes Konto. Die API ermittelt die kanonische ID aus dem Cookie und akzeptiert keine Konto-ID vom Client. Schreibanfragen benötigen JSON, den Header `X-Requested-With: spieleabend` und eine Prüfung des aufrufenden Ursprungs. API-Antworten setzen `Cache-Control: no-store`. Anfragegröße und -häufigkeit sind begrenzt.

| Methode und Pfad | Wirkung |
| --- | --- |
| `GET /` und `GET /:gameId` | Nutzbare Spiel-IDs und flüchtige Vorschau des bestätigten Savepoints. Optionaler Header `X-Idle-Token` liefert die eigene aktive Schreibansicht. |
| `POST /:gameId/session`, `POST /:gameId/session/heartbeat` | Schreibsitzung öffnen oder bestehende Sitzung lesend anzeigen. Der Heartbeat verlängert die Lease des Schreibers im Speicher. |
| `POST /:gameId/takeover` | Tab-Übernahme mit `confirm: true`, Session-ID, Sitzungs- und Datensatzrevision. Bei veränderter Sitzung ist eine neue Prüfung nötig. |
| `POST /:gameId/actions`, `POST /:gameId/save` | Autoritative Aktion oder manueller Save mit Schreib-Token, Sitzungs- und Datensatzrevision und Anfragen-ID. |
| `GET /:gameId/export`, `POST /:gameId/export` | Aktuellen bestätigten Stand herunterladen oder ausdrücklich speichern und genau diese Revision exportieren. |
| `POST /:gameId/import/preview`, `POST /:gameId/import/confirm` | Datei serverseitig prüfen und nur nach `confirm: true` neu laden. Die Datei muss zum aktuellen bestätigten Datensatz passen. |
| `POST /:gameId/prestige` | Spielabhängiger, freiwilliger Neustart. Schreibt nach Bestätigung der aktuellen Rekordliste einen neuen Lauf und eine neue Revision in einer Transaktion. |

Fehler enthalten `code` und eine verständliche Meldung. Wichtige Zustände sind `401 invalid-account`, `404 wrong-game`, `409 lease-conflict`, `409 session-conflict`, `409 revision-conflict`, `409 no-ledger`, `413 payload-too-large` und `503 idle-unavailable`. Eine ältere Datei liefert einen Revisionskonflikt mit dem Hinweis, dass nur der aktuell bestätigte Stand importiert werden kann.

Der gemeinsame Konto-Store prüft Gerätecode, Discord und Administration vor einer Zusammenführung. Falls beide Konten für dasselbe Spiel einen Stand besitzen, antwortet die Operation mit Konflikt und erhält beide Datensätze. Ungespeicherte Aktionen blockieren die Zusammenführung bis zur Speicherung, zum ausdrücklich bestätigten Verwerfen oder Lease-Ablauf. Gibt es pro Spiel nur einen Stand, bleibt er an seinem Speicherpfad. Die vor Bestätigung persistent geschriebene Konto-Aliasbeziehung macht ihn für das verbundene Konto zugänglich. Alte Schreibsitzungen verfallen. Ein neuer Export bindet sich an das kanonische Konto.

Der personenbezogene Kontoexport enthält die bestätigten Idle-Spielstände des eigenen Kontos und seiner Aliase. Die bestätigte Kontolöschung entwertet aktive Sitzungen und entfernt diese Stände und zugehörige temporäre Dateien. Schlägt ein Löschschritt fehl, kann die Operation wiederholt werden. Bereits gelöschte Dateien werden bei Wiederholung übersprungen. Die Verantwortlichkeit für ältere Sicherungskopien liegt bei den Aufbewahrungs- und Löschfristen des Betreibers.

## Vertragsstand für Snapshots, HTTP und Dateien

Die Beispiele gelten für die drei registrierbaren Spielmodule mit `stateVersion: 1` und `rulesVersion: 1`. Die beiden Versionsnummern werden unabhängig vom persistenten Dateiformat und der Transporthülle geprüft. Änderungen am Spielzustand oder an fachlichen Regeln benötigen eine ausdrückliche Entscheidung über Versionswechsel und Kompatibilität. Die Anwendungsversion aus `package.json` ersetzt diese Prüfungen nicht.

| Ebene | Form und Version |
| --- | --- |
| Engine-Snapshot | Genau sechs Felder. `gameId`, `stateVersion`, `rulesVersion`, `at`, `phase` und `data`. Die Spiel-ID und die beiden Versionen müssen zum Modul passen. `at` ist UTC in Millisekunden, `phase` muss im Modul definiert sein und `data` folgt dessen Validator. |
| HTTP | Die Pfade, Feldschemas und Fehlercodes sind in [api.js](../server/idle/api.js) definiert. Spielzustands- und Dateiversion werden nicht über einen vom Browser angegebenen HTTP-Vertragswert gewählt. Schreibanfragen enthalten weder einen Snapshot noch einen Zeitanker. |
| Bestätigter Datensatz | `format: 1`, `revision`, `runId`, `snapshot` und `operation`. Die Kopie auf dem Server enthält im letzten Anfragebeleg eine ID, einen Digest und bei neuen Saves die Signaturkennung. Der Signaturschlüssel liegt außerhalb der Datei. |
| Signierte Datei | `keyId.base64url(payload).base64url(mac)`. Der kanonische UTF-8-Inhalt enthält genau `version: 1`, `gameId`, `runId`, `revision`, `savedAt`, `binding` und `snapshot`. `savedAt` muss dem Snapshot-Anker entsprechen. Die HMAC-Signatur gilt für Kennung und Nutzinhalt. |

Der folgende Strukturbeleg verwendet das reduzierte Testmodul `fixture-idle` aus [idle-integration.test.js](../test/idle-integration.test.js). Die Spielmodule haben eigene fachliche Felder. Der Mengenwert in diesem Beispiel zeigt das Zahlenformat.

```json
{
  "gameId": "fixture-idle",
  "stateVersion": 1,
  "rulesVersion": 1,
  "at": 1790000000000,
  "phase": "fixture-phase",
  "data": { "units": "9007199254740993", "carry": 0 }
}
```

Ein regulärer Save verwendet die aus der Schreibsitzung gelesenen Revisionen. Der folgende Token ist ein syntaktischer Beispielwert.

```http
POST /api/idle/spielhalle/save
Content-Type: application/json
X-Requested-With: spieleabend

{"token":"00000000-0000-4000-8000-000000000000","revision":3,"sessionVersion":8,"id":"manual-save-4"}
```

Auf einen bestätigten Save folgt beispielsweise `{"revision":4,"savedAt":1790000000000}`. Dieselbe noch gespeicherte Anfragen-ID mit exakt denselben Parametern liefert denselben Beleg. Eine veraltete Revision ohne gültigen Replay-Beleg ergibt `409 revision-conflict`. Eine freigegebene Spiel-ID ohne verwendbaren Schlüsselring ergibt `503 idle-unavailable`. Eine übergroße Datei ergibt `413 payload-too-large`, eine ungültige Signatur `400 invalid-signature`.

Die [Exportprüfung](../server/idle/exports.js) lehnt eine andere Hüllenversion mit `unsupported-envelope` ab. Eine gültig signierte Datei mit unbekannter Zustands- oder Regelversion bleibt ohne registrierte Migration bei `unsupported-version`. Der [Migrationstest](../test/idle-savepoints.test.js) verwendet ein Testmodul mit einem ausdrücklich konfigurierten Übergang von Zustand 1 zu 2 bei Regelversion 1. Er belegt den Mechanismus für Kopie, Zeitanker und manuelle Bestätigung. Für historische Ressourcen-Aliase der drei tatsächlichen Spiele braucht es je Quellversion einen eigenen fachlichen Vertrag und Testdaten.

## Schlüsselring und Rotation

`IDLE_SAVE_KEYRING` wird serverseitig aus der Betriebsumgebung geladen. Es ist ein JSON-Objekt mit `active` und `keys`. `active` enthält eine Signaturkennung. `keys` ist eine Liste aus `{ "id": "kennung", "key": "<64 hex-Zeichen>" }` mit ein bis acht Einträgen. Jeder Schlüssel besteht aus 32 kryptografisch zufälligen Bytes. Kennungen und Schlüssel müssen eindeutig sein. Schlüssel gehören in die geschützte Betriebsumgebung und in eine getrennte, zugriffsbeschränkte Sicherung.

1. Einen neuen zufälligen Schlüssel mit neuer Kennung hinzufügen und diese Kennung als `active` konfigurieren. Den Vorgänger für die dokumentierte Übergangszeit im Ring behalten.
2. Den einzelnen Server kontrolliert neu starten. Neue Exporte verwenden die neue Kennung. Während der Übergangszeit bleiben Exporte mit zulässigem Vorgängerschlüssel verifizierbar. Die Wiederholung eines bereits bestätigten Save-and-Export liefert mit dem noch verfügbaren alten Schlüssel dieselbe Datei.
3. Einen Vorgängerschlüssel erst nach der festgelegten Übergangsfrist entfernen. Danach sind seine Exporte ungültig. Besitzer können ihre aktuelle bestätigte Revision mit dem aktiven Schlüssel erneut exportieren. Bei kompromittiertem Schlüssel die Kennung unmittelbar aus dem Ring entfernen, Server neu starten und Betroffene informieren.

Fehlt der aktive Schlüssel oder ist die Konfiguration ungültig, sperrt die Runtime die Spiel-API mit `503 idle-unavailable`. Der Signierer läuft nur auf dem Server. Der HMAC schützt gegen Veränderungen. Der Inhalt der Datei bleibt lesbar. Spielmodule müssen daher Zugangsdaten und sonstige Geheimnisse aus dem exportierbaren Zustand heraushalten.

## Datenablage und Betrieb

Das Compose-Betriebsmodell verwendet einen Node-Prozess im Service `poker` und das Volume `poker-data` unter `DATA_DIR`. Idle nutzt `DATA_DIR/idle/<spiel>` und opake Kontodateinamen. Der Dateiadapter synchronisiert die exklusive temporäre Datei und ersetzt die bisherige Datei atomar. Revision und Replay-Beleg stehen in derselben Datei. Für Fehler beim Schreiben, fehlende Daten oder defekte Dateien gibt es unterscheidbare Antworten. Ein normaler Serverneustart verwirft flüchtige Sitzungen und lädt ab dem bestätigten Zeitanker.

Ein atomar angelegtes Verzeichnis `DATA_DIR/idle/.writer` verhindert eine zweite Instanz auf demselben Dateisystem. Auch beim späteren Entfernen eines Spielmoduls gelten die Sperre und die Konto-Lebenszyklusregeln für vorhandene Daten weiter. Bei sauberem Stopp gibt der Prozess die Sperre automatisch frei. Nach einem harten Abbruch muss der Betreiber alle potenziellen Writer auf demselben Volume stoppen und ihre Beendigung prüfen. Erst dann kann er das leere Sperrverzeichnis entfernen und den Server neu starten. Eine offene oder unklare Sperre bleibt bestehen. Das ist ein Schutz für ein gemeinsam sichtbares lokales Dateisystem. Mehrere gleichzeitige Writer und replizierte Volumes benötigen einen transaktionalen Adapter.

Für konsistente Backups Konto- und Idle-Daten bei gestopptem Server gemeinsam sichern. Die Schlüsselkonfiguration separat geschützt sichern. Vorhandene Idle-Savepoints ohne lesbares Konto-Verzeichnis sperren den Start, weil sich die Besitzer und Geräte-Aliase sonst nicht sicher auflösen lassen. Das Wiederanlaufen nach normaler Prozessbeendigung und die Sperre nach erzwungenem Abbruch sind getestet. Vollständige Haltbarkeit nach Stromausfall einschließlich des Verzeichniseintrags bleibt eine Anforderung für den jeweiligen Datenträger.

## Entscheidungsvorlage zur Wiederherstellung

| Fall | Vorgeschlagenes Verfahren zur Freigabe |
| --- | --- |
| Ältere signierte Datei und vorhandener Datensatz | Separater Vorschau-/Bestätigungsvorgang. Dateisignatur, Besitzer, Spiel, Schema und aktuelle Ledgerrevision unter Schreibschutz erneut prüfen. Den wirtschaftlichen Inhalt in einen neuen Run mit **Serverzeit jetzt** übernehmen. Die globale Revision wird von der aktuellen Ledgerrevision aus um eins erhöht. Aus der früheren Dateizeit entsteht keine zusätzliche Offline-Gutschrift. |
| Serverseitiger Datensatz verloren | Betreiber-Recovery aus einem verifizierten und konsistenten Konto-/Idle-Backup. Vor Freigabe der betroffenen Konten gültige Schlüssel, maximale bekannte Revision und Abrechnungshistorie nachweisen. Wenn die Historie fehlt, bleibt die Wiederherstellung bis zur ausdrücklichen Entscheidung gesperrt. Eine einzelne Exportdatei liefert diesen Nachweis nicht. |
| Gutschriften und Prestige | Abrechnungsanker auf jetzt setzen und kontoweite, bereits verbuchte Prestigeansprüche erhalten. Run-ID, neuer Zeitanker, Revision, Anspruchsregister und Wiederholungsbeleg müssen gemeinsam transaktional geschrieben werden. Alte Leases und Vorschauen werden entwertet. |
| Entscheidung vor dem Bau | Projektinhaber legt fest, ob Spieler einen ersetzenden Rollback auslösen dürfen oder nur der Betreiber. Aufbewahrung, maximal belegte Revision, Audit und Verhalten bei verlorenen Schlüsseln müssen vor Umsetzung feststehen. |

## Spielmodulabnahme

Die technische Prüfung läuft mit `node --test test/idle-engine.test.js test/idle-savepoints.test.js test/idle-integration.test.js`. Der Playwright-Fall N05 prüft die Sichtbarkeit im Hub mit und ohne registriertes Idle-Spiel.

IDLE-04 bindet [Die Spielhalle](spielhalle.md) an Konto, Savepoint und synchronisierte Tab-Übernahme an. Die Anwendungstests benutzen ein freigegebenes Testprofil mit kontrollierter Uhr und echten Spielaktionen.

IDLE-06 und IDLE-11 binden [Game Studio Tycoon](studio.md) an dieselbe konto- und spielgebundene Infrastruktur an. Projektreservierungen und Absatzstände bleiben beim kontrollierten Prozesswechsel ab der bestätigten Revision erhalten.

IDLE-07 und IDLE-08 binden [Factory Empire](factory.md) an. Der Spielstand enthält Platzierungen, Materialkonten, Produktionszähler und Zugmanifeste. Der Produktionssolver setzt die Berechnung nach dem Wiederöffnen ab der bestätigten Revision fort. Tests vergleichen ganze mit geteilten Offline-Intervallen und prüfen eine gespeicherte Zugfahrt über die Ankunftsschwelle.
