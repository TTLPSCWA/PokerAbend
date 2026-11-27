# Änderungen

Hier steht, was sich im Spieleabend geändert hat, verständlich für alle, die ihn nutzen. Die technische Anleitung für den Server steht in [docs/betrieb.md](docs/betrieb.md).

## 3.31.0 – 27. November 2026

- Die Adminseite verwaltet alle Spiele zentral: nach Kategorie gruppiert, innerhalb A–Z, mit Suche, Filter „Alle / Aktiv / Ausgeblendet“ und Sammelaktionen (alle oder je Kategorie, mit Bestätigung). Einzelspieler- und Idle-Spiele lassen sich jetzt ebenfalls ausblenden. Laufende Tische bleiben unberührt.
- Neuer Bereich „Seiten & Endpunkte“ auf der Adminseite: alle Seiten mit Links, alle Routen mit Methode und Zugriffsschutz.
- Spielelisten, Host-Wechsel und Auswahlfelder sind einheitlich von A–Z sortiert (deutsch, Zahlen numerisch). Favoriten und „Zuletzt gespielt“ behalten ihre Vorrang-Reihenfolge.

## 3.30.2 – 27. November 2026

- „Abendprogramm planen“ im Host-Menü eines laufenden Spiels erscheint nur noch mit aktiver Discord-Anmeldung, wenn die Discord-Exklusivität eingeschaltet ist. Der Server lehnt das Planen sonst ab.

## 3.30.1 – 27. November 2026

- Die Admin-Seite lädt Meme-Charts gezielt. Beim Bearbeiten von Tickets und Rückblicken bleibt das Anfragelimit für die eigentlichen Verwaltungsaktionen verfügbar.
- Die Schaltfläche „Charts abrufen“ bleibt auch bei deaktivierten Charts lesbar.

## 3.30.0 – 27. November 2026

Aus 107 Spielen sind **109** geworden.

- **Meme-Duell** bietet drei Party-Modi für bis zu zwölf Personen: Textkarten zur Vorlage, Bildkarten zur Situation und einen Creator mit eigenen Texten. Der Host steuert Zeiten und Pakete. Private Bilder bleiben im Raum. Redaktionelle Beiträge erscheinen nach Prüfung im Admin-Bereich.
- **Slot Arcade** bringt drei Solo-Automaten mit eigener Darstellung, Gewinnlinien oder 243 Gewinnwegen. Spielchips sind kostenlos und bleiben auf diesem Gerät. Die Spielstände enthalten Guthaben, Freispiele und Einstellungen.
- **Kniffel** zeigt die Mitspielenden kompakt und hält Schnellwertung und Punkteblatt auch bei wenig Platz erreichbar. Die Würfel bleiben auch bei hoher Zoomstufe und im Querformat über dem Punkteblatt.
- **Layout** berücksichtigt die verfügbare Fensterhöhe besser. Backgammon hält Spielfelder im Scrollbereich erreichbar. Bei Schwimmen bleibt die Regelhilfe bedienbar.
- Die Browserprüfungen zum Discord-Logout und zu den UNO-Farbwahl-Ansichten warten auf den bestätigten Zustand.

## 3.29.0 – 26. November 2026

- Sicherheit (SEC-SOCKET-01): Wer sich abmeldet, spielt in keinem offenen Tab desselben Browsers weiter. Auch eine abgelaufene Anmeldung oder ein entzogener Discord-Zugang sperrt bestehende Verbindungen; der Tab führt dann zur Anmeldung. Der Platz am Tisch bleibt wie bei einem Verbindungsabbruch einige Minuten frei und lässt sich nach der Neuanmeldung mit „Weiterspielen“ wieder übernehmen.

## 3.28.5 – 26. November 2026

- Poker: Small und Big Blind stehen an der Spieleranzeige. Die Handübersicht bekommt auf großen Bildschirmen links Platz; der Saloon-Stern lässt die Kartenmitte frei.
- UNO: Die Spielanlage zeigt die Wahl der Handgröße bei Classic und Spuknacht. Flip, No Mercy und All Wild erklären ihre festen Regeln im Host-Menü. In Flip bleibt der Stapelzähler unter beiden Kartenseiten lesbar.
- UNO, Skip-Bo und Phase 10: Die Spielrichtung braucht in der Spielerleiste nur noch so viel Platz wie ihre Beschriftung.

## 3.28.4 – 26. November 2026

- Seitenleiste: Der Schriftzug „Spieleabend“ passt sich der Breite der Leiste an und wird bei schmalen Fenstern oder Browser-Zoom nicht mehr abgeschnitten.
- Unter der Versionsnummer steht ein Link zum Projekt auf GitHub. Er öffnet sich in einem neuen Tab und ist auch im Profil zu finden.
- „Was ist neu?“ zeigt jetzt die Einträge aus diesem Änderungsprotokoll, und zwar nur Versionen, die schon veröffentlicht sind.

## 3.28.3 – 26. November 2026

- Puzzle-Panik: Auch beim vergrößerten 3×3- und 4×4-Brett bleiben alle Felder erreichbar. Die obere Reihe gerät beim Zoomen nicht mehr hinter die Spielerleiste.

## 3.28.2 – 25. November 2026

- Vier gewinnt: Auf schmalen Bildschirmen mit wenig freier Höhe ragten die rechten Spalten über das Brett hinaus (gefunden mit der neuen WebKit-Prüfung). Das Brett ist jetzt mindestens so breit wie seine sieben Spalten.

## 3.28.1 – 25. November 2026

