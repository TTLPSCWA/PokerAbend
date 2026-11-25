# Idle-Wörterbuch: Kennungen und Ressourcen

Verbindlicher ID- und Ressourcenvertrag für die drei Idle-Spiele, Stand IDLE-FREEZE-01 (Version 3.27.0). Grundlage ist das Wörterbuch Version 0.1 aus der Querschnittsvorbereitung. Geprüft wird es durch CORE-014 und CORE-015 in [idle-freeze.test.js](../test/idle-freeze.test.js).

## Namensräume (CORE-014)

Eine Kennung löst genau einen Zieltyp auf. Die Muster überschneiden sich nicht.

| Zieltyp | Muster | Beispiele | Quelle |
| --- | --- | --- | --- |
| Phase | `SH-P1`–`SH-P5`, `GS-P1`–`GS-P5`, `FE-P1`–`FE-P5` | `FE-P4` | [progression.js](../public/idle/progression.js), Snapshot-Feld `phase` |
| Testfall | `CORE-`, `SAVE-`, `SH-`, `GS-`, `FE-` mit drei Ziffern | `SH-009`, `CORE-015`, `SAVE-016` | Testtitel in `test/*.test.js` |
| Arbeitspaket | `IDLE-` mit zwei Ziffern und optional A/B, `IDLE-D00`–`IDLE-D05` (optional `.1`), `IDLE-FREEZE-` mit zwei Ziffern | `IDLE-02B`, `IDLE-D04.1`, `IDLE-FREEZE-01` | Roadmap und Vault |
| Bildschirm (Screen) | `SH-SCR-…`, `GS-SCR-…`, `FE-SCR-…` | `FE-SCR-RAIL` | Designentwürfe IDLE-D03 |
| Phasenauslöser | `SH-TRG-P1`–`P5` usw. | `GS-TRG-P3` | Designentwürfe IDLE-D03 |

**Altlabels:** Zweistellige Kurzformen wie `SH-03` stammen aus den v1-Entwürfen. Sie konnten eine Phase oder einen Screen bezeichnen. Eine solche Kennung wird nur mit ausdrücklichem Kontext (Phase oder Screen) aufgelöst, sonst gar nicht. Kennungen anderer Planungen wie `EXP-`, `VIS-` und `ART-` liegen außerhalb dieses Wörterbuchs.

## Versionen und Altstände (CORE-015)

| Spiel | Spiel-ID | `stateVersion` | `rulesVersion` | Registrierte Migration |
| --- | --- | --- | --- | --- |
| Die Spielhalle | `spielhalle` | 1 | 1 | keine |
| Game Studio Tycoon | `studio` | 1 | 1 | keine |
| Factory Empire | `factory` | 2 | 2 | keine (1/1 wird abgelehnt) |

- **Feldvertrag:** Ein Spielzustand enthält genau die Felder seiner aktuellen Version (`sameFields` in [engine.js](../public/idle/engine.js)). Ein zusätzliches oder umbenanntes Altfeld führt zu `invalid-game-state`. Eine fremde Zustands- oder Regelversion ohne registrierte Migration führt zu `unsupported-version`. Der gespeicherte Datensatz bleibt in beiden Fällen bytegleich.
- **Keine Altbestände:** Es gibt keine gültigen Spielstände vor den oben genannten Versionen. Die v1- und v1.2-Entwürfe waren reine Designquellen. Produktiv lief vor 3.23.0 kein Idle-Spiel, und die Spiele sind standardmäßig abgeschaltet. **Die Bestätigung des Betreibers steht aus.** Bis dahin bleibt das zugehörige Abnahmekriterium offen.
- **Falls doch Altbestände auftauchen:** Je Quellversion ist ein fachlicher Vertrag nötig: welches Feld autorisiert ist, wie Konflikte behandelt werden, wie Lebenszeit- und verfügbare Werte getrennt werden. Dazu kommen eine registrierte Migration mit Prüfung in [runtime.js](../server/idle/runtime.js) und Testdaten. Für Factory 1/1 → 2/2 genügte eine Ergänzung von `skipped: '0'` an laufenden Manifesten. Die bereits geladene Fracht kommt dann wie unter Regelversion 1 an.

