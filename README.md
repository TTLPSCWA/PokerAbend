# Spieleabend

Spielesammlung für die Freundesgruppe, im Browser und online spielbar: Texas Hold'em, Mau-Mau, UNO, Mäxchen, Schocken, Mensch ärgere Dich nicht, Phase 10, Skip-Bo und viele weitere. Der Server ist Geber und Schiedsrichter: Er mischt, teilt aus, würfelt, prüft jeden Zug und rechnet ab.

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
npm run test:ui    # Browserprüfungen in Chrome (1440 und 390 Pixel)
```

Voraussetzung ist Node.js 20 oder neuer.

Die Browserprüfungen benötigen lokal installiertes Chrome. Screenshots liegen unter `artifacts/block-a/`; Fehlerberichte unter `test-results/`.

## Online stellen

//1. **Image bauen und pushen**  

   ```bash
   docker build -t ghcr.io/DEIN-NAME/pokerabend:latest . 
   docker push ghcr.io/DEIN-NAME/pokerabend:latest
   ```

   Alternativ das Repo auf GitHub legen (z. B. [https://github.com/TTLPSCWA/PokerAbend](https://github.com/TTLPSCWA/PokerAbend)): Der Workflow in `.github/workflows/docker.yml` testet bei jedem Push auf `main` und schiebt das Image automatisch nach `ghcr.io`.
   Voraussetzung auf dem Server: ein zentraler Traefik-Proxy mit dem externen Docker-Netz `proxy` (Entrypoint `websecure`, certresolver `letsencrypt`). Das Netz muss existieren, sonst startet der Tisch nicht (`docker network create proxy`).
   Die Dateien `docker-compose.yml`, `docker-compose.prod.yml` und `.env.example` hochladen.

   ```bash
   cp .env.example .env            # DOMAIN und IMAGE eintragen
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

   Die Domain muss per DNS-A-Record auf den Server zeigen. Traefik erkennt den Container an seinen Labels (`Host(DOMAIN)`, Port 3000) und holt das HTTPS-Zertifikat automatisch; die App selbst ist nicht direkt von außen erreichbar (nur `expose`, kein `ports`).

//3. **Update einspielen:** neues Image pushen, auf dem Server wieder `pull` und `up -d`.

**Anmeldung:** Über das Gruppenpasswort `SITE_PASSWORD`. Auf dem Server ist es in der `.env` Pflicht, ohne startet nichts. Lokal ohne `SITE_PASSWORD` ist die Seite offen (nur zum Testen).

Tische und Chipstände liegen im Docker-Volume `poker-data` und überleben Neustarts. Gespeichert wird immer zwischen zwei Händen. Nach einem Neustart drückt der Host einmal auf „Spiel starten“.

## Startseite

Die Startseite ist ein Hub mit Navigation per URL-Hash (Zurück-Taste und Links funktionieren):

| Adresse | Seite |
| --- | --- |
| `#start` | Begrüßung, „Weiterspielen“, offene Tische, Deine Spiele, Code-Feld |
| `#tische` | alle offenen Tische |
| `#spiele`, `#spiele/karten`, `/wuerfel`, `/brett`, `/party` | Spieleliste mit Filtern |
| `#favoriten` | meine Favoriten |
| `#bestenliste` | Bestenliste nach Spiel und Monat |
| `#roadmap` | Etappen, geplante Spiele und Funktionen, abgeschlossene Päckchen |

