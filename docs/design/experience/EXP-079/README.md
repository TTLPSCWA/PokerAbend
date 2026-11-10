# EXP-079 · Schubsarena

Implementierung: `da59a7f7f2fcdcc0810f35d0d018ed9a201667c9`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Sumo-Ring auf einer Eisscholle im Wasser: gezackter Eisrand, Ringkreis, Startlinien, feine Risse. Die Scholle schrumpft mit der Plattform des Servers. |
| Figuren & Material | Jede Figur trägt einen Sumo-Gürtel mit rotem Knoten. |
| Klang | Palette `schubsarena`: Stoß-Wumms, Rutschen auf Eis, Platsch beim Rausfallen, Eisknacken, wenn der Rand bricht (bis auf den Wumms erzeugt). |
| Animation | Vom Rand brechen Eisstücke ab und treiben weg. Wer rausfällt, hinterlässt Ringe und Tropfen im Wasser. Die Stoß-Anzeige bleibt wie bisher. |
| Highlight | Zwei Rauswürfe mit einem Stoß: „Doppelschubser!“ mit Namen, Sternenkranz und Akkord. |

Spiellogik unverändert.

## Technik

Echtzeitspiel im Canvas über die Schnittstelle aus EXP-042. Wasser und Scholle werden einmal vorgezeichnet und pro Bild nur kopiert und skaliert; das ist billiger als die bisherige Zeichnung. Der letzte Rauswurf beendet die Runde ohne weiteres Frame – der Platsch wird dann aus dem Endstand abgeleitet, das Ergebnisfenster wartet kurz.

## Geheimnisse

Keine: Positionen, Stöße und Scholle sieht ohnehin jeder.

## Abweichungen

- Bewegung läuft im Canvas, nicht über `transform`/`opacity`. Mit „Animationen reduzieren“ gibt es keine treibenden Eisstücke und keinen Sternenkranz; der Platsch steht als ruhiges Zeichen.
- Der Doppelschubser wird dem letzten Stoß zugeordnet, wenn beide Getroffenen binnen 1,5 Sekunden ins Wasser fallen.
- Bewegungsbudget als Vergleich mit derselben Szene ohne Paket (höchstens 10 % Verlust).

## Prüfungen

- `test/ui/exp-schubsarena.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Menschen: Farbprobe von Wasser und Eis im Canvas, echter Stoß mit Wumms und Rutschen, Doppelschubser über die Frame-Schnittstelle, echter Rauswurf mit Platsch am Rundenende, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-schubsarena.test.js`: 4 Tests. `test/ui/backlog09.spec.js` (Schubsarena) und `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | mit Paket | ohne Paket | Verhältnis | Budget |
|---|---:|---:|---:|---:|
| Desktop | 42.76 FPS | 26.27 FPS | 1.628 | ≥ 0,9 |
| Mobilansicht | 30.79 FPS | 30.74 FPS | 1.002 | ≥ 0,9 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Eisscholle: [Desktop](scholle-desktop.png), [Mobilansicht](scholle-mobil.png)
- Doppelschubser: [Desktop](doppelschubser-desktop.png), [Mobilansicht](doppelschubser-mobil.png)
