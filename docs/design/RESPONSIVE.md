# B24 – Adaptive Responsive UI

Stand: 2026-11-23 · Paket B24 (Aufgaben-Roadmap im Vault) · Version **3.26.0** · Basis `a82c6f9` (3.25.1 mit B04-Tests)

Die Seite passt sich an die **tatsächlich verfügbare Fläche** an: Fenstergröße, Seitenverhältnis, Zoom, Ausrichtung und Bildschirmtastatur. Die physische Monitorgröße spielt keine Rolle. Spiellogik, Socket-Protokolle, Rechte und Spielstände bleiben unverändert; B24 ändert ausschließlich Darstellung und Bedienbarkeit.

## Architektur

B24 führt **kein zweites UI-System** ein. Es ergänzt die bestehenden Schichten (`style.css` → `hub.css` → `ui-theme.css` → Spiel-CSS) um eine schlanke gemeinsame Schicht und um eng begrenzte Korrekturen in gemeinsamen Renderern.

| Baustein | Datei | Aufgabe |
| --- | --- | --- |
| Gemeinsame Layoutschicht | `public/responsive.css` | Stufen, Tokens (`--rs-*`), Dialogschutz, Navigation auf kleinsten Geräten, Lobby- und Dock-Scrollen, Karten- und Würfelgrößen auf großen Monitoren, Rundtisch auf Ultrawide. Als **letztes globales Stylesheet** geladen; Spiel-CSS wird später nachgeladen und behält Vorrang. |
| Laufzeithilfe | `public/responsive.js` | **Ein** pro Bildschirmbild gedrosselter Größentakt für die ganze Seite (`Responsive.onResize`, `onChange`), Größenklasse und Ausrichtung als `data-rs-size`/`data-rs-orient` am `<html>`, sichtbare Höhe `--rs-vvh` und Tastaturhöhe `--rs-kb` aus `visualViewport`, **ein** gemeinsamer `ResizeObserver` (`Responsive.observe`). Keine Listener pro Karte oder Feld. |
| Gemeinsame Renderer | `public/game-design.css`, `public/games/world-kit.css`, `public/games/card-worlds.css` | Querformat-Tischlayout ab 520 px statt 641 px; schlanker Spielwelt-Kopf auf niedrigen Handys; breitere Bühne auf großen Monitoren. |
| Spielspezifisch | `public/games/<spiel>/<spiel>.css` | Nur dort, wo ein Spiel eigene feste Maße hat (siehe unten). |

### Stufen

Gleich in CSS und `responsive.js`; die vorhandenen Grenzen 640 px und 1100 px bleiben gültig.

| Stufe | Breite (CSS-Pixel) | Typisch |
| --- | --- | --- |
| `xs` | < 375 | kleine Smartphones (320 × 568) |
| `s` | 375–640 | Smartphones |
| `m` | 641–1099 | Tablets, kleine Fenster |
| `l` | 1100–1799 | Laptop bis Full HD |
| `xl` | 1800–2999 | QHD, große Monitore |
| `xxl` | ≥ 3000 | Ultrawide, Super-Ultrawide |

Zusätzlich wirken Höhen- und Seitenverhältnis-Bedingungen: `max-height: 480–700px` (Handy quer, 200 % Zoom, kleine Handys), `min-aspect-ratio: 2/1` (Ultrawide).

### Regeln für Erweiterungen (auch für B22)

- Neue Größenlogik zuerst in CSS. JavaScript nur, wenn ein Renderer echte Containermaße braucht, dann über `Responsive.observe(el, fn)` oder `Responsive.onResize(fn)`, nie über eigene `resize`-Listener.
- Gemeinsame Regeln gehören in `responsive.css`, mit niedriger Spezifität (`:where()` oder Klassenselektor), damit Spiel-CSS sie überschreiben kann. Spielspezifisches bleibt in der Spieldatei.
- Für das spätere Refactoring B22 ist die Schicht bewusst entkoppelt: Sie hängt nur an stabilen Klassen des Spiel-Kits (`.kg`, `.kg-main`, `.kg-dock`, `.kg-dock-in`, `.kc`, `.die`, `.wk-*`) und am Hub (`.hub-*`). Bleiben diese Namen erhalten oder werden sie gemeinsam umbenannt, funktioniert B24 unverändert.

