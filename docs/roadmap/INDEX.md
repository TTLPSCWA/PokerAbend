# Entwicklungsindex (ROADMAP-01)

Der Index [roadmap-index.json](roadmap-index.json) führt alle Planungs- und Entwicklungseinträge des Projekts in einer maschinenlesbaren Liste zusammen. Er ist **abgeleitet** und ersetzt keine Quelle: Maßgeblich bleiben die Originaldateien. Er wird mit `scripts/build-roadmap-index.mjs` erzeugt und nie von Hand geändert. Der Generator liest nur und schreibt ausschließlich diese eine Datei.

Der Index ist weder die öffentliche Roadmap im Hub (`games/roadmap.js`, ROADMAP-02) noch ein Auftrag: Ein Eintrag im Index gibt nichts frei. Umsetzungen brauchen weiterhin die ausdrückliche Freigabe der betreffenden ID.

## Verwendung

```bash
node scripts/build-roadmap-index.mjs            # erzeugen, prüfen, Zusammenfassung (schreibt nichts)
node scripts/build-roadmap-index.mjs --check    # zusätzlich mit roadmap-index.json vergleichen (Exit 1 bei Abweichung)
node scripts/build-roadmap-index.mjs --write    # roadmap-index.json neu erzeugen (nur wenn keine Probleme vorliegen)
node scripts/build-roadmap-index.mjs --check-ci # manuelle, netzabhängige Prüfung der erfassten CI-Läufe gegen GitHub (nicht Teil der Tests)
```

Die normale Prüfung und `--check` brauchen keinen Netzwerkzugriff. Der Test `test/roadmap-index.test.js` (ROAD-T01 bis T08 plus Mutationsfälle) schlägt fehl, sobald eine Quelle sich ändert, ohne dass der Index neu erzeugt wurde. Die Meldung nennt den Befehl. **Das gilt künftig für jede Änderung an einer der unten genannten Quellen**, auch beim Ergänzen eines Spiels oder Pakets: danach `--write` ausführen und die geänderte `roadmap-index.json` mit committen.

## Quellen und Rollen

| Rolle | Quelle | Inhalt |
| --- | --- | --- |
| maßgeblich | `docs/roadmap/plan.json` | V2-Pakete |
| maßgeblich | `docs/backlog/plan.json` | „Weitere Spiele“ (selbst als Fortschrittsschnappschuss bezeichnet), Feature-Paket |
| maßgeblich | `docs/design/game-visual-roadmap.json` | VIS |
| maßgeblich | `GAME_EXPERIENCE_ROADMAP.md`, `GAME_ART_ROADMAP.md` | EXP, ART (Markdown ist die Quelle) |
| abgeleitet | `game-experience-roadmap.json`, `game-art-roadmap.json` | per `build-experience-roadmap.mjs` bzw. `build-art-roadmap.mjs` erzeugt |
| maßgeblich | `docs/design/card-interaction-roadmap.json` | CUX |
| maßgeblich | `games/index.js`, `games/singleplayer/index.js` | Spielbarkeit und Varianten (Registrierung) |
| maßgeblich | `games/planned.js` | kuratierte künftige Spiele (derzeit leer) |
| maßgeblich | `docs/roadmap/public-roadmap.json` | kuratierte Besucher-Roadmap (ROADMAP-02); der Index validiert und ordnet sie zu, ersetzt sie nicht |
| Anzeige | `games/roadmap.js` | öffentliche Hub-Roadmap, handgepflegt, kein Arbeitsnachweis |
| maßgeblich | [roadmap-index-input.json](roadmap-index-input.json) | V3-Pakete, CI-Nachweise, Produktivbeobachtung, offene Punkte. Für diese Bereiche gibt es keinen anderen maschinenlesbaren Ursprung. |
| historisch | `consolidation.json`, `CONSOLIDATION_2026-10-30.md`, `MASTERPROMPT_V2_SOURCE.md`, `PROMPT.md` | keine Aufträge |
| Nachweis | `CHANGELOG.md`, `docs/v3-entwurf/README.md` | Version, V3-Plan und Nachträge |

Der Vault (Wissens- und Code-Vault) ist keine Quelle. Idle-Spiele erscheinen erst, wenn ein freigegebenes Repository-Paket oder eine Registrierung sie führt.

## Aufbau

Jeder Eintrag hat einen **Namensraum** und eine ID; der Schlüssel `namespace:id` ist eindeutig.

