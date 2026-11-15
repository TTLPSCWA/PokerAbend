# Themenwelten für alle Spiele (TW-01 bis TW-16)

Stand: 15. November 2026. Fachliche Grundlage ist das ursprüngliche Konzept „Themenwelten für alle Spiele“ (vom Projektinhaber am 15.11.2026 als `THEME_WORLDS_original.md` bereitgestellt, Status dort: „Konzept – keine Freigabe, nichts implementiert“). Maßgeblich für den **Umsetzungsstand** ist die Software auf `main` mit ihren Tests und Nachweisen. Technische Grundsätze: [THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md). Prüfliste je Welt: [THEME_QUALITY_CHECKLIST.md](THEME_QUALITY_CHECKLIST.md). Herkunft aller Dateien: [ART_LICENSES.md](ART_LICENSES.md). Kartenwelten (ART-T, 40 Welten für UNO, Skip-Bo, Phase 10): [CARD_WORLDS.md](CARD_WORLDS.md).

**Dokumentation ist keine Freigabe.** Umgesetzt wird nur, was ausdrücklich per ID freigegeben ist. Alle TW- und ART-W-IDs außer den als umgesetzt markierten sind Vorschläge.

> **Historischer Hinweis:** Bei der Umsetzung von ART-W0 (3.12.0) und ART-W1 (3.13.0) lagen dieses Konzept und der darin genannte Entwurf `docs/design/drafts/ART-046-mythos-weltkonzept.md` nicht vor (weder im Repository noch im Vault). TW-01 wurde deshalb mit Freigabe des Projektinhabers aus dem Auftragstext eigenständig gestaltet. Der Abgleich mit dem Konzept steht in Abschnitt 5; der Mythos-Entwurf liegt weiterhin nicht vor.

## Umsetzungsstand

| Welt | Stand | Nachweis |
|---|---|---|
| TW-01 Schatten über Neuengland | **Monopoly umgesetzt** (Standard und Tempowürfel, 3.13.0); Monopoly Deal offen | Commit `154a30e`, `test/art-w1-tw01.test.js`, `test/ui/art-w1-tw01.spec.js`, [art/ART-W1/](art/ART-W1/) |
| TW-14 Saloon, TW-11 Piratenbucht, TW-09 Runen & Nordlicht, TW-13 Neon-Arcade | **Würfelwelten umgesetzt** für alle 13 Würfelspiele (ART-W2, 3.14.0); andere Spielgruppen dieser Welten (z. B. Kartenspiele, Bretter) nicht | Abschnitt 5a, `test/art-w2-dice-worlds.test.js`, `test/ui/art-w2-dice-worlds.spec.js`, [art/ART-W2/](art/ART-W2/) |
| TW-08 Götterberg, TW-09 Runen & Nordlicht (Brett), TW-10 Tafelrunde | **Brettwelten umgesetzt** für sieben klassische Brettspiele (ART-W3, 3.16.0); TW-09 ist dieselbe Welt wie bei den Würfelspielen (Facette, keine zweite ID) | Abschnitt 5b, `test/art-w3-board-worlds.test.js`, `test/ui/art-w3-board-worlds.spec.js`, [art/ART-W3/](art/ART-W3/) |
| übrige Welten (TW-02 bis TW-07, TW-12, TW-15, TW-16) | nur Konzept, keine Implementierungsfreigabe, keine Assets | – |

Die zentrale Registry (`public/games/theme-worlds/registry.js`, ART-W0) enthält heute die 40 Kartenwelten, TW-01, die vier Würfelwelten TW-14, TW-11, TW-09, TW-13 und die Brettwelten TW-08 und TW-10; TW-09 trägt zusätzlich eine Brett-Facette. Weitere Welten kommen erst nach Freigabe hinzu.

---

## 1. Grundregeln für jede Welt (aus dem Konzept)

1. **Nur Aussehen.** Regeln, Werte, Karteneffekte, Feldanzahl und Socket-Ereignisse bleiben unverändert. Eine Welt gibt bestehenden Dingen ein neues Gesicht.
2. **Stimmung ja, fremde Namen und Figuren nein.** Ein Vorbild darf die Stimmung liefern (z. B. „düstere Hexer-Fantasy“), aber keine Namen, Figuren, Logos, Symbole oder Designs, an denen man die Marke erkennt (kein weißhaariger Hexer mit Wolfsmedaillon und zwei Schwertern, keine Blitznarbe, kein Lichtschwert).
3. **Gemeinfreie Vorlagen** dürfen auch Namen liefern, wenn der Autor nach deutschem Recht seit über 70 Jahren tot ist (Abschnitt 4). Moderne Film- und Spieldesigns dieser Stoffe bleiben tabu, Markennamen ebenso.
4. **Eigene Grafiken oder freie Lizenzen.** CC0 bevorzugt, sonst MIT, ISC, OFL oder CC BY mit Namensnennung. Jede fremde Datei mit Herkunft in `ART_LICENSES.md`. Kein CC BY-SA, kein GPL für Grafiken.
5. **3D nur vorgerendert** als Bild, keine WebGL-Szene.
6. **Ohne Welt bleibt alles wie bisher** („Standard“). Der Host wählt die Welt für den Raum, wie bei den Kartenwelten.
7. **Lesbarkeit vor Atmosphäre.** Farben der Spieler, Zahlen, Symbole und Hinweise bleiben eindeutig. Barrierearme Kontraste (WCAG AA) werden getestet.

