# QA-CI-01 · Nachtläufe und reproduzierbare Fehleranalyse

**Stand 20.11.2026.** Die Untersuchung ist abgeschlossen. Korrekturen an Test- oder Anwendungscode benötigen eine eigene Freigabe. `CI-STABIL-01` war die Bezeichnung im technischen Review und verweist auf dieses Paket.

## Istzustand und Belege

Alle vier Nachtläufe liefen auf `cb2c167`. Jeder Node-Shard war erfolgreich. Die roten Browser-Jobs erreichten den Testschritt. Der Erfolg des Push-Laufs #225 auf `c3d3cd6` belegt Schnelltests und Browser-Rauchprobe. Der Push enthält keinen Ersatz für den Browser-Volllauf. Zwischen den Commits sind Anwendung, Browser-Tests, Playwright-Konfiguration und der Workflow in den verglichenen Pfaden laut Git-Bauminhalt unverändert. [Push #225](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44570876126)

| Nachtlauf | Node | Fehlgeschlagene Browser-Shards | Gesamtergebnis |
| --- | --- | --- | --- |
| [#220](https://github.com/TTLPSCWA/PokerAbend/actions/runs/43841868332) | 4/4 grün | 4, 6, 9, 10, 11 | fehlgeschlagen |
| [#221](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44067289170) | 4/4 grün | 1, 2, 3, 4, 9, 10 | fehlgeschlagen |
| [#222](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44282420577) | 4/4 grün | 4, 6, 9, 10 | fehlgeschlagen |
| [#223](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988) | 4/4 grün | 3, 4, 5, 9, 10 | fehlgeschlagen |

Die Logs aller **20 fehlgeschlagenen Browser-Jobs** wurden ausgewertet. Der Workflow nutzt Ubuntu, Node 22, Playwright Chromium, zwölf Browser-Shards sowie vier Node-Shards. Nacht-Browserprüfungen verwenden je einen Worker und unter CI einen Retry. Variierende Shards bzw. Wiederholungen allein belegen keine Infrastrukturursache. [Workflow](../../.github/workflows/docker.yml) · [Playwright-Konfiguration](../../playwright.config.js) · [Test-Orchestrierung](../../scripts/test-all.mjs)

## Klassifizierung und priorisierte Maßnahmen

| Befund | Nachweis und Einordnung | Maßnahme und Schweregrad |
| --- | --- | --- |
| **CI-01 · Server-View-Capture fehlt** | Mehrere Experience-Tests auf mobilem Shard 9 in allen vier Läufen, zusätzlich Desktop (u. a. #221 und #223 im Shard 3). Lokal Scotland Yard in beiden Ansichten reproduziert, Kronenjagd lokal grün. `observeServerView` wird bereits im gemeinsamen BeforeEach registriert. Die Beobachtung verwirft beim WebSocket-Ereignis die Verbindung endgültig, wenn der Host aus `page.url()` noch nicht passt. Sie erfasst ausschließlich WebSocket-Frames mit erwartetem Ereignis-/Payload-Format. Polling und frühe Navigationsmomente fehlen im Vertrag. In einer lokalen isolierten Zweigprobe mit der originalen Funktion wurden dieselben synthetischen Daten bei `about:blank` verworfen (0), bei passendem Host erfasst (1). Zwei einfache reale lokale Tische lieferten jeweils eine gültige erfasste Sicht. Welcher Ablehnungsgrund den konkreten Nachtfehler verursacht, bleibt offen. Fehler der Testinstrumentierung bzw. ihrer Synchronisierung nachgewiesen, kein nachgewiesener Datenleckbefund. [Helper](../../test/ui/helpers.js#L103) · [Snapshot-Assertion](../../test/ui/helpers.js#L225) · [CI-Job #223/9](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988/job/135492479616) | **Hoch / zuerst.** Runner-Zielorigin stabil aus der Testfixture übernehmen. Transport, beobachtete und angenommene Ereignisse sowie anonymisierte Ablehnungsgründe getrennt diagnostizieren. Auf erwarteten Tisch und relevante autoritative Zustandsrevision warten. Mehrseitige und wiederverbundene Tests derselben Runde abgleichen. Die absichtlich fehlende oder falsche Sicht muss weiter fehlschlagen. |
| **CI-02 · Poker-Chipgleichheit** | Derselbe Desktop-Test (Shard 4) und Mobiltest (Shard 10) scheiterten jedes Mal, lokal ebenfalls. Identität und Handnummer werden vorher erfolgreich geprüft. Before-Page ersetzt Poker-JS und -CSS durch gehashte ältere Fixtures. After-Page lädt den aktuellen Client. Der konkrete Unterschied betrifft Gradient gegen SVG-Chip, Abmessungen und Schatten. ART-002 liefert die SVG-Optik ausdrücklich. Der exakte Stylevergleich vermischt gewollte Designänderung und Spielregression. Kein Beleg für eine abweichende Hand. [Spec](../../games/five-card-draw/poker-regression.spec.js#L10) · [Baseline-CSS](../../games/five-card-draw/fixtures/poker-baseline.css#L190) · [Aktuelles ART-CSS](../../public/games/poker/art.css#L71) · [CI-Job #223/4](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988/job/135492480066) | **Hoch / deterministisch.** Fachlichen Zustand vor/nach Reconnect exakt weiter prüfen (Hand, Street, Spieler, Einsätze, Pot, Ergebnis). Darstellungsvergleich für denselben Theme-/Assetstand durchführen. Für beabsichtigte ART-Änderung einen expliziten visuellen Vertrag mit Größe, Sichtbarkeit und Bewegungsregeln prüfen. Keine pauschale Toleranz oder Entfernung der Assertion. |
| **CI-03 · Null-Bounding-Box** | Pfeilfieber und Sortierstation in #220/#222, Blackjack zusätzlich in #220. Pfeilfieber auf Desktop lokal reproduziert. Der Test prüft das sichtbare Spielfeld nach Reload, wechselt dann wiederholt das Viewportformat und liest eine Box ohne erneute Sichtbarkeits- bzw. Phasenprüfung. Ein kurzes Remount-/Ergebnisfenster oder ein echter Layoutausfall ist möglich. Die fehlende Synchronisierung ist belegt, ein bleibender Produktfehler ist offen. [Spec](../../test/ui/visual-p1.spec.js#L251) · [CI-Job #222/6](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44282420577/job/134726286025) | **Hoch.** Pro Größe auf beabsichtigte Szene und Phase synchronisieren, Nicht-Null-Box ausdrücklich fordern und Phase/Locator protokollieren. Breiten-, Overflow- und Reconnect-Assertions erhalten. Bleibt die gültige Szene bei stabilem Serverzustand unsichtbar, als Produktfehler annehmen und CSS/Renderer korrigieren. |
| **CI-04 · Bröckelboden und Browser-Timeouts** | In #220 mobil wartet die Testhilfe auf die Box der Links-Steuerung, in #223 Desktop auf „Springen“. Kontext geschlossen nach Testablauf. Der Echtzeittest startet die 10-Sekunden-Runde, wartet erst auf ein Frame und greift dann auf laufende Bedienelemente zu. In einem anderen visuellen Bröckelboden-Fall blockierte ein sichtbarer Ergebnisdialog den Hilfe-Klick. Lokal bestand der Echtzeitfall in beiden Ansichten. Verlorenes Zeit-/Phasenfenster plausibel, Ursache im konkreten Echtzeitlauf offen. [Echtzeit-Spec](../../test/ui/realtime.spec.js#L85) · [Mobil #220/11](https://github.com/TTLPSCWA/PokerAbend/actions/runs/43841868332/job/133212247242) · [Desktop #223/5](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988/job/135492479645) | **Mittel bis hoch.** Bedienbereitschaft, erstes bestätigtes aktives Frame, Eingabeannahme und Ergebnis getrennt aufzeichnen. Kurze Runde unter gleichen Bedingungen wiederholen. Cleanup und phasensichere Eingaben absichern. Wird der Sprung im aktiven Zustand serverseitig bestätigt und fehlt trotzdem im UI, Produktfehler separat beheben. Kein pauschal höheres Timeout. |
| **CI-05 · Scotland Yard, Animationsbudget** | In #223 wurde neben Capture-Ausfällen in einem Versuch die 900-ms-Grenze mit 2.000 ms überschritten. Die Assertion prüft sämtliche bisher aufgenommenen Animationen, obwohl normale Fahrt und Festnahme verschiedene Effekte sind. Der Code begrenzt Fahrt auf 900 ms und definiert Festnahme mit 2.000 ms. Die Zahl passt zur Festnahme, deren konkreter Übergang im Job ist nicht isoliert belegt. Lokal endete der gewählte Test vorher am Capture. Vertrag zwischen Messfenster und Effekt ist zu präzisieren. [Budget-Spec](../../test/ui/exp-scotland-yard.spec.js#L35) · [Effektcode](../../public/games/scotland-yard/experience.js#L41) · [CI-Job #223/9](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988/job/135492479616) | **Mittel.** Reale Fahrt und Festnahme separat auslösen. Pro Übergang nur neu gestartete Animationen prüfen. 900 ms für die Fahrt, Festnahme- und Reduced-Motion-Verträge separat nachweisen. Überschreitet die reale Fahrt ihr Budget weiterhin, Produktkorrektur statt Grenzwertänderung. |
| **CI-06 · Werwolf und andere Experience-Zustände** | Werwolf zeigt fehlenden Hahnklang (#220), fehlendes Vollmondattribut (#222) und 2→0 Finalelemente statt 1 (#223). Durch den Test direkt aufgerufene finale Präsentationen kommen neben dem laufenden Zustandsstrom vor. Vorzeitiges Cleanup bzw. doppelte Übergänge sind plausible Ursachen. Der lokale reduzierte Werwolf-Fall bestand zweimal. Bei Hütchen und Mau-Mau ist ein einzelner `beep` nach Reload belegt. Reaktor-Notfall meldete einen nicht beendeten Bewegungs-Abschnitt. Diese Familien sind noch nicht als Produktfehler oder Laufzeitinstabilität entschieden. [Werwolf-Test](../../test/ui/exp-werwolf.spec.js#L58) · [Finaleffekt](../../public/games/werwolf/experience.js#L80) · [Zeitmessung](../../test/ui/exp-helpers.js#L70) · [#223 Desktop](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44504508988/job/135492479830) | **Mittel.** Ereignis, Revision, Tonquelle und DOM-Lebenszyklus erfassen. Werwolf-Finale mit einem kontrollierten Zustandsübergang reproduzieren und separat mit echter Partie auf Duplikat/zu frühes Räumen prüfen. Kein Dummy-Snapshot als Ersatz für Geheimhaltungsprüfung. Für Sound Reload-Verhalten und echte laufende Runden getrennt messen. |
| **CI-07 · Umgebung und Leistungsstreuung** | #221 ART-008 misst 0,896 und 0,889 bei Mindestquote 0,90 trotz ähnlicher FPS. Browser- und Hostlast sind mögliche Einflussgrößen, ein belegter Installations- oder Runner-Ausfall fehlt. Alle betroffenen Browser-Jobs hatten den Testschritt erreicht. [CI-Job #221/1](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44067289170/job/133984134997) | **Mittel.** Ubuntu-/Browserbuild, CPU-Drosselung und Szenenreihenfolge reproduzieren. Rohmesswerte vergleichen. Bei stabilem Mehrverbrauch Produktursache untersuchen. Schwelle und Regeln für Ausreißer beibehalten. |

## Reproduktion und ausgeführte Gegenprobe

Eine isolierte Playwright-Stichprobe auf dem unveränderten UI-Stand `c3d3cd6` nutzte Windows, Node 24.22.0, Playwright 1.64.1 mit Chromium, einen Worker und keinen Retry. Der Testserver verwendet ein temporäres Datenverzeichnis. Die Ausgabe lag außerhalb des Repositories.

| Vorhandener Test | Desktop | Mobil |
| --- | --- | --- |
| Poker-Chip-Regression | Stylevergleich rot | Stylevergleich rot |
| EXP-001 Scotland Yard „Ticketklang“ | Capture fehlt | Capture fehlt |
| Pfeilfieber Visual-P1 | Null-Box reproduziert | grün |
| Bröckelboden Realtime | grün | grün |
| EXP-042 Kronenjagd „Burghof“ | grün | grün |
| EXP-036 Werwolf „Animationen reduzieren“ | grün | grün |

**Ergebnis: 7 bestanden, 5 fehlgeschlagen.** Für einen identischen Nachlauf unter Windows im separaten Ausgabeordner starten. `<Repo>` ist die lokale Repo-Wurzel. Die Kontrollserver bleiben lokal, die Tests werden unverändert geladen.

```powershell
$env:CI = 'true'
$env:PLAYWRIGHT_CHANNEL = 'chromium'
$env:EXP_CAPTURE = '0'
$env:VIS_P1_CAPTURE = '0'
$env:CLASSIC_CAPTURE_EVIDENCE = '0'
node '<Repo>/node_modules/playwright/cli.js' test --config '<Repo>/playwright.config.js' --output './probelauf' --workers=1 --retries=0 --grep 'Poker shared chip regression: poker,|Bröckelboden: Bots|pfeilfieber: Spielwelt|EXP-042: Burghof|EXP-001: Ticketklang|EXP-036: „Animationen reduzieren“'
```

Für den Linux-Vergleich eine isolierte Kopie des CI-Commits mit Node 22, Chromium und originaler CI-Konfiguration verwenden. Zuerst einzelne Specs und danach die zugehörigen Shards mit den Workflow-Befehlen ausführen. A/B-Läufe mit und ohne bekannte Lastbedingungen sind Diagnoseproben. Retries, Assertions, Verhalten und Zeitgrenzen des abschließenden Volllaufs bleiben erhalten. Im Report fehlende Reproduktion ausdrücklich kennzeichnen.

## Umfang, Abhängigkeiten, Aufwand und Abnahme

**Dateien.** Gemeinsame Capture-/Bewegungshilfen, die oben genannten Browser-Specs, Poker-Fixtures, Playwright-Konfiguration und die Nachtzusammenfassung zuerst prüfen. Produktmodule nur bei separat bestätigter Funktionsabweichung in einen ausdrücklich freigegebenen Korrekturschritt aufnehmen.

**Reihenfolge.** Capture vor weiteren Experience-Bewertungen, Poker-Oracle im selben Paket getrennt korrigieren. Danach Visual-/Realtime-Fälle und Effektbudgets differenzieren. Abschließend repräsentative Wiederholungen und vollständigen Nachtlauf auf demselben Kandidatencommit nachweisen. ROADMAP-01 kann als reiner Dokumentationsstrang unabhängig vorbereitet werden. AUTH/NAV-Auslieferung benötigt eine geeignete, reproduzierbare Browser-Baseline, damit alte Fehler von neuen Regressionen getrennt werden können.

**Aufwandsschätzung.** 3–5 Personentage für Testinstrumentierung, Korrektur der Vergleichsorakel und CI-Wiederholungen. Bestätigte Produktfehler separat schätzen und freigeben.

**Abnahme.** Kontrollfälle für ordentlich erfasste, fehlende und falsche Sichten verhalten sich wie vorgesehen. Der Poker-Test bestätigt Zustand und Theme gezielt. Visuelle Szenen und Echtzeitaktionen prüfen stabile Phasen weiter mit strikten Assertions. Alle sechs Fehlerfamilien plus Leistungsstreuung haben einen dokumentierten Nachweis oder einen offen verfolgten Befund. Keine deaktivierten, gelockerten oder übersprungenen Tests zur Korrektur. Suite, Retry-Fälle, Laufumgebung und Restbefunde für den Kandidatencommit dokumentieren.

## Nachtrag 20.11.2026 (Stand Version 3.17.1)

Der obige Text ist der Planungsstand bei `c3d3cd6`; Zeilenanker verweisen auf diesen Stand und können in der heutigen Codebasis abweichen. Die Aussage „Korrekturen benötigen eine eigene Freigabe“ ist überholt: Die Korrekturphase wurde freigegeben und umgesetzt.

- **Umsetzung:** Version 3.17.1, Commit `b2f47be` („fix(qa): stabilize server-view audits and browser regressions“). Die Umsetzung betrifft Testinstrumentierung (Server-View-Capture, DOM-Rekonstruktion, Poker-Abgleich), Testaufbau und Audio-Verhalten beim Wiederherstellen (GameKit).
- **Nachweis:** Push-Lauf #227 grün, vollständiger Volllauf #228 (manuell gestartet) grün mit 4 Node- und 12 Browser-Teilen, Zusammenfassung grün.
- **Zusätzlicher Befund:** Der Nachtlauf #226 vom 20.11.2026 (Commit `c3d3cd6`, vor der Korrektur) war rot. Ein Nachtlauf auf `b2f47be` oder neuer ist hier nicht belegt.
- **Restpunkte als eigenständige Folgeaufgaben:** zweiter Audio-Fallback, ein einzelner Bröckelboden-Timeout unter Last, lokale Leistungsschwankungen und Countdown unter Last (siehe Sitzungsarchive unter `docs/agents/sessions/QA-CI-01*.md`).
- **Bekannte Lastflakes seit NAV-01:** „Wellenwacht“ (Testwettlauf zwischen Fortsetzen und Auslesen der Turmwerte, auch auf `b2f47be` unter CPU-Last nachgewiesen) und „Meine Daten: Export“ auf Mobil (`Identity.gameId` beim Lesen noch leer).
