# EXP-004 · UNO

Implementierung: `f0052c85679b9b6c719d5d6db949d42e1e36fd11`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Alle fünf Farbwelten bleiben; das Erlebnis gilt in jeder von ihnen. Beim Richtungswechsel dreht sich ein Pfeilring über der Tischmitte sichtbar in die neue Richtung. |
| Figuren & Material | Kartenrücken je Welt und unterstrichene 6/9 gab es schon (VIS-004). Neu: Die Wunschfarbe erscheint als Drehscheibe in der gewählten Farbe. |
| Klang | Palette `uno`: knackiges Kartenklatschen, Zieh-Rascheln mit Stapeleffekt (bis zu vier Schläge), Stopp-Ton beim Aussetzen, Wusch beim Richtungswechsel, kurze Fanfare bei der letzten Karte (alle vier erzeugt). |
| Animation | Eigene gezogene Karten fächern vom Stapel in die Hand. Zieht ein anderer, fliegen die Kartenrücken einzeln vom Stapel zu seinem Platz. Wer aussetzt, wird kurz blass. |
| Highlight | Stapel-Schlacht: Wird eine Ziehkarte auf eine Ziehkarte gestapelt, wächst der Zähler über der Ablage („+4!“, „+6!“). Wer die Kette am Ende zieht, bekommt den ganzen Schwall Karte für Karte. |

Spiellogik unverändert.

## Geheimnisse

Fremde Karten fliegen nur als neutrale Kartenrücken; ihre Werte kennt die Ansicht gar nicht. Alle Ereignisse werden aus öffentlichen Angaben abgelesen (Kartenzahl, Ablage, Richtung, offene Strafe).

## Abweichungen

- Der Pfeilring dreht sich als Einblendung über der Ablage; der Tischring selbst dreht sich nicht, weil UNO die kompakte Spielerleiste nutzt.
- Der bestehende Kartenschein der Farbwelten (VIS-004) bleibt unverändert; er zählt nicht zu diesem Paket.
- Die Ereigniserkennung liegt in `public/games/shedding-events.js` und wird mit Mau-Mau (EXP-003) geteilt.

## Prüfungen

- `test/ui/exp-farbenchaos.spec.js`: **6 bestanden** (Desktop und Mobilansicht) mit drei Menschen: echte Züge (Ablegen, Ziehen mit Fächer), dazu Richtungswechsel, Wunsch, Aussetzen, Stapel-Schlacht und Schwall über den Darstellungs-Hook auf dem echten Tisch; nur `transform`/`opacity`, „Animationen reduzieren“ (≤ 150 ms), Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-shedding.test.js`: 4 Tests zur Erkennung.
- `test/ui/uno-ultimate.spec.js` und `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 198 | 3733.1 ms | 52.77 | ≥ 45 |
| Mobilansicht | 206 | 3599.8 ms | 56.95 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Richtungswechsel: [Desktop](richtungswechsel-desktop.png), [Mobilansicht](richtungswechsel-mobil.png)
- Stapel-Schlacht: [Desktop](stapel-desktop.png), [Mobilansicht](stapel-mobil.png)
- Schwall: [Desktop](schwall-desktop.png), [Mobilansicht](schwall-mobil.png)
