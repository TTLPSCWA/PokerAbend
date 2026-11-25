# Doppelkopf: Wertung, stille Hochzeit und offene Regelentscheidungen

Stand DOKO-WERTUNG-02, Version 3.27.2. Die Regeln stehen in [games/doppelkopf/rules.js](../games/doppelkopf/rules.js), der Ablauf in [room.js](../games/doppelkopf/room.js). Geprüft wird beides durch [test/doppelkopf-wertung.test.js](../test/doppelkopf-wertung.test.js).

## Korrigierter Fehler: stille Hochzeit war nicht nullsummig

Wer beide Kreuz-Damen hat und „gesund“ meldet, ist allein Re gegen drei Kontra. Bis 3.27.1 erhielt diese Person nur den einfachen Wert, jeder der drei Gegner aber den negativen Wert. Die Summe war deshalb nicht null (QA-DOKO-01: −14 und +16). Seit 3.27.2 gilt dieselbe Verteilung wie beim Solo und bei der Hochzeit ohne Partner: Die Einzelperson erhält den dreifachen Wert, jeder Gegner den einfachen. Die Ergebniszeile nennt „allein gegen drei (dreifach)“. Die Zusammensetzung des Spielwerts bleibt unverändert, also „gegen die Alten“ und Sonderpunkte wie im Normalspiel. Diese beiden Punkte sind offene Fachentscheidungen, siehe unten.

## Wertungsmatrix (Projektregel, 3.27.2)

Spielwert = Spielpunkte des Siegers (Vorzeichen: Re positiv) plus Sonderpunkte Re minus Sonderpunkte Kontra.

| Szenario | Parteien | Augen | Ansagen und Sonderpunkte | Sieger | Wert | Einzelwerte | Summe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Normalspiel | 2 gegen 2 | 130:110 | keine | Re | +1 | +1 +1 −1 −1 | 0 |
| Grenzwert 121 | 2 gegen 2 | 121:119 | keine | Re | +1 | +1 +1 −1 −1 | 0 |
| Grenzwert 120 | 2 gegen 2 | 120:120 | keine | Kontra (gegen die Alten) | −2 | −2 −2 +2 +2 | 0 |
| Kontra-Ansage, 120:120 | 2 gegen 2 | 120:120 | Kontra | Kontra | −4 | −4 −4 +4 +4 | 0 |
| Stille Hochzeit, Re-Sieg | 1 gegen 3 | 180:60 | Re, Sonderpunkte 3:0 | Re | +7 | **+21** −7 −7 −7 | 0 |
| Stille Hochzeit, Kontra-Sieg | 1 gegen 3 | 0:240, schwarz | Re | Kontra | −8 | **−24** +8 +8 +8 | 0 |
| Angesagte Hochzeit mit Partner | 2 gegen 2 | 130:110 | keine | Re | +1 | +1 +1 −1 −1 | 0 |
| Hochzeit ohne Partner | 1 gegen 3 | 100:140 | keine | Kontra (ohne „gegen die Alten“) | −1 | −3 +1 +1 +1 | 0 |
| Solo gewonnen | 1 gegen 3 | 190:50 | Re | Re | +5 | +15 −5 −5 −5 | 0 |
| Solo verloren | 1 gegen 3 | 110:130 | Kontra | Kontra | −3 | −9 +3 +3 +3 | 0 |
| Re-Absage verfehlt | 2 gegen 2 | 140:100 | Re: keine 90 | Kontra | −5 | −5 −5 +5 +5 | 0 |
| Beide verfehlen | 2 gegen 2 | 120:120 | beide keine 90 | keiner | 0 | 0 0 0 0 | 0 |
| Sonderpunkte gegen den Sieger | 2 gegen 2 | 130:110 | Sonderpunkte 0:3 | Re | −2 | −2 −2 +2 +2 | 0 |

Zusätzlich prüft ein Test mehr als 20.000 Kombinationen aus Augen (0–240), Ansagestufen beider Parteien, Sonderpunkten und Parteiaufteilungen auf Nullsumme. Zwei vollständige Partien im Raum spielen die stille Hochzeit mit und ohne Re-Ansage. Geprüft werden Abrechnung, Gesamtstand und die Abschlussansicht der Mitspieler.

## Regelquellen und Abweichungen

