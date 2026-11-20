# ROADMAP-01 – Vollständige Neuordnung der internen Planung

**Status:** Finalisierte Planung, Umsetzung separat freizugeben. Stand 20. November 2026, geprüft gegen `main` bei `c3d3cd6`. Ändert keine bestehende maßgebliche Planungsdatei; alle Vorschläge gelten erst nach Abgleich und eigener Freigabe.

## 1. Istzustand

### Planungsquellen im Repository

| Quelle | Inhalt und Stand | Art |
| --- | --- | --- |
| `docs/roadmap/plan.json` (+ `README.md`, `POKERABEND_V2_ROADMAP.md`, `V2-*.md`, `V2_ADDENDUM_2026-10-30.md`) | 18 V2-Pakete: **17 `done`, 1 `planned`** (V2-08 Tischkamera) | maschinenlesbar, maßgeblich für V2 |
| `docs/roadmap/consolidation.json` + `CONSOLIDATION_2026-10-30.md` | historische Konsolidierung vom 30.10.2026 (Branches, Reihenfolge) | historisch |
| `docs/backlog/plan.json` (+ `BACKLOG-06…12.md`, `WEITERE_SPIELE.md`, Screenshot-Manifeste) | „Weitere Spiele“: 41 von 41 (`status: complete`); 12 reguläre Pakete (5 `done`, 7 `verified`), 41 Spieleinträge (16 `done`, 25 `verified)), zusätzlich ein erledigter Extra-Spieleeintrag und ein verifiziertes Feature-Paket. Selbst als „Fortschrittsschnappschuss, kein zweiter Live-Backlog“ bezeichnet | maschinenlesbar, abgeschlossen |
| `docs/design/game-visual-roadmap.json` (+ `GAME_VISUAL_ROADMAP.md`) | VIS: 107 Pakete, alle `visual_status: done`, plus Feature-Pakete | maschinenlesbar |
| `docs/design/game-experience-roadmap.json` (+ `GAME_EXPERIENCE_ROADMAP.md`, erzeugt mit `scripts/build-experience-roadmap.mjs`) | EXP: Fundament F1–F6 `done`; Spielpakete 17 `done`, 94 `planned` | erzeugt aus Markdown |
| `docs/design/game-art-roadmap.json` (+ `GAME_ART_ROADMAP.md`, `scripts/build-art-roadmap.mjs`) | ART: 17 `done`, 2 `planned` (ART-044, ART-046), 1 `partial` (ART-W1); Kartenwelten ART-T1…T6, Themenwelten ART-W0…W4 | erzeugt aus Markdown |
| `docs/design/card-interaction-roadmap.json` | CUX: 3 `done`, 10 `planned` | maschinenlesbar |
| `docs/design/THEME_WORLDS.md`, `THEME_ARCHITECTURE.md` | Themenwelten TW-01…TW-16: teils umgesetzt (ART-W0…W4), Rest Konzept | Text |
| `games/roadmap.js` | **Live-Datei der öffentlichen Roadmap im Hub**: 45 Etappen (38 erledigt, 1 `jetzt`, 5 `spaeter`, 1 `gross`), 218 Punkte, davon 197 erledigt | Anwendungscode |
| `games/planned.js` (+ `games/singleplayer/planned.js`) | Backlog der geplanten Spiele: **0 Einträge** (alles gebaut) | Anwendungscode |
| `CHANGELOG.md` | Versionen bis 3.17.0 | Nachweis |
| GitHub Actions | Push-Läufe grün (zuletzt #225, `c3d3cd6`); **Nachtläufe #220–#223 (16.–19.11.) alle rot** | Nachweis |
| Agentenkoordination (`docs/agents/`) | Sitzungsarchive, Sperren | Betrieb, nicht Produktplanung |

Außerhalb des Repositorys (nur Vault, nicht Teil der Quellen dieses Plans): Idle-Spiele `IDLE-*` (Implementierungspakete `planned`, privater Designstand separat), Aufgaben und Fehlerlisten.

### Befunde

1. **Fünf parallele Statusquellen** (V2, Backlog, VIS/EXP/ART/CUX, `roadmap.js`, Vault) mit unterschiedlichen Wörtern (`done`, `verified`, `partial`, `planned`, `erledigt`, `jetzt`, `spaeter`, `gross`).
2. Die **öffentliche Roadmap** (`games/roadmap.js`) ist handgepflegt und bildet die Design-/ART-/EXP-Arbeit der letzten Wochen kaum ab: „Jetzt“ steht auf **Benachrichtigungen (Push)**, während zuletzt Themenwelten, Schiffe, Monopoly-Grundlagen und Kenney-Grafiken gebaut wurden; der Punkt „Klang, Bewegung & Figuren für jedes Spiel“ steht noch offen, obwohl 23 EXP-Einträge `done` sind.
3. Zwei getrennte Sichten auf offene Spiele-Arbeit: `planned.js` ist leer, offene Spiele stehen nur noch in den Design-Roadmaps.
4. **Erzeugte Dateien** (EXP, ART) haben eine Markdown-Quelle; Die bestehende Prüfung vergleicht die Generatorausgabe mit dem JSON. Die Quelldateien werden im Plan als verbindlich gekennzeichnet.
5. Mehrere Regeltexte sind veraltet (Beispiele: „übrige 100 VIS-Pakete nur geplant“ in `AGENTS.md`/`CLAUDE.md`, „alle 18 Pakete `planned`“ in `POKERABEND_V2_ROADMAP.md`, Stand „62 Spiele“ im `docs/roadmap/README.md`). Das ist festgestellt, nicht geändert.
6. Die Tests prüfen bereits die Konsistenz in beide Richtungen (V2 ⇔ Hub-Roadmap, Backlog ⇔ gebaut, VIS ⇔ Spiele, Datum erledigter Etappen); sie sind das Sicherheitsnetz der Neuordnung.
7. QA-CI-01 führt die Untersuchung der Nachtläufe #220–#223. Für den internen Bereich Sicherheit, Betrieb und Tests die Belege, bestätigte Ursachen und offene Korrekturen getrennt erfassen. [QA-CI-01](QA-CI-01.md)

## 2. Zielzustand

Die Gesamtstruktur hat sieben Bereiche. Jedes Paket hat genau eine fachliche Quelle und behält ID, Nachweise und Status. „Aktiv“ und „Abgeschlossen“ zeigen gefilterte Verweise auf dieselben Einträge.

| Bereich | Inhalt | Heutige Quellen |
| --- | --- | --- |
| A. Aktive Entwicklung | was gerade in Arbeit oder freigegeben ist | neu (aus den Bereichen B–E abgeleitet) |
| B. Plattform und Funktionen | Konten, Discord, Ranked, Profile, Einstellungen, Presence, Tickets, Planung, Navigation, Roadmap | V2-Pakete, `roadmap.js`, AUTH-01, NAV-01, ROADMAP-01/02 |
| C. Spiele und Varianten | Spielekatalog, Varianten, Bots, neue Spiele (z. B. Idle) | `games/index.js`, Backlog, `planned.js`, Poker-Extras |
| D. Design und Assets | VIS, EXP, ART, CUX, Themenwelten, Lizenzen | `docs/design/*` |
| E. Sicherheit, Betrieb und Tests | Datenschutz, Backups, Nachtlauf, Deployment, Migration | V2-09/V2-10, `betrieb.md`, CI |
| F. Ideen und Zukunft | Tischkamera (V2-08), Discord-Bot, 3D, Saisons, App | Ausblick in `roadmap.js` |
| G. Abgeschlossen | alles mit `done`/`verified` und Nachweis | alle Quellen |

Dazu **Regeln zur maßgeblichen Quelle** (Abschnitt 3) und ein **Index**, der die Quellen verbindet, ohne sie zu ersetzen (Abschnitt 6).

## 3. Maßgebliche Datenquelle je Aufgabenbereich

| Bereich | Maßgeblich | Abgeleitet (nie von Hand ändern) | Prüfung |
| --- | --- | --- | --- |
| V2-Pakete (Plattform) | `docs/roadmap/plan.json` | Hub-Roadmap-Punkte, `README`-Zahlen | `test/v2-roadmap.test.js`, `planning-consistency.test.js` |
| Historische Spielpakete | `docs/backlog/plan.json` | Paket- und Spielnachweise getrennt erhalten | Backlog-Test |
| Spielbarkeit und künftiger Katalog | `games/index.js` und Einzelspieler-Registry für Spielbarkeit; `games/planned.js` für kuratierte künftige Katalogeinträge (heute leer) | Hub-Katalog; Status der historischen Pakete getrennt | Registry- und planned-Tests |
| VIS | `docs/design/game-visual-roadmap.json` | `GAME_VISUAL_ROADMAP.md` (Text) | `game-visual-roadmap.test.js` |
| EXP / ART | **Markdown-Quelle** (`GAME_EXPERIENCE_ROADMAP.md`, `GAME_ART_ROADMAP.md`) | JSON per Generator | `experience-roadmap.test.js`, `art-roadmap.test.js` |
| CUX | `docs/design/card-interaction-roadmap.json` | – | zugehöriger Test |
| Öffentliche Roadmap | **kuratiert** (ROADMAP-02), nicht generiert | `games/roadmap.js` als Anzeige | Konsistenztests, Freigabe durch Menschen |
| Version, Änderungen | `package.json`, `CHANGELOG.md` | README/Betrieb-Versionszeile | `planning-consistency.test.js` |
| Produktivstand (P1) | Beobachtung des produktiven Healthchecks plus Commit-/Deploymentnachweis | Produktiver Status in der öffentlichen Projektion | Version, Build-Commit, Zeitpunkt und Deploymentstatus separat dokumentieren |
| CI-Nachweis | GitHub Actions am `main`-Commit | – | Abfrage, nie von Hand eintragen |
| Idle und Vault-Aufgaben | Vault (privat) bis ein Paket **freigegeben und im Repo** ist | – | Übergabe als eigenes Paket |

Allgemeine Regeln: **Ein Status gehört genau einer Quelle.** Erledigt nur mit Commit-Nachweis und (bei Spielen) Registrierung. Eine geplante Funktion wird nie als erledigt ausgegeben; eine erledigte nie erneut als offen. IDs werden nicht umnummeriert. Interne Techniknotizen fließen **nie** automatisch in die öffentliche Sicht.

## 4. Betroffene Dateien

Neu (Entwurf, keine Änderung an Bestehendem): Index `docs/roadmap/roadmap-index.json` (Vorschlag), `docs/roadmap/INDEX.md`, Skript `scripts/build-roadmap-index.mjs` (nur lesend, prüft und erzeugt den Index), Test `test/roadmap-index.test.js`.
Später und nur nach Abgleich: `docs/roadmap/README.md` (Einstieg und Quellenregeln), `AGENTS.md`/`CLAUDE.md` (veraltete Zahlen, **separater Doku-Auftrag**), `POKERABEND_V2_ROADMAP.md`, `games/roadmap.js` (ROADMAP-02).
Unberührt: alle `plan.json`/`*-roadmap.json`, `consolidation.json`, `CHANGELOG.md`, `planned.js`.

## 5. Abhängigkeiten

Der interne Quellenabgleich kann unabhängig von AUTH-01 und NAV-01 vorbereitet werden. ROADMAP-02 baut auf ROADMAP-01 auf. QA-CI-01 gibt den dokumentierten Ausgangszustand für die Regression vor. Idle erst nach Freigabe in die Struktur aufnehmen. Jede Änderung an Versions- oder Roadmap-Dateien braucht `@git` nach der Agentenregel.

## 6. Umsetzungsstrategie

1. **Bestandsaufnahme als Index, nicht als Umbau:** ein Index mit einer Zeile je Paket (`id`, `bereich`, `titel`, `status_intern`, `quelle`, `quelle_id`, `nachweis`, `abgeschlossen_am`), erzeugt aus den vorhandenen Dateien, **ohne diese zu ändern**.
2. **Status-Vokabular:** `idea`, `planned`, `next`, `in-progress`, `paused`, `partial`, `done`, `verified`; Abbildung der alten Wörter (`erledigt` mit Beleg → `done`; historische Labels wie `jetzt` werden geprüft und allein nicht als aktiver Arbeitsnachweis übernommen) in einer Tabelle, nicht in den Quelldateien.
3. **Prüfskript** (nur lesend): jede kanonische Paket-ID einmal, getrennte Namespaces für Paket-, Spiel-, Varianten- und Alt-Alias-IDs, jeder Bereich belegt, kein `done` ohne Nachweis, Zähler gleich den Quellen, Verweise gültig, erzeugte JSON gleich Generatorausgabe.
4. **Test** in `test/`: schlägt fehl, wenn ein Paket verschwindet, doppelt vorkommt oder von `done` zurück auf offen fällt.
5. **Dokument** `INDEX.md` mit den Regeln aus Abschnitt 3; `README.md` verweist darauf (spätere, separat freigegebene Änderung).
6. **Veraltete Regeltexte** (Befund 5) als eigener kleiner Doku-Auftrag mit den bekannten Fundstellen, nicht im Rahmen der Neuordnung.
7. Reihenfolge: Index → Skript → Test → Abgleich → Dokument → erst dann Änderungen an maßgeblichen Dateien.

### Quell- und Generatorabgleich

- `scripts/build-experience-roadmap.mjs` und `scripts/build-art-roadmap.mjs` erzeugen die jeweiligen JSON-Derivate aus Markdown. Der geplante Index liest die geprüften Derivate und hält je Paket den Link zur maßgeblichen Markdown-Quelle. Die Generatoren schreiben derzeit direkt relativ zum Aufrufordner und besitzen keinen `--check`-Modus. Aus diesen drei Eingaben wurde die ART-/EXP-Ausgabe in einer isolierten Kopie erfolgreich reproduziert. Der geplante Index verwendet separat eine lesende Konsistenzprüfung.
- VIS, CUX und V2 haben jeweils eine eigene maschinenlesbare Quelle. Belege unter `docs/backlog`, `docs/design/art`, `docs/design/experience` sowie Varianten-/Solo-Nachweise sind Referenzen des Index. Alte IDs und Status wie `partial` bleiben in Originalquellen erhalten.
- Die Baseline enthält 95 Mehrspieler- und 12 Solo-Registrierungen. 11 Spiele deklarieren zusammen 30 Varianten einschließlich ihrer Classic-Einträge. Inventar, Darstellung und Feature-/Paketstatus bleiben getrennt.
- Plan, CHANGELOG und CI belegen unterschiedliche Sachverhalte. Ein CI-Fehler ändert den Abschlussstatus historischer Pakete nicht. Ein grüner Lauf ersetzt ebenfalls keinen individuellen Nachweis.

## 7. Risiken

| Nr. | Risiko | Gegenmaßnahme |
| --- | --- | --- |
| R1 | Neuordnung verschiebt oder verliert IDs/Nachweise | Index nur lesend, Test auf Vollständigkeit, keine Dateiverschiebung |
| R2 | Erledigtes wird wieder offen | Test „nie rückwärts“ gegen den bisherigen Index |
| R3 | Geplantes wird als erledigt gezeigt | `done` nur mit Commit und Nachweis; öffentliche Sicht kuratiert |
| R4 | Generatoren werden umgangen (JSON von Hand) | Test vergleicht JSON mit Generatorausgabe |
| R5 | Zwei Wahrheiten (Index und Quelle) | Index ist abgeleitet, Quelle bleibt maßgeblich |
| R6 | Parallele Agentenarbeit an denselben Planungsdateien | `@git`-Koordination; ein Eigentümer je Datei |
| R7 | Vorhandene Spielregeln-/Spielzahl-Zahlen in Texten laufen auseinander | `planning-consistency.test.js` erweitern statt neue Zahlen zu streuen |
| R8 | Nachtlauf rot wird übersehen | als Eintrag im Bereich E führen, nicht als erledigt |

## 8. Testfälle

ROAD-T01 Index enthält jede ID aus `plan.json`, `backlog/plan.json`, den vier Design-JSON-Dateien genau einmal. ROAD-T02 Zähler je Quelle stimmen (V2 17/1, Backlog 12 Pakete und 41 Spieleinträge, plus Extra und Feature, ART 17/2/1, EXP 23/94, VIS 107, CUX 3/10). ROAD-T03 kein `done` ohne Commit-Hash und Nachweis. ROAD-T04 Rückwärts-Test gegen den eingefrorenen Ausgangsindex. ROAD-T05 erzeugte JSON gleich Generatorausgabe. ROAD-T06 alle Verweise des Index existieren. ROAD-T07 bestehende Planungstests bleiben grün. ROAD-T08 keine automatische Übernahme von Vault-Inhalten (Test auf verbotene Quellen).

## 9. Aufwandseinschätzung (Schätzung)

Schwierigkeit **3/5** (viel Lesen, wenig Code). Index, Skript und Tests etwa **2–3 Personentage**; Abgleich und Dokument etwa 0,5–1; der separate Doku-Auftrag für veraltete Regeltexte etwa 0,5.

## 10. Abnahmekriterien

1. Index enthält **alle** Pakete aller Quellen genau einmal, jeweils mit Bereich, alter ID, Status und Nachweis; Zähler stimmen mit den Quellen überein.
2. Keine bestehende Planungsdatei, ID, Status oder Verlinkung wurde verändert (Diff-Nachweis).
3. Kein bereits erledigtes Paket erscheint als offen; kein geplantes als erledigt (Test).
4. Je Bereich ist eine maßgebliche Quelle benannt und im Index dokumentiert.
5. Generatoren und Planungstests laufen unverändert grün; neuer Test grün.
6. Offene Punkte (Nachtlauf, veraltete Regeltexte) sind sichtbar geführt.

> **Statusnachtrag 20.11.2026:** Dieses Paket ist weiterhin **geplant und nicht implementiert**. Der Text beschreibt den Stand bei `c3d3cd6` (Version 3.17.0); `main` steht inzwischen bei Version 3.18.0 (`0f14e19`), Zeilenanker und Zahlen können abweichen. Es gilt der Umsetzungsstand im [Nachtrag der README](README.md#nachtrag-20112026-stand-version-3180).
