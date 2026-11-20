# ROADMAP-02 – Besucheransicht der Roadmap

**Status:** Finalisierte Planung, Umsetzung separat freizugeben. Stand 20. November 2026, geprüft gegen `main` bei `c3d3cd6`. Es wurde nichts implementiert.

## 1. Istzustand

| Sachverhalt | Befund | Quelle |
| --- | --- | --- |
| Datenquelle | handgepflegte Liste `ROADMAP` mit **45 Etappen** (38 erledigt) und 218 Punkten (197 erledigt); Stufen `erledigt`, `jetzt`, `spaeter`, `gross`; Punkte mit Art (`spiel`, `funktion`, `design`, `discord`, `betrieb` …) | `games/roadmap.js` |
| Auflösung | `resolvedRoadmap()` verbindet Etappen mit `planned.js` (heute leer) und hängt Spiele-Metadaten an (`spiel`-Objekt, `plannedId`) | `games/roadmap.js` |
| Auslieferung | `GET /roadmap` gibt die **ganze** aufgelöste Struktur aus; `GET /api/whats-new` die jüngsten erledigten Punkte; beides nur mit Seitenzugang | `server/index.js` |
| Anzeige | Hub-Seite `#roadmap` mit Filter nach Art, aufklappbaren Etappen-Karten, Zähler „x von y“ | `public/hub.js` (`pageRoadmap`, `roadmapBodyHTML`) |
| Ausblendbar | Block `roadmap` in den Einstellungen | `public/settings.js` |
| Inhalte | Texte sind bereits für Spieler geschrieben; die Ausgabe enthält keine Dateipfade (Pfade stehen nur in Quellcode-Kommentaren) | geprüft in `games/roadmap.js` |
| Schwächen | alt gewachsen: 45 Etappen statt weniger, verständlicher Gruppen; „Jetzt“ zeigt Push-Mitteilungen, nicht den tatsächlichen Stand; kein „Pausiert“, kein „Als Nächstes“ getrennt von „Geplant“; Design-/Asset-Arbeit aus VIS/EXP/ART nur teilweise abgebildet | siehe ROADMAP-01 Befund 2 |
| Tests | Konsistenz V2 ⇔ Hub-Roadmap, Datum erledigter Etappen, Version/„Was ist neu“ | `test/planning-consistency.test.js`, `test/roadmap.test.js`, `test/v2-roadmap.test.js` |

## 2. Zielzustand

Eine **Besucheransicht mit sechs Abschnitten**, in verständlichen Sätzen, ohne interne Begriffe:

| Abschnitt | Bedeutung für Besucher |
| --- | --- |
| Neu veröffentlicht | auf dem Produktivserver bereitgestellt. Angezeigte Version und Zeitpunkt der bestätigten Bereitstellung sind belegbar. |
| In Entwicklung | wird gerade gebaut |
| Als Nächstes | freigegeben oder fest eingeplant, noch nicht begonnen |
| Geplant | vorgesehen, ohne Zeitversprechen |
| Ideen | Wunschliste, noch keine Zusage |
| Pausiert | bewusst zurückgestellt, mit kurzem Grund |

Eigenschaften: kurze Titel, ein bis zwei Sätze, Kategorie (Spiele, Funktionen, Aussehen, Betrieb), Version bei „Neu veröffentlicht“. **Nicht** enthalten: Dateipfade, Paket-IDs, Commit-Hashes, Agentensperren, Testlisten, Sicherheitsdetails, Zahlen zur Auslastung. Bereits umgesetzte Funktionen erscheinen in der Besucher-Roadmap unter „Neu veröffentlicht“, sobald ihr Produktivnachweis vorliegt. Die bestehende Änderungshistorie „Was ist neu“ bleibt erreichbar. Wo sie interne Abschlüsse vor dem Deployment aufführt, ist sie als Änderungshistorie gekennzeichnet. Der öffentliche Veröffentlichungsstatus folgt P1.

## 3. Entscheidungen

| Nr. | Frage | Empfehlung |
| --- | --- | --- |
| **P1 · verbindlich** | „Neu veröffentlicht“ setzt tatsächliche Bereitstellung auf dem Produktivserver voraus. | Produktivversion vor jeder öffentlichen Statusänderung ermitteln. App-Version, laufenden Build-Commit und Deployment-Beleg separat erfassen. Commit, Push und GHCR-Build allein lösen keinen Statuswechsel aus. |
| P2 | Wer pflegt die Besuchertexte | **kuratierte, versionierte Datei** (z. B. `docs/roadmap/public-roadmap.json`), von Menschen geprüft; keine Erzeugung aus Notizen oder Vault |
| P3 | Sichtbarkeit für Gäste | bleibt wie heute (alle mit Seitenzugang); keine Verbindung zu AUTH-01 |
| P4 | Mehrsprachigkeit | DE und EN Pflichtfelder je Eintrag (das Projekt führt beide Sprachen) |
| P5 | Idle-Spiele und andere Pläne ohne Repo-Stand | nur öffentlich, wenn ausdrücklich zur Veröffentlichung freigegeben; bis dahin nicht aufnehmen |

