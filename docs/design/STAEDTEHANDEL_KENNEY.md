# Städtehandel – Kenney-Gebäude, Version 3.10.0

Stand: 15. November 2026. Umsetzung ausschließlich für `staedtehandel`. Die bestehende Aurelia-Karte und die autoritative Spiellogik bleiben erhalten.

## Tatsächlich integrierte Grafiken

| Datei unter `public/games/staedtehandel/art/` | Einsatz | Abmessungen | Dateigröße |
|---|---|---|---|
| `buildingTiles_000.webp` | Siedlung: ein Geschoss | 99 × 85 | 2.422 Byte |
| `buildingTiles_003.webp` | Stadt: zwei Geschosse | 128 × 123 | 3.828 Byte |

Zusammen **6.250 Byte Bilddaten**. Beide Dateien sind bytegleich mit den vorbereiteten WebPs. Keine neue Grafik, kein neues Theme, keine Abhängigkeit und keine 3D-Laufzeit. Die sechs vorbereiteten Bausteine wurden anhand von Original-PNG-, WebP- und Lizenzprüfsummen kontrolliert und tatsächlich dekodiert. Nicht übernommen: 010 (konkurrierende rote Akzente), 032 (abweichende Fensterfamilie), 066 (nur Dachmodul), 114 (Modul-/Turmform mit roten Akzenten). 000/003 bilden das zusammengehörige ein-/zweigeschossige Paar.

Die isometrischen Illustrationen dienen als kleine Gebäudemarker auf der unveränderten Draufsicht. Die Siedlung ist 28 SVG-Einheiten breit, die Stadt 32. Der Sockel übernimmt die vorhandene Eigentümerfarbe und dasselbe Symbol (● ▲ ■ ◆ ★ ✚); Straßen und Spielerleiste behalten ihre ursprünglichen Farben/Symbole. Der ursprüngliche Gebäudepfad bleibt im DOM. Erst nach erfolgreichem Laden und Dekodieren erscheint die Illustration; bei Netzwerk-, Dekodier- oder späterem SVG-Bildfehler wird wieder der ursprüngliche SVG-Marker angezeigt. Kein wiederholter Ladeversuch bei jedem Render; Neuladen der Seite erlaubt einen neuen Versuch.

Dekorative Bild- und Sockelelemente fangen keine Zeigerereignisse ab. Bauplätze werden weiterhin zuletzt im SVG ausgegeben. ViewBox, Kartenkoordinaten, Zoom, Scrollposition, Bauplatzliste, Tastaturereignisse und Socket.IO-Spielaktionen bleiben erhalten. SVG-Titel nennen weiterhin Gebäudeart und Eigentümer auf Deutsch/Englisch. Die Bilder sind dekorativ und für Screenreader ausgeblendet.

## Herkunft und Lizenz