## 2. Weltenkatalog

Spalte „Quelle“ zeigt, woher Namen und Motive kommen dürfen. Schriften: „OFL geprüft“ heißt, die Lizenzangabe in den Metadaten von Google Fonts (`google/fonts`, Ordner `ofl/`) wurde am 15.11.2026 abgerufen; „im Repo“ heißt, die Schrift liegt bereits mit Lizenztext unter `public/fonts/worlds/`.

| ID | Welt | Quelle | Stimmung und Motive | Farben | Schrift (Konzept) | Stand |
|---|---|---|---|---|---|---|
| TW-01 | **Schatten über Neuengland** | Lovecraft, gemeinfrei (EU) | 1920er Küste, Nebel, Leuchttürme, verbotene Bücher, Tentakel nur angedeutet | Sepia, Petrol, Messing, Akzent Giftgrün | IM Fell English (OFL geprüft), Limelight (OFL geprüft) | Monopoly umgesetzt (Abschnitt 5) |
| TW-02 | **Baker Street** | Conan Doyle, gemeinfrei | Viktorianisches London, Gaslaternen, Kutschen, Zeitungen, Lupe | Ruß, Backstein, Gaslicht-Gelb | IM Fell English, Playfair Display (beide OFL geprüft) | Konzept |
| TW-03 | **Dampf & Messing** | Jules Verne, gemeinfrei | Luftschiffe, U-Boot, Mondkanone, Weltreise, Zahnräder | Kupfer, Messing, Ozeanblau | Cinzel (im Repo), Rye (OFL geprüft) | Konzept |
| TW-04 | **Hexerpfad** | nur Stimmung (dunkle Fantasy), eigene Namen | Sümpfe, Ruinen, Monsterverträge, Tränke, slawische Sagengestalten (Leschi, Striga, Rusalka, Baba Jaga) | Moosgrün, Stahl, Blut-Rot sparsam | Cinzel (im Repo), Pirata One (OFL geprüft) | Konzept |
| TW-05 | **Hereva** | Pepper&Carrot, CC BY 4.0 | Junge Hexen, Zauberschulen, Tränke, Katzen, hell und freundlich | Kürbisorange, Himmelblau, Pflaumenlila | Fredoka, Lilita One (im Repo) | Konzept |
| TW-06 | **Wunderland** | Carroll / Baum, gemeinfrei | Spielkarten-Soldaten, Teeparty, Smaragdstadt, gelber Ziegelweg | Pastell, Smaragd, Gold | Fredoka, Righteous (im Repo) | Konzept |
| TW-07 | **Märchenwald** | Grimm, Andersen, gemeinfrei | Hexenhaus, Wolf, Schloss, Spiegel, Bohnenranke | Waldgrün, Rotkäppchen-Rot, Honig | Lilita One (im Repo) | Konzept |
| TW-08 | **Götterberg** | griechische Sagen | Tempel, Olymp, Minotaurus-Labyrinth, Odyssee-Schiff | Marmorweiß, Ägäisblau, Gold | Cinzel (im Repo) | Brettspiele umgesetzt (ART-W3) |
| TW-09 | **Runen & Nordlicht** | nordische Sagen | Langhäuser, Drachenboote, Runensteine, Polarlicht | Eisblau, Holz, Polarlicht-Grün | Cinzel, Black Ops One (Titel) (im Repo) | Würfelspiele (ART-W2) und Brettspiele (ART-W3) umgesetzt |
| TW-10 | **Tafelrunde** | Artus-Sagen, gemeinfrei | Burgen, Ritter, Gral, Schwert im Stein, Banner | Wappenrot, Königsblau, Gold | Cinzel (im Repo) | Brettspiele umgesetzt (ART-W3) |
| TW-11 | **Piratenbucht** | Stevenson „Die Schatzinsel“, gemeinfrei | Galeonen, Karten mit X, Rum-Fässer, Papagei, Kanonen | Teak, Segeltuch, Karibikblau | Pirata One, Rye (OFL geprüft) | Würfelspiele umgesetzt (ART-W2) |
| TW-12 | **Raumhafen** | nur Stimmung (Space Opera), eigene Namen | Raumschiffe, Planeten, Sternenkarten, Andockbuchten | Nachtblau, Neon-Cyan, Warnorange | Orbitron (im Repo) | Konzept |
| TW-13 | **Neon-Arcade** | nur Stimmung (Synthwave, 80er) | Raster-Horizont, Palmen, Kassetten, Spielautomaten | Magenta, Cyan, Violett | Press Start 2P, Righteous (im Repo) | Würfelspiele umgesetzt (ART-W2) |
| TW-14 | **Saloon** | nur Stimmung (Wilder Westen) | Holzdielen, Pokertisch, Steckbriefe, Postkutsche | Whiskybraun, Wüstenocker | Rye (OFL geprüft) | Würfelspiele umgesetzt (ART-W2) |
| TW-15 | **Kunterbunt** | Glitch, CC0 | Verspielte Figuren, Pflanzen, Tiere, schräge Gegenstände | Bonbonfarben | Fredoka (im Repo) | Konzept |
| TW-16 | **Tiefsee** | Verne + nur Stimmung | Korallen, Quallen, Tauchglocke, versunkene Stadt | Tiefblau, Biolumineszenz-Türkis | Righteous (im Repo) | Konzept |

