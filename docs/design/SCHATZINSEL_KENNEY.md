# Schatzinsel – Kenney-Inselgrafiken (VIS-069)

Stand: 15. November 2026. Version **3.9.0**. Ausschließlich die grafische Verbesserung von `schatzinsel` wurde freigegeben. Ausgangsstand: `c1a3ae6f7286d95c794317bb3ed88620c997c389`, Version 3.8.0; lokales `main`, `origin/main` und GitHub waren identisch und die vorherige CI erfolgreich. Implementierungscommit dieser Grafikergänzung: `7a0698b65a36878898f0c85d50b4424c8bc922d0`.

## Ergebnis

Die bisher getrennten grünen Felder liegen jetzt auf einer zusammenhängenden, hellen Sandinsel mit festen Küstenrändern und Wasser. **Alle 64 Suchfelder A1–H8 bleiben erhalten**, unabhängig von der dekorativen Küste. Das kleine Uferboot ist fest positionierte Dekoration, kein Suchfeld und keine neue Spielmechanik.

Die Inselgestaltung liest keine versteckten Positionen, Spieler-IDs oder Fundorte. Küste, Sand, Wasser und Boot sind für alle Betrachter dieselbe feste Komposition. Gegnerische unberührte Felder haben keine abweichenden Bilder, Klassen oder Attribute. Nur eigene Verstecke und öffentlich bekannte Grabungen erzeugen Marker. Die vorhandenen Zeichen ◆ und H/W/K bleiben; ein Fehlschlag ohne Hinweis erhält ×. Koordinaten bleiben auch unter Fund-/Hinweismarkierungen sichtbar. Ausgewählte Verstecke, gefundene Schätze, eigene Verstecke und ausgegrabene leere Felder unterscheiden sich durch Kontur, Form und Beschriftung.

Die Lobby verwendet dieselben Kenney-Dateien in einer dekorativen SVG-Komposition. Sie erzeugt keine zweite Spielerleiste. Die bestehende Auswahl der Inseln einschließlich eigener und ausgeschiedener Inseln bleibt erhalten; nur fremde aktive Inseln bieten im eigenen Zug erlaubte Grabungsaktionen an. Spielregeln, Ereignisnamen und Servervalidierung sind unverändert.

## Tatsächlich verwendete Dateien und Lizenz