- Skip-Bo: Eine Kartenaktion aus einem veralteten Spielstand wird abgelehnt, statt eine andere Karte zu spielen. Das betrifft etwa ein zweites Fenster oder eine verspätete Antwort; danach siehst du sofort den aktuellen Stand.
- Blackjack: Ein Doppelklick auf „Karte“ zieht nur noch eine Karte. Bei geteilter Hand beendet ein Doppelklick auf „Stehen“ nur die angezeigte Hand.
- Mau-Mau: Nach „Ass – nochmal dran“ spielt ein Doppelklick auf eine Karte nicht zusätzlich die nächste.
- Wer einen Raum in einem zweiten Tab öffnet, hat im alten Tab keine Fehler mehr im Hintergrund.

## 3.28.0 – 25. November 2026

- Doppelkopf: Wertung, Ansagen und Hochzeit folgen jetzt den Turnierregeln des Deutschen Doppelkopf-Verbands (Stand 21.02.2026).
  - Stille Hochzeit und Hochzeit ohne Partner werden wie ein Solo abgerechnet.
  - Sonderpunkte gibt es nur im Normalspiel.
  - Gegen eine Absage gewinnt die Gegenseite schon mit 90, 60 oder 30 Augen.
  - Verfehlen beide ihre Absage, gewinnt niemand; es zählen nur die erspielten Punkte.
- Doppelkopf: Ansagen gehen jetzt auch, wenn du nicht am Zug bist.
  - Stufen lassen sich überspringen.
  - Auf eine Ansage kannst du noch eine Karte später erwidern.
  - Bei der angemeldeten Hochzeit wird erst nach dem Klärungsstich angesagt.
  - Die Abrechnung zeigt jede Position einzeln.
- Doppelkopf: Findet der Hochzeiter in den ersten drei Stichen keinen Partner, bleibt er allein. Bisher wurde ein späterer Stichgewinner noch Partner.

## 3.27.4 – 25. November 2026

- Game Studio Tycoon: Speichern bleibt bedienbar, während das Studio im Hintergrund neue Daten abfragt. Eine verspätete Antwort ersetzt keinen bereits bestätigten Spielstand.

## 3.27.3 – 25. November 2026

- UNO, Skip-Bo und Phase 10: Eine gerade ausgewählte Karte bleibt sichtbar, auch bei großem Browser-Zoom oder kleinem Fenster, wenn die Auswahlzeile die Hand verschiebt.

## 3.27.2 – 25. November 2026

- Doppelkopf: Wer beide Kreuz-Damen hat und „gesund“ meldet, spielt allein gegen drei. Die Abrechnung gibt dieser Person jetzt wie beim Solo den dreifachen Wert, sodass die Punkte aller vier Spieler wieder zusammen null ergeben. Die Ergebnisanzeige nennt „allein gegen drei (dreifach)“.

## 3.27.1 – 25. November 2026

### Behoben

- Nach dem Löschen eines Kontos bleiben frühere Geräteanmeldungen ungültig. Eine neue Gastanmeldung erhält ein eigenes Konto.

## 3.27.0 – 25. November 2026

- Factory Empire: Züge fahren als fortlaufender Umlauf. Nach einer Anlauffahrt kommt alle 120 Sekunden eine Wagenladung an. Später bereitgestellte Ware steigt ohne neuen Anlauf zu. Ein Auftrag über 60 Motoren mit einem Wagen ist damit nach 360 statt 480 Sekunden erfüllt. Mehrere Strecken für denselben Auftrag liefern zusammen nicht mehr als die offene Menge. Gespeicherte Factory-Stände der alten Zugregel werden nicht geladen und bleiben unverändert erhalten.
- Alle drei Idle-Spiele lehnen Spielstände mit unbekannten oder alten Zusatzfeldern ab, statt sie still zu übernehmen. Ein neues Wörterbuch beschreibt Kennungen, Versionen und Ressourcen.

## 3.26.3 – 25. November 2026

- Der Server kennt die öffentliche Herkunft über den Host und übernimmt Anschluss-IP und HTTPS nur von zulässigen direkten Proxys. Neue Backups werden mit privaten Zugriffsrechten veröffentlicht. Das Skript meldet alte Sicherungen zur Prüfung und lässt sie erhalten.

## 3.26.2 – 24. November 2026

- In den drei Idle-Spielen führt der Tastaturfokus nach dem Öffnen zu den Speicheraktionen. Der Dateiimport behält den Fokus bei Fehlern und nach dem Schließen. Bestätigungsdialoge benennen Aktion und Folgen für assistive Technik.

## 3.26.1 – 23. November 2026

- Echtzeit-, Arcade- und Expeditionsspiele halten ihren Spieltakt: Kurze Verzögerungen des Servers summieren sich nicht mehr auf, der Countdown dauert wieder genau drei Sekunden, und nach einer Überlast springt das Spiel nicht in einem Schwall vor. Der Zug-Hinweiston spielt seinen zweiten Ton nur noch, wenn Verbindung und Spielzug noch bestehen. Spielregeln und Spielstände bleiben unverändert.

## 3.26.0 – 23. November 2026

- Die Seite passt sich an jede Bildschirmgröße an, vom kleinen Smartphone (320 Pixel) bis zum Super-Ultrawide-Monitor, auch bei 200 % Browser-Zoom und im Querformat. Auf großen Monitoren werden Pokertisch, Karten und Würfel größer und die Bedienung rückt zur Mitte. Auf kleinen Handys bleiben Brett, Karten und Aktionen erreichbar, Dialoge passen immer auf den Bildschirm. Spielregeln und Spielstände bleiben unverändert. [Adaptive Responsive UI (B24)](docs/design/RESPONSIVE.md)

## 3.25.1 – 22. November 2026

- Auf kleinen Bildschirmen bleiben in Game Studio Tycoon und Factory Empire die aktiven Tabs bei der laufenden Aktualisierung sichtbar. In Factory Empire benennt der Inspektor einen nicht verbundenen Ausgang und zeigt, wie er sich verbinden lässt. [Qualitätsprüfung der drei Idle-Spiele](docs/idle-quality.md)

