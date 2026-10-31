# Gemeinsamer Standard für individuelle Spielwelten

Stand: 31.10.2026. Pilot: [Scotland Yard](SCOTLAND_YARD_REDESIGN.md), Implementierungscommit `ef6511d76f78689fc525a63f6e3637c3f14f1252`. Zentrale Planung: [game-visual-roadmap.json](game-visual-roadmap.json); menschenlesbare Einzelpakete: [GAME_VISUAL_ROADMAP.md](GAME_VISUAL_ROADMAP.md).

## Auftrag und Status zuerst prüfen

1. Nur ein vom Nutzer ausdrücklich freigegebenes Spiel oder VIS-Paket bearbeiten. Spielname und technische ID über die JSON-Datei zuordnen; beispielsweise **Schiffe versenken → `schiffe` → `VIS-013`**.
2. `implementation_status`, `visual_status`, Varianten und Abhängigkeiten prüfen. `not_implemented` bedeutet: kein Frontend erfinden und keine Engine implementieren. Zuerst ist eine gesonderte Gameplay-Freigabe und tatsächlich fertige Implementierung erforderlich.
3. Die angegebenen Frontend-Dateien, gemeinsamen Komponenten und aktuelle Spiellogik lesen. Die Quellcodeinventur anderer Spiele ist keine manuelle visuelle Abnahme. Vor einer späteren Umsetzung echte Vorher-Bilder aufnehmen.
4. Den Umfang auf das freigegebene Spiel begrenzen. Vorhandene eigene Bretter, Karten, Becher und Illustrationen weiterverwenden und gezielt verbessern. Andere Spiele erhalten durch eine Änderung gemeinsamer Dateien kein ungefragtes Redesign.
5. Ausschließlich auf `main`, vor Schreibvorgängen und vor Commit/Push Remote abgleichen; keine Branches/PRs, kein Force-Push. Bekannte Deployment-Automatik vor einem Push prüfen; kein eigenständiges Produktivdeployment.
6. Nach Umsetzung Status, Testergebnisse, dauerhafte Bildnachweise und echten Implementierungscommit ergänzen und stoppen. Ein geplanter Eintrag enthält keine erfundenen Testergebnisse, Screenshots oder Commits.

`VIS-001` bis `VIS-095` wurden initial eindeutig vergeben. Neue Spiele später mit der nächsten freien VIS-Nummer ergänzen. Bestehende Nummern nicht wegen veränderter Importreihenfolge oder Prioritäten umnummerieren. VIS-IDs sind unabhängig von technischen Spiel-IDs und von `V2-XX`.

## Was gemeinsam bleibt

| Baustein | Gemeinsame Grundlage | Individuell pro Spiel |
| --- | --- | --- |
| Rahmen | Bestehende Raum-Navigation, Rollen, Pause, Panels, URL-/Reconnect-Verhalten | Farbwelt und dezentes Material innerhalb des Spiel-Roots |
| Lobby/Warten | Sitzplätze, Hostrechte, Min-/Maxspieler und Start bleiben serverbasiert | Eigene Briefing-Komposition über optionales `lobby(S)`; Standardfallback bleibt erhalten |
| Status | Eigener Zug, Phase und erlaubte Information aus persönlichem Zustand | Passende Begriffe: Stich, Fahndung, Setzrunde, Duell oder Zeichenphase |
| Aktionen | Vorhandene Socket-Ereignisse, Validierung, Tastatur und Bestätigungen | Fahrkarten, Chipsteuerung, Schreibkarte, Würfeltablett oder Zielauswahl |
| Spieler | Vorhandene Namen/Avatare, Host und verbundener Status | Nummerierte Marker und passende persönliche Anzeigen |
| Dialoge | Bestehende Fokus-/Schließ- und Rechteprüfung | Materialien und Hierarchie, ohne Pflichtdialoge zu verstecken |
| Buttons | Eindeutige Labels, Fokus und mindestens 44-Pixel-Aktionsflächen | Symbole und farbliche Akzente; keine bloße Farbe als einzige Bedeutung |
| Typografie | Plattformlesbarkeit und vorhandene lokale Fonts/Fallbacks | Serifenschrift für eine Ermittlungsakte, klare Sans für Arena oder Kartenwerte |
| Responsive | Unveränderter erreichbarer Dock-/Panelrahmen | Echtes Brett einpassen oder intern verschieben; alternative Zielaktionen |
| Bewegung | `prefers-reduced-motion` und persönliche Einstellung `prefs.calm` | Kurze reine Bestätigungseffekte; keine neue Zeit-/Trefferlogik |

