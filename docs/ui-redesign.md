# UI-Redesign – Arbeits- und Abnahmeprotokoll

## Ausgangspunkt und Auftrag

- Ausgangs-Commit: `9b60e30`, 46 registrierte Spiele; das gelieferte Paket beschreibt den älteren Stand `55abf04` mit 45 Spielen.
- Feature-Branch: `feat/liquid-glass-game-library`. Keine Veröffentlichung auf main, GHCR oder dem Produktivserver.
- `PROMPT.md` vollständig aus dem gelieferten ZIP übernommen. `design/referenz-game-library.png` dient ausschließlich dem visuellen Vergleich und wird nicht in der Oberfläche verwendet.
- Architektur: Express/Socket.IO, Vanilla JavaScript, bestehende Shared Kits. Regeln, RNG, Zugrechte, Authentifizierung, Speicher und Deployment bleiben erhalten.

## Audit und Verträge

| Bereich | Bestehende Zuständigkeit / erhaltene Verträge |
| --- | --- |
| Katalog | `games/index.js` → `/me` → `account.games`; vier reale Kategorien, aktuell 46 Spiele |
| Hub | `public/hub.js`, `public/hub.css`, `#hub`, `#hub-main`, `#side-nav`, `#hub-tabbar`, Hash-Routen |
| Auswahl | `#games-body`, `[data-id]`, `[data-host]`, `[data-fav]`, Suche, Filter, Liste/Kacheln, gespeicherte Sortierung |
| Hosten | `openHost(id)`, `#host-dlg`, `#host-form`, Varianten und bestehende Einstellungen |
| Lokale Daten | `poker:favs`, `poker:recent`, Profil und Präferenzen; kein serverseitiges Konto |
| Räume | Lobby und `peek` mit vorhandenem Token; Weiterspielen ausschließlich für bestätigte Räume |
| Präsenz | Echte Lobby-/Presence-Ereignisse, private Sichtbarkeit, keine Freundesliste |
| Spielrahmen | `kitGame`, darauf Party-, Solo-, Zeichen- und Echtzeit-Kits; `#kg-main`, `#kg-dock`, Panels |
| Poker/Omaha | Eigener Frame in `public/games/poker/`, bestehende Filz-/Nacht-Themes und Handkarten |
| Darstellung | `GameDesign.scene/apply/watch/fit/cue`, Kartengrößen und reduzierte Bewegung |
| Weitere Seiten | Tickets/Admin, Planung, Rückblick, Bestenliste, Erfolge, Roadmap; bestehende APIs und Selektoren |
| PWA | Bestehendes Manifest, Icons und Service Worker ohne Offline-Cache |

## Gestaltungsrichtung und Assets

Die Referenz gibt Sidebar, großzügige Typografie, dunkle transluzente Flächen, eine ruhige Bibliothek und kleine einzelne Spielillustrationen vor. Die Umsetzung verwendet echte Inhalte und die vorhandenen eigenen SVGs aus `games/art-kit.js`. Beispielspiele, Profile, Ranglisten und Benachrichtigungen aus dem Bild werden nicht übernommen.

Es liegt **kein separates freigegebenes Spielezimmer-Foto** bei. Deshalb entsteht die gemeinsame Hintergrundatmosphäre aus CSS-Verläufen. Kein Hotlink, keine Bildtapete pro Spiel und keine Nutzung des Referenzbilds als Hintergrund. Eine spätere separat lizenzierte Aufnahme bleibt optional.

## Etappen

- [x] 0: Auftrag, Referenz und aktuellen Stand prüfen; Feature-Branch anlegen.
- [x] 0: Baseline-Tests und Vorher-Screenshots abschließen.
- [x] 1: Tokens, App-Rahmen, Navigation, Profil, Login und Dialoge.
- [x] 2: Spielebibliothek und Startseite mit echten Daten.
- [x] 3: Übrige Hub-Seiten und Formulare harmonisieren.
- [ ] 4: Gemeinsame Spielrahmen harmonisieren und alle 46 Spiele prüfen.
- [ ] 5: Vollständige Abnahme, Screenshots und Abschlussbericht.

## Testprotokoll