## 3.25.0 – 22. November 2026

- Factory Empire (IDLE-07 und IDLE-08) entwickelt eine Erzmine in fünf Phasen zu einem regionsübergreifenden Industrienetz. Förderraten, Lager, Strom und Bahn begrenzen die Produktion. Der Fortschritt läuft offline weiter und lässt sich manuell speichern und signiert exportieren. Der eigene Spielschalter ist standardmäßig aus.

## 3.24.0 – 22. November 2026

- Game Studio Tycoon (IDLE-06 und IDLE-11) führt über fünf Phasen vom Einzelentwickler zum Medienhaus. Projekte reservieren Phasenkosten, Verkäufe haben endliche Märkte und der Spielstand kann manuell gespeichert und signiert exportiert werden. Der eigene Spielschalter ist standardmäßig aus.

## 3.23.0 – 22. November 2026

* Die Spielhalle ist das erste Idle-Spiel. Aus einem Kartentisch können in fünf Phasen ein Casino und bis zu fünf Standorte werden. Personal, Forschung und Automatisierung verändern den Gästebetrieb auch offline. Gespeichert wird von Hand. Der Betreiber schaltet das Spiel ausdrücklich frei.

## 3.22.0 – 21. November 2026

* Die Idle-Plattform kann manuelle Spielstände sicher einem Spieleabend-Konto zuordnen. Dazu gehören Gerätewechsel, signierte Exporte, Importvorschau, Schlüsselwechsel und das Löschen der eigenen Daten. Die drei geplanten Idle-Spiele erscheinen nach ihrer jeweiligen Freigabe.

## 3.21.0 – 21. November 2026

* Technisches Fundament für Die Spielhalle, Game Studio Tycoon und Factory Empire mit gemeinsamem Fortschritt, Offline-Berechnung und manuellen, signierten Spielständen. Die drei Spiele folgen in eigenen Paketen und erscheinen mit diesem Stand noch nicht im Spielekatalog.

## 3.20.2 – 21. November 2026

* Game-ID und Gerätekopplung bleiben beim gleichzeitigen Wechsel des Discord-Anmeldestatus nutzbar.

## 3.20.1 – 21. November 2026

* Bestenliste und Tisch zeigen die tatsächliche Ranked-Voraussetzung an: mindestens zwei unterschiedliche Konten und eine durchgehend aktive Discord-Sitzung pro Teilnehmer. Historische Ergebnisse bleiben lesbar.

## 3.20.0 – 21. November 2026

* Discord-Anmeldung funktioniert auch ohne Discord-Server-ID, sobald der reguläre Seitenzugang vorliegt. Verknüpfte Konten können sich auf jedem Gerät anmelden.
* Gewertete Runden setzen eine gültige Discord-Sitzung je teilnehmendem Konto voraus. Ein Sitzungsverlust lässt die Partie ungewertet weiterlaufen.
* Betreiber können Tickets, Abendplanung, Bestenlisten und Abend-Rückblicke auf aktive Discord-Sitzungen beschränken. Bei aktiver Sperre blendet die Navigation die Bereiche für Gäste aus. Direkte Links erklären die erforderliche Anmeldung. Der Schalter ist standardmäßig aus.

## 3.19.1 – 21. November 2026

* Die Besucher-Roadmap verlangt für „Neu veröffentlicht“ einen Buildnachweis, der zum laufenden Image passt. Die redaktionelle Freigabe bleibt aus.
* Der Backgammon-Browsertest wartet nach jedem Zug auf die bestätigte Serverrevision. Spielregeln und das Testbudget bleiben erhalten.

## 3.19.0 – 21. November 2026

