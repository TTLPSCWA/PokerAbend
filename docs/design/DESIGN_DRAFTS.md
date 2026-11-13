# Design-Entwürfe (SVG) und Export

Grundregel für alle Agenten (Claude Code, Codex) und Menschen, die Design-Entwürfe für den Spieleabend anlegen. Sie ergänzt [GAME_VISUAL_GUIDELINES.md](GAME_VISUAL_GUIDELINES.md), die Roadmaps (VIS, EXP, ART) und die Regeln in `AGENTS.md`/`CLAUDE.md`, ersetzt sie aber nicht.

## Orte

| Was | Wo |
|---|---|
| Entwurfsquellen | `docs/design/drafts/*.svg` (nur im Repo, nicht im Obsidian-Vault) |
| Export (PNG, PDF) | `docs/design/drafts/export/<name>.png` und `<name>.pdf` |
| Export-Skript | `scripts/export-design.mjs`, Aufruf `npm run export:design` |

Der Obsidian-Vault (`SpieleAbendVault`) bleibt für Agenten nur lesbar; Entwürfe werden dort nicht abgelegt.

## Export

- `npm run export:design` exportiert alle SVG-Dateien in `docs/design/drafts/`; `npm run export:design -- docs/design/drafts/name.svg` nur einzelne.
- **PNG** in doppelter SVG-Breite (`width="800"` → 1600 px), transparenter Hintergrund, sofern das SVG keinen eigenen hat.
- **PDF** als Vektor, eine Seite in SVG-Größe.
- Werkzeug ist das Playwright-Chromium aus dem Repo (`@playwright/test`), nichts zusätzlich installieren. Skripte in SVG-Dateien werden beim Export nicht ausgeführt.
- Optionen: `--scale=2`, `--format=png,pdf`, `--out=<ordner>`.
- Jedes SVG braucht `width`/`height` oder eine `viewBox`; nach jeder Änderung an einer Quelle neu exportieren.

## Pflichten für jeden Entwurf

1. **Lizenzen.** Eigene Grafiken und jede fremde Datei stehen mit Herkunft in [ART_LICENSES.md](ART_LICENSES.md). Externe Bilder nur unter den dort genannten freien Lizenzen und nur mit Eintrag. Das Export-Skript warnt bei extern verlinkten Bildern (`href="http…"`).
2. **Entwurf ist keine Bauanweisung.** Ein Entwurf, ein Export oder eine Zustimmung wie „ok, find ich gut“ gibt keine Umsetzung in die Webseite frei. Gebaut wird erst nach ausdrücklicher Freigabe einer konkreten ID (z. B. `ART-044`, `VIS-012`); dann gelten die Regeln des jeweiligen Pakets.

## Git

- Nur auf `main` arbeiten, keine Branches oder Pull Requests. Vor jedem Schreibvorgang den Remote-Stand prüfen, Divergenz sicher abgleichen, nie Force-Push.
- Commits mit Entwürfen und Exporten sind Dokumentations-Commits und ändern die Version nicht.
