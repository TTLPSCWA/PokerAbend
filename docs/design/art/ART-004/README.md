# ART-004 · UNO – Karten, Stapel, Tisch

- **Implementierungscommit:** `887bf79d08bbf0c76ca2aa6ebaaa831b0a2fa70b`
- **Freigabe:** Tobi, 10.11.2026 („baue nun ART-004 UNO“)

## Was sich geändert hat

| Vorher | Nachher |
|---|---|
| Flache Karten mit einer Kante | mehrlagige Papierkante, Lichtstreif auf dem Innenrahmen, leichte Wölbung |
| Classic-Mittelfeld nur als dünne Linie | helle, gekippte Ellipse; Werte mit Schatten besser lesbar |
| Nachziehstapel mit drei Kanten | mehrere Kartenkanten (Papier/Rücken im Wechsel) |
| Ablage: eine einzelne Karte | frühere Karten liegen schräg darunter |
| Einfarbiger Spieltisch | eigene Leinenstruktur über der jeweiligen Weltfarbe |

Gilt für alle fünf Welten (Classic, Flip, No Mercy, All Wild, Spuknacht). Ihre Farben bleiben, No Mercy und Spuknacht behalten ihre eckigeren Karten. Schalter: `.kg-farbenchaos[data-art-uno]`. Spiellogik unverändert.

## Nachweise

- Test: `test/ui/art-farbenchaos.spec.js` (alle Welten am PC, Classic und Flip am Handy)
- Screenshots: `before-*.png` (alter Stand), `table-*.png` (neu)
- Leistung: `fps-desktop.json`. Hauptthread-Rechenzeit und Bildrate mit und ohne neue Optik bei 4× gedrosselter CPU, Median aus 5 Läufen in wechselnder Reihenfolge (Rechenzeit-Verhältnis ≥ 0,9, Bildrate ≥ 0,85).
- Gelernt: Ein Glanz-Pseudo-Element pro Karte kostete beim Bewegen der Hand rund 25 % Bildrate. Der Glanz liegt deshalb auf dem vorhandenen Innenrahmen.

## Bekannt, nicht Teil von ART-004

- `test/ui/exp-farbenchaos.spec.js` „Animationen reduzieren …“ schlägt auch ohne ART-004 fehl: Es erklingt ein `beep`.
