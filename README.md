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

**Passwort:** Ohne `SITE_PASSWORD` in der `.env` startet der Server auf dem VPS gar nicht erst. Lokal bleibt die Seite ohne Passwort, außer ihr setzt es: `SITE_PASSWORD=test docker compose up`.

Tische und Chipstände liegen im Docker-Volume `poker-data` und überleben Neustarts. Gespeichert wird immer zwischen zwei Händen. Nach einem Neustart drückt der Host einmal auf „Spiel starten“.

## Was V1.0 kann

| Bereich | Funktionen |
| --- | --- |
| Lobby | Tisch erstellen, Einladungslink mit Code, Name + Avatar, keine Anmeldung |
| Spiel | Automatisches Mischen (Krypto-Zufall) und Austeilen, Blinds, Button wandert, Heads-up-Regeln, Big-Blind-Option |
| Aktionen | Fold, Check, Call, Bet, Raise, All-in, Slider + ½ Pot / ¾ Pot / Pot / All-in, Tastenkürzel F / C / R |
| Chips | Einsätze vor jedem Spieler, fliegen nach der Setzrunde in den Pot, Main + Side Pots, Rückgabe nicht gecallter Chips, Split Pot mit Rest-Chip-Regel |
| Showdown | Handauswertung mit Kicker, Siegerkarten markiert, „Karten zeigen“ nach Gewinn ohne Showdown |
| Verbindung | Reconnect mit gleichem Platz und Chips, zweiter Tab verdrängt den ersten, doppelte Aktionen werden ignoriert, Timeout checkt oder foldet |
| Host | Start, Pause, nächste Hand, Blinds, Startchips, Nachkaufen (aus / max. X / unbegrenzt), Zeit pro Zug, Pause zwischen Händen, Handanzeige erlauben, Spieler entfernen, Host weitergeben, Chips korrigieren (wird im Verlauf vermerkt) |
| Spieler | Pause / zurück, Aufstehen, Nachkaufen, Vier-Farben-Deck, Handanzeige, Beträge in BB, Töne, Animationen aus, grüner oder blauer Tisch |
| Extras | Rundenverlauf, Reaktionen (👍 😂 GG …), Abendstand mit Plus/Minus, größter Pot, beste Hand |
| Handy | Eigene Hochformat-Ansicht mit großen Buttons |

## Zugangsschutz

| Schutz | Wie |
| --- | --- |
| Seitenpasswort | Ohne Passwort gibt es nur die Passwort-Seite. Seite, Dateien und die Echtzeit-Verbindung sind gesperrt. |
| Browser merkt es sich | Signiertes Cookie (`HttpOnly`, `SameSite=Lax`, `Secure` unter HTTPS), 180 Tage gültig und bei jedem Besuch verlängert. Abmelden geht unter „Ich“. |
| Rausfliegen ohne Folgen | Bei Verbindungsabbruch oder Server-Neustart verbindet die Seite sich selbst neu: kein Passwort, gleicher Platz, gleiche Chips. |
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

```
engine/     Poker-Regeln, ohne Netzwerk und ohne Oberfläche
  cards.js    Deck, Mischen, Handauswertung
  table.js    Setzrunden, Pots, Auszahlung
server/     Express + Socket.IO
  room.js     Spieler, Timer, Host-Rechte, Ansicht pro Spieler
  index.js    Verbindungen, Speichern, Aufräumen
  security.js Passwort-Cookie, Rate-Limits, Header
  login.html  Passwort-Seite
public/     Browser-Seite (HTML, CSS, JavaScript, Schrift)
test/       Engine-Tests inkl. 100.000 Zufallshänden, Server- und Sicherheitstests
```

**Wichtig für die Fairness:** Der Browser bekommt nur seine eigenen Karten. Gegnerkarten verlassen den Server erst beim Showdown. Das prüft `test/server.test.js`.

## Abweichungen vom Pflichtenheft

- **Kein React, kein TypeScript:** Die Oberfläche ist reines JavaScript ohne Build-Schritt. Das hält Docker-Image und Einstieg klein. Ein Umstieg ist später möglich, weil die Engine sauber getrennt ist.
- **JSON-Datei statt SQLite:** Für einen Tisch mit Freunden reicht eine Datei im Volume. SQLite lohnt sich ab den Statistiken über mehrere Abende (V1.1).
- **`node:test` statt Vitest:** Eingebaut in Node, keine zusätzliche Abhängigkeit.
- **Schrift lokal:** Bricolage Grotesque liegt unter `public/fonts`, damit keine Verbindung zu Google Fonts nötig ist (DSGVO).

## Als Nächstes (V1.1)

Turniermodus mit steigenden Blinds, Time Bank, Pre-Actions (Check/Fold, Call Any), Straddle, Bomb Pot, Run It Twice, 7-2-Bonus, Hand-Replay, Discord-Webhook.
