# Shut the Box – Holztexturen, 15. November 2026

**Ergebnis: Variante B (ambientCG Wood051) ausgewählt. Version 3.15.0.** Ausschließlich der Hintergrund der bestehenden Box erhält die vorbereitete Textur. Keine Änderung an Renderer-JavaScript, Server, Spielzustand, Regeln, Würfeln, Klappen oder Bedienung. Kein Serverdeployment.

[Direkte Gegenüberstellung Original / A / B](screenshots/shutthebox/wood-2026-11/vergleich.html) · [48 Bildnachweise mit SHA-256](screenshots/shutthebox/wood-2026-11/screenshots.json) · [Assetmanifest](../../public/games/shutthebox/asset-manifest.json) · [Lizenzregister](ART_LICENSES.md)

## Vergleich und Entscheidung

| Kriterium | Original | A: Poly Haven Wood Table 001 | B: ambientCG Wood051 |
|---|---|---|---|
| Material | Gleichmäßiger brauner Verlauf | Echte feine, überwiegend senkrechte Maserung | Ruhigere, überwiegend waagerechte Maserung |
| Farbwirkung im vorhandenen Rahmen | Warm, aber flächig | Stärker rötlich, visuell unruhiger | Harmoniert mit braunem Rahmen und hellen Klappen |
| Zahlen, Auswahl, offene/geschlossene Klappen | Unverändert | Unverändert | Unverändert |
| Desktop / Mobil | Ausgangszustand | Funktional geeignet | Sichtbar natürlicheres Material, bevorzugt |
| Zusätzlicher Bildtransfer | 0 | 48.800 Byte | **25.602 Byte** |
| Entscheidung | Bildfehler-Fallback | Nur Vergleich, kein Runtime-Asset | **Integriert**, 47,54 % kleiner als A |

Die Materialbewertung ist eine visuelle Bewertung, kein automatischer Qualitätsbeweis. Beide echten vorhandenen WebP-Dateien wurden mit derselben soft-light-Mischung über dem ursprünglichen Holzverlauf geprüft. B wird bytegleich kopiert; kein neues Bild erzeugt. Die ursprünglichen Klappengradienten, Scharniere, Schattierung, Auswahlumrandung und Würfel bleiben erhalten. Die Textur ist opak; Transparenz entsteht nicht durch eine veränderte Datei, sondern durch CSS-Mischung. Ein lokaler Bildrequest, keine externen Abrufe oder neuen Abhängigkeiten. Keine Behauptung über gemessene Ladezeit in einem Mobilfunknetz.

## Herkunft und Lizenz

Geprüft am 15.11.2026 anhand des vorhandenen privaten Assetberichts, der vorbereiteten Manifeste, Originaldateien und archivierten Anbieter-Lizenznachweise. Beide Anbieter erlauben die Weitergabe der Assets unter CC0 1.0 einschließlich kommerzieller Verwendung und Bearbeitung. Keine verpflichtende Namensnennung; Herkunft wird dennoch im Register und Manifest dokumentiert. Die archivierten Webseiten selbst werden nicht mitveröffentlicht.

