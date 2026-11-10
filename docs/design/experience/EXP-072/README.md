# EXP-072 · Rhythmus-Rausch

Implementierung: `c1aec8cf8bd93176b8e7578a8d746a491b78bd7e`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Konzertbühne: Lautsprecherwand links, zwei Boxen rechts, Traverse mit Scheinwerfern, Bühnenboden. |
| Figuren & Material | Die Noten bleiben fallende Plättchen auf den vier Spuren (VIS-072); neu leuchtet die Spur bei perfekten Treffern. |
| Klang | Palette `rhythmus-rausch`: eigener Beat (Kick auf 1 und 3, Snare auf 2 und 4, Hi-Hat auf den Achteln) im Grundschlag des Lieds. Drei Tempi: ruhig (560 ms), schnell (420 ms) und „Rausch“ ab einer 20er-Serie mit doppelten Hi-Hats. Jeder Treffer spielt den Ton seiner Bahn (a-Moll-Pentatonik), perfekte Treffer ein Glöckchen, Fehltipps einen dumpfen Ton. |
| Animation | Perfekter Treffer: Die Spur leuchtet von der Trefferlinie nach oben auf. Der Serien-Zähler unter der Linie wächst mit der Serie und hüpft bei jedem Treffer. |
| Highlight | 50er-Serie: vier weiche Lichtkegel schwenken langsam über die Bühne (kein Flackern, kein Stroboskop), Publikumsjubel, Schriftzug. Jede 50er-Stufe einmal. |

Spiellogik und Wertung unverändert.

## Technik

Rhythmus-Rausch ist ein Arcade-Spiel. `arcade-kit.js` hat dieselbe kleine Erlebnis-Schnittstelle bekommen wie `realtime-kit.js` (EXP-042): Frames hören, Töne übernehmen, Kulisse und Zusätze im Canvas malen. Ohne Paket bleibt jedes Arcade-Spiel wie bisher. Der Grundschlag wird aus den Notenabständen im Frame abgelesen; der Beat bleibt erzeugt, weil er exakt im Takt liegen muss.

## Geheimnisse

Keine fremden: Jeder hört und sieht nur die eigenen Treffer (aus `frame.last`), die Rangliste war schon öffentlich.

## Abweichungen

- „Ein eigener Beat pro Lied“: Das Lied ist die Notenfolge des Servers; der Beat folgt ihrem Grundschlag. Die Melodie entsteht aus den getroffenen Bahnen.
- Bewegung läuft im Canvas. Mit „Animationen reduzieren“ stehen die Lichtkegel still, die Spur leuchtet ohne Verlauf, der Zähler hüpft nicht. In der Pause schweigt der Beat.
- Bewegungsbudget als Vergleich mit derselben Szene ohne Paket (höchstens 10 % Verlust).

## Prüfungen

- `test/ui/exp-rhythmus-rausch.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Menschen: Farbprobe der Lautsprecherwand, Beat (Kick, Snare, Hi-Hat), echte Tipps im Takt mit Melodieton, 50er-Serie mit Lichtshow und Jubel (nur einmal), „Animationen reduzieren“, Pause ohne Beat, Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-rhythmus-rausch.test.js`: 5 Tests, u. a. Grundschlag aus echten Notenfolgen des Servers. `test/ui/backlog08.spec.js` und `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU, während die Lichtshow läuft)

| Ansicht | mit Paket | ohne Paket | Verhältnis | Budget |
|---|---:|---:|---:|---:|
| Desktop | 30.26 FPS | 32.77 FPS | 0.923 | ≥ 0,9 |
| Mobilansicht | 48.77 FPS | 45.99 FPS | 1.06 | ≥ 0,9 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Bühne: [Desktop](buehne-desktop.png), [Mobilansicht](buehne-mobil.png)
- Lichtshow: [Desktop](lichtshow-desktop.png), [Mobilansicht](lichtshow-mobil.png)
