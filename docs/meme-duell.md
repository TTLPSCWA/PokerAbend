# Meme-Duell

Partyspiel für drei bis zwölf Personen. Raumcode, Einladungen, Lobby, Reconnect, Zuschauer, Host-Menü und Ergebnisanzeige verwenden die bestehende Spielplattform.

| Modus | Ablauf |
| --- | --- |
| Meme trifft Text | Ein Bild und sieben private Textkarten pro Person. Die wechselnde Jury reicht nichts ein und entscheidet nach dem anonymen Aufdecken. |
| Memes Against Humanity | Eine Situation und fünf private Bildkarten pro Person. Die Gruppe bewertet fremde Einsendungen. |
| Meme Creator | Gemeinsame Vorlage mit bis zu drei eigenen Textfeldern. Position, Größe und Ausrichtung sind über beschriftete Eingaben verfügbar. Die anonyme Abstimmung folgt danach. |

Erstplatzierte erhalten jeweils einen Punkt. Sind am Ende mehrere Personen oben gleichauf, teilen sie den Sieg. Bei ausbleibenden Stimmen gibt es keinen Punkt. Zeitlimits laufen auf dem Server. Ein bereits abgesendeter Beitrag oder eine abgegebene Stimme kann nicht ein zweites Mal gebucht werden.

Der Host wählt Modus, Rundenzahl, Zeiten, Eignung, Pakete und Klangeffekte vor dem Start. Im Creator ist die wechselnde Jury als Alternative zur Gruppenwahl verfügbar. Die Plattform-Musik behält ihre persönliche Einstellung. Karteninhalte und eingebettete Bilder stammen aus den ansichtsbezogenen Serverzuständen. Bis zur Abstimmung sind fremde Beiträge verborgen. Autorennamen werden erst mit dem Rundenergebnis gezeigt. Der Server prüft für jede Aktion Rolle, Phase und Rundenschlüssel. Nach einem Browser-Reconnect bleibt die Mitgliedschaft am laufenden Tisch erhalten. Eine unterbrochene Serverinstanz stellt bei dieser Raumklasse die Lobby und gesicherten Raumeinstellungen wieder her.

Die sechs mitgelieferten Pakete sind eigene Inhalte. Das Paket „Trending“ ist eine lokale redaktionelle Auswahl von Situationen. Es enthält keinen Live-Trendfeed. Die Illustrationen sind im Renderer definiert. Der Creator kann eigene Ergebnisse als PNG exportieren.

Private Bilder liegen innerhalb der bestehenden Raumsicherung. Der Host kann bis zu vier Bilder zwischen Partien hinzufügen oder entfernen. PNG, JPEG und WebP werden im Browser mit Datei- und Dimensionsgrenzen dekodiert. Der Server akzeptiert ausschließlich ein fest begrenztes RGBA-Raster, erzeugt daraus selbst eine PNG-Datei und veröffentlicht keinen Bildpfad. Rohdateien und Metadaten bleiben im Browser. Das eigene Paket kann der Host getrennt einschalten.

## Externe Vorlagen

Offizielle GIPHY-Endpunkte liefern aktuelle Trends. GIPHY verlangt Attribution, schränkt das Zwischenspeichern und Wiederhosten ein und sieht direkte Client-Aufrufe vor. Die derzeitige Plattform nutzt ausschließlich Verbindungen zu sich selbst und übernimmt keine GIPHY-Medien. [GIPHY API und Integrationsregeln](https://developers.giphy.com/docs/api/)

Imgflip `get_memes` liefert einen Katalog populärer Vorlagen. Die Liste allein belegt weder aktuelle Trends noch die Nutzungsrechte einzelner Motive. Eine Bildübernahme erfordert eine gesonderte Prüfung. [Imgflip API](https://imgflip.com/api) · [Imgflip Nutzungsbedingungen](https://imgflip.com/terms)

Unter `/admin` lassen sich deutsch- und englischsprachige Beiträge für Community und Trending erfassen. Zur Freigabe sind Quellen- und Lizenzangabe, ein eingebautes Motiv sowie die ausdrückliche Bestätigung der Rechte und der Inhaltseignung erforderlich. Beiträge werden standardmäßig als ungeprüft gespeichert. Eine Deaktivierung verhindert die Auswahl bei künftigen Partien. Die Bibliothek liegt in `meme-packs.json` im normalen Datenverzeichnis.

Der deaktivierte Imgflip-Abruf lässt sich im Admin-Bereich einschalten. Der Server prüft stündlich, ob ein Abruf fällig ist, und speichert höchstens einen erfolgreichen Stand pro Tag. Nach einem Fehler pausiert der Abruf eine Stunde. Er kennt neuen Eintritt in die beobachtete Liste, Rangzuwachs und bekannte Popularität. Das sind Beobachtungen der Charts, keine belegten Erstveröffentlichungen. Doppelte Template-IDs und normalisierte Namen werden verworfen. Es werden keine externen Originalbilder heruntergeladen oder ins Spiel übernommen. Ein redaktionell freigegebener Beitrag verwendet eigenes Material. Der Host des jeweiligen Raums verwaltet private Bilder separat.

Prüfungen stehen in `test/meme-duell.test.js` und `test/ui/meme-duell.spec.js`.