- Original: [Kenney Isometric Buildings](https://kenney.nl/assets/isometric-tiles-buildings), Kenney Vleugels, Paket 1.0 / KG3.
- In der vorhandenen Recherche geprüfter [GitHub-Spiegel](https://github.com/GeorgeQLe/assets-2d-isometric); die Freigabe beruht auf dem Originalpaket und dessen Lizenztext, nicht allein auf GitHub.
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): persönliche/kommerzielle Nutzung und Weitergabe; freiwilliger Urheberhinweis im Spiel unter **Grafiknachweise / Artwork credits**.
- Originaldateien: `PNG/buildingTiles_000.png`, `PNG/buildingTiles_003.png`. Vorbereitete Konvertierung PNG → WebP, bei 003 zusätzlich 132×127 → 128×123. Keine weitere Bildbearbeitung beim Einbau; Platzierung und Farbsockel im SVG.
- Vollständige SHA-256-Werte, Originalgrößen und Änderungen: [Asset-Manifest](../../public/games/staedtehandel/asset-manifest.json). Original-Lizenznachweis: SHA-256 `17b7e0683015024b5ec06cd97773dd795ca8b9371f6ec1fabd74d7b3eb6f6397`. Die öffentliche Textkopie normalisiert nur Zeilenenden und nachgestellte Leerzeichen; eigene kanonische Prüfsumme im Manifest.
- Jede tatsächlich ausgelieferte Grafik einzeln in [ART_LICENSES.md](ART_LICENSES.md); [öffentliche Grafiknachweise](../../public/games/staedtehandel/credits.html) und [Lizenztext](../../public/games/staedtehandel/kenney-LICENSE.txt).

## Tatsächlicher Vorher-/Nachher-Vergleich

[Galerie mit 44 Aufnahmen](screenshots/staedtehandel/kenney-2026-11/index.html), [Aufnahme-Manifest mit Prüfsummen](screenshots/staedtehandel/kenney-2026-11/screenshots.json).

Vorher: `798469be062d278a09e37b15069e57f0496ddb5e` / 3.9.0. Nachher: 3.10.0, Implementierungscommit `aef22f30ca7a26df93ba6b2511d90f482ecb59c2`. Die normalisierten SHA-256-Werte der tatsächlich geprüften Frontenddateien stehen für beide Stände im Manifest.

Für Standardkarte (drei Spieler, 19 Hexfelder) und Großkarte (sechs Spieler, 30 Hexfelder) jeweils echte Vorher-/Nachher-Aufnahmen bei **1920×1080, 1440×900, 768×1024, 390×844 und 360×800**. Zusätzlich Bauplätze, tatsächlicher Stadtausbau, Wiederverbindung/Englisch, Zuschauer, vier/fünf Spieler, Firefox/WebKit und SVG-Fallbacks.

Isolierte gespeicherte Testpartien: Alle Aufbau- und Stadtbauaktionen durch die Original-Engine, reproduzierbarer Zufall, explizite Startressourcen aus der Bank. Pro Eigentümer eine Siedlung und eine Stadt vor dem zusätzlichen Browser-Stadtausbau. Keine natürliche Langzeitpartie behauptet, kein Austausch von `lastState` im Browser und keine Produktivdaten. Jede Auflösung erhält einen frischen Browserkontext mit derselben Testidentität; 390/360 nutzen Chromium/WebKit mit Touch/Mobile. Firefox nutzt responsive Viewports, da dessen Playwright-Anbindung kein natives Mobile-Profil unterstützt.

Original-PNGs bleiben im privaten Prüfverzeichnis. Die 44 eingecheckten Aufnahmen sind WebP-Exporte mit unveränderten Abmessungen, Qualität 0,90, ohne Zuschnitt, Retusche oder Montage (zusammen 3.811.804 Byte). Das Manifest enthält sowohl die ursprünglichen PNG- als auch die Export-Prüfsummen. Diese Dokumentationsbilder werden nicht vom Spiel geladen.

## Verifikation

| Prüfung | Tatsächliches Ergebnis |
|---|---|
| `node --test test/staedtehandel.test.js test/staedtehandel-server.test.js` | **32 bestanden**; Topologien, feste/zufällige Karten, Rohstoffe, Bau/Stadtausbau, Straßen, Häfen/Handel, Räuber/Entwicklungskarten, volle Botpartien 3–6 Spieler, Zuschauerrechte, Speicherung und echter Serverneustart mit Reconnect |
| Neue Node-Grafik-/Datenschutztests | **4 bestanden**; exakte Bildbytes/Herkunft, Dekodierung/Fallback, native gespeicherte Partien 3–6 Spieler, unabhängige unterschiedliche geheime Ressourcen/Ziehstapel bei identischer öffentlicher Ansicht und Darstellung |
| `playwright test test/ui/staedtehandel-art.spec.js test/ui/staedtehandel.spec.js` | **14 bestanden**, Desktop und natives Touch-Profil; tatsächliche Spiel-/Botabläufe, alle Eigentümerfarben/-symbole, Nachbargebäude, Bau per Tastatur/Touch, Zoom/Pan, Rechts-/Zuschauergrenzen, Sprache, Pause und Reconnect |
| Gezielte Netzwerkfehlerprüfung nach Test-Cache-Korrektur | **2 bestanden** (Desktop/Mobil), jeweils 404, beschädigte Bilddaten, partieller Ausfall und tatsächlicher SVG-Ladefehler nach erfolgreichem Vorladen; ursprünglicher Marker bleibt funktional |
| Lokale Vergleichsprüfung Chromium / Firefox / WebKit | Jeweils 3/4/5/6-Spieler-Speicherstände, beide Kartengrößen, fünf Größen für Standard/XL, zusätzliche Stadtausbau-/Reconnect-/Zuschauerfälle und fehlende/beschädigte Bilder erfolgreich; keine beobachteten JavaScript-Ausnahmen |
| `npm run test:fast` | **2.066 bestanden, 0 fehlgeschlagen, 3 übersprungen**; 2.069 Tests insgesamt, letzter vollständiger Lauf 55,129 s |

Die neuen Browserprüfungen messen auch, dass Gebäude keine Zahlen, Rohstoffsymbole, Hafensymbole oder anderen Gebäude überdecken. Dekoration hat `pointer-events:none`; der tatsächliche Bauplatz am Gebäudepunkt bleibt erreichbar. Native Touch-Verschiebung und die zugängliche Bauliste werden geprüft. Die vorhandenen Straßen bleiben geometrisch unverändert und schließen am Baupunkt an; ihre Verbindung unter dem Gebäudesockel ist beabsichtigt.

Für simulierte Bildausfälle ist der Service Worker **nur im Testkontext** blockiert, damit eine vorhandene gültige Cache-Kopie den absichtlich erzeugten Netzwerkfehler nicht verdeckt. Normale Spiel-/Aufnahmetests verwenden die unveränderte App. Firefox benötigte hier die normale Ausführung außerhalb des eingeschränkten Windows-Testkontos; innerhalb dieses Kontos stürzte schon eine leere Browserseite ab. Alle Aussagen über Gameplay stammen aus tatsächlich ausgeführten Tests oder dem unveränderten Originalcode; ein bloßes Renderbild gilt nicht als Beweis für eine vollständige Partie.

Die Versionsprüfung verglich bisher Arrays/Text statt numerischer Versionsbestandteile und lehnte dadurch 3.10.0 nach 3.9.0 ab. Ausschließlich dieser unmittelbar erforderliche gemeinsame Test wurde auf numerischen Vergleich korrigiert. Die übrigen gemeinsamen Laufzeitkomponenten sind unverändert.

Der erste [CI-Lauf 43691540388](https://github.com/TTLPSCWA/PokerAbend/actions/runs/43691540388) scheiterte ausschließlich an einer Zeitüberschreitung im vorhandenen Speicher-/Bot-Servertest beim Warten auf den nächsten menschlichen Zug (2.065 bestanden, einer fehlgeschlagen, drei übersprungen). Im Test ließ sich ein Regelzustand reproduzieren, in dem eine Sieben während eines fremden Zugs erst sieben menschliche Handkarten zum Abwerfen verlangt; bloßes Warten kann dann nicht fortfahren. Die genaue CI-Würfelsequenz wurde nicht protokolliert. Der Servertest beantwortet solche Abwurfpflichten nun auch zwischen eigenen Zügen und nach Wiederverbindung, mit geprüfter Kartenanzahl und geprüftem Server-Ack. Keine Engine-Änderung und keine bloße Verlängerung des Zeitlimits. Der vollständige lokale Nachlauf einschließlich des korrigierten Servertests ist grün.

## Grenzen und Restpunkte

- Tatsächliches Safari ist auf diesem Windows-Rechner nicht verfügbar. WebKit ist ein zusätzlicher Engine-Test und keine Behauptung über einen durchgeführten Safari-/iOS-Gerätetest.
- Im eingepassten Überblick bleiben Gebäude bewusst klein, damit Zahlen, Rohstoffe, Häfen und Nachbarpositionen frei bleiben. Details sind mit dem vorhandenen Zoom besser sichtbar; keine perspektivische Umgestaltung der Karte.
- Auf kleinen Geräten bleiben vorhandener Kartenzoom/Scrollbereich und Aktionsdock erhalten. Zum Erreichen weiterer Kartenbereiche muss wie bisher verschoben bzw. die zugängliche Bauliste verwendet werden. Keine zusätzliche mobile Komplettüberarbeitung.
- Reale Touch-Hardware, assistive Technologien und alle möglichen Speicherstände wurden nicht erschöpfend geprüft. Browser-Touch und Tastatur, zwei Kartenfamilien sowie native Speicher-/Reconnect-Fälle sind nachgewiesen.

## Änderungen und Veröffentlichung

Geändert: ausschließlich Städtehandel-Frontend und seine zwei neuen Bilder/Manifest/Lizenz/Grafiknachweise; unmittelbar nötige Testdateien, Versionsdateien, Lizenz-/Design-/Screenshotdokumentation. Die SHA-256-Werte von `games/staedtehandel/{map,room,rules,index}.js` sind gegenüber dem Ausgangscommit identisch und im Aufnahme-Manifest festgehalten. Keine Änderungen an anderen Spielen, Serverregeln, gemeinsamen Laufzeitdateien, Abhängigkeiten, Vaults oder privaten Quellpaketen.

Version **3.10.0**. Implementierung: [`aef22f3`](https://github.com/TTLPSCWA/PokerAbend/commit/aef22f30ca7a26df93ba6b2511d90f482ecb59c2), auf `main` gepusht. Der erste CI-Lauf und die Testkorrektur sind oben dokumentiert; der CI-Nachlauf der Korrektur wird nach dem Push kontrolliert. Kein Serverdeployment.