Grundlagen: `public/games/kit.js`, `public/game-design.js/.css`, `public/ui-theme.css`, `public/style.css`. Poker/Omaha besitzen einen eigenen gemeinsamen Frontendpfad; Zeichnen, Solo und Echtzeit verwenden weitere gemeinsame Renderer. Die jeweils tatsächlich benutzten Dateien stehen pro Paket in der JSON-Datei.

## Eigenständige Gestaltung

- Jede Welt leitet sich aus ihrem Thema und ihren Entscheidungen ab. Casino, Seekarte, Holzbrett, Zahlenblatt, Atelier und Arena erhalten unterschiedliche Materialien und Kompositionen.
- Ein guter Hintergrund bleibt hinter dem Spielmaterial. Keine Fotos oder Texturen auf jeder Karte, keine Referenz-Screenshots als Hintergrund und keine offiziellen Originalpläne/Logos übernehmen.
- Lokale CSS-, SVG- und selbst erstellte Rasterassets verwenden. Herkunft/Lizenz bzw. eigene Erstellung dokumentieren. Keine externen Hotlinks und keine neue Buildpipeline als Voraussetzung.
- Erst räumliche Hierarchie und Lesbarkeit verbessern, dann Dekoration. Vorhandenes gutes Spielmaterial nicht neu erfinden, nur um überall die gleiche Gestaltung durchzusetzen.
- Keine 3D-Funktionen und keine neuen Gameplay-Funktionen aus einem visuellen Auftrag ableiten.

Der Pilot zeigt ein mögliches Materialsystem: dunkles Blau/Anthrazit, Papier und Messing, mit Georgia-Fallback für Aktenüberschriften. Diese Palette und die Detektivillustration sind ausschließlich Scotland Yard zugeordnet. Andere Spiele dürfen eine andere eigene Welt erhalten.

## Technische Grenzen und Geheimhaltung

- Spielzustände, legale Aktionen und Ergebnisse nur aus der persönlichen Serveransicht übernehmen. Keine Regeln, RNG, Kartenverteilung, Seeds, Kollisionsgeometrie, Ticketzahlen, Zeitfenster oder Wertungen aus Grafik neu berechnen.
- Darstellungskoordinaten dürfen sich ändern, wenn sämtliche logischen Felder, Nummern und Kanten erhalten bleiben und geprüft werden. Eine dekorative Straße darf keine scheinbar erlaubte Verbindung sein.
- Geheimnisse dürfen weder in verstecktem HTML noch in SVG-Attributen, Klassen, CSS-Variablen, Tooltips, Alttext, Dateinamen, Animationen, Kartenzentrierung oder zusätzlichen Nachrichten auftauchen.
- Hintergrund und Dekoration bleiben unabhängig von nicht freigegebenen Informationen. Unterschiedliche geheime Zustände müssen für unberechtigte Betrachter dieselbe öffentliche Darstellung erzeugen.
- Spielernamen und freie Texte escapen. Übersetzungen sind nur für verfasste UI-Beschriftungen vorgesehen; keine automatische Übersetzung von Namen, Antworten oder eigenen Fragen.
- Lokale Entwürfe, Zeichenstriche, Rezept-/Pfeilfortschritt und Kartenauswahl bei Pause, Reconnect und Sprachwechsel erhalten. Gemeinsame Zustandsänderungen benutzen weiter die bestehenden Funktionen.
- Änderungen gemeinsamer Renderer eng über Spiel-ID/Root bzw. optionale Haken begrenzen. Beispielsweise gelten Scotland-Yard-Styles unter `[data-scene='scotland-yard']` bzw. eindeutigem `sy-`-Namensraum. Das ist keine Freigabe für eine globale Farbänderung.

