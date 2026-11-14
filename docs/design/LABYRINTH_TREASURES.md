# Labyrinth-Brett – lizenzierte Schatzsymbole (VIS-058)

Stand: 15. November 2026. Version **3.8.0**. Freigegeben war ausschließlich die Darstellung von `labyrinth-brett`. Keine neuen Regeln, Spiele, Abhängigkeiten oder Serverdeployments. Ausgangsstand: `390e9233acbf47151439a7a377f3ab1683de08e7` (3.7.0). Der tatsächliche Implementierungscommit wird nach Erstellung im Nachweis ergänzt; der ursprüngliche BACKLOG-06-Commit bleibt historisch erhalten.

## Ergebnis und Zuordnung

23 bereits vorbereitete SVGs aus dem Game-icons-Paket wurden unverändert kopiert. Alle 24 bestehenden IDs bleiben stabil (intern 0–23, sichtbar 1–24). Nummer und bisherige deutsche/englische Namen bleiben erhalten. Die Darstellung gilt für Brett, freies Plättchen und ausschließlich den eigenen aufgedeckten aktuellen Auftrag. **Ring (ID 11, Nummer 12) hat kein geeignetes vorbereitetes Symbol**: `engagement-ring.svg` zeigt überwiegend eine Hand und wurde nicht integriert. Keine Ersatzrecherche und keine neuen Grafiken.

| Interne ID | Nummer | Bestehende Namen DE / EN | Datei | Urheber |
|---|---|---|---|---|
| 0 | 1 | Bernstein / Amber | `amber-mosquito.svg` | Delapouite |
| 1 | 2 | Kompass / Compass | `compass.svg` | Lorc |
| 2 | 3 | Muschel / Shell | `spiral-shell.svg` | Lorc |
| 3 | 4 | Laterne / Lantern | `lantern.svg` | Lorc |
| 4 | 5 | Feder / Feather | `quill.svg` | Lorc |
| 5 | 6 | Blatt / Leaf | `oak-leaf.svg` | Delapouite |
| 6 | 7 | Glocke / Bell | `ringing-bell.svg` | Lorc |
| 7 | 8 | Stern / Star | `round-star.svg` | Delapouite |
| 8 | 9 | Krone / Crown | `crown.svg` | Lorc |
| 9 | 10 | Schlüssel / Key | `key.svg` | Lorc |
| 10 | 11 | Mond / Moon | `moon.svg` | Lorc |
| 11 | 12 | Ring / Ring | Nummer; vorbereitetes Hand/Ring-Motiv nicht geeignet | — |
| 12 | 13 | Buch / Book | `book-cover.svg` | Lorc |
| 13 | 14 | Kelch / Cup | `jeweled-chalice.svg` | Lorc |
| 14 | 15 | Fisch / Fish | `circling-fish.svg` | Delapouite |
| 15 | 16 | Blüte / Flower | `flower-emblem.svg` | Delapouite |
| 16 | 17 | Kristall / Crystal | `crystal-cluster.svg` | Lorc |
| 17 | 18 | Anker / Anchor | `anchor.svg` | Lorc |
| 18 | 19 | Sonne / Sun | `sun.svg` | Lorc |
| 19 | 20 | Käfer / Beetle | `scarab-beetle.svg` | Lorc |
| 20 | 21 | Würfel / Die | `dice-six-faces-three.svg` | Delapouite |
| 21 | 22 | Uhr / Clock | `alarm-clock.svg` | Delapouite |
| 22 | 23 | Pinsel / Brush | `paint-brush.svg` | Delapouite |
| 23 | 24 | Schiff / Ship | `sailboat.svg` | Delapouite |

Die Gangpfade werden weiter direkt aus denselben Masken gezeichnet. Die separat darüber liegenden Symbole bleiben beim Drehen aufrecht; Figuren liegen unterhalb des Schatzes. Zielumrandung und Hervorhebung erreichbarer Felder bleiben aus der persönlichen Serveransicht abgeleitet. Die eigene Figur erhält zusätzlich einen hellen Rand. Alle Socket-Aktionen und die vier Engine-/Bot-Dateien sind unverändert.

## Herkunft, Lizenz und Ladeaufwand

