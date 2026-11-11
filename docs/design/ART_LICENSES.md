# Grafik-Lizenzen (Stufe 3, ART-Pakete)

Jede Grafik in `public/games/<spiel>/art/` steht hier mit Herkunft und Lizenz. Fremde Dateien nur unter CC0 oder klar freien Lizenzen (MIT, ISC, SIL OFL; CC BY mit Namensnennung unten). Nur tatsächlich benutzte Dateien liegen im Repo.

## Eigene Grafiken (Spieleabend, gleiche Lizenz wie das Projekt)

| Paket | Dateien | Herkunft |
|---|---|---|
| ART-002 | `public/games/poker/art/chip-top-c1…c5.svg`, `public/games/poker/art/chip-side-c1…c5.svg` | eigene Zeichnung (per Skript erzeugt) |
| ART-002 | `public/games/poker/art/felt.webp` | eigene Filzstruktur (erzeugtes Rauschen, 128 × 128, kachelbar) |
| ART-004 | `public/games/farbenchaos/art/table.webp` | eigene Leinenstruktur (erzeugt, 96 × 96, kachelbar) |
| ART-009 | `public/games/stapelrennen/art/table.webp` | eigene Leinen-/Papierstruktur (erzeugt, 96 × 96, kachelbar) |
| ART-008 | `public/games/zehnetappen/art/table.webp` | eigene Köper-Tischtuchstruktur (erzeugt, 96 × 96, kachelbar) |
| ART-T1 | `public/games/card-worlds/art/<Welt>/` mit `0.svg`–`3.svg`, `w.svg`, `back.svg` für die Welten U-01, U-02, U-03, U-04, U-05, U-06, U-07, U-08, U-09, U-10, SB-01, SB-02, SB-03, SB-04, SB-05, SB-06, SB-07, SB-08, SB-09, SB-10, P-01, P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-09, P-10, X-01, X-02, X-03, X-04, X-05, X-06, X-07, X-08, X-09, X-10 | eigene Zeichnungen, erzeugt mit `node scripts/build-card-worlds.mjs` aus `scripts/card-worlds/motifs.mjs`; Vorbilder nur als Stimmung, keine Logos oder Figuren |

## Fremde Grafiken

Noch keine.

## Musik (Wintermusik, ART-T6)

Fremde Musik, nur in den Winterwelten und nur auf Wunsch des Spielers (Musik-Schalter, Standard aus). Dateien in `public/games/card-worlds/music/`, aus den Originalen neu kodiert (MP3, 80 kbit/s, Lautheit angeglichen, je 1,5 s ein- und ausgeblendet, kurze Loops mehrfach aneinandergehängt); die unveränderten Originale werden nicht ausgeliefert. Die Pixabay-Stücke sind eine vom Projektinhaber ausdrücklich freigegebene Ausnahme von der Regel „CC0 bevorzugt“ (Pixabay-Inhaltslizenz: kostenlos, ohne Namensnennung, keine Weitergabe als unverändertes eigenständiges Produkt).

| Datei | Titel und Urheber | Quelle | Lizenz |
|---|---|---|---|
| `wintery-loop.mp3` | „Wintery loop“, Emma M. Andersson (3× aneinandergehängt) | opengameart.org/content/wintery-loop | CC0, gemeinfrei seit Januar 2017 |
| `through-the-snow.mp3` | „Through the Snow“ (Loop), Cleyton Kauffman (5× aneinandergehängt) | opengameart.org/content/snow-theme | CC0 (Readme des Autors) |
| `through-the-snow-slow.mp3` | „Through the Snow“ (Slowed Loop), Cleyton Kauffman (4× aneinandergehängt) | opengameart.org/content/snow-theme | CC0 (Readme des Autors) |
| `winter-wind.mp3` | „Winter Wind Loop“ | opengameart.org/node/114089 | CC0 |
| `christmas-synths.mp3` | „Happy synths loop with slight christmas feeling“, 3xBlast | opengameart.org/content/happy-synths-loop-with-slight-christmas-feeling | CC0 |
| `pulsebox-happy-jazz.mp3` | „Happy Christmas Jazz“, pulsebox | pixabay.com/de/music (Datei 432305) | Pixabay-Inhaltslizenz (freigegebene Ausnahme) |
| `pulsebox-fun-jazz.mp3` | „Fun Christmas Jazz“, pulsebox | pixabay.com/de/music (Datei 432319) | Pixabay-Inhaltslizenz (freigegebene Ausnahme) |
| `atlasaudio-jazz.mp3` | „Christmas Jazz“, atlasaudio | pixabay.com/de/music (Datei 621548) | Pixabay-Inhaltslizenz (freigegebene Ausnahme) |
| `dpstudio-winter-wonderland.mp3` | „Winter Wonderland Chorus“, DPStudioMusic | pixabay.com/de/music (Datei 274785) | Pixabay-Inhaltslizenz (freigegebene Ausnahme) |
| `dpstudio-crimson-ribbon.mp3` | „Crimson Ribbon Melody“, DPStudioMusic | pixabay.com/de/music (Datei 274783) | Pixabay-Inhaltslizenz (freigegebene Ausnahme) |

## Schriften (SIL Open Font License 1.1)

Unverändert aus den Fontsource-Paketen (npm `@fontsource/<name>`, Ausschnitt „latin“), je mit Lizenztext daneben. Nur für die Kartenwelten (ART-T1), geladen nur von der gewählten Welt.

| Schrift | Datei | Lizenztext | Urheber |
|---|---|---|---|
| Cinzel 900 | `public/fonts/worlds/cinzel.woff2` | `public/fonts/worlds/cinzel-OFL.txt` | The Cinzel Project Authors |
| Orbitron 900 | `public/fonts/worlds/orbitron.woff2` | `public/fonts/worlds/orbitron-OFL.txt` | The Orbitron Project Authors |
| Press Start 2P | `public/fonts/worlds/press-start-2p.woff2` | `public/fonts/worlds/press-start-2p-OFL.txt` | The Press Start 2P Project Authors (CodeMan38) |
| Bangers | `public/fonts/worlds/bangers.woff2` | `public/fonts/worlds/bangers-OFL.txt` | The Bangers Project Authors |
| Lilita One | `public/fonts/worlds/lilita-one.woff2` | `public/fonts/worlds/lilita-one-OFL.txt` | Juan Montoreano |
| Black Ops One | `public/fonts/worlds/black-ops-one.woff2` | `public/fonts/worlds/black-ops-one-OFL.txt` | The Black Ops One Project Authors (Sorkin Type) |
| Righteous | `public/fonts/worlds/righteous.woff2` | `public/fonts/worlds/righteous-OFL.txt` | Astigmatic (AOETI) |
| Fredoka 700 | `public/fonts/worlds/fredoka.woff2` | `public/fonts/worlds/fredoka-OFL.txt` | The Fredoka Project Authors |

## Namensnennung (für CC BY)

Noch keine.
