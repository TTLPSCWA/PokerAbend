# PokerAbend
PokerWebsite

Texas Hold'em No-Limit für die Freundesgruppe, im Browser und online spielbar. Der Server ist Geber und Schiedsrichter: Er mischt, teilt aus, prüft jede Aktion, bildet Main und Side Pots und zahlt automatisch aus.

## Schnellstart

### Lokal mit Docker (empfohlen)

```bash
docker compose up --build
```

Danach `http://localhost:3000` öffnen. Zum Testen mit mehreren Spielern einfach ein zweites Browserfenster im Inkognito-Modus nehmen.

### Lokal ohne Docker

```bash
npm install
npm start          # oder: npm run dev (startet bei Änderungen neu)
npm test           # Engine- und Servertests
```

Voraussetzung ist Node.js 20 oder neuer.

## Online stellen

//1. **Image bauen und pushen**  

   ```bash
   docker build -t ghcr.io/DEIN-NAME/pokerabend:latest . 
   docker push ghcr.io/DEIN-NAME/pokerabend:latest
   ```

   Alternativ das Repo auf GitHub legen (z. B. [https://github.com/TTLPSCWA/PokerAbend](https://github.com/TTLPSCWA/PokerAbend)): Der Workflow in `.github/workflows/docker.yml` testet bei jedem Push auf `main` und schiebt das Image automatisch nach `ghcr.io`.
   Die Dateien `docker-compose.yml`, `docker-compose.prod.yml`, `Caddyfile` und `.env.example` hochladen.

   ```bash
   cp .env.example .env            # DOMAIN und IMAGE eintragen
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

   Die Domain muss per DNS-A-Record auf den Server zeigen. Caddy holt das HTTPS-Zertifikat dann automatisch.

//3. **Update einspielen:** neues Image pushen, auf dem Server wieder `pull` und `up -d`.

**Anmeldung:** Über das Gruppenpasswort `SITE_PASSWORD`. Auf dem Server ist es in der `.env` Pflicht, ohne startet nichts. Lokal ohne `SITE_PASSWORD` ist die Seite offen (nur zum Testen).

Tische und Chipstände liegen im Docker-Volume `poker-data` und überleben Neustarts. Gespeichert wird immer zwischen zwei Händen. Nach einem Neustart drückt der Host einmal auf „Spiel starten“.

## Was V1.0 kann

| Bereich | Funktionen |
| --- | --- |
| Lobby | Tisch erstellen, Einladungslink mit Code, Name + Avatar, keine Anmeldung |
| Spiel | Automatisches Mischen (Krypto-Zufall) und Austeilen, Blinds, Button wandert, Heads-up-Regeln, Big-Blind-Option |
| Aktionen | Fold, Check, Call, Bet, Raise, All-in, Slider + ½ Pot / ¾ Pot / Pot / All-in, Tastenkürzel F / C / R, Controller (A / B / X, LB / RB, Start) |
| Am Zug | „Du bist dran“ über der Aktionsleiste, große Restzeit (letzte 8 s rot), Ton, blinkender Tab-Titel, auf Wunsch Browser-Benachrichtigung |
| Vorab-Aktionen | Check/Fold, Check, Call beliebig, Fold – nur für die laufende Hand, auf dem Server ausgeführt (greift auch bei kurzem Verbindungsabbruch) |
| Blinds | Fest oder steigend: alle X Minuten oder alle X Hände, Vorlagen Schnell / Normal / Lang oder eigene Liste. Anzeige oben „Nächstes Level in 4:32 – 100/200“, neues Level erst ab der nächsten Hand, Uhr steht vor dem Start, beim Anhalten und in der Pause |
| Gewinnchancen | Host wählt: aus, nur eigene (während der Hand, nur aus eigenen Karten und Board) oder nach der Hand (für alle gezeigten Hände, pro Straße). Persönlich abschaltbar |
| Chips verschenken | Mit Nachricht, der andere muss zustimmen, nur zwischen zwei Händen, gilt 60 s, Host kann es abschalten. Am Plus/Minus ändert es nichts |
| Anstupsen | Nach 10 s automatisch, außerdem per 👉 am Panel (höchstens alle 10 s), Sprüche im Host-Menü editierbar, Host-Schalter |
| Chips | Einsätze vor jedem Spieler, fliegen nach der Setzrunde in den Pot, Main + Side Pots, Rückgabe nicht gecallter Chips, Split Pot mit Rest-Chip-Regel |
| Showdown | Handauswertung mit Kicker, Siegerkarten markiert, „Karten zeigen“ nach Gewinn ohne Showdown |
| Verbindung | Reconnect mit gleichem Platz und Chips, zweiter Tab verdrängt den ersten, doppelte Aktionen werden ignoriert, Timeout checkt oder foldet |
| Host | Start, Pause, nächste Hand, Blinds, Startchips, Nachkaufen (aus / max. X / unbegrenzt), neues Spiel (alle auf Startchips, alter Abendstand bleibt im Verlauf), Zeit pro Zug, Pause zwischen Händen, Handanzeige erlauben, Spieler entfernen, Host weitergeben, Chips korrigieren (wird im Verlauf vermerkt) |
| Spieler | Pause / zurück, Aufstehen nach der Hand (danach eine Hand aussetzen), Nachkaufen, eigene Karten nach dem Fold weiter sichtbar, Kartengröße, eigene Karten auch am Platz, freche Sprüche beim Folden statt Checken, Vier-Farben-Deck, Handanzeige, Beträge in BB, Töne, Animationen aus, grüner oder blauer Tisch |
| Verlauf | Ganzer Abend (die letzten 500 Hände, übersteht Neustarts), nach Händen gruppiert und einklappbar, neueste oben. Filter: Aktionen, Gewinne, Karten, System, Reaktionen; Suche nach Spielername. Liegt pro Tisch in `data/history-CODE.json` |
| Extras | Gewinnmoment mit Chip-Regen und großem Betrag (stärker ab 50 BB oder Full House), Reaktionen (👍 😂 GG …), Abendstand mit Plus/Minus, größter Pot, beste Hand |
| Handy | Eigene Hochformat-Ansicht mit großen Buttons |

## Zugangsschutz

| Schutz | Wie |
| --- | --- |
| Seitenpasswort | Ohne Passwort gibt es nur die Passwort-Seite. Seite, Dateien und die Echtzeit-Verbindung sind gesperrt. |
| Browser merkt es sich | Signiertes Cookie (`HttpOnly`, `SameSite=Lax`, `Secure` unter HTTPS), 180 Tage gültig und bei jedem Besuch verlängert. Abmelden geht unter „Ich“. |
| Rausfliegen ohne Folgen | Bei Verbindungsabbruch oder Server-Neustart verbindet die Seite sich selbst neu: kein Passwort, gleicher Platz, gleiche Chips – solange man innerhalb von 5 Minuten zurück ist. |
| Wer wegbleibt | Nach 5 Minuten offline fliegt der Spieler mit allen Daten raus (Platz frei, Chips weg). In einer laufenden Hand foldet er und verschwindet nach der Hand. Ist es der Host, übernimmt ein anderer – das passiert schon nach 30 Sekunden. Ist niemand mehr da, wird der Tisch gelöscht. Frist änderbar über `PLAYER_TIMEOUT_MIN`. |
| Einladungslink | Wer den Link ohne Cookie öffnet, gibt einmal das Passwort ein und landet direkt am richtigen Tisch. |
| Passwort ändern | Alle alten Cookies werden ungültig. Das Passwort steckt in der Signatur. |
| Passwort raten | Nach 8 Fehlversuchen ist die IP für 15 Minuten gesperrt. |
| Tisch-Codes raten | Nach 20 falschen Codes ist die IP für 10 Minuten gesperrt. |
| Spam | Max. 6 neue Tische und 15 neue Namen pro IP in 10 Minuten, max. 30 Verbindungen pro IP, max. 50 Tische insgesamt. |
| Event-Flut | Pro Verbindung kurz 40, dauerhaft 8 Nachrichten pro Sekunde, danach Ablehnung, bei Dauerfeuer Trennung. Pakete max. 16 KB. |
| Fremde Webseiten | Socket-Verbindungen nur von der eigenen Domain (Origin-Prüfung), kein Einbetten in fremde Seiten. Header: CSP, `X-Frame-Options`, `nosniff`. |
| Kaputte Eingaben | Alle Werte werden auf dem Server geprüft. Namen ohne Steuerzeichen, Fehler in einem Handler reißen den Server nicht mit. |

Getestet wird das in `test/security.test.js`.

## Aufbau

Die Seite ist eine Plattform für mehrere Spiele. Gemeinsam sind Passwort-Login, Startseite und Lobby, Raumcodes, Spielerverwaltung, Reconnect, Speichern, Verlauf und Sicherheit. Jedes Spiel bringt seine eigene Engine und Oberfläche mit.

```
server/            Plattform (für alle Spiele gleich)
  index.js           Express + Socket.IO: Anmeldung, Lobby, Ereignisse, Speichern, Aufräumen
  base-room.js       Grundlage jedes Raums: Spieler, Host, Wegbleiben, Verlauf
  codes.js           Raumcodes, zentral für alle Spiele (nie doppelt)
  security.js        Passwort-Cookie, Rate-Limits, Header, Texte säubern
  env.js             liest die .env ein (ohne Zusatzpaket)
  login.html         Passwort-Seite
games/             Spiele (Server-Teil)
  index.js           Liste aller Spiele
  poker/
    index.js           Beschreibung fürs Menü, Ereignisse, Raum erstellen/laden
    room.js            Pokertisch: Timer, Hände, Blinds, Geschenke, Ansicht pro Spieler
    blinds.js          steigende Blinds
    sebastian.js       Easter Egg „Waiting for Sebastian“
    engine/            Poker-Regeln ohne Netzwerk: cards.js (Deck, Bewertung, Chancen), table.js (Setzrunden, Pots)
public/            Browser
  index.html         Startseite mit Spielauswahl, Dialoge
  core.js            Startseite, Lobby, Verbindung, Dialoge, Hilfen – lädt das gewählte Spiel nach
  style.css          gemeinsames Aussehen (Tokens, Buttons, Leisten, Seitenleiste, Verlauf)
  games/poker/       poker.js (Tisch-Oberfläche) und poker.css
test/              node:test – Engine inkl. 100.000 Zufallshänden, Räume, Server, Sicherheit, Plattform
```

Jede Testdatei mit eigenem Server hat einen eigenen Portbereich, weil `npm test` die Dateien parallel ausführt: `server` 4000–4049, `security` 4050–4099, `sebastian` 4100–4149, `away` 4150–4199, `codes` 4200–4249, `history` 4250–4299, `platform` 4300–4349. Neue Dateien bekommen den nächsten freien Fünfziger-Block.

## Ein neues Spiel hinzufügen

Beispiel Mau-Mau mit der ID `maumau` (nur Kleinbuchstaben, Ziffern und Bindestrich):

1. **Server:** `games/maumau/index.js` anlegen und in `games/index.js` eintragen.

   ```js
   import { Room } from './room.js';
   export default {
     id: 'maumau', name: 'Mau-Mau', description: 'Ablegen, aussetzen, Farbe wünschen.', players: '2–6 Spieler',
     createFields: [{ key: 'cards', label: 'Karten pro Spieler', type: 'number', min: 3, value: 6 }],
     createHint: 'Alles andere stellst du im Raum ein.',
     create: (code, settings, onChange) => new Room(code, settings, onChange),
     restore: (data, onChange) => Room.restore(data, onChange),
     events: { play: (room, p, { card }) => room.play(p.id, card), draw: (room, p) => room.draw(p.id) },
   };
   ```

2. **Raum:** `games/maumau/room.js` mit `class Room extends BaseRoom` (aus `server/base-room.js`). Spieler, Host, Wegbleiben und Verlauf sind damit schon da. Das Spiel füllt die Haken:

   | Haken | Wofür |
   | --- | --- |
   | `view(playerId)` | Was dieser Spieler sehen darf – **nur das**. Fremde Karten nie mitschicken. |
   | `snapshot()` / `static restore(data, onChange)` | Speichern und nach einem Neustart laden. |
   | `get round()` | Nummer der laufenden Runde (der Verlauf gruppiert danach). |
   | `get busy()` | Läuft gerade eine Runde? Dann wird nicht gespeichert. |
   | `playerFields()` | Spielfelder für neue Spieler (z. B. Handkarten). |
   | `leaveGame(p)` | Beim Entfernen aufräumen; `true` = erst nach der Runde entfernen. |
   | `afterChange()` | Läuft nach jedem Ereignis (Timer, automatische Züge). |
   | `dispose()` | Timer stoppen, wenn der Raum gelöscht wird. |

   Mit `this.say(text, kind, cat)` kommt etwas in den Verlauf. Die Kategorien für die Filter sind `action`, `win`, `cards`, `system` und `react`. `this.onChange('state')` zeichnet alle neu, `this.onChange('ereignis', { to: spielerId, … })` geht nur an einen Spieler. Die Plattform-Ereignisse `create`, `join`, `kick`, `makeHost`, `history` und `react` darf ein Spiel nicht belegen; der Server bricht sonst beim Start ab.

3. **Browser:** `public/games/maumau/maumau.js` und `maumau.css`. Das Skript zeichnet seine Oberfläche in `#game-root` und meldet sich an:

   ```js
   'use strict';
   $('#game-root').innerHTML = `<div id="game">…</div>`;
   registerGame('maumau', {
     show() { /* einblenden, zeichnen */ },
     onState(state) { /* neuer Stand vom Server */ },
     onPrefs() { /* persönliche Einstellungen geändert */ },
   });
   ```

   Aus `core.js` stehen bereit: `$`, `$$`, `esc`, `send(ereignis, daten)`, `toast`, `ask` (Dialog), `beep`, `store`, `prefs` mit `usePrefs({ … })` und `savePrefs()`, `socket` und `ICON`. Das Aussehen baut auf `style.css` auf. Inline-Skripte und `onclick=""` gehen wegen der CSP nicht.

4. **Tests:** `test/maumau.test.js` für die Regeln (Raum direkt, ohne Server). Mit Server: einen freien Portbereich nehmen (siehe oben).

5. **Docker:** nichts zu tun, `games/` und `public/` werden komplett kopiert.

### Geplante Spiele

Eigene Namen und eigenes Design, denn Uno, Skip-Bo, Phase 10 und Mensch ärgere Dich nicht sind geschützte Marken. Die Regeln stimmen wir vor jedem Spiel ab.

1. **Mau-Mau** (frei nutzbar): erster Testfall für die Modul-Architektur
2. **Farbenchaos** (Uno-ähnlich, Arbeitstitel): baut auf Mau-Mau auf (gleiche Ablage- und Zieh-Logik, eigene Karten)
3. **Mäxchen** und **Schocken**: Würfelspiele, schnell und gesellig
4. **Hütchenrennen** (Mensch-ärgere-dich-ähnlich, Arbeitstitel): braucht eine Spielbrett-Oberfläche
5. **Zehn Etappen** (Phase-10-ähnlich, Arbeitstitel)
6. **Stapelrennen** (Skip-Bo-ähnlich, Arbeitstitel)

Weitere Ideen: Schwimmen/31, Blackjack mit unseren Chips, Würfelpoker mit Punkteblatt, Werwolf, Montagsmaler.

**Wichtig für die Fairness:** Der Browser bekommt nur seine eigenen Karten. Gegnerkarten verlassen den Server erst beim Showdown. Das prüft `test/server.test.js`. Das gilt für jedes Spiel: Was ein Spieler nicht sehen darf, gehört nicht in `view()`.

## Abweichungen vom Pflichtenheft

- **Kein React, kein TypeScript:** Die Oberfläche ist reines JavaScript ohne Build-Schritt. Das hält Docker-Image und Einstieg klein. Ein Umstieg ist später möglich, weil die Engine sauber getrennt ist.
- **JSON-Datei statt SQLite:** Für einen Tisch mit Freunden reicht eine Datei im Volume. SQLite lohnt sich ab den Statistiken über mehrere Abende (V1.1).
- **`node:test` statt Vitest:** Eingebaut in Node, keine zusätzliche Abhängigkeit.
- **Schrift lokal:** Bricolage Grotesque liegt unter `public/fonts`, damit keine Verbindung zu Google Fonts nötig ist (DSGVO).

## Als Nächstes (V1.1)

Time Bank, Straddle, Bomb Pot, Run It Twice, 7-2-Bonus, Hand-Replay.
