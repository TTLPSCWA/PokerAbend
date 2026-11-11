# ART-T3 · Weitere Welten UNO (U-03, U-05, U-06, U-07, U-08, U-09, U-10)

Implementierungscommit: `36545fee3e3e9fca4c028a2dedc1078f4c9465e1`

## Ergebnis

Feinschliff der übrigen sieben UNO-Welten mit denselben Bausteinen wie bei den Pilotwelten (`public/games/card-worlds/more-uno.css`, nur für diese sieben Welten). Pilotwelten (ART-T2a), Winterwelten (ART-T5) und andere Spiele bleiben unverändert.

- **Aktionskarten** (Aussetzen, Richtungswechsel, +2, Farbwahl, +4): Streifen am oberen Rand in einer Farbe der Welt, größeres Symbol im Medaillon, doppelter Ring, Ecksymbole darunter.
- **Rückseite:** Kartenzahl als kleine Marke unten, das Weltmotiv bleibt frei.
- **Rahmendetails je Welt:** U-03 Leuchtring um das Medaillon, U-05 Runenlinie innen, U-06 dicke Comic-Kante am Medaillon, U-07 Holo-Glanz, U-08 goldener Medaillonrand (Stahlrahmen behält seinen Warnstreifen unten), U-09 gestrichelte Laternenlinie, U-10 Kristallfacetten als Innenlinie.

## Nachweise

| Datei | Inhalt |
|---|---|
| `tisch-rueckseite-desktop.webp` | Stapel (Rückseite mit Zahlenmarke) und Ablage aller sieben Welten |
| `haende-aktionskarten-desktop.webp` | Hand mit allen Aktionskarten und Zahlen in allen sieben Welten |
| `mobil.webp` | U-03, U-06, U-09 am Handy (390 × 844) |
| `test/ui/art-t3-uno-worlds.spec.js` | je Welt (Desktop und Handy): Weltbild auf jeder Karte, Medaillon in der Karte, Streifen nur auf Aktionskarten, Symbol statt Buchstabe, Rückseite mit Weltbild und Zahl unten innerhalb der Karte |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t3-uno-worlds.spec.js` (Einzelbilder unter `test-results/art-t3/`).
