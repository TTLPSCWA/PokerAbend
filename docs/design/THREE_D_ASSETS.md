# Gemeinsame 3D-Assets

ASSET-3D-01 beginnt mit der dokumentierten, selbst erzeugten Poker-Filztextur. Sie liegt bei den vorhandenen Poker-Grafiken und wird im Manifest referenziert. Die Textur ist 128 × 128 Pixel groß und belegt 12.718 Bytes. Die eigene Herstellung ist im [Grafikregister](ART_LICENSES.md) dokumentiert.

`node scripts/verify-3d-assets.mjs` prüft das Manifest unter `public/assets/3d/` gegen die tatsächlich ausgelieferten Dateien. Version 1 führt Rastertexturen und prozedurale Geometrie mit unveränderlicher Asset-ID, Spielzuordnung, MIME-Typ, Lizenznachweis, Integrität und Größenbudget. Die ID bleibt bei einem Dateitausch stabil. Im öffentlichen Manifest stehen ausschließlich freigegebene Assets. Quellenlinks sind Provenienzangaben. Die Laufzeitpfade bleiben lokal.

Der Build prüft das Manifest vor der Bündelung. Die Rendererszenen verlangen die passenden freigegebenen Geometrie- und Material-IDs.

## Browserprobe

Eine isolierte Probe mit Babylon.js 9.38.0 und Havok 1.3.14 hat in Chromium, Firefox und WebKit echte WebGL2-Geometrie auf Basis von 60 Havok-Positionen dargestellt. Havok bleibt komplett im selben Ursprung ausgelieferten Worker. Die Seite empfängt Objekttransformationen. Nur die Antwort für den Worker erlaubt WASM-Kompilierung. Der Transfer eines vorkompilierten Moduls in den Hauptthread war in Firefox und WebKit ungeeignet.

Die Prototypgrößen betragen 1.547.947 Bytes JavaScript für die Seite (362.653 gzip), 35.825 Bytes für den Worker und 2.094.563 Bytes für Havok WASM. Das sind Messwerte des Versuchs. Der lokale Node-22-Imagebuild liefert Bundle, Worker, WASM, Lizenzhinweise, Manifest und Filztextur aus. Der Werkschutz wird bei jeder HTTP-Anfrage auf den genauen Workerpfad begrenzt.

Quellen für die Komponenten und Lizenztexte sind [Babylon.js](https://github.com/BabylonJS/Babylon.js/blob/master/license.md), [Havok](https://github.com/BabylonJS/havok) und [Content Security Policy Level 3](https://www.w3.org/TR/CSP3/#integration-with-webassembly).

## Gestaltung Poker

Warmer Holzrand, ein schmaler Messingring und ruhiger grüner Filz. Elfenbeinfarbene Karten und beleuchtete Keramikchips setzen sich vom Tisch ab. Die vorhandene Poker-Filztextur gibt die Körnung vor. Die Blickpunkte entlang der Tischachse lassen Karten und Pot im Zentrum.

## Gestaltung Kniffel

Gebürstetes Nussbaumholz, grünes Einlegefilz und elfenbeinfarbene Würfel mit eingelassenen dunklen Augen. Das Punkteblatt erhält eine warme Papierfarbe und bleibt unter dem Tablett. Der Zierstreifen trennt Ablage und Rollfläche. Das 2D-Layout übernimmt dieselbe Palette.

Für beide Szenen stammen Holzmaserung und Geometrie aus dem versionierten Projektgenerator. Die Dateigröße pro prozeduralem Asset bezeichnet dessen gemeinsamen Generator. Dreieckszahlen und Texturauflösung bezeichnen die Detailstufe mit der größten Geometrie.

## Betrieb und Verwendung

`npm ci` und `npm run build:3d` erzeugen die 3D-Dateien nach einem frischen Checkout. Für den lokalen Server anschließend `npm start` verwenden. Der Docker-Build installiert die festgeschriebenen Entwicklerpakete in einer eigenen Node-22-Stufe. Das Laufzeitimage erhält nur Bundle, Worker, WASM und Lizenzhinweise. Die Seite und das 2D-Spiel laden diese Ressourcen erst bei aktivierter 3D-Ansicht.

Die 3D-Schaltfläche öffnet die Darstellung direkt im Tisch. Zwei Klicks wechseln hin und zurück, ohne die Partie neu zu starten. Hold’em bietet Ansichten für den gesamten Tisch, den eigenen Platz, die Gemeinschaftskarten und den Pot. Stapel lassen sich im Bild oder über eine Auswahlliste prüfen. Ihre exakten Werte bleiben als Text ablesbar. Die vorhandenen Einsatzknöpfe, Gastgeberfunktionen und Tastaturaktionen bleiben im DOM.

Kniffel zeigt die Schale über dem Punkteblatt und legt gehaltene Würfel auf der hinteren Ablage ab. Der Worker berechnet kurzlebige visuelle Körper. Das Ergebnis und die Hold-Auswahl kommen aus dem bestätigten Spielzustand. Nach der Animation richtet die Darstellung jeden Würfel auf seinen bestätigten Wert aus. Triple und die beiden vorhandenen Hausregeln sind im Hostdialog erklärt. Die scrollbare Würfelschale gibt den gerenderten Babylon-Frame über einen sichtbaren Canvas aus. Das trennt die WebGL-Zeichenfläche von der Seitendarstellung und hält die Würfel auch in WebKit sichtbar.

Der Client entlädt Canvas, Beobachter, Texturen und Worker beim Verlassen oder Wechseln. Auf verdeckten Tabs hält der Renderloop an. Geräte mit anhaltend niedriger Bildrate reduzieren zuerst die Auflösung. Bei fehlendem WebGL2, verlorenen Grafik-Kontexten oder fehlender Kniffel-Physik bleibt 2D nutzbar. Die Einstellung „Ruhig“ und die Systemeinstellung für reduzierte Bewegung verwenden 2D. Fremde verdeckte Karten werden als Rückseiten ohne ihren Wert an den Renderer weitergegeben.

Der Renderer setzt bei Fehlern feste lokale Diagnosecodes am Szenenelement und in der Browserkonsole. Die Codes unterscheiden Abruf und Referenz von Assets, WebGL2-Kontext, Babylon-Start, Havok-Start, Rendering, Zeitlimits und Kontextverlust. Sie enthalten keine Spielernamen, URLs, Browserkennung oder Exception-Texte. Der [Firefox-CI-Nachweis](../crossbrowser-qa.md#firefox-3d-im-linux-workflow) erklärt die Linux-Grafikumgebung.

## Vorlage für einen weiteren 3D-Auftrag

Gegeben sind eine ausdrücklich freigegebene Spiel-ID und ihre bestehende Ansicht. Ermittle die autoritativen Serverfelder und projektiere ausschließlich sichtbare Daten. Verwende den vorhandenen 3D-Adapter, die Worker-Isolation und die freigegebenen Assets. Ergänze spielbezogene Darstellung, Bedienung, persistente 2D-Auswahl und den Nachweis von geheimen Daten, Spielzustand, Canvas-Entfernung und Version. Prüfe reale Spielfolgen, sichtbare Geometrie und Fallbacks in Chromium, Firefox und WebKit. Für neue Inhalte sowie Commit, Push und Deployment gelten die Freigaben des jeweiligen Auftrags.
