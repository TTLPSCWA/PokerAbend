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
- **Material:** Kenney „Pirate Pack“ (2D von oben, CC0) bzw. „Watercraft Kit“ (3D, CC0, vorgerendert). ZIPs liefert Tobi.
- **Status:** planned

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
- **Status:** planned

#### ART-T2b · Pilotwelten Skip-Bo · P1
- **Spiele:** `stapelrennen`
- **Ziel:** Feinschliff für SB-09 Burgenbau, SB-01 Montagewerk 12 und SB-04 Orbitalstation: Baureihen als Bauplätze der Welt, Joker, Rückseite, Tisch.
- **Material:** eigene SVG-Grafiken.
- **Status:** planned

#### ART-T2c · Pilotwelten Phase 10 · P1
- **Spiele:** `zehnetappen`
- **Ziel:** Feinschliff für P-03 Testkammer X, P-06 Kart-Grand-Prix und P-10 Rhythmus-Tour: Phasenanzeige als Reise der Welt, Joker und Aussetzen, Rückseite, Tisch.
- **Material:** eigene SVG-Grafiken.
- **Status:** planned

#### ART-T3 · Weitere Welten UNO · P2
- **Spiele:** `farbenchaos`
- **Ziel:** Feinschliff der übrigen sieben UNO-Welten (U-03, U-05 bis U-10).
- **Material:** eigene SVG-Grafiken.
- **Status:** planned

#### ART-T4 · Weitere Welten Skip-Bo und Phase 10 · P2
- **Spiele:** `stapelrennen`, `zehnetappen`
- **Ziel:** Feinschliff der übrigen sieben Skip-Bo- und sieben Phase-10-Welten.
- **Material:** eigene SVG-Grafiken.
- **Status:** planned

#### ART-T5 · Winterwelten · P2
- **Spiele:** `farbenchaos`, `stapelrennen`, `zehnetappen`
- **Ziel:** Feinschliff der zehn Winterwelten in allen drei Spielen, inklusive Schneefall als ruhige Hintergrundbewegung (abschaltbar).
- **Material:** eigene SVG-Grafiken.
- **Status:** planned
