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
- **Status:** done
- **Implementierungscommit:** `887bf79d08bbf0c76ca2aa6ebaaa831b0a2fa70b`
- **Umsetzung:** Papierkante und Glanz auf allen Karten, Stapelhöhe bei Nachzieh- und Ablagestapel, eigene Leinenstruktur auf dem Tisch; alle fünf Welten.
- **Nachweise:** `test/ui/art-farbenchaos.spec.js`, `docs/design/art/ART-004/README.md`, `docs/design/art/ART-004/table-classic-desktop.png`, `docs/design/art/ART-004/table-classic-mobil.png`, `docs/design/art/ART-004/fps-desktop.json`

#### ART-009 · Skip-Bo (`stapelrennen`) · P2
- **Ziel:** Karten und Aufbaustapel mit Stapelhöhe, Spielertisch mit Struktur.
- **Material:** eigene SVG-Karten, ggf. Tischtextur (CC0).
- **Status:** done
- **Implementierungscommit:** `1646b30ad16ca342e97a3a8112404ff223dc0d81`
- **Umsetzung:** Papierkante und Glanz auf allen Karten, sichtbare Stapelhöhe bei Baureihen, Ablagen und Spielstapel, Werkbank mit eigener Struktur.
- **Nachweise:** `test/ui/art-stapelrennen.spec.js`, `docs/design/art/ART-009/README.md`, `docs/design/art/ART-009/table-classic-desktop.png`, `docs/design/art/ART-009/table-classic-mobil.png`, `docs/design/art/ART-009/fps-desktop.json`

#### ART-008 · Phase 10 (`zehnetappen`) · P2
- **Ziel:** Karten mit mehr Tiefe, ausgelegte Phasen als echte Kartenreihen, Phasenanzeige als Material.
- **Material:** eigene SVG-Karten, ggf. Tischtextur (CC0).
- **Status:** done
- **Implementierungscommit:** `52092b9aed4fa210c3446efc588c0e47fc1c266f`
- **Umsetzung:** Papierkante und Glanz auf allen Karten, ausgelegte Phasen als Kartenreihen auf Spielmatten, Phasensteine, Stapel mit Höhe, Tischtuchstruktur.
- **Nachweise:** `test/ui/art-zehnetappen.spec.js`, `docs/design/art/ART-008/README.md`, `docs/design/art/ART-008/table-classic-laid-desktop.png`, `docs/design/art/ART-008/table-classic-laid-mobil.png`, `docs/design/art/ART-008/fps-desktop.json`

#### ART-044 · 6 nimmt! (`sechs-nimmt`) · P2
- **Ziel:** Reihen als Kartenauslage auf Tischtuch, Hornochsen-Symbole als eigene Figur, Kartenstapel mit Kante.
- **Material:** eigene SVG-Grafiken, ggf. Tischtextur (CC0).
- **Status:** planned

#### ART-013 · Schiffe versenken (`schiffe`) · P2
- **Ziel:** echte Schiffe statt Blöcken (von oben gesehen), Wasser mit Struktur, Treffer und Versenken mit Bewegung (Schiff kippt und sinkt).
- **Material:** Kenney „Watercraft Kit“ (3D, CC0, vorgerendert; fünf Modelle in zwei Lagen), eigene SVG-Grafiken (Wasser, Markierungen, Raumschiffe der Taktik-Konsole).
- **Status:** done
- **Implementierungscommit:** `3352d886603532aaf66752ab86a13160c04f129f`
- **Umsetzung:** Das bestehende Spiel bekommt Designs (Skins) als Raumeinstellung des Hosts, getrennt von den Spielvarianten und für alle am Tisch gleich: `naval` „Klassisch“ (Standard: Seekarte mit Kenney-Schiffen im Stahlton, Wasser mit Wellen und Raster, Treffer als Stern, Wrack mit Sinkbewegung) und `space` „Taktik-Konsole“ (Commit `cc8281ee8a5ad5a35edf6830fbfed222d582d138`, Korrektur `01ed27734ef16ae9eace5b26edc2053f52f58ead`: Weltraum-Konsole mit eigenen Raumschiffen, Flottenstatus, Gegnerflotte, Protokoll). Kein zweites Spiel; Regeln, Server und Bedienung unverändert; gegnerische Schiffe erst nach „versenkt“ sichtbar.
- **Nachweise:** `test/schiffe-skins.test.js`, `test/ui/art-schiffe.spec.js`, `docs/design/SCHIFFE_SKINS.md`, `docs/design/art/ART-013/README.md`, `docs/design/art/ART-013/designauswahl-desktop.webp`, `docs/design/art/ART-013/naval-desktop-classic.webp`, `docs/design/art/ART-013/naval-mobil-classic.webp`, `docs/design/art/ART-013/space-desktop-classic.webp`, `docs/design/art/ART-013/space-mobil-classic.webp`, `docs/design/art/ART-013/fps-naval-desktop.json`, `docs/design/art/ART-013/fps-space-desktop.json`