## 4. Betroffene Dateien

Neu: `docs/roadmap/public-roadmap.json` (Vorschlag), Schema und Freigaberegeln in `docs/roadmap/INDEX.md` (ROADMAP-01).
Später: `games/roadmap.js` (Adapter: liest die kuratierte Datei; alte Struktur bleibt als Quelle der Historie), `server/index.js` (`/roadmap` liefert nur die Whitelist-Felder), `public/hub.js` (sechs Abschnitte statt 45 Etappen), `public/i18n-en.js`, `test/roadmap.test.js`, `test/planning-consistency.test.js`, `test/ui/*` (Roadmap-Seite).
Unberührt: interne Planung (`docs/roadmap/*`, `docs/design/*`, `docs/backlog/*`), Vault.

## 5. Abhängigkeiten

Braucht ROADMAP-01 (Index, Statusvokabular, Quellenregeln). Unabhängig von AUTH-01. NAV-01: der Block `roadmap` bleibt ausblendbar.

## 6. Umsetzungsstrategie

1. **Schema** je Eintrag (Whitelist): `id` (öffentliche Kurz-ID, nicht die interne), `titel_de/_en`, `text_de/_en`, `bereich` (`spiele`, `funktionen`, `aussehen`, `betrieb`), `status` (sechs Werte), `version` (nur bei „neu“), `monat`, `grund` (nur bei „pausiert“).
2. **Kuratierung:** Ein Mensch (oder ein Agent nach ausdrücklichem Auftrag) wählt aus dem Index (ROADMAP-01) aus; der Index liefert den **internen** Status, die Datei den **öffentlichen** Text. Eine Prüfung stellt sicher, dass jeder öffentliche Eintrag auf einen internen Eintrag zeigt (intern, nicht ausgeliefert) und der Status zusammenpasst.
3. **Filter am Server:** `/roadmap` liefert nur Whitelist-Felder; ein Test sucht in der Antwort nach Pfaden, Hashes, „docs/“, „server/“, „AGENTS“, Sperr- und Paket-IDs.
4. **Statusregeln:** „Neu veröffentlicht“ nur mit internem Abschluss, Changelog und bestätigtem produktivem Deployment, das den betreffenden Implementierungscommit enthält; „In Entwicklung“ nur bei freigegebener und nachweislich begonnener Umsetzung; „Als Nächstes“ nur, wenn der Nutzer es so bestätigt hat.
5. **Ansicht:** Sechs Karten mit Zähler und Filter nach Bereich. „Was ist neu“ bleibt als Änderungshistorie erreichbar. DE und EN für beide Ansichten prüfen.
6. **Übergang:** alte Roadmap-Ansicht bleibt bis zur Abnahme aufrufbar; danach umschalten, alte Daten **nicht löschen**.
7. **Keine automatische Veröffentlichung:** Änderungen an der Besucherdatei laufen wie jede andere Änderung über Commit und Version; kein Server-Deployment durch diesen Auftrag.

### Kompatibilität und Freigabe

