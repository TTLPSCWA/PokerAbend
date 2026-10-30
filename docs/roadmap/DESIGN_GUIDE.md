# Freigegebene Designrichtung: Minimal Liquid Glass
## Referenz
Die ausgewählte visuelle Richtung ist ein ruhiger, eleganter Spieleabend-Hub mit einer **einzigen** atmosphärischen Hintergrundgestaltung und reduziertem Liquid-Glass-UI. Die Basis ist bereits auf `main` umgesetzt (`aa25517`, `docs/ui-redesign.md`). V2-06 plant ausschließlich die spätere Integration neuer Konto-/Profiloberflächen in dieses Design. Keine neue Designimplementierung ist durch dieses Dokument freigegeben.

`design/referenz-game-library.png` ist eine Konzeptvorlage, **kein** Website-Asset. Ein separat freigegebenes Foto liegt nicht vor; der fertige CSS-Fallback bleibt erhalten. Ein späteres Foto ist optional und benötigt eigene Nutzungsrechte.

## Positiv
- Dunkles Grün/Anthrazit, smaragdgrüne Hauptaktionen, gedämpfte warme Highlights und sparsam Gold für kleine Markierungen.
- Dezente Milchglas-/Transparenzflächen und leichte Unschärfe **nur** bei Bedarf und mit Fallback.
- Luftige Typografie, klare Hierarchie, große ruhige Flächen, wenige prominente Aktionen.
- Kategorien (Karten, Würfel, Brett, Party) als **minimalistische Kacheln mit Icon und Text**.
- Spielkacheln ohne eigene Fotohintergründe; maximal ein kleines spielbezogenes Icon/Motiv.
- Startseite mit relevanten echten Live-Tischen, Favoriten und ggf. echten Top-Spielern; keine fiktiven Inhalte.
- Desktop, iPhone Safari, reduzierter Kontrast-/Transparenzmodus, prefers-reduced-motion.

## Explizit NICHT gewünscht
- Keine Vielzahl großer Hintergrundbilder auf Hero, Kategorien UND einzelnen Spielkacheln.
- Keine optische Überladung durch Goldornamente, Leuchten, Rahmen, Schatten und permanente Animationen.
- Keine 3D-Perspektiv-/Orbit-Funktionen; keine Freundeslisten.
- Keine Nachbildung von geschützten Logos/Kartendesigns und keine unerlaubten Originalgrafiken.

## Referenz-Dateien im Code
`public/style.css`, `public/ui-theme.css`, `public/ui-theme.js`, `public/hub.css`, `public/hub.js`, `public/game-design.js`, `public/game-design.css`; CSS-Infrastruktur wiederverwenden statt zweites UI-Framework einzubauen.