Quelle: [Game-icons/icons, festgehaltener Commit 82d948812bfe3f269ef8f731dcdb07b08160edc4](https://github.com/game-icons/icons/tree/82d948812bfe3f269ef8f731dcdb07b08160edc4). Urheber **Lorc und Delapouite**, Lizenz [CC BY 3.0 Unported](https://creativecommons.org/licenses/by/3.0/). Keine CC0-Einstufung. Die vorab vorbereiteten Dateien entfernen den schwarzen Hintergrund und färben die Vordergrundpfade goldfarben (`#edcc84`); Pfadgeometrie unverändert. In dieser Integration wurden ihre Bytes nicht verändert.

Jede verwendete Datei ist einzeln mit Quelle, Urheber, Lizenzlink und Änderungen in [ART_LICENSES.md](ART_LICENSES.md) erfasst. Das [ausgelieferte Manifest](../../public/games/labyrinth-brett/asset-manifest.json) enthält zusätzlich SHA-256 der vorbereiteten und ursprünglichen Dateien. Der [Original-Lizenzhinweis](../../public/games/labyrinth-brett/game-icons-LICENSE.txt) liegt bei. Die veröffentlichte App bietet **Grafiknachweise / Artwork credits** in Lobby, Spiel und Regeln; die [Credits-Seite](../../public/games/labyrinth-brett/credits.html) nennt sämtliche Dateien und Autoren. Es gibt keine externen Bildabrufe und keine zusätzlichen Bibliotheken.

Alle 23 SVGs zusammen: **37.325 Bytes** vor HTTP-Kompression, einzeln 273–3988 Bytes, skalierbare 512×512-viewBox und transparenter Hintergrund. Browser-Decodierung aller Symbole erfolgreich; keine Skripte, Rasterbilder, externen Referenzen oder Eventhandler in den SVGs. Der Browser kann identische URLs für Brett/Auftrag/freies Plättchen wiederverwenden. Dies ist eine Größen- und Funktionsprüfung; keine gemessene Internet-Ladezeit oder Prüfung auf echten Smartphones.

## Tests und Abgrenzung der Nachweise

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| `node --test test/labyrinth-treasure-art.test.js test/backlog06.test.js` | **21 bestanden**, 0 fehlgeschlagen: vier neue Grafiktests, 17 bestehende Regel-/Bot-Tests. |
| `npm run test:fast` | **2.058 bestanden**, 0 fehlgeschlagen, 3 bestehende Tests ausgelassen (107,823 s). |
| Neue Render-Matrix | **24 IDs × 16 Masken × 4 Drehungen = 1.536 Kombinationen**; Gangpfade, Dateizuordnung und freies Plättchen geprüft, ohne Zustand zu verändern. Einschließlich der im normalen Spiel nicht erzeugten Masken. |
| Bestehende und neue Playwright-Prüfungen, gefiltert auf `labyrinth-brett` | **8 bestanden**, 0 fehlgeschlagen: Desktop und Mobil; echte komplette Hard-Bot-Partien, drei Bot-Stufen, Touch-Aktionen, Pause/Reload, Zuschauer, englische Regeln und neue Grafik-/Fallbacktests. |
| Kontrollierter zusätzlicher Browserlauf | **7 Prüfgruppen bestanden**: alle 24 IDs, vier echte Drehungen, echter Reiheneinschub mit vier gemeinsam über den Rand geschobenen Figuren, Schatzsammlung mit nachfolgendem Ringauftrag, unabhängiger Zuschauer, Wiederverbindung/Englisch/Zoom und veröffentlichte Credits. |
| Fehlende Grafik | Echter absichtlich ausgelöster HTTP-404 für Kompass: defektes Bild entfernt, Nummer 2 und zugänglicher Name bleiben; andere Symbole laden weiter. |
| Bildschirmgrößen | Vorher/Nachher jeweils **1920×1080, 1440×900, 768×1024, 390×844, 360×800**; zusätzlich bestehende Regression 900×450. Kein horizontaler Seitenüberlauf; vier Figuren ohne Schatzüberlagerung; Tastaturverschiebung und Zoom geprüft. |

Der zusätzliche Browserlauf verwendet eine **kontrollierte Testbelegung** auf einem isolierten Loopback-Server mit temporären Daten, vier getrennten echten Spieler-Browserkontexten und einem Zuschauer. 23 Schätze liegen für die Bildmatrix auf dem Brett, Schatz 24 auf dem freien Plättchen; alle Figuren werden bewusst auf dasselbe Feld gesetzt. Aufträge werden für den Test serverseitig vorgegeben, nicht aus einer natürlichen Zufallspartie abgeleitet. Danach erfolgen Drehung, Einschieben und Sammeln über echte UI-/Socket-Aktionen. Die öffentlichen Ansichten bleiben bei Änderung eines fremden Geheimauftrags identisch. Die neuen Playwright-Darstellungsmatrizen injizieren ausdrücklich nur einen Render-Testzustand; sie sind kein zusätzlicher Beweis für Spielregeln. Dafür stehen die bestehenden Engine-/Browsertests und die tatsächlichen Aktionen des Zusatzlaufs.

Ein vorgezogener `test:fast`-Lauf scheiterte ausschließlich am noch historischen CSS-Hash im BACKLOG-06-Nachweis (2.057 bestanden, 1 fehlgeschlagen, 3 ausgelassen). Nach Aktualisierung der Quellprüfsummen bestand der abschließende Lauf vollständig; die bestehende Prüfung wurde nicht abgeschwächt.

Geprüft wurden Chromium mit Desktop- und emuliertem Touch-Profil sowie zugängliche Namen/Fokus/Tastatur im Browser. Kein manueller NVDA-/VoiceOver-Test, kein echter iOS-/Android-Gerätetest und kein neuer Firefox-/WebKit-Lauf.

## Vorher / Nachher

[Vergleichsgalerie öffnen](screenshots/labyrinth-brett/treasures-2026-11/vergleich.html). Unbearbeitete PNG-Aufnahmen mit gleichen öffentlichen Testdaten, gleicher Rolle und gleicher Größe; SHA-256 und zusätzliche Aufnahmen stehen im [Screenshot-Nachweis](screenshots/labyrinth-brett/treasures-2026-11/screenshots.json). Die historischen BACKLOG-06-Aufnahmen wurden nicht überschrieben.

| Bildschirm | Vorher | Nachher |
|---|---|---|
| 1920x1080 | [PNG](screenshots/labyrinth-brett/treasures-2026-11/before-1920x1080.png) | [PNG](screenshots/labyrinth-brett/treasures-2026-11/after-1920x1080.png) |
| 1440x900 | [PNG](screenshots/labyrinth-brett/treasures-2026-11/before-1440x900.png) | [PNG](screenshots/labyrinth-brett/treasures-2026-11/after-1440x900.png) |
| 768x1024 | [PNG](screenshots/labyrinth-brett/treasures-2026-11/before-768x1024.png) | [PNG](screenshots/labyrinth-brett/treasures-2026-11/after-768x1024.png) |
| 390x844 | [PNG](screenshots/labyrinth-brett/treasures-2026-11/before-390x844.png) | [PNG](screenshots/labyrinth-brett/treasures-2026-11/after-390x844.png) |
| 360x800 | [PNG](screenshots/labyrinth-brett/treasures-2026-11/before-360x800.png) | [PNG](screenshots/labyrinth-brett/treasures-2026-11/after-360x800.png) |

Zusätzlich: [Einschub und vier Figuren](screenshots/labyrinth-brett/treasures-2026-11/after-shift-and-players.png), [Zuschauer](screenshots/labyrinth-brett/treasures-2026-11/after-spectator.png), [Englisch und Zoom](screenshots/labyrinth-brett/treasures-2026-11/after-english-zoom.png).

Die Sichtprüfung führte zu einer Korrektur der intrinsischen Grid-Breite: Der Brettcontainer bleibt auf schmalen Displays innerhalb des Spielbereichs. Fokus und Pfeiltasten erlauben internes seitliches Verschieben; ein Hinweis macht dies sichtbar. Die Höhe berücksichtigt Spielerleiste, Auftrag und Aktionsdock, damit die unterste Brettreihe auf Desktop/Tablet nicht verdeckt wird. Auf kleinen Mobilbildschirmen muss das mindestens 396 px breite Brett weiter intern seitlich und der Spielbereich vertikal verschoben werden; der Zoommodus benötigt mehr Platz. Filigrane Symbole und die ergänzenden Nummern bleiben dort klein, weshalb Namen und Vergrößerung erhalten sind. Eine Prüfung des subjektiven Wiedererkennens mit echten Spielern wurde nicht durchgeführt.

## Betroffene Dateien

- `public/games/labyrinth-brett/labyrinth-brett.js` und `.css`: Symbole, Zahlenfallback, Figurenabstand, Fokus/Scrollen und Credits-Links.
- `public/games/labyrinth-brett/art/`: ausschließlich die 23 oben genannten SVGs; dazu daneben `asset-manifest.json`, `credits.html` und `game-icons-LICENSE.txt`.
- `test/labyrinth-treasure-art.test.js`, `test/ui/labyrinth-treasure-art.spec.js`: gezielte Asset-/Darstellungsregressionen.
- `games/labyrinth-brett/evidence.json`, `docs/design/game-visual-roadmap.json` (nur VIS-058): aktuelle Quellprüfsummen und Ergänzungsnachweis; historische Spielimplementierung bleibt erhalten. Kein vollständiger Abschluss des geplanten ART-058-Pakets behauptet.
- `docs/design/ART_LICENSES.md`, dieser Bericht und die verlinkte Screenshot-Galerie.
- `package.json`, `package-lock.json` (nur Projektversion), `CHANGELOG.md`, `README.md`, `docs/betrieb.md`: Version 3.7.0 → **3.8.0**.

Wissens-/Code-Vault, Import-Staging, private Asset-Auswahl und andere Spiele wurden nicht verändert. Keine Commits mit Rohpaketen, privaten Transkripten oder Witcher-Inhalten. Kein Serverdeployment. Der ausdrücklich freigegebene Main-Push darf den vorhandenen Test-/GHCR-Workflow auslösen.