**Kenney Pirate Pack 1.0**, Urheber **Kenney Vleugels**, [offizielle Quelle](https://kenney.nl/assets/pirate-pack), [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Die Paketlizenz nennt ausdrücklich persönliche und kommerzielle Nutzung; Namensnennung ist nicht verpflichtend. Quelle und Lizenz werden freiwillig in der App verlinkt.

Die Dateien kommen aus dem bereits geprüften offiziellen Download. Der abweichende GitHub-Spiegel wurde nicht als Quelle der übernommenen Bytes benutzt. Archiv-SHA-256: `91a0a43446910357e38b877971a94c06e6b3d9d28c035e51c107a1731e84f76a`. Hash des originalen Lizenzbelegs: `39846e7868ef9e1a7be5199be02811f52ac4b642c1a1838a3552f00418dcb5e4`.

| Datei unter public/games/schatzinsel/art/ | Verwendung | Bytes | Original im offiziellen Paket |
|---|---|---|---|
| `tile_01.webp` | Nordwest-Ufer | 1034 | `PNG/Default size/Tiles/tile_01.png` |
| `tile_02.webp` | Nordufer | 766 | `PNG/Default size/Tiles/tile_02.png` |
| `tile_03.webp` | Nordost-Ufer | 1088 | `PNG/Default size/Tiles/tile_03.png` |
| `tile_17.webp` | Westufer | 808 | `PNG/Default size/Tiles/tile_17.png` |
| `tile_19.webp` | Ostufer | 812 | `PNG/Default size/Tiles/tile_19.png` |
| `tile_33.webp` | Südwest-Ufer | 1036 | `PNG/Default size/Tiles/tile_33.png` |
| `tile_34.webp` | Südufer | 758 | `PNG/Default size/Tiles/tile_34.png` |
| `tile_35.webp` | Südost-Ufer | 1016 | `PNG/Default size/Tiles/tile_35.png` |
| `tile_69.webp` | Durchgehender heller Sand | 620 | `PNG/Default size/Tiles/tile_69.png` |
| `tile_81.webp` | Festes dekoratives Uferboot | 1292 | `PNG/Default size/Tiles/tile_81.png` |
| `tile_73.webp` | Dekoratives Wasser | 654 | `PNG/Default size/Tiles/tile_73.png` |

Alle elf Dateien sind **64×64 Pixel** groß, insgesamt **9.884 Bytes** vor HTTP-Kompression. Es wurden die vorbereiteten WebP-Dateien bytegleich übernommen: keine neue Hochskalierung, Farbänderung oder Rastergrafik erzeugt. Die vorherige Vorbereitung kodierte die originalen PNGs als WebP. CSS und SVG wiederholen bzw. skalieren diese Dateien in ihrer ursprünglichen Ausrichtung; es gibt keine clientseitige 3D-Szene und keine neuen Abhängigkeiten. Die übernommenen Dateien wurden erneut gegen die vorbereiteten und ursprünglichen Dateihashes geprüft und im Browser dekodiert.

Das [Asset-Manifest](../../public/games/schatzinsel/asset-manifest.json) enthält pro Datei Pfad, Größe, Ursprung, Urheber, Lizenz, Änderungen und SHA-256 der Original- und WebP-Datei. Der [ursprüngliche Lizenzhinweis](../../public/games/schatzinsel/kenney-LICENSE.txt) liegt bei. Jede Datei ist außerdem einzeln in [ART_LICENSES.md](ART_LICENSES.md) dokumentiert. Lobby und Spiel verlinken die [Grafiknachweise](../../public/games/schatzinsel/credits.html).

### Alle 14 vorbereiteten Kacheln geprüft

Elf passende Dateien wurden übernommen. Drei bleiben bewusst ungenutzt:

- `tile_18.webp`: dunklere, einfarbige Sandfläche; die Probe erzeugte einen auffälligen rechteckigen Übergang zur hellen Küste.
- `tile_23.webp`: grüne Fläche, ungeeignet für die durchgehende Sandkarte.
- `tile_68.webp`: zweite Sandvariante; für die gewählte einheitliche Komposition nicht erforderlich. `tile_69.webp` passt zur hellen inneren Uferfarbe.

Die Küstenstücke 01/02/03, 17/19 und 33/34/35 werden ohne Drehung als acht Randstücke gesetzt; die Suchfläche bleibt vollständig im Sandinneren. Die natürlichen Motive wiederholen sich erkennbar, es wird keine individuell gemalte, organische Insel behauptet.

## Gameplay- und Geheimhaltungsnachweise

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| Neue Grafik-/Datenschutztests und bestehende Regeltests | **21 bestanden**, 0 fehlgeschlagen; darunter 27 zusätzliche vollständige Botpartien und neun unabhängige Geheimzustandsvergleiche. |
| Bestehende und neue Playwright-Tests, ausschließlich Schatzinsel | **12 bestanden**, 0 fehlgeschlagen: Desktop und Mobil einschließlich tatsächlicher Hard-Worker-Bot-Partien. |
| `npm run test:fast` | **2.062 bestanden**, 0 fehlgeschlagen, 3 bestehende Tests ausgelassen; 125,379 s. |
| Zusätzlicher echter Vier-Spieler-Browserlauf | **5 Prüfgruppen bestanden**, keine Page-Errors; alle Platzierungen und Grabungen per UI. |

Die neuen Node-Tests erzeugen für **alle neun Kombinationen aus 2–4 Spielern und 3–5 Schätzen** jeweils zwei unabhängige Testräume mit denselben Teilnehmern, aber unterschiedlichen fremden Verstecken. Nach einem identischen öffentlichen Treffer werden die tatsächlichen `gameView`-Projektionen verglichen; lediglich der zufällige Rundenschlüssel wird für den Vergleich ausgeblendet. Die ursprünglichen geheimen Positionen unterscheiden sich nachweislich. Für den jeweils anderen Spieler und den Zuschauer stimmen öffentliche Daten und der **vollständig erzeugte HTML-Inhalt** dennoch überein – einschließlich Klassen, Attribute, URLs und Beschriftungen. Die Besitzeransicht unterscheidet sich erwartungsgemäß. Die Renderprüfung umfasst alle 64 Koordinaten, öffentliche Treffer/Fehlschläge, H/W/K, den Modus ohne Hinweise, eigene Verstecke, Zuschauer und deaktivierte Aktionen bei Pause.

Die neuen Browserprüfungen verwenden **echte menschliche Browserkontexte** für 2, 3 und 4 Spieler, jeweils mit 3, 4 bzw. 5 Schätzen; zusätzlich einen Zuschauer. Verstecken und Graben laufen über vorhandene UI-/Socket-Aktionen. Private Positionen werden weder in den Client noch in den laufenden Server injiziert. Nach Treffer und Fehlschlag stimmen die Brett-DOMs des wartenden Spielers und des Zuschauers auf derselben fremden Insel vollständig überein. Jeder Spieler erhält weiterhin nur seine eigenen Verstecke; die öffentlichen Inselobjekte enthalten ausschließlich `id`, `active`, `ready`, `remaining` und `shots`.

Ein zusätzlicher isolierter Loopback-Browserlauf mit vier menschlichen Kontexten und fünf Schätzen je Insel führt echte Treffer sowie heiße, warme und kalte Fehlschläge aus. Er prüft den zusätzlichen Zug bei Treffer, Zugwechsel bei Fehlschlag, Wechsel zwischen eigener und fremder Insel, den verdeckten Zuschauerzustand sowie Wiederverbindung und Englisch. Die feste Platzierung der Schätze erfolgt ausdrücklich über die UI; sie dient dem reproduzierbaren Vergleich und ist keine zufällige Spielpartie. Produktive Daten und Serverdateien wurden nicht verändert.

## Desktop, Mobil und Bedienung

Vorher und nachher wurden sowohl Versteckphase als auch Schatzsuche bei **1920×1080, 1440×900, 768×1024, 390×844 und 360×800** aufgenommen. Die bestehenden Tests prüfen zusätzlich 900×450. Die neuen Tests durchlaufen alle fünf Größen für die 2-/3-/4-Spieler-Anordnung. Alle 64 Felder bleiben mindestens 44×44 CSS-Pixel groß; die Seite läuft horizontal nicht über. Auf kleinen Geräten lässt sich die Karte intern seitlich und der Spielbereich vertikal verschieben. Die Inselwahl ist dort zweispaltig.

Mausklick, Enter/Leertaste, Pfeiltasten zwischen verfügbaren Feldern, Fokusmarkierungen und Pfeiltasten zum Verschieben der fokussierten Karte wurden geprüft. Im Mobilprofil wurden echte Touch-Taps und eine Chromium-Touch-Wischgeste ausgeführt. Auswahl und Abwahl behalten den seitlichen Kartenausschnitt; nach erneutem Rendern erhält das aktivierte Feld seinen Tastaturfokus zurück. Bereits bestätigte private Positionen bleiben nach Reload erhalten. Noch nicht bestätigte lokale Auswahl wird durch einen vollständigen Reload wie bisher verworfen.

Die gezielte Sichtprüfung führte zu drei Korrekturen: Die Lobby-SVG benötigt einen eigenen `filter:none`, weil der geerbte Schattenfilter die Rasterkomposition in Chromium leer erscheinen ließ; die Ursprünge der SVG-Küstenmuster wurden passend ausgerichtet. Die Kartenhöhe berücksichtigt Kopfzeile und Aktionsdock. Schließlich wurde der Fokusverlust nach lokaler Auswahl behoben. Die ursprünglichen fehlgeschlagenen Entwicklungsläufe werden nicht als bestandene Gesamtläufe gezählt; die Tabelle nennt die abschließenden erfolgreichen Prüfungen.

Das absichtliche Fehlen aller elf WebP-Dateien wurde mit HTTP-404 geprüft: Die Sand-Fallbackfarbe, alle 64 Koordinaten, zugänglichen Namen und die Feldauswahl bleiben nutzbar; die dekorative Qualität reduziert sich entsprechend. Normale Prüfläufe meldeten keine JavaScript-Fehler.

## Vorher / Nachher

[Vergleichsgalerie öffnen](screenshots/schatzinsel/kenney-2026-11/vergleich.html) · [Bildnachweise und SHA-256](screenshots/schatzinsel/kenney-2026-11/screenshots.json)

| Phase / Größe | Vorher | Nachher |
|---|---|---|
| dig · 1920x1080 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-dig-1920x1080.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-dig-1920x1080.png) |
| dig · 1440x900 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-dig-1440x900.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-dig-1440x900.png) |
| dig · 768x1024 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-dig-768x1024.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-dig-768x1024.png) |
| dig · 390x844 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-dig-390x844.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-dig-390x844.png) |
| dig · 360x800 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-dig-360x800.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-dig-360x800.png) |
| hide · 1920x1080 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-hide-1920x1080.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-hide-1920x1080.png) |
| hide · 1440x900 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-hide-1440x900.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-hide-1440x900.png) |
| hide · 768x1024 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-hide-768x1024.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-hide-768x1024.png) |
| hide · 390x844 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-hide-390x844.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-hide-390x844.png) |
| hide · 360x800 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-hide-360x800.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-hide-360x800.png) |
| lobby · 1440x900 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-lobby-1440x900.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-lobby-1440x900.png) |
| lobby · 390x844 | [PNG](screenshots/schatzinsel/kenney-2026-11/before-lobby-390x844.png) | [PNG](screenshots/schatzinsel/kenney-2026-11/after-lobby-390x844.png) |

