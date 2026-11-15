# Gebietskampf – Kenney-Symbole, Version 3.11.0

Stand: 15. November 2026. Ausschließlich Grafikarbeit für `gebietskampf` (ART/VIS-090); keine neue Karte und keine neuen Regeln.

## Tatsächlich integrierte Dateien

| Datei in `public/games/gebietskampf/art/` | Verwendung | Format / Größe |
|---|---|---|
| `flag_triangle.webp` | Fahnenkarte, Tauschsatz, Verstärkungsphase | WebP, 64×64, 940 Byte |
| `shield.webp` | Schildkarte, Tauschsatz, Abwehrbeschriftung | WebP, 64×64, 982 Byte |
| `sword.webp` | Angriffsphase, Start-Angriff-Schaltfläche, Angriffsbeschriftung | WebP, 64×64, 890 Byte |

**Zusammen 2.812 Byte Bilddaten**, bytegleich mit der vorbereiteten Auswahl. Dunkle CSS-Plaketten geben den unverändert weißen Kenney-Silhouetten auf hellen Karten Kontrast. Kartentyp und Gebietsname sind nun getrennt beschriftet, Joker wird als beliebiges Symbol ausgewiesen. Die gleichen Symbole erscheinen in den bereits vom Server angebotenen Tauschsätzen. Schwert und Schild stehen neben den öffentlichen Angriffs-/Abwehrbeschriftungen; tatsächliche Würfelzahlen und Verluste bleiben unverändert.

Die Symbole auf Karten bleiben **Tauschsymbole ohne zusätzliche Kampfboni**. Eine kurze Erläuterung vermeidet die Verwechslung von Schildkarten mit einer neuen Abwehrregel. Der Renderer erzeugt Bilder und Labels ausschließlich aus der persönlichen Serveransicht; keine zusätzliche Zustandsberechnung, Nachricht oder Kartenlogik.

## Geprüft, aber bewusst nicht übernommen

Alle sechs vorbereiteten Kenney-Icons wurden mit Original-PNG-, WebP- und Lizenzprüfsummen sowie tatsächlicher Bilddekodierung geprüft. Die dreieckige Fahne entspricht dem bisherigen Zeichen; die quadratische Variante wird nicht zusätzlich geladen. Der Drehpfeil steht für Rotation, nicht Verstärkung oder Verschieben. Die dekorativen 3D-Würfel ersetzen keine tatsächlichen Kampfwürfe.

In der vorbereiteten Auswahl ist kein passendes Fackel-/Jokermotiv vorhanden. Die Laterne und das Labyrinth-Schatzmotiv Stern werden nicht umgedeutet. **Fackel behält ♨, Joker ★**, jeweils mit sichtbarer deutscher/englischer Typbeschriftung. Schwert ist kein Ersatz für Fackelkarten. Zusätzliche Ressourcen-, Gebäude- oder Geländegrafiken verbessern diesen begrenzten Auftrag nicht und werden nicht eingebaut. Keine Hexagon-Kacheln auf Meridia.

## Quelle und Lizenz

