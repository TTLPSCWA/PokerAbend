# Auftrag QA-CI-01

- Beginn (UTC): 2026-11-20T05:02:15.755Z
- Ende (UTC): 2026-11-20T06:00:27.873Z
- Beteiligte: codex

## Vollständiger Verlauf

- 2026-11-20T05:02:15.755Z · codex · QA-CI-01 · START · NACHRICHT · Lokale Ursachenanalyse und isolierte Korrekturen fuer die Nachtlaeufe #220–#223. Kein Commit, Push oder Deployment.
- 2026-11-20T05:02:15.825Z · codex · QA-CI-01 · QUESTION · NACHRICHT · Claude Code: Falls aktiv, bitte unabhängige Gegenprüfung der Werwolf-/Audio-/Animationsfehler unter einer separaten Auftrags-ID anbieten. Codex beginnt mit Capture und Poker. Keine Dateien ohne Reservierung ändern.
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/helpers.js
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/experience-helpers.spec.js
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-helpers.js
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/art-w4-deck-worlds.spec.js
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-poker.spec.js
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/readme.md
- 2026-11-20T05:04:08.580Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: games/five-card-draw/poker-regression.spec.js
- 2026-11-20T05:08:24.339Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/visual-p1.spec.js
- 2026-11-20T05:08:24.339Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-scotland-yard.spec.js
- 2026-11-20T05:08:24.339Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-werwolf.spec.js
- 2026-11-20T05:08:24.485Z · codex · QA-CI-01 · INFO · TEST · Baseline: Mau-Mau und Werwolf fehlender Server-View, Poker optische Differenz, Pfeilfieber Nullbox lokal erneut. Korrekturen sind auf Testdateien begrenzt.
- 2026-11-20T05:12:54.799Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/realtime.spec.js
- 2026-11-20T05:12:54.884Z · codex · QA-CI-01 · INFO · TEST · Ursache Capture: Playwright hängt beforeEach an die aktuell geladene Dateisuite; ein gecachtes Hilfsmodul richtet den Hook nicht für weitere Dateien ein. Fixture registriert jetzt je Seite. Bröckelboden mobil: Trace zeigt weder Bewegung noch akzeptierten Sprung bei gemischter Touch-/Mauseingabe.
- 2026-11-20T05:17:05.963Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-huetchen.spec.js
- 2026-11-20T05:20:39.599Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: public/games/kit.js
- 2026-11-20T05:22:52.132Z · codex · QA-CI-01 · INFO · TEST · Audio: Hütchen-Neuladen am eigenen Zug mit verzögertem Experience-Import scheiterte auf Desktop und Mobil. GameKit unterdrückt den Ton beim Wiederherstellungs-Snapshot, Live-Zugwechsel bleiben hörbar. Vollständiger Node-Lauf 2250/0/13. · Bezug: public/games/kit.js, test/ui/exp-huetchen.spec.js
- 2026-11-20T05:39:31.027Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/ui/exp-reaktor-notfall.spec.js
- 2026-11-20T05:40:20.461Z · codex · QA-CI-01 · INFO · TEST · Reaktor-Notfall: Originaler Motion-Timeout lokal reproduziert. Live-Thermometer und Rohre erzeugen laufend CSS-Übergänge; die Testpartie pausiert erst nach dem Echtzeit-Alarmnachweis für die isolierte Rettungsanimation. Grenzwerte bleiben bestehen. · Bezug: test/ui/exp-reaktor-notfall.spec.js
- 2026-11-20T05:46:55.705Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: test/fixtures/release-2026-11-08/source-audit.json
- 2026-11-20T06:00:27.519Z · codex · QA-CI-01 · CLAIM · NACHRICHT · Reserviert · Bezug: docs/agents/sessions/qa-ci-01.md
- 2026-11-20T06:00:27.668Z · codex · QA-CI-01 · INFO · TEST · Relevante Windows-Chromium-Suite: 121 grün, 3 rot, 2 vorhandene Skip-Fälle. Reaktor anschließend 8/8 und die beiden Leistungsfälle jeweils 2/2 grün. Finale Echtzeitregression 12/12 grün. Node-Endlauf 2248 bestanden, 2 Umgebungsfehler, 13 bestehende Auslassungen; betroffene Discord-/Koordinationsdateien separat 11/11 und 5/5 grün.
- 2026-11-20T06:00:27.739Z · codex · QA-CI-01 · HANDOFF · OFFEN · Review an den Projektinhaber. 15 lokale Projektdateien für Capture, Testaufbau und GameKit-Audio. Der GitHub-Nachtlauf auf dem Kandidatencommit steht nach separater Freigabe aus. Lokale Leistungsschwankungen und Countdown unter Last bleiben dokumentiert. V3-Entwürfe unverändert. Keine neue Claude-Rückmeldung zu QA-CI-01.
- 2026-11-20T06:00:27.806Z · codex · QA-CI-01 · DONE · NACHRICHT · Lokale Korrekturen und lokal mögliche Gegenprüfungen abgeschlossen. Bericht in Vault-Backups/qa-ci-01-2026-11-20/ABNAHME-QA-CI-01.md. Keine Commit-, Push- oder Deploymentfreigabe verwendet.
- 2026-11-20T06:00:27.873Z · codex · QA-CI-01 · RELEASE · NACHRICHT · Freigegeben · Bezug: test/ui/helpers.js, test/ui/experience-helpers.spec.js, test/ui/exp-helpers.js, test/ui/art-w4-deck-worlds.spec.js, test/ui/exp-poker.spec.js, test/ui/readme.md, games/five-card-draw/poker-regression.spec.js, test/ui/visual-p1.spec.js, test/ui/exp-scotland-yard.spec.js, test/ui/exp-werwolf.spec.js, test/ui/realtime.spec.js, test/ui/exp-huetchen.spec.js, public/games/kit.js, test/ui/exp-reaktor-notfall.spec.js, test/fixtures/release-2026-11-08/source-audit.json, docs/agents/sessions/qa-ci-01.md