- **Profil:** Beim ersten Besuch fragt ein Dialog nach Name und Avatar. Beides liegt im Browser (`poker:name`, `poker:avatar`) und wird beim Hosten und Beitreten verwendet. Ist der Name am Tisch schon vergeben, schlägt der Server einen freien vor („Tobi 2“).
- **Offene Tische:** Der Server schickt die Liste an alle Angemeldeten (Socket-Ereignis `lobby`, Änderungen höchstens einmal pro Sekunde): Spiel, Code, Host, wer sitzt, Plätze, Stand – nie Tokens, Karten oder Spielstände. „Dazusetzen“ und „Zuschauen“ sind ein Klick mit dem Profil. Ein Tisch erscheint, solange mindestens ein Mensch online ist. Der Host kann am Tisch unter „Host“ einstellen: **Tisch nicht in der Liste zeigen** (privat, nur per Code oder Link). Die Grenze für neue Tische lässt sich zum Testen mit `CREATE_LIMIT` erhöhen (Standard 6 pro 10 Minuten und IP).
- **Weiterspielen:** Hat der Browser ein Token für einen noch offenen Tisch (auch einen privaten), steht er ganz vorne mit „Zurück an den Tisch“.
- **Adressen und „Zurück“:** Ein Tisch hat immer die Adresse `/?t=CODE`, die Seiten der Startseite haben `/#start`, `/#spiele` … ohne `?t=`. Einen Tisch zu betreten (hosten, beitreten, Link, „Weiterspielen“) legt einen Verlaufseintrag an (`pushState`). „Zurück“ zeigt die Startseite, der Platz am Tisch bleibt erhalten (der Tisch steht unter „Weiterspielen“), „Vor“ führt wieder an den Tisch. Ein Wechsel in einen anderen Tisch oder ein anderes Spiel lädt die Seite frisch (`location.reload()`, kein zweiter Eintrag); kommt eine Seite aus dem Vor-/Zurück-Cache (bfcache), lädt sie sich ebenfalls neu. Ist ein Tisch sichtbar, aber nichts gemountet oder die Verbindung weg, erscheint nach 3 Sekunden „Verbindung verloren“ mit „Neu laden“.
- **Einladungslink `/?t=CODE`:** Mit Profil tritt man direkt bei, ohne Profil fragt erst der Profil-Dialog nach dem Namen. Gibt es den Tisch nicht mehr, kommt ein Hinweis und die Startseite.
- **Spieleliste:** Filter (Favoriten, Spielerzahl, Kurz unter 15 Minuten), Liste oder Kacheln, Favoriten und „zuletzt gespielt“ (nur in diesem Browser: `poker:favs`, `poker:recent`, `poker:view`). Noch nicht gebaute Spiele stehen in `games/planned.js`: `status: 'next'` erscheint weiter ausgegraut mit „Bald“, der übrige Backlog auf der Roadmap. Funktionen erscheinen nie als Spiel. Ab 20 Spielen gibt es eine Suche.
- **Roadmap:** `games/roadmap.js` beschreibt Etappen für Spiele, Funktionen, Design, Discord und Betrieb; `/roadmap` liefert sie nur angemeldet und ergänzt Backlog-Inhalte automatisch aus `planned.js`. Filter, Fortschritt und Spielregeln sind im Hub sichtbar. Später, große Projekte und erledigte Etappen starten eingeklappt; die Wahl wird lokal gemerkt.
- **Gerade online:** Zeigt Profilname, Avatar und Standort, bündelt mehrere Tabs/Geräte über denselben normalisierten Namen wie die Bestenliste und bietet den Beitritt zu gelisteten Tischen an. Private Tische verraten weder Spiel noch Code, Bots fehlen. Unter „Ich“ macht „Mich nicht als online zeigen“ die eigene Anwesenheit und den letzten Besuch unsichtbar. Hintergrund-Tabs, fünf Minuten ohne Eingabe und geparkte Verbindungen gelten als kurz weg. Online-Änderungen kommen höchstens alle zwei Sekunden; „Zuletzt online“ bleibt maximal 24 Stunden ausschließlich im Serverspeicher und entfällt nach einem Neustart. Gleichnamige Personen werden bis zur Einführung fester Spieler-IDs zusammengefasst.
- **Hosten:** Seitenpanel rechts, am Handy eine Leiste von unten – nur mit den Lobby-Feldern des Spiels (`createFields`).
- **Neues Spiel:** Ein Spielmodul bringt `minPlayers`, `maxPlayers`, `duration` (Minuten) und `art` (SVG, Bausteine in `games/art-kit.js`) mit; ein Test prüft, dass die Zahlen zum Raum passen.

## Spiele

### Päckchen 7: Party-Abendprogramme

An einem Party-Tisch erst mitspielen, dann unter **Host → Abendprogramm planen** den Modus wählen:

- **Party-Mix:** Die ausgewählten Spiele werden auf dem Server zufällig gemischt.
- **Party-Turnier:** Mehrere Spiele in fester Reihenfolge mit Gesamtwertung und Siegerehrung.
- **Eigene Playlist:** Bis zu zwölf Spiele sortieren und je Spiel Rundenzahl, Zeiten und Regeln einstellen. Bis zu zehn benannte Vorlagen liegen in diesem Browser (`poker:partyPlaylists`).
- **Team-Duell:** Die Mitspieler auf Team 1 und Team 2 verteilen. Alle spielen einzeln, ihre Programmpunkte werden im Team addiert; gleich große Teams sind empfohlen. Werwolf und „Wer bin ich?“ sind hierfür nicht auswählbar.

**Programm übernehmen → Programm starten** beginnt die erste Partie. Nach jeder Partie geht es mit **Nächstes Programm-Spiel** im selben Raum und mit denselben Spielern weiter. Die Gesamtwertung steht jederzeit unter **Gesamtwertung** und **Stand**. Eine Platzierung zählt bei N Teilnehmern N Punkte für Platz 1, dann einen weniger je Platz; Gleichstände teilen sich den Platz. Eine Partie ohne Punkte und ohne Sieger zählt null. Zuschauer bekommen keine Programmpunkte. So lassen sich Spiele mit unterschiedlichen eigenen Punkteskalen kombinieren.

Die Teilnehmer bleiben während des Programms fest; neue Gäste können zuschauen und beim nächsten Programm mitspielen. Der Server prüft Spielerzahlen, Regeln und Teamzuordnung vor dem Start. Spiele ohne Bot-Unterstützung brauchen menschliche Mitspieler. Host-Wechsel, Wiederverbinden und private Tische funktionieren weiterhin. **Programm beenden** ist zwischen Partien möglich; eine laufende Partie kann der Host vorher wie gewohnt abbrechen. Abgebrochene Partien zählen nicht und lassen sich am gleichen Programmplatz wiederholen.

Programm, Einstellungen und bereits vergebene Programmpunkte werden im Raum gespeichert. Nach einem Server-Neustart setzt der Host fort; nur die noch nicht abgeschlossene Partie muss erneut gespielt werden. Die einzelnen Spiele werten zusätzlich wie bisher für die Bestenliste. Die Programmwertung selbst erzeugt dort keine weiteren Einträge.

### Päckchen 7b: Zeichenspiele

**Kritzelpost**, **Bildunterschrift** und **Malen & Raten** stehen unter Party Spiele und in den Abendprogrammen bereit, jeweils für **3–12 Menschen**. Bots sind für diese Spiele nicht verfügbar.

Der gemeinsame Zeichenbereich unterstützt Maus, Stift und Finger: sieben Farben einschließlich weißem Radierer, vier Stiftstärken, Rückgängig und Leeren mit Bestätigung. Bilder bestehen aus höchstens 60 Strichen und 800 Zeichenpunkten; sie werden als geprüfte Vektoren übertragen. Nach dem Neuladen bleibt der zuletzt vom Server bestätigte Entwurf erhalten. Ein Server-Neustart setzt wie bei den anderen Partyspielen auf die nächste neu zu startende Partie zurück.

