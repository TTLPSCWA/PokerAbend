# Spieleabend

Spielesammlung für die Freundesgruppe, im Browser und online spielbar: Texas Hold'em, Mau-Mau, UNO, Mäxchen, Schocken, Mensch ärgere Dich nicht, Phase 10 und Skip-Bo. Der Server ist Geber und Schiedsrichter: Er mischt, teilt aus, würfelt, prüft jeden Zug und rechnet ab.

> **Name:** Sichtbar heißt die Seite „Spieleabend“. Technisch bleibt „pokerabend“ – Repo, Docker-Image `ghcr.io/ttlpscwa/pokerabend`, Container, Volume `poker-data`, Paketname, Cookie `pa_auth` und die Browser-Speicherschlüssel `poker:…`. Sonst brechen Deployment und laufende Sitzungen.

Die alten Namen bleiben an diesen Stellen absichtlich erhalten:

| Stelle | Unverändert | Grund |
| --- | --- | --- |
| `package.json`, `package-lock.json` | Paketname `pokerabend` | Bestehende Paketidentität |
| `docker-compose.yml`, `.env.example`, `.github/workflows/docker.yml` | `pokerabend:latest` bzw. `ghcr.io/ttlpscwa/pokerabend:latest` | Bestehendes Deployment und Image |
| Docker-Dateien und diese README | Kommentare, Image-Beispiele, Repo-Link `TTLPSCWA/PokerAbend` | Technische Referenzen statt sichtbarer Markenname |
| Compose-Konfiguration | Dienst `poker`, Volume `poker-data` | Bestehende Container und gespeicherte Daten |
| `server/security.js`, `public/core.js` | Cookie `pa_auth`, Browser-Schlüssel `poker:…` | Login und Wiederverbinden bleiben gültig |
| `games/`, `public/games/`, gespeicherte Räume | IDs `farbenchaos`, `huetchen`, `zehnetappen`, `stapelrennen` | Alte Links, Module und Spielstände bleiben verwendbar |

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

## Spiele

| Spiel | Spieler | Kurz |
| --- | --- | --- |
| Texas Hold'em | 2–9 | No Limit mit Spielgeld, alles unten beschrieben |
| Mau-Mau | 2–8 | 7 zieht 2 (stapelbar), 8 setzt aus, Bube wünscht (nicht auf Bube). „Mau!“ automatisch. Wertung: Augen der Restkarten, wenig ist gut |
| UNO | 2–8 | 108 Karten, Aussetzen, Richtungswechsel, +2, Farbwahl (+4). Kein Stapeln. Gewinner kassiert die Punkte der anderen |
| Mäxchen | 2–10 | Verdeckt würfeln, höher ansagen, anzweifeln. Mäxchen kostet 2 Leben. Der Letzte mit Leben gewinnt |
| Schocken | 2–8 | Bis zu 3 Würfe, Schock aus / Schock / General / Straße / Zahl, 13 Deckel. Wer alle Deckel hat, verliert die Halbzeit |
| Mensch ärgere Dich nicht | 2–4 | Raus mit der 6, drei Versuche, schlagen, Ziel passend, nicht überspringen |
| Phase 10 | 2–6 | Zehn Phasen nacheinander, Joker, Aussetzen, Anlegen. Wer zuerst Phase 10 schafft, gewinnt |
| Skip-Bo | 2–6 | Reihen 1–12 bauen, Joker, 4 Ablagen. Wer seinen Stapel zuerst los ist, gewinnt (25 + 5 je Restkarte der anderen) |
| Schwimmen (31) | 2–9 | 32 Karten, eine Farbe zählt (31 ist das Höchste), tauschen, schieben, klopfen. Die Niedrigsten verlieren Leben, ohne Leben schwimmt man noch einmal. Der Letzte gewinnt |

Die Startseite zeigt die Spiele nach Kategorien (Karten-, Würfel-, Brettspiele) – festgelegt mit `category` in `games/<spiel>/index.js`.

Die genauen Regeln stehen im Spiel unter „Regeln“ und oben in `games/<spiel>/room.js`. Die Rundenspiele haben einen gemeinsamen Rahmen: Mitspielen/Zuschauen, der Host startet jede Runde, Punkte und Siege über den Abend unter „Stand“, Verlauf und Host-Menü.

### Regeln anpassen