## Zustands- und Größenprüfung

Mindestens die tatsächlich existierenden Zustände ausführen: Lobby mit fehlenden Spielern, bereite Lobby, eigene Aktion, Warten, Gegner-/Zuschaueransicht, spezielle Aktions-/Aufdeckphasen, gemeinsame Pause, Wiederverbindung und Ergebnis. Relevante Varianten gehören dazu.

Mindestens **1920×1080, 1440×900, 768×1024, 390×844, 360×800 und 900×450** prüfen. Auf Handy zusätzlich Touch-/Bildschirmtastatur berücksichtigen. Der Seitenrahmen darf horizontal nicht überlaufen. Bei intern verschiebbaren Brettern bleiben erlaubte Ziele alternativ zugänglich. Ein kleiner Bildschirm darf nicht durch unlesbar kleine Kartenwerte passend gemacht werden.

Fokus, Tastatur, Kontrast, klare Text-/Formmarkierungen zusätzlich zu Farben, 44-Pixel-Aktionen und reduzierte Bewegung prüfen. Originale Spielbretter bei Bedarf intern verschieben. Kritische Hinweise und Pflichtaktionen bleiben außerhalb dekorativer Kartenränder erkennbar.

## Nachweise und Definition von done

- Isolierter lokaler Server mit temporären Daten; keine echten Nutzer-/Produktivdaten oder Secrets in Artefakte übernehmen.
- Vorher-/Nachher-Aufnahmen mit derselben Größe und Rolle, danach tatsächliche Sichtprüfung. Schwächen benennen, nachbessern und erneut aufnehmen.
- Vollständige lokale Artefakte können unter `artifacts/` bleiben. Ausgewählte aussagekräftige Vergleiche dauerhaft unter `docs/design/screenshots/<game-id>/` speichern und in der JSON-Datei referenzieren. Keine nur lokal existierenden Bilder als dauerhaften GitHub-Nachweis ausgeben.
- Passende vorhandene Engine- und Browserprüfungen ausführen; bei gemeinsamen Komponenten betroffene andere Spiele einbeziehen. Fehler und Nachprüfungen getrennt nennen, keine fehlgeschlagenen Gesamtläufe als grün ausweisen.
- Relevante Geheimhaltung im Serverzustand und erzeugtem DOM prüfen. Client-Symbole oder Materialanimationen dürfen kein Geheimnis früher zeigen.
- `visual_status: done` erst mit echten Resultaten, Bildreferenzen und tatsächlichem Implementierungscommit setzen. Das darf nicht zugleich den `implementation_status` eines geplanten Spiels auf spielbar setzen.
- Nach Abschluss die ausgewählte Paketbeschreibung, Prüfungen und Commitreferenzen aktualisieren; öffentliche Roadmap nur sachlich nachführen. Danach auf eine neue ausdrückliche Freigabe warten.

Gemeinsame Akzeptanz-IDs **G01–G10** stehen in der JSON-Datei. Sie ergänzen die individuellen Kriterien jedes Pakets. Stunden- und Prioritätsangaben sind Planungshilfen, keine Umsetzungsfreigabe oder garantierte Dauer.

## Öffentliche und interne Roadmap

`games/roadmap.js` enthält einen gebündelten Bereich „Neue Spielwelten & schönere Spieloberflächen“. Nur der geprüfte Scotland-Yard-Pilot ist darin erledigt; weitere Materialien, Hintergründe und Aktionsbereiche sind geplant. Die 95 Einzelpakete bleiben unter `docs/design/`; keine 95 zusätzlichen öffentlichen Etappen erzeugen.

Die historische V2-Planung unter `docs/roadmap/` bleibt unverändert. Diese Designplanung setzt kein V2-Paket um und macht kein Backlog-Spiel startbar.