Saisonwelten (Winter, Halloween) laufen weiter über die Kartenwelten (X-01 bis X-10, Spuknacht). Eine Brettspiel-Variante davon wäre ein eigenes Paket.

## 3. Zuordnung zu den Spielen

Empfehlung des Konzepts: pro Spiel zwei bis vier passende Welten, nicht alle. Spiele mit bereits individueller Gestaltung bleiben in ihrer Standardwelt; eine Themenwelt ist dort nur eine zusätzliche Wahl. Alle technischen IDs wurden am 15.11.2026 gegen `games/index.js` (95 Mehrspieler-Spiele) und die Einzelspieler-Liste (12 Spiele) geprüft; alle genannten IDs existieren.

### 3.1 Brettspiele (größte Wirkung)

| Spiel (technische ID) | Welten | Was sich ändert |
|---|---|---|
| Monopoly (`monopoly`, ART-046) | TW-01, TW-02, TW-03, TW-05, TW-15 | Feldnamen, Figuren, Anbau/Hotel als Modelle, Kartenstapel, Brettgrund. **TW-01 umgesetzt** (Abschnitt 5) |
| Monopoly Deal (`monopoly-deal`) | dieselben wie Monopoly | Kartenfronten passend zur gewählten Monopoly-Welt (offen, gesonderte Freigabe) |
| Spiel des Lebens (`spiel-des-lebens`) | TW-07, TW-03, TW-12 | Lebensweg als Märchenpfad, Weltreise oder Sternroute |
| Städtehandel (`staedtehandel`) | TW-03, TW-09, TW-11 | Handelsstädte als Häfen, Langhäuser oder Werften |
| Gebietskampf (`gebietskampf`) | TW-08, TW-10, TW-12 | Karte als Ägäis, Königreiche oder Sternsektoren |
| Scotland Yard (`scotland-yard`, fertig) | TW-02 als Zusatz | London bleibt; Baker-Street-Look als optionale Welt |
| Schiffe versenken (`schiffe`, ART-013) | TW-11, TW-16, TW-12 | Galeonen, U-Boote oder Raumschiffe von oben; Treffer mit Kippen und Sinken |
| Schatzinsel (`schatzinsel`) | TW-11, TW-16 | Inselkarte, Schatzkisten |
| Labyrinth-Brett (`labyrinth-brett`) | TW-08, TW-07 | Minotaurus-Labyrinth, Heckenirrgarten |
| Mensch ärgere Dich nicht (`huetchen`) | TW-07, TW-10, TW-13 | Figuren als Märchengestalten, Ritter oder Pixelhelden |
| Schach (`schach`) | TW-10, TW-08, TW-09 | Figurensätze Ritter, Götter, Wikinger; Brett aus Stein, Marmor, Holz |
| Mühle, Dame, Reversi, Hex, Vier gewinnt, Domino, Backgammon (`muehle`, `dame`, `reversi`, `hex`, `viergewinnt`, `domino`, `backgammon`) | TW-08, TW-09, TW-10, TW-13 | Brettmaterial und Steine (Marmor, Runenstein, Wappenschild, Neon) |
| Scrabble (`scrabble`) | TW-02, TW-03 | Buchstabensteine als Lettern einer Druckerei oder Messingplättchen |

### 3.2 Kartenspiele

| Spielgruppe (technische IDs) | Welten | Was sich ändert |
|---|---|---|
| Poker-Familie (`poker`, `omaha`, `omaha-hi-lo`, `seven-card-stud`, `short-deck`, `five-card-draw`), Blackjack (`blackjack`) | TW-14, TW-03, TW-13, TW-01 | Tischbezug, Kartenrücken, Chips. Hold'em-Tisch (ART-002) bleibt Standard |
| `skat`, `doppelkopf`, `schwimmen`, `maumau`, `durak`, `hearts`, `stichmeister`, `praesident`, `mogeln` | TW-02, TW-09, TW-10, TW-14 | Kartenrücken, Bildkarten-Stil, Tisch |
| 6 nimmt! (`sechs-nimmt`, ART-044) | TW-09, TW-15, TW-07 | Hornochsen als eigene Figur, im Wikinger-, Bunt- oder Märchenstil |
| Exploding-Deck (`exploding-deck`) | TW-01, TW-12, TW-13 | Explosionskarte als Beschwörung, Reaktor oder Pixelbombe |
| Solitaire, Mahjong Solitaire (Einzelspieler `solitaire`, `mahjong-solitaire`) | TW-06, TW-08, TW-16 | Kartenrücken bzw. Steinoptik, Hintergrund |
| UNO, Skip-Bo, Phase 10 | bestehende Kartenwelten (ART-T) | keine Änderung durch dieses Dokument |

### 3.3 Würfelspiele

`kniffel`, `maexchen`, `schocken`, `zehntausend`, `wuerfelpoker`, `luegenwuerfel`, `chicago`, `wuerfelduell`, `risiko-wuerfeln`, `wuerfeljagd`, `monsterwuerfel`, `wuerfel-auktion`, `shutthebox`.

| Welten | Was sich ändert |
|---|---|
| TW-14 (Saloon), TW-11 (Piratenkneipe), TW-09 (Methalle), TW-13 (Arcade) | Würfelbecher, Würfelmaterial (Knochen, Holz, Messing, Neon), Tischfläche, Wurfgeräusch |

