# EXP-002 · Texas Hold'em

Implementierung: `19d0c5526099acd50e635078c80eee1ebd8d0738`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Privater Salon: Palette `poker` auf Basis der Casino-Palette, Atmosphäre „Salon“. |
| Figuren & Material | Kartenrücken „Salon“ (Tannengrün mit Rautengitter, Medaillon und Doppelrahmen), Dealer-Button aus Messing, jede Chipfarbe mit eigenem Kantenmuster. |
| Klang | Chips beim Setzen und Callen, Stapelrauschen beim Einsammeln des Pots, Filz-Wischen beim Austeilen, gedämpftes Doppelklopfen beim Check, Karte beim Fold, tiefer Ton beim All-in (erzeugt). |
| Animation | Die Karten kommen reihum vom Dealer-Button. Flop, Turn und River drehen sich einzeln um; läuft das Board nach einem All-in aus, deutlich langsamer. Chips zur Mitte und der Pot zum Gewinner bleiben wie bisher. |
| Highlight | All-in-Showdown: Das Licht wird kurz dunkler (der Lichtkegel bleibt auf der Mitte), die Gewinnhand leuchtet in Messing. |

Spiellogik unverändert. Das Modul gilt nur für Texas Hold'em; Omaha und die übrigen Varianten nutzen dieselbe Oberfläche, behalten aber ihre bisherigen Töne (eigene EXP-Pakete).

## Zusätzlich behoben: Wertung am Handende

Die Tafel „Runde gewertet“ lag zuletzt mittig auf dem Filz und verdeckte Board, Gewinnhand und Gewinnmeldung (davor verdeckte sie den unteren Platz). Sie ist jetzt eine kompakte Karte in der freien Ecke oben links; auf schmalen Bildschirmen ein flacher Streifen über der Aktionsleiste, der nur die Gewinner nennt.

## Geheimnisse

Töne und Bewegungen hängen nur an öffentlichen Zustandswechseln (Einsatz, Check, Fold, All-in, Board, Handende). Fremde Karten bleiben Kartenrücken, bis der Server sie zeigt.

## Abweichungen

- Fünf statt sechs Chipwerte: Die Oberfläche kennt fünf Chipfarben; jede hat jetzt ihr eigenes Kantenmuster.
- Side Pots teilen sich nicht als eigene Bewegung auf; sie stehen wie bisher als eigene Stapel neben dem Hauptpot.
- Die Messinglampe ist der Lichtkegel beim Showdown, keine dauerhafte Grafik über dem Tisch (dort stehen Plätze und Karten).

## Prüfungen

- `test/ui/exp-poker.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Menschen und einer echten Hand: Mischen, Austeilen reihum, Blinds, Call, Check, Flop einzeln, All-in, auslaufendes Board, Showdown mit Lichtkegel und Messing-Leuchten; nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Fold, Neuladen ohne Rückstau, keine fremden Karten im Zustand, Omaha unverändert, `expectNoLeak`.
- `test/experience-poker.test.js`: 4 Tests zur Erkennung von Einsatz, Check, Fold, All-in, Board und Showdown.
- `test/ui/celebrate.spec.js` (Poker-Handende): bestanden. `npm run test:fast`: bestanden, kein Fehler.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 312 | 5966.4 ms | 52.13 | ≥ 45 |
| Mobilansicht | 338 | 5933.0 ms | 56.8 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Gemessen am stehenden Showdown.

## Bilder

- All-in-Showdown: [Desktop](showdown-desktop.png), [Mobilansicht](showdown-mobil.png)
