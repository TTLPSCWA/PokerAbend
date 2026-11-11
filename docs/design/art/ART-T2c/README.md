# ART-T2c · Pilotwelten Phase 10 (P-03 Testkammer X, P-06 Kart-Grand-Prix, P-10 Rhythmus-Tour)

Implementierungscommit: `IMPL_COMMIT`

## Ergebnis

Feinschliff nur für die drei Pilotwelten (`public/games/card-worlds/pilot-phase10.css`, Auswahl über `data-card-world`). Alle anderen Welten bleiben wie in ART-T1.

- **Phasenanzeige als Reise der Welt:** P-03 Testkammern (Felder mit Haken, aktuelle Kammer leuchtet orange, Rasterpanel), P-06 Rennstrecke (gelbe Markierungen, rotes Kart als aktuelle Station, Zielflagge bei Phase 10), P-10 Tourstationen (Noten für erledigte, Stern für die aktuelle, Bühnenlicht im Panel).
- **Joker und Aussetzen:** Streifen oben in der Weltfarbe, großes Symbol, doppelter Ring. Aussetzen trägt zusätzlich einen roten Querstrich über dem Bild, damit beide Karten nicht mehr gleich aussehen.
- **Rückseite:** Die Kartenzahl steht in einem dunklen Band unten, das Weltmotiv bleibt frei.
- **Tisch:** Planungsfelder und ausgelegte Gruppen in der Weltfarbe mit Weltrand statt Standard-Blaugrün; P-03 mit dunkler Schrift auf dem hellen Laborpanel.

## Nachweise

| Datei | Inhalt |
|---|---|
| `P-xx-desktop.webp`, `P-xx-mobil.webp` | ganzer Tisch mit Phase 3, Planungsfeldern, Stapel und Ablage, Hand mit Joker und Aussetzen |
| `test/ui/art-t2c-phase10-pilot.spec.js` | je Welt: zehn Stationen unterscheidbar (erledigt, aktuell, offen), Phasentext mit Kontrast, Joker und Aussetzen mit Streifen und Medaillon in der Karte (Querstrich nur beim Aussetzen), Rückseite mit Weltbild und Zahl, Planungsfelder in der Welt, Zahlenkarten mit Weltbild |

Aufnahmen: `ART_CAPTURE=1 npx playwright test test/ui/art-t2c-phase10-pilot.spec.js`.
