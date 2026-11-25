# Doppelkopf: Wertung, Ansagen und Hochzeit nach den DDV-Turnierspielregeln

Stand DOKO-WERTUNG-02, Version 3.28.0. Grundlage sind die Turnierspielregeln (TSR) des Deutschen Doppelkopf-Verbands, Stand 21.02.2026, Abschnitte 4.4, 6.2–6.4 und 7.1–7.3. Quelle: das PDF auf doko-verband.de (`shared-files/11534`, SHA-256 `72bf270cd8134adb6d7787f2409a027c576066d9a2e0faba3f26af26260d3252`, 28 Seiten). Der Projektinhaber hat am 25.11.2026 entschieden, diese Regeln in den vier offenen Punkten verbindlich umzusetzen. Hausregeln für diese Bereiche gibt es nicht mehr; Neunen und Schweinchen bleiben als Raumoptionen erhalten.

Code: [games/doppelkopf/rules.js](../games/doppelkopf/rules.js) (`announceOptions`, `reachesGoal`, `scoreDeal`), Ablauf in [room.js](../games/doppelkopf/room.js). Tests: [test/doppelkopf-wertung.test.js](../test/doppelkopf-wertung.test.js), die Erwartungen sind von Hand aus dem Regelwerk abgeleitet und nennen den Abschnitt.

## Umgesetzte Entscheidungen

| Nr. | Thema | Bis 3.27.4 | Ab 3.28.0 (DDV) |
| --- | --- | --- | --- |
| 1 | Stille Hochzeit (4.4.5, 7.2.4) | Normalspiel 1 gegen 3 mit Sonderpunkten und „gegen die Alten“, dreifach verteilt | Abrechnung wie ein Solo: nur Punkte nach 7.2.2, dreifach für den Alleinspieler. Ansagefristen wie im Normalspiel. |
| 2 | Sonderpunkte (7.2.3) | in allen Spielen | nur im Normalspiel einschließlich Hochzeit mit Partner. „Gegen die Kreuz-Damen gewonnen“ ist ein Sonderpunkt und entfällt damit im Solo, in der stillen Hochzeit und in der Hochzeit ohne Partner. |
| 3a | Gewinnschwellen (7.1) | Re 121, sonst Ziel der eigenen Absage | Re gewinnt mit 120, wenn nur Kontra angesagt hat, Kontra braucht dann 121. Gegen eine gegnerische Absage keine 90/60/30 reichen 90/60/30 Augen, gegen „schwarz“ der erste Stich, solange man sich nicht selbst zu mehr verpflichtet hat. |
| 3b | Beide verfehlen ihre Absage (7.1.3) | kein Sieger, Wert 0 | kein Sieger. Es zählen nur unter 90/60/30/schwarz gespielt, die Punkte für Augen gegen Absagen (7.2.2 e, f) und Sonderpunkte, jeweils für die Partei, die sie erspielt hat. Ansagen und Absagen selbst zählen nicht (6.3.3). |
| 3c | Schwarz | „schwarz gespielt“ nach Stichen | unverändert Stichbedingung: Ein Stich ohne Augen verhindert schwarz. |
| 3d | Punkte für Augen gegen Absagen (7.2.2 e, f) | fehlten | je 1 Punkt für 120 Augen gegen keine 90, 90 gegen keine 60, 60 gegen keine 30, 30 gegen schwarz |
| 4a | Hochzeit (4.4.4, 6.2.1) | Hochzeiter durfte vor dem Klärungsstich ansagen | Erstansage für alle erst nach vollendetem Klärungsstich |
| 4b | Fristen bei der Hochzeit (6.4.2) | unverändert | Klärungsstich 2 bzw. 3 verringert alle Kartenzahlen um 1 bzw. 2 |
| 4c | Erwiderung (6.4.4) | fehlte | Auf eine gegnerische An- oder Absage darf mit einer Karte weniger „Re“ bzw. „Kontra“ erwidert werden. Danach sind Absagen dieser Partei nur erlaubt, wenn die Erwiderung auch als Erstansage rechtzeitig war. |
| 4d | Überspringen (6.4.3) | nur die nächste Stufe | beliebig viele Stufen, wenn die übersprungenen jetzt noch zulässig wären; alle Stufen werden gewertet |
| 4e | Zeitpunkt (6.4.1) | nur im eigenen Kartenzug | auch außerhalb des eigenen Zugs |
| 4f | Wiederholung (6.4.7) | abgelehnt | unverändert abgelehnt, ohne Zustandsänderung |

