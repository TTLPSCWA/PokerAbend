# Freigegebene Designrichtung: Minimal Liquid Glass
## Referenz
Die zuletzt ausgewählte visuelle Richtung ist ein ruhiger, eleganter Spieleabend-Hub mit einem **einzigen** warmen, leicht unscharfen Spielezimmer-Hintergrund und reduziertem iOS-Liquid-Glass-inspiriertem UI. Ein früheres Bild ist nur eine Konzeptvorlage, **kein** fertiges Website-Asset.

## Positiv
- Dunkles Grün/Anthrazit, gedämpfte warme Highlights und sparsam Gold als Aktionsakzent.
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
`public/style.css`, `public/hub.css`, `public/hub.js`, `public/game-design.js`, `public/game-design.css`; CSS-Infrastruktur wiederverwenden statt zweites UI-Framework einzubauen.
