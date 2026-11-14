# ART-013 · Schiffe versenken – Schiffe, Wasser und wählbare Designs

- **Implementierungscommit (Design „Klassisch“, Skin-Architektur):** `3352d886603532aaf66752ab86a13160c04f129f`
- **Zweites Design „Taktik-Konsole“:** `cc8281ee8a5ad5a35edf6830fbfed222d582d138`; Bildraten-Korrektur: `01ed27734ef16ae9eace5b26edc2053f52f58ead`
- **Versionen:** 3.3.0 (Klassisch), 3.4.0 (Taktik-Konsole), 3.4.1 (Radarkegel fest)
- **Freigabe:** Tobi, 14.11.2026 („Schiffe versenken mit zwei hochwertigen, auswählbaren Designs vollständig umsetzen, testen, committen und pushen“)

Die Gestaltung (Quellen, Abweichungen, Marken- und Lizenzfragen) steht getrennt in [../../SCHIFFE_SKINS.md](../../SCHIFFE_SKINS.md). Diese Datei beschreibt die **Umsetzung** und die **Nachweise**.

## Was sich geändert hat

| Vorher | Nachher |
|---|---|
| Schiffe als graue Zellblöcke, Wasser einfarbig | Schiffe von oben (Kenney-Modelle im Stahlton), Wasser mit Wellen und Raster, goldener Rahmen; Treffer als Stern, Wasser als Ring, versenkte Schiffe als dunkles Wrack mit kurzer Sinkbewegung |
| ein Aussehen | zwei Designs, vom Host beim Erstellen gewählt: `naval` (Klassisch, Standard) und `space` (Taktik-Konsole) |

Es bleibt **ein** Spiel mit der ID `schiffe` (eine Kachel, eine Registrierung, ein Room). Regeln, Server, Bedienung, Timer, Punkte und Statistiken sind unverändert.

## Architektur

| Teil | Umsetzung |
|---|---|
| Designs | `games/schiffe/skins.js`: Liste (`naval`, `space`), Standard `naval`, `safeSkin()` für unbekannte Werte |
| Speicherung | Raumeinstellung `skin` in `games/schiffe/room.js` (Standardwert, bei mehr als einem Design auch als Auswahl in `OPTIONS`, geprüft von `clampSettings`). Sie liegt in `settings`, wird mit dem Raum gespeichert (`rooms.json`) und mit jeder Ansicht an Spieler und Zuschauer gesendet. Unbekannte, manipulierte oder fehlende Werte ergeben `naval`; der Host ändert sie nur zwischen den Runden |
| Trennung von der Variante | Spielvarianten (`classic`, `salvo`) bleiben in `games/variants.js` und im Auswahlfeld „Spielvariante“; das Design ist eine eigene Auswahl. Alle vier Kombinationen laufen |
| Auswahl beim Erstellen | `createChoices` in `games/schiffe/index.js` → `gameList()` → Startseite (`public/variants.js`: `createChoicesHTML`, `createChoiceSettings`; Karten wie die UNO-Varianten). Erst ab zwei Designs sichtbar; Vorschaubilder sind Bildschirmfotos des echten Spiels |
| Client | `data-sv-skin` am Spielfeld (`#kg`) aus `S.settings.skin`; gemeinsame Zeichnung der Schiffe als absolut platzierte Ebene (`.sv-vessel`) über den Zellen, Stile je Design in `public/games/schiffe/schiffe.css`. Keine zusätzlichen Socket-Ereignisse, keine zweite Rendering-Logik |
| Geheimhaltung | Schiffsbilder im Zielsektor entstehen nur aus `sea.sunk` (versenkte Schiffe, öffentlich); das Bild eines Schiffs wird erst dann geladen. Das Modell hängt nur von Länge und Lage der Zellen ab. Gegnerflotte (Taktik-Konsole) zeigt nur „unbekannt“ oder „vernichtet“ aus den versenkten Schiffen. Der Skin steckt nicht in der Spielansicht (`gameView`), nur in den Einstellungen |
| Bewegung | Sinkbewegung (0,9 s, nur `transform` und `opacity`) läuft einmal je Schiff, auch über ein Neuzeichnen hinweg, nicht beim Laden oder Wiederverbinden; ausgeschaltet bei „Animationen aus“ und reduzierter Bewegung |

