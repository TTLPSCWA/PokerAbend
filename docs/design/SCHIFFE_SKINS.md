# Schiffe versenken – Designs (Skins)

Stand: 14.11.2026 (Version 3.3.0 bis 3.4.1). Diese Datei beschreibt das **Design**: woher es stammt, was übernommen wurde und was nicht. Die technische Umsetzung, die Tests und die Nachweise stehen getrennt in [art/ART-013/README.md](art/ART-013/README.md).

## Ein Spiel, zwei Designs

Es gibt genau ein Spiel `schiffe` („Schiffe versenken“). Ein Design (Skin) ändert nur das **Aussehen**: Regeln, Flotten, Spielvarianten (`classic`, `salvo`), Timer, Punkte und Statistiken bleiben unberührt. Der Host wählt das Design beim Erstellen des Tisches; es gilt für alle Spieler und Zuschauer dieses Tisches.

| Skin-ID | Anzeigename | Rolle | Quelle der Gestaltung |
|---|---|---|---|
| `naval` | Klassisch | Standard (ersetzt die frühere Blockoptik) | Entwurf „Design C“ (Seekarte mit Kenney-Schiffen im Stahlton) |
| `space` | Taktik-Konsole | zusätzlich wählbar | Entwurf „Schiffe versenken · Taktik-Konsole“ (Sci-Fi-Konsole mit eigenen Raumschiffen) |

Skin und Spielvariante sind getrennt wählbar; alle vier Kombinationen sind möglich.

## Design „Klassisch“ (`naval`)

**Quelle:** Entwurfsordner „ART-013-Kenney-Vergleich“ im privaten Vault. Ausgewählt war dort Richtung C (Seekarte, Feldzustände, Bewegungen aus dem ART-013-Konzept, Schiffe als Kenney-Renderings im Stahlton). Die Renderings v2 (je Schiff waagerecht und senkrecht, Schatten fest nach unten rechts) sind unverändert übernommen.

Übernommen:
- dunkle Seekarte mit goldenem Rahmen und Ecknieten, Wasser mit Wellenkachel und feinem Raster, Beschriftung A–J und 1–10
- fünf Schiffsmodelle von oben (Passregel aus dem Entwurf: Länge N − 0,1 Felder, Breite höchstens 0,96 Zeilen, 22 % Rand für den Schatten): 5 = Ozeandampfer, 4 = kleiner Ozeandampfer, 3 = Frachter A und B (nach Lage der Zellen abwechselnd), 2 = Schlepper
- Feldzustände mit eigener Form (nicht nur Farbe): Wasser = Ring mit Punkt, Treffer = orangener Stern, versenkt = dunkles Wrack unter schraffiertem Feld, gewähltes Ziel = Zielmarke
- Sinkbewegung (rund 0,9 s, nur `transform` und `opacity`) beim Versenken; ohne Bewegung bei „Animationen aus“ und reduzierter Bewegung
- Flottenliste beim Setzen mit den Schiffsbildern

Abweichungen vom Entwurf (bewusst, wegen der neuen Vorgabe):
- Im Entwurf waren eigene SVG-Schiffe der Standard und die Kenney-Bilder ein Skin, den jeder Spieler **lokal** wählt. Jetzt sind die Kenney-Bilder der Standard, und das Design ist eine **Raumeinstellung des Hosts**.
- Die Zellen sind quadratisch (auf dem Handy 28–31 px). Der Entwurf nennt 32 px bei 390 px Breite.
- Die im Entwurf gezeigten Sonderansichten „Zielmeer-Ausschnitt“ und „Kleinkarte (11 px)“ gibt es nicht; das Spiel zeigt beide Meere vollständig (das eigene klein, das Zielmeer groß).
- Das Wrack entsteht wie im Entwurf aus dem Schiffsbild selbst (Graustufen, abgedunkelt, leicht gekippt), nicht aus einem eigenen Modell; ein Wrackmodell gibt es bei Kenney nicht.

Nicht übernommen: die eigenen SVG-Kriegsschiffe des Entwurfs („Standard (SVG)“) – sie werden durch das Kenney-Design ersetzt und nicht ausgeliefert.

## Design „Taktik-Konsole“ (`space`)