| Variante | Original und Quelle | Vorbereitung und Lizenz |
|---|---|---|
| A | [Wood Table 001](https://polyhaven.com/a/wood_table_001), Dimitrios Savva (Fotografie), Rico Cilliers (Verarbeitung); Original wood_table_001_diff_1k.jpg | Vorhandene 512×512-WebP aus 1024×1024-JPG, [Poly-Haven-Nachweis](https://polyhaven.com/license), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Nur Vergleichsscreenshots veröffentlicht. |
| B | [Wood051](https://ambientcg.com/view?id=Wood051), ambientCG (Anbieter); Original Wood051_1K-JPG_Color.jpg | Vorhandene 512×512-WebP aus 1024×1024-JPG, [ambientCG-Nachweis](https://docs.ambientcg.com/license/), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Einzige übernommene Runtime-Datei: public/games/shutthebox/art/Wood051_1K-JPG_Color.webp. |

SHA-256 (vorbereitete Datei / Original / archivierter Lizenznachweis):

* A: `f4a26150f0dd9247d0a73898eb2a9ba7d3190113adae904d9615b870c14f9034` / `460dd08d240f4a1f02982415048c3c5c200f385db212da18dc7e2df68bf4d0be` / `d6eb4c64b847ee38970cc6ae43923ef39449bd320d69ef647550a2d1c8398db7`.
* B: `b5c9ef08b000a1c42bfd42924e46f2a2181363978168c61d3937baf5e0346c22` / `f3c6c5456457e8d05c1fee4d2f186f41d0aea2b8a06859b69ce2934e11aa8798` / `86d690c1384e979c84fcb607c66dcd4802ff75f917a2fbef1658add632d1b11b`.

## Tatsächliche Prüfungen

* **Vergleich:** 78 echte Chromium-Aufnahmen aus identischen nativen Spielzuständen, 1–8 Plätze und 9/12 Klappen. 1 Spieler/9 Klappen sowie 8 Spieler/12 Klappen jeweils in 1920×1080, 1440×900, 768×1024, 390×844, 360×800 und 900×450; die anderen Kombinationen in 1440×900. Vergleich enthält geschlossene, offene und ausgewählte Klappen sowie passende/unpassende Ziele. Zustand, inneres Box-DOM, Klappenpositionen, Typografie, Farben und Transformationen sind zwischen Original/A/B identisch; kein horizontaler Seitenüberlauf.
* **Dauerhafte Bilder:** 36 Vollansichten und 12 Boxausschnitte, aus Original-PNG verlustbehaftet als WebP Qualität 0,90 exportiert, ohne Größenänderung. Screenshots sind Dokumentation und werden nicht als Spielassets verwendet. Original-PNG- und Export-Hashes stehen im Bildmanifest. 48 Exporte zusammen 2.139.672 Byte; sie werden beim Spielen nicht geladen.
* **Engine:** 7 vorhandene Tests plus 2 neue Tests erfolgreich. Der neue Gameplaytest führt 16 vollständige native Partien (1–8 Spieler × 9/12 Klappen) mit reproduzierbaren Testwürfen bis zur Wertung aus; öffentliche Ergebnisse, Wertebereiche und nur für den aktiven Spieler verfügbare Kombinationen geprüft. Assettest prüft tatsächliche WebP-Bytes und individuellen Herkunfts-/Lizenznachweis.
* **Chromium:** 36 abschließende Browserprüfungen erfolgreich: 34 neue Prüfungen plus 2 bestehende Shut-the-Box-Funktionstests, jeweils Desktop/Mobil zusammengezählt. Alle 16 Spieler-/Klappenkombinationen, Würfeln, erlaubte Auswahl per Tastatur bzw. Touch, Schließen, Reload-Reconnect mit unverändertem Zustand; Einzelspieler bis Rundenende. Zuschauer in 1-/8-Platz-Partien ohne Aktionen oder private Kombinationen. Kein achtfacher physischer Gerätetest: native Räume mit kontrollierten Testplätzen, aktiver Browser plus zusätzlichem Zuschauer.
* **Firefox und WebKit:** Je 10 abschließende Prüfungen erfolgreich: 1/8 Spieler, jeweils 9/12 Klappen, Desktop/schmale Ansicht und Bildfehler. Firefox schmale Ansicht ist Responsive-Viewport ohne Touch-Emulation; WebKit mit Mobil-/Touch-Emulation. Keine Aussage über reale Safari-Geräte.
* **Bildfehler:** HTTP-404 für das tatsächliche Asset, unabhängiges ursprüngliches CSS als Referenz. Exakt derselbe Verlauf und Boxinhalt; Bildvergleich erlaubt ausschließlich geringfügige Compositor-/Kantenglättungsabweichungen (mittlere RGB-Abweichung <0,3 von 255, höchstens 0,1 % Pixel mit Kanalabweichung >16). Anschließendes legales Schließen erfolgreich. Ursprüngliche genaue PNG-Byteprüfung war für Browser-Rasterung zu streng und wurde durch diesen begrenzten Pixelvergleich ersetzt.
* **Frühe Prüfläufe:** Hatten Fehler in der Prüfhilfe (zu strenger PNG-Hashvergleich, fehlendes Warten nach dem Schließen, zu kurze Zeitgrenze bei gleichzeitigen Engines). Prüfhilfe korrigiert, anschließend die genannten vollständigen Browserläufe wiederholt. Keine Spiellogikänderung zur Testanpassung.

Abschließender Schnelltest und Prüfung nach Integration in den inzwischen weiterentwickelten Stand werden unten mit ihren tatsächlichen Ergebnissen ergänzt.

### Wiederholbare Befehle

```text
node --test test/shutthebox.test.js test/shutthebox-texture.test.js
npm run test:fast
PLAYWRIGHT_CHANNEL=chromium npx playwright test test/ui/shutthebox-texture.spec.js test/ui/game-flow.spec.js --grep "Shut the Box" --grep-invert "Englisch"
SB_ENGINE=firefox npx playwright test --config=test/ui/shutthebox-browser.config.js --grep "wood: (1p|8p)|missing image"
SB_ENGINE=webkit npx playwright test --config=test/ui/shutthebox-browser.config.js --grep "wood: (1p|8p)|missing image"
```

Unter PowerShell die Variablen vorher über `$env:PLAYWRIGHT_CHANNEL='chromium'` bzw. `$env:SB_ENGINE='firefox'` setzen; keine Neuinstallation vorausgesetzt.

## Stand und Grenzen

Die drei Varianten wurden gegen Commit `54d43b7de664e30d2ab0c93e766082045a38c718` (3.12.0) aufgenommen. Parallel veröffentlichte Änderungen wurden bis `251e07eaa96682c2290f5a1d3d725a3bcc588b74` (3.14.0) in die isolierte Prüfbasis übernommen; historische Vergleichsbilder behalten ihren ursprünglichen Commit. Renderer-JS und Serverdateien von Shut the Box sind unverändert. Neue Themenwelten ändern teilweise Klappenfarben, unsere Regel betrifft ausschließlich .sb-wood; ergänzende Kompatibilitätsprüfung unten.

Unverändert vorhandene englische Textlücken sind kein neuer Übersetzungsauftrag: die bestehenden ausdrücklich erwarteten Englisch-Fehlschlagtests wurden aus dem Funktionslauf ausgeschlossen. Der Texturcode fügt keinen Spieltext hinzu. Reconnect meint Wiederverbindung zum laufenden Raum, keine neu versprochene Wiederherstellung mitten im Spiel nach Serverneustart. Keine Messung auf physischen Smartphones und keine manuelle Safari-Abnahme. Kein Performance-Benchmark unter Netzwerklast.

Die Box bleibt ein bewusst dezentes Material; Zahlenklappen und Würfel bleiben die bestehenden Grafiken. Andere Spiele, Vaults, Konfigurationen und private Rohdaten wurden durch diesen Auftrag nicht verändert. Parallele fremde Arbeitskopie-Änderungen werden nicht Bestandteil dieses Commits.

## Abschließender integrierter Lauf

* Schnelltest: **2.090 bestanden, 0 fehlgeschlagen, 3 übersprungen**, 2.093 insgesamt.
* Chromium auf der integrierten Basis: **38 bestanden**, einschließlich der zwei zusätzlichen Desktop-/Mobil-Prüfungen aller vier ART-W2-Themenwelten in Shut the Box.
* Galerie: alle 48 Dateien dekodiert, Dateigrößen und SHA-256 geprüft, keine fehlenden Bilder und kein horizontaler Überlauf.
* Versionsbasis 3.14.0 → **3.15.0**. Implementierungscommit und CI werden nach dem tatsächlichen Push dokumentiert.