Monsterwürfel zusätzlich mit TW-01 (eigene Monster).

### 3.4 Partyspiele

Themenwelten nur dort, wo sie passen: Werwolf (`werwolf`: TW-07, TW-01), Doppelagent (`doppelagent`: TW-02), Jäger & Schatten (`jaeger-schatten`: TW-01), Schatzgräber (`schatzgraeber`: TW-11), Turmbauer (`turmbauer`: TW-10). Sonst keine Welt.

### 3.5 Einzelspieler

Sudoku, 2048 und Wellenwacht sind fertig gestaltet. Für `memory`, `solitaire`, `mahjong-solitaire`, `match-3` und `block-puzzle` passen Motiv-Sätze aus TW-06, TW-07, TW-15 und TW-16. `snake`, `minesweeper`, `nonogramm`, `sokoban`: höchstens TW-13.

**Technischer Hinweis:** Die Registry aus ART-W0 prüft Spiele gegen die Mehrspieler-Liste (`games/index.js`) und gilt für Tische mit Raumstand. Einzelspieler-Spiele haben keinen Raum und keine Host-Auswahl; Welten für sie brauchen eine eigene Erweiterung (persönliche Auswahl) und eine eigene Freigabe.

## 4. Gemeinfreie Stoffe nach deutschem Recht

Schutz bis 70 Jahre nach dem Tod des (letzten) Urhebers. US-Meldungen wie „Micky Maus ist frei“ gelten hier nicht. Die Todesjahre stammen aus dem Konzept; sie sind plausibel, wurden aber für diese Dokumentation **nicht gegen Primärquellen abgerufen** und sind vor einer Umsetzung zu bestätigen.

| Stoff | Urheber † | Hinweis |
|---|---|---|
| Sherlock Holmes | Conan Doyle 1930 | moderne Serien- und Filmdesigns geschützt |
| Lovecraft-Werke | Lovecraft 1937 | Ergänzungen späterer Autoren geschützt (z. B. Derleths „Elder Sign“); Spielmarken „Call of Cthulhu“, „Arkham Horror“ meiden. Schutzstatus außerhalb der EU (z. B. USA) ungeprüft |
| Jules Verne | 1905 | – |
| Alice im Wunderland | Carroll 1898, Tenniel (Bilder) 1914 | Disney-Optik geschützt |
| Der Zauberer von Oz | Baum 1919 | Film-Optik (z. B. rote Schuhe) meiden |
| Die Schatzinsel | Stevenson 1894 | – |
| Grimm, Andersen | 1859/1863, 1875 | Disney-Optik geschützt |
| Griechische, nordische Sagen, Artus | gemeinfrei | Marvel-Thor, Spiele wie „God of War“ meiden |
| Pepper&Carrot (Hereva) | lebt, aber CC BY 4.0 | Namensnennung Pflicht, Bildgeneratoren nicht mit den Grafiken füttern |
| Glitch | CC0 | Name und Logo „Glitch“ ausgenommen |

**Tabu bleiben:** alle aktuellen Marken (Witcher, Harry Potter, Star Wars, Batman/DC, Marvel, Borderlands, Pokémon, Nintendo, Herr der Ringe, Game of Thrones …). Fan-Richtlinien sind keine Lizenz.

### 4.1 Rechtliche Prüfung je Welt (15.11.2026, keine Rechtsberatung)

| Welt | Befund | Offen |
|---|---|---|
| TW-01 | Lovecraft in DE gemeinfrei (laut Konzept). Umsetzung verwendet bewusst **keine** Lovecraft-Namen | US-Status; Titel erinnert an „The Shadow over Innsmouth“ |
| TW-02 | Doyle gemeinfrei (laut Konzept) | Markenlage „Sherlock Holmes“ ungeprüft – Welttitel „Baker Street“ ohne den Namen empfohlen |
| TW-03 | Verne gemeinfrei | – |
| TW-04 | Sagengestalten gemeinfrei | **Name „Hexerpfad“ ist bereits die Kartenwelt U-02** (Vorbild The Witcher, siehe `CARD_WORLDS.md`): Doppelbenennung und Nähe zur Marke „Der Hexer/The Witcher“; Umbenennung vor einer Umsetzung empfohlen. „Striga“ ist Sagengestalt, aber auch bekanntes Witcher-Motiv – Darstellung eigenständig halten |
| TW-05 | Pepper&Carrot: **CC BY 4.0 bestätigt** (peppercarrot.com/en/license, 15.11.2026), Copyright-Zeile „David Revoy, www.peppercarrot.com“; die Seite weist „AI derivation prohibited“ aus; die Reihe „MiniFantasyTheater“ steht unter **CC BY-SA 4.0** (ausgeschlossen); Fan-Art ist ausgenommen | Ob die Lizenz die Welt „Hereva“ (Namen, Lore) ausdrücklich umfasst, nennt die Lizenzseite nicht – ungeprüft |
| TW-06, TW-07 | Werke gemeinfrei (laut Konzept); Disney- und MGM-Film-Optik meiden | – |
| TW-08 bis TW-10 | Sagen gemeinfrei; Marvel, „God of War“, Musical-/Filmoptiken meiden | – |
| TW-11 | Stevenson gemeinfrei; Optik von „Pirates of the Caribbean“ meiden | – |
| TW-12 bis TW-14 | nur Stimmung, eigene Namen; Star Wars/Star Trek/Star Citizen, „Tron“, „OutRun“, „Red Dead“ meiden | – |
| TW-15 | Glitch laut Konzept CC0 (Name und Logo ausgenommen) | **ungeprüft:** die frühere Quellseite `glitchthegame.com/public-domain-game-art/` leitet am 15.11.2026 auf eine nicht vorhandene Seite um |
| TW-16 | Verne gemeinfrei; Disney „Atlantis“/„Findet Nemo“, „BioShock“ meiden | – |

