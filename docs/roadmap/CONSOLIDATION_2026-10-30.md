# GitHub-Konsolidierung vom 30. Oktober 2026

## Auftrag und geprüfte Basis

Ausgangspunkt ist `main` bei `aa2551793da45471c910d090e8eb2357e9ed13fd`: 46 registrierte Spiele und das bereits integrierte Liquid-Glass-Redesign. Vor den Änderungen wurden sämtliche Remote-Branches und alle vier vorhandenen PRs geprüft. Lokale Nutzeränderungen lagen nicht vor. Es wurde kein Branch und kein neuer PR angelegt.

Diese Arbeit integriert ausschließlich Dokumentation, Roadmap-Metadaten und deren Tests. Kein V2-Paket wurde implementiert. Spielmodule, Authentifizierung, Server-/Frontendabläufe, Abhängigkeiten und Docker-/Produktionskonfiguration bleiben erhalten.

## Branch- und PR-Befund

| Branch / letzter Commit (Zeit aus Git) | Unterschied zu main | Übernahme / Entscheidung |
| --- | --- | --- |
| `planning/pokerabend-v2-roadmap`, `b0ab661`, 2026-10-30 15:49:08 +01:00 | 13 eigene Commits, 8 neue Dokumentationsdateien; main war 5 Commits weiter | PR #3 gezielt integriert: sechs Dateien unter `docs/roadmap/` und beide Agent-Einstiege. Baseline auf 46 Spiele aktualisiert, Main-Only verankert, überholte Implementierungspfade und Branch-Vorgaben korrigiert. Der archivierte Masterprompt ist bytegleich erhalten. |
| `docs/public-roadmap-v2-ideas`, `b96d62e`, 2026-10-30 15:48:32 +01:00 | 3 eigene Commits, nur `games/planned.js`, `games/roadmap.js`, `test/roadmap.test.js`; main war 5 Commits weiter | PR #4 mit einem geprüften Patch dieser drei Dateien übernommen und um vollständige V2-Zuordnung ergänzt. Kein Überkopieren aktueller Dateien aus einem Altstand. |
| `feature/partyspiel`, `c788dee`, 2026-10-25 11:08:02 +01:00 | 8 alte Commits gegenüber dem damaligen Acht-Spiele-Stand, heutiges main 48 Commits weiter | PR #2 inhaltlich abgelöst. Kein Rückbau der aktuellen Lobby und keine Rückkehr zur alten `/me.plannedPartyGames`-API. Alle 28 Ideen mit ursprünglichen Metadaten im Inventar gesichert und genau einer heutigen ID zugeordnet. |
| lokaler `feat/liquid-glass-game-library`, `fd4dd93` | Vollständig Vorfahr von main | Bereits integriert; kein Remote-Branch dieses Namens vorhanden. Nach erneutem Vorfahr-Nachweis lokal mit normalem `git branch -d` entfernt. |

PR #1 war bereits geschlossen und nie gemergt; er enthält denselben Partyspiel-Stand wie PR #2. Sein Inhalt wird durch denselben Ideenabgleich abgedeckt. PR #2, #3 und #4 wurden nach erfolgreicher Übernahme mit einem Verweis auf den tatsächlichen Integrationscommit `6c254120c731846f20dd5523964e5e6964d2e0a0` kommentiert und geschlossen. Alle drei haben `merged: false`: direkte inhaltliche Integration, kein PR-Merge.

Maschinenlesbarer Herkunftsnachweis: [consolidation.json](./consolidation.json), einschließlich vollständiger Quell-SHAs, Original-Dateihashes, ursprünglicher Party-Metadaten und aktueller Aliaszuordnung. Die jeweiligen Branches sind nach erneutem Abgleich und gesichertem Push vollständig entbehrlich. Keine Löschung von `main` und kein Force-Push.

## Erhaltene und ergänzte Inhalte

- Alle 18 Pakete V2-00 bis V2-17 bleiben `planned`. Beschreibung (`goal`), Priorität, Abhängigkeiten, Dateien, Sicherheit, Akzeptanz und leere spätere Test-/Commitnachweise sind vorhanden.
- Jedes Paket ist über `public_roadmap_ids` mit echten Besucher-Einträgen verbunden. Ein Test prüft eindeutige Zuordnung, offene Statuswerte und einen zyklenfreien Abhängigkeitsgraphen.
- `gebietskampf` und `staedtehandel` bleiben dieselben einzelnen Backlog-IDs mit Risiko-/Catan-Inspirationshinweisen; keine neuen Spielmodule oder Duplikate.
- Bestehendes Redesign wird erhalten. V2-06 plant dessen künftige Konto-/Profilintegration, kein erneutes Redesign und keine falsche V2-Fertigmeldung.
- Fünf fehlende alte Ideen werden nur als `planned`/`spaeter` gesichert: `turmbauer`, `geschenkdiebe`, `fallenbauer`, `reaktor-notfall`, `bomben-duell`. Ihre Regeln sind vorläufige Planungsbeschreibungen, keine implementierte Spiellogik. `stille-post` verweist auf das vorhandene `kritzelpost`, `gedaechtniskueche` auf `gedaechtnis-kueche`. Damit sind zehn Ideen bereits umgesetzt und 18 weiterhin geplant.
- Historische abgeschlossene Etappen, Daten und relative Reihenfolge vorhandener Etappen bleiben erhalten. Der aktuelle Arbeitsschritt bleibt `benachrichtigungen`; V2 wird nicht eigenmächtig vorgezogen.
- Die Main-Only-Regel steht in `AGENTS.md`, `CLAUDE.md`, Projekt-README und Planung. Der historische `PROMPT.md` ist als Archiv gekennzeichnet. Quellen und Planung erteilen keine Implementierungsfreigabe.