Die Galerie enthält beide Spielphasen in allen fünf Größen, die Lobby auf Desktop/Mobil sowie zusätzliche Nachher-Aufnahmen für eigene Insel, Zuschauer und Englisch. Es sind echte, unbearbeitete PNG-Aufnahmen mit derselben Rolle und denselben gezielt per UI platzierten Schätzen. Zufällige Raumcodes können abweichen. Die historischen BACKLOG-06-Aufnahmen bleiben unverändert erhalten.

## Betroffene Dateien und Version

- `public/games/schatzinsel/schatzinsel.js` und `.css`: Inselkomposition, Marker, responsive Inselwahl, Tastatur/Scrollen und Credits.
- `public/games/schatzinsel/art/`: ausschließlich die elf oben genannten WebP-Dateien; daneben `asset-manifest.json`, `kenney-LICENSE.txt` und `credits.html`.
- `test/schatzinsel-art.test.js` und `test/ui/schatzinsel-art.spec.js`: Grafik-, Geheimhaltungs-, Bedienungs- und zusätzliche Botprüfungen.
- `games/schatzinsel/evidence.json`, `docs/design/game-visual-roadmap.json` ausschließlich bei VIS-069: neue Quellprüfsummen und Ergänzungsnachweise, ohne historische Commit-/Screenshot-Nachweise zu ersetzen. Kein pauschaler Abschluss anderer geplanter ART-Arbeiten.
- `docs/design/ART_LICENSES.md`, dieser Bericht und die verlinkten Bilder.
- `package.json`, `package-lock.json` ausschließlich bei den Projektversionen, `CHANGELOG.md`, `README.md` und `docs/betrieb.md`: **3.8.0 → 3.9.0**.

`games/schatzinsel/room.js`, `bot.js` und `index.js` bleiben unverändert. Labyrinth-Brett, Monopoly, Städtehandel, beide Vaults, Import-Staging und Agentenkonfigurationen wurden nicht geändert. Kein Serverdeployment. Der ausdrücklich freigegebene Main-Push kann den vorhandenen Test-/GHCR-Workflow auslösen; dessen Ergebnis wird im Abschluss genannt.

## Verbleibende Grenzen

Die 64×64-Quellkacheln bleiben niedrig aufgelöste Motive; auf größeren Ansichten sind Wiederholungen sichtbar. Auf kleinen Displays erfordert das 8×8-Raster Scrollen, damit die Touch-Felder nicht schrumpfen. Hinweis- und Fundmarker sind zur Lesbarkeit bewusst grafische Zeichen und keine weiteren Fremdillustrationen. Es wurden Chromium-Desktop- und emulierte Mobilprofile geprüft, keine echten iOS-/Android-Geräte und kein neuer Firefox-/WebKit- oder manueller NVDA-/VoiceOver-Durchgang. Die Dateiübertragungsgrößen sind gemessen; eine Ladezeit unter realen Mobilfunkbedingungen wurde nicht gemessen.