Quellen: Wikipedia „Doppelkopf“, Abschnitt 7 (Zusammenfassung der DDV-Turnierspielregeln, Sekundärquelle), und pagat.com „Doppelkopf“. Das DDV-Original war nicht abrufbar. Vor einer verbindlichen Umstellung sollte es geprüft werden.

| Nr. | Thema | Projekt (Code und Katalogtext) | DDV-Turnierregel | Art |
| --- | --- | --- | --- | --- |
| 1 | Stille Hochzeit | „gesund“ erlaubt, Normalspiel 1 gegen 3, dreifach verteilt (seit 3.27.2) | gilt als Solo (stilles Solo), dreifach | Nullsumme gleich, Einordnung offen |
| 2 | Sonderpunkte im Solo | zählen in allen Spielen, auch im Solo und in der stillen Hochzeit | nur im Normalspiel einschließlich Hochzeit, nicht im Solo und nicht in der stillen Hochzeit | Abweichung |
| 3 | „Gegen die Alten“ | im Normalspiel bei Kontra-Sieg, auch in der stillen Hochzeit, nicht im Solo | Zusatzpunkt bei Kontra-Sieg. Ob er im Solo zählt, nennen die Quellen nicht ausdrücklich | offen |
| 4 | Hochzeit ohne Partner | Partner ist, wer einen der ersten drei Stiche macht, sonst allein und dreifach | automatisch Karo-Solo (gleiche Trumpffolge), also Solowertung ohne Sonderpunkte | Wertung abweichend (Sonderpunkte) |
| 5 | 120 Augen bei alleiniger Kontra-Ansage | Re braucht immer 121 | Re gewinnt mit 120, wenn nur Kontra angesagt hat | Abweichung von der Katalogregel „Re braucht 121, Kontra 120“ |
| 6 | Schwellen bei gegnerischer Absage | Re braucht stets 121 bzw. das eigene Ziel | Gegen „keine 90“ der Gegner reichen 90 Augen usw. | Abweichung |
| 7 | Beide verfehlen | kein Sieger, Wert 0 | kein Sieger, aber Punkte für „keine 90/60/30/schwarz gespielt“ an die erfolgreiche Partei | Abweichung |
| 8 | Ansagen in der Hochzeit | Der Hochzeiter darf vor dem Klärungsstich ansagen, die übrigen nicht | Ansagen erst nach dem Klärungsstich, Fristen verschieben sich um die Stiche bis zur Klärung | Abweichung |
| 9 | Erwiderung | keine verlängerte Frist | Auf eine gegnerische Ansage darf mit einer Karte weniger erwidert werden | Abweichung |
| 10 | Ansagefristen | Re/Kontra bei mindestens 11 Karten, keine 90/60/30/schwarz bei 10/9/8/7 (12er-Blatt) | gleich | übereinstimmend |
| 11 | Solo-Multiplikator und Nullsumme | dreifach für die Einzelperson | gleich | übereinstimmend |

## Benötigte Entscheidung des Projektinhabers

1. **Stille Hochzeit:** Empfehlung: „gesund“ bleibt erlaubt (QA-DOKO-01). Zu entscheiden ist, ob sie wie im DDV als Solo gewertet wird (ohne Sonderpunkte, ohne „gegen die Alten“) oder wie heute als Normalspiel mit dreifacher Verteilung. Der Wert ändert sich nur bei Sonderpunkten oder einem Kontra-Sieg. Beispiel Kontra-Sieg 0:240 mit Re-Ansage: heute −24/+8/+8/+8, als Solo −21/+7/+7/+7.
2. **Sonderpunkte im Solo** (Punkt 2 und 4): DDV-konform streichen oder als Hausregel beibehalten.
3. **Gewinnschwellen** (Punkte 5–7): DDV übernehmen oder die einfachere Katalogregel bestätigen.
4. **Ansagen in der Hochzeit und Erwiderung** (Punkte 8 und 9): Das wäre eine Änderung der erlaubten Aktionen mit Oberflächenfolgen.

Bis zur Entscheidung bleiben die Punkte 2–9 wie bisher. Für jede Option sind die betroffenen Erwartungen in `test/doppelkopf-wertung.test.js` und `games/doppelkopf/rules.test.js` markiert.
