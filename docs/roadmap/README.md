# PokerAbend V2 – Gemeinsame Entwicklungsplanung
**Status:** Nur geplant. Noch keine Implementierung freigegeben. Stand: 30.10.2026.
**GitHub-Repository:** TTLPSCWA/PokerAbend
**Verwendbar durch:** Codex, Claude Code und andere Coding-Agenten.

## Wichtige Dateien
- `docs/roadmap/plan.json`: Maschinenlesbare Master-Roadmap mit stabilen Arbeitspaket-IDs, Abhängigkeiten, Sicherheit, Akzeptanz und Status.
- `docs/roadmap/POKERABEND_V2_ROADMAP.md`: Menschenlesbare Zusammenfassung, Prioritäten und Arbeitsanweisung.
- `docs/roadmap/MASTERPROMPT_V2_SOURCE.md`: Archivierte vollständige fachliche Ausgangsspezifikation (nicht direkt ausführen).
- `docs/roadmap/DESIGN_GUIDE.md`: Designbeschreibung, damit auch ohne externes Referenzbild die gewählte Richtung erhalten bleibt.
- `AGENTS.md` und `CLAUDE.md`: Einstiegspunkte für Codex bzw. Claude Code.

## Wichtig für KI-Agenten
1. Roadmap und Quelle lesen, **aber NICHT automatisch implementieren**.
2. Ohne eindeutige Freigabe (`Implementiere V2-XX`) keine Dateien außerhalb der Dokumentation verändern.
3. Pro Umsetzungssitzung nur das vom Nutzer freigegebene Paket, einschließlich der direkt dazu notwendigen Tests.
4. Nach jeder freigegebenen Arbeit `plan.json` (Status, Nachweise, Commit) und Roadmap aktualisieren.
5. `games/roadmap.js` und `games/planned.js` sind **Live-Anwendungsdateien**, NICHT mit dieser Entwicklungsplanung verwechseln.

**CI-Hinweis:** Pushes auf `main` starten aktuell Docker-Image-Build/Push über GitHub Actions. Dieses Planungspaket liegt daher zunächst auf einem separaten Branch und soll erst nach Prüfung gezielt übernommen werden.

**Design:** Ein dezenter atmosphärischer Hintergrund, ruhige Liquid-Glass-Flächen, minimalistische Kacheln ohne wiederholte Fotohintergründe. Keine Freundesliste, kein 3D.

**Kamera:** Discord OAuth überträgt keinen Discord-Videocall. Optionale eigene Browserkamera nur mit explizitem Opt-in, HTTPS, TURN und geprüfter Berechtigung; standardmäßig aus.