- **Kritzelpost:** Jeder beginnt eine Kette mit einem Begriff oder Satz. Die Ketten wandern weiter: zeichnen, beschreiben, zeichnen … Jeder bearbeitet jede Kette einmal und sieht dabei nur den letzten Beitrag. Am Ende sind alle Ketten mit ihren Autoren sichtbar. Ein nicht leerer Beitrag zählt 100 Punkte; die gemeinsame Geschichte steht im Mittelpunkt. Eine bis drei Runden, standardmäßig eine.
- **Bildunterschrift:** Reihum zeichnet eine Person einen geheimen Begriff. Danach schreiben die anderen verdeckte Bildunterschriften. Alle stimmen für einen fremden Beitrag; die Autoren werden erst zur Auflösung gezeigt. Jede Stimme bringt 100 Punkte, eine nicht leere Zeichnung ebenfalls 100. Zuschauer können bei entsprechender Host-Einstellung abstimmen. Standardmäßig drei Runden.
- **Malen & Raten:** Nur die zeichnende Person erhält den Begriff. Alle anderen sehen die Zeichnung und geben private Vermutungen ab. Die erste richtige Lösung bringt 300 Punkte, danach jeweils 25 weniger (mindestens 100); Zeichnende bekommen 100 je richtiger Lösung. Großschreibung, Leerzeichen, Satzzeichen und ausgeschriebene Umlaute werden toleriert. Sind alle fertig oder ist die Zeit abgelaufen, wird der Begriff aufgedeckt. Der Zeichenplatz wechselt jede Runde; standardmäßig sechs Runden.