## 5. TW-01: Konzept und Umsetzung

### 5.1 Umsetzung (ART-W1, Version 3.13.0)

| | |
|---|---|
| Spiel | `monopoly` – Standard und Tempowürfel; **nicht** Junior (eigenes 24-Felder-Brett) und **nicht** Monopoly Deal (gesonderte Freigabe) |
| Registry | `public/games/theme-worlds/registry.js`, Daten und Texte in `public/games/theme-worlds/tw-01.js`, Art `board` |
| Auswahl | Host-Menü → „Themenwelt“, gilt für alle am Tisch, auch mitten in der Runde; „Standard“ stellt die bisherige Optik vollständig wieder her |
| Commit | `154a30e` (Funktion), `0b724cb` (Roadmap) |

**Idee der Umsetzung:** Eine erfundene neblige Hafenstadt an einer nordamerikanischen Küste der 1920er-Jahre: Leuchtturm auf der Klippe, Lagerhäuser und Fischergassen, Messing, dunkles Leder und Pergament, alte Bücher und Archive. Das Unheimliche bleibt Andeutung (Nebel, ein Licht in der Nacht, Schritte, ein Brief ohne Absender). Keine Monster, keine Kultsymbole, keine Figuren, Orte oder Begriffe aus fremden Werken oder Spielen (insbesondere keine Namen wie Arkham, Innsmouth, Miskatonic, Dunwich, Cthulhu, Necronomicon oder „Elder Sign“; per Test geprüft).

| Rolle | Farbe |
|---|---|
| Nacht, Meer | `#1b2a33`, `#2f4550`, Tisch `#11191e` |
| Messing | `#c8a462`, dunkel `#8c6a33` |
| Papier (Felder, Karten) | `#e6dcc3` → `#d9cdb0`, Schrift `#1d1a15` (Kontrast ≥ 4,5 : 1, im Test gemessen) |
| Akzent Leuchtturm | `#7a2a24`, Licht `#ffe7a3` |
| Bezirke (Reihenfolge wie Standard) | Braun `#6b4a33`, Hellblau `#79a9bd`, Pink `#a8567a`, Orange `#c27a36`, Rot `#9b3328`, Gelb `#cfa93a`, Grün `#3e6a4a`, Dunkelblau `#2c4f7a` |

Schrift: Georgia bzw. die Serifenschrift des Systems (keine fremde Schriftdatei).

| Element | Umsetzung |
|---|---|
| Tisch | dunkle Hafenplanken (`table.svg`, Kachel) |
| Brett | Messingrahmen, Felder auf verwittertem Papier, Bezirksbänder in der Palette; Bahnhöfe als Gleisband, Werke in Messing, Ereignis- und Gemeinschaftsfelder mit Kartenrücken |
| Brettmitte | Hafen bei Nacht mit Leuchtturm (`center.svg`), Titel und Status auf dunkler Tafel; langsamer Nebel und schwenkendes Leuchtfeuer (CSS, entfällt bei reduzierter Bewegung) |
| Karten | Rücken aus Leder mit Messingrahmen, Kompassrose und Leuchtturm (`card-back.svg`); Kartentext auf Pergament |
| Figuren | acht Messingfiguren auf dem Farbring des Spielers: Laterne, Kompass, Rabe, Anker, Taschenuhr, Schlüssel, Fernrohr, Schwarze Katze (gleiche Token-IDs wie bisher) |
| Gebäude | Fischerhütten für 1–4 Häuser (Anzahl sichtbar), Leuchtturm für das Hotel |
| Ton | keiner (optional, nicht umgesetzt) |

**Texte (nur Darstellung):** Alle 40 Feldnamen, 16 Ereignis- („Seltsame Begebenheit“) und 16 Gemeinschaftskarten („Kirchenkasse“) sowie acht Figurennamen stehen in `tw-01.js`. Reihenfolge, Preise, Mieten, Kartenwirkungen, Handel, Würfel, Siegbedingungen, Socket-Ereignisse und Spiel-IDs bleiben unverändert; jeder Kartentext nennt dieselben Beträge und Ziele wie die Standardkarte (per Test geprüft). Der Server löst die Namen auf; Rangfolge: eigenes Brett (28 Grundstücke) → Themenwelt → Monopoly-Theme → Standard. Beim Standardbrett zeigt die Brettmitte den Weltnamen, eigene Bretter behalten ihren Titel.

**Grenzen:** Die private ART-046-Szenenvorschau ist davon unberührt; TW-01 gestaltet den vorhandenen Brett-Renderer. Besitzkarten (Dialog) behalten die Gruppenfarben des Standards im Kopf; nur Papier und Rahmen ändern sich. Fehlt eine Weltdatei, gilt die Standardoptik; die Namen kommen weiterhin vom Server (für alle gleich). Nachweise: [docs/design/art/ART-W1/](art/ART-W1/), Tests `test/art-w1-tw01.test.js`, `test/ui/art-w1-tw01.spec.js`.