#### ART-046 · Monopoly (`monopoly`) · P2
- **Ziel:** Spielfiguren als Püppchen, die Feld für Feld über das Brett laufen; Häuser und Hotels als kleine Modelle; Brett mit Struktur.
- **Material:** Kenney „Board Game Pack“ (Figuren, CC0) bzw. vorgerenderte 3D-Figuren (CC0). ZIPs liefert Tobi.
- **Status:** planned

---

## Kartenwelten (ART-T)

Der Host wählt für **UNO (Classic), Skip-Bo und Phase 10** eine Kartenwelt; sie gilt für alle am Tisch, nur als Aussehen. 40 Welten nach bekannten Spielwelten (10 je Spiel plus 10 Winterwelten für alle drei), Auswahl aus den Entwürfen der Runde 5. Die Vorbilder stehen nur in `docs/design/CARD_WORLDS.md`, nie in der Oberfläche; alle Motive sind eigene Zeichnungen. Leitplanken wie oben, dazu: Spielfarben behalten ihren Farbton (Rot bleibt rötlich), damit Farbnamen und Farbwahl stimmen. Ohne gewählte Welt bleibt alles wie bisher.

#### ART-T1 · Kartenwelten-Fundament · P1
- **Spiele:** `farbenchaos`, `stapelrennen`, `zehnetappen`
- **Ziel:** Host-Auswahl im Raum (für alle, auch mitten in der Runde), Welten als Daten, eine gemeinsame Kartenvorlage für alle drei Spiele, Weltton für Tisch und Flächen, selbst gehostete Schriften, automatischer Bild- und Leistungstest über alle Welten.
- **Material:** eigene SVG-Motive (per Skript erzeugt), Schriften unter SIL OFL (Cinzel, Orbitron, Press Start 2P, Bangers, Lilita One, Black Ops One, Righteous, Fredoka).
- **Status:** done
- **Implementierungscommit:** `361294f68aa1b99de6999cf69ad83a778db21ff5`
- **Umsetzung:** Host-Auswahl (setCardWorld) für alle am Tisch, 40 Welten mit gemeinsamer Kartenvorlage und 13 Rahmenarten, Weltton für Tisch, Spielfarben behalten ihren Farbton, UNO-Varianten mit eigener Gestaltung unverändert.
- **Nachweise:** `test/card-worlds.test.js`, `test/ui/art-card-worlds.spec.js`, `docs/design/CARD_WORLDS.md`, `docs/design/art/ART-T1/README.md`, `docs/design/art/ART-T1/farbenchaos-desktop.webp`, `docs/design/art/ART-T1/stapelrennen-desktop.webp`, `docs/design/art/ART-T1/zehnetappen-desktop.webp`, `docs/design/art/ART-T1/farbenchaos-mobil.webp`, `docs/design/art/ART-T1/host-menu-mobil.webp`, `docs/design/art/ART-T1/fps-desktop.json`

#### ART-T2a · Pilotwelten UNO · P1
- **Spiele:** `farbenchaos`
- **Ziel:** Feinschliff für U-04 Blockwelt, U-01 Zaubersaal und U-02 Hexerpfad: eigene Rahmendetails, Aktionskarten, Rückseite, Tisch, Handy-Lesbarkeit.
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `a445cc8e2188577b8f1ed3827260516065e83ee4`
- **Umsetzung:** `public/games/card-worlds/pilot-uno.css` nur für U-04, U-01, U-02: Aktionskarten mit Streifen, größerem Symbol und doppeltem Medaillon-Ring, Kartenzahl der Rückseite als Marke unten, Rahmendetails je Welt (Goldlinie, Pixelkanten, Siegel). Übrige Welten unverändert.
- **Nachweise:** `test/ui/art-t2a-uno-pilot.spec.js`, `docs/design/art/ART-T2a/README.md`, `docs/design/art/ART-T2a/U-04-desktop.webp`, `docs/design/art/ART-T2a/U-01-desktop.webp`, `docs/design/art/ART-T2a/U-02-desktop.webp`, `docs/design/art/ART-T2a/U-04-mobil.webp`, `docs/design/art/ART-T2a/U-01-mobil.webp`, `docs/design/art/ART-T2a/U-02-mobil.webp`

