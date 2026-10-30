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
- [ ] 0: Baseline-Tests und Vorher-Screenshots abschließen.
- [ ] 1: Tokens, App-Rahmen, Navigation, Profil, Login und Dialoge.
- [ ] 2: Spielebibliothek und Startseite mit echten Daten.
- [ ] 3: Übrige Hub-Seiten und Formulare harmonisieren.
- [ ] 4: Gemeinsame Spielrahmen harmonisieren und alle 46 Spiele prüfen.
- [ ] 5: Vollständige Abnahme, Screenshots und Abschlussbericht.

## Testprotokoll

- `npm.cmd ci --no-audit --no-fund --fetch-retries=0 --cache artifacts/npm-cache`: erfolgreich. Der erste eingeschränkte Netzwerkversuch wurde beendet und mit freigegebenem Netzwerkzugriff wiederholt; keine Lockfile-Änderung.
- `npm.cmd test`: Baseline läuft, Ergebnis wird ergänzt.
- Repräsentative bestehende Playwright-Suites (Katalog, Navigation, Tickets/Admin und Spielrahmen): Baseline läuft, Ergebnis wird ergänzt.

Testergebnisse, tatsächliche Änderungen, Kompatibilitätsmatrix, Bildschirmgrößen und Screenshotpfade werden im Verlauf ergänzt. Temporäre Testserver verwenden `POKER_NO_DOTENV=1` und eigene temporäre Datenverzeichnisse; `.env` und produktive Daten werden nicht gelesen oder verändert.