- `npm.cmd ci --no-audit --no-fund --fetch-retries=0 --cache artifacts/npm-cache`: erfolgreich. Der erste eingeschränkte Netzwerkversuch wurde beendet und mit freigegebenem Netzwerkzugriff wiederholt; keine Lockfile-Änderung.
- `npm.cmd test`: Baseline 730/731. Im vorhandenen Tempowürfel-Test war Ziel 17 ein Gemeinschaftsfeld, dessen zufällige Karte die Position ändern konnte. Der Test startet nun auf 8 und landet ausschließlich auf Grundstücken. Keine Änderung an der Spiellogik. Gezielte Suite danach: 13/13. Vollständige Wiederholung nach dem UI-Umbau: **731/731**.
- Repräsentative bestehende Playwright-Suites (Katalog, Navigation, Tickets/Admin und Spielrahmen): Baseline **46/46**, nach Etappen 1–3 ebenfalls **46/46**.
- `node scripts/capture-ui-redesign.mjs before`: 12 Vorher-Bilder, keine Browserfehler. `after` ebenfalls 12 Bilder; finale Aufnahme folgt nach dem Feinschliff.

Testergebnisse, tatsächliche Änderungen, Kompatibilitätsmatrix, Bildschirmgrößen und Screenshotpfade werden im Verlauf ergänzt. Temporäre Testserver verwenden `POKER_NO_DOTENV=1` und eigene temporäre Datenverzeichnisse; `.env` und produktive Daten werden nicht gelesen oder verändert.

## Umgesetzte Komponenten und Tokens

| Datei | Tatsächliche Änderung |
| --- | --- |
| `public/style.css` | Gemeinsame Farbvariablen, CSS-Hintergrund, smaragdgrüne Hauptaktionen, Login ohne Holzrahmen; vorhandene Karten-/Filzvariablen erhalten |
| `public/ui-theme.css` | Gemeinsame Theme-Schicht für Hub, Navigation, Katalog, echte Tabellen/Karten, Formulare, Dialoge und Spielrahmen; keine kopierten Spieloberflächen |
| `public/ui-theme.js`, `public/core.js` | Wiederverwendbare lokale Darstellungseinstellungen, sofortige Anwendung nach `savePrefs`, Systempräferenzen für Transparenz/Bewegung |
| `public/index.html`, `public/hub.js` | Desktop-Header, Bibliotheksnavigation, vollständiges mobiles Bereichsmenü, konkreter Spiele-Picker vor dem bestehenden `openHost`, Profil-Einstellungen |
| `public/hub.js` | Startseite mit maximal zwei hervorgehobenen echten Tischen, vier Katalogspielen, drei lokalen Favoriten/zuletzt geöffneten Spielen; Links zu vollständigen Ansichten; Präsenz und Einladungs-Code |
| `public/hub.js` | Kacheln als Standard für neue Browser, gespeicherte Listenansicht bleibt erhalten; echte Kategorie-Chips und zugängliche Spieltitel-Buttons |
| `public/games/kit.js`, `public/games/poker/poker.js` | Ausschließlich zusätzlicher Darstellungs-Schalter im bestehenden Ich-Panel |
| `test/monopoly-variants.test.js` | Bereits vor dem Umbau gefundene zufällige Testabhängigkeit beseitigt, keine Regeländerung |
| `test/ui/ui-redesign.spec.js` | Zusätzliche funktionale und responsive Abnahme, echte Spielstarts mit zusätzlichen Testverbindungen |
| `scripts/capture-ui-redesign.mjs` | Reproduzierbare lokale Vorher-/Nachher-Aufnahmen mit eigener temporärer Datenbasis |

Wichtige Tokens: `--bg: #101815`, `--panel: #1A2521`, `--panel-2: #24332D`, `--line: #FFFFFF1C`, `--text: #F2F0E9`, `--text-2: #B3BDB5`, `--accent: #32765B`, `--accent-hover: #3D896A`, `--gold-text: #E0BC74`. Die vorhandene Klasse `btn-brass` bleibt als DOM-Vertrag erhalten und verwendet jetzt die gemeinsame Primärfarbe. Status-/Gefahrenfarben und Spielmaterialien behalten ihre Bedeutung.