Der Host kann Zeit, Runden und Punkte-Ziel einstellen, bei Bedarf weiterschalten und für Bildunterschrift/Malen & Raten eigene Begriffe ergänzen. Leere oder fehlende Beiträge bei Zeitablauf blockieren den Ablauf nicht. Abbrechen, Host-Wechsel, Zuschauer und Wiederverbinden nutzen die vorhandene Raumverwaltung. Als Nächstes folgt Päckchen 8 (Echtzeit).

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
| Blackjack | 1–7 | Gegen den Dealer mit 6 Decks: Karte, Stehen, Verdoppeln, Teilen. Blackjack 3:2, Dealer steht auf Soft 17. Eigene Chips mit Nachkaufen, die Bank zählt mit |
| Kniffel | 1–6 | Fünf Würfel, drei Würfe, 13 Felder (oben Einser bis Sechser mit Bonus 35 ab 63, unten Pasch, Full House, Straßen, Kniffel, Chance). Die höchste Summe gewinnt |
| Shut the Box | 1–8 | Würfeln und Klappen 1–9 schließen, die genau die Augensumme ergeben. Offene Klappen zählen (wenig ist gut), Box zu gewinnt die Runde sofort. 5 Runden |
| Vier gewinnt | 2 (+ Zuschauer) | 7 × 6, Steine fallen nach unten, vier in einer Reihe gewinnt (auch diagonal). Volles Feld = unentschieden, Anfang wechselt. Zeit pro Zug |
| Zehntausend | 2–8 | Sechs Würfel, punktende Würfel herauslegen, weiterwürfeln oder sichern. Niete = Zug weg. Einstieg 350, wer das Ziel erreicht, löst die letzte Runde aus |
| Mühle | 2 (+ Zuschauer) | Je 9 Steine setzen, ziehen, mit 3 Steinen springen. Mühle nimmt einen Stein, mit 2 Steinen oder ohne Zug verloren. Unentschieden nach 50 Zügen ohne Schlagen oder dreifacher Wiederholung |
| Schätzmeister (Party Spiele) | 2–12 | Schätzfrage mit Zahl als Antwort, alle schätzen gleichzeitig. Danach Zahlenstrahl und richtige Antwort: am nächsten dran 3 Punkte, Zweiter 2, Dritter 1, genau richtig +2. Über 100 Fragen mit Quelle, eigene Fragen des Hosts möglich |
| Schlagfertig (Party Spiele) | 3–8 | Jede Runde 2 lustige Aufgaben je Spieler, jede Aufgabe an genau 2 Spieler. Beide Antworten stehen ohne Namen nebeneinander, die anderen stimmen ab: Stimme = 100 Punkte, alle Stimmen für eine Antwort = Volltreffer +200. Letzte Runde: Finale mit einer Aufgabe für alle und 3 Stimmen. 182 Aufgaben, eigene möglich |
| Wer hat das gesagt? (Party Spiele) | 3–10 | Eine lockere, persönliche Frage pro Runde, alle antworten anonym. Dann wird jede Antwort einzeln gezeigt und der Autor in der Spielerliste getippt: richtig +100, der Autor +50 je Fehltipp. 112 Fragen, eigene möglich (auch „nur eigene Fragen“) |
| Schiffe versenken | 2 (+ Zuschauer) | Zwei Meere 10 × 10, Flotte setzen (nicht berühren), abwechselnd schießen: Wasser, Treffer, versenkt. Zeit pro Schuss. Die gegnerischen Schiffe sieht man erst nach Spielende |
| Omaha | 2–9 | Poker wie Hold'em (gleicher Tisch, Host-Menü, Bots), aber 4 eigene Karten, von denen genau 2 zählen, und Pot-Limit (Erhöhen höchstens um die Potgröße). Keine Gewinnchancen-Anzeige |
| Mogeln | 3–8 | 52 Karten, Ansage in fester Folge (Ass, 2 … König), 1–4 Karten verdeckt ablegen, „Mogeln!“ rufen: der Lügner bzw. der Zweifler nimmt den Stapel. Wer zuerst keine Karten hat und nicht erwischt wird, gewinnt |
| Präsident | 3–8 | 52 Karten, 2 am höchsten, gleich viele höhere Karten legen oder passen, Tisch frei, wenn alle passen. Plätze Präsident bis Schlusslicht mit Punkten, ab Runde 2 Kartentausch |
| Durak | 2–6 | 36 Karten, Trumpf = unterste Karte, angreifen und schlagen, Nachlegen aller Mitspieler (höchstens 6), Aufnehmen, Auffüllen. Wer zuletzt Karten hat, ist der Durak |
| Würfelpoker | 2–6 | Fünf Würfel, bis zu 3 Würfe (der Erste legt die Zahl fest), Würfel beiseitelegen. Hände von Fünfling bis hohe Karte; die schlechteste Hand bekommt einen Strich, bei der Strichzahl scheidet man aus |
| Lügenwürfel | 2–6 | Würfel unter dem Becher, Gebote „mindestens N × F“ über alle Würfel am Tisch, „Lüge!“ deckt auf, der Verlierer gibt einen Würfel ab. Hausregel: Einsen als Joker |
| Chicago | 2–6 | Elf Runden mit zwei Würfeln, Zielzahl 2 bis 12: Wer sie trifft, bekommt sie als Punkte. Stechen bei Gleichstand |
| Reversi | 2 (+ Zuschauer) | 8 × 8, Gegner einschließen und umdrehen, Passen von selbst, mehr Steine gewinnt. Zeit pro Zug |
| Dame | 2 (+ Zuschauer) | Deutsche Dame: Schlagzwang, Mehrfachsprünge (Sprung für Sprung), Damen ziehen weit, Remis nach 50 Zügen ohne Schlag. Zeit pro Zug |
| Domino | 2–4 | 28 Steine, 7 je Spieler, Kette mit zwei Enden, ziehen aus dem Vorrat, Punkte aus den Restaugen (auch im Blockspiel) |
| Zahlenzoo (Party Spiele) | 2–8 | Tiere laufen ins Bild und wieder hinaus, danach eine Zahlenfrage (zählen, Unterschied, Summe). Richtig 100 + Tempobonus, Schwierigkeit steigt. Bauart B |
| Gedächtnisküche (Party Spiele) | 2–8 | Rezept aus Zutaten kurz sehen, dann in der Reihenfolge nachtippen; der erste Fehler beendet die Folge, jede Runde eine Zutat länger. Hausregel rückwärts. Bauart B |
| Pfeilfieber (Party Spiele) | 2–8 | Pfeilfolgen so schnell und fehlerfrei wie möglich nachtippen (Tasten oder Knöpfe), Fehler sperren kurz. Der Server spielt die Eingaben nach. Bauart B |
| Sortierstation (Party Spiele) | 2–8 | Dinge auf dem Band nach Farbe oder Form in Kisten sortieren, das Band wird schneller, Regel kann wechseln. Bauart B |
| Tickendes Paket (Party Spiele) | 3–8 | Paket mit unbekannter Zündzeit wandert reihum; Wort mit verlangtem Buchstaben nennen. Platzt es, gibt es einen Minuspunkt; wenigste Minuspunkte gewinnen |
| Werwolf (Party Spiele) | 6–18 | Server als Spielleiter: Werwölfe, Seherin, Hexe, Amor, Jäger. Nacht, Tag, Abstimmung; Rollen nur an den jeweiligen Spieler, Tote sehen alles; Besprechen per Voice am Tisch |
| Wer bin ich? (Party Spiele) | 3–10 | Jeder trägt einen geheimen Begriff „auf der Stirn“ (gelber Zettel): alle sehen ihn, nur man selbst nicht. Reihum Ja/Nein-Fragen (per Voice, optional als Text), die anderen antworten per Knopf, die Mehrheit gilt; Raten mit Toleranz für Umlaute, Artikel und Tippfehler, sonst Abstimmung. Begriffe gegenseitig, aus 8 Kategorien (je ≥ 60) oder eigene Liste. Keine Bots. Der eigene Begriff geht nie an den eigenen Browser, bis er erraten ist |
| Kritzelpost (Party Spiele) | 3–12 | Begriff, Bild und Beschreibung wandern verdeckt durch die Runde; am Ende alle Ketten gemeinsam entdecken |
| Bildunterschrift (Party Spiele) | 3–12 | Gemeinsam eine Zeichnung ansehen, verdeckte Bildunterschriften schreiben und für den Favoriten stimmen |
| Malen & Raten (Party Spiele) | 3–12 | Reihum einen geheimen Begriff zeichnen; alle anderen raten gleichzeitig, richtige Lösungen bringen Punkte |

Die Startseite ist ein Hub (siehe „Startseite“ weiter unten). Die Kategorie (`karten`, `wuerfel`, `brett`, `party`), Spielerzahl, Dauer und das Spielbild legt jedes Spiel in seinem `games/<spiel>/index.js` fest.

Die genauen Regeln stehen im Spiel unter „Regeln“ und oben in `games/<spiel>/room.js`. Die Rundenspiele haben einen gemeinsamen Rahmen: Mitspielen/Zuschauen, der Host startet jede Runde, Punkte und Siege über den Abend unter „Stand“, Verlauf und Host-Menü.

### Computer-Mitspieler

