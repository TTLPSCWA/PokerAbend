# Monopoly: lokale Szenenintegration (ART-046 B–H)

Stand: 14. November 2026. Technische Anbindung **3.7.0**. Basis: Paket A `14b6c0f`, Paket F `4bc91dc` (3.6.0). Die generische Anbindung wird im Repository geführt; ihre Implementierungscommits stehen in der Git-Historie. Private Theme-Inhalte bleiben unveröffentlicht. Ein Commit/Push ist kein Serverdeployment.

Die vorhandene Engine und Spiel-ID bleiben bestehen. Standard und Tempowürfel können über die vorhandene Registry eine zusätzliche, extern bereitgestellte private Definition verwenden; Junior bleibt ausgeschlossen. Die normalen Prozesse registrieren weiterhin ausschließlich die öffentlichen Designs modern/classic. Die externe Definition trägt ausdrücklich `released: false`; ihre lokale Vorschau ist keine öffentliche Freigabe.

## Architektur

- `theme-layout.js`: V4-Projektion und Anker, 40 Feldrechtecke, acht kompatible Token-Slots; keine Preise, Mieten oder Spielregeln. Die Platzierung berücksichtigt belegte Gebäudeflächen und andere Figuren.
- `theme-renderer.js/.css`: optionale vorgerenderte Szene im vorhandenen Monopoly-Client; Namen aus dem Serverzustand, Wirtschaftswerte aus der unveränderten gemeinsamen `data.js`, Besitzer/Stufen/Aktionen aus dem persönlichen Serverzustand.
- Die vorhandenen Token-IDs bleiben unverändert. Private Figurennamen und Asset-IDs werden über die externe Präsentationsbeschreibung zugeordnet. Bestehende Speicher-/Reconnect-Zuordnungen bleiben gültig.
- `lastMove.path` liefert die Bewegungsfolge. Anfang und Ende werden an die V4-Sockelanker angebunden; dazwischen werden die tatsächlichen Felder durchlaufen. Eine bereits vorhandene Bewegung wird beim ersten Laden nicht erneut abgespielt. Reduzierte Bewegung nutzt unmittelbar die aktuelle Serverposition.
- Vorhandene Kauf-, Auktions-, Schulden-, Handels-, Bau-, Hypotheken- und Gefängnisaktionen bleiben erhalten. Das Grafikmodul ersetzt weder deren Regeln noch deren Socket-Ereignisse. Die Urkunden passen die vorhandenen Dialoge an.
- Die Spielerporträts werden in die bestehende Plattformleiste eingesetzt. Es entsteht keine zweite parallele Spielerleiste. Eigene Bretter behalten ihre 28 Namen; thematische Bilder können dann bewusst nicht zum individuellen Namen passen.
- Bilder werden mit Paket F verarbeitet. Brettkacheln verwenden die kleinen Varianten; Urkunden laden bei Bedarf. Hashbilder der privaten Vorschau werden nur `private, immutable` gecacht, ihre JSON-Metadaten `private, no-store`. Öffentliche Auslieferung behält die bisherige Cache-Regel.

## Geschlossene Veröffentlichungsgrenze

Die tatsächlichen privaten Definitionen, Vorlagen, Bildquellen, Bundles, Herkunftsnachweise, Testergebnisse und Screenshots liegen außerhalb des Git-Repositorys. Es befinden sich keine privaten Bildassets unter `public/` oder im Docker-Buildkontext.

`MONOPOLY_PRIVATE_THEME_DIR` aktiviert nur die lokale Vorschau eines externen Bundles. Der Start wird bei `NODE_ENV=production`, öffentlicher Bind-Adresse, Bundle innerhalb des Repositorys, ungeeignetem Datenverzeichnis, ungültigen Metadaten oder geänderten Bildprüfsummen abgewiesen. Private Testdaten müssen unter dem externen privaten Arbeitsbereich liegen. Der Listener bindet ausschließlich Loopback. HTTP und Socket.IO weisen fremde Hosts, nichtlokale Verbindungen und Forwarding-Header ab.

Eine fehlende Genehmigung wird nicht durch die Bezeichnung als Fanprojekt ersetzt. `release: draft`, `publication: private-only` und offene Lizenzangaben bleiben erhalten. `--publish` muss für diesen Stand scheitern. `released` wird nicht automatisch umgeschaltet. Ein Push der generischen technischen Anbindung liefert keine privaten Definitionen oder Assets mit; auch das daraus gebaute öffentliche Image enthält sie nicht. Die private Vorschau bleibt ausschließlich lokal.

## Nachweise und Grenzen

Automatische Regressionen: vorhandene Monopoly-/Varianten-/Theme-/Assettests, `monopoly-theme-layout.test.js`, `paeckchen9.spec.js`, die Monopoly-Fälle aus `paeckchen10.spec.js` und `monopoly-theme-build.spec.js`. Der externe lokale Audit ergänzt echte Mehrspieleraktionen, sieben Zielgrößen, alle Felder und Figurenanzahlen, Kartenwirkungsvergleich, Botpartien und Browserprüfungen. Private Screenshots sind ausdrücklich keine eingecheckten öffentlichen Nachweise.

Der private Abschlussbericht enthält die tatsächlich gelaufenen Prüfungen und ihre Grenzen. Ein vollständiger öffentlich ausgelieferter ART-Abschluss samt privaten Bildnachweisen bleibt bis zur Rechtefreigabe offen. Der Commit der generischen Anbindung ist keine Veröffentlichung des privaten Themes. Die V2-Roadmap und andere Spiele sind hiervon nicht betroffen.