### 5.2 Abweichungen zwischen Konzept und Umsetzung

Die Umsetzung bleibt unverändert; die Tabelle dient der späteren Entscheidung, ob nachgezogen wird.

| Aspekt | Konzept | Umsetzung (3.13.0) | Bewertung |
|---|---|---|---|
| Spiele | Monopoly und Monopoly Deal (ART-W1) | nur `monopoly` (Standard, Tempowürfel) | Monopoly Deal offen, eigene Freigabe |
| Quelle der Namen | Lovecraft gemeinfrei, Namen aus dem Werk erlaubt | keine Lovecraft-Namen; erfundene Hafenstadt, eigene Feld-, Karten- und Figurennamen | bewusst vorsichtiger; vereinbar mit dem Konzept |
| Ausgearbeitetes Weltkonzept | `docs/design/drafts/ART-046-mythos-weltkonzept.md` (Namen, Figuren, Kartentexte) | nicht vorhanden; eigener Entwurf aus dem Auftragstext | Entwurf fehlt weiterhin; Abgleich der Namen nicht möglich |
| Motive | 1920er Küste, Nebel, Leuchttürme, verbotene Bücher, Tentakel nur angedeutet | Küste, Nebel, Leuchtturm, Lagerhäuser; Bücher nur über Namen (Bibliotheksstufen, Archivgasse, Alte Druckerei); keine Tentakel | teilweise; kein Tentakel-Motiv |
| Farben | Sepia, Petrol, Messing, Akzent Giftgrün | Nachtblau/Petrol, Messing, Papier/Sepia, Akzent Leuchtturm-Rot | Akzent Giftgrün fehlt |
| Schriften | IM Fell English, Limelight (OFL) | Georgia/Systemserif, keine Webfont | Abweichung; beide Schriften sind OFL und könnten nachgerüstet werden (Lizenztext neben die Datei) |
| Änderungen am Spiel | Feldnamen, Figuren, Anbau/Hotel als Modelle, Kartenstapel, Brettgrund | Feldnamen, Figuren (2D-SVG), Häuser/Hotel als SVG-Marker, Kartenrücken, Brettgrund, zusätzlich Karten- und Figurennamen | weitgehend; „Modelle“ als flache SVG statt vorgerenderter 3D-Bilder |
| Ablauf (Abschnitt 7) | Konzept und SVG-Entwurf in `drafts/`, Bewertung durch Tobi, dann Freigabe | Freigabe direkt im Auftrag; Entwurf ohne gesonderte Bewertungsrunde umgesetzt | Prozessabweichung, Ergebnis per Screenshots nachvollziehbar |

## 5a. Würfelwelten (ART-W2, Version 3.14.0)

TW-14 Saloon, TW-11 Piratenbucht, TW-09 Runen & Nordlicht und TW-13 Neon-Arcade gelten für alle 13 Würfelspiele (`kniffel`, `maexchen`, `schocken`, `zehntausend`, `wuerfelpoker`, `luegenwuerfel`, `chicago`, `wuerfelduell`, `risiko-wuerfeln`, `wuerfeljagd`, `monsterwuerfel`, `wuerfel-auktion`, `shutthebox`; alle Varianten, auch Kniffel Dreifach). Registry: `public/games/theme-worlds/dice-worlds.js`, Art `dice`.

**Gemeinsamer Baustein:** `public/games/theme-worlds/dice/dice-worlds.css` gestaltet ausschließlich über Variablen den gemeinsamen Würfel (`dieHTML`/`.die` aus `kit.js`: Fläche, Augen, Rand, „bleibt“, verdeckt), die Becher (Mäxchen-Becher als Bild, Lügenwürfel-Schale), die Klappen von Shut the Box, die Tischfläche (`.kg-main`), die Bühne (`.wk-stage`: Fläche, Rand, Akzent, Titelschrift) und die Kopfzeile des Kniffel-Blocks. Jede Welt setzt nur Variablen, Texturen und Schrift (`dice/tw-xx.css`). Kein Spiel bekam eigenen Code; Regeln, Würfe, Zustände und Ereignisse sind unverändert.

| Welt | Würfel | Becher, Tisch | Schrift |
|---|---|---|---|
| TW-14 Saloon | Knochen, dunkle Augen, Messing-Markierung | Lederbecher mit Nieten, Holzdielen | Rye (OFL, neu im Repo) |
| TW-11 Piratenbucht | Walbein, marineblaue Augen | Holzbecher mit Eisenringen, Kneipentisch mit Seekarte | Pirata One (OFL, neu im Repo) |
| TW-09 Runen & Nordlicht | Runenstein, dunkle Augen, Polarlicht-Markierung | Hornbecher mit Runen, Langhausdielen | Cinzel (im Repo) |
| TW-13 Neon-Arcade | dunkel mit leuchtenden Augen und Neonrand | Neonbecher, Raster | Righteous (im Repo); Press Start 2P aus dem Konzept bewusst nicht für Überschriften (zu breit) |