| Namensraum | Inhalt |
| --- | --- |
| `package` | Arbeitspakete: V2, Backlog (+ Feature-Paket), VIS, EXP (+ Fundament), ART (+ Kartenwelten, Themenwelten), CUX, V3 |
| `game` | registrierte Spiele (95 mehrspieler, 12 einzelspieler zum Erstellungszeitpunkt) und geplante Spiele; Querverweise auf VIS/EXP/ART/CUX/Backlog |
| `variant` | Varianten, `spiel/variante` |
| `stage` | Etappen der öffentlichen Hub-Roadmap (Anzeige) |
| `open-item` | dokumentierte offene Punkte und Folgeaufgaben |

Spiel-, Paket-, Varianten- und Alias-IDs werden nicht vermischt. Alte oder abweichende Namen stehen unter `aliases` (`CI-STABIL-01` → `QA-CI-01`; Verweise aus V2 auf Etappen und Punkte der Hub-Roadmap).

Je Eintrag: `area` (B Plattform, C Spiele, D Design, E Sicherheit/Betrieb/Tests, F Ideen; „aktiv“ und „abgeschlossen“ sind gefilterte Sichten unter `views`), `source` (Datei und Stelle), `source_status` (Originalwert, bleibt erhalten), `status` (normalisiert), `stages`, `evidence` und `diagnostics`.

## Status

Normalisiert: `planned`, `active`, `in-progress`, `paused`, `partial`, `done`, `verified`, `historical`. Die Abbildung steht im Index unter `status_map`:

- `done` und `verified` bleiben getrennt. `verified` wird nur übernommen, wo die Quelle es selbst sagt (Backlog), und für V3-Pakete, deren Implementierungscommit einen grünen CI-Volllauf hat.
- V2-Status laut `task_status_values`: `in_progress` und `review` → `in-progress`, `blocked` → `paused`, `planned` → `planned`, `done` → `done`.
- `planned` bleibt `planned`. Die Hub-Stufen `spaeter` und `gross` sind `planned`; `jetzt` allein ist **kein** Nachweis aktiver Arbeit und wird als `planned` mit Diagnose `unverified-active-label` geführt. `erledigt` wird `done` mit Diagnose `display-only-no-commit`, weil die Anzeige keinen Commit trägt.
- Ein erledigter Eintrag wird nie offen, ein geplanter nie erledigt (Prüfung und eingefrorener Ausgangsindex `test/fixtures/roadmap-index-baseline.json`).
- Fehlende Nachweise werden nicht ergänzt, sondern als Diagnose sichtbar: `missing-commit`, `invalid-commit`, `missing-evidence`, `unknown-source-status`. Ein unbekannter Originalstatus bricht die Prüfung ab.
- `paused` und `historical` sind im Vokabular, aber derzeit ohne Eintrag.

Je Eintrag trennt `stages` konsequent: `planned`, `implemented`, `ci_accepted`, `deployed`. `null` heißt „nicht belegt“. `deployed` ist nur mit Produktivbeleg zulässig (Healthcheck mit passender Version und passendem Build); ein grüner Lauf oder ein veröffentlichtes GHCR-Image ist kein Produktivdeployment. Die beobachtete Produktivversion steht unter `production_observation`.

## Pflege des handgepflegten Teils

`roadmap-index-input.json` enthält nur belegte Angaben. Beim Abschluss eines V3-Pakets dort Version, Commit, CI-Läufe und Lebenszyklus eintragen; `--check-ci` prüft die Läufe gegen GitHub. Ein Paket wird nur `ci_accepted`, wenn ein `kind: full`-Lauf mit `conclusion: success` auf dem Implementierungscommit eingetragen ist.

Erledigt ein abgenommenes V3-Paket einen Folgepunkt, verweist dessen `resolved_by` auf die Paket-ID. Der Folgepunkt behält seine ID und den ursprünglichen Quellverweis. Der Index führt ihn als `done` und übernimmt den belegten Commit des Pakets.

## Grenzen und Folgeaufgaben

- Der Index ändert keine Quelle, keine Hub-Roadmap und keinen Status. Veraltete Zahlen in `AGENTS.md`, `CLAUDE.md`, `docs/roadmap/README.md` und `POKERABEND_V2_ROADMAP.md` sind als `OPEN-DOC-RULES` erfasst und bleiben einem eigenen Dokumentationsauftrag vorbehalten.
- Die Prüfung `--check-ci` benötigt Netzwerk und läuft deshalb nicht im Test.
- Jede Änderung an einer Quelle verlangt ein neu erzeugtes `roadmap-index.json` (siehe Verwendung).
