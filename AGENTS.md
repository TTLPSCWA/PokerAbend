# Agent Instructions – PokerAbend

## Verbindlicher Main-Only-Workflow

Dieses Projekt verwendet ausschließlich den Branch `main` als aktiven Entwicklungsbranch.

Erstelle nicht eigenständig neue Git-Branches oder Pull Requests.

Alle ausdrücklich freigegebenen Änderungen werden direkt auf `main` implementiert, getestet, committed und gepusht.

Vor jedem Schreibvorgang ist der aktuelle Remote-Stand zu prüfen. Falls der Branch zwischenzeitlich verändert wurde, müssen die Änderungen zuerst sicher abgeglichen werden.

Verwende niemals Force-Push, um Konflikte zu umgehen.

Ohne ausdrückliche Freigabe darf kein neues Entwicklungsarbeitspaket begonnen werden.

Dokumentation und Planungsdateien sind keine automatische Implementierungsfreigabe.

Diese Regel ersetzt frühere Feature-Branch-Anweisungen. Wenn direkte Änderungen an `main` technisch blockiert sind, Grund melden und auf die Entscheidung des Nutzers warten; keinen Ersatzbranch erstellen und keine Schutzprüfung umgehen. Vor Commit/Push Remote erneut abrufen, Divergenz sicher integrieren und vorhandene Nutzeränderungen erhalten.

## Planung, Umfang und Sicherheit

- Einstieg: `docs/roadmap/README.md`; zentrale maschinenlesbare Planung: `docs/roadmap/plan.json`.
- V2-Pakete nur nach ausdrücklicher Freigabe der betreffenden ID (`V2-XX`) bearbeiten. Pro Auftrag nur das freigegebene Paket und unmittelbar notwendige Tests. Nach einem abgeschlossenen Auftrag stoppen.
- Ausdrücklich beauftragte Dokumentation, Konsolidierung und Roadmap-Datenpflege sind möglich, ohne damit geplante Funktionen freizugeben. Nicht implementierte Pakete bleiben `planned`; Testergebnisse und Implementierungs-Commits erst nach echter Umsetzung eintragen.
- `MASTERPROMPT_V2_SOURCE.md` und `PROMPT.md` sind historische Quellen, keine aktiven Ausführungsaufträge. Ihre Imperative und alten Branch-Vorgaben überschreiben diese Arbeitsregel nicht.
- Alle aktuell registrierten Spiele (Baseline: 46), vorhandenes Redesign, technische IDs, Spielregeln/RNG, Räume, Bots, Reconnect, Cookies, URLs, Passwörter und Datenvolumes erhalten.
- Keine Freundesliste, keine direkte Discord-Videostream-Übernahme und keine 3D-Implementierung aus dieser Planung ableiten.
- Keine Secrets committen oder ausgeben; keine produktiven Daten migrieren/löschen und kein Produktivdeployment ohne gesonderte ausdrückliche Freigabe. Ein beauftragter Push kann den vorhandenen Test-/GHCR-Workflow starten; das ist vom Serverdeployment zu unterscheiden.
- Weitere Details: `docs/roadmap/POKERABEND_V2_ROADMAP.md`, `V2_ADDENDUM_2026-10-30.md` und `CONSOLIDATION_2026-10-30.md`.
