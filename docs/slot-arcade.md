# Slot Arcade

Slot Arcade ist ein lokaler Einzelspielertitel. Jede Maschine startet mit 1.000 kostenlosen Spielchips. Guthaben, Spielverlauf und Bestleistungen bleiben in diesem Browser. Ein kostenloser Reset steht unterhalb des kleinsten Einsatzes bereit. Die Chips haben keinen Geldwert.

| Automat | Auswertung | Walzenstellungen | Basis-Auszahlung | Freispiele | Gesamtquote |
| --- | --- | ---: | ---: | ---: | ---: |
| Lucky Sevens | 3 Walzen, mittlere Linie | 4.096 | 96,5576 % | 0,0000 % | 96,5576 % |
| Neon Nights | 5 Walzen, 10 Linien | 248.832 | 45,9226 % | 45,5850 % | 91,5075 % |
| Dragon's Fortune | 5 Walzen, bis zu 243 Wege | 248.832 | 53,4310 % | 42,2330 % | 95,6640 % |

Die Gewinnwege beginnen auf der ersten Walze. Im Linienmodus zählt je Linie der zusammenhängende Treffer von links. Beim Wege-Modus wird die Anzahl der passenden Symbole auf aufeinanderfolgenden Walzen multipliziert. Wild ersetzt reguläre Symbole auf den mittleren Walzen. Scatter zählt je Walze einmal und zahlt auf den Gesamteinsatz. Freispiele lösen keine weiteren Freispiele aus.

- **Lucky Sevens** zahlt schon bei zwei Kirschen auf der mittleren Linie. Drei Siebener ergeben das 150-Fache.
- **Neon Nights** teilt den Einsatz auf zehn feste Linien auf. Drei, vier oder fünf Scatter-Walzen geben 7, 10 beziehungsweise 16 Freispiele mit einem Faktor von 2.
- **Dragon's Fortune** bewertet bis zu 3⁵ Wege. Drei, vier oder fünf Scatter-Walzen geben 4, 6 beziehungsweise 10 Freispiele. Der Faktor steigt von 1 bis höchstens 5. Der Einheitseinsatz ist ein Zwanzigstel des Gesamteinsatzes.

Alle Streifen, Gewichte und vollständigen Gewinntabellen stehen in `public/singleplayer/slots-logic.js`. `exactRtp()` zählt alle möglichen Stopps auf. Zur erwarteten Basisauszahlung kommt bei jeder Scatter-Anzahl deren Wahrscheinlichkeit multipliziert mit dem Erwartungswert der Freispielserie. Die Quote beschreibt die Mechanik vor der sehr hohen Guthabenobergrenze. Beim Erreichen dieser Obergrenze zählt nur der tatsächlich gutgeschriebene Betrag für die Statistik.

Ein Spin entnimmt den Einsatz, berechnet Grundgewinn und die ganze Freispielserie und speichert das Ergebnis. Die Oberfläche animiert anschließend die vorbereiteten Stopps. Ende oder Unterbrechung der Animation haben keinen Einfluss auf das Guthaben. Browser mit Web Locks serialisieren Schreibaktionen über Tabs. Bei versperrtem Browserspeicher bleibt das Spiel in diesem Tab bedienbar und zeigt die Einschränkung an.

Die zwölf letzten Drehungen je Automat, die gewählte Maschine, der Einsatz, Lautstärke und die Einstellung für reduzierte Bewegung werden gespeichert. Die Lautstärke startet stumm. Alle Symbole, Gestaltung und synthetisierten Töne sind in dieser Anwendung definiert. Die Solo-Arcade erfordert weder einen Raum noch einen Socket noch eine Veröffentlichung persönlicher Bestleistungen.

Prüfungen stehen in `test/slots-logic.test.js`, `test/slots-session.test.js` und `test/ui/slot-arcade.spec.js`.