Im Host-Menü unter „Mit Bots spielen (optional)“ auf **Bot hinzufügen** klicken; bei Poker im Reiter „Spiel“. Standardmäßig sind keine Bots dabei. Bots sitzen automatisch am Tisch, du selbst trittst wie gewohnt bei. Hinzufügen und Entfernen gehen zwischen den Runden, die Runde startet weiterhin der Host. Bots bleiben bei Spielwechsel und Server-Neustart erhalten und werden als „Bot 1“, „Bot 2“ usw. angezeigt. Wird beim Spielwechsel der Tisch zu klein, schauen überzählige Spieler zu.

Die unterstützten Spiele haben eine Bot-Strategie in `games/bots.js`; „Wer bin ich?“ und die drei Zeichenspiele brauchen Menschen. Poker schätzt mit zufällig simulierten unbekannten Karten seine Chancen; die anderen Spiele nutzen einfache Grundstrategien, etwa Farbmehrheiten, Schlagen, passende Phasen, Treffer-Nachbarschaften oder die offene Blackjack-Dealerkarte. Die Bots kennen keine verdeckten Gegnerkarten und sind keine Turnier-KI. Der automatische Bot-Treiber pausiert, wenn kein Mensch verbunden ist. Bots können keine Hosts werden; sie zählen im Tischstand, aber nicht in der übergreifenden Bestenliste. Poker-Bots kaufen bei erlaubtem Nachkaufen automatisch nach.

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
| Blackjack | Startchips (1000)<br>Mindesteinsatz (10)<br>Höchsteinsatz (500)<br>Dealer zieht auf Soft 17 (aus)<br>Versicherung anbieten, zahlt 2:1 (aus)<br>Verdoppeln nach dem Teilen (an)<br>Nachkaufen: wie oft, 0 = aus, 99 = unbegrenzt (99) |
| Kniffel | Extra-Kniffel-Bonus: jeder weitere Kniffel +50 (aus)<br>Joker-Regel bei weiterem Kniffel (aus) |
| Shut the Box | Runden (5)<br>Klappen 1–12 statt 1–9 (aus)<br>Ein-Würfel-Regel, wenn 7 bis zur höchsten Klappe zu sind (an)<br>Wertung: Ziffern hintereinander statt Summe (aus)<br>Zeit pro Zug in Sekunden, 0 = ohne (60) |
| Schätzmeister | Anzahl Runden (10)<br>Zeit zum Antworten in Sekunden (30)<br>Punkte-Ziel, 0 = aus (0)<br>Zuschauer dürfen mitmachen (aus)<br>Wertung nach Abweichung in Prozent (aus) |
| Schlagfertig | Anzahl Runden, die letzte ist das Finale (3)<br>Zeit zum Schreiben in Sekunden (60)<br>Zeit zum Abstimmen in Sekunden (30)<br>Punkte-Ziel, 0 = aus (0)<br>Zuschauer dürfen mitmachen (aus)<br>Anstupsen für Trödler mit Sprüchen (an) |
| Wer hat das gesagt? | Anzahl Runden (5)<br>Zeit zum Schreiben in Sekunden (60)<br>Zeit zum Raten in Sekunden (30)<br>Punkte-Ziel, 0 = aus (0)<br>Zuschauer dürfen mitmachen (aus)<br>Nur Fragen aus der eigenen Liste des Hosts (aus) |
| Vier gewinnt | Zeit pro Zug in Sekunden, 0 = ohne (60) |
| Zehntausend | Zielpunktzahl (10000)<br>Einstieg ab Punkten, 0 = ohne (350)<br>Straße nur 1.500 statt 2.000 (aus)<br>Drei Paare zählen 1.500 (an)<br>Letzte Runde für die anderen (an)<br>Zeit pro Zug in Sekunden, 0 = ohne (60) |
| Mühle | Springen mit 3 Steinen (an)<br>Unentschieden nach Zügen ohne Schlagen, 0 = aus (50)<br>Zeit pro Zug in Sekunden, 0 = ohne (60) |
| Schiffe versenken | Klassische Flotte: 1× 5, 2× 4, 3× 3, 4× 2 (aus – Standard 1× 5, 1× 4, 2× 3, 1× 2)<br>Schiffe dürfen sich berühren (aus)<br>Treffer: nochmal schießen (aus)<br>Zeit pro Schuss in Sekunden, 0 = ohne (60) |
| Schwimmen | Leben pro Spieler (3)<br>Schwimmen: ohne Leben noch einmal mitspielen (an)<br>Schieben erlaubt (an)<br>Feuer: drei Asse = 33, alle anderen verlieren ein Leben (aus) |

### Am Tisch: Plätze, Hinweise, „Ich“

- Ab 900 px Breite sitzen die Gegner rund um den Tisch (Avatar, Name, Karten/Leben/Deckel/Phase, letzte Aktion als Sprechblase), du selbst unten. Auf dem Handy bleibt oben eine kompakte Leiste.
- Über der eigenen Hand steht immer ein Satz, was man gerade tun kann; spielbare Karten heben sich an und haben einen Goldrand. Karten lassen sich antippen oder (am Computer) auf die Ablage ziehen, auf dem Handy überlappt eine volle Hand – erstes Tippen vergrößert, zweites legt.
- Nach jeder Runde zeigt ein großes Fenster die Punkte; der Host startet dort die nächste Runde oder wechselt das Spiel.
- Unter „Ich“ (pro Browser gemerkt): **Farbsymbole** auf farbigen Karten (Rot ▲, Gelb ●, Grün ■, Blau ◆ – Standard an), **Töne** (Karten, Würfel, „UNO!“ – alles per Web Audio erzeugt, keine Dateien), **Animationen aus** (gilt auch bei „Bewegung reduzieren“ am Gerät), **Erste Schritte** (kurze Einführung beim ersten Spiel jeder Art), bei Mau-Mau das **Kartenblatt** (französisch oder deutsch).

