# PokerAbend V3 · Finalisierter Plan

**Stand 20.11.2026.** D1, D3, D5, N3 und P1 sind fachlich verbindlich. Die spätere technische Review-Liste dokumentiert frühere Empfehlungen. Bei Widerspruch gilt die ausdrückliche Produktentscheidung. Die fünf Pakete bleiben ohne Implementierungs- oder Betriebsfreigabe. Die CI-Untersuchung wurde ausgeführt.

| Paket | Inhalt und Abhängigkeit | Aufwand |
| --- | --- | --- |
| [QA-CI-01](QA-CI-01.md) | Nachtläufe #220–#223, lokale Gegenprobe, Ursachen und Korrekturfolge. Frühere Bezeichnung CI-STABIL-01. | Untersuchung abgeschlossen. Korrekturen geschätzt 3–5 Personentage. |
| [AUTH-01](AUTH-01.md) | OAuth-Identität getrennt von Websitezugang und optionaler Guild, geschützte Daten, Ranked. Gemeinsame Browser-Abnahme gegen die dokumentierte QA-Baseline. | 4–7 Personentage plus Betriebsprüfung |
| [NAV-01](NAV-01.md) | Persönliche Anzeige und Gastnavigation. Integrierte Abnahme benötigt den AUTH-01-Berechtigungsstatus. | 2–4 Personentage |
| [ROADMAP-01](ROADMAP-01.md) | Verbindliche Quellen und historischer Index. Unabhängig von AUTH/NAV vorbereitbar. | 2,5–4 Personentage |
| [ROADMAP-02](ROADMAP-02.md) | Kuratierte Besucheransicht nach ROADMAP-01 und mit nachgewiesenem Produktivstand. | 2,5–3,5 Personentage |
| [Testmatrix](TESTMATRIX.md) | Rollen, API, Abmeldung, Reconnect, Ranked, Datenbestand, Navigation und Produktivnachweis. | in den Paketen enthalten |

## Verbindliche Entscheidungen

- **D1.** Discord-Login funktioniert auch ohne Guild. Gruppenpasswort, OAuth-Sitzung und ein optionaler Guild-/Rollennachweis bleiben getrennt. Der Umstellungsschalter ist standardmäßig aus. Im aktivierten Exklusivmodus bleiben die geschützten Module bei fehlender Pflichtkonfiguration geschlossen und zeigen einen Konfigurationsfehler. Die bestehende Regel für den Websitezugang gilt weiter.
- **D3.** Ranked benötigt die passende aktive Sitzung beim Start und vor der Ergebnisbuchung. Ein zwischenzeitlicher Sitzungsverlust entzieht nur die Wertung dieser Partie. Wiederanmeldung stellt die verlorene Wertung nicht wieder her. Gast-/Bot-/Teilnehmerregeln, ungewertete Ergebnisse und bestehende Statistiken bleiben erhalten.
- **D5.** Tickets, Abendplanung, Bestenlisten einschließlich Legacy, Modulexporte und Abend-Rückblicke sind im aktivierten Exklusivmodus geschützt. Profile und Erfolge bleiben grundsätzlich zugänglich. Fremde Wettbewerbs- und Leistungswerte werden bei Gästen serverseitig redigiert. Eigene private Daten sowie Verwaltung und Löschung bleiben zugänglich.
- **N3.** Im Exklusivmodus ausgeblendete Reiter für Gäste, auf Desktop und Mobil. Direkte Seite mit verständlicher Anmeldeoption. Direkte API und Exportschnittstellen bleiben serverseitig geschützt. Bestehende Filter und gültige Spiellinks bleiben erhalten. Idle erst nach Registrierung.
- **P1.** Veröffentlichung setzt bestätigtes Produktivdeployment voraus. App-Version, laufender Build-Commit und Deploymentbeleg stehen getrennt im Nachweis.

## Drei getrennte Stände