## Dateien

Neu: `games/schiffe/skins.js`, `public/games/schiffe/art/naval/` (10 WebP Kenney-Schiffe, `water.svg`, 3 Markierungen), `public/games/schiffe/art/space/` (16 Raumschiff-SVG, `stars.svg`, 3 Markierungen), `public/games/schiffe/art/preview-{naval,space}.webp`, `scripts/build-schiffe-space-art.mjs`, `scripts/capture-schiffe-skins.mjs`, `test/schiffe-skins.test.js`, `test/ui/art-schiffe.spec.js`, `docs/design/SCHIFFE_SKINS.md`, dieser Ordner.

Geändert: `games/schiffe/{index,room}.js`, `games/index.js` (reicht `createChoices` durch), `public/games/schiffe/schiffe.{js,css}`, `public/{hub.js,variants.js,variants.css}`, `test/art-roadmap.test.js` (Skin-Unterordner müssen jede Datei in der Lizenzliste haben), `test/ui/independent-player.js` (zusätzlich `view()`), `docs/design/ART_LICENSES.md`, Prüfsummen in `games/party-brett/source-audit.json` und `docs/roadmap/V2-13_V2-14_EVIDENCE.json` für die geänderten Dateien `games/index.js` und `public/hub.js` (wie bei früheren Änderungen), CHANGELOG, README, `docs/betrieb.md`, `package.json`, `package-lock.json`.

## Assets und Lizenz

- Kenney „Watercraft Pack“ (CC0): fünf Modelle, je waagerecht und senkrecht gerendert (Blender 4.5, Stahlton eingerechnet), insgesamt 97 KB; **je Ansicht werden nur die tatsächlich gezeichneten Bilder geladen**, in einer Lage und bei der Standardflotte etwa 48 KB (Budget 60 KB). Herkunft geprüft an `License.txt` im Originalpaket und an der Seite kenney.nl; Eintrag in [ART_LICENSES.md](../../ART_LICENSES.md).
- Alles Übrige sind eigene Zeichnungen: `naval/` (Wasserkachel, drei Markierungen) und `space/` (zusammen 20 KB, per Skript aus dem eigenen Entwurf erzeugt).
- Keine Schiffsmodelle, Logos, Schriften oder Oberflächen eines fremden Spiels. Der Name des Vorbilds der Taktik-Konsole steht nicht in der Oberfläche.

## Tests

| Prüfung | Ergebnis |
|---|---|
| `node --test test/schiffe-skins.test.js` – Skin-IDs und Rückfall, Raumeinstellung (ungültige, manipulierte Werte), Trennung von Variante, genau ein Spiel, Host-Rechte und Zeitpunkt, gleiche Spiellogik und Ansicht mit jedem Skin (classic und salvo), Geheimhaltung, Wiederherstellen alter Räume, Dateien und Größen; Server: Anlegen mit Skin und Variante, Zuschauer, ungültige Werte, zwei Räume mit verschiedenen Designs, Wiederverbinden und `rooms.json` | 13 Tests bestanden |
| `npx playwright test test/ui/art-schiffe.spec.js` (Desktop und Handy) – beide Designs mit klassischen Regeln und Salvo, Schiffsbilder genau auf den Zellen, Zielsektor ohne Schiffsbilder vor „versenkt“, Zuschauer, Neuladen, Sinkbewegung genau einmal, 1920×1080, 1440×900, 390×844, 360×800 ohne Überlauf, Nachbarspiel unverändert, Designauswahl, zwei Räume gleichzeitig, Flottenstatus, Gegnerflotte, Reiter und Zielerfassung der Taktik-Konsole, Bildrate | 34 bestanden, 4 übersprungen (die Größen des jeweils anderen Projekts), 0 fehlgeschlagen |
| bestehende Spezifikationen mit Schiffe versenken (`paeckchen10`, `visual-p1`, `ui-redesign`, `language`, jeweils `-g schiffe`), dazu `smoke`, `language`, `leave`, `game-flow` (Mühle) | 6 bzw. 58 bzw. 6 bestanden |
| `npm run test:fast` im Zustand eines Linux-Checkouts (LF, wie die CI) | 2025 Tests, 2022 bestanden, 0 fehlgeschlagen |
| GitHub Actions „Docker-Image“ für die drei Implementierungscommits | siehe Abschlussbericht (Läufe 189 und 190 erfolgreich) |