## Workflow-/Betriebsprüfung

Auf main existiert ausschließlich `.github/workflows/docker.yml`: Push auf main oder manueller Workflowstart → Node 22 → `npm ci` → `npm test` → Build und Veröffentlichung von `ghcr.io/ttlpscwa/pokerabend:latest`. Kein SSH, kein Server-Compose-Aufruf, kein Repository-Workflow mit Produktivdeployment. Auch die untersuchten Altbranches bringen keine zusätzlichen Deployment-Workflows mit.

Compose-Dateien und Volumes bleiben unverändert; keine produktiven Cookies, Raumcodes, Spielstände oder Daten werden verändert. `.env` wurde nicht gelesen oder geändert. Ein Image-Push allein startet aus dieser Repository-Konfiguration keinen Server neu; außerhalb des Repositories eingerichtete Automatismen wurden nicht behauptet oder verändert.

## Abnahme

- `node --test test/roadmap.test.js test/planned.test.js test/v2-roadmap.test.js`: **14/14 bestanden**. Der erste Lauf zeigte die erwartete noch fehlende Ergänzung der fünf übernommenen IDs in der bisherigen Backlog-Vollständigkeitsprüfung; diese Erwartung wurde ergänzt. Auch der abschließende Lauf nach plattformunabhängiger Normalisierung der Zeilenenden im Archiv-Hashvergleich ist grün.
- `npm.cmd test`: **738/738 bestanden**, keine übersprungenen Tests, Exitcode 0, 61,1 Sekunden. Log: `artifacts/consolidation-unit.log`.
- `node node_modules/@playwright/test/cli.js test test/ui/roadmap-presence.spec.js test/ui/lobby-menu.spec.js test/ui/block-a.spec.js`: **24/24 bestanden**, Desktop/Mobil, Exitcode 0, 2,0 Minuten. Einschließlich öffentlicher V2-Planungen, Nichtstartbarkeit geplanter Spiele, erhaltenem 46-Spiele-Katalog, Host-Dialogen, Navigation, Presence und Zugriffsschutz. Log: `artifacts/consolidation-ui.log`; Screenshots in den zugehörigen Playwright-Ausgabeverzeichnissen unter `test-results/`.
- `git diff --check`: ohne Fehler. Der Änderungsumfang wurde auf Dokumentation, die beiden Roadmap-Metadatendateien und die dazugehörigen Tests geprüft. Keine Änderung an `server/`, `public/`, Spielmodulen, Paketabhängigkeiten oder Docker-/Workflow-Konfiguration.

Geänderte Dateien: `AGENTS.md`, `CLAUDE.md`, `PROMPT.md`, `README.md`; `docs/roadmap/{README.md,DESIGN_GUIDE.md,MASTERPROMPT_V2_SOURCE.md,POKERABEND_V2_ROADMAP.md,V2_ADDENDUM_2026-10-30.md,plan.json,consolidation.json,CONSOLIDATION_2026-10-30.md}`; `games/{planned.js,roadmap.js}`; `test/{planned.test.js,roadmap.test.js,v2-roadmap.test.js}`; `test/ui/roadmap-presence.spec.js`.

Vor Commit/Push wurde origin/main erneut geprüft; der Änderungsstand wurde direkt als `6c25412` nach main übertragen. GitHub Actions [41080052021](https://github.com/TTLPSCWA/PokerAbend/actions/runs/41080052021) war erfolgreich: Node-Tests, Docker-Build und GHCR-Veröffentlichung. Kein Produktivdeployment.

## Verifizierter Bereinigungsstand

Nach dem gesicherten Push und grüner CI wurden die Quell-SHAs nochmals mit den unveränderten Remote-Branches verglichen. Zusätzlich wurden alle 18 ursprünglichen Sicherheitsanforderungslisten, Abhängigkeiten, Prioritäten und Akzeptanzkriterien mit der konsolidierten Planung verglichen (nur die belegte Spielanzahl wurde aktualisiert); das Quellarchiv stimmt im Git-Inhalt mit seinem Ursprung überein.

Gelöschte Remote-Branches: `planning/pokerabend-v2-roadmap`, `docs/public-roadmap-v2-ideas` und der vollständig abgelöste `feature/partyspiel`. Gelöschter lokaler Branch: `feat/liquid-glass-game-library`. Kein Force-Push, keine Änderung von main durch die Löschbefehle. GitHub meldete danach ausschließlich `main`; PR #1 bis #4 sind geschlossen, kein offener PR bleibt bestehen. Der maschinenlesbare Bereinigungsnachweis steht in `consolidation.json`.

Keine offenen inhaltlichen Übernahmepunkte. Die tatsächliche Sichtbarkeit der neuen Roadmap-Daten auf einer laufenden Webseite setzt wie bisher ein separat freigegebenes Serverupdate voraus. Nach diesem Dokumentationsabschluss endet der Auftrag; kein V2-Paket wurde begonnen.
