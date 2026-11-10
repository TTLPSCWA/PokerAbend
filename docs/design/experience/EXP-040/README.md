# EXP-040 · Malen & Raten

Implementierung: `4d22bc28100959d0194ca9f597b2124c7f0837f5`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Atelier: Das Bild steht in einem Holzrahmen. |
| Figuren & Material | Die Farbauswahl ist eine Holzpalette mit Farbklecksen; Stiftstärken bleiben als Auswahl daneben. |
| Klang | Palette `malen-raten`: leiser Pinselstrich nur beim Zeichner (beim Aufsetzen), Treffer-Glocke bei jeder richtigen Lösung, Eieruhr-Klingeln (erzeugt), wenn noch zehn Sekunden bleiben. |
| Animation | Die erste richtige Lösung rahmt das Bild golden ein – bei allen am Tisch und dauerhaft bis zur nächsten Runde. |
| Highlight | Erraten es alle, hängt sich das Bild bei der Auflösung an die Wand „Galerie des Abends“ und schwingt am Nagel aus. Danach bleibt es mit Goldrahmen stehen. |

Spiellogik und Zeichenwerkzeug unverändert.

## Geheimnisse

Der Begriff erscheint nirgends vor der Auflösung des Servers. Wer richtig geraten hat, ist ohnehin öffentlich; Vermutungen bleiben privat und lösen keinen Ton aus.

## Abweichungen

- Die Pinselspitzen bleiben die vorhandene Stiftstärken-Auswahl, weil das Zeichenwerkzeug mit Kritzelpost und Bildunterschrift geteilt ist.
- Der Pinselstrich erklingt beim Aufsetzen, nicht durchgehend, damit er leise bleibt und das Zeichnen nicht bremst.

## Prüfungen

- `test/ui/exp-malen-raten.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit drei Menschen und echten Zügen: Pinselstrich nur beim Zeichner, falsche und richtige Vermutung, goldener Rahmen bei allen, Galerie des Abends, nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-malen-raten.test.js`: 3 Tests (alle erraten, Eieruhr, Palette).
- `npm run test:fast`: bestanden, kein Fehler.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 355 | 6416.3 ms | 55.17 | ≥ 45 |
| Mobilansicht | 377 | 6399.7 ms | 58.75 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Goldener Rahmen: [Desktop](goldrahmen-desktop.png), [Mobilansicht](goldrahmen-mobil.png)
- Galerie des Abends: [Desktop](galerie-desktop.png), [Mobilansicht](galerie-mobil.png)