Der Host stellt die Regeln am Tisch ein (Host-Menü, nur zwischen den Runden). In Klammern der Standard – das sind unsere üblichen Hausregeln. Alle sehen die aktiven Regeln unter „?“ am Tisch. Die Optionen stehen im Code als static OPTIONS in games/<spiel>/room.js.

Bei Mau-Mau und Skip-Bo prüft der Server vor dem Start, ob die Karten für alle Mitspieler reichen. Falls nicht, nennt die Fehlermeldung die maximal mögliche Kartenanzahl; der Host kann die Einstellung ändern und erneut starten. Bei Skip-Bo werden zusätzlich fünf Handkarten je Spieler berücksichtigt.

Gehen bei Skip-Bo während der Runde die Nachziehkarten aus, darf ein Spieler ohne Handkarten ohne Abwerfen weitergeben. Kann niemand mehr ziehen oder legen, endet die Runde unentschieden und ohne Punkte.

| Spiel | Optionen (Standard) |
| --- | --- |
| Mau-Mau | Karten pro Spieler (5)<br>7: der Nächste zieht 2 (an)<br>7 auf 7 legen (dann 4, 6 …) (an)<br>8: der Nächste setzt aus (an)<br>Bube: Farbe wünschen (an)<br>Bube auf Bube erlaubt (aus)<br>Ass: nochmal dran (aus)<br>„Mau“ selbst sagen (vergessen = 1 Strafkarte) (aus)<br>Erste Karte wirkt (7 und 8) (aus) |
| UNO | Karten pro Spieler (7)<br>+2 und +4 stapeln (aus)<br>Ziehen, bis eine Karte passt (aus)<br>„UNO“ selbst sagen (vergessen = 2 Strafkarten) (aus)<br>+4 nur, wenn man die Farbe nicht hat (aus)<br>Startkarte wirkt (Aussetzen, Richtung, +2, Farbwahl) (aus)<br>Erwischen: wer „UNO“ vergisst, kann gemeldet werden (+2) (aus) |
| Mäxchen | Leben pro Spieler (3)<br>Mäxchen kostet 2 Leben (an)<br>Ungesehen weitergeben erlaubt (aus) |
| Schocken | Zwei Sechsen zu einer Eins drehen (aus)<br>Ganzes Spiel: 2 Halbzeiten und Finale (aus) |
| Mensch ärgere Dich nicht | Schlagzwang (aus)<br>Nach einer 6 nochmal würfeln (an)<br>Drei Versuche, wenn keine Figur draußen ist (an)<br>Mit einer 6 muss man raus (und das Startfeld räumen) (an) |
| Phase 10 | Aussetzen: Spieler frei wählen (sonst setzt der Nächste aus) (an)<br>Phase genau in der verlangten Größe auslegen (an)<br>Aussetzen als erste Ablage: der Erste setzt aus (aus) |
| Skip-Bo | Karten im eigenen Stapel (offiziell 30, ab 5 Spielern 20) (20) |
| Schwimmen | Leben pro Spieler (3)<br>Schwimmen: ohne Leben noch einmal mitspielen (an)<br>Schieben erlaubt (an)<br>Feuer: drei Asse = 33, alle anderen verlieren ein Leben (aus) |

### Am Tisch: Plätze, Hinweise, „Ich“

- Ab 900 px Breite sitzen die Gegner rund um den Tisch (Avatar, Name, Karten/Leben/Deckel/Phase, letzte Aktion als Sprechblase), du selbst unten. Auf dem Handy bleibt oben eine kompakte Leiste.
- Über der eigenen Hand steht immer ein Satz, was man gerade tun kann; spielbare Karten heben sich an und haben einen Goldrand. Karten lassen sich antippen oder (am Computer) auf die Ablage ziehen, auf dem Handy überlappt eine volle Hand – erstes Tippen vergrößert, zweites legt.
- Nach jeder Runde zeigt ein großes Fenster die Punkte; der Host startet dort die nächste Runde oder wechselt das Spiel.
- Unter „Ich“ (pro Browser gemerkt): **Farbsymbole** auf farbigen Karten (Rot ▲, Gelb ●, Grün ■, Blau ◆ – Standard an), **Töne** (Karten, Würfel, „UNO!“ – alles per Web Audio erzeugt, keine Dateien), **Animationen aus** (gilt auch bei „Bewegung reduzieren“ am Gerät), **Erste Schritte** (kurze Einführung beim ersten Spiel jeder Art), bei Mau-Mau das **Kartenblatt** (französisch oder deutsch).

