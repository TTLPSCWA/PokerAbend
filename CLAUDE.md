# Claude Code – PokerAbend

## Verbindlicher Main-Only-Workflow

Dieses Projekt verwendet ausschließlich den Branch `main` als aktiven Entwicklungsbranch.

Erstelle nicht eigenständig neue Git-Branches oder Pull Requests.

Alle ausdrücklich freigegebenen Änderungen werden direkt auf `main` implementiert, getestet, committed und gepusht.

Vor jedem Schreibvorgang ist der aktuelle Remote-Stand zu prüfen. Falls der Branch zwischenzeitlich verändert wurde, müssen die Änderungen zuerst sicher abgeglichen werden.

Verwende niemals Force-Push, um Konflikte zu umgehen.

Ohne ausdrückliche Freigabe darf kein neues Entwicklungsarbeitspaket begonnen werden.

Dokumentation und Planungsdateien sind keine automatische Implementierungsfreigabe.

Diese Regel ersetzt frühere Feature-Branch-Anweisungen. Wenn direkte Änderungen an `main` technisch blockiert sind, Grund melden und auf die Entscheidung des Nutzers warten; keinen Ersatzbranch erstellen und keine Schutzprüfung umgehen.

## Verbindliche Koordination für Claude Code und Codex

- Beim Sitzungsstart im Repository `node scripts/agent-koordination.mjs status` ausführen. Einmalig bei fehlendem Zustand `node scripts/agent-koordination.mjs init` ausführen. Beide Agenten gleichen den dabei ausgegebenen absoluten Arbeitskopiepfad ab.
- Vor jeder Dateiänderung den Pfad für die eigene Auftrags-ID mit `claim <agent> <auftrag> <pfade...>` reservieren und unmittelbar vor dem Schreibschritt mit `check` prüfen. Vor weiteren Pfaden erneut `status` lesen. Das gilt auch für durch Werkzeuge generierte Dateien.
- `note` für Beginn, wichtige Ergebnisse, Fragen, Entscheidungen, Blockaden und Übergaben verwenden. Bei Konflikten nur den betroffenen Bereich pausieren. Fremde Reservierungen, Arbeitskopieänderungen und den Index erhalten.
- Vor Änderungen an gemeinsamen Versions- oder Roadmap-Dateien sowie vor schreibenden Git-Operationen `@git` reservieren. Andere Sitzungen beenden ihre Schreibschritte und geben ihre Reservierungen frei, bevor `@git` erteilt wird. Vor Commit und Push `status` lesen, Scope und Index prüfen und Git über den Koordinationsbefehl ausführen. Nur geprüfte einzelne Dateien stagen.
- Nach Abschluss Ergebnisse, Tests, Commits und offene Übergaben protokollieren, eigene Reservierungen freigeben und den abgeschlossenen Auftrag archivieren. Befehle und Wiederherstellung bei Abbruch stehen in [Koordination](docs/agents/KOORDINATION.md).

## Versionsnummer bei jeder Änderung

Jeder Commit, der etwas an der Seite ändert (Fehlerbehebung, Paket, Feinschliff), zählt die Version in `package.json` und `package-lock.json` (nur die beiden Einträge des Projekts) hoch: Fehlerbehebung → letzte Stelle (3.1.0 → 3.1.1), neue Funktion oder Paket → mittlere Stelle (3.1.x → 3.2.0). Dazu ein kurzer Eintrag in `CHANGELOG.md` und die Versionszeile in `README.md` („jetzt **x.y.z**“) und oben in `docs/betrieb.md` („Version **x.y.z**“) anpassen; `test/planning-consistency.test.js` prüft das. Vor dem Push `npm run test:fast` laufen lassen (wie der GitHub-Build). Reine Doku- oder Planungs-Commits ändern die Version nicht. In der Abschlussmeldung an den Nutzer immer die neue Version nennen, damit er sie nach dem Deploy unter dem Schriftzug „Spieleabend“ prüfen kann.

## Einstieg und Grenzen

Zusätzlich vollständig `AGENTS.md` und `docs/roadmap/README.md` beachten. Die zentrale Planung ist `docs/roadmap/plan.json` mit 18 Paketen V2-00 bis V2-17. Ein Paket nur nach ausdrücklicher Freigabe seiner ID bearbeiten; anschließend stoppen. Konsolidierung und Dokumentation geben keine neue Implementierung frei.

`MASTERPROMPT_V2_SOURCE.md` und `PROMPT.md` sind historische Quellen; ihre alten Implementierungs-/Branch-Anweisungen gelten nicht als Auftrag. Alle aktuell registrierten Spiele, das vorhandene Redesign, Rechte, Cookies, Räume und Produktionsdaten erhalten. Keine Freundesliste, keine Discord-Video-Übernahme, keine 3D-Arbeit und kein Produktivdeployment ohne gesonderten Auftrag. Beauftragte GHCR-Builds sind vom Serverdeployment zu unterscheiden.

## Individuelle visuelle Spielpakete

