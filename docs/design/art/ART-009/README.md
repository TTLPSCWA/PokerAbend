# ART-009 · Skip-Bo – Karten, Stapelhöhe, Werkbank

- **Implementierungscommit:** `1646b30ad16ca342e97a3a8112404ff223dc0d81`
- **Freigabe:** Tobi, 10.11.2026 („dann geh nun ART-009 Skip-Bo an“)

## Was sich geändert hat

| Vorher | Nachher |
|---|---|
| Karten mit Rahmen und einem weichen Schatten | mehrlagige Papierkante, Lichtstreif, leichte Wölbung |
| Baureihe mit 11 Karten sah aus wie eine mit 1 Karte | sichtbare Stapelhöhe in vier Stufen (Baureihen, eigene Ablagen, Spielstapel) |
| Glatte Flächen | gemeinsame Baureihen und eigener Bereich mit eigener Leinen-/Papierstruktur; Baureihen als Mulden |

Die Farbcodierung (1–4 blau, 5–8 grün, 9–12 rot, Joker dunkel/gold) bleibt. Gewählte Karten und Ziele behalten den Rahmen der Kartenbedienung. Schalter: `.kg-stapelrennen[data-art-skipbo]`. Die Stapelhöhe kommt aus den öffentlichen Kartenanzahlen (`data-depth`), Spiellogik unverändert.

## Nachweise

- Test: `test/ui/art-stapelrennen.spec.js` (Klassisch und Team am PC, Klassisch am Handy, feste Testszene mit 3/1/7/11 Karten in den Baureihen)
- Screenshots: `before-*.png` (alter Stand), `table-*.png` (neu, oben und eigener Bereich)
- Leistung: `fps-desktop.json`. Hauptthread-Rechenzeit und Bildrate mit und ohne neue Optik bei 4× gedrosselter CPU, Median aus 5 Läufen.
- Gegenprobe: Kartenbedienungs-Tests für Skip-Bo (`card-ux*.spec.js`) grün.
