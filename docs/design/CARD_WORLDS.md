# Kartenwelten (ART-T)

Stand: 10.11.2026. Host-Auswahl für UNO (Classic), Skip-Bo und Phase 10; gilt für alle am Tisch, nur Aussehen.
Herkunft: Entwurfsrunde 5 (40 Welten), Auswahl der Pilotwelten durch Tobi: U-04, U-01, U-02, SB-09, SB-01, SB-04, P-03, P-06, P-10.

## Aufbau

| Teil | Datei |
|---|---|
| Welten (Daten, vom Server geprüft) | `public/games/card-worlds/worlds.js` |
| Motive (eigene Zeichnungen, 60 × 60) | `scripts/card-worlds/motifs.mjs` |
| Erzeugung von Bildern und Variablen | `node scripts/build-card-worlds.mjs` → `public/games/card-worlds/art/<Welt>/*.svg`, `public/games/card-worlds/worlds.css` |
| Gemeinsame Kartenvorlage und Rahmen | `public/games/card-worlds/template.css` (über `public/games/card-worlds.css` geladen) |
| Host-Auswahl und Umschalten | `public/card-worlds.js`, `public/card-worlds.css`, Einbindung in `public/games/kit.js` |
| Server | Ereignis `setCardWorld` in `server/index.js` (nur Host, auch in Runde und Pause), gespeichert als `cardWorld`; beim Spielwechsel bleibt eine Welt nur, wenn sie im neuen Spiel gilt (Winterwelten) |
| Tests | `test/card-worlds.test.js`, `test/ui/art-card-worlds.spec.js` |

Regeln:
- Ohne Welt (`Standard`) bleibt das bisherige Aussehen unverändert.
- UNO-Varianten mit eigener Gestaltung (Flip, No Mercy, All Wild, Spuknacht) behalten ihr Aussehen; die Welt gilt dort nicht.
- Skip-Bo nutzt die vier Weltfarben der Reihe nach für 1–4, 5–8, 9–12 und Joker. UNO und Phase 10 ordnen sie über den Farbton Rot, Gelb, Grün, Blau zu (höchstens 45° Abweichung, per Test geprüft), damit „Rot“ rötlich bleibt. Dafür wurden einige Farben der Entwürfe angepasst (z. B. U-03, U-08, U-10, P-02, P-03, P-08, P-09, X-02, X-06, X-08, X-09, X-10).
- Farbsymbole (Schalter „Farbsymbole auf Karten“) und die Markierung spielbarer Karten bleiben erhalten.
- Neue Welt: Eintrag in `worlds.js`, Motiv in `motifs.mjs`, `node scripts/build-card-worlds.mjs`, Tests laufen über alle Welten.

## Welten und Vorbilder (nur intern)