**Hochzeit ohne Partner (4.4.3 b):** Macht der Hochzeiter die ersten drei Stiche selbst, wird das Spiel als Karo-Solo fortgesetzt und so abgerechnet. Die Trumpffolge ist identisch, die Partei steht nach Stich 3 fest. Dabei wurde ein Fehler behoben, der schon vor 3.28.0 bestand: Gewann ein anderer Spieler ab Stich 4 einen Stich, wurde er nachträglich zum Partner. Jetzt endet die Partnersuche nach Stich 3.

**Fristen (12 Karten; ohne Neunen jeweils 2 weniger):**

| An- bzw. Absage | Mindestens Karten auf der Hand | Erwiderung darauf bis |
| --- | --- | --- |
| Re/Kontra | 11 | 10 |
| keine 90 | 10 | 9 |
| keine 60 | 9 | 8 |
| keine 30 | 8 | 7 |
| schwarz | 7 | 6 |

**Ansage außerhalb des Zugs:** Eine Ansage nennt ihre Zielstufe absolut und wird gegen den aktuellen Stand geprüft. Eine veraltete Clientrevision derselben Partie lehnt der Server deshalb nicht ab, eine künftige Revision oder eine fremde Partie schon. Doppelte, zu späte oder fremde Ansagen werden abgelehnt und ändern keine Nutzlast. Die Partei eines Spielers wird erst durch seine Ansage öffentlich; die stille Hochzeit bleibt bis zur Abrechnung unerkannt.

## Wertungsmatrix (DDV, ab 3.28.0)

Wert = Punkte von Re minus Punkte von Kontra; im Normalspiel einschließlich Sonderpunkten. Im Solo und in den Solo-Fällen der Hochzeit erhält der Alleinspieler den dreifachen Wert, jeder Gegner den einfachen mit umgekehrtem Vorzeichen.

