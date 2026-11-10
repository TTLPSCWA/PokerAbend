# ART-008 · Phase 10 – Karten, Auslagen, Phasensteine, Tisch

- **Implementierungscommit:** `52092b9aed4fa210c3446efc588c0e47fc1c266f`
- **Freigabe:** Tobi, 10.11.2026 („joo go für phase 10“)

## Was sich geändert hat

| Vorher | Nachher |
|---|---|
| Flache Karten mit Rahmen | mehrlagige Papierkante, Lichtstreif, leichte Wölbung; Joker behält seinen Vierfarbkreis |
| Ausgelegte Gruppen als lose Kartenreihe | Karten rücken zusammen und liegen leicht schräg auf einer eigenen Spielmatte; die große Zahl bleibt immer frei |
| Phasenfortschritt als kleine Kästchen | runde Spielsteine, erledigte golden, aktuelle mit Ring |
| Stapel und Ablage flach | sichtbare Kartenhöhe |
| Glatte Flächen | eigene Köper-Tischtuchstruktur |

Schalter: `.kg-zehnetappen[data-art-phase10]`. Gewählte Karten und „Abwerfen“ behalten ihre Markierungen. Spiellogik unverändert.

## Nachweise

- Test: `test/ui/art-zehnetappen.spec.js` (Klassisch, Kurz, Team am PC, Klassisch am Handy; feste Szene mit Drilling + 4er-Folge ausgelegt)
- Screenshots: `before-*.png` (alter Stand), `table-*.png` (neu, oben und Auslagen)
- Leistung: `fps-desktop.json`. Hauptthread-Rechenzeit und Bildrate mit und ohne neue Optik bei 4× gedrosselter CPU, Median aus 5 Läufen.
- Gegenprobe: Kartenbedienungs-Tests für Phase 10 (`card-ux*.spec.js`) grün.