| Ebene | Beleg |
| --- | --- |
| Lokale Planung und GitHub-main zum Prüfzeitpunkt | Version 3.17.0, `c3d3cd6`. 95 Mehrspieler und 12 Einzelspielertitel im unveränderten Katalog. [Commit](https://github.com/TTLPSCWA/PokerAbend/commit/c3d3cd6f15e7219cb27696a2d0db18827cafd4ac) |
| Build-/Teststatus | #225 auf `c3d3cd6` grün für Schnelltests, Rauchprobe und Imagebau. #220–#223 auf `cb2c167` fehlgeschlagen, alle 16 Node-Shards grün, insgesamt 20 fehlgeschlagene Browser-Shards. [Push #225](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44570876126) · [CI-Nachweise](QA-CI-01.md) |
| Tatsächlicher Produktivstand | Öffentlicher Healthcheck am 20.11.2026 um 03:29 Uhr Berlin: 3.17.0, Build `cb2c167`, ok. Der Zeitpunkt des erstmaligen Deployments bleibt offen. [Produktiv-Healthcheck](https://poker.scwagaming.com/health) |

## Empfohlene Freigabereihenfolge

1. **QA-CI-01 Korrekturphase freigeben.** Capture und Poker-Vergleich zuerst. Danach Null-Boxen, Echtzeitfenster und Animationen. Korrekturen anhand der gleichen Szenarien und eines vollständigen Nachtlaufs auf dem Kandidatenstand nachweisen. Bestätigte Produktfehler separat freigeben.
2. **AUTH-01 separat freigeben.** Sitzungsvertrag, Rückwärtskompatibilität und Ranked zuerst auf synthetischen Konten prüfen. Exklusivmodus in der Testumgebung mit und ohne optionale Guild testen, mit getrenntem Adminzugang und gesicherten Altbeständen. Standard aus. Produktivaktivierung erst nach Betreiberfreigabe.
3. **NAV-01 separat freigeben.** Anzeigefilter funktionsseitig unabhängig vorbereiten. Discord-Sichtbarkeit, Anmelde-Direktlinks und Abrufverweigerung gemeinsam gegen AUTH-01 abnehmen.
4. **ROADMAP-01 separat freigeben.** Kann parallel als eigener Dokumentationsstrang laufen. Quellen, Generatoren, alte IDs, Status und Nachweise vollständig prüfen, bevor bestehende Planungsdateien geändert werden.
5. **ROADMAP-02 nach ROADMAP-01.** Auswahl, Texte und Kompatibilitätsregeln prüfen. Vor öffentlicher Statusänderung aktuellen Produktivstand neu ermitteln. Veröffentlichung, Deployment und inhaltliche Freigabe bleiben eigene Entscheidungen.

## Noch ausdrücklich vom Projektinhaber freizugeben

Die Korrekturphase QA-CI-01, jedes der vier Umsetzungspakete einzeln sowie Aktivierung des Exklusivmodus und jede Veröffentlichung bzw. jedes Deployment. Für AUTH vorab noch die optionale Guild-/Rollenrichtlinie des Zielbetriebs, Provider-Störungs-/Recheck-Regel, die konkrete Feldgrenze für private Exporte, Admin-Parität und den vorgeschlagenen Umgang mit mehreren Sitzen desselben Kontos in Ranked bestätigen. Für ROADMAP-02 Besuchertexte und einzelnen Produktivnachweis redaktionell abnehmen. Diese Betriebs- und Detailfreigaben ändern die fünf bereits verbindlichen Produktentscheidungen nicht.

Der Claude-Code-Entwurf und seine Übergabe unter `V3-ANALYSE` wurden als Grundlage verwendet. Die abschließenden Befunde liegen im bestehenden Protokoll unter `V3-FINAL-PLAN`.

## Nachtrag 20.11.2026 (Stand Version 3.18.0)

Dieser Nachtrag ergänzt den Plan um den tatsächlichen Umsetzungsstand und ändert keine Entscheidung. Der obige Text beschreibt den Planungsstand bei `c3d3cd6` und wird nicht umgeschrieben.

| Paket | Stand | Beleg |
| --- | --- | --- |
| QA-CI-01 | **implementiert und abgenommen** (Version 3.17.1) | Commit `b2f47be`, Push-Lauf #227 grün, Volllauf #228 (manuell gestartet) grün mit 4 Node- und 12 Browser-Teilen. Der Nachtlauf #226 vom 20.11. lief noch auf `c3d3cd6` und war rot. |
| NAV-01 | **implementiert, CI-Volllauf grün** (Version 3.18.0) | Commit `0f14e19`, Push-Lauf #229 grün, Volllauf #230 (manuell gestartet, 20.11.2026, 19:23–19:53 UTC) grün mit 4 Node- und 12 Browser-Teilen. Restpunkte stehen in [NAV-01](NAV-01.md#nachtrag-20112026-stand-version-3180). N03 bleibt von AUTH-01 abhängig. |
| AUTH-01 | **geplant, nicht implementiert** | unverändert |
| ROADMAP-01 | **geplant, nicht implementiert** | unverändert |
| ROADMAP-02 | **geplant, nicht implementiert** | unverändert |

**Produktivstand:** Der öffentliche Healthcheck meldete nach dem Push von 3.18.0 weiterhin Version 3.17.0 mit Build `cb2c167`. Weder 3.17.1 noch 3.18.0 sind damit als produktiv bereitgestellt belegt. Für P1 gilt: Commit, Push und GHCR-Build sind kein Produktivnachweis.

**Begriffe:** *Entwurf* = beschrieben, nicht beauftragt. *Freigegeben* = Umsetzung ausdrücklich beauftragt. *Implementiert* = committet und gepusht. *Abgenommen* = der vollständige CI-Volllauf auf dem Commit ist grün. *Produktiv* = durch den Healthcheck mit passender Version und Build belegt.

**Weiterhin offen aus der Freigabeliste oben:** AUTH-01, ROADMAP-01 und ROADMAP-02 je einzeln, die Aktivierung des Exklusivmodus und jede Veröffentlichung bzw. jedes Deployment. Die Freigaben für die Korrekturphase QA-CI-01 und für NAV-01 wurden erteilt und sind abgeschlossen.

## Nachtrag 21.11.2026 (Version 3.19.1)

ROADMAP-02 wurde mit 3.19.0 umgesetzt und durch QA-REPAIR-01 in 3.19.1 korrigiert. Die Umsetzung ist abgeschlossen. Der separate Volllauf auf 3.19.1 wurde vom Projektinhaber bewusst übersprungen. Besucherfreigabe und Produktivdeployment stehen aus. Der anschließende Auftrag gibt AUTH-01 und den abhängigen NAV-01-Restpunkt N03 zur Entwicklung frei. [Nachweise zu ROADMAP-02](ROADMAP-02.md#nachtrag-21112026)

## Nachtrag 21.11.2026 (Version 3.20.2)

AUTH-01 und NAV-N03 sind mit 3.20.2 auf `main` umgesetzt und im Volllauf #241 abgenommen. Der Release-SHA ist `28a9e3f0015b78550109c84a2f1b6a36654f9c64`. Der Discord-Exklusivmodus ist standardmäßig aus. Die Aktivierung mit produktivem Discord-Client erfordert eine eigene Betriebsfreigabe. [AUTH-Abnahme](AUTH-01.md#abnahme-21112026) · [GitHub Actions #241](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305)

ROADMAP-01 behält seine Nachweishistorie. #241 ergänzt die ROADMAP-02-Regressionsprüfung auf 3.20.2. Der eigenständige Lauf auf 3.19.1 wurde bewusst übersprungen. Die Besucherfreigabe steht aus. [ROADMAP-02](ROADMAP-02.md#integrierter-regressionsnachweis)