| Szenario | Parteien | Augen (Stiche) | An-/Absagen, Sonderpunkte | Sieger | Herleitung | Einzelwerte |
| --- | --- | --- | --- | --- | --- | --- |
| Normalspiel | 2:2 | 130:110 | – | Re | 1 | +1 +1 −1 −1 |
| 120:120 | 2:2 | 120:120 | – | Kontra | 1 + Sonderpunkt | −2 −2 +2 +2 |
| 120:120, nur Kontra | 2:2 | 120:120 | Kontra | Re (7.1.1 Nr. 4) | 1 + 2 | +3 +3 −3 −3 |
| 120:120, nur Re | 2:2 | 120:120 | Re | Kontra | 1 + 2 + Sonderpunkt | −4 −4 +4 +4 |
| 120:120, beide | 2:2 | 120:120 | Re, Kontra | Kontra | 1 + 2 + 2 + Sonderpunkt | −6 −6 +6 +6 |
| keine 90 erfüllt | 2:2 | 151:89 | Re: keine 90 | Re | 1 + unter 90 + 2 + 1 | +5 +5 −5 −5 |
| keine 90 verfehlt | 2:2 | 150:90 | Re: keine 90 | Kontra mit 90 (7.1.2 Nr. 7) | 1 + 2 + 1 + Sonderpunkt | −5 −5 +5 +5 |
| Gegen Kontra-Absage | 2:2 | 90:150 | Kontra: keine 90 | Re mit 90 | 1 + 2 + 1 | +4 +4 −4 −4 |
| keine 30 verfehlt | 2:2 | 210:30 | Re: keine 30 | Kontra mit 30 | 1 + 2 + 3 + Sonderpunkt | −7 −7 +7 +7 |
| schwarz erfüllt | 2:2 | 240:0 (12:0) | Re: schwarz | Re | 1 + 4 + 2 + 4 | +11 +11 −11 −11 |
| schwarz verfehlt durch Stich ohne Augen | 2:2 | 240:0 (11:1) | Re: schwarz | Kontra mit dem ersten Stich | 1 + 2 + 4 + Sonderpunkt | −8 −8 +8 +8 |
| Beide verfehlen | 2:2 | 170:70 | Re: keine 60, Kontra: keine 90 | keiner (7.1.3) | Re: unter 90 + 120 gegen keine 90 | +2 +2 −2 −2 |
| Beide verfehlen, gleichauf | 2:2 | 120:120 | beide keine 90 | keiner | je 1 für 120 gegen keine 90 | 0 0 0 0 |
| Stille Hochzeit, Re-Sieg | 1:3 | 180:60 | Re, Sonderpunkte 3:0 (entfallen) | Re | 1 + unter 90 + 2 | +12 −4 −4 −4 |
| Stille Hochzeit, Kontra schwarz | 1:3 | 0:240 (0:12) | Re | Kontra | 1 + 4 + 2 | −21 +7 +7 +7 |
| Hochzeit mit Partner | 2:2 | 120:120 | – | Kontra | 1 + Sonderpunkt | −2 −2 +2 +2 |
| Hochzeit ohne Partner | 1:3 | 100:140 | Sonderpunkte entfallen | Kontra | 1 | −3 +1 +1 +1 |
| Solo gewonnen (jede Soloart) | 1:3 | 190:50 | Re | Re | 1 + unter 90 + unter 60 + 2 | +15 −5 −5 −5 |
| Solo verloren | 1:3 | 110:130 | Kontra | Kontra | 1 + 2 | −9 +3 +3 +3 |
| Solo, beide verfehlen | 1:3 | 140:100 | beide keine 90 | keiner | Solist: 120 gegen keine 90 | +3 −1 −1 −1 |

Alle Einzelwerte summieren sich zu null und sind je Spiel alle gerade oder alle ungerade (7.3.3). Ein Test prüft beides über mehr als 20.000 Kombinationen aus Augen, Stichen (auch Stich ohne Augen), Ansagestufen, Sonderpunkten, Spielarten und Parteiaufteilungen. Raumtests spielen die Hochzeit mit Klärungsstich 1, 2 und 3 und ohne Partner, die stille Hochzeit und alle sieben Soloarten vollständig durch.

## Verlauf

- **3.27.2:** Die stille Hochzeit war nicht nullsummig (QA-DOKO-01: −14 bzw. +16). Die Einzelperson erhielt seitdem den dreifachen Wert.
- **3.27.2:** Vier Punkte blieben offen: Einordnung der stillen Hochzeit, Sonderpunkte im Solo, Gewinnschwellen und Ansagen in der Hochzeit. Grundlage waren Wikipedia und pagat.com, das DDV-Original war unter der alten Adresse nicht abrufbar.
- **3.28.0:** DDV-Turnierspielregeln umgesetzt (diese Seite).

## Nicht Teil der Umsetzung

- Strafpunkte und Regelverstöße (TSR 9).
- Spielabkürzung durch den Solisten (5.4).
- Pflicht- und Lustsolo-Buchführung (4.2, 4.3).
- Vorbehaltsreihenfolge mit Taufe.

Das Spiel kennt weiter frei wählbare Soli in der Vorbehaltsrunde. Nach dem Auftrag gibt es keine zusätzlich konfigurierbaren Hausregeln.