### Spiel wechseln, Nochmal

Nach einer Runde kann der Host im Host-Menü unter „Spiel wechseln“ ein anderes Spiel wählen: gleicher Raum, gleicher Code, alle bleiben drin, wer mitgespielt hat, sitzt wieder. Der bisherige Stand kommt als eine Zeile in den Verlauf (Poker-Chips nimmt man nicht mit). Die Browser aller Leute laden kurz neu und landen im neuen Spiel. „Nochmal“ startet bei den Rundenspielen die nächste Runde desselben Spiels.

### Bestenliste über alle Abende

Auf der Startseite und unter „Stand“ in jedem Spiel: pro Spiel gespielte Partien, Siege (mit Quote) und Punkte – über alle Abende oder für einen Monat. Wiedererkannt wird man am Namen (Groß/Klein egal). Eine Partie ist beim Poker eine Hand (gezählt werden gewonnene/verlorene Chips), sonst eine Runde. Gespeichert in `data/leaderboard.json` im Daten-Volume.

### Als App aufs Handy

Die Seite lässt sich auf den Homescreen legen und startet dann ohne Browserleiste:

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Dafür gibt es `public/manifest.webmanifest`, Icons in `public/icons/` und einen kleinen Service Worker (`public/sw.js`), der nichts zwischenspeichert – gespielt wird immer live. Manifest und Icons sind auch ohne Passwort abrufbar, alles andere nicht.

## Was V1.0 kann

| Bereich | Funktionen |
| --- | --- |
| Lobby | Spiel wählen, Tisch erstellen, Einladungslink mit Code, Name + Avatar; Gruppenpasswort statt Benutzerkonto |
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

## Backups

`scripts/backup.sh` sichert das Daten-Volume (Tische, Verläufe, Bestenliste, Schlüssel) als `spieleabend-JJJJ-MM-TT_HHMM.tar.gz` und löscht eigene Sicherungen, die älter als 14 Tage sind. Das Volume wird automatisch gefunden (Docker Compose nennt es z. B. `webseite_poker_poker-data`).

Auf dem Server einmal einrichten:

```bash
chmod +x scripts/backup.sh
sudo mkdir -p /var/backups/spieleabend
scripts/backup.sh            # einmal von Hand testen
crontab -e                   # und diese Zeile eintragen – täglich um 4:30 Uhr:
30 4 * * * /pfad/zum/repo/scripts/backup.sh >> /var/log/spieleabend-backup.log 2>&1
```

Einstellbar über Umgebungsvariablen: `BACKUP_DIR` (Standard `/var/backups/spieleabend`), `KEEP_DAYS` (14), `VOLUME` (falls die Suche nicht passt).

**Zurückspielen:** Container stoppen, Archiv ins Volume entpacken, Container starten:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop poker
docker run --rm -v webseite_poker_poker-data:/data -v /var/backups/spieleabend:/backup alpine:3 \
  sh -c "rm -rf /data/* && tar xzf /backup/spieleabend-2026-10-25_0430.tar.gz -C /data"
docker compose -f docker-compose.yml -f docker-compose.prod.yml start poker
```

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
  turn-room.js       Grundlage der Rundenspiele: Mitspieler, Reihenfolge, Runden, Punkte des Abends
  random.js          Mischen und Würfeln (kryptografisch sicherer Zufall)
  codes.js           Raumcodes, zentral für alle Spiele (nie doppelt)
  security.js        Passwort-Cookie, Rate-Limits, Header, Texte säubern
  env.js             liest die .env ein (ohne Zusatzpaket)
  login.html         Passwort-Seite
  leaderboard.js     Bestenliste über alle Abende (data/leaderboard.json)
games/             Spiele (Server-Teil)
  index.js           Liste aller Spiele
  poker/
    index.js           Beschreibung fürs Menü, Ereignisse, Raum erstellen/laden
    room.js            Pokertisch: Timer, Hände, Blinds, Geschenke, Ansicht pro Spieler
    blinds.js          steigende Blinds
    sebastian.js       Easter Egg „Waiting for Sebastian“
    engine/            Poker-Regeln ohne Netzwerk: cards.js (Deck, Bewertung, Chancen), table.js (Setzrunden, Pots)
  maumau/, farbenchaos/, maexchen/, schocken/, huetchen/, zehnetappen/, stapelrennen/
                     je index.js (Beschreibung, Ereignisse) und room.js (Regeln); UNO erweitert Mau-Mau
public/            Browser
  index.html         Startseite mit Spielauswahl, Dialoge
  core.js            Startseite, Lobby, Verbindung, Dialoge, Hilfen – lädt das gewählte Spiel nach
  style.css          gemeinsames Aussehen (Tokens, Buttons, Leisten, Seitenleiste, Verlauf)
  games/poker/       poker.js (Tisch-Oberfläche) und poker.css
  games/kit.js       gemeinsamer Rahmen der Rundenspiele (Kopfzeile, Spielerleiste, Seitenleiste, Ablegespiel-Bedienung)
  games/<spiel>/     <spiel>.js und <spiel>.css – nur der eigene Tisch und die Aktionen
scripts/           backup.sh – tägliche Sicherung des Daten-Volumes (siehe „Backups“)
test/              node:test – Engine inkl. 100.000 Zufallshänden, Räume, Server, Sicherheit, Plattform
```