**Grenzen:** kein Wurfgeräusch je Welt (das Konzept nennt es; die vorhandenen Spielklänge bleiben unverändert, eine eigene Tonquelle wäre gesondert zu prüfen); keine Welt-Animation (nichts blinkt, reduzierte Bewegung braucht keine Sonderregel); Symbole und Bedeutungsfarben einzelner Spiele (z. B. Monsterwürfel, Würfelduell, Risiko-Würfeln) bleiben. Nachweise: [art/ART-W2/](art/ART-W2/).

## 5b. Brettwelten (ART-W3, Version 3.16.0)

TW-08 Götterberg, TW-09 Runen & Nordlicht und TW-10 Tafelrunde gelten für die sieben klassischen Brettspiele `schach`, `muehle`, `dame`, `reversi`, `hex`, `viergewinnt`, `backgammon` (alle Varianten, auch Chess960). Registry: `public/games/theme-worlds/board-worlds.js`, Art `board`.

**Gemeinsamer Baustein:** `public/games/theme-worlds/board/board-worlds.css` mit je einem eng begrenzten Adapter pro Spiel (jede Regel beginnt mit `body[data-theme-kind="board"] #kg.kg-<spiel>`): Tisch (`.kg-main`), Bühne (`.wk-stage`), Brettrahmen, helle/dunkle Felder, Linien, Steine beider Seiten, Schachfiguren (Füllung und Kontur), Backgammon-Zungen, Leiste, Verdopplungswürfel und Würfel. Die Welt-Dateien `board/tw-08.css`, `tw-09.css`, `tw-10.css` setzen nur Variablen und Texturen (Marmor, Holz, Runenstein als kleine eigene SVG-Kacheln).

**Schach als Referenz:** Die sechs Figurenarten behalten ihre Umrisse (Wiedererkennung, auch mobil), die Welt legt eigene Zierformen darüber (`art.chess` in der Registry, beim Laden auf sichere SVG-Fragmente geprüft): Götterberg mit Mäanderband, Lorbeer und Helmbusch; Runen & Nordlicht mit Runenband und Runenzeichen; Tafelrunde mit Zickzackborte, Wappenschilden und Wimpel. Weiß und Schwarz unterscheiden sich durch Helligkeit **und** Kontur (Gold, Polarlicht-Grün bzw. Gold auf Königsblau), nicht nur durch Farbton. Auswahl, Zielfelder, letzter Zug und Schachmarkierung bleiben die bisherigen.

| Welt | Brett und Felder | Steine und Figuren | Tisch |
|---|---|---|---|
| TW-08 Götterberg | Marmor hell/dunkel, Goldrahmen | Marmorweiß gegen Ägäis-Dunkelblau mit Goldkontur | Steinplatten mit Mäanderfries |
| TW-09 Runen & Nordlicht | helles Holz und Runenstein, Holzrahmen | Bein gegen Schiefer mit Polarlicht-Kontur | Langhausdielen mit Runenritzung |
| TW-10 Tafelrunde | helles Holz und königsblaues Holz, Eichenrahmen | Elfenbein gegen Königsblau (Schach) bzw. Wappenrot (Steine), Goldkontur | Burgholz mit Eisenbeschlag |

**TW-09 als eine Welt mit zwei Ausprägungen (Entscheidung):** Statt einer zweiten ID trägt TW-09 ein optionales Feld `facets` (Art, Spiele, Assets, Palette, Schrift, Zier je Ausprägung). Die Registry liefert mit `worldForGame(spiel, id)` die passende Ausprägung: Würfelspiele erhalten unverändert `dice/dice-worlds.css` + `dice/tw-09.css`, Brettspiele nur `board/board-worlds.css` + `board/tw-09.css`. `worldFor` bleibt wie in ART-W2 (nur Hauptform), deshalb laufen die ART-W2-Tests unverändert. Server-Prüfung, Host-Menü und Lebenszyklus nutzen dieselbe Abfrage; es gibt keine zweite Themenverwaltung. Ein Spielwechsel Kniffel ↔ Schach behält TW-09 und tauscht die Dateien.

**Bewusste Grenzen:** Bedeutungsfarben bleiben (Hex Rot/Blau mit Zielrändern, Vier gewinnt Rot/Gelb); nur Rahmen, Felder und Löcher wechseln das Material. Keine Animation, keine Klänge, kein WebGL. Säulen und Ornamente des Konzepts erscheinen als Rahmen, Tischkachel und Figurenzier, nicht als zusätzliche Dekoration im Spielfeld. Domino aus Abschnitt 3.1 gehört nicht zu ART-W3. Nachweise: [art/ART-W3/](art/ART-W3/).

## 6. Grafik- und Soundquellen (aus dem Konzept, mit Prüfstand)

„Bestätigt“ nur, wenn die Lizenz am 14./15.11.2026 an der Quelle bzw. in einem bereits im Repository dokumentierten Paket geprüft wurde; alles andere ist **ungeprüft** und vor Verwendung je Datei zu belegen.

