# Themenwelten (TW)

Stand: 15. November 2026. Technische Grundsätze: [THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md). Prüfliste je Welt: [THEME_QUALITY_CHECKLIST.md](THEME_QUALITY_CHECKLIST.md). Herkunft aller Dateien: [ART_LICENSES.md](ART_LICENSES.md).

> **Herkunft dieses Dokuments:** Das ursprüngliche Konzept mit TW-01 bis TW-16 und der Entwurf `docs/design/drafts/ART-046-mythos-weltkonzept.md` lagen bei der Umsetzung nicht vor (weder im Repository noch im Vault). Mit Freigabe des Projektinhabers wurde TW-01 aus dem Auftragstext neu gestaltet; Palette, Namen und Grafiken unten sind dieser eigene Entwurf. TW-02 bis TW-16 sind hier nicht beschrieben und werden ergänzt, sobald das Konzept vorliegt. Jede weitere Welt braucht eine eigene Freigabe.

## TW-01 · Schatten über Neuengland (ART-W1, Monopoly)

| | |
|---|---|
| Spiel | `monopoly` – Standard und Tempowürfel; **nicht** Junior (eigenes 24-Felder-Brett) und **nicht** Monopoly Deal (gesonderte Freigabe) |
| Registry | `public/games/theme-worlds/registry.js`, Daten und Texte in `public/games/theme-worlds/tw-01.js`, Art `board` |
| Auswahl | Host-Menü → „Themenwelt“, gilt für alle am Tisch, auch mitten in der Runde; „Standard“ stellt die bisherige Optik vollständig wieder her |
| Status | umgesetzt in Version 3.13.0 |

### Idee

Eine erfundene neblige Hafenstadt an einer nordamerikanischen Küste der 1920er-Jahre: Leuchtturm auf der Klippe, Lagerhäuser und Fischergassen, Messing, dunkles Leder und Pergament, alte Bücher und Archive. Das Unheimliche bleibt Andeutung (Nebel, ein Licht in der Nacht, Schritte, ein Brief ohne Absender). Keine Monster, keine Kultsymbole, keine Figuren, Orte oder Begriffe aus fremden Werken oder Spielen (insbesondere keine Namen wie Arkham, Innsmouth, Miskatonic, Dunwich, Cthulhu, Necronomicon oder „Elder Sign“; per Test geprüft).

### Palette

| Rolle | Farbe |
|---|---|
| Nacht, Meer | `#1b2a33`, `#2f4550`, Tisch `#11191e` |
| Messing | `#c8a462`, dunkel `#8c6a33` |
| Papier (Felder, Karten) | `#e6dcc3` → `#d9cdb0`, Schrift `#1d1a15` (Kontrast ≥ 4,5 : 1, im Test gemessen) |
| Akzent Leuchtturm | `#7a2a24`, Licht `#ffe7a3` |
| Bezirke (Reihenfolge wie Standard) | Braun `#6b4a33`, Hellblau `#79a9bd`, Pink `#a8567a`, Orange `#c27a36`, Rot `#9b3328`, Gelb `#cfa93a`, Grün `#3e6a4a`, Dunkelblau `#2c4f7a` |

Schrift: Georgia bzw. die Serifenschrift des Systems (keine fremde Schriftdatei).

### Gestaltung

| Element | Umsetzung |
|---|---|
| Tisch | dunkle Hafenplanken (`table.svg`, Kachel) |
| Brett | Messingrahmen, Felder auf verwittertem Papier, Bezirksbänder in der Palette; Bahnhöfe als Gleisband, Werke in Messing, Ereignis- und Gemeinschaftsfelder mit Kartenrücken |
| Brettmitte | Hafen bei Nacht mit Leuchtturm (`center.svg`), Titel und Status auf dunkler Tafel; langsamer Nebel und schwenkendes Leuchtfeuer (CSS, entfällt bei reduzierter Bewegung) |
| Karten | Rücken aus Leder mit Messingrahmen, Kompassrose und Leuchtturm (`card-back.svg`); Kartentext auf Pergament |
| Figuren | acht Messingfiguren auf dem Farbring des Spielers: Laterne, Kompass, Rabe, Anker, Taschenuhr, Schlüssel, Fernrohr, Schwarze Katze (gleiche Token-IDs wie bisher) |
| Gebäude | Fischerhütten für 1–4 Häuser (Anzahl sichtbar), Leuchtturm für das Hotel |
| Ton | keiner (optional, nicht umgesetzt) |

### Texte (nur Darstellung)

Alle 40 Feldnamen, 16 Ereignis- („Seltsame Begebenheit“) und 16 Gemeinschaftskarten („Kirchenkasse“) sowie acht Figurennamen stehen in `tw-01.js`. Reihenfolge, Preise, Mieten, Kartenwirkungen, Handel, Würfel, Siegbedingungen, Socket-Ereignisse und Spiel-IDs bleiben unverändert; jeder Kartentext nennt dieselben Beträge und Ziele wie die Standardkarte (per Test geprüft). Der Server löst die Namen auf; Rangfolge: eigenes Brett (28 Grundstücke) → Themenwelt → Monopoly-Theme → Standard. Beim Standardbrett zeigt die Brettmitte den Weltnamen, eigene Bretter behalten ihren Titel.

### Grenzen

- Die private ART-046-Szenenvorschau ist davon unberührt; TW-01 gestaltet den vorhandenen Brett-Renderer.
- Besitzkarten (Dialog) behalten die Gruppenfarben des Standards im Kopf; nur Papier und Rahmen ändern sich.
- Fehlt eine Weltdatei, gilt die Standardoptik; die Namen kommen weiterhin vom Server (für alle gleich).
- Nachweise: [docs/design/art/ART-W1/](art/ART-W1/), Tests `test/art-w1-tw01.test.js`, `test/ui/art-w1-tw01.spec.js`.