`--glass` und `--glass-blur` begrenzen Glas auf große Hub-Flächen und Dialoge: maximal 12 px, mobil 6 px, keine Filter auf jeder Spielkachel. Die Basis ist deckend und bleibt ohne `backdrop-filter` lesbar. „Glaseffekt reduzieren“ setzt deckende Flächen und entfernt den Filter. Die Systempräferenzen werden ebenfalls berücksichtigt. Bricolage bleibt lokal; Georgia verwendet die Systemschrift für Überschriften. Keine neue Abhängigkeit, kein externer Font, keine 3D-Bibliothek.

Die Präferenzen bleiben unter `poker:prefs`; Favoriten, lokale zuletzt geöffnete Spiele und die Ansichts-/Sidebarwahl verwenden ihre bestehenden Schlüssel. Der lokale Verlauf ist ausdrücklich **keine** Liste laufender Tische. Weiterspielen verwendet weiterhin nur mit Token bestätigte Serverräume. Private Räume, Authentifizierung, Ticket-Admin, Socket-Ereignisse, Spiele/RNG und Datenformate wurden nicht geändert.

## Screenshot-Abnahme

Die Bilder liegen absichtlich unter dem bereits ignorierten Verzeichnis `artifacts/`; sie enthalten ausschließlich temporäre Testdaten. Reproduktion: `node scripts/capture-ui-redesign.mjs after`.

| Ansicht | Vorher | Nachher |
| --- | --- | --- |
| Home Desktop | [Bild](../artifacts/ui-redesign/before/desktop-home.png) | [Bild](../artifacts/ui-redesign/after/desktop-home.png) |
| Bibliothek Desktop | [Bild](../artifacts/ui-redesign/before/desktop-library.png) | [Bild](../artifacts/ui-redesign/after/desktop-library.png) |
| Spiel Desktop | [Kniffel](../artifacts/ui-redesign/before/desktop-kniffel.png) | [Kniffel](../artifacts/ui-redesign/after/desktop-kniffel.png) |
| Tickets Desktop | [Bild](../artifacts/ui-redesign/before/desktop-tickets.png) | [Bild](../artifacts/ui-redesign/after/desktop-tickets.png) |
| Home Mobil | [Bild](../artifacts/ui-redesign/before/mobil-home.png) | [Bild](../artifacts/ui-redesign/after/mobil-home.png) |
| Bibliothek Mobil | [Bild](../artifacts/ui-redesign/before/mobil-library.png) | [Bild](../artifacts/ui-redesign/after/mobil-library.png) |
| Spiel Mobil | [Kniffel](../artifacts/ui-redesign/before/mobil-kniffel.png) | [Kniffel](../artifacts/ui-redesign/after/mobil-kniffel.png) |
| Tickets Mobil | [Bild](../artifacts/ui-redesign/before/mobil-tickets.png) | [Bild](../artifacts/ui-redesign/after/mobil-tickets.png) |

Zusätzlich: Login und Ticket-Details auf Desktop/Mobil; responsive Ansichten unter `artifacts/ui-redesign/responsive/`, echte aktive Spielansichten unter `artifacts/ui-redesign/games/`. Die Referenz wurde visuell verglichen: Sidebar, großzügige Serif-Überschriften, dunkle ruhige Flächen, kleine einzelne Spielillustrationen und warme Akzente wurden aufgegriffen. Das nicht separat gelieferte Spielezimmerfoto und erfundene Inhalte des Mockups wurden nicht übernommen.

## Veröffentlichung: ausschließlich spätere Anleitung

In dieser Arbeit wird nichts gepusht, kein Workflow ausgelöst und kein Produktivserver kontaktiert. Nach eigener Prüfung/Freigabe kann der Branch regulär nach `main` übernommen werden. Der bestehende Workflow `.github/workflows/docker.yml` prüft dann die Node-Tests und veröffentlicht `ghcr.io/ttlpscwa/pokerabend:latest`. Erst nach einem grünen Build auf dem Server ausführen:

```sh
cd /opt/poker
# Vorher reguläres Backup des vorhandenen poker-data-Volumes erstellen.
# IMAGE muss auf das freigegebene GHCR-Image zeigen, bestehende Server-.env erhalten.
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull poker
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build poker
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 poker
```

Das vorhandene externe Traefik-Netz `proxy` und `poker-data` bleiben erhalten; kein `down -v`. Für eine gezielte Rücknahme ein zuvor geprüftes Image per `IMAGE` auswählen und denselben `up -d --no-build`-Schritt verwenden. Diese Befehle wurden hier **nicht ausgeführt**.
