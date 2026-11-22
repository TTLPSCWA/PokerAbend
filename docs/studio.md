# Game Studio Tycoon

Spiel-ID `studio`, Version 3.24.0. IDLE-06 umfasst GS-P1 bis GS-P3, IDLE-11 umfasst GS-P4 bis GS-P5. Die bestätigten Eintrittsbedingungen und Endgame-Ziele stehen in der [Phasenkonfiguration](../public/idle/progression.js).

## Regulärer Spielweg

Der [reproduzierbare Durchlauf](../test/studio-playthrough.js) beginnt bei einem neuen Konto. Er steuert die Uhr und nutzt reguläre Spielaktionen. Die Zeiten sind Kontrollpunkte des Testpfads mit fest gewählten Wartezeiten. Sie zeigen keine Mindestzeit und kein finales Balancing.

| Phase | Beobachtete Zeit | Nachweis |
| --- | --- | --- |
| GS-P1 | Start | 800 Kredite, zwei Startkombinationen, Demo und manuelle Freigabe. [Desktop](studio/GS-P1-desktop.png) · [Mobil](studio/GS-P1-mobil.png) |
| GS-P2 | 3 h 3 min 46 s | Zwei Releases, mindestens 30 Fans. [Desktop](studio/GS-P2-desktop.png) · [Mobil](studio/GS-P2-mobil.png) |
| GS-P3 | 3 h 14 min 38 s | Gründlich getesteter kleiner Titel mit 95 Punkten und Forschung Marketing I. [Desktop](studio/GS-P3-desktop.png) · [Mobil](studio/GS-P3-mobil.png) |
| GS-P4 | 20 d 23 h 22 min 42 s | Sechs Mitarbeitende und mindestens 2 Mio. tatsächlich gutgeschriebener Spielumsatz. [Desktop](studio/GS-P4-desktop.png) · [Mobil](studio/GS-P4-mobil.png) |
| GS-P5 | 64 d 5 h 46 min 26 s | Engine III und je ein Release aus zwei Studios. [Desktop](studio/GS-P5-desktop.png) · [Mobil](studio/GS-P5-mobil.png) |
| Endgame | 2.444 d 5 h 37 min 41 s | 35 Releases, 10.356.994 Einheiten, vier Studios, Bestwertung 99, eine Reihe mit fünf Titeln, alle Genres ≥ 80 und zehn Engine-Lizenzen. |

Die Screenshots verwenden Viewports von 1440×900 und 390×844. Der Browsertest erreicht alle fünf Phasen über den Server und prüft die erste Aktion per Tastatur beziehungsweise Touch. Der separate vollständige Spielweg im Savepoint-Dienst lädt einen G3-Stand in einer neuen Dienstinstanz und setzt bis zu allen sechs Endgame-Zielen fort. Dort wird auch der freiwillige Neustart mit persistenter Revision geprüft.

## Projektpipeline und Finanzen

Der [Spielkern](../server/idle/studio.js) validiert jede Aktion. Das Konto und der bestätigte Stand kommen vom gemeinsamen [Idle-Speichervertrag](idle-engine.md). Das Modul nutzt Projektplan, Personalzuweisung, Scope, Testtiefe, Verlag, Zielgruppe, Plattform, Marketing und ein freigegebenes Kostenlimit.

- Konzept, Entwicklung und QA reservieren je Schritt sämtliche Kosten. Der Start bleibt bei unzureichendem Geld aus. Beim bestätigten Abbruch werden die ungenutzten Löhne freigegeben. Werkzeugkosten bleiben verbucht. Auftragsarbeit bringt nach 60 Sekunden 150 Kredite, höchstens ein Auftrag läuft gleichzeitig. Ein laufender Entwicklerjob des Gründers pausiert währenddessen.
- Grundqualität, Bugs, Testtiefe und Passung bestimmen die Bewertung. Marketing beeinflusst Reichweite. Drei G2-Rollen, ein kleines Spiel mit guter Passung und gründliche QA ergeben 95. Die Eilstrategie ergibt im selben Team 78.
- Teamplätze, Forschung, vorbereitete Vorlagen und Queue begrenzen das Wachstum. Eine automatische Freigabe benötigt eine nachweislich freigeschaltete Regel und eine Mindestbewertung. Die Queue verarbeitet genehmigte Vorhaben in stabiler Reihenfolge unter Beachtung ihrer jeweiligen Team- und Budgetgrenzen.
- Vorschuss und Vertrag sind getrennt vom Spielumsatz. Jeder Verlag kann erst nach Erfüllung einen weiteren Vertrag gewähren. Jede Engine-Lizenz zahlt einmalig 600 Kredite und danach aus einer begrenzten Kurve mit 1.500 Einheiten. Die eigene Plattform steigert die Marge eigener Titel um 15 %. Eine Fortsetzung benötigt einen Vorgänger ab 80 Punkten. Ein Patch kann einmalig 20 % des noch offenen Marktes ergänzen.
- Für den optionalen Branchenruf zählen kontoweit einmalige Rekorde. Die Arbeitsrate nähert sich höchstens +40 %. Bei 5 beziehungsweise 15 Punkten werden die zusätzliche Startkombination und der vorerforschte Editor verfügbar. Der bewusste Neustart speichert neue Run-ID, neue Revision und beanspruchte Rekorde zusammen.