**Produktivbefund am 20.11.2026, 03:29 Uhr (Berlin).** Der öffentliche Healthcheck meldet `ok: true`, **Version 3.17.0**, **Build-Commit `cb2c167`**. Die Planungsbasis `main` ist `c3d3cd6`, ebenfalls Version 3.17.0. Ein Containerbuild auf `c3d3cd6` belegt keinen Wechsel des Produktivstands. Der Healthcheck belegt den beobachteten Stand am Abrufzeitpunkt. Der genaue erstmalige Deploymentzeitpunkt bleibt offen. Zur redaktionellen Freigabe pro Eintrag den Implementierungscommit dem laufenden Build zuordnen und Produktivnachweis frisch erheben. [Produktiv-Healthcheck](https://poker.scwagaming.com/health) · [Betriebsanleitung](../../docs/betrieb.md#L366) · [Commit der Planungsbasis](https://github.com/TTLPSCWA/PokerAbend/commit/c3d3cd6f15e7219cb27696a2d0db18827cafd4ac)

Ein leerer Abschnitt wie „In Entwicklung“ kann eine neutrale Leeranzeige erhalten. Dokumentationsarbeit am Entwurf erzeugt keinen öffentlichen Entwicklungsstatus.

Die interne Referenz von Besucher-ID zu Paket-ID wird vor Veröffentlichung validiert und serverseitig entfernt. Periode, Status und öffentliche ID sind unabhängig von privaten Dateipfaden. Bestehende öffentliche Etappen-IDs bei Bedarf als getestete Aliasse bewahren. Für `/roadmap`, `/api/whats-new`, altes Hash-/Detailverhalten und Filter eine Kompatibilitätsprobe festlegen. Kuratierte Texte dürfen ebenfalls keine internen Notizen, Sperren oder Pfade verraten.

## 7. Risiken

| Nr. | Risiko | Gegenmaßnahme |
| --- | --- | --- |
| R1 | Interne Details gelangen in die Besucheransicht | Whitelist am Server und Textsuche im Test |
| R2 | „Neu veröffentlicht“ suggeriert Deployment | P1: Produktiv-Healthcheck und belegte Zuordnung des Eintrags zum laufenden Build. Bei unbekanntem Nachweis bisherigen Status belassen. |
| R3 | Geplantes wirkt wie zugesagt | Texte ohne Termine; „Ideen“ klar getrennt; Test auf verbotene Zeitwörter („bald“, „nächste Woche“) |
| R4 | Doppelpflege (öffentlich und intern) driftet | Prüfung „öffentlich → intern“; Abgleich im selben Test |
| R5 | Erledigtes erscheint erneut als Vorhaben | Test: kein Eintrag „geplant/in Entwicklung“ mit internem Status `done` |
| R6 | Übersetzung fehlt oder ist schlechter | Pflichtfelder DE/EN, i18n-Test |
| R7 | Alte Verweise auf öffentliche Etappen-IDs (`planning-consistency`) brechen | Adapter erhält die bisherigen IDs für die Historie |

## 8. Testfälle

PUB-T01 genau sechs Abschnitte, alle Einträge einem Abschnitt zugeordnet. PUB-T02 jeder öffentliche Eintrag verweist auf einen internen Eintrag mit passendem Status. PUB-T03 Antwort von `/roadmap` enthält nur Whitelist-Felder; keine Pfade, Hashes, IDs der internen Planung, Sperrbegriffe. PUB-T04 „Neu veröffentlicht“ nur bei bestätigtem Produktivdeployment. Gleiche Versionsnummer bei unterschiedlichem Build, unbekannten Healthcheck, Rollback und reinen GHCR-Build testen. PUB-T05 Intern erledigte Einträge bleiben Teil der Historie. Die Besucher-Roadmap zeigt sie erst nach Freigabe des Produktivnachweises als veröffentlicht. PUB-T06 DE und EN vollständig. PUB-T07 Browser: Desktop und Handy, Filter, Tastatur, Ausblenden über NAV-01. PUB-T08 Der bisherige Zugang zu „Was ist neu“ und das Antwortformat bleiben erhalten. Ein erledigter Punkt ohne Produktivbeleg wird in der Änderungshistorie als solcher erkennbar und löst keinen öffentlichen Veröffentlichungsstatus aus. PUB-T09 Bestehende Roadmap-Tests bleiben grün.

## 9. Aufwandseinschätzung (Schätzung)

Schwierigkeit **3/5**. Schema, Kuratierung der ersten Fassung und Texte etwa 1–1,5 Personentage, Adapter und Server-Filter etwa 0,5–1, Ansicht und Tests etwa 1; gesamt **2,5–3,5 Personentage** nach ROADMAP-01.

## 10. Abnahmekriterien

1. Besucher sehen sechs verständliche Abschnitte; jeder Eintrag hat Titel und Beschreibung in DE und EN.
2. In keiner Antwort und Ansicht erscheinen Dateipfade, interne IDs, Commits, Sperren oder Techniknotizen.
3. Die kuratierte Auswahl jüngerer produktiver Veröffentlichungen nennt die belegte Version. Erledigtes erscheint nicht erneut als Vorhaben. Ältere Einträge bleiben über den historischen Zugang erreichbar.
4. Nichts nur Geplantes steht als veröffentlicht.
5. Die Daten stammen aus der kuratierten Datei, nicht aus Vault oder Techniknotizen.
6. Bisherige Roadmap-Daten bleiben erhalten; alle Planungs- und Roadmap-Tests grün.
7. Kein Deployment, keine Änderung produktiver Daten.

> **Statusnachtrag 20.11.2026:** Dieses Paket ist weiterhin **geplant und nicht implementiert**. Der Text beschreibt den Stand bei `c3d3cd6` (Version 3.17.0); `main` steht inzwischen bei Version 3.18.0 (`0f14e19`), Zeilenanker und Zahlen können abweichen. Es gilt der Umsetzungsstand im [Nachtrag der README](README.md#nachtrag-20112026-stand-version-3180).