**Quelle:** Entwurfsordner „ART-013-schiffe-versenken-star-citizen“ im privaten Vault (Konzept „Schiffe versenken · Taktik-Konsole“, drei SVG-Mockups, Notizen zu Assets, Technik, Lizenz, Abnahme). Es gibt dort **keine Render-Prototypen und keine Blender-Quellen**, nur die Mockups; entschieden ist nur die Richtung, eine Fassung C o. ä. gibt es für dieses Design nicht.

Übernommen:
- Weltraum-Spielfeld: dunkler Grund mit Sternen, Sektoren mit Radarringen, Fadenkreuz, Scanlinien und ein fester Radarkegel im Zielsektor
- die fünf Raumschiffformen des Entwurfs in Draufsicht (Träger 5, Schlachtkreuzer 4, Fregatte 3, Korvette 3, Jäger 2), waagerecht und senkrecht, dazu je eine rote Wrackfassung; die Zeichnungen sind Koordinate für Koordinate aus den Mockups übertragen
- Zellzustände: unbekannt (Scanlinien), Fehlschuss (cyanfarbener Ring), Treffer (bernsteinfarbener Stern mit Glut), versenkt (rotes Wrack, roter Rahmen), Ziel erfasst (Klammern und Ring, 0,6 s; der Entwurf zeigt vier Stufen, hier läuft sie als eine Bewegung)
- Eigener Sektor und Zielsektor, Flottenstatus mit Rumpfintegrität (Sektionen), Gegnerflotte („Position unbekannt“ / „VERNICHTET“), Gefechtsprotokoll, Reiter „Zielsektor / Eigene Flotte“ auf dem Handy

Abweichungen vom Entwurf:
- **Radarschwenk:** Der Entwurf sieht einen dauerhaft langsamen Schwenk vor. Er war zuerst eingebaut und wurde wieder entfernt: Im Bildraten-Test kostete die Drehung etwa das Dreifache an Bildzeit (75 gegen 239 FPS bei 4× gedrosselter CPU). Der Kegel steht jetzt fest.
- **Zielen:** Der Entwurf sieht überall zweistufiges Zielen vor (erfassen, dann FEUER). Das wäre eine neue Eingabe am Desktop. Es bleibt bei der bestehenden Bedienung: Maus = ein Klick schießt, Touch = Feld wählen, dann „Feuer“. Die Zielerfassung (Klammern, 0,6 s) wird auf den vorhandenen Zielzustand angewendet.
- Weggelassen: „feinjustieren“ mit Pfeiltasten und die taktischen Hinweise („Nachbar von zwei Treffern“) – beides wären neue Funktionen.
- Die Klassennamen sind nur Anzeigenamen. Meldungen des Servers („Flugzeugträger versenkt“) und die Regeln nennen weiter die Regelnamen.
- Die Kopfzeile „SCHIFFE VERSENKEN · TAKTIK-KONSOLE“ des Mockups entspricht der Tischleiste des Spiels; sie wurde nicht nachgebaut.

## Name und Marken

Das Konzept ist von der Stimmung eines bekannten Weltraumspiels angeregt (dunkle Cockpit- und Radaroptik, holografische Linien, Bernstein für Warnungen). Übernommen wurden **keine** Schiffsmodelle, Logos, Schriftzüge, Oberflächen oder Texturen dieses Spiels; alle Raumschiffe sind eigene Zeichnungen aus dem Entwurf. Nach der Projektregel (Vorbilder stehen nur in der Dokumentation, nie in der Oberfläche; siehe [CARD_WORLDS.md](CARD_WORLDS.md)) und weil die markenrechtliche Prüfung für eine öffentliche Seite nicht abgeschlossen ist, steht der **Name des Vorbilds nicht in der Oberfläche**. Der Anzeigename ist „Taktik-Konsole“ (der Titel des Entwurfs). Er steht an genau einer Stelle (`games/schiffe/skins.js`) und lässt sich bei Bedarf ändern.

## Lizenzen

Alle Dateien stehen in [ART_LICENSES.md](ART_LICENSES.md): die Kenney-Schiffe (CC0, `License.txt` des Originalpakets und kenney.nl geprüft) mit Bearbeitungsvermerk, alle übrigen Grafiken sind eigene Zeichnungen oder Bildschirmfotos des Spiels.