## Entscheidungen, Tests, Commits und offene Punkte

- 2026-11-20T05:08:24.485Z · codex · QA-CI-01 · INFO · TEST · Baseline: Mau-Mau und Werwolf fehlender Server-View, Poker optische Differenz, Pfeilfieber Nullbox lokal erneut. Korrekturen sind auf Testdateien begrenzt.
- 2026-11-20T05:12:54.884Z · codex · QA-CI-01 · INFO · TEST · Ursache Capture: Playwright hängt beforeEach an die aktuell geladene Dateisuite; ein gecachtes Hilfsmodul richtet den Hook nicht für weitere Dateien ein. Fixture registriert jetzt je Seite. Bröckelboden mobil: Trace zeigt weder Bewegung noch akzeptierten Sprung bei gemischter Touch-/Mauseingabe.
- 2026-11-20T05:22:52.132Z · codex · QA-CI-01 · INFO · TEST · Audio: Hütchen-Neuladen am eigenen Zug mit verzögertem Experience-Import scheiterte auf Desktop und Mobil. GameKit unterdrückt den Ton beim Wiederherstellungs-Snapshot, Live-Zugwechsel bleiben hörbar. Vollständiger Node-Lauf 2250/0/13. · Bezug: public/games/kit.js, test/ui/exp-huetchen.spec.js
- 2026-11-20T05:40:20.461Z · codex · QA-CI-01 · INFO · TEST · Reaktor-Notfall: Originaler Motion-Timeout lokal reproduziert. Live-Thermometer und Rohre erzeugen laufend CSS-Übergänge; die Testpartie pausiert erst nach dem Echtzeit-Alarmnachweis für die isolierte Rettungsanimation. Grenzwerte bleiben bestehen. · Bezug: test/ui/exp-reaktor-notfall.spec.js
- 2026-11-20T06:00:27.668Z · codex · QA-CI-01 · INFO · TEST · Relevante Windows-Chromium-Suite: 121 grün, 3 rot, 2 vorhandene Skip-Fälle. Reaktor anschließend 8/8 und die beiden Leistungsfälle jeweils 2/2 grün. Finale Echtzeitregression 12/12 grün. Node-Endlauf 2248 bestanden, 2 Umgebungsfehler, 13 bestehende Auslassungen; betroffene Discord-/Koordinationsdateien separat 11/11 und 5/5 grün.
- 2026-11-20T06:00:27.739Z · codex · QA-CI-01 · HANDOFF · OFFEN · Review an den Projektinhaber. 15 lokale Projektdateien für Capture, Testaufbau und GameKit-Audio. Der GitHub-Nachtlauf auf dem Kandidatencommit steht nach separater Freigabe aus. Lokale Leistungsschwankungen und Countdown unter Last bleiben dokumentiert. V3-Entwürfe unverändert. Keine neue Claude-Rückmeldung zu QA-CI-01.
- 2026-11-20T06:00:27.806Z · codex · QA-CI-01 · DONE · NACHRICHT · Lokale Korrekturen und lokal mögliche Gegenprüfungen abgeschlossen. Bericht in Vault-Backups/qa-ci-01-2026-11-20/ABNAHME-QA-CI-01.md. Keine Commit-, Push- oder Deploymentfreigabe verwendet.

## Nachtrag 20.11.2026 (Abschluss QA-CI-01, nicht Teil des ursprünglichen Verlaufs)

Der obige Verlauf ist unverändert. Ergänzt wird nur, was danach geschah und in den sechs archivierten Protokollen nicht steht:

- Die Gegenprüfungen und Delta-Reviews durch Claude Code (Einstufung jeweils B) und die Release-Vorbereitung wurden unter den Auftrags-IDs `QA-CI-01-REVIEW3`, `QA-CI-01-DELTA` und `QA-CI-01-RELEASE` geführt und sind hier nicht archiviert.
- Ergebnis: Version 3.17.1, Commit `b2f47be`, Push-Lauf #227 grün, Volllauf #228 (manuell gestartet) grün.
- Die in den Protokollen genannten Berichte unter `Vault-Backups/qa-ci-01-2026-11-20/` liegen außerhalb des Repositorys und sind für Dritte nicht auflösbar.
- Dateinamen in den Einträgen sind in Kleinbuchstaben geschrieben (`qa-ci-01.md`); die Dateien heißen `QA-CI-01*.md`.
- Die Restpunkte (zweiter Audio-Fallback, Bröckelboden-Einzeltimeout, Leistungsschwankung unter Last) bleiben eigenständige Folgeaufgaben.
