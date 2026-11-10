# EXP-042 · Kronenjagd

Implementierung: `677d9c8126b2d1c47158eb6f5dd552e5b2924a55`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Burghof im Spielfeld: Steinboden, roter Teppich im Kreuz, Thron in der Mitte. |
| Figuren & Material | Die Krone ist ein eigenes goldenes Objekt mit Zacken, Reif und Steinen (statt des Schriftzeichens). |
| Klang | Palette `kronenjagd`: Fanfare, wenn man selbst die Krone holt; abfallende Trompete, wenn man sie verliert (beide erzeugt); kurzer Holzton für alle anderen; Countdown-Ticks. |
| Animation | Die Krone springt im Bogen zum Fänger. Neben ihr läuft der Krönchen-Zähler (Punkte des Trägers) mit einem kleinen Hüpfer je Punkt hoch. |
| Highlight | 30 Sekunden durchgehend gekrönt: Vier Thronsaal-Banner wehen von der Mauer, dazu Schriftzug und Akkord. Jede Herrschaft wird nur einmal gefeiert. |

Spiellogik unverändert.

## Technik

Kronenjagd ist ein Echtzeitspiel: Bewegung kommt als Server-Frame, gezeichnet wird im Canvas. Dafür hat `realtime-kit.js` eine kleine Schnittstelle bekommen (Frames hören, Kulisse und Zusätze malen, Töne übernehmen), die alle Echtzeitspiele nutzen können; ohne Erlebnis-Paket bleibt alles wie bisher. Kulisse, Krone, Banner und Zählerstände werden einmal vorgezeichnet und pro Bild nur kopiert.

## Geheimnisse

Keine: Positionen, Träger und Punkte sieht ohnehin jeder.

## Abweichungen

- Bewegung läuft im Canvas, nicht über `transform`/`opacity` (dort gibt es keine Elemente). Mit „Animationen reduzieren“ springt die Krone ohne Bogen, der Zähler hüpft nicht, die Banner hängen still.
- Bewegungsbudget: Die Bildrate gibt das Spiel selbst vor. Gemessen wird deshalb der Vergleich mit derselben Szene ohne Paket; das Paket darf höchstens 10 % kosten.

## Prüfungen

- `test/ui/exp-kronenjagd.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Menschen: echter Lauf zur Krone mit den Pfeiltasten, Fanfare beim Fänger und Holzton beim anderen, Krone im Canvas (Farbprobe am Reif), Highlight nur einmal je Herrschaft, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-kronenjagd.test.js`: 3 Tests. `test/ui/realtime.spec.js` und `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU, während die Banner wehen)

| Ansicht | mit Paket | ohne Paket | Verhältnis | Budget |
|---|---:|---:|---:|---:|
| Desktop | 20.89 FPS | 22.56 FPS | 0.926 | ≥ 0,9 |
| Mobilansicht | 39.26 FPS | 36.35 FPS | 1.08 | ≥ 0,9 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Krone: [Desktop](krone-desktop.png), [Mobilansicht](krone-mobil.png)
- Thronsaal: [Desktop](thronsaal-desktop.png), [Mobilansicht](thronsaal-mobil.png)