## Was B24 konkret ändert

### Fundament (B24-A)

- Dialoge ohne eigene Größe passen immer in den sichtbaren Bereich und scrollen innen (`:where(dialog[open]:modal)`, Spezifität 0). Host-Panel und `.dlg` behalten ihre Regeln.
- Hub unter 375 px: Roadmap, Tickets und Einstellungen verlassen die untere Leiste (sie stehen vollständig im ☰-Menü); der aktive Bereich bleibt sichtbar; kein Worttrennen mehr in Tab-Beschriftungen; Schriftzug und Sprachwahl überlappen nicht mehr.
- Blockköpfe der Startseite („Alle Tische →“) brechen um statt die Seite zu verbreitern (vorher 13 px Überbreite bei 320 px). Auf Touch-Geräten bekommen diese Textlinks eine 44-px-Trefferfläche.
- Lobbys scrollen immer, auch in Spielen mit gesperrter Spielfläche; `safe center` verhindert unerreichbaren Inhalt oberhalb.
- Aktionsleiste (`.kg-dock`) scrollt in sich, sobald sie mehr als 62 % der Höhe bräuchte (Kartenbedienung weiter 48 %).

### Pilotspiele (B24-B)

- *Poker (Texas Hold'em):* Neuzeichnen beim Größenwechsel über den gedrosselten Takt statt bei jedem `resize`-Ereignis; Handstärke schrumpft statt abgeschnitten zu werden; auf niedrigen Handys kompakteres Dock (Chancen im Hände-Panel, unter 600 px Höhe ohne Schnelleinsätze – Regler und Zahlenfeld bleiben); flaches Querformat unter 641 px mit Tisch links und Aktionen rechts; auf QHD/Ultrawide wachsen Tisch (bis 1700 px), Plätze und Karten, die Aktionen rücken zur Mitte.
- *Mau-Mau (Kartenspiel):* über das gemeinsame Querformat-Layout und die Dock-Regeln; auf Ultrawide größere Karten und zusammengerückter Rundtisch.
- *Vier gewinnt (Brett):* unter 375 px passen die sieben Spalten (vorher Spalte 6 und 7 abgeschnitten); Steine bleiben kreisrund.
- *Kniffel (Würfel), Schätzmeister (Party), Spielhalle (Idle), 2048 (Solo):* in allen Viewports ohne Befund; geprüft in `responsive.spec.js`.

### Integration (B24-C)

- Querformat-Tischlayout ab 520 px in `game-design.css` und den abhängigen Spielregeln (Kartenwelten, Farbenchaos, Scotland Yard, Stapelrennen, Zehn Etappen); Navigationssymbole bleiben darin sichtbar.
- Spielwelt-Bühne (`world-kit.css`, 29 Spiele): schlanker Kopf auf niedrigen Handys, breitere Bühne auf großen Monitoren.
- Monopoly und Spiel des Lebens: Spielfläche scrollt bei wenig Höhe, statt Werkzeugleiste und Landschaft abzuschneiden.
- Karten (`.kc`) und Würfel (`.die`) skalieren ab 1800 × 1000 mit der kürzeren Bildschirmseite; der Dockinhalt bleibt höchstens 1800 px breit und mittig.

## Unterstützte Viewports und Testmatrix

| Gerätetyp | Viewport | Hub | Lobby | Partie (95 Spiele) | Solo (12) | Idle (3) |
| --- | --- | --- | --- | --- | --- | --- |
| Kleines Smartphone | 320 × 568 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Smartphone | 390 × 844 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tablet hoch | 768 × 1024 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tablet quer | 1024 × 768 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kleiner Laptop | 1280 × 720 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Full HD | 1920 × 1080 | ✓ | ✓ | ✓ | ✓ | ✓ |
| QHD | 2560 × 1440 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ultrawide | 3440 × 1440 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Super-Ultrawide | 5120 × 1440 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 200 % Zoom auf 1280 × 720 | 640 × 360 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 200 % Zoom auf 1920 × 1080 | 960 × 540 | ✓ | ✓ | ✓ | ✓ | ✓ |

✓ = automatisch gemessen ohne Befund (Ausnahmen unter „Bekannte Sonderfälle“). Gemessen werden je Viewport: horizontaler Seiten-Overflow, abgeschnittene Bedienelemente (mit Ursache), dauerhaft verdeckte Bedienelemente, unerreichbare Elemente in fixierten Ebenen und leere Knöpfe. Jede Partie wird **einmal** gestartet und dann durch alle Viewports gezogen; danach wird geprüft, dass die Seite nicht neu geladen wurde und Raum, Identität und Spiel erhalten sind.

### Werkzeuge

| Prüfung | Datei | Wann |
| --- | --- | --- |
| Messfunktion und Viewport-Liste | `test/ui/responsive-measure.js` | gemeinsam genutzt |
| Regression (Pilotspiele Poker, Mau-Mau, UNO, Vier gewinnt, Schach, Kniffel, Schätzmeister; Hub, Dialoge, Navigation, lange Namen/Englisch, Solo 2048, Spielhalle, Studio, Factory, Tastatur und Touch, Spielerzahlen 2–4) | `test/ui/responsive.spec.js` | jeder Browser-Lauf (nachts in der CI, Chrome) |
| Barrierefreiheit (Tastaturfokus, Touchziele, Safe Areas, Bildschirmtastatur und dynamische Höhe, vergrößerte Standardschrift) | `test/ui/b24-a11y.spec.js` | jeder Browser-Lauf (Chrome); Schrift nur im Firefox-Projekt |
| Browserübergreifend: Regression und Barrierefreiheit in Firefox, WebKit, WebKit mit Touch, Firefox mit 24-px-Standardschrift | `test/ui/b24-browsers.config.js` | manuell: `npx playwright test -c test/ui/b24-browsers.config.js` |
| Gesamt-Audit aller Oberflächen mit Screenshots | `test/ui/b24-responsive-audit.spec.js` | manuell: `B24_AUDIT=1 B24_RUN=<name> npx playwright test test/ui/b24-responsive-audit.spec.js --project=desktop --workers=4` → `artifacts/b24/<name>/` |

Optionen des Audits: `B24_GAMES=id1,id2` (Auswahl), `B24_SHOTS=320x568,…` (Screenshot-Größen).

## Ergebnisse

### Messung vorher/nachher

Gleiche Messung (`responsive-measure.js`) auf beiden Ständen, 111 Oberflächen × 11 Viewports, Chrome, eine Partie je Spiel mit Bots bzw. drei menschlichen Teilnehmern (Partyspiele, die keine Bots zulassen).

| | Vorher (`f97b486`, 3.25.1) | Nachher (B24) |
| --- | --- | --- |
| Oberflächen mit Befund | **16** | **0** |
| Seiten-Overflow | Startseite bei 320 px (333 px breit) | keiner |
| Abgeschnittene Bedienelemente | Poker 320 px und 200 % Zoom, alle Poker-Varianten bei 200 % Zoom, Skat, Doppelkopf, Mau-Mau, Monopoly Deal, Story-Chaos bei 200 % Zoom, Monopoly (Lobby und Partie), Spiel des Lebens, Vier gewinnt 320 px | keine |
| Spielzustand nach allen Größenwechseln | erhalten | erhalten (kein Neuladen, gleicher Raum, gleiche Identität) |

Screenshots: `artifacts/b24/vorher/shots/` und `artifacts/b24/nachher/shots/` (nicht versioniert; mit dem Audit jederzeit neu erzeugbar). Ausgewählte Vergleiche sind im Code-Vault verlinkt.

### Performance (Größenwechsel am Pokertisch, Median aus 5 Läufen)

| Messung | Vorher | Nachher |
| --- | --- | --- |
| 40 resize-Ereignisse im selben Bild (Rechenzeit) | 160 ms | 0 ms |
| 40 resize-Ereignisse im selben Bild (DOM-Änderungen) | 1001 | 0 |
| 10 echte Fenstergrößen nacheinander (DOM-Änderungen) | 280 | 280 |
| 10 echte Fenstergrößen nacheinander (Wandzeit inkl. Playwright) | 444 ms | 490 ms (Messstreuung) |

Schnelle Folgen von Größenereignissen werden zu einem Neuzeichnen pro Bild zusammengefasst; echte Größenwechsel kosten gleich viel wie vorher.

## Bekannte Sonderfälle

- **Bretter auf Ultrawide:** Reversi, Dame, Mühle, Hex, Vier gewinnt und Schach behalten ihre bisherigen Obergrenzen (520–560 px bzw. Schach-Spalte 560 px). Eine pauschale Vergrößerung verzerrte bei Reversi die Feldreihen; Bretter werden nur spielweise und geprüft vergrößert. Spielbar und vollständig sichtbar sind sie in allen Viewports.
- **Zweizeilige Kopfleiste unter 1000 px** ist Teil des Redesigns und bleibt. Auf 320 × 568 bleibt die Spielfläche deshalb knapp; Poker gleicht das über das kompaktere Dock aus.
- **Backgammon:** Liegen sechs oder mehr Steine auf einer Zunge, wird die Zungenreihe höher als ihre Brett-Hälfte; der überstehende Teil ist unsichtbare Trefferfläche (die Darstellung zeigt fünf Steine und „+1“). Zustandsabhängig, ohne sichtbare Auswirkung, unverändert gelassen.
- **Monopoly am Handy** nutzt bewusst eine verschieb- und zoombare Brettansicht (keine Änderung).
- **Unter 375 px** dürfen einzelne Ziele unter 44 px fallen, nie unter 24 px (WCAG 2.5.8 AA), z. B. die Spalten bei Vier gewinnt (dafür über 250 px hoch).
- **Vergrößerte Standardschrift des Browsers:** Mit 24 px statt 16 px (echte Firefox-Einstellung) bleiben Startseite und Mau-Mau ohne Überbreite oder Abschneiden. Der Text wächst aber kaum mit, weil die Oberflächen überwiegend Pixelwerte nutzen. Wirksam ist Browser-Zoom (bis 200 % geprüft, WCAG 1.4.4). Eine Umstellung auf `rem` wäre ein eigener Folgeauftrag.
- **Firefox und WebKit** sind seit B07 automatisch geprüft (Playwright, Desktop und Touch). **iOS Safari auf echter Hardware** ist damit nicht abgenommen; die Playwright-WebKit-Engine ist nicht Safari auf einem iPhone.

## Browser- und Barrierefreiheitsabnahme (B07, 2026-11-23)

| Prüfung | Chrome | Firefox | WebKit | WebKit Touch | Ergebnis |
| --- | --- | --- | --- | --- | --- |
| Regression `responsive.spec.js` (16 Fälle, 11 Viewports inkl. 200 % Zoom, Größenwechsel in laufender Partie, Hoch- und Querformat) | ✓ | ✓ 16/16 | ✓ 16/16 | ✓ Touch-Fall | bestanden |
| Tastaturfokus (30 bzw. 25 Tab-Schritte, Fokus im Bild und sichtbar markiert) | ✓ | – | – | – | bestanden |
| Touchziele ≥ 24 px (390 und 320 px; Startseite, Kopf, Aktionsleiste) | ✓ Mobil | – | – | ✓ | bestanden |
| Safe Areas (CDP-Emulation 47 px oben, 34 px unten; Tableiste und Aktionsleiste frei) | ✓ | – | – | – | bestanden |
| Bildschirmtastatur und dynamische Höhe (Höhe 844 → 420 mit Fokus im Suchfeld; Partie bei 844/640/480/360) | ✓ | – | – | – | bestanden |
| Vergrößerte Standardschrift 24 px | – | ✓ | – | – | bestanden (ohne Überlauf; Text wächst kaum, siehe oben) |

Keine reproduzierbaren Kompatibilitätsfehler gefunden; deshalb keine CSS-Änderung in B07. Emulationen ersetzen keine echten Geräte.

## Dynamische Spieloberflächen (GLOBAL-RESPONSIVE-02)

Die bestehende Responsive-Schicht beobachtet verfügbare Höhe und Seitenverhältnis zusätzlich zur Breite. Der Zustand für eine Bildschirmtastatur wird nur bei fokussierter Eingabe ohne Pinch-Zoom gesetzt. Die Werte des Visual Viewport, Safe Areas und vorhandene CSS-Breakpoints bleiben für die einzelnen Spieloberflächen verfügbar. Das Layout reserviert bei wenig Höhe weniger Platz für die HUD-Zeile.

Der Chromium-Katalogaudit erfasst Lobby und laufende Partie für alle 96 Raumspiele, 13 Solo-Spiele sowie drei Idle-Ansichten und prüft Hub und Resize-Verhalten separat. Bei 114 Fällen und 3.664 Messungen gab es keine horizontale Seitenüberbreite und keine unerreichbaren Elemente. Die erste Messung fand abgeschnittene Backgammon-Felder und überlagerte Schwimmen-Elemente. Die beiden Spiele sowie Kniffel, Meme-Duell und Slot Arcade wurden nach den Korrekturen mit 160 Messungen ohne erneuten Befund geprüft. Der Audit versieht die künstlich halbierten Viewports gesondert mit dem Präfix `zoom200`.

Nativer Chromium-Seitenzoom wurde für Kniffel und Slot Arcade bei 60, 100, 125, 150 und 200 Prozent mit dem Browser-Zoomregler der Test-Erweiterung geprüft. Bei 200 Prozent änderten sich die CSS-Breite von 1.666 auf 833 und die Pixeldichte von 1 auf 2. Den Zustand der Kniffel-Partie und den Zugriff auf Würfel, Punkteblatt und Slot-Start deckt diese Probe ab.

Kniffel zeigt die Würfel bei jeder Fensterbreite über dem Punkteblatt. Bei wenig Höhe sparen eine einzeilige Navigation im breiten Querformat und kürzere Tabellenzeilen Platz. Im nativen Chromium-Vergleich mit fünf Mitspielenden waren bei 100 Prozent neun Zeilen einschließlich Bonus ohne Scrollen sichtbar. Bei 200 Prozent waren drei Zeilen sichtbar. Die Gesamtsumme blieb in allen fünf geprüften Zoomstufen per Scrollen erreichbar.

## Manuelle Geräteabnahme (ausstehend)

Gilt erst als bestanden, wenn sie auf dem Gerät tatsächlich durchgeführt wurde. Stand 2026-11-23: **nicht durchgeführt**.

| Prüfschritt | iPhone (Safari) | Android (Chrome) | iPad (Safari) |
| --- | --- | --- | --- |
| Startseite hoch und quer: Tableiste, ☰-Menü, Schriftzug mit Version, keine seitliche Scrollleiste | offen | offen | offen |
| Notch und Home-Indikator verdecken weder Tableiste noch Aktionsleiste (Safe Areas) | offen | offen | – |
| Tisch erstellen, Host-Dialog vollständig bedienbar, im Querformat und nach dem Drehen | offen | offen | offen |
| Poker: eigene Karten, Raise-Betrag per Bildschirmtastatur eingeben, Feld bleibt sichtbar, Aktionen erreichbar | offen | offen | offen |
| Mau-Mau oder UNO: Karte antippen und spielen, Hand bleibt erreichbar, Querformat mit Aktionen neben dem Tisch | offen | offen | offen |
| Schach oder Vier gewinnt: Brett vollständig sichtbar, Züge per Tippen | offen | offen | offen |
| Spielhalle, Studio oder Factory: Tabs, Speichern, Drehen ohne Verlust des Spielstands | offen | offen | offen |
| Systemschrift vergrößert (Bedienungshilfen): keine abgeschnittenen Knöpfe | offen | offen | offen |
| Browser-Zoom bzw. Seitenzoom 200 % | offen | offen | offen |

Ergebnis je Zelle mit Gerät, Betriebssystem- und Browserversion, Datum und prüfender Person eintragen.

## Verbleibende Risiken

- Spielzustände, die der Audit nicht erreicht (z. B. Rundenende mit vielen Ergebnissen, selten geöffnete Panels), sind nur über die bestehenden Spieltests abgedeckt.
- Echte Geräte mit Notch und Bildschirmtastatur sind nur emuliert; ein Test auf einem echten Smartphone steht aus.
