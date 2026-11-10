# ART-002 · Texas Hold'em – Tisch und Chips

- **Implementierungscommit:** `7790b354c73f207d8c444e25526118d379e5a5f8`
- **Freigabe:** Tobi, 10.11.2026 („Stufe 3 anlegen + ART-002 Poker frei“)

## Was sich geändert hat

| Vorher | Nachher |
|---|---|
| Chips als CSS-Farbverlauf, 12–26 px; durch die Filterknopf-Regel der Startseite (`.chip`: min-height, padding) zu Ovalen gequetscht | eigene SVG-Chips in fünf Farben: einzeln als Draufsicht, im Stapel als Seitenansicht mit Kante – bei jeder Größe scharf |
| Stapel ineinandergeschoben | jeder Chip liegt sichtbar auf dem nächsten (Abstand 16 % der Chipbreite) |
| Holzrand und flacher Filz | gepolsterte Lederkante, Holzring mit Maserung, Filz mit Struktur, Lampenlicht, aufgedruckte Einsatzlinie und Schriftzug |
| Pokerchip-Stil blieb nach einem Pokertisch auf der Startseite hängen | Startseiten-Filter nur `button.chip`, Pokerchips nur `span.chip` |

Nur Hold'em (`#game[data-art-poker]`, `body.art-poker`). Omaha lädt dieselben Dateien und bleibt unverändert (Test).

## Nachweise

- Test: `test/ui/art-poker.spec.js` (Desktop und Handy, Omaha-Gegenprobe, Startseite nach dem Tisch)
- Roadmap/Lizenzen: `test/art-roadmap.test.js`, `docs/design/ART_LICENSES.md`
- Screenshots: `before-*.png` (alter Stand), `table-*.png` (Einsätze und Pot), `flop-*.png`
- Bildrate: `fps-desktop.json` (mit/ohne neue Optik bei 4× gedrosselter CPU, Mindestverhältnis 0,9). Zusätzlich im EXP-002-Showdown abwechselnd je sechs Läufe gemessen: ohne neue Optik im Mittel ≈ 43 FPS, mit ≈ 42 FPS (≈ 97 %). Das feste 45-FPS-Budget des EXP-002-Tests schwankt in der Testumgebung auch ohne ART-002 (37–46 FPS).

## Bewusst offen

- Am Handy überdecken die Spielerplätze teilweise den Pot in der Tischmitte; das ist ein Layout-Thema aus VIS-002 und nicht Teil von ART-002.