**Nicht ausgeführt:** die vollständige Playwright-Suite (`npm run test:ui` über alle Spiele), WebKit und Firefox, echte Telefone. Die Vollständigkeit der Spiellogik stützt sich auf die unveränderten Server-Tests (`test/schiffe.test.js` und weitere), die weiterhin laufen.

**Bekannt:** Auf einem Windows-Checkout mit CRLF schlagen zwei bestehende Tests fehl (`game-art-roadmap.json …` und `game-experience-roadmap.json … aus der Markdown-Quelle erzeugt und aktuell`); das war schon vor diesen Änderungen so (geprüft an `586de95`) und betrifft nicht ART-013. Im LF-Checkout laufen sie durch.

## Abnahme (Grafik-Roadmap, Leitplanken)

| Kriterium | Ergebnis |
|---|---|
| Lizenz: nur freie Quellen, jede Datei in der Liste | Kenney CC0, alles andere eigen; `test/art-roadmap.test.js` prüft jede Datei unter `public/games/schiffe/art/` |
| Keine Marken | siehe [SCHIFFE_SKINS.md](../../SCHIFFE_SKINS.md) |
| Spiellogik unverändert, nichts Verdecktes | Tests oben; Serverlogik in `games/schiffe/room.js` nur um die Einstellung ergänzt |
| Skins austauschbar | `skins.js` und `data-sv-skin`; ein weiteres Design braucht einen Eintrag, Grafiken und Stile |
| Performance: Bilder klein, nur `transform`/`opacity` | 97 KB Kenney (typisch 48 KB je Ansicht), 20 KB Raumschiffe; Bewegungen nur `transform`/`opacity` |
| Bildrate mit neuer Optik mindestens 90 % der Bildrate ohne, 4× gedrosselte CPU | `fps-naval-*.json`, `fps-space-*.json`: Verhältnis 0,997 bis 1,084 (Desktop und Handy, beide Designs); gemessen im Gefecht ohne Schuss. Ein zuerst eingebauter drehender Radarschwenk erreichte nur 0,34 und wurde entfernt |
| Lesbarkeit: nie nur Farbe | Treffer = Stern, Wasser = Ring, versenkt = Schraffur und Wrack, Ziel = Klammern; Tests prüfen die Marken |
| Handy 390 px | Zellen 28–31 px (Entwurf: 32 px); Tests für 390×844 und 360×800 |

## Nachweisbilder

Alle aus dem laufenden Spiel (`node scripts/capture-schiffe-skins.mjs`), nicht aus Entwürfen.

| Bild | Inhalt |
|---|---|
| `designauswahl-desktop.webp`, `designauswahl-mobil.webp` | Design-Auswahl beim Erstellen |
| `naval-desktop-classic.webp`, `naval-desktop-salvo.webp`, `naval-mobil-classic.webp`, `naval-mobil-salvo.webp` | Klassisch |
| `space-desktop-classic.webp`, `space-desktop-salvo.webp`, `space-mobil-classic.webp`, `space-mobil-salvo.webp` | Taktik-Konsole |
| `fps-naval-desktop.json`, `fps-naval-mobil.json`, `fps-space-desktop.json`, `fps-space-mobil.json` | Bildrate mit und ohne Optik |

## Bewusst offen

- Auf dem Handy sind die Zellen 28–31 px groß, der Entwurf nennt 32 px; die Tippfläche ist quadratisch statt wie vorher 44 px hoch.
- „Dein Meer“ und „Meer von …“ sind in der englischen Oberfläche weiterhin deutsch (bestand schon vorher); die neuen Texte der Taktik-Konsole sind übersetzt.
- Die Taktik-Konsole hat keine eigenen Klänge (das wäre EXP-013) und kein Feinjustieren, kein zweistufiges Zielen am Desktop und keine taktischen Hinweise (neue Funktionen, siehe Gestaltungsdatei).
- Der Anzeigename „Taktik-Konsole“ ersetzt den im Auftrag genannten Namen des Vorbilds; die Namensverwendung ist nicht geklärt.
