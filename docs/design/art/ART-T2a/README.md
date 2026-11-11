# ART-T2a · Pilotwelten UNO (U-04 Blockwelt, U-01 Zaubersaal, U-02 Hexerpfad)

Implementierungscommit: `a445cc8e2188577b8f1ed3827260516065e83ee4`

## Ergebnis

Feinschliff nur für die drei Pilotwelten (Datei `public/games/card-worlds/pilot-uno.css`, Auswahl über `data-card-world`). Alle anderen Welten bleiben wie in ART-T1.

- **Aktionskarten** (Aussetzen, Richtungswechsel, +2, Farbwahl, +4): Streifen am oberen Rand in der Weltfarbe, größeres Symbol im Medaillon, doppelter Ring um das Medaillon, Ecksymbole darunter. Zahlenkarten und Aktionskarten sind so auch in der Handyhand sofort zu unterscheiden.
- **Rückseite:** Die Kartenzahl sitzt als kleine Marke unten und überdeckt das Weltbild nicht mehr (vorher lag „85 Karten“ über dem Motiv).
- **Rahmen:** U-01 zweite feine Goldlinie innen, U-04 harte Pixelkanten mit Licht oben und Schatten unten, U-02 geprägtes Siegel als Medaillon.
- **Tisch und Handy:** unverändert aus ART-T1, am Handy (390 × 844) geprüft; Hand bleibt waagerecht scrollbar, Symbole lesbar.

## Nachweise

| Datei | Inhalt |
|---|---|
| `U-0x-desktop.webp`, `U-0x-mobil.webp` | ganzer Tisch mit Aktionskarten, Stapel und Ablage |
| `U-0x-desktop-hand.webp`, `U-0x-mobil-hand.webp` | Hand mit Aussetzen, Richtungswechsel, +2, +4, Farbwahl, Zahlen |
| `test/ui/art-t2a-uno-pilot.spec.js` | prüft je Welt: Weltbild auf jeder Karte, Medaillon innerhalb der Karte, Aktionssymbol statt Buchstabe, Rückseite mit Weltbild |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t2a-uno-pilot.spec.js`.