### Spiel wechseln, Nochmal

Nach einer Runde kann der Host im Host-Menü unter „Spiel wechseln“ ein anderes Spiel wählen: gleicher Raum, gleicher Code, alle bleiben drin, wer mitgespielt hat, sitzt wieder. Der bisherige Stand kommt als eine Zeile in den Verlauf (Poker-Chips nimmt man nicht mit). Die Browser aller Leute laden kurz neu und landen im neuen Spiel. „Nochmal“ startet bei den Rundenspielen die nächste Runde desselben Spiels.

### Raum verlassen, Spiel beenden, Stapel ansehen

- **Home-Knopf** (Haus + „Start“, oben links in jedem Spiel): „Platz behalten“ geht zur Startseite, man bleibt angemeldet und der Tisch steht unter „Weiterspielen“; für die anderen gilt man als offline (Zug-Timer, automatische Pause und Rauswurf nach 5 Minuten wie bei Verbindungsabbruch). „Tisch verlassen“ steigt aus der Runde aus (wie „Aufstehen“), gibt den Platz auf und vergisst das Token im Browser; Ergebnisse bleiben in der Bestenliste. Ist niemand Menschliches mehr online, schließt der Raum sofort und der Code ist frei. Verlässt der Host den Tisch, geht die Host-Rolle weiter. „Zurück“ im Browser = „Platz behalten“. Server-Ereignisse `park`, `leave`.
- **Host-Menü „Spiel beenden“:** „Aktive Runde abbrechen“ beendet die Runde ohne Wertung, Karten, Einsätze und Chips gehen auf den Stand vor der Runde zurück (Poker: Einsätze der Hand zurück an die Spieler, Chipsumme bleibt; Blackjack: Einsätze und Versicherungen zurück, Karten in den Ablagestapel), danach wartet der Tisch; im Verlauf steht „Runde vom Host abgebrochen“. „Tisch schließen“ schickt alle zur Startseite („Der Host hat den Tisch geschlossen“), löscht den Raum und gibt den Code frei. Beides nur für den Host, vom Server geprüft (`abortRound`, `closeTable`).
- **Ansehen** (Lupe oben in der Leiste, bei Skip-Bo zusätzlich an den Ablagen): ein gemeinsames Blatt (`openLook` in `public/core.js`; am Handy von unten, schließen per Knopf, Klick daneben oder Esc) mit offenen Informationen: Skip-Bo alle Ablagen (unten → oben, oberste hervorgehoben), Baureihen mit Folge und Jokern, eigener Stapel nur Anzahl + oberste Karte; Mau-Mau/UNO die zuletzt gelegten Karten; Phase 10 ausgelegte Phasen groß und die letzten 5 Ablagekarten; Schwimmen der Tauschverlauf; Mäxchen die Ansagen; Kniffel, Zehntausend, Shut the Box, Schocken die Blätter/Würfel aller; bei allen Spielen die letzten Züge der Runde; Partyspiele frühere Fragen. Die Daten kommen aus `moves` (jede `act(id, text, detail)` eines Spiels wird mitgeschrieben – nur, was ohnehin als Sprechblase für alle sichtbar ist) und `g.past` (aufgelöste Fragen). Tests: `test/look.test.js`.

### Bestenliste über alle Abende

Auf der Startseite (Bestenliste) und unter „Stand“ in jedem Spiel: pro Spiel gespielte Partien, Siege (mit Quote) und Punkte – über alle Abende oder für einen Monat. Wiedererkannt wird man am Namen (Groß/Klein egal). Eine Partie ist beim Poker eine Hand (gezählt werden gewonnene/verlorene Chips), sonst eine Runde. Gespeichert in `data/leaderboard.json` im Daten-Volume.

### Als App aufs Handy

Die Seite lässt sich auf den Homescreen legen und startet dann ohne Browserleiste:

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Dafür gibt es `public/manifest.webmanifest`, Icons in `public/icons/` und einen kleinen Service Worker (`public/sw.js`), der nichts zwischenspeichert – gespielt wird immer live. Manifest und Icons sind auch ohne Passwort abrufbar, alles andere nicht.

## Was V1.0 kann

| Bereich | Funktionen |
| --- | --- |
| Startseite | Hub mit Profil, offenen Tischen, Spieleliste, Hosten-Panel, Einladungslink mit Code; Gruppenpasswort statt Benutzerkonto |
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
  party-room.js      Grundklasse der Partyspiele: Stufen mit Uhr (Schreiben → Abstimmen → Auflösung), eigene Fragen, Geheimhaltung
  schaetzmeister/    Partyspiel: room.js (Regeln), fragen.json (Katalog mit Quellen), index.js
  maumau/, farbenchaos/, maexchen/, schocken/, huetchen/, zehnetappen/, stapelrennen/
                     je index.js (Beschreibung, Ereignisse) und room.js (Regeln); UNO erweitert Mau-Mau