## Offline und Balancing

Das [Wirtschaftsmodul](../server/idle/studio-economy.js) verwendet Cent-Unterheiten und ganzzahlige Verkaufszähler. Jede Abrechnung zieht den vorherigen kumulierten Zähler ab. Fällige Verkäufe, die Rückkehr aus Auftragsarbeit, Phasenabschlüsse und autorisierte Starts werden in fester Reihenfolge ausgewertet. Bei finanzierbaren Starts und zeitabhängigen Fortschrittsschwellen sucht die Engine den frühesten Zeitpunkt. Langfristige Berechnungen laufen über Ereignisse und Marktgrenzen.

| D04.1-Kontrollmarkt mit 200 Einheiten | 1 min | 1 h | 24 h | 30 d | 1 Jahr | 10 Jahre |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kumuliert verkauft | 4 | 150 | 200 | 200 | 200 | 200 |

Der Test vergleicht für alle sechs Intervalle einmalige und geteilte Abrechnung. Im ausgewiesenen Markt schließt der Rest nach 24 Halbwertszeiten. Ein unfreigegebenes Projekt verbleibt nach zehn Jahren am Gate. Mit 0,40 freien Krediten wartete ein Projekt 30 Tage ohne Zusatzkosten. Ein regulärer Auftrag finanzierte danach die nächste Phase.

**Vorläufige Werte:** Halbwertsstützstellen und Abschluss nach 24 Halbwertszeiten, Projektgrößen, Arbeitswerte, Kompetenzzuwachs, Forschungs- und Trainingskosten, weitere Vertragsanbieter und Studiokosten sind dokumentierte Modell- bzw. Startparameter. Die D00-Schwellen bleiben maßgeblich. Ein weiterer Playtest soll Eilpfad, Absatzreichweite und lange G4–G5-Sitzungszyklen kalibrieren. Ein Branchenruf-Neustart ohne neuen Anspruch bleibt bis zur Fachentscheidung gesperrt. Der begrenzte Detailkatalog hält bis zu 80 offene Märkte sowie jüngere abgeschlossene Titel und relevante Reihen. Ältere ausgeschöpfte Titel bleiben in den Gesamtstatistiken.

## Betrieb und Abnahme

`IDLE_STUDIO_ENABLED` ist standardmäßig aus und unabhängig von `IDLE_SPIELHALLE_ENABLED`. Der Hub zeigt die Studio-Kachel nur bei ausdrücklicher Serverfreigabe mit gültigem `IDLE_SAVE_KEYRING`. [Betriebsanleitung](betrieb.md)

Der Spielstand ist konto- und spielgebunden. Der Client speichert manuell, kann die bestätigte Revision signiert exportieren und lädt ausschließlich die aktuelle bestätigte Datei nach Serverprüfung. Die Oberfläche unterscheidet Ansicht, laufende Schreibsitzung und das bestätigte Verwerfen ungespeicherter Aktionen. Tab-Übernahme, Start mit de/englischer Navigation und Gerätewechsel sind im Browsertest nachgewiesen.

Gezielt prüfen mit `node --test test/studio.test.js test/idle-savepoints.test.js test/idle-integration.test.js` und `npx playwright test test/ui/studio.spec.js test/ui/spielhalle.spec.js`. `STUDIO_EVIDENCE=1` schreibt die zehn Phasenaufnahmen aus dem dafür vorgesehenen Testprofil.