| Bedarf | Quelle | Lizenz laut Konzept | Prüfstand |
|---|---|---|---|
| Texturen (Holz, Filz, Leder, Stein, Metall, Papier) | Poly Haven, ambientCG, cgbookcase, ShareTextures | CC0 | ungeprüft |
| Brettspiel-Icons, Würfel, Spielsteine | Kenney (Board Game Icons, Board Game Pack, Domino) | CC0 | Kenney allgemein bestätigt (kenney.nl/support: „public domain licensed (CC0)“); Paketlizenz je Paket prüfen |
| Fantasy-Symbole | game-icons.net | CC BY 3.0 | bestätigt (bereits im Repo genutzt, Credits-Seite vorhanden) |
| Spielkarten | Adrian-Kennard-Deck, notpeter/vector-playing-cards, cardmeister | CC0 / gemeinfrei | ungeprüft |
| Schach | Screaming Brain Studios, FreeSVG „DG-RA“ | CC0 | ungeprüft |
| 3D-Figuren und Gebäude (vorgerendert) | Quaternius, KayKit, Kenney, Kytric Voxel | CC0 | Kenney bestätigt (bereits im Repo); übrige ungeprüft |
| Bunte Figuren und Welten | Glitch | CC0 | ungeprüft (Quellseite nicht erreichbar) |
| Hexen-Fantasy | Pepper&Carrot | CC BY 4.0 | bestätigt (siehe 4.1, mit Einschränkungen) |
| Filmische Szenen | Blender Studio (Sintel, Charge, Sprite Fright) | CC BY, ohne Logos | ungeprüft |
| Alte Stiche, Gemälde | Museen mit Open Access (Metropolitan Museum, Rijksmuseum) | gemeinfrei, pro Bild prüfen | ungeprüft, je Bild |
| Karten-, Chip-, Würfelsounds | Kenney Casino Audio | CC0 | Kenney allgemein bestätigt; Paket ungeprüft |
| Umgebungsgeräusche | Freesound, nur CC0-Dateien | CC0 | je Datei zu prüfen |
| Schriften | Google Fonts mit SIL OFL | OFL | IM Fell English, Limelight, Playfair Display, Rye, Pirata One: OFL in den Google-Fonts-Metadaten bestätigt; Cinzel, Orbitron, Press Start 2P, Bangers, Lilita One, Black Ops One, Righteous, Fredoka liegen mit Lizenztext im Repo |

Nicht verwenden: OpenMoji (CC BY-SA), Cburnett-Schach (GPL/GFDL), LGPL-Kartensets, FreePBR (nur privat kostenlos), Pepper&Carrot „MiniFantasyTheater“ (CC BY-SA).

## 7. Pakete (korrigierte Zuordnung)

Die fachliche Zuordnung folgt dem Konzept. Abgeschlossene Pakete behalten ID und Inhalt. Die technische Asset- und Klangpipeline ist **kein** eigenes W-Paket, sondern Voraussetzung innerhalb der jeweiligen Pakete (siehe `THEME_ARCHITECTURE.md`).

| ID | Inhalt | Stand |
|---|---|---|
| ART-W0 | Fundament: zentrale Registry, Host-Auswahl für Brett-, Karten- und Würfelspiele, Lebenszyklus, Server-Prüfung, Tests | **umgesetzt** (3.12.0, `a997131`) |
| ART-W1 | Monopoly + Monopoly Deal: TW-01 Schatten über Neuengland | **teilweise:** Monopoly umgesetzt (3.13.0, `154a30e`); Monopoly Deal offen |
| ART-W2 | Würfelbecher-Welten: TW-14, TW-11, TW-09, TW-13 für alle Würfelspiele | **umgesetzt** (3.14.0, `badf3e9`) |
| ART-W3 | Klassische Bretter: Schach, Mühle, Dame, Reversi, Hex, Vier gewinnt, Backgammon mit TW-08, TW-09, TW-10 | **umgesetzt** (3.16.0, `1ae5d0b`) |
| ART-W4 | Kartenrücken-Welten für die Kartenspiele außerhalb von ART-T | geplant |
| ART-W5 … | weitere Monopoly-Editionen und Einzelwelten nach Bedarf | Idee |

ART-013 (Schiffe versenken) und ART-044 (6 nimmt!) bleiben eigene Pakete; sie können die Welten später nutzen.

## 8. Ablauf für jede neue Welt

1. **Thema nennen** (z. B. „Monopoly im Piratenstil“).
2. **Konzept** als Markdown in `docs/design/drafts/`: Stil, Namen, Figuren, Kartentexte, Quellen, Rechteprüfung.
3. **SVG-Entwürfe** in `docs/design/drafts/`, Export mit `npm run export:design`.
4. **Bewertung** durch Tobi.
5. **Freigabe per ID**, dann Umsetzung: nur Aussehen, Version erhöhen (neue Funktion → mittlere Stelle), CHANGELOG, README, betrieb.md, `npm run test:fast`, UI-Tests Desktop und Mobil, dauerhafte Screenshots, Status und Commit in der Roadmap. Danach stoppen. Technische Abnahme nach [THEME_QUALITY_CHECKLIST.md](THEME_QUALITY_CHECKLIST.md).

### Prüfliste vor jedem Speichern eines Entwurfs

- [ ] Keine Namen, Figuren, Logos oder erkennbaren Designs aktueller Marken
- [ ] Gemeinfreie Stoffe: nur Originalwerk, keine Film- oder Spieloptik, keine Markennamen
- [ ] Jede fremde Datei hat Quelle und Lizenz in `ART_LICENSES.md`
- [ ] Keine CC BY-SA- oder GPL-Grafiken
- [ ] Spielerfarben, Zahlen und Symbole eindeutig lesbar, Kontrast geprüft
- [ ] Regeln und Werte unverändert