#### ART-T2b · Pilotwelten Skip-Bo · P1
- **Spiele:** `stapelrennen`
- **Ziel:** Feinschliff für SB-09 Burgenbau, SB-01 Montagewerk 12 und SB-04 Orbitalstation: Baureihen als Bauplätze der Welt, Joker, Rückseite, Tisch.
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `3dedf9736cb9a75f2321263ebb5cc4c55bd98b78`
- **Umsetzung:** `public/games/card-worlds/pilot-skipbo.css` nur für SB-09, SB-01, SB-04: Baureihen als Bauplätze der Welt (Steinfundament mit Zinnen, Montageplatz mit Warnstreifen, Andockring) mit Bauleiste, leerer Platz mit Weltbild, lesbare Beschriftung, dunkles Zielfeld, Joker mit Streifen und großem Symbol. Skip-Bo zeigt am Tisch keine verdeckten Karten, daher keine Rückseitenänderung.
- **Nachweise:** `test/ui/art-t2b-skipbo-pilot.spec.js`, `docs/design/art/ART-T2b/README.md`, `docs/design/art/ART-T2b/SB-09-desktop.webp`, `docs/design/art/ART-T2b/SB-01-desktop.webp`, `docs/design/art/ART-T2b/SB-04-desktop.webp`, `docs/design/art/ART-T2b/SB-09-mobil.webp`, `docs/design/art/ART-T2b/SB-01-mobil.webp`, `docs/design/art/ART-T2b/SB-04-mobil.webp`

#### ART-T2c · Pilotwelten Phase 10 · P1
- **Spiele:** `zehnetappen`
- **Ziel:** Feinschliff für P-03 Testkammer X, P-06 Kart-Grand-Prix und P-10 Rhythmus-Tour: Phasenanzeige als Reise der Welt, Joker und Aussetzen, Rückseite, Tisch.
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `b1148ed9ce965978da4420c5b300d267a87d0fec`
- **Umsetzung:** `public/games/card-worlds/pilot-phase10.css` nur für P-03, P-06, P-10: Phasenanzeige als Reise der Welt (Testkammern, Rennstrecke mit Zielflagge, Tourstationen), Joker und Aussetzen mit Streifen und großem Symbol (Aussetzen zusätzlich mit rotem Querstrich), Stapelzahl im Band unten, Planungsfelder und Gruppen in der Weltfarbe, dunkle Schrift auf dem hellen Laborpanel von P-03.
- **Nachweise:** `test/ui/art-t2c-phase10-pilot.spec.js`, `docs/design/art/ART-T2c/README.md`, `docs/design/art/ART-T2c/P-03-desktop.webp`, `docs/design/art/ART-T2c/P-06-desktop.webp`, `docs/design/art/ART-T2c/P-10-desktop.webp`, `docs/design/art/ART-T2c/P-03-mobil.webp`, `docs/design/art/ART-T2c/P-06-mobil.webp`, `docs/design/art/ART-T2c/P-10-mobil.webp`

#### ART-T3 · Weitere Welten UNO · P2
- **Spiele:** `farbenchaos`
- **Ziel:** Feinschliff der übrigen sieben UNO-Welten (U-03, U-05 bis U-10).
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `36545fee3e3e9fca4c028a2dedc1078f4c9465e1`
- **Umsetzung:** `public/games/card-worlds/more-uno.css` nur für U-03, U-05 bis U-10: Aktionskarten mit Streifen, großem Symbol und doppeltem Medaillon-Ring, Kartenzahl der Rückseite als Marke unten, Rahmendetail je Welt. Pilotwelten, Winterwelten und andere Spiele unverändert.
- **Nachweise:** `test/ui/art-t3-uno-worlds.spec.js`, `docs/design/art/ART-T3/README.md`, `docs/design/art/ART-T3/tisch-rueckseite-desktop.webp`, `docs/design/art/ART-T3/haende-aktionskarten-desktop.webp`, `docs/design/art/ART-T3/mobil.webp`

