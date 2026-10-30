# PokerAbend V2 – Roadmap (nur Planung)
> **Nicht implementieren**, bis der Nutzer ausdrücklich die Arbeit an einer benannten ID freigibt.
> Stand: 30. Oktober 2026 · Baseline: `main` `9b60e302e6ab` · 45 registrierte Spiele.
> Maschinenlesbarer Status: [plan.json](./plan.json). Vollständiger Ursprung: [MASTERPROMPT_V2_SOURCE.md](./MASTERPROMPT_V2_SOURCE.md).

## Ziel
Ein dauerhaftes, optionales Discord-Accountsystem mit verifizierter Identität für Rankings und Erfolge, echte temporäre Gäste, unveränderte Computerbots, öffentliche zufällige Game-IDs, personalisierbare Ansichten und das reduzierte Liquid-Glass-Design. Optional später eine sichere eigene Browser-Tischkamera (nicht Discord-Videocall) – **keine Freundesliste, kein 3D**.

## Arbeitspakete
| ID | Priorität | Inhalt | Voraussetzung | Status |
|---|---|---|---|---|
| V2-00 | critical | Bestandsaufnahme, Sicherheitsmodell und Daten-Sicherung | – | Geplant |
| V2-01 | critical | Plattformidentität: Accounts, Gäste, Bots und persistente IDs | V2-00 | Geplant |
| V2-02 | critical | Discord OAuth2 und Sitzungssicherheit | V2-01 | Geplant |
| V2-03 | critical | Ranked-Ergebnisse und historische Bestenlisten | V2-01, V2-02 | Geplant |
| V2-04 | high | Spielerprofile, Erfolge und Game-ID | V2-03 | Geplant |
| V2-05 | high | Personalisierung und Datenschutz-Einstellungen | V2-01, V2-02 | Geplant |
| V2-06 | high | Minimales Liquid-Glass-Redesign | V2-02, V2-04, V2-05 | Geplant |
| V2-07 | high | Bestehende Tickets, Planungen, Rückblicke und Presence sicher integrieren | V2-01, V2-02, V2-05 | Geplant |
| V2-08 | later | Optionale sichere Tischkamera per WebRTC | V2-01, V2-02 | Geplant |
| V2-09 | critical | Regressionstests, Sicherheit und Datenschutz | V2-03, V2-04, V2-05, V2-06, V2-07, V2-08 | Geplant |
| V2-10 | high | Deployment-Plan, Feature-Flags und Übergabe | V2-09 | Geplant |

## Umsetzungsgrenzen
- Namen dürfen weder zur Accountidentifizierung noch zur Bot-Filterung oder Rechtezuordnung dienen.
- Alte namensbasierte Bestenlisten historisch getrennt und unverändert archivieren, nicht namensgleich einem Discord-Konto zuschreiben.
- `SITE_PASSWORD`, `TICKET_ADMIN_PASSWORD`, Cookies, Räume, Reconnect und bestehende Datenweiterverarbeitung kompatibel halten.
- Gastspieler dürfen alle normalen Lobbys benutzen, erhalten aber keine öffentlichen Ranked-Einträge.
- Der Server entscheidet Ranked-Berechtigung vor Rundenbeginn; nur echte, voneinander verschiedene registrierte Menschen, keine Bots/Gäste.
- Benutzerpräferenzen dürfen Kategorien und Errungenschaften ausblenden; Privacy-Einstellungen müssen getrennt abgesichert sein.
- Video ist standardmäßig AUS, keine Mikrofonnutzung, keine Aufnahme, keine direkte Discord-Videoübernahme; HTTPS und abgesicherter TURN-Betrieb als Pflicht zur Freischaltung.
- UI: atmosphärischer **einziger** Hintergrund, ruhige transparente Flächen, minimalistische Karten/Kategorien mit kleinen Icons; keine Foto-Duplikate.
- Weder Website-Roadmap (`games/roadmap.js`) noch Spielregeln durch einen Planungsauftrag verändern.

## Nächste konkrete Agent-Anweisung
`Lies AGENTS.md (Codex) bzw. CLAUDE.md (Claude Code) und docs/roadmap/plan.json sowie die archivierte Quelle. Zeige den Planungsstand. Implementiere nichts, solange ich nicht ausdrücklich ein Paket freigebe.`

## Nach Freigabe eines Arbeitspakets
1. Aktuellen Repository-Stand und Abhängigkeiten gegen `plan.json` prüfen.
2. Nur das benannte Paket in separatem Feature-Branch implementieren.
3. Risiken und Akzeptanzkriterien dieses Pakets testen, ohne vorhandene Funktionen zu verlieren.
4. Ergebnisse/Blockaden konkret dokumentieren, `plan.json` erst nach belegtem Abschluss aktualisieren.
5. Kein Produktivdeploy ohne ausdrückliche Zustimmung.
