# ART-T6 · Wintermusik

Implementierungscommit: `IMPL_COMMIT`

## Ergebnis

Ruhige Winter- und Weihnachtsmusik in den zehn Winterwelten (X-01 bis X-10) von UNO, Skip-Bo und Phase 10. Nur Klang, Spiellogik unverändert.

- **Schalter:** ♪-Knopf direkt neben dem ❄-Knopf (unten links), gleiche Gestalt, leuchtet golden wenn an. Er erscheint nur in Winterwelten. Standard ist **aus**; die Wahl wird pro Gerät gespeichert (`localStorage`, Schlüssel `cwMusic`). Jeder am Tisch entscheidet für sich selbst.
- **Wiedergabe:** Zehn Stücke als Liste, eines nach dem anderen, danach von vorn; das nächste Stück merkt sich das Gerät. Lautstärke 30 %, Stücke sind auf gleiche Lautheit gebracht und blenden 1,5 s ein und aus. Es wird nur das aktuelle Stück geladen (kein Vorladen). Bei Browser-Sperre (Seite neu geladen, Schalter war an) startet die Musik beim ersten Tippen. Wird der Tab verborgen, pausiert sie.
- **Weltwechsel:** Zwischen Winterwelten läuft das Stück weiter; bei Standard oder einer anderen Welt verschwinden Knopf und Musik.
- **Dateien:** `public/games/card-worlds/music/*.mp3`, zusammen etwa 11 MB (MP3, 80 kbit/s). Herkunft und Lizenz jeder Datei: `docs/design/ART_LICENSES.md` (fünf Stücke CC0, fünf Stücke Pixabay als ausdrücklich freigegebene Ausnahme).
- **Code:** `public/card-worlds.js` (Wiedergabeliste, Schalter), `public/games/card-worlds/pilot-winter.css` (Knopf).

## Nachweise

| Datei | Inhalt |
|---|---|
| `musik-schalter.webp` | ❄- und ♪-Knopf in einer Winterwelt (Desktop links, Handy rechts), Musik an |
| `test/ui/art-t6-wintermusik.spec.js` | Knopf nur in Winterwelten, Standard aus, Lage neben dem Schneeknopf, Musik spielt wirklich (nicht pausiert, Zeit läuft, Lautstärke ≤ 0,4, Quelle aus dem Musikordner), Weltwechsel startet nichts neu, Ausschalten pausiert und wird gespeichert, Gast hat eigenen Schalter, Standard-Welt ohne Knopf |
| `test/card-worlds-music.test.js` | jedes Stück der Liste existiert als MP3 (und umgekehrt), Größen, alle Dateien in der Lizenzliste, Standard aus |

Aufnahme: `ART_CAPTURE=1 npx playwright test test/ui/art-t6-wintermusik.spec.js`.
