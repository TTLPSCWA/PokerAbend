# EXP-086 · Skat

Implementierung: `c75be3754ec5ab219e5fa6b8417aedbeffa95705`, 10.11.2026.

## Umgesetzt

| Bereich | Umsetzung |
|---|---|
| Welt | Gute Stube: Holzvertäfelung (Eckbank-Bretter) hinter dem Tisch, Stammtisch-Schild über der Tischmitte, Zigarrenkiste (ohne Zigarren) als Skat-Ablage. |
| Figuren & Material | Reizblock aus Papier mit Linien, handschriftlichem Gebot und Bleistift. |
| Klang | Palette `skat`: fester Knöchelklopfer beim Ausspielen von Trumpf, Bleistiftkratzen bei jedem Gebot oder Passen (erzeugt), Rascheln beim Skat-Aufnehmen, Kartenschieben beim Stich, dreimaliges Stammtisch-Klopfen (erzeugt). |
| Animation | Skat-Aufnehmen: Die beiden Rücken kippen um und gleiten zur Hand. Drücken: zwei Karten gleiten zurück in die Kiste. Ein fertiger Stich wird zum Platz des Gewinners geschoben. |
| Highlight | Grand Hand: Auf dem Reizblock steht groß „Grand Hand“, der Stammtisch klopft dreimal, das Schild wackelt mit. Ein Zettel „Grand Hand“ bleibt die ganze Runde am Tisch. |

Spiellogik unverändert.

## Geheimnisse

Der Skat bleibt verdeckt (nur Rücken), fremde Hände kennt die Ansicht nicht. Die Trumpf-Erkennung nutzt nur ausgespielte Karten und das angesagte Spiel.

## Abweichungen

- Das Kartenblatt (französisch/deutsch, umschaltbar unter „Ich“) ist das gemeinsame Blatt aller Kartenspiele und bleibt unverändert; ein eigenes Turnierblatt nur für Skat würde die Umschaltung brechen.
- Folgt der nächste Bot-Zug sehr schnell, löst er den großen Schriftzug ab; der Zettel am Tisch bleibt.

## Prüfungen

- `test/ui/exp-skat.spec.js`: **4 bestanden** (Desktop und Mobilansicht) mit zwei Bots: echtes Reizen mit Bleistift, echtes Spiel bis zum ersten Stich (gleitet zum Gewinner), Trumpf-Klopfen und Grand Hand über den Darstellungs-Hook bei angehaltenem Spiel; nur `transform`/`opacity`, „Animationen reduzieren“, Neuladen und Zuschauen ohne Rückstau, Skat nicht im Zustand, `expectNoLeak`.
- `test/experience-skat.test.js`: 3 Tests, Trumpf gegen `games/skat/rules.js` geprüft. `npm run test:fast`: bestanden.

## Bewegungsbudget (4× gedrosselte CPU)

| Ansicht | Frames | Dauer | FPS | Budget |
|---|---:|---:|---:|---:|
| Desktop | 170 | 2933.1 ms | 57.62 | ≥ 45 |
| Mobilansicht | 172 | 3033.1 ms | 56.38 | ≥ 50 |

Messdateien: [Desktop](fps-desktop.json), [Mobilansicht](fps-mobil.json).

## Bilder

- Reizblock: [Desktop](reizblock-desktop.png), [Mobilansicht](reizblock-mobil.png)
- Grand Hand (bei angehaltenem Spiel aufgenommen): [Desktop](grandhand-desktop.png), [Mobilansicht](grandhand-mobil.png)