#### ART-T4 · Weitere Welten Skip-Bo und Phase 10 · P2
- **Spiele:** `stapelrennen`, `zehnetappen`
- **Ziel:** Feinschliff der übrigen sieben Skip-Bo- und sieben Phase-10-Welten.
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `f6cb48a9612aa02d81fe4010a14db40f84f85c2a`
- **Umsetzung:** `public/games/card-worlds/more-skipbo.css` (SB-02, 03, 05, 06, 07, 08, 10: Bauplätze als Weltmotiv, Fortschritt, Joker) und `more-phase10.css` (P-01, 02, 04, 05, 07, 08, 09: Reise-Phasenanzeige, Joker/Aussetzen, Rückseite, Planungsfelder). Pilot-, Winterwelten und andere Spiele unverändert.
- **Nachweise:** `test/ui/art-t4-skipbo-worlds.spec.js`, `test/ui/art-t4-phase10-worlds.spec.js`, `docs/design/art/ART-T4/README.md`, `docs/design/art/ART-T4/skipbo-uebersicht.webp`, `docs/design/art/ART-T4/phase10-uebersicht.webp`, `docs/design/art/ART-T4/P-02-mobil.webp`, `docs/design/art/ART-T4/P-09-mobil.webp`

#### ART-T5 · Winterwelten · P2
- **Spiele:** `farbenchaos`, `stapelrennen`, `zehnetappen`
- **Ziel:** Feinschliff der zehn Winterwelten in allen drei Spielen, inklusive Schneefall als ruhige Hintergrundbewegung (abschaltbar).
- **Material:** eigene SVG-Grafiken.
- **Status:** done
- **Implementierungscommit:** `cf85bc52e3c753b68068688dea61fb64d1af8b41`
- **Umsetzung:** `public/games/card-worlds/pilot-winter.css` für X-01 bis X-10: Schneehaube auf den Karten, Zuckerstangen-Streifen auf Aktionskarten und Jokern, UNO-Rückseite mit Kartenzahl-Marke, Schneeverwehung am Tisch. Schneefall in `public/card-worlds.js`: drei Ebenen nur mit transform, Knopf zum Abschalten pro Gerät, bei "weniger Bewegung" still.
- **Nachweise:** `test/ui/art-t5-winter.spec.js`, `docs/design/art/ART-T5/README.md`, `docs/design/art/ART-T5/farbenchaos-desktop.webp`, `docs/design/art/ART-T5/stapelrennen-desktop.webp`, `docs/design/art/ART-T5/zehnetappen-desktop.webp`, `docs/design/art/ART-T5/farbenchaos-mobil.webp`, `docs/design/art/ART-T5/stapelrennen-mobil.webp`, `docs/design/art/ART-T5/zehnetappen-mobil.webp`

#### ART-T6 · Wintermusik · P3
- **Spiele:** `farbenchaos`, `stapelrennen`, `zehnetappen`
- **Ziel:** Ruhige Winter- und Weihnachtsmusik in den zehn Winterwelten (X-01 bis X-10), Schalter neben dem Schnee-Knopf, pro Gerät gespeichert, Standard aus; leise, mit Ein- und Ausblenden, Wiedergabeliste. Nur Aussehen und Klang, Spiellogik unverändert.
- **Material:** fremde Musik: CC0 (OpenGameArt: „Wintery loop“ von Emma M. Andersson, „Through the Snow“ von Cleyton Kauffman, „Winter Wind Loop“, „Christmas synths“ von 3xBlast) und vom Nutzer freigegebene Ausnahme Pixabay-Inhaltslizenz (pulsebox „Happy Christmas Jazz“ und „Fun Christmas Jazz“, atlasaudio „Christmas Jazz“, DPStudioMusic „Winter Wonderland Chorus“ und „Crimson Ribbon Melody“); gekürzt, eingeblendet und als kleine Dateien neu kodiert, jede Datei mit Herkunft in `ART_LICENSES.md`.
- **Status:** done
- **Implementierungscommit:** `860498945273de5b1a05ddf6d9721330939795a4`
- **Umsetzung:** `public/card-worlds.js` (Wiedergabeliste, ♪-Schalter, Standard aus, pro Gerät gespeichert, nur Winterwelten, 30 % Lautstärke, Tab verborgen = Pause, Start nach erster Berührung falls der Browser sperrt), `pilot-winter.css` (Knopf), zehn MP3 in `public/games/card-worlds/music/` (zusammen etwa 11 MB), Herkunft in `ART_LICENSES.md`.
- **Nachweise:** `test/ui/art-t6-wintermusik.spec.js`, `test/card-worlds-music.test.js`, `docs/design/art/ART-T6/README.md`, `docs/design/art/ART-T6/musik-schalter.webp`