| ID | Name | Vorbild (nur Stimmung) | Im Spiel |
|---|---|---|---|
| U-01 | Zaubersaal | Harry Potter · Hogwarts Legacy | Farbwahl = Hauswahl, +2 ist ein Zauberspruch, Aussetzen ein Lähmzauber. |
| U-02 | Hexerpfad | The Witcher | Aussetzen = Zeichen, +4 = Monstervertrag, Farbwechsel = Trank trinken. |
| U-03 | Neonstadt 2099 | Cyberpunk 2077 | Jede Farbe ist ein Stadtviertel, +2 = Hack, Richtungswechsel = Datenumleitung. |
| U-04 | Blockwelt | Minecraft | Zahlen sind Blöcke, +2 = Abbau, Farbwahl = Biomwechsel. |
| U-05 | Aschenreich | Elden Ring · Dark Souls | +4 = Bosskampf, Aussetzen = Rast am Leuchtfeuer. |
| U-06 | Hüpfwelt | Super Mario | Ziehen = Münzblock, +2 = Pilz, Aussetzen = Sprung über den Gegner. |
| U-07 | Taschenmonster | Pokémon Sammelkarten | Farben sind Elemente, +2 = Attacke, Farbwahl = Entwicklung. |
| U-08 | Heldenarena | Overwatch | Jede Farbe ist eine Heldenrolle, Aussetzen = Betäubung, +4 = Ultimate. |
| U-09 | Lichtwald | Zelda · Ori | Ziehen = Abenteuer, Farbwahl = Schrein aktivieren. |
| U-10 | Insel-Showdown | Fortnite | Ziehen = Beute, +2 = Sturmkreis, letzter Spieler gewinnt die Insel. |
| SB-01 | Montagewerk 12 | Satisfactory · Factorio | Jeder Stapel 1–12 ist ein Fließband; fertige Stapel liefern ein Bauteil. Joker = Universalroboter. |
| SB-02 | Klötzchenstadt | LEGO-Spiele | Mit jeder Karte wächst ein Gebäude; bei 12 ist es fertig und verschwindet. |
| SB-03 | Inselkolonie | Anno | Stapel = Siedlungen, die von Hütte (1) bis Hafenstadt (12) wachsen. |
| SB-04 | Orbitalstation | No Man’s Sky · Starfield | Jeder Stapel baut ein Stationsmodul; Joker = Andockmanöver. |
| SB-05 | Tiefseebasis | Subnautica | Stapel = Basis-Abschnitte von der Luke (1) bis zur Kuppel (12). |
| SB-06 | Stadtplaner | Cities: Skylines | Jeder Stapel ist ein Stadtteil, der mit 12 fertig gebaut ist. |
| SB-07 | Freizeitpark | Planet Coaster · RollerCoaster Tycoon | Stapel = Fahrgeschäfte; bei 12 eröffnet die Attraktion. |
| SB-08 | Raketenwerft | Kerbal Space Program | Jeder Stapel ist eine Raketenstufe; bei 12 hebt sie ab. |
| SB-09 | Burgenbau | Stronghold · Age of Empires | Stapel = Burgabschnitte: Fundament, Mauer, Turm, Burgfried. |
| SB-10 | Zwergenschmiede | Deep Rock Galactic | Jeder Stapel ist ein Schacht; bei 12 ist die Ader abgebaut. |
| P-01 | Unterweltflucht | Hades | Jede Phase ist eine Kammer der Unterwelt; Aussetzen = Falle. |
| P-02 | Gipfelsturm | Celeste | Phase 1 = Basislager, Phase 10 = Gipfel; Joker = Doppelsprung. |
| P-03 | Testkammer X | Portal | Jede Phase ist eine Testkammer; Aussetzen = Portal schließen. |
| P-04 | Kerkertiefe | Diablo | Phase = Kerkerebene; Joker = legendäre Beute. |
| P-05 | Maschinenjagd | Horizon | Jede Phase ist eine Jagd; Aussetzen = Tarnung im Gras. |
| P-06 | Kart-Grand-Prix | Mario Kart | Zehn Phasen sind zehn Strecken; Aussetzen = Banane auf der Strecke. |
| P-07 | Wüstentempel | Uncharted · Tomb Raider | Jede Phase öffnet eine Kammer; Phase 10 = Schatzkammer. |
| P-08 | Sternenexpedition | Mass Effect | Jede Phase ist ein Sternsystem; Joker = Sprungtor. |
| P-09 | Küchenchaos | Overcooked | Jede Phase ist ein Bestellungsset; Aussetzen = Küchenbrand. |
| P-10 | Rhythmus-Tour | Guitar Hero · Beat Saber | Jede Phase ist ein Song der Tour; Phase 10 = Zugabe. |
| X-01 | Winterball | Harry Potter (Weihnachtsball) | UNO: +2 = Geschenk · Skip-Bo: Stapel schmückt den Saal · Phase 10: zehn Tanzrunden. |
| X-02 | Frostjäger | The Witcher (Winter) | UNO: Aussetzen = Schneesturm · Skip-Bo: Stapel = Hütte bauen · Phase 10: zehn Pässe. |
| X-03 | Neon-Schnee | Cyberpunk (Winter) | UNO: +2 = Paketlieferung · Skip-Bo: Stapel = Lieferroute · Phase 10: zehn Bezirke. |
| X-04 | Schneeblöcke | Minecraft (Winter) | UNO: Ziehen = Schnee abbauen · Skip-Bo: Iglu bauen · Phase 10: zehn Biome. |
| X-05 | Polarstation | Subnautica: Below Zero | UNO: Aussetzen = eingefroren · Skip-Bo: Station ausbauen · Phase 10: zehn Expeditionen. |
| X-06 | Weihnachtswerkstatt | Satisfactory (FICSMAS) | UNO: +4 = Großauftrag · Skip-Bo: Fließband füllen · Phase 10: zehn Lieferungen. |
| X-07 | Winterdorf | Stardew Valley (Winter) | UNO: Ziehen = Markt · Skip-Bo: Dorf schmücken · Phase 10: zehn Wintertage. |
| X-08 | Eiskönigreich | Skyrim · Frozen-Stimmung | UNO: Farbwahl = Polarlicht · Skip-Bo: Eisschloss bauen · Phase 10: zehn Türme. |
| X-09 | Lebkuchen-Kart | Mario Kart (Winter) | UNO: Aussetzen = Glatteis · Skip-Bo: Strecke legen · Phase 10: zehn Rennen. |
| X-10 | Wintermonster | Pokémon (Winter) | UNO: Farben = Elemente · Skip-Bo: Stapel = Sammelalbum · Phase 10: zehn Arenen. |