Jede Testdatei mit eigenem Server hat einen eigenen Portbereich, weil `npm test` die Dateien parallel ausführt: `server` 4000–4049, `security` 4050–4099, `sebastian` 4100–4149, `away` 4150–4199, `codes` 4200–4249, `history` 4250–4299, `platform` 4300–4349. Neue Dateien bekommen den nächsten freien Fünfziger-Block.

## Ein neues Spiel hinzufügen

Beispiel Mau-Mau mit der ID `maumau` (nur Kleinbuchstaben, Ziffern und Bindestrich):

1. **Server:** `games/maumau/index.js` anlegen und in `games/index.js` eintragen.

   ```js
   import { Room } from './room.js';
   export default {
     id: 'maumau', name: 'Mau-Mau', description: 'Ablegen, aussetzen, Farbe wünschen.', category: 'karten', players: '2–6 Spieler',
     createFields: [{ key: 'cards', label: 'Karten pro Spieler', type: 'number', min: 3, value: 6 }],
     createHint: 'Alles andere stellst du im Raum ein.',
     create: (code, settings, onChange) => new Room(code, settings, onChange),
     restore: (data, onChange) => Room.restore(data, onChange),
     events: { play: (room, p, { card }) => room.play(p.id, card), draw: (room, p) => room.draw(p.id) },
   };
   ```

2. **Raum:** Für Rundenspiele am einfachsten `class Room extends TurnRoom` (aus `server/turn-room.js`, siehe die vorhandenen Spiele) – Mitspieler, Reihenfolge, Runden und Punkte sind dann schon da, das Spiel füllt `setupRound`, `gameView`, `publicPlayer` und seine Aktionen. Ganz frei geht es mit `class Room extends BaseRoom` (aus `server/base-room.js`). Spieler, Host, Wegbleiben und Verlauf sind damit schon da. Das Spiel füllt die Haken:

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

### Weitere Ideen

Mögliche nächste Spiele: Schwimmen/31, Blackjack mit unseren Chips, Würfelpoker mit Punkteblatt, Werwolf, Montagsmaler.

**Wichtig für die Fairness:** Der Browser bekommt nur seine eigenen Karten. Gegnerkarten verlassen den Server erst beim Showdown. Das prüft `test/server.test.js`. Das gilt für jedes Spiel: Was ein Spieler nicht sehen darf, gehört nicht in `view()`.

## Abweichungen vom Pflichtenheft

- **Kein React, kein TypeScript:** Die Oberfläche ist reines JavaScript ohne Build-Schritt. Das hält Docker-Image und Einstieg klein. Ein Umstieg ist später möglich, weil die Engine sauber getrennt ist.
- **JSON-Datei statt SQLite:** Für einen Tisch mit Freunden reicht eine Datei im Volume. SQLite lohnt sich ab den Statistiken über mehrere Abende (V1.1).
- **`node:test` statt Vitest:** Eingebaut in Node, keine zusätzliche Abhängigkeit.
- **Schrift lokal:** Bricolage Grotesque liegt unter `public/fonts`, damit keine Verbindung zu Google Fonts nötig ist (DSGVO).

## Als Nächstes (V1.1)

Time Bank, Straddle, Bomb Pot, Run It Twice, 7-2-Bonus, Hand-Replay.
