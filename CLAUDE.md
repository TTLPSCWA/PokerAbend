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

## Einstieg und Grenzen

Zusätzlich vollständig `AGENTS.md` und `docs/roadmap/README.md` beachten. Die zentrale Planung ist `docs/roadmap/plan.json` mit 18 Paketen V2-00 bis V2-17. Ein Paket nur nach ausdrücklicher Freigabe seiner ID bearbeiten; anschließend stoppen. Konsolidierung und Dokumentation geben keine neue Implementierung frei.

`MASTERPROMPT_V2_SOURCE.md` und `PROMPT.md` sind historische Quellen; ihre alten Implementierungs-/Branch-Anweisungen gelten nicht als Auftrag. Bestehende 46 Spiele, das vorhandene Redesign, Rechte, Cookies, Räume und Produktionsdaten erhalten. Keine Freundesliste, keine Discord-Video-Übernahme, keine 3D-Arbeit und kein Produktivdeployment ohne gesonderten Auftrag. Beauftragte GHCR-Builds sind vom Serverdeployment zu unterscheiden.