public/            Browser
  index.html         Rahmen: Hub (Startseite), Profil-Dialog, Hosten-Panel, Dialoge
  core.js            Verbindung, Dialoge, Hilfen, Bestenliste – lädt das gewählte Spiel nach
  hub.js, hub.css    Startseite: Profil, Navigation per URL-Hash, offene Tische, Spieleliste, Hosten, Bestenliste
  style.css          gemeinsames Aussehen (Tokens, Buttons, Leisten, Seitenleiste, Verlauf)
  games/poker/       poker.js (Tisch-Oberfläche) und poker.css
  games/kit.js       gemeinsamer Rahmen der Rundenspiele (Kopfzeile, Spielerleiste, Seitenleiste, Ablegespiel-Bedienung)
  games/party-kit.*  gemeinsamer Baustein der Partyspiele: Fortschritt, Fragekarte, Eingabezeile, Rangliste (baut auf kit.js auf)
  games/<spiel>/     <spiel>.js und <spiel>.css – nur der eigene Tisch und die Aktionen
scripts/           backup.sh – tägliche Sicherung des Daten-Volumes (siehe „Backups“)
test/              node:test – Engine inkl. 100.000 Zufallshänden, Räume, Server, Sicherheit, Plattform
```

Jede Testdatei mit eigenem Server hat einen eigenen Portbereich, weil `npm test` die Dateien parallel ausführt: `server` 4000–4049, `security` 4050–4099, `sebastian` 4100–4149, `away` 4150–4199, `codes` 4200–4249, `history` 4250–4299, `platform` 4300–4349. Neue Dateien bekommen den nächsten freien Fünfziger-Block.

### Bauart B: Solo-Partyspiele (Bauart-B-Baustein)

Zahlenzoo, Gedächtnisküche, Pfeilfieber und Sortierstation sind **Bauart B**: Alle spielen gleichzeitig solo dieselbe Runde. Der Server (`games/solo-room.js`, ein `PartyRoom`) verteilt pro Runde einen **Seed**; jeder Browser erzeugt daraus lokal dieselbe Runde und schickt am Ende nur seine **Eingaben** (Antwort, Tipps, Tastendrücke mit Zeitstempel, Entscheidungen). Der Server **spielt die Eingaben nach** und wertet aus – die Punkte kommen nie vom Browser. Zeit wird auf der Serveruhr gemessen; Tempo und Abstände der Eingaben werden geprüft (zum Beispiel höchstens eine Eingabe alle 80 ms, Sperre nach einem Fehler).

Die Spiellogik (`makeRound`, `score`, `botPayload`, `solution`) liegt je Spiel in `public/games/<spiel>/logic.js` und läuft **dieselbe Datei** im Browser (dynamischer Import) und auf dem Server. Zufall: `public/games/solo/rng.js`. Die Oberfläche (`public/games/solo/solo-kit.js`, `soloGame({ … })`) zeichnet das Spielfeld aus dem Seed neu, sobald sich der Zustand ändert. Ein neues Bauart-B-Spiel braucht also: `logic.js`, `games/<id>/room.js` (eine kleine Unterklasse von `SoloRoom`), `index.js`, die Oberfläche mit `soloGame` und einen Eintrag in `games/index.js`/`games/bots.js`. Wie bei jedem Spiel ohne Server-Geheimnis gilt: Wer den Code liest, kann die Lösung berechnen – die Spiele sind auf Spaß unter Freunden ausgelegt, nicht auf Betrugssicherheit.

**Tickendes Paket** und **Werwolf** sind Bauart A (Runden mit Server als Spielleiter). Beim Werwolf kennt jeder Spieler nur seine eigene Rolle (Werwölfe einander, Verliebte einander); Nachtaktionen stehen weder im Verlauf noch in Sprechblasen, Tote und alle nach dem Spiel sehen Rollen und Nachtgeschehen. Die Diskussion läuft am Tisch (per Voice), im Spiel gibt es keinen Chat. Tests: `test/paeckchen6.test.js`.

## Partyspiele (Schätzmeister, Schlagfertig, Wer hat das gesagt?)

Alle antworten gleichzeitig; pro Frage läuft eine Folge von Stufen mit eigener Uhr. Das Spiel erweitert `PartyRoom` aus `games/party-room.js` (statt `TurnRoom`) und füllt `flow`, `catalog`, `parseCustom`, `startQuestion`, `waiting`, `closeStage`, `enter`, `isReady`, `stageView` und `fallback` (Kopfkommentar der Datei). Fragen liegen als JSON im Spielordner. Der Browser-Teil ruft `partyGame({ … })` aus `public/games/party-kit.js` auf. Regeln, die für alle gelten:

- **Geheimhaltung:** `stageView(viewerId)` darf nur Eigenes und anonyme Daten liefern – fremde Antworten, Stimmen und die richtige Lösung erst ab `reveal`. Die Tests schauen im JSON jeder Ansicht danach.
- **Texte:** Eingaben laufen durch `cleanAnswer` (Steuerzeichen raus, höchstens 120 Zeichen) und werden im Browser nur mit `esc()` ausgegeben.
- **Bots:** Ein Spiel liefert in `games/bots.js` einen Bot; `PartyRoom.botDue()` sagt dem Bot-Läufer, wer als Nächstes abgeben muss.
- **Eigene Fragen:** Der Host trägt sie im Host-Menü ein (eine pro Zeile); sie gelten nur in diesem Raum und stehen nur zwischen den Partien in seiner Ansicht.
- **Mehrere Abstimm-Schritte:** Ein Spiel kann in einer Stufe mehrere Schritte haben (`moreSteps`, z. B. eine Abstimmung pro Aufgabe); die Uhr startet pro Schritt neu. Die Ansicht darf die Basisfelder `q`, `of`, `stage`, `sub` nicht überschreiben (ein Test prüft das) – Texte der Frage heißen `prompt`.
- **Anstupsen:** Spiele, die die Option `nudge` führen (Schlagfertig), stupsen Trödler 15 Sekunden vor Stufenende selbst an; wer fertig ist, kann andere anstupsen (höchstens alle 10 Sekunden, Sprüche wie beim Poker). Wer in der Abstimmung Autor ist, bleibt dabei unverraten.
- **Bots:** Platzhalter-Antworten und zufällige Stimmen über `botStep` im Raum (`games/bots.js`).

## Ein neues Spiel hinzufügen

Beispiel Mau-Mau mit der ID `maumau` (nur Kleinbuchstaben, Ziffern und Bindestrich):

1. **Server:** `games/maumau/index.js` anlegen und in `games/index.js` eintragen.

   ```js
   import { Room } from './room.js';
   import { turnGame } from '../../server/turn-game.js';
   export default turnGame(Room, {
     id: 'maumau', name: 'Mau-Mau', description: 'Ablegen, aussetzen, Farbe wünschen.', category: 'karten', players: '2–6 Spieler',
     createFields: [{ key: 'cards', label: 'Karten pro Spieler', type: 'number', min: 3, value: 6 }],
     createHint: 'Alles andere stellst du im Raum ein.',
     events: { play: (room, p, { card }) => room.play(p.id, card), draw: (room, p) => room.draw(p.id) },
   });
   ```

   `turnGame` bündelt Anlegen, Wiederherstellen, Regel-Optionen und gemeinsame Ereignisse wie Mitspielen und Starten. Eigene Ereignisse und Hinweise bleiben im Spielmodul; Eingaben werden dort weiterhin geprüft.

2. **Raum:** Für Rundenspiele am einfachsten `class Room extends TurnRoom` (aus `server/turn-room.js`, siehe die vorhandenen Spiele) – Mitspieler, Reihenfolge, Runden und Punkte sind dann schon da, das Spiel füllt `setupRound`, `gameView`, `publicPlayer` und seine Aktionen. Einen **Zug-Timer** bekommt ein Rundenspiel, indem es die Einstellung `turnTime` (Sekunden, 0 = aus) in seine `OPTIONS` aufnimmt und `onTimeout(id)` füllt (siehe Schiffe versenken); `timerActive()` hält die Uhr an, wenn gerade niemand dran ist. Ganz frei geht es mit `class Room extends BaseRoom` (aus `server/base-room.js`). Spieler, Host, Wegbleiben und Verlauf sind damit schon da. Das Spiel füllt die Haken:

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

### Backlog: `games/planned.js`

Die Datei ist die zentrale Arbeitsliste für alle noch geplanten Spiele und Party-Funktionen. Ein Spiel-Eintrag hat `id`, `name`, `description`, `category` (`karten`, `wuerfel`, `brett`, `party`), `minPlayers`, `maxPlayers`, `duration` (Minuten), `status` (`next` oder `planned`), `paeckchen`, `rules` (3–8 Stichpunkte mit den Standardregeln), optional `houseRules`, `vorbild` (nur die Mechanik) und `art`; Partyspiele haben zusätzlich `bauart`: **A** Runden/Text, **B** gleichzeitig solo (gleicher Seed, jeder spielt lokal, der Server prüft das Ergebnis) oder **C** Echtzeit zusammen. Funktionen (`type: 'feature'`) haben `id`, `name`, `paeckchen`, `status` und `beschreibung`. Ein Test (`test/planned.test.js`) prüft Pflichtfelder, eindeutige IDs und die Vollständigkeit der Päckchen.

Regeln für die Zukunft:

- **Wird ein Spiel umgesetzt:** Modul unter `games/<id>/` anlegen, in `games/index.js` registrieren und den Eintrag aus `planned.js` entfernen (der Test schlägt sonst an, weil die ID doppelt vorkommt).
- **Ist ein Päckchen oder eine Funktion fertig:** Auch `games/roadmap.js` pflegen: Etappe auf `erledigt` mit dem Datum des passenden Git-Commits setzen, die nächste Etappe auf `jetzt`. Die Backlog-Einträge des nächsten Päckchens bekommen `status: 'next'`; immer nur ein Päckchen gleichzeitig.
- **Neue Ideen** werden nur noch in `planned.js` eingetragen, nicht mehr in dieser README.
- Geplante Spiele und Funktionen lassen sich nicht hosten oder auswählen; der Server lehnt sie ab.

### Weitere Ideen

Mögliche nächste Spiele stehen im Backlog (`games/planned.js`).

**Wichtig für die Fairness:** Der Browser bekommt nur seine eigenen Karten. Gegnerkarten verlassen den Server erst beim Showdown. Das prüft `test/server.test.js`. Das gilt für jedes Spiel: Was ein Spieler nicht sehen darf, gehört nicht in `view()`.

## Abweichungen vom Pflichtenheft

- **Kein React, kein TypeScript:** Die Oberfläche ist reines JavaScript ohne Build-Schritt. Das hält Docker-Image und Einstieg klein. Ein Umstieg ist später möglich, weil die Engine sauber getrennt ist.
- **JSON-Datei statt SQLite:** Für einen Tisch mit Freunden reicht eine Datei im Volume. SQLite lohnt sich ab den Statistiken über mehrere Abende (V1.1).
- **`node:test` statt Vitest:** Eingebaut in Node, keine zusätzliche Abhängigkeit.
- **Schrift lokal:** Bricolage Grotesque liegt unter `public/fonts`, damit keine Verbindung zu Google Fonts nötig ist (DSGVO).

## Als Nächstes (V1.1)

Time Bank, Straddle, Bomb Pot, Run It Twice, 7-2-Bonus, Hand-Replay.
