# ART-T2b · Pilotwelten Skip-Bo (SB-09 Burgenbau, SB-01 Montagewerk 12, SB-04 Orbitalstation)

Implementierungscommit: `IMPL_COMMIT`

## Ergebnis

Feinschliff nur für die drei Pilotwelten (`public/games/card-worlds/pilot-skipbo.css`, Auswahl über `data-card-world`). Alle anderen Welten bleiben wie in ART-T1.

- **Baureihen als Bauplätze der Welt:** SB-09 Steinfundament mit Zinnen, SB-01 Montageplatz mit Warnstreifen und Nieten, SB-04 Andockring mit Leuchtkante. Jeder Platz hat eine Bauleiste in der Welt (Gold, Fließband, Neon). Der leere Platz zeigt das Weltbild der ersten Karte als Schatten mit der Zahl 1.
- **Lesbarkeit:** Beschriftung „Gemeinsame Baureihen“, Platznummern und „Nächste N“ stehen in hellen Weltfarben statt in dunklem Grün auf dunklem Grund. Das Zielfeld („Dein Ziel“) ist dunkel in der Welt statt hellem Papier.
- **Joker:** Streifen oben in der Weltfarbe, großes Symbol, doppelter Ring ums Medaillon, Ecksymbole darunter.
- **Tisch:** unverändert aus ART-T1 (Weltton, Rahmenlinie), am Handy (390 × 844) geprüft.
- **Rückseite:** Skip-Bo zeigt am Tisch keine verdeckten Karten, deshalb gibt es hier nichts zu ändern. Das Rückseitenbild der Welten (`back.svg`) bleibt für UNO und Phase 10 in Gebrauch.

## Nachweise

| Datei | Inhalt |
|---|---|
| `SB-0x-desktop.webp`, `SB-0x-mobil.webp` | ganzer Tisch mit Baureihen, Bereich und Hand mit Joker |
| `test/ui/art-t2b-skipbo-pilot.spec.js` | je Welt: Bauplätze haben Weltgrund, Rand und Leiste, leerer Platz zeigt das Weltbild, Beschriftung nicht mehr im alten Dunkelgrün, Joker mit Streifen und Medaillon in der Karte, Zahlenkarten mit Weltbild |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t2b-skipbo-pilot.spec.js`.