## Ressourcen

Mengen sind Dezimalstrings mit ganzzahligen Untereinheiten (BigInt). **Verfügbar** wird durch Ausgaben kleiner, **Lebenszeit** wächst nur. Die beiden Arten dürfen nie verrechnet werden.

### Die Spielhalle

| Feld | Bedeutung | Art | Einheit |
| --- | --- | --- | --- |
| `coins` | Kasse | verfügbar | Münzen × 10¹² |
| `guests` | bediente Gäste im Run (Fakt `servedGuests`) | Lebenszeit | Gäste × 10¹² |
| `revenue` | Run-Umsatz (Fakt `runRevenue`) | Lebenszeit | Münzen × 10¹² |
| `casino` | Casino-Umsatz (Fakt `casinoRevenue`) | Lebenszeit | Münzen × 10¹² |
| `knowledge` / `spentKnowledge` | Know-how gesamt und ausgegebene Forschungspunkte. Verfügbar ist `knowledge / (200 × 10¹²) − spentKnowledge` | Lebenszeit / Zähler | Untereinheiten / Punkte |
| `locations[].guests`, `locations[].reputation` | Gäste und Ruf je Standort | Lebenszeit | × 10¹² |
| `claims`, `stars` | Prestige-Ansprüche und Sterne | dauerhaft über Runs | Kennungen / Anzahl |

### Game Studio Tycoon

| Feld | Bedeutung | Art | Einheit |
| --- | --- | --- | --- |
| `budget` | Studiokasse | verfügbar | Münzen × 100 |
| `spent` | gebuchte Ausgaben | Lebenszeit | Münzen × 100 |
| `salesRevenue`, `licenseRevenue`, `advances` | Spielverkäufe, Lizenzerlöse, Publisher-Vorschüsse | Lebenszeit | Münzen × 100 |
| `runSales`, `fanTicks` | verkaufte Einheiten, Fans × 800 | Lebenszeit | Stück / Ticks |
| `researchPoints` | Forschungspunkte (gedeckelt) | verfügbar | Punkte |
| `prestige.claimed`, `prestige.points` | Prestige-Ansprüche | dauerhaft über Runs | Kennungen / Anzahl |

### Factory Empire

Alle Mengen stehen in `amounts`, Schlüssel nach Präfix, Einheit 1/1000 Stück bzw. Credit:

| Schlüssel | Bedeutung | Art |
| --- | --- | --- |
| `cash:<scope>` | Kasse frei (`free`) oder zweckgebunden (`line`, `pilot`, `rail`) | verfügbar |
| `funded:<scope>` | bisher zweckgebunden eingesammelte Credits je Pflichtkonto | Lebenszeit (gedeckelt) |
| `field:<feld>:<scope>` | Restvorrat eines Erzfeldes je Konto | verfügbar |
| `stock:<gebäude>`, `yard:<region>:<scope>:<gut>` | Bestand in Gebäude bzw. Hoflager | verfügbar |
| `order:<auftrag>` | angekommene Menge eines Auftrags | Lebenszeit (bis Auftragsmenge) |
| `made:<scope>:<gut>` | gebundene Produktion je Pflichtkonto | Lebenszeit (gedeckelt) |
| `count:<zähler>` | `revenue`, `ironSold`, `beltIron`, `beltGear`, `finite`, `renewable`, `motors`, `shippedMotors`, `modules`, `gridPeak`, `diagnosed` | Lebenszeit |
| `rescueOre` | Noterz | verfügbar |

Zugmanifest (`tracks[].manifest`, Regelversion 2): `good`, `scope`, `amount` (im Umlauf geladen), `unloaded` (angekommen), `elapsed` (Fahrsekunden), `skipped` (leer abgefahrene Wagenkapazität).
