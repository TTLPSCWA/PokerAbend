# EXP-087 · Doppelkopf

Implementierung: `2bd9fc71f8ca21b463e31a184c19e4353e729126`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Vereinsheim: getäfelte Wand mit Wimpel-Leiste hinter dem Tisch, Rundenzettel mit der Stich-Nummer. |
| Figuren & Material | Re- und Kontra-Aufsteller an jedem Platz (hell für Re, blau für Kontra, „?“ solange offen). Gefangene Füchse als eigene Fuchs-Plakette. |
| Klang | Palette `doppelkopf`: „Re!“ als kurzer, aufsteigender Messington, „Kontra!“ als tieferer Gegenton, Jagdhorn beim gefangenen Fuchs (alle erzeugt), Karten und Stich wie gewohnt. |
| Animation | Wird eine Partei bekannt, dreht sich ihr Aufsteller um. Fertige Stiche gleiten zum Gewinnerplatz. Füchse springen im Bogen vom Platz ihres Spielers zum Stich-Gewinner. |
| Highlight | Doppelkopf (mindestens 40 Augen im Stich): Der Stich leuchtet und bekommt die Plakette „Doko!“, erst dann wandert er zum Gewinner. |

Spiellogik unverändert.

## Geheimnisse

Die Aufsteller zeigen nur Parteien, die der Server öffentlich nennt (`known`: Ansagen, gespielte Kreuz-Dame, Solo, Hochzeit). Das Jagdhorn erklingt nur, wenn beide Parteien schon öffentlich und verschieden sind; sonst springt der Fuchs still. Die eigene Partei steht wie bisher nur im eigenen Hinweis.

## Abweichungen

- Das Kartenblatt ist das gemeinsame Blatt aller Kartenspiele (mit den doppelten Karten des Servers) und bleibt unverändert.
- Ein Fuchs zählt als „gefangen“ für das Jagdhorn erst, wenn die Parteien öffentlich sind; die Wertung „Fuchs gefangen“ selbst macht weiter der Server.

## Prüfungen

- `test/ui/exp-doppelkopf.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit drei Bots: echtes Spiel mit „gesund“, eigener Ansage (Messington) und erstem Stich (gleitet zum Gewinner); Aufsteller zeigen genau die öffentlich bekannten Parteien; Fuchs mit Jagdhorn und „Doko!“ über den Darstellungs-Hook bei angehaltenem Spiel; nur `transform`/`opacity`, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau, `expectNoLeak`.
- `test/experience-doppelkopf.test.js`: 3 Tests. `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 197 | 3399.7 ms | 57.65 | ≥ 45 |
| Mobilansicht | 196 | 3316.4 ms | 58.8 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Vereinsheim mit Aufstellern: [Desktop](vereinsheim-desktop.png), [Mobilansicht](vereinsheim-mobil.png)
- Doko! (bei angehaltenem Spiel aufgenommen): [Desktop](doko-desktop.png), [Mobilansicht](doko-mobil.png)