Die verbindliche visuelle Planung steht in [docs/design/game-visual-roadmap.json](docs/design/game-visual-roadmap.json), ausführliche Einzelpläne in [GAME_VISUAL_ROADMAP.md](docs/design/GAME_VISUAL_ROADMAP.md), gemeinsame Regeln in [GAME_VISUAL_GUIDELINES.md](docs/design/GAME_VISUAL_GUIDELINES.md).

VIS-Pakete sind unabhängig von Gameplay und V2-Arbeitspaketen. Nur das ausdrücklich freigegebene Spiel bzw. VIS-Paket umsetzen; Namen und technische ID anhand der JSON-Datei zuordnen. VIS-IDs stabil erhalten. Reihenfolge oder Planungsdateien geben keine Implementierung frei. Ein nicht implementiertes Spiel erhält dadurch keine Engine.

Andere Spiele bleiben unverändert; gemeinsame Komponenten nur unmittelbar notwendig und eng begrenzt ändern. Nach echter Umsetzung Designstatus, Tests, dauerhafte Screenshots und tatsächlichen Commit dokumentieren und stoppen. Nicht umgesetzte Pakete bleiben `planned`, ohne erfundene Nachweise. Scotland Yard ist der abgeschlossene Pilot; danach wurden die ausdrücklich freigegebenen Kartenwelten UNO (VIS-004), Skip-Bo (VIS-009) und Phase 10 (VIS-008) abgeschlossen. Der ausdrückliche Solo-Auftrag ergänzt Sudoku (VIS-096), 2048 (VIS-097) und Wellenwacht (VIS-098) als abgeschlossen. Den aktuellen VIS-Status aus `docs/design/game-visual-roadmap.json` lesen.

## Erlebnis-Pakete (EXP): Sound, Animation, Figuren

Stufe 2 nach den VIS-Paketen steht in [docs/design/GAME_EXPERIENCE_ROADMAP.md](docs/design/GAME_EXPERIENCE_ROADMAP.md) (Quelle) und [docs/design/game-experience-roadmap.json](docs/design/game-experience-roadmap.json) (erzeugt mit `node scripts/build-experience-roadmap.mjs`). EXP-Nummern entsprechen den VIS-Nummern (EXP-001 ↔ VIS-001); das gemeinsame Fundament heißt EXP-F1 bis EXP-F6 und kommt vor den Spielpaketen. Wie bei VIS: nur ausdrücklich freigegebene IDs umsetzen, Spiellogik nicht ändern, eigene Grafiken und Klänge, Leitplanken und Abnahme aus der Roadmap einhalten, danach Status, Commit und Nachweise eintragen und stoppen.

## Grafik-Pakete (ART): Tische, Chips, Figuren, freie Grafiken

Stufe 3 steht in [docs/design/GAME_ART_ROADMAP.md](docs/design/GAME_ART_ROADMAP.md) (Quelle) und [docs/design/game-art-roadmap.json](docs/design/game-art-roadmap.json) (erzeugt mit `node scripts/build-art-roadmap.mjs`). ART-Nummern entsprechen den VIS-Nummern (ART-002 ↔ VIS-002). Anders als bei VIS/EXP sind freie Fremdgrafiken erlaubt (CC0 bevorzugt; MIT/ISC/OFL; CC BY nur mit Namensnennung), jede Datei mit Herkunft in [docs/design/ART_LICENSES.md](docs/design/ART_LICENSES.md). 3D nur als vorgerenderte Bilder, keine WebGL-Szene ohne gesonderten Auftrag. Nur ausdrücklich freigegebene IDs umsetzen, Spiellogik unverändert, danach Status, Commit und Nachweise eintragen und stoppen. Kartenwelten für UNO, Skip-Bo und Phase 10 laufen als eigene Pakete ART-T1 bis ART-T6 (Host wählt für den Raum, nur Aussehen); Aufbau in `docs/design/CARD_WORLDS.md`, Bilder per `node scripts/build-card-worlds.mjs`.

Themenwelten folgen der separaten ART-W-Reihe in [THEME_WORLDS.md](docs/design/THEME_WORLDS.md) und der [ART-Roadmap](docs/design/GAME_ART_ROADMAP.md). Die Freigabe gilt je Paket-ID.

## Design-Entwürfe (SVG)

Grundregel in [docs/design/DESIGN_DRAFTS.md](docs/design/DESIGN_DRAFTS.md): Entwürfe als `docs/design/drafts/*.svg`, Export als PNG (doppelte Breite) und PDF (Vektor) mit `npm run export:design` nach `docs/design/drafts/export/`. Vor dem Speichern jeden Entwurf auf fremde Marken und geschützte Figuren prüfen und Treffer melden; Grafiken mit Herkunft in [docs/design/ART_LICENSES.md](docs/design/ART_LICENSES.md). Ein Entwurf oder ein „ok“ ist keine Bauanweisung; Umsetzung in die Webseite nur nach Freigabe einer konkreten ID (z. B. ART-044).