* **Neue Roadmap (ROADMAP-02):** Die öffentliche Roadmap zeigt sechs verständliche Bereiche mit Karten statt einer langen Liste: **Neu veröffentlicht**, **In Entwicklung**, **Als Nächstes**, **Geplant**, **Ideen** und **Pausiert**, mit Filter nach Spiele, Funktionen, Aussehen und Betrieb, auf Deutsch und Englisch, am Handy und per Tastatur bedienbar. Leere Bereiche zeigen einen Hinweis. Interne Paketnummern, Pfade und Entwicklungsnotizen werden nicht angezeigt.
* **Nur Belegtes ist „neu“:** Ein Eintrag steht nur unter „Neu veröffentlicht“, wenn der laufende Server ihn belegt. Ein erfolgreicher Build oder ein veröffentlichtes Image reicht nicht.
* **Noch nicht freigeschaltet:** Die neue Ansicht ist mit einem Freigabeschalter (`approved` in `docs/roadmap/public-roadmap.json`) ausgeliefert, der aus ist. Bis zur redaktionellen Freigabe zeigt der Hub die bisherige Roadmap.
* **Erhalten:** Die bisherige Roadmap bleibt unter `#roadmap/verlauf` erreichbar; `/roadmap` und „Was ist neu“ sind unverändert. Neu ist `/api/roadmap`.
* **Betrieb:** Das Image übernimmt die Besucherdatei über eine eigene `COPY`-Zeile; Zurückrollen und Freigabe stehen in [docs/betrieb.md](docs/betrieb.md#öffentliche-roadmap-und-freigabeschalter-seit-3190).
* **Technik:** Der Entwicklungsindex führt die Besucherdatei als Quelle; ROADMAP-02 steht dort als in Bearbeitung, solange sie nicht committet und CI-abgenommen ist.

## 3.18.0 – 20. November 2026

* **Navigation und Anzeige (NAV-01):** Seitenleiste, Mobil-Tabs, Mobil-Menü, Kategorie-Chips, Spielzähler und Startseite folgen jetzt denselben Einstellungen unter „Einstellungen → Startseite und Filter“. Neu sind Schalter für **Offene Tische** (Reiter, Tab und Startseitenblock) und **Favoriten** (Reiter und Startseite). Der Startseitenblock „Eure Spieleabende“ folgt den Schaltern „Abend planen“ und „Abend-Rückblicke“; sind beide aus, entfällt er ganz.
* **Kategorien:** Sind alle Spielkategorien ausgeblendet, erscheinen keine leeren Blöcke mehr. Die Bibliothek zeigt stattdessen einen Hinweis mit Link zu den Einstellungen. Die neue Kategorie **Idle** taucht erst auf, wenn ein Idle-Spiel registriert ist.
* **Nur Anzeige:** Ausgeblendetes bleibt über Direktlinks, Einladungslinks und „Tisch erstellen“ erreichbar. Favoriten, Verlauf und bestehende Einstellungen bleiben erhalten.
* **Englisch:** Der Text im Block „Eure Spieleabende“ ist wieder vollständig übersetzt.
* **Betrieb, Zurückrollen:** Ein älterer Server kennt die neuen Einstellungs-Kennungen `tables` und `idle` nicht. Server und Seite immer gemeinsam aus- und zurückrollen, Hinweise in [docs/betrieb.md](docs/betrieb.md#6-jedes-weitere-update). Betroffen sind nur Anzeigeeinstellungen, keine Spiel- oder Kontodaten.
* **Bekannte Punkte (Folgeaufgaben):** Zwei Browser-Tests schlagen unter hoher Last gelegentlich fehl, unabhängig von NAV-01: „Wellenwacht“ (Wettlauf zwischen Fortsetzen und Auslesen der Turmwerte, auch auf Version 3.17.1 nachgewiesen) und „Meine Daten: Export“ auf Mobil (`Identity.gameId` noch nicht geladen). Nicht automatisiert geprüft sind das Entfernen eines Favoriten per Stern, Reconnect und zweite Browserinstanz für Favoriten, ein Idle-Spiel unter den Mehrspieler-Spielen sowie der Discord-Sichtbarkeitsfall (N03, gehört zu AUTH-01).

## 3.17.1 – 20. November 2026

* **Zugton:** Wer einen laufenden Tisch betritt oder eine Verbindung wiederherstellt, hört für den bereits laufenden eigenen Zug keinen neuen Zugton. Wechselt der Zug am selben Tisch regulär zu dir, bleibt das Signal erhalten.
* **Qualitätssicherung (QA-CI-01):** Die Browser-Tests prüfen sichtbare Spielinformationen gegen die passende Empfängeransicht und Serverrevision. Hold’em und Omaha vergleichen dieselbe Hand nach Wiederverbindung. Zusätzliche Regressionen prüfen Bot-Züge, private Tischinformationen und kurzzeitig sichtbare Inhalte.

## 3.17.0 – 15. November 2026

* **Kartenspiele, Themenwelten:** In Poker, Omaha, Omaha Hi/Lo, Seven Card Stud, Short Deck, Five Card Draw und Blackjack wählt der Host unter „Themenwelt“ **Saloon**, **Dampf & Messing**, **Neon-Arcade** oder **Schatten über Neuengland**; in Skat, Doppelkopf, Schwimmen, Mau-Mau, Durak, Hearts, Stichmeister, Präsident und Mogeln **Baker Street**, **Runen & Nordlicht**, **Tafelrunde** oder **Saloon**. Jede Welt bringt eigenen Kartenrücken, Kartenrahmen, ein blasses Emblem auf Bube, Dame und König sowie Tisch und Filz. Werte, Farben, Auswahl, Ziehen und Ablegen bleiben unverändert, verdeckte Karten bleiben verdeckt. Bei Poker steht die Auswahl im Host-Menü unter „Spiel“. „Standard“ zeigt alles wie bisher.

## 3.16.0 – 15. November 2026

* **Klassische Brettspiele, drei Themenwelten:** In Schach, Mühle, Dame, Reversi, Hex, Vier gewinnt und Backgammon wählt der Host im Host-Menü unter „Themenwelt“: **Götterberg** (Marmor hell und dunkel, Gold, Ägäisblau, Mäander), **Runen & Nordlicht** (Holz, Runenstein, Eisblau, Polarlicht-Grün; dieselbe Welt wie bei den Würfelspielen, mit eigener Brett-Gestaltung) und **Tafelrunde** (Burgholz, Wappenrot, Königsblau, Gold). Schachfiguren behalten ihre bekannten Umrisse und bekommen je Welt eigene Zier (Lorbeer, Runen, Wappenschilde). Regeln, Züge, Bots und Markierungen bleiben unverändert; Hex behält Rot/Blau, Vier gewinnt Rot/Gelb. „Standard“ zeigt alles wie bisher.

## 3.15.0 – 15. November 2026

* **Shut the Box:** Echte ambientCG-Holzmaserung ergänzt den bestehenden Boxhintergrund. Klappen, Auswahl, Würfel und Bedienung bleiben erhalten; bei fehlendem Bild erscheint der bisherige Holzverlauf. Ausgewählt im direkten Vergleich mit Original und Poly Haven.

## 3.14.0 – 15. November 2026

* **Würfelspiele, vier Themenwelten:** In allen 13 Würfelspielen kann der Host im Host-Menü unter „Themenwelt“ wählen: **Saloon** (Knochenwürfel, Lederbecher, Holzdielen), **Piratenbucht** (Walbein-Würfel, Holzbecher mit Eisenringen, Kneipentisch mit Seekarte), **Runen & Nordlicht** (Runensteine, Hornbecher, Langhaus) oder **Neon-Arcade** (leuchtende Augen, Neonbecher, Raster). Würfel, Becher, Klappen und Tisch ändern nur ihr Aussehen; Augen, Zahlen und Markierungen bleiben deutlich lesbar, Regeln bleiben gleich. „Standard“ bringt die bisherige Optik zurück.

## 3.13.0 – 15. November 2026

* **Monopoly, Themenwelt „Schatten über Neuengland“:** Der Host kann im Host-Menü unter „Themenwelt“ eine neblige Hafenstadt der 1920er wählen: dunkle Hafenplanken, Leuchtturm in der Brettmitte, Felder auf altem Papier mit Messingrahmen, eigene Figuren (Laterne, Kompass, Rabe, Anker, Taschenuhr, Schlüssel, Fernrohr, Schwarze Katze), Fischerhütten und Leuchtturm statt Häusern und Hotel, eigene Feld- und Kartennamen. Regeln, Preise, Mieten und Kartenwirkungen bleiben genau gleich, eigene Bretter behalten ihre Namen. „Standard“ bringt die bisherige Optik zurück. Gilt für Standard und Tempowürfel, nicht für Junior.

## 3.12.0 – 15. November 2026

* **Themenwelten, gemeinsames Fundament:** Alle Welten eines Tisches laufen jetzt über eine zentrale, geprüfte Liste und einen gemeinsamen Ablauf zum Einschalten und Abräumen. Schnee, Wintermusik und andere Effekte verschwinden beim Weltwechsel, Verlassen, Parken, Schließen des Tisches oder Verlassen der Seite vollständig; bei einem Verbindungsabbruch pausiert die Musik und läuft nach der Wiederverbindung weiter. Fehlt eine Weltdatei, gilt das Standarddesign. Die Kartenwelten bleiben, wie sie sind; neue Welten gibt es noch nicht.

## 3.11.0 – 15. November 2026

* **Gebietskampf:** Vorbereitete Kenney-Fahnen-, Schild- und Schwertsymbole für Karten, Kartentausch und Aktionsanzeigen. Kartentyp und Gebietsname sind klar getrennt; Fackel und Joker behalten ihre bisherigen Zeichen. Meridia, geheime Informationen und Regeln bleiben erhalten; lesbare Ersatzdarstellung bei fehlenden Bildern und Grafiknachweise im Spiel.

## 3.10.0 – 15. November 2026

* **Städtehandel:** Kenney-Gebäude für Siedlungen und Städte mit eindeutigen Eigentümerfarben und Symbolen. Aurelia-Karte, Spielregeln, Zoom und Bauplätze bleiben erhalten; bei fehlenden Bildern erscheinen die bisherigen SVG-Marker. Grafiknachweise direkt im Spiel.

## 3.9.0 – 15. November 2026

* **Schatzinsel:** Zusammenhängende Sandinsel mit Kenney-Küste und Wasser, klaren Grabungs-/Fundmarkierungen, weiterhin allen 64 Koordinaten und gut bedienbaren Feldern. Verstecke und Regeln bleiben unverändert; Karte mit Tastatur und Touch verschiebbar, Grafiknachweise direkt erreichbar.

## 3.8.0 – 15. November 2026

* **Labyrinth-Brett:** 23 lizenzierte Schatzsymbole ergänzen die bestehenden Nummern auf Brett, freiem Plättchen und eigenem Auftrag. Der Ring behält seinen Nummern-Fallback; bei fehlenden Bildern bleibt die Nummer sichtbar. Figuren und Symbole sind räumlich getrennt, der vergrößerte Modus und Grafiknachweise sind direkt erreichbar. Spielregeln und geheime Aufträge bleiben unverändert.

## 3.7.0 – 14. November 2026

* **Monopoly, technische V4-Anbindung:** Optionaler perspektivischer Szenenrenderer für die bestehende Engine, dynamische Figuren und Gebäude, Grundstücksurkunden und mobile Navigation. Private Themen bleiben als unveröffentlichte Definition außerhalb des Repositorys und sind ausschließlich in einer gesonderten Loopback-Vorschau auswählbar. Die öffentlichen Designs modern/classic und Junior bleiben erhalten. Private Theme-Inhalte werden weder im Repository noch im Container mitgeliefert.

## 3.6.0 – 14. November 2026

* **Monopoly, Werkzeug für weitere Brettdesigns:** Hinter den Kulissen gibt es jetzt eine geprüfte Bild-Pipeline für künftige Designs: Bilder werden automatisch verkleinert (Handy-Varianten), als WebP gespeichert, mit Prüfsumme und Herkunft erfasst und dauerhaft zwischenspeicherbar ausgeliefert. Sichtbar ändert sich noch nichts, es gibt kein neues Design und die vorhandenen bleiben unverändert.

## 3.5.1 – 14. November 2026

* **Monopoly, Fundament für weitere Brettdesigns:** Hinter den Kulissen können Feldnamen und Kartentexte jetzt je Design festgelegt werden und erscheinen dann überall gleich: auf dem Brett, im Protokoll und auf den Karten. „Bisheriges Thema“ und „Klassik“ bleiben unverändert, ebenso alle Regeln, Räume und eigenen Bretter. Sichtbar ändert sich noch nichts; ein neues Design erscheint erst, wenn es fertig ist.

## 3.5.0 – 14. November 2026

* **Schiffe versenken, eigener Lobbybildschirm:** Vor dem Start zeigt der Tisch jetzt einen Bildschirm im Stil des gewählten Designs. „Klassisch“ ist ein Flottenkommando mit Seekarte auf Elfenbein, Messing und Schiffen von oben, die „Taktik-Konsole“ eine Raumflotten-Zentrale mit Radar und Raumschiffen. Dazu stehen dort das Briefing, die gewählte Variante (Klassisch oder Salvo), die Regeln dieses Tisches (Flotte, Zeit pro Schuss, Berühren, nochmal schießen), der Ablauf in drei Schritten und wie viele Plätze besetzt sind. Die Spieler zeigt wie bisher der Tisch selbst; gestartet wird wie gewohnt unten. Auch auf Englisch.

## 3.4.1 – 14. November 2026

* **Schiffe versenken, Taktik-Konsole:** Der Radarkegel im Zielsektor dreht sich nicht mehr dauerhaft. Die Drehung kostete beim Messen dreimal so viel Bildzeit; jetzt steht der Kegel fest, und das Spiel läuft wie mit dem klassischen Design.

## 3.4.0 – 14. November 2026

* **Schiffe versenken, zweites Design „Taktik-Konsole“:** Beim Erstellen eines Tisches kann der Host jetzt zwischen „Klassisch“ und „Taktik-Konsole“ wählen (zwei Vorschaukarten, getrennt von der Spielvariante Klassisch/Salvo). Die Taktik-Konsole ist eine dunkle Weltraum-Konsole: Raumschiffe von oben, Radarringe mit langsamem Schwenk, Treffer glühen bernsteinfarben, versenkte Schiffe sind rote Wracks. Dazu zeigt sie den Zustand der eigenen Flotte (Rumpfintegrität), die Gegnerflotte (nur „Position unbekannt“ oder „vernichtet“) und ein Gefechtsprotokoll; auf dem Handy wechselt man per Reiter zwischen Zielsektor und eigener Flotte.
* **Alles gleich für alle am Tisch:** Das Design gehört zum Tisch, auch Zuschauer sehen es, und es bleibt nach dem Neuladen erhalten. Zwei Tische können gleichzeitig verschiedene Designs haben. Regeln, Schüsse, Timer und Punkte ändern sich nicht; Positionen gegnerischer Schiffe bleiben bis zum Versenken verborgen.
* Der Name des Vorbilds für die Konsole steht nicht in der Oberfläche; die Herkunft der Zeichnungen steht in `docs/design/SCHIFFE_SKINS.md` und `docs/design/ART_LICENSES.md`.

## 3.3.0 – 14. November 2026

* **Schiffe versenken, neues Aussehen:** Auf dem Meer fahren jetzt echte Schiffe von oben (Ozeandampfer, Frachter, Schlepper statt grauer Blöcke). Das Wasser hat Wellen und ein goldenes Gitter, ein Treffer ist ein orangener Stern, Wasser ein Ring, ein versenktes Schiff liegt dunkel als Wrack unter dem Stern und sinkt kurz. Alles gilt für klassische Regeln und Salvo, die Regeln selbst sind unverändert.
* **Design am Tisch:** Der Tisch hat jetzt eine Einstellung „Design“ (nur das Aussehen). Sie gehört zum Raum, der Host stellt sie ein, und alle am Tisch – auch Zuschauer – sehen dasselbe. Alte Tische bekommen das klassische Design. Jetzt gibt es erst eines; weitere folgen als Auswahl.
* **Hinweis für Entwickler:** `games/schiffe/skins.js` führt die Designs, getrennt von den Spielvarianten; das Spiel bleibt ein einziges mit der ID `schiffe`. Die Schiffsbilder sind die Kenney-Modelle (CC0), eingetragen in `docs/design/ART_LICENSES.md`.

## 3.2.0 – 13. November 2026

* **Design-Entwürfe:** Neue Grundregel für Entwürfe in [docs/design/DESIGN_DRAFTS.md](docs/design/DESIGN_DRAFTS.md) und ein Export-Befehl `npm run export:design`, der SVG-Entwürfe aus `docs/design/drafts/` als PNG (doppelte Breite) und PDF (Vektor) speichert. An der Seite selbst ändert sich nichts.

## 3.1.3 – 12. November 2026

* **Behoben:** Wer eine laufende Runde zu zweit über „Tisch verlassen“ beendete, sah auf der Startseite wieder Kartenwelt, Schnee und Wintermusik. Der letzte Raumstand kam erst nach dem Verlassen an. Jetzt gilt die Kartenwelt nur noch für den Tisch, an dem man gerade sitzt.

## 3.1.2 – 11. November 2026

* **Schach, Firefox:** Die Figuren sind jetzt direkt in der Seite eingebettet. Im Firefox waren bisher alle Figuren schwarz, jetzt sind Weiß und Schwarz richtig.
* **Schach, Markierungen:** Die Punkte für mögliche Züge, der Schlagring und der Schach-Ring liegen genau in der Feldmitte, egal wie groß das Brett ist.
* **Schach, Klang:** Ein Zug schiebt kurz über das Brett und setzt leise auf, ein Schlag klingt kräftiger. Vorher klang es wild, weil beim Schlagen zwei Töne direkt hintereinander kamen.
* **Schach, Uhr:** Die Bedenkzeit wählt der Host jetzt direkt in der Schach-Lobby, die anderen sehen die Einstellung dort.

## 3.1.1 – 11. November 2026

* **Behoben:** Wer mit „Platz behalten“ auf die Startseite ging und über „Weiterspielen“ zurückkam, hatte Kartenwelt, Schnee und Wintermusik nicht mehr. Jetzt sind sie sofort wieder da.
* **Behoben:** Wurde das Spiel in einem zweiten Tab übernommen, lief im alten Tab die Wintermusik weiter. Jetzt wird sie dort gestoppt.

## 3.1.0 – 11. November 2026

* **Version unter dem Schriftzug:** Unter „Spieleabend“ steht jetzt klein die Version und der Build (z. B. `v3.1.0 · 8c1cd39`). So sieht man nach jedem Update sofort, ob der neue Stand läuft.
* **Kartenwelten fertig:** Alle Welten für UNO, Skip-Bo und Phase 10 haben ihren Feinschliff (Aktionskarten mit Streifen, Bauplätze, Phasen-Reise), dazu zehn Winterwelten mit Schneefall (❄) und auf Wunsch leiser Wintermusik (♪, Standard aus).
* **Behoben:** Schnee und Wintermusik liefen weiter, nachdem man den Tisch verlassen oder geschlossen hatte.
* Ab jetzt zählt jede Fehlerbehebung die letzte Stelle hoch (3.1.1, 3.1.2 …), neue Funktionen die mittlere (3.2.0). „Was ist neu“ öffnet sich nur bei einer neuen mittleren oder vorderen Stelle von selbst.

## 3.0.0 – 8. November 2026

Seit Version 2.0.0 (1. November) ist sehr viel passiert. Aus 58 Spielen sind **107** geworden, jeder Spieler hat jetzt ein eigenes Konto mit Profil, es gibt eine echte Bestenliste, und der Server lässt sich besser betreuen. **Alles, was ihr bisher gespielt habt, bleibt erhalten.**

### Das Wichtigste in Kürze

* **40 neue Online-Spiele und 9 neue Einzelspieler-Spiele** (Liste unten).
* **Jeder Browser hat ein Konto mit einer Game-ID** (zum Beispiel `#K7Q2`). Euer Name kann sich ändern, eure Geschichte bleibt dran. Ein zweites Gerät lässt sich mit einem kurzen Code verbinden.
* **Echte Bestenliste (Ranked):** Gezählt werden nur Partien, in denen alle echte, angemeldete Menschen sind. Eure alten Statistiken bleiben sichtbar, und ihr könnt sie eurem Konto zuordnen.
* **Anmeldung mit Discord** (optional): Mitglieder des Discord-Servers kommen ohne Gruppenpasswort hinein; das Gruppenpasswort funktioniert weiter.
* **Profile, Erfolge und „Wer ist online?“** mit Schaltern, wer was sehen darf.
* **Einstellungen, Datenexport und Löschen:** Alles, was zu euch gespeichert ist, könnt ihr unter *Einstellungen → Meine Daten* herunterladen oder löschen. Eine kurze Datenschutzseite gibt es unter `/datenschutz` (Deutsch und Englisch).
* **Jedes Spiel hat jetzt seine eigene Spielwelt** (eigenes Aussehen statt einer Einheitsoptik), und der Computer-Gegner hat drei Stufen.
* **Neue Abendformate:** Party-Brett, Survival-Abend und optionale Zusatzregeln wie der Chaos-Modus.

### Neue Spiele zum Mitspielen

**Karten und Brett:** Backgammon, Hearts, Five Card Draw, Scrabble, Omaha Hi/Lo, Short Deck Poker, Seven Card Stud, Schach (auch als Chess960, mit Uhr), Skat, Doppelkopf, Exploding-Deck, Stichmeister, Labyrinth-Brett, Schatzinsel.

**Strategie:** Gebietskampf (eigene Weltkarte, Würfelkämpfe, Missionen) und Städtehandel (Inselaufbau mit Handel und Räuber). Beide merken sich den Spielstand sogar über einen Neustart des Servers hinweg.

**Party und Bluff:** Doppelagent, Lügenbaron, Jäger & Schatten, Infektionsjagd, Letzter Schutzplatz, Regelwahnsinn.

**Echtzeit und Action** (der Server ist Schiedsrichter, es gibt Computer-Mitspieler): Geschenkfänger, Rhythmus-Rausch, Stillgestanden!, Bomben-Duell, Schubsarena, Scheinwerfer-Flucht, Minenlauf, Labyrinth-Chaos, Puzzle-Panik, Wortjagd, Kistenchaos, Gummiband-Challenge, Turmbauer, Fallenbauer, Geschenkdiebe, Schatzgräber, Brückenroulette, Reaktor-Notfall.

**Einzelspieler** (laufen nur auf eurem Gerät, speichern nur dort): Snake, Memory, Minesweeper, Nonogramm, Sokoban, Block Puzzle, Solitaire, Mahjong Solitaire, Match-3. Dazu bleiben Sudoku, 2048 und Wellenwacht.

### Konten, Bestenliste und Profile

* **Game-ID und Geräte verbinden:** Unter *Ich → Identität* seht ihr eure Game-ID, könnt einen Code für ein zweites Gerät erzeugen und eure **alten Statistiken übernehmen** (wer zuerst kommt, bekommt sie; ein Admin kann eine falsche Zuordnung rückgängig machen).
* **Ranked:** Eine Partie zählt nur, wenn alle Mitspielenden registrierte Menschen sind (ohne Computer-Mitspieler und ohne Gäste). Am Tisch steht immer, ob die laufende Runde zählt und warum nicht. Die Bestenliste gibt es für Woche, Monat und alle Zeiten, je Spiel oder gesamt. Die alte Namensstatistik bleibt daneben bestehen.
* **Profile:** Wer sich auf euren Namen klickt, sieht (wenn ihr es erlaubt) Statistik, Lieblingsspiele, letzte Partien und Erfolge. Jede Angabe lässt sich einzeln verbergen, auch das ganze Profil.
* **Erfolge:** 234 Abzeichen, jetzt fest eurem Konto zugeordnet, mit Zeitpunkt.
* **Online-Status:** „online“, „abwesend“ und „unsichtbar“ stimmen auch mit mehreren offenen Tabs.
* **Tickets, Abendplanung und Rückblicke** gehören jetzt eurem Konto statt einem Browser-Cookie und zeigen die Game-ID bekannter Spieler.

### Einstellungen und Datenschutz

* **Eine Einstellungsseite** für Darstellung, Ton, Kartengröße, Startseite und Privatsphäre. Mit Konto gelten die Einstellungen auf allen verbundenen Geräten.
* **Meine Daten:** Alles als Datei herunterladen oder das Konto löschen (mit Eingabe der eigenen Game-ID).
* **Datenschutzseite** (`/datenschutz`) in Deutsch und Englisch: was gespeichert wird, wie lange, wie man es löscht. IP-Adressen werden nicht gespeichert.

### Aussehen

* **Jedes Spiel hat eine eigene Spielwelt** mit passenden Farben, Tisch und Beschriftungen: vom Kneipentisch bei Mäxchen bis zur Holzwerkstatt bei Scrabble. Alles lässt sich auf dem Handy und am großen Bildschirm bedienen.
* **Die Konto-Seiten** (Profil, Einstellungen, Bestenliste, Erfolge, Admin) sehen jetzt aus wie die Startseite.
* **Die Startseite** zeigt die Roadmap (was fertig ist, was kommt) und „Was ist neu“.

### Computer-Mitspieler

Drei Stufen (leicht, mittel, schwer) in vielen Spielen, von Poker über UNO bis Schach und Kniffel. Die Computer sehen nie eure verdeckten Karten.

### Neue Abendformate

* **Party-Brett** (Laternenpfad: ein gemeinsames Brett, Minispiele bewegen euch weiter, Items wie Schub und Schild) und **Survival-Abend** (Nachtwache: jeder hat 1 bis 5 Leben, wer verliert, verliert ein Leben) – beide über *Abendprogramm planen*, für 2 bis 12 Personen.
* **Zusatzregeln für Partyspiele** (Schätzmeister, Schlagfertig, Wer hat das gesagt?): zum Beispiel doppelte oder umgedrehte Punkte, auf Wunsch zufällig als **Chaos-Modus**. Die Regel steht vor dem Start für alle sichtbar.

### Sicherheit

Ein gründlicher Durchgang (Bericht: [docs/security-review-2026-11-08.md](docs/security-review-2026-11-08.md)): Eingaben werden strenger geprüft, die Seite bremst Dauerabfragen und das Anlegen vieler Gastkonten, die Browser-Schutzeinstellungen (CSP und weitere Header) sind verschärft, und ein automatischer Test prüft für alle Spiele, dass niemand fremde Karten, Würfel oder Rollen sehen kann. Gefunden wurde dabei kein echtes Leck.

### Für den Server und die Admins

* **Funktionen ein- und ausschalten:** Unter `/admin` → *Funktionen & Spiele* lassen sich Discord-Anmeldung, Ranked, die (noch nicht gebaute) Kamera und **jedes einzelne Spiel** sofort ein- und ausschalten. Die Grundeinstellung steht in der `.env` (`FEATURE_DISCORD`, `FEATURE_RANKED`, `FEATURE_CAMERA`, `DISABLED_GAMES`). Ausschalten löscht nie etwas.
* **Admin-Seite:** Moderation von Rückblicken, Partien, Bestenliste, Tickets und Spielern (zusammenführen), Update ankündigen, Räume schließen, Protokoll aller Änderungen.
* **Update ohne Chaos:** Ein Banner kündigt Updates an, neue Runden starten dann nicht mehr, laufende werden fertig gespielt, danach speichert der Server alles und startet neu.
* **Version und Commit** stehen unter *Ich* und auf `/health`.
* **Neue Betriebsanleitung** ([docs/betrieb.md](docs/betrieb.md)): Server von null aufsetzen, Update vom alten Stand mit Migration Schritt für Schritt, Sicherung und Wiederherstellung, Fehlersuche, Hinweise für Traefik, alle `.env`-Einstellungen mit Beispiel.
* **Release-Check** (`scripts/release-check.sh`): prüft vor dem Aufspielen `.env`, Image-Version und Sicherung und danach den Healthcheck. Er verändert nichts.
* **Sicherung und Wiederherstellung** (`scripts/backup.sh`, `scripts/restore-test.sh`) mit Prüfung, dass sich eine Sicherung wirklich einspielen lässt.
* **Wichtig beim Update:** `docker-compose.yml` reicht jetzt alle `.env`-Werte an den Container durch (vorher kamen z. B. die Discord-Werte aus der `.env` dort nicht an). Die neue Datei zusammen mit dem Image aufspielen und `.env` um den Block „Funktionen“ ergänzen.

### Unter der Haube

* **Ein Befehl für alle Tests** (`npm run test:all`) mit Coverage und Zusammenfassung; derselbe Befehl läuft nachts in der Entwicklungs-Pipeline in Teilen parallel.
* Rund 1.900 automatische Prüfungen am Server und rund 950 im Browser (Desktop und Handy), dazu ein Sammeltest, der **jedes Spiel mit Computer-Mitspielern bis zum Ende spielt** und dabei die Ansichten auf Lecks prüft.
* Version **3.0.0**.

### Bekannte Lücken

* Bei 13 Spielen (Blackjack, Bröckelboden, Hex, Kronenjagd, Laser-Hüpfer, Mäxchen, Mühle, Schlagfertig, Schwimmen, Shut the Box, Wer hat das gesagt?, Würfelduell, Zehntausend) sind einzelne Texte im Spielfeld auch bei englischer Sprache noch deutsch.
* Die Kamera-/Video-Funktion ist nur als abschaltbarer Platzhalter vorbereitet und tut noch nichts.
* Konten, Tickets, Planungen und Rückblicke werden nicht automatisch nach einer Frist gelöscht; Löschen geht über *Einstellungen → Meine Daten* bzw. den Admin.

## 2.0.0 – 1. November 2026

Erste Version mit eigener Betriebsverwaltung: Admin-Seite `/admin`, Update-Ankündigung, Version und „Was ist neu“, Fehlermeldungen aus dem Browser, Sicherung und Wiederherstellung. Zu dem Zeitpunkt gab es 58 Spiele (55 Online- und Partyspiele sowie Sudoku, 2048 und Wellenwacht).