[Kenney Board Game Icons 1.1](https://kenney.nl/assets/board-game-icons), erstellt/vertrieben von **Kenney**, unter [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Der vorhandene Recherchebeleg vergleicht 513 Lizenz-/PNG-Dateien des [GitHub-Spiegels](https://github.com/eturner58/game-assets/tree/main/kenney/Icons/Board%20Game%20Icons) mit dem offiziellen Paket; die Lizenzfreigabe beruht auf dessen eigenem Lizenztext.

Originale: `PNG/Default (64px)/flag_triangle.png`, `shield.png`, `sword.png`. Vorbereitete Konvertierung PNG → WebP bei unveränderten 64×64 Pixeln, anschließend unverändert kopiert. Der dunkle Hintergrund entsteht im CSS; keine weitere Bildbearbeitung oder Umfärbung.

Jede Datei mit vollständiger SHA-256, Original-SHA-256, Quelle und Änderungen im [Asset-Manifest](../../public/games/gebietskampf/asset-manifest.json) und einzeln in [ART_LICENSES.md](ART_LICENSES.md). Original-Lizenzdatei SHA-256: `ee984bc143c380c108199620d18bfdf55001a566951bbda485c2a5d94254350a`. Die öffentliche Textkopie normalisiert nur Zeilenenden und nachgestellte Leerzeichen; eigener kanonischer Hash im Manifest. Freiwillige [Grafiknachweise / Artwork credits](../../public/games/gebietskampf/credits.html) sind im Spiel erreichbar. Keine neuen CC-BY-Dateien integriert.

## Erhaltene Karte, Aktionen und Geheimhaltung

`mapSVG`, die Zielberechnung `targets` und sämtliche ursprünglichen Karten-CSS-Regeln sind unverändert. `games/gebietskampf/{map,room,rules,bot,index}.js` stimmen inhaltlich mit dem Ausgangscommit überein; Prüfsummen im Aufnahme-Manifest. Meridia behält 42/28 Gebiete, sechs/vier Landmassen, alle Gebietspositionen, Grenzen, Eigentümerfarben/-symbole, Truppenzahlen sowie Angriffs-/Verteidigungsziele und Auswahlmarkierungen. Keine Bilder werden in das Karten-SVG eingefügt.

Die vorhandenen Ereignishandler, ViewBox, Zoom/Pan und alternative Gebietsliste bleiben erhalten. Dekorative Bilder fangen keine Zeigerereignisse ab, besitzen leeren Alttext und sind mitsamt Ersatzzeichen als dekorativ ausgeblendet. Sichtbarer Kartentyp/Gebietsname und vollständige beschriftete Tauschaktionen bleiben für Tastatur und Screenreader verfügbar. Bei fehlenden, beschädigten oder teilweise verfügbaren WebPs erscheinen die ursprünglichen Zeichen; Texte, echte Kartenindizes und Spielfunktionen bleiben verfügbar. Fehlgeschlagene Bilder werden in dieser Sitzung bei weiteren Renderings nicht ständig neu angefordert; Neuladen ermöglicht einen neuen Versuch.

Unabhängige gespeicherte Vergleichszustände enthalten tatsächlich unterschiedliche gegnerische Karten, Missionen und Ziehstapelreihenfolgen. Für eigenen Spieler und Zuschauer ergeben sie identische persönliche Ansichten und identisches vollständiges HTML. Der betroffene Gegner sieht seine Unterschiede selbst. Zuschauer erhalten weder Hand noch Mission, Karten-Markup oder Tauschaktionen. Die Darstellung fügt keine Geheimdaten in Attribute, Klassen, Tooltips oder Bildpfade ein.

## Aufnahmen und Vergleich

[Galerie öffnen](screenshots/gebietskampf/kenney-2026-11/index.html) · [Manifest mit Original-/Export-Prüfsummen](screenshots/gebietskampf/kenney-2026-11/screenshots.json).

Vorher: `a3ecf09456e99311bf94f25fdfbe744d40966a27` / 3.10.0. Nachher: 3.11.0, endgültige Implementierungsreferenz im Dokumentationsnachtrag. Die SHA-256-Werte der tatsächlich geprüften JS-/CSS-Stände und unveränderten fünf autoritativen Quelldateien sind im Manifest festgehalten.

40 dauerhaft gespeicherte Exporte, zusammen **3.046.088 Byte**. Jeweils echte Vorher-/Nachher-Kartenansichten bei **1920×1080, 1440×900, 768×1024, 390×844, 360×800 und zusätzlich 900×450**, für Klein-Meridia mit zwei Spielern und Meridia mit sechs Spielern. Da der Auftrag die Seitenleiste betrifft, wird für diese Vergleiche zur eigenen Kartenhand gescrollt. Weitere Aufnahmen zeigen Übersicht, Angriffsauswahl, Kampf, Englisch nach Reconnect und Zuschauer. Keine Montage oder Retusche; WebP-Exporte mit unveränderten Abmessungen und Qualität 0,90, ursprüngliche PNG-Dateien privat erhalten.

Alle Größen erhalten frische Browserkontexte. Schmale Chromium-/WebKit-Ansichten nutzen native Touch-/Mobile-Profile; Firefox responsive Viewports. Testpartien werden auf einem isolierten Loopback-Server aus originalen Raum-Snapshots geladen. Karten kommen aus dem Originalstapel (Gesamtpool bleibt erhalten), fünf eigene und zwei gegnerische Karten sowie Territorien-Missionen sind explizite Testanordnungen. Keine natürlich verdiente Fünfkartenhand behauptet, keine Browser-`lastState`-Ersetzung und keine produktiven Daten. Kämpfe verwenden echte Serverwürfe; die Kampfaufnahmen verschiedener Durchläufe behaupten keine identischen Würfelserien.

## Tatsächliche Prüfungen

- **18 vorhandene Node-Spieltests bestanden:** Topologie, beide Kartengrößen, Truppen/Verstärkung, Kämpfe/Verluste, Nachrücken, Kartenhandel/Joker/Pflichttäusche, Missionen/Sieg, Bots und Raum-Speicherstand. Vollständige Botpartien auf beiden Karten und in beiden Siegmodi (2/3/4/5 Spieler) sowie Strategiestufen geprüft.
- **3 neue Node-Grafik-/Datenschutztests bestanden:** exakte Datei-/Lizenznachweise; Kartentypen, unveränderte Geometrie und originale Tauschindizes für alle 2–6 Spieler auf beiden Karten; unabhängige Geheimzustände bei identischer autorisierter Darstellung.
- **24 neue Browserfälle bestanden**, Desktop und natives Touch-Profil: alle 2–6 Spieler auf beiden Karten; Kartentypen, Farben, Kartentausch mit tatsächlich angebotenen Indizes/Bonus, Verstärkung per Tastatur, Touch-Pan/Zoom, Auswahl/Angriff, tatsächliche Würfelwerte, Reconnect, Deutsch/Englisch, Zuschauer und fehlende/beschädigte/teilweise verfügbare WebPs mit funktionalem Kartentausch.
- **2 bestehende Spiel-Browserfälle bestanden**, einschließlich tatsächlicher easy-/hard-Bots, Pause, Reconnect und Ziel-/Gebietsliste.
- Zusätzliche lokale Vergleichsdurchläufe **Chromium, Firefox und WebKit** jeweils erfolgreich mit zehn gespeicherten 2–6-Spieler-/Karten-Kombinationen, beiden Kartenfamilien, sechs Größen für 2/klein und 6/groß, Kartentausch, Verstärkung, Angriff, Reconnect/Englisch und Zuschauer. Je 80 tatsächliche Aufnahmen, keine beobachteten JavaScript-Ausnahmen.
- Vollständiger `npm run test:fast` im abgegrenzten Veröffentlichungsstand: **2.069 bestanden, 0 fehlgeschlagen, drei bekannte Zeichenspiel-/Bot-Fälle übersprungen** (2.072 insgesamt, 161,057 s). Anschließend dieselbe Kopie: alle **26 Browserfälle bestanden** (24 neue plus zwei bestehende, 3,9 min).

Fehlversuche getrennt: Der erste kombinierte Browserlauf enthielt zwei Fehler der neuen Fehlerprüfungs-Anmeldung (ein bereits angemeldeter Kontext erwartete erneut das Passwortformular); nach frischen Kontexten/Partien sind alle 24 neuen Fälle grün. Im ersten parallel belasteten Gesamtlauf scheiterte der Start des gemeinsamen Poker-Testservers mit Exitcode 0; dadurch drei Hook-Fehler. Dessen isolierter Nachtest bestand alle drei Tests. Der genaue Startfehler war vom bestehenden Test nicht protokolliert; keine unbewiesene Ursache und kein Anwendungserfolg aus diesem fehlgeschlagenen Lauf abgeleitet. Keine Änderung an fremden Spielen oder an diesem gemeinsamen Test.

Ein weiterer Gesamtlauf im gemeinsam bearbeiteten Arbeitsverzeichnis enthielt drei Prüfsummenfehler für `server/index.js`: dort wurden während dieser Sitzung außerhalb des Gebietskampf-Auftrags ART-W0/Themenwelten-Dateien geändert. `main` erhielt außerdem den unabhängigen Dokumentationscommit `42e994d`. Diese fremden Änderungen wurden weder zurückgesetzt noch in dieses Paket übernommen. Der erfolgreiche vollständige Nachweis verwendet deshalb eine isolierte Kopie des veröffentlichten `42e994dff583786389a18b6372896b87c5b1f126` plus ausschließlich den 61 freigegebenen Gebietskampf-/Versions-/Dokumentations-/Testdateien. Bestehende Abhängigkeiten wurden über eine lokale Verzeichnisverknüpfung gelesen, nichts installiert und kein Branch angelegt. Die normalen Browserfälle wurden auf genau diesem abgegrenzten Stand erneut ausgeführt. Die Bildfehlerprüfung blockiert nur im Testkontext den Service Worker, damit gültige Cache-Bilder die simulierten Netzfehler nicht verdecken.

## Einschränkungen und Restpunkte

Fackel und Joker besitzen weiterhin Font-Zeichen statt neuer Illustrationen; Beschriftungen sichern die Zuordnung, aber die konkrete Glyphenform kann zwischen Plattformen variieren. Lange Kartenlisten und Aktionsdock nutzen weiterhin die vorhandenen Scrollbereiche; keine grundlegende Seitenleisten-/Karten-Neuentwicklung. Keine erzwungene Reduktion der Gebiets- oder Truppenschrift.

Tatsächliches Safari/iOS und physische Touch-/Screenreader-Hardware sind hier nicht verfügbar. WebKit unter Windows ist ein Engine-Test, kein behaupteter Safari-Gerätetest. Firefox benötigte wie zuvor die Ausführung außerhalb des eingeschränkten Windows-Testkontos.

## Version, Änderungen und Veröffentlichung

**Version 3.11.0.** Änderungen nur im Gebietskampf-Frontend, drei verwendeten WebPs samt Manifest/Lizenz/Grafiknachweisen, unmittelbar nötigen Test-/Versions-/Design-/Bildnachweisen. Keine neuen Abhängigkeiten. Vaults und private Originalauswahl bleiben unverändert. Kein Serverdeployment.

Tatsächliche Commit-, Push- und CI-Nachweise folgen nach deren Durchführung im Dokumentationsnachtrag.
