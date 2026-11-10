# EXP-036 · Werwolf

Implementierung: `8a80abdf62eb1a3476bc7bb7871cc240fbede143`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Dorfplatz: Der Himmel wechselt mit der Phase (Nacht blau mit Mond, Tag warm mit Sonne). |
| Figuren & Material | Die eigene Rollenkarte ist eine Holztafel mit eigenem Zeichen je Rolle (Dorfbewohner, Werwolf, Seherin, Hexe, Amor, Jäger). |
| Klang | Palette `werwolf`: nachts Grillen und Eule, morgens der Hahn, Murmeln zur Abstimmung, Tock je abgegebener Stimme, dumpfer Gong bei der Hinrichtung (alle erzeugt), Holz beim nächtlichen Tod. |
| Animation | Dämmerung: Der alte Himmel blendet aus, Mond oder Sonne steigt auf. Beim Ausscheiden erscheint die Holztafel des Spielers und dreht sich um; sie zeigt die Rolle nur, wenn der Server sie nennt. |
| Highlight | Spielende: Vollmond geht auf (Werwölfe) oder die Sonne siegt (Dorf, Verliebte), jeweils mit eigenem Schluss-Akkord; das Ergebnisfenster wartet so lange. |

Spiellogik unverändert.

## Geheimnisse

Zu hören und zu sehen ist nur Öffentliches: Phase, Tote, Zahl der Stimmen. Nachtaktionen einzelner Rollen lösen weder Ton noch Bewegung aus. Zuschauer sehen keine Rollentafel.

## Abweichungen

- Die Atmosphäre nutzt die vorhandene Szene „Wald bei Nacht“; Grillen, Eule und Hahn kommen zusätzlich als kurze Effekte beim Phasenwechsel.
- Die Tafel dreht sich über `scaleX` (Kante – Rückseite), weil nur `transform`/`opacity` erlaubt sind.

## Prüfungen

- `test/ui/exp-werwolf.spec.js`: **6 bestanden** (Desktop und Mobilansicht): echte Nacht und echter Tagesanbruch mit `expectSound`, nur `transform`/`opacity`, Highlight, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- Ausscheiden und Spielende zeigt der Test über den Darstellungs-Hook auf dem echten Tisch; die Erkennung prüft `test/experience-werwolf.test.js` (4 Tests).
- `npm run test:fast`: bestanden, kein Fehler.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 212 | 3916.5 ms | 53.88 | ≥ 45 |
| Mobilansicht | 227 | 3883.2 ms | 58.20 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json). Messart wie in [EXP-088](../EXP-088/README.md).

## Bilder

- Tag: [Desktop](tag-desktop.png), [Mobilansicht](tag-mobil.png)
- Ausscheiden: [Desktop](ausscheiden-desktop.png), [Mobilansicht](ausscheiden-mobil.png)
- Vollmond: [Desktop](vollmond-desktop.png), [Mobilansicht](vollmond-mobil.png)
- Sonne: [Desktop](sonne-desktop.png), [Mobilansicht](sonne-mobil.png)
