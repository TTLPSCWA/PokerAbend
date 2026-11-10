# Spieleabend – Grafik-Roadmap (Stufe 3 nach VIS und EXP)

Stand: 10.11.2026. Ein Paket wird erst nach ausdrücklicher Freigabe seiner ID gebaut (siehe CLAUDE.md/AGENTS.md). Diese Datei ist die Quelle; `docs/design/game-art-roadmap.json` wird mit `node scripts/build-art-roadmap.mjs` daraus erzeugt.

## Worum es geht

Mit den VIS-Paketen hat jedes Spiel ein eigenes Layout bekommen, mit den EXP-Paketen Klang und Bewegung. Stufe 3 macht das **Material** hochwertiger: Tische, Chips, Karten, Spielfiguren, Schiffe, Spielbretter. Anders als bei VIS und EXP dürfen dafür auch **freie Grafiken von außen** verwendet werden (z. B. Kenney, Quaternius), solange die Lizenz passt.

Die IDs folgen den VIS-Nummern: **ART-002 gehört zu VIS-002 (Texas Hold'em)** usw. Spiele ohne eigenes ART-Paket bleiben unverändert. Weitere Pakete werden mit derselben Nummernlogik ergänzt, wenn sie gebraucht werden.

## Leitplanken (gelten für jedes Paket)

1. **Lizenz:** nur CC0 oder klar freie Lizenzen (MIT, ISC, SIL OFL; CC BY nur mit Eintrag auf der Credits-Liste). Nichts mit Weitergabe-Verbot: Das Repo ist öffentlich. Jede fremde Datei steht mit Quelle, Autor und Lizenz in `docs/design/ART_LICENSES.md`. Nur die tatsächlich benutzten Dateien kommen ins Repo, keine ganzen Pakete.
2. **Keine Marken:** keine Originalgrafiken, Logos, Figuren oder Kartentexte bekannter Spiele (UNO, Monopoly usw.).
3. **Spiellogik bleibt unverändert.** Grafiken zeigen nur, was der Server entschieden hat; verdeckte Infos werden nie verraten.
4. **Ablage:** `public/games/<spiel>/art/`. Pro Spiel ein Schalter am Spielfeld (`#game[data-art-<spiel>]` bzw. eine Klasse), damit Spiele, die dieselben Dateien laden (z. B. Omaha mit Hold'em), unverändert bleiben.
5. **Austauschbar (Skins):** Grafiken hängen an CSS-Variablen bzw. einer Liste pro Spiel, nicht fest im Spielcode. So lassen sich später zweite Tische, Figurensätze oder Kartenrücken als Auswahl ergänzen, ohne das Spiel umzubauen.
6. **3D ohne 3D-Szene:** 3D-Modelle werden einmal als scharfe Bilder (WebP/PNG, mehrere Blickwinkel) vorgerendert und als 2D-Sprites bewegt. Keine WebGL-Szene im Spiel ohne gesonderten Auftrag.
7. **Performance:** Bilder klein halten (Ziel unter 60 KB pro Spiel und Ansicht, SVG bevorzugt), nur statische Hintergründe, Bewegung nur über `transform`/`opacity`, keine Filter auf großen Flächen. Abnahme: Bildrate mit neuer Optik mindestens 90 % der Bildrate ohne, bei 4× gedrosselter CPU.
8. **Lesbarkeit:** Werte, Farben und Zustände bleiben auf Handy (390 px) und PC klar erkennbar; nie nur über Farbe.

## Abnahme pro Paket

- Vorher/Nachher-Screenshots Desktop und Handy unter `docs/design/art/ART-xxx/`
- Playwright-Test: neue Optik aktiv, Nachbarspiele unverändert, Bildrate-Vergleich
- Lizenzliste aktuell, `npm run test:fast` grün
- Danach Status, Commit und Nachweise hier eintragen und stoppen

---

## Pakete

#### ART-002 · Texas Hold'em (`poker`) · P1
- **Ziel:** Tisch mit gepolsterter Lederkante, Holzring, Filz mit Struktur und Lampenlicht; Chips scharf und nicht gequetscht, im Stapel mit sichtbarer Kante.
- **Material:** eigene SVG-Chips (Draufsicht und Seitenansicht, fünf Farben), eigene Filzstruktur (WebP-Kachel). Keine fremden Dateien nötig.
- **Status:** done
- **Implementierungscommit:** `7790b354c73f207d8c444e25526118d379e5a5f8`
- **Umsetzung:** Ledertisch mit Holzring und Filz, SVG-Chips mit echter Stapelhöhe, nur Hold'em; dazu behoben: Startseiten-Filter und Pokerchips teilten sich die Klasse .chip.
- **Nachweise:** `test/ui/art-poker.spec.js`, `test/art-roadmap.test.js`, `docs/design/art/ART-002/README.md`, `docs/design/art/ART-002/table-desktop.png`, `docs/design/art/ART-002/table-mobil.png`, `docs/design/art/ART-002/fps-desktop.json`

#### ART-004 · UNO (`farbenchaos`) · P1
- **Ziel:** Kartenfronten und -rücken mit mehr Tiefe, Ablagestapel mit echtem Kartenstapel-Rand, Spieltisch mit Struktur.
- **Material:** eigene SVG-Karten, ggf. Tischtextur (CC0, z. B. ShareTextures/ambientCG).
- **Status:** planned

#### ART-009 · Skip-Bo (`stapelrennen`) · P2
- **Ziel:** Karten und Aufbaustapel mit Stapelhöhe, Spielertisch mit Struktur.
- **Material:** eigene SVG-Karten, ggf. Tischtextur (CC0).
- **Status:** planned

#### ART-008 · Phase 10 (`zehnetappen`) · P2
- **Ziel:** Karten mit mehr Tiefe, ausgelegte Phasen als echte Kartenreihen, Phasenanzeige als Material.
- **Material:** eigene SVG-Karten, ggf. Tischtextur (CC0).
- **Status:** planned

#### ART-044 · 6 nimmt! (`sechs-nimmt`) · P2
- **Ziel:** Reihen als Kartenauslage auf Tischtuch, Hornochsen-Symbole als eigene Figur, Kartenstapel mit Kante.
- **Material:** eigene SVG-Grafiken, ggf. Tischtextur (CC0).
- **Status:** planned

#### ART-013 · Schiffe versenken (`schiffe`) · P2
- **Ziel:** echte Schiffe statt Blöcken (von oben gesehen), Wasser mit Struktur, Treffer und Versenken mit Bewegung (Schiff kippt und sinkt).
- **Material:** Kenney „Pirate Pack“ (2D von oben, CC0) bzw. „Watercraft Kit“ (3D, CC0, vorgerendert). ZIPs liefert Tobi.
- **Status:** planned

#### ART-046 · Monopoly (`monopoly`) · P2
- **Ziel:** Spielfiguren als Püppchen, die Feld für Feld über das Brett laufen; Häuser und Hotels als kleine Modelle; Brett mit Struktur.
- **Material:** Kenney „Board Game Pack“ (Figuren, CC0) bzw. vorgerenderte 3D-Figuren (CC0). ZIPs liefert Tobi.
- **Status:** planned
