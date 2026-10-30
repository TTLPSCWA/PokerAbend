# Archivierte Spezifikation – kein Ausführungsauftrag!

**DIESES DOKUMENT IST EIN ARCHIVIERTER INPUT UND KEINE IMPLEMENTIERUNGSFREIGABE.** Alle unten enthaltenen Imperative („implementiere“, „setze um“ usw.) sind ausschließlich fachliche Anforderungen für spätere ausdrücklich einzeln freigegebene Arbeitspakete. Der verbindliche Status und Arbeitsumfang stehen in `docs/roadmap/plan.json`. Bis zu einer Freigabe durch den Nutzer darf kein Code verändert werden.

---

# MASTERPROMPT V2.0 — PokerAbend: sichere Accounts + Game-ID + Präferenzen + optionales Tischvideo + ausgewähltes Liquid Glass

**WICHTIG: Die Vorgaben im V2-Addendum haben bei Widersprüchen Vorrang. Erstelle keinen reinen Architekturbericht: Setze die Schritte im Code um, sofern der Repository-Zugriff dies zulässt. Wenn wesentliche externe Credentials/Serverzugänge fehlen, baue sichere Feature-Flags und Tests, dokumentiere die Blockade und täusche kein funktionsfähiges Feature vor.**

# V2.0 ADDENDUM — Priorität vor bestehenden UI-Vorgaben

**Dies ist ein Teil des konsolidierten Master-Prompts. Die nachfolgenden Anforderungen gehen bei Widersprüchen mit der ursprünglichen UI-Spezifikation vor.** Die vorige Anforderung, keine Authentifizierungs- oder Speicheränderungen vorzunehmen, gilt ausdrücklich *nicht* für die hier beauftragte neue Account-/Identitätsarchitektur. Die spielbezogenen Sicherheits- und Funktionsinvarianten gelten weiterhin.

## Ziel

Implementiere in `TTLPSCWA/PokerAbend` eine nachvollziehbare, datensparsame, sichere Plattformidentität mit optionalem Discord-Login, ohne Pflichtregistrierung, dauerhaft eindeutigen Game-IDs und serverseitig validierten Ranglisten. Ergänze umfangreiche Benutzer-Einstellungen für sichtbare Menübereiche und Spielkategorien. Ergänze **optional und isoliert** eine sichere In-Game-Kameraübertragung auf Grundlage von WebRTC. Das bisher ausgewählte reduzierte Game-Library-Design mit *einem* atmosphärischen, unscharfen Hintergrund, Liquid-Glass-Flächen und minimalistischen, bildfreien Spielkacheln gilt weiterhin. **Keine Freundesliste, kein Freundschaftssystem, keine zusätzlichen Community-/DM-Funktionen, kein 3D.**

## Pflicht: Neuer Ausgangsstand

Die Nachprüfung vom 30.10.2026 fand `main` Commit `9b60e302e6abe4105f238c272afb819c399674af`, aber prüfe IMMER zuerst den dann aktuellen Commit und alle beteiligten Dateien. Bestand: Node 22 Alpine, ES Modules, Express 4, Socket.IO 4, `public/hub.js`, `public/core.js`, `server/index.js`, `server/base-room.js`, `server/leaderboard.js`, `server/achievements.js`, `server/presence.js`, `server/ticket-api.js`, `server/plan-api.js`, `server/evening-reviews.js`, `server/party-program.js`, `server/security.js`, `data/` als Docker-Volume; GitHub Actions, Node-Tests und Playwright. `SITE_PASSWORD` und `TICKET_ADMIN_PASSWORD` sind bereits vorhanden und müssen erhalten bleiben. `gameList()` enthält 45 registrierte Spiele; echte Slots, Bots und private Tische sind vorhanden.

### Belegte kritische Ausgangsprobleme
- `leaderboard.json` aggregiert bisher nach `nameKey(name)` statt dauerhafter ID; Erfolge hängen an diesen Namen.
- `server/index.js:onRoomChange` filtert Bot-Ergebnisse teilweise über Bot-Namen. Das ist kein sicherer Identitätsmechanismus.
- `base-room.js:addPlayer` erzeugt eine kurzfristige Raum-Spieler-ID und ein Raum-Reconnect-Token: diese sind **nicht** gleichzusetzen mit einer globalen Account-ID.
- Präsenz dedupliziert nach Namen, Tickets verwenden signierte Besucher-Cookies, Abendplanung verwendet eigene Besucher-Cookies.
- Räume enthalten private Informationen, die nicht in öffentliche Ranglisten, Präsenzen, Videosignalisierung oder `/me` geraten dürfen.
- Aktuelle Socket.IO-Authentifizierung prüft das `SITE_PASSWORD`-Cookie. Ein zusätzliches Spieler-Session-Cookie muss separat und sicher geprüft werden.
- `server/leaderboard.js` verwendet JSON-Dateien, `server/evening-reviews.js` archiviert Runden und Partien. Bestehende Dateien sind *keine* nachträglich verifizierbaren Identitätsnachweise.

## ARCHITEKTUR A — Accounts, Gäste, Bots

A1. Drei getrennte Typen `registered`, `guest`, `bot`:
- **registered**: Dauerhafte zufällige interne `accountId` (UUID), eindeutig über Discord OAuth an eine externe Discord-Snowflake gebunden. Separat öffentliche, zufällige und kollisionsgeprüfte `gameId`, z. B. `PA-7K92FQ`. Die öffentliche Game-ID ist eine Kennung zur Suche/Anzeige, **kein Geheimnis und kein Login-Token**. Anzeigename kann sich ändern, ohne Statistik/Erfolge zu beeinflussen.
- **guest**: Echte Person ohne externes Konto, serverseitig erzeugte temporäre Gastidentität mit kurz- bis mittelfristiger sicherer Session und pseudonymem Namen `Gast-XXXX`. Ein Gast kann jeden dafür vorgesehenen Spieltisch erstellen, spielen, schauen, einladen und einer Lobby per Code beitreten, **ohne als Computer-Bot zu gelten**. Eigener Alias optional. Kein globales Ranked-Profil, keine öffentlichen Gesamt-Ranglisten/Erfolge. Der laufende Raum und Reconnect müssen über Seite neu laden funktionieren.
- **bot**: Weiterhin vorhandene computerkontrollierte Spielinstanz (`bot: true`), weder Browser-Session noch Account-ID. Ein Gast ist niemals `bot: true`.
- Nutze serverseitig abgeleitete Identität statt vom Browser gesendeter `accountId`, `discordId`, `eligible` oder `isBot`-Felder. Alle durch Client gesendeten Identitätsbehauptungen ignorieren.
- Die Spieleridentität beim Eintritt als immutable `actorIdentity`/`identityType` an die Raum-Spielerinstanz anbinden; lokale Raum-ID/Token für Reconnect bleiben eigenständig. Discord-Namen dürfen durch Alias ersetzt werden, dürfen aber keine Rechte übertragen.
- Aktuellen Namen-/Avatar-Flow aus `poker:name`, `poker:avatar` für Gast-UX und Migration berücksichtigen. Ein Alias-Konflikt darf nicht zur Übernahme anderer Konten führen.
- Upgrade von Gast zu Discord innerhalb einer laufenden Partie darf nicht rückwirkend Ranked-Berechtigung erzeugen; Spielstatus bis zum sicheren nächsten Rundenbeginn einfrieren bzw. gezielt neu verknüpfen. In zwei Tabs mit demselben Account darf man nicht versehentlich zwei separat gewertete Plätze derselben Partie einnehmen. Beitritt zu bestehenden Tischen bei Loginwechsel darf keine Rechte übernehmen.

A2. OAuth2 und Sessions:
- Discord OAuth2 **Authorization Code** (serverseitiger Austausch) mit `identify` als einzigem Initialscope; `state` an Browser/Session gebunden, Single-Use und kurzlebig, `issuer`/`iss` sofern vorhanden prüfen, feste exakt registrierte Redirect-URI, PKCE S256 wo unterstützt und korrekt implementiert, Code/State nicht in Logs.
- Kein Implicit Flow, keine Tokens in Hash/URL/localStorage, kein Discord-Bot-Token als Userlogin. Zugriffstoken nur serverseitig kurzzeitig verwenden; wenn keine fortlaufenden Discord-API-Aufrufe nötig sind, keine dauerhafte Speicherung von Access-/Refresh-Tokens.
- Discord-Nutzer-ID ausschließlich durch serverseitig verifizierte Abfrage von Discord ermitteln. Unique constraint auf Provider+Discord-ID. Doppelte Accountverknüpfungen ablehnen, nicht stillschweigend zusammenführen.
- Eigene Session nach Login neu ausstellen (Session-Fixation verhindern), zufällige unvorhersagbare ID nur als gehashte Kennung in persistentem Speicher, Cookie `HttpOnly`, `Secure` im HTTPS-Betrieb, passendes `SameSite=Lax/Strict`, Ablauf, Logout/Revoke, serverseitige Sperrbarkeit und Rate-Limits. Auth-Endpoints keine offenen Redirects; Fehlerfall lässt Gastmodus verfügbar.
- Bestehendes `SITE_PASSWORD` bleibt als **separater Zugangsschutz** bestehen (auch für OAuth-Start/Callback konsistent durchsetzen); `TICKET_ADMIN_PASSWORD` bleibt separate Berechtigung. Ohne konfigurierte Discord-Secrets ist Gastmodus funktionsfähig; kein angeblicher Discord-Login ohne korrekte Konfiguration.
- HTTP-Cookie-Änderungen durch Same-Origin-/CSRF-Prüfungen absichern; OAuth callback gegen Login-CSRF, Replays und parallele Flows testen. Socket.IO bei `connect`, `create`, `join`, `peek`, Reconnect und identitätssensitiven Aktionen korrekt an serverseitige Session binden. Verliert ein Socket die gültige Session, dürfen alte Accountrechte nicht bestehen bleiben.
- Authentifizierung, Ranglistenberechtigung, Ticket-Admin und Raum-Hostrechte **strikt getrennt** behandeln. Ein eingeloggtes Discord-Konto ist kein Admin. Niemand erhält fremde Ticket-/Planungsrechte aufgrund identischer Namen; alte Gast-Cookies bleiben nach Möglichkeit kompatibel.

A3. Datenpersistenz:
- Bevorzugt versionierte SQLite-Datenbank in bestehendem `DATA_DIR`/Docker-Volume für accounts, oauth_identities, sessions, settings und new_ranked_results. Wähle einen **tatsächlich Node-22-Alpine-kompatiblen, CI-/Docker-geprüften** SQLite-Treiber; vermeide ungeprüfte native Addons. Verwende Foreign Keys, Indizes, eindeutige Constraints, parameterisierte Queries und Transaktionen.
- Idempotente Schema-Migrationen, Rollback-/Wiederanlaufstrategie, atomic/backed-up Datenmigration, restriktive Dateirechte. Vorher Backup der bestehenden `rooms.json`, `leaderboard.json`, `tickets.json`, `evening-reviews.json`, `secret.key` (sofern vorhanden) und weiterer produktiver Daten. Keine Secrets in Backups innerhalb Git.
- Das alte `leaderboard.json` unverändert archivieren und im UI als **historisch / nach Namen geführt / nicht verifiziert** trennen. NIEMALS alte Ergebnisse allein wegen Namensgleichheit einem Discord-Account zuordnen.
- Neue Resultate serverseitig nach unveränderlicher `accountId`, `gameId`, Spielvariante, `match/roundId`, Ergebnis, Zeit und Eligibility speichern. Ein Ergebnis nur einmal je eindeutiger Runde schreiben können. Erfolge daraus berechnen, keine zweite manuell manipulierbare Wahrheitsquelle.
- Datenschutz: öffentliche Profildaten von Login-/Session-Details getrennt speichern. Kein Discord-Token, Cookie, geheimes Raumtoken oder private Discord-ID an andere Spieler ausgeben. Einstellungen zu Account-/Datenlöschung, Logout aller Sitzungen und rechtlich erforderlichen Datenschutzhinweisen vorsehen.

## ARCHITEKTUR B — Echte Ranglisten und Game-IDs

B1. Rangliste ausschließlich aus serverseitig bestätigten Match-/Runden-Resultaten; Bots anhand von `player.bot` und unveränderlicher Raum-ID, **niemals anhand des Namens** ausschließen. Client darf keine Sieger/Punkte frei setzen.
B2. Eingefrorene Ranked-Eignung zu Rundenbeginn: Für die erste Version nur gültige Mehrspieler-Runden mit **mindestens zwei verschiedenen registrierten Menschen**, ohne Gast, ohne Bot und ohne gemischte Gast-/Bot-Besetzung. Ein Spielwechsel/Accountwechsel mitten in der Runde darf Eligibility nicht nachträglich verbessern. Private Räume können nach denselben fairen Regeln gewertet werden oder als explizit Casual konfiguriert sein; dokumentiere die Entscheidung. Solo-Highscores zunächst separate, nicht gewertete Kategorie, bis serverseitiger Missbrauchsschutz vorhanden ist.
B3. Abgebrochene Runden, simulierte Testpartien und nicht gewertete Spiele bleiben außerhalb der öffentlichen Rangliste; Match-Fingerprint/Idempotenzschutz gegen Doppelspeichern nach Crash/Replay. Kein Versprechen, dass Discord-Login absichtliche Absprachen oder mehrere echte Discord-Accounts verhindert.
B4. Ergebnisse / Spielerprofil / Erfolge nur nach `accountId`, externe Darstellung über `gameId` + öffentlichen Anzeigenamen; Aliaswechsel darf Historie nicht trennen. Rankings für die bestehenden 45 Spiele bzw. bereits unterstützte Varianten, Monatsansichten und bisherige Kriterien erhalten. Erfolge von registrierten Spielern korrekt berechnen, Gästen keine öffentlichen Erfolgsprofile geben.
B5. Keine erfundenen Top-Spieler. Bei 0 gültigen Ergebnissen klarer Empty State. Keine erfundene globale Gesamtwertung aus unvereinbaren Spielpunkten; wenn sinnvoll, aggregiere ausschließlich klar vergleichbare Kennzahlen und kennzeichne sie.
B6. Teste Account-Impersonation, manipulierte Resultate, doppelte Einträge, Bot-/Gast-Ausschluss, Gewinner mit identischem Anzeigenamen, gleichzeitige Tabs, Reconnect, Neustart, falsche Zeiträume, alte Daten.

## ARCHITEKTUR C — Benutzerpräferenzen / Sichtbarkeit

C1. Account-Einstellungen **mit echtem Funktionsbezug**, im minimalistisch-gläsernen Profilbereich. Registrierte: serverseitig persistiert, geräteübergreifend; Gäste: nur browserlokal und jederzeit rücksetzbar. Definierte Typen, Defaults, Versions-/Migrationsstrategie, Größenlimits und serverseitige Wertevalidierung.
C2. Sichtbarkeit und Navigation: einzelne Hauptbereiche/Module auf der Home-Seite ein-/ausblenden (z. B. Erfolge, Bestenlisten-Teaser, offene Tische, Online-Präsenz, Rückblicke, Planung, Tipps); ganze **Spielkategorien** (`karten`, `wuerfel`, `brett`, `party`) und auf Wunsch Spiel-IDs in persönlicher **Spielebibliothek** ausblenden; z. B. „Brettspiele ausblenden“. Eigenes „Ausgeblendete Inhalte anzeigen / Zurücksetzen“ stets erreichbar. Das Ausblenden ist reine UI-Präferenz, keine Sperre der Spielberechtigung.
C3. Hineinführen per Raumcode/Einladung/Weiter-spielen bleibt trotz ausgeblendeter Kategorie möglich. Gespielte Spiele dürfen nicht mitten in der Runde verschwinden; Spiele im Programmablauf müssen sichtbar bleiben. Admin- und Sicherheitsfunktionen können nicht verborgen/ausgehebelt werden, um Rechte zu umgehen.
C4. **Erfolge im eigenen Menü verstecken** ist nicht gleich **öffentliche Erfolge privat halten**. Zwei separate Einstellungsfelder: `showAchievementsSection` (UI) und `publicAchievements` (Privatsphäre; Default privat). Analog `showOnlinePresence`/Privacy vom bisherigen `poker:presenceHidden` übernehmen. Genaue Datenverarbeitung für Ergebnisse transparent machen; anbieterunabhängige Löschung/Deaktivierung anbieten.
C5. Weitere sinnvolle Optionen: Favoriten/zuletzt gespielt, Spielerprofil öffentlich/eingeschränkt, Kontoname/Avatar, Tisch-Hintergrundintensität, Transparenz reduziert, Animationen reduziert, Ton/Soundeffekte (bestehende Einstellungen respektieren), Kartengröße und PWA-Responsive-Kontext. Keine unnötige Backendkomplexität für rein kosmetische Optionen.
C6. Einstellungen über zulässige Schlüssel/Typen kontrollieren; unbekannte Schlüssel nicht blind persistieren; APIs nur für Besitzer änderbar, niemals `accountId` aus Payload als Rechtebeweis vertrauen. Bei abgemeldetem Gerät kein Leak der vorherigen Cloud-Einstellungen. Datenschutzschalter wirken auch auf API-/Präsenzdaten, nicht bloß auf die eigene Anzeige.

## ARCHITEKTUR D — Optionales Tischvideo (NICHT Discord-Video kopieren)

D0. **Fakten-Gate:** Es gibt für diese Node-/Browserseite keine unterstützte Discord-OAuth-Funktion, die laufende Kamerabilder aus einem fremden Discord-Videoanruf an den Browser weitergibt. **Nicht** behaupten, Discord-Video wird direkt gespiegelt. Keine Discord-RPC-Tricks, User-Token-Scraping, Desktop-Injection, inoffizielle Video-Endpoints, Bildschirmmitschnitte oder Drittanbieter-SDKs zur Umgehung. Discord dient allein der Account-Anmeldung.
D1. Eigenständige Tischkamera per `navigator.mediaDevices.getUserMedia({ video: ..., audio: false })` und WebRTC `RTCPeerConnection`, Signalisierung über bestehendes Socket.IO mit serverseitiger Berechtigungsprüfung. Voice läuft weiter in Discord außerhalb der Webseite. Video funktioniert auch für Gäste, wenn ihre Raum-Mitgliedschaft serverseitig bestätigt ist.
D2. Kamera **default OFF**, Benutzer muss aktiv „Kamera einschalten“ antippen und Browserberechtigung gewähren. Kamera-LED/-Indicator und im UI sichtbarer „Kamera aktiv“-Zustand, einfacher OFF-Schalter. Kein Auto-Start nach Login/Seitenreload, keinerlei Auto-Start anhand von Discord-Callstatus.
D3. Video ersetzt/ergänzt lokal am Sitzplatz den Avatar, mit Fallback auf Profilbild/Emoji. MVP nur für wirklich an diesem Tisch sitzende berechtigte Personen, **nicht automatisch für unlisted Tische suchende oder fremde Zuschauer**. Zuschauer erhalten standardmäßig kein Video; spätere Zustimmung/Freigabe separat. Teilnehmende dürfen fremde Videos bei sich abschalten; das darf die eigene Sendeberechtigung nicht verändern.
D4. Maximal 4 gleichzeitig sendende Videoteilnehmer als MVP, adaptives 320×240/12 fps, kein Mikrofon, kein Server-Aufzeichnen, kein Snapshot, kein Medien-Upload über Socket.IO, keine persistierten Video-URLs/-Frames. Verhindere Cross-Room-Signaling, Ziel-ID-Fälschung und Zuschauer-/IP-Leaks. Signal-Nachrichten (Offer, Answer, ICE) auf Payload-Länge/Rate begrenzen und nur zwischen Berechtigten des **selben aktuellen Tisches** vermitteln; Handshake/Room-Mitgliedschaft vor jeder Weiterleitung erneut prüfen.
D5. **HTTPS Pflicht**, aktiviertes Feature nur wenn URL HTTPS und notwendige Video-Infrastruktur konfiguriert sind. STUN/TURN mit autorisiertem Dienst; für datenschutzfreundlichen Betrieb WebRTC relay-only (`iceTransportPolicy: 'relay'`) mit kurzlebigen/zeitlich begrenzten TURN-Credentials, damit Teilnehmer ihre Peer-IP nicht über Host-/Srflx-Kandidaten offenlegen. TURN-Kosten/Limits dokumentieren, Peer-Mesh-Skalierung begrenzen; kein hardcodierter öffentlicher Gratis-TURN.
D6. `MediaStreamTrack.stop()`, `RTCPeerConnection.close()` und serverseitige Autorisierung auf Verlassen, Logout, Kick, Raumwechsel, Abbruch, Disconnect, Kamera aus, Accountwechsel und Session-Ende. Fehlende Kamerarechte, Safari/iOS-Einschränkungen, parallel belegte Kamera durch Discord, Mobil-Hintergrundmodus und Netzwechsel zeigen *klaren, funktionierenden Avatar-Fallback*. Kein Video darf den Spielebetrieb blockieren. Safari mobil und Desktop getrennt testen.
D7. Informationshinweise und Datenschutzhinweise vor Kamera-Freigabe; Videoübertragung nur an explizit autorisierte Empfänger. Defaults: `videoAllowed` optional, `autoJoinVideo=false`, `autoEnableCamera=false`, `receiveVideo=true`, `videoQuality='low'`, `videoFeatureEnabled=false` wenn HTTPS/TURN/Policy nicht erfüllt. Kein Video in Bestenlisten/Snapshots/Room-Logs/Rückblicken.
D8. Für Codex ohne TURN-Zugang: Implementiere **sicher die UI, Capability Detection, Feature-Flag, Server-Signaling-/Auth-Prüfungen und Test-Doubles**, dokumentiere Infrastruktur und markiere die echte End-to-End-Videoaktivierung als blockiert statt unsichere STUN-only-P2P-Übertragung in Produktion zu behaupten. Kein Fake-Discord-Video und kein ungetesteter Silent Rollout.

## ARCHITEKTUR E — Sicherheit und Datenschutz als Release-Gate

E1. Threat model schriftlich: OAuth callback-CSRF/state replay, session fixation/hijack, spoofed Socket-IDs, Cookie-Scope/CSRF, account linking takeover, guest->registered upgrade, duplicate rank submissions, bot/casual-farming, privacy enumeration über Game-ID, XSS/HTML injection über Namen/Discord-Daten, DoS via Video-Signaling, WebRTC Peer-IP-Leak, stale auth on reconnect, IDOR bei Profil-/Präferenz-APIs, Datenübertragung bei Logout, ungewollte Ticket-/Plan-Rechteübernahme.
E2. Gegenmaßnahmen in Implementierung und Tests nachweisen. Kein geheimes Token im Link, keine Tokens oder Discord-Snowflakes in Protokollen, keine Offenlegung der internen Account-ID. Status-/Profil-APIs datenminimiert, mit Paging, Rate-Limits und Sichtbarkeitsregeln; Pseudonyme/öffentliche Game-ID nicht zur Authentifizierung verwenden.
E3. Datenschutz: verständliche Info zu Discord-Verknüpfung, Cookies, Ranglistendaten, öffentlicher ID, Präsenz und Video. Funktionsfähige Abmeldung, Session-Widerruf und Account-Löschung/Anonymisierung mit definiertem Umgang abgeschlossener historischer Matches und etwaigen rechtlichen Aufbewahrungspflichten. Video nicht aufnehmen. Keine externe Tracking-/Analytics- oder unnötigen OAuth-Scopes.
E4. Produktions-HTTPS und sichere Proxy-/Origin-Konfiguration prüfen. Das bisherige Produktiv-Setup basiert auf Traefik; nicht versehentlich ungeschütztes Port 3000 als öffentlichen Rückweg offenhalten. `SITE_PASSWORD`, `TICKET_ADMIN_PASSWORD`, `DOMAIN`, `IMAGE` beibehalten, `.env.example` um nur leere/beispielhafte `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `PLAYER_SESSION_SECRET` (falls getrennt), `VIDEO_ENABLED`, `TURN_*` ergänzen; keine echten Secrets ins Git committen. Docker-Volume und GHCR-Ablauf bewahren.
E5. Die neue App darf auch ohne Discord-Konfiguration startbar sein: Gäste spielen normal, OAuth-Button wird deaktiviert/erklärt, alte Funktionen bleiben intakt. Feature-Flags für Rollout, Default für unsichere/ungetestete Videokonfiguration **aus**.

## Umsetzung und Tests — priorisiert und inkrementell

1. **Audit/Plan**: Aktuelle Repo-Dateien/Tests vollständig lesen, Status quo Screenshots, Commit/Branch, Impact-Tabelle, Threat Model, migrationsfähiges Backup-/Rollback-Konzept. Nicht sofort wild alle 45 Spiele editieren.
2. **Identity-Layer**: SQLite schema, App-/Guest-Session, serverseitige Identity-Auflösung, Player-ID/Room-Binding, Migrations- und Reconnect-Tests. Bestehende Räume/Ticket-/Plan-IDs erhalten.
3. **Discord OAuth**: OAuth start/callback, validierte Session und Accountprofil, Game-ID, Logout und sichere Nichtverfügbarkeit. Tests mit gemocktem Discord-Endpunkt; keine Live-Geheimnisse voraussetzen.
4. **Ranking/Erfolge**: Servergesteuerte Eignung, eindeutige RoundIDs, Legacy-Archiv, neue API, Startseiten-Top-Spieler nur aus wirklichen verifizierten Ergebnissen. Tests inkl. Bots/Gäste/Accountwechsel.
5. **Einstellungen**: Account-/Gastpräferenzen, Kategorien und UI-Bereiche ausblenden/reaktivieren, Privacy-/Presence-Schalter, Mobile; Public APIs mit Datenschutzkontrollen.
6. **Liquid-Glass-UI**: Integriere die ursprüngliche Designspezifikation ohne Mock-Freundesliste. Accountstatus im Profilchip, Gäste klar markieren. Kleine echte Top-Spieler-Kacheln nur falls vorhanden. Minimalistische Spielicons, *ein* warm unscharfer Background, keine Hintergrundbilder in Kacheln.
7. **Video nach Capability-Gate**: Nur selbstständiges WebRTC, kein Discord-Videostream. Zuerst opt-in UI + sichere autorisierte Signalisierung + Tests, dann TURN-/HTTPS-basierte Livefunktion nur mit vorhandener konfigurierter Infrastruktur. Kein Audio, keine Aufnahme, keine Videofunktion durch fehlende Credentials blockieren.
8. **Regressions-/Security-Tests**: `npm ci`, `npm test`, `npm run test:ui` in den vorhandenen Desktop-/Mobile-Projekten. Zusatztests für OAuth, Cookies, Session-Wechsel, Rangliste, IDOR, Präferenzen, Video-Gates, Room-Scopes, Disconnect. Reale Geräte Firefox/Chrome/Safari/iOS so weit verfügbar; nicht getestete Geräte ausdrücklich als offen markieren. Docker-Image mit Node 22 Alpine bauen und Start testen; Healthcheck/Compose prüfen.
9. **Finale Übergabe**: Dateiliste, geänderte APIs, Schema- und Datenmigration, Sicherheitsnachweise, Testresultate, Screenshotvergleich, tatsächliche Limitierungen, nötige Discord-Developer-Portal-Schritte und TURN-/Traefik-/HTTPS-Setup, Rollback, offene Risiken. Kein Deploy auf `/opt/poker` ohne explizite Freigabe.

## Abnahmebedingungen (nicht optional)

- Nicht angemeldete Gäste können mit eigener Mensch-Identität alle unterstützten Spiele spielen, hosten und beitreten, ohne Ranglisten-/Achievement-Farming. Computerbots bleiben getrennt.
- Zwei registrierte Discord-Konten haben stabile, nicht erratbare interne Account-IDs, eindeutige öffentliche Game-IDs und eigene Statistiken selbst bei gleichem/wechselndem Anzeigenamen.
- Bei gleichzeitiger Nutzung, Room-Switch, Reconnect, Nutzerwechsel, Logout und erneuter Anmeldung keine Identitäts-/Rechteübernahme; temporäre Gast-Session bleibt von globalem Account getrennt.
- Alte Rangliste bleibt historisch getrennt; neue gewertete Rangliste ist idempotent und serverseitig validiert. Keine gefälschten Top-Spieler.
- Kategorien und Erfolge können in persönlichen Einstellungen verborgen und wiederhergestellt werden; unabhängig von Privatsphäre-Einstellungen, keine Beeinträchtigung direkter Einladungen.
- **Kein Freundesystem.** Bestehende Online-Präsenz darf erhalten bleiben, aber nicht als „Discord-Freunde“ ausgegeben werden.
- Discord-Login und Videofeature sind getrennt. Keine Übernahme/Anzeige von Discord-Kamera-Videostreams versprechen. WebRTC-Video opt-in, durch echte Raum-Authentisierung eingeschränkt, standardmäßig aus und ohne Speicherung.
- Bestehende Funktionen (Tickets inkl. Admin, Planung, Rückblick, alle 45 Spiele, Bots, Zuschauer, private Räume, PWA, Website-Passwort) weiterhin funktionsfähig; bestehende Automated-Tests grün oder belegte gezielte notwendige Aktualisierungen.
- Keine Produktiv-Secrets, keine Datenverluste, kein Deployment ohne Freigabe.


---

# CODEX / CLAUDE CODE — BESTEHENDES LIQUID-GLASS-DESIGN (Bestandteil des V2-Masterprompts)

## AUFTRAG — SOFORT IMPLEMENTIEREN, NICHT NUR PLANEN

Arbeite direkt in meinem vorhandenen GitHub-Projekt `TTLPSCWA/PokerAbend` (Standardbranch `main`). Ziel ist ein konsistentes, tatsächlich funktionierendes visuelles Redesign **der gesamten bestehenden Spieleabend-Webplattform**, orientiert an dem beigelegten freigegebenen Referenzbild `design/referenz-game-library.png`.

Das Referenzbild ist ein **Moodboard / Layoutziel**, kein Screenshot einer vorhandenen fertigen Implementierung. Übernimm dessen Komposition und visuelle Sprache, **nicht** die dort beispielhaft dargestellten, eventuell nicht implementierten Spiele, Namen, Profile oder Funktionen. Das Bild selbst darf nicht als kompletter Seitenhintergrund, UI-Screenshot, Spielcover oder klickbare Oberfläche verwendet werden. Die UI muss aus echten DOM-Elementen, echtem CSS und echten Projektdaten entstehen.

**Wichtige Entscheidung:** Der zuletzt genehmigte Entwurf ist die minimalistische „Game Library“ mit weichem, gemütlichem, unscharfem Spielezimmer im Hintergrund und dezenten transluzenten Glasflächen. Die Spielkacheln bestehen aus einfachen, individuell passenden **Icons/Illustrationen ohne Fotohintergrund**. Frühere Entwürfe mit großformatigen Fotos auf jeder Spielkachel, überfüllten Galerien, pompösen Goldeffekten und künstlich wirkenden Spielwelten sind ausdrücklich verworfen. **Kein 3D, keine Kameraperspektiven oder WebGL-Engine in dieser Aufgabe.**

Du bist als Full-Stack-Implementierer tätig, nicht nur als Reviewer. Analysiere die aktuellen Dateien und implementiere die Änderungen in überschaubaren, überprüfbaren Schritten. Bewahre alle vorhandenen Spielabläufe und Produktionsdaten. Wenn du wegen Kontext-/Zeitlimits nicht alles fertigstellen kannst, hinterlasse **einen funktionsfähigen Zwischenstand** mit genauer Aufstellung von erledigten und offenen Punkten; behaupte niemals, dass alles abgeschlossen sei, wenn das nicht zutrifft.

## 1. BESTÄTIGTER REPOSITORY-AUSGANGSSTAND (VOR ÄNDERUNGEN NEU PRÜFEN)

Bei der Analyse des `main`-Branches vom **30.10.2026**, Commit `55abf04242fe90638af0b19f14a054e56c163b32`, wurde Folgendes vorgefunden. Prüfe zu Beginn, ob sich das Repository seitdem verändert hat, und nutze **immer den aktuellen Stand**:

- Node.js ES Modules, Express 4 und Socket.IO 4; vorhandene browserseitige Vanilla-JavaScript-/CSS-Architektur, **kein React-/Next.js-Projekt**.
- **45 registrierte Spiele** über `games/index.js`, weitere Ideen in `games/planned.js` und `games/roadmap.js`. Die tatsächliche Spielauswahl kommt über `/me` beziehungsweise `account.games`; geplante Spiele sind nicht spielbar.
- Vier im echten Katalog vorhandene Kategorien: `karten`, `wuerfel`, `brett`, `party`. Interne visuelle Szenenfamilien in `public/game-design.js`: `cards`, `dice`, `board`, `party`, `solo`, `drawing`, `arena`. **Nicht verwechseln.**
- `public/index.html`: Hub, Navigation, Dialoge, Spielcontainer und Script-/CSS-Einbindung.
- `public/hub.js` / `public/hub.css`: Home/Hub, Hash-Routing, Spielkatalog, Kacheln-/Listenansicht, Filter, Suche, Favoriten, kürzlich gespielt, offene Tische, Hosten, Navigation, Profil.
- `public/core.js` / `public/style.css`: UI-Grundlagen, CSS-Tokens, Socket-Verbindung, Client-Status, Spielmodule, Hilfsdialoge, Präferenzen.
- `public/game-design.js` / `public/game-design.css`: Szenenfamilien, Layout, Sound, Kartengrößen, reduzierte Bewegung; die bestehende API `GameDesign` weiter funktionsfähig halten.
- `public/games/kit.js`, `party-kit.js`, `drawing-kit.js`, `realtime-kit.js`, `solo/solo-kit.js` und die einzelnen `public/games/<id>/...`: wiederverwendbare Spieloberflächen mit unterschiedlichen Anordnungen.
- Spezifische Pokeroberfläche (`public/games/poker/`), Schiffespiel (`public/games/schiffe/`), Monopoly-/Stadtbrett (`public/games/monopoly/`) und die anderen 42 Spiele.
- Weitere produktive Bereiche: **Tickets mit Admin-Anmeldung**, Abendplanung, Abend-Rückblicke, Bestenlisten, Erfolge/Abzeichen, Präsenz-/Online-Anzeige, Roadmap, Party-Programme, Zuschauer, Bots, Hausregeln und gespeicherte Räume.
- `public/sw.js`: PWA-Service-Worker **ohne Offline-Cache**. `public/manifest.webmanifest`, App-Icons und lokaler Font `public/fonts/bricolage.woff2` vorhanden.
- `test/*.test.js` (Node-Tests), `test/ui/*.spec.js` (Playwright), `playwright.config.js` mit Desktop 1440×900 und Mobil 390×844; `npm test`, `npm run test:ui`.
- CI: `.github/workflows/docker.yml` baut nach Tests ein GHCR-Docker-Image. `docker-compose.yml` und `docker-compose.prod.yml` bestehen bereits; Laufzeit auf Debian unter `/opt/poker`, Volume für persistente Daten; Seitenpasswort `SITE_PASSWORD`, Ticket-Admin-Passwort `TICKET_ADMIN_PASSWORD`.
- Aktuelle Test- und UI-Verträge wie `#hub`, `#hub-main`, `#side-nav`, `#hub-tabbar`, `#games-body`, `[data-host]`, `#host-dlg`, `[data-scene]`, `#kg-main`, `#kg-dock`, Ticket-DOM und bestehende Hash-Routen werden bereits in Tests und Modulen genutzt.

Lies insbesondere die genannten Dateien und zugehörigen Tests. **Führe nicht blind einen Komplett-Rewrite durch.** Nimm keine Migration zu React, Tailwind, Vite oder einer neuen Serverarchitektur vor. Keine Änderungen an Regeln, RNG, Kartenverteilung, Zugrechten oder Raumcodes. Authentifizierung, Account-IDs, Speicherformat und benötigte Server-APIs sind **nur im Umfang des vorangestellten V2-Addendums** ausdrücklich beauftragt. Diese dürfen dort sicher und migrationsfähig geändert werden.

## 2. VERBINDLICHE VISUELLE RICHTUNG

**Motiv:** „Ein moderner, ruhiger privater Spieleclub“: dunkles Tannengrün und rauchiges Anthrazit; warme, unscharfe Lichter eines gemütlichen Spielezimmers im Hintergrund; dezente Liquid-Glass-Anmutung, zurückhaltendes Messing/Gold nur für Prioritäten und ausgewählte Aktionen.

**Gestaltung, die zu übernehmen ist:**

1. Ein **einziger** atmosphärischer Background für Hub/Katalog: gemütliches Spielezimmer, optisch weichgezeichnet, dunkel überlagert. Kein wiederholtes Foto im Header, in den Kategorien und jeder Kachel. Hintergrund ausschließlich aus einem **separaten, eigenständig nutzbaren, rechtlich unbedenklichen Asset**, sofern vorhanden. Das Referenzbild ist **kein** dafür geeignetes Background-Asset. Ohne solches Asset: visuell stimmiges CSS-Fallback implementieren und Bedarf in der Dokumentation markieren, kein beliebiges Foto von fremden Websites hotlinken.
2. Eine transparente, ruhig wirkende linke Sidebar (Desktop), ein subtiler Haupt-Container und sparsame Unterbereiche. Oberfläche aus dunklen, leicht getönten Glasflächen mit **maßvollem** `backdrop-filter`; geringe Transparenz, sichtbare dünne Borders, dezente innere Highlights. Kein spiegelnder Chromlook, kein übertriebenes Glow/Bloom.
3. Großzügige Whitespace-Abstände und eine klare typografische Hierarchie: Headline > Seitenüberschrift > Abschnitt > Spielname > Metadaten. Bestehenden lokal eingebundenen Font nach Lesbarkeit prüfen; keine externen Font-CDNs.
4. Spiele-Kacheln: maximal eine **schlichte, eigens passende SVG-/CSS-Illustration** als Hauptmotiv; einheitliche Größe, echte Spielnamen, Kategorie/Spielerzahl/Dauer, optional Favoritenstern. **Keine Fotos und keine Hintergrundbilder pro Kachel.** Ruhiger dunkler Grund, weiche Ecken, leichtes Hover-/Focus-Feedback, kein permanentes Animieren.
5. Kategorien als schmale, lesbare **Icon-Chips** ohne Fotos: Kartenspiele, Brettspiele, Würfelspiele, Partyspiele. Zusätzliche Labels wie „Zeichnen & Kreativ“, „Solo“ können als clientseitige *Unterfilter* aus vorhandenen Szenenfamilien ergänzt werden, müssen aber auf realen Spiel-IDs beruhen; keine künstlichen Serverkategorien, die bestehende Funktionen brechen.
6. Sparsam eingesetzte Akzente: Primär-CTA in dunklem Smaragdgrün; warmes Gold für Icon/kleine Markierungen; wichtige Fehlermeldungen haben genügend Kontrast. Kein überall wiederholter goldener Rand.
7. Keine künstlichen Ranglisten, erfundenen Spieler, erfundenen Freunde, Dummydaten, falsche Online-Status, Fake-Benachrichtigungen oder erfundene Spielbibliothek-Inhalte. Alle sichtbaren Inhalte aus echten vorhandenen Daten; bei Leerzuständen hochwertige, verständliche Empty-States.
8. **Kein 3D.** Die Spieloberflächen bleiben 2D; vorhandene kleine CSS-Animationen sind erlaubt, sofern performant und mit „Bewegung reduzieren“ vereinbar.

**Orientierende CSS-Design-Tokens (bei Bedarf an bestehende Tokens anpassen):**

```css
--ui-bg: #0b1513;
--ui-ink: #f2efe8;
--ui-muted: #adb7b1;
--ui-accent: #28644b;
--ui-accent-strong: #327a59;
--ui-warm: #d6b782;
--glass-bg: rgba(14, 22, 20, .74);
--glass-bg-soft: rgba(22, 29, 27, .64);
--glass-border: rgba(236, 243, 235, .15);
--glass-blur: 12px;
--ui-radius: 16px;
```

Dies sind **Orientierungswerte**, keine Anweisung zum globalen Überschreiben von Poker-Filz, Kartenfarben oder dem vorhandenen `data-theme='night'`. Bei `backdrop-filter` und nicht unterstützten Browsern: solide lesbare Fallback-Farbe; mobile und schwache Geräte möglichst wenige/kleine Filterflächen. Beachte auch Transparenzreduktion und `prefers-reduced-motion`.

## 3. VERBINDLICHE SEITENSTRUKTUR – DIE GESAMTE APP

Der neue Look gilt nicht nur für `#spiele`, sondern für **alle vorhandenen Bereiche** und zugehörigen Modals/Overlays, mit einer gemeinsamen Designsprache und je nach Kontext reduzierter Dichte:

### A. Navigation, Header, Profile (durch V2-Identitätsmodell ergänzt)
- Bestehende Hash-Routen **erhalten**: `#start`, `#spiele`, `#spiele/karten`, `#spiele/wuerfel`, `#spiele/brett`, `#spiele/party`, `#favoriten`, `#tische`, `#bestenliste`, `#roadmap`, `#tickets`, `#tickets/<id>`, `#rueckblick`, `#rueckblick/<id>`, `#planung`, `#planung/<id>`, `#erfolge`.
- Desktop: übersichtliche vertikale Sidebar, aktuelle Seite sichtbar markiert, klare Gruppen. Tablet: kollabierbar. Mobil: vorhandene Bottom-Navigation/geeignete Kompaktnavigation beibehalten und optisch integrieren. **Alle Seiten weiterhin erreichbar**, nicht bloß die fünf im Mockup.
- Search, Seitenpasswort-/Loginansicht, Profildialog, Avatarauswahl, Discord-/Gast-Login/Logout, Info- und Bestätigungsdialoge, Toasts, Fehlermeldungen ebenfalls angleichen.
- Neue **Konto- und Gast-APIs werden gemäß dem vorangestellten V2-Addendum ausdrücklich implementiert**. Keine Freundeslisten oder fremden Discord-Chat-/Video-APIs erfinden. Die bestehende Präsenz und ihren Datenschutz erhalten.

### B. Home (`#start`)
- Ruhiger Einstieg mit kurzem Begrüßungstext und primärem Button **„Tisch erstellen“**; dieser öffnet den **vorhandenen** Hosten-Dialog und braucht eine konkrete Spielauswahl, wenn noch kein Spiel ausgewählt ist.
- Mit echten Daten gespeiste kompakte Abschnitte: offene Tische, zuletzt genutzte Spiele, verfügbare Präsenz, Einstieg zu Abendplanung/Rückblick. Kein Scrollfriedhof; wichtige Elemente zuerst, optionale Inhalte unter „Alle anzeigen“.
- Kurzstatus für „Weiterspielen“ nur, wenn eine echte beitretbare/fortsetzbare Session existiert. „Zuletzt gespielt“ ist derzeit teilweise **lokaler Browser-Verlauf**: dies darf **nicht** als aktuell laufender Tisch dargestellt werden.

### C. Game Library (`#spiele`): wichtigster visuell umzubauender Bildschirm
- Referenzbild für Layoutgefühl verwenden, aber statt dessen großer repetitiver Kachelgrafiken:
  * Titel „Game Library“ oder konsistent deutsch „Spielebibliothek“; suchbares Katalogfeld, mobile Bedienbarkeit.
  * Eine Reihe minimalistischer Kategorie-Chips aus echtem Kategoriewert.
  * „Beliebte Spiele“ **nur** wenn echte Beliebtheitsdaten vorhanden sind. Andernfalls „Spiele entdecken“/„Unsere Spiele“ oder nachvollziehbar sortierte Auswahl. Kein erfundenes Ranking.
  * Pro Karte eine einfache Illustration aus `g.art` oder einem eigenständig entwickelten SVG, **ohne Foto**. Bestehende `art`-Daten aus `games/art-kit.js` vorrangig wiederverwenden. Kein hartcodierter Katalog aus dem Bild.
  * Spielerbereich, Dauer, kurze Beschreibung, Favoritenstatus, Aktion „Hosten“ bzw. „Tisch erstellen“; sämtliche Informationen aus `account.games`/`gameList()`.
  * Filter nach Kategorie, Spielerzahl, Dauer, Suchtext, Favoriten; bestehendes Listen-/Kachel-Umschalten und Sortierverhalten prüfen und funktional erhalten.
  * Geplante Spiele aus `games/planned.js` korrekt als „Bald“ / „Geplant“, nicht spielbar. Den Roadmap-Backlog nicht ungefragt als 45+ aktive Spiele vermischen.
- **Wichtig:** Der Screenshot zeigt z. B. Catan/Dixit/Skat und „Spiel hinzufügen“. Diese sind *nicht automatisch* im aktuellen `GAMES` implementiert. Nicht ungeprüft übernehmen. Der primäre Button soll nicht „Spiel hinzufügen“ behaupten, wenn es keine solche Funktion gibt: stattdessen „Tisch erstellen“ oder „Spiel auswählen“.
- Ein Klick auf eine Spielkarte darf nicht zu einer Sackgasse führen: entweder klare Spieldetails plus vorhandener `openHost(id)`-Pfad oder direkte Hosten-Aktion; `data-host` und bestehende Dialog-/Test-Verträge berücksichtigen.

### D. Favoriten, offene Tische und Präsenz
- Favoriten aus bestehenden `poker:favs`-Werten und `poker:recent` nachvollziehbar darstellen; browserlokale Daten nicht als serverseitiges Nutzerkonto darstellen. Kategorien, Gerätewechsel und fehlende Daten korrekt behandeln.
- Offene Tische zeigen nur **echte Server-Lobbydaten** (Spiel, Raumcode, Spielerzahl, Status, ggf. Zuschauer). Private Tische bleiben privat. Bestehende Aktionen Beitreten, Zuschauen, Link/Code, Room Resume bleiben erhalten.
- „Freunde online“ im Mockup bedeutet **keinen bereits vorhandenen Freundschaftsgraphen**: falls nur Presence existiert, Bereich „Spieler online“/„Gerade online“ nennen. Privatsphäre-Schalter („nicht als online zeigen“) respektieren. Nur tatsächlich implementierte Interaktionsbuttons anzeigen.

### E. Restliche Hub-Seiten
- `#tickets`: Listen, Filtersuche, Status-Chips, Stimmen, Kommentare, Editor, Detailseite und **Admin-Anmeldung/-rechte** im neuen Design; keine Abstriche bei XSS-Schutz, HMAC-Cookies, Admin-Freigaben und Bestätigungsdialogen.
- `#planung`: Abendplanung, Termin-/Spielvorschläge, Zusagen, Abstimmungen, Details, Speichern, Export, private Links.
- `#rueckblick`: gespeicherte Abend-Rückblicke, Charts, Rankings, Statistiken, Details, Export.
- `#bestenliste`: Filter, Zeiträume, Tabellen und echte Werte aus API.
- `#erfolge`: Abzeichen, Fortschritt, Filter und Detailansicht.
- `#roadmap`: bestehende Abschnitte, Entwicklungsstatus und geplante Spiele in dezentem, lesbarem Layout.
- Alle Dialoge/Formulare, Toasts und Fehler-/Leerladezustände übergreifend angleichen.

### E2. Persönliche Einstellungen und spielbezogene Details (nur echte Funktionen)
- Die bereits vorhandenen Präferenzen für Ton, Animationen, Kartengröße und bestehende Themes sollen im neu gestalteten Einstellungsbereich klar auffindbar bleiben und browserlokal gespeichert werden. Optional darf eine nutzbare Umschaltung „Glaseffekt reduzieren“ als rein visuelle lokale Präferenz ergänzt werden, falls damit eine messbare Performance-/Lesbarkeitsverbesserung einhergeht.
- Wenn ohne Regeländerung realistisch umsetzbar, 2D-Kartenrückseiten und Filz-/Tischfarben mit dezenten eigenen Varianten anbieten. Keine hunderte individuellen Grafikdateien oder Fake-Skin-Auswahl ohne Funktion.
- Leichte, gezielte 2D-Mikroanimationen für Ziehen/Spielen/Würfeln/Abschluss nur, wo die bestehende Spieloberfläche davon profitiert und der Nutzer sie deaktivieren kann. Keine unkontrollierten Daueranimationen.
- Kategorien- und Spiel-Icons sollen stilistisch zusammenpassen, aber nicht den Eindruck erzeugen, es handle sich um Originalgrafiken fremder Marken.

### F. Alle 45 Spieloberflächen
- Für **jede** Spiel-ID aus `games/index.js` prüfen, dass Spiel/Spielstart/Lobby, Hauptspielfeld, Hand/Board/Score/Action-Dock, Spieleranzeige, Regeln, Verlauf, Host-Panel, Rundenabschluss und responsive Ansicht weiterhin funktionieren.
- Gemeinsame Frame-Elemente (`kit.js`, `party-kit`, `drawing-kit`, `realtime-kit` usw.) im gleichen dezenten Design aktualisieren. Pro Spiel vorhandene charakteristische Materialien und Farben beibehalten, anstatt überall den gleichen Foto-Hintergrund einzusetzen.
- Kein 3D, kein Kamerasystem; keine serverseitigen Spielregeländerungen. Keine neue Bildtapete für jedes Spiel. Sofern kleine spezielle Themenakzente nötig sind (Schiffe = Blau/Ozeanraster, Poker = Filz, Werwolf = Nacht), nur **im jeweiligen Spielfeld**, zurückhaltend und zur Funktion passend; Karten-/Brett-Kontrast hat Vorrang.
- Bestehendes `GameDesign.scene()`, `GameDesign.cue()`, Kartengrößen, Ton-/Animationspräferenzen und alle bereits bestehenden UI-Spieltests erhalten bzw. vorsichtig erweitern.
- Besonders kontrollieren: Poker-/Omaha-Handkarten, 2D-Spielbretter (Dame, Mühle, Reversi, Mensch ärgere Dich nicht, Vier gewinnt), Schiffe-Raster, Würfel-/Punkteblätter, Party-Antwortfelder, Zeichenflächen, mobile Echtzeit-Steuerungen.

## 4. TECHNISCHE UMSETZUNGSREGELN

1. **Vorher prüfen:** `git status`, aktueller Branch/HEAD, `git diff`, Repository-Struktur, vorhandene UI-/Server-/E2E-Tests. Vorhandene uncommittete Nutzeränderungen niemals überschreiben oder wegwerfen. Falls möglich, auf einem neuen Feature-Branch arbeiten, z. B. `feat/liquid-glass-game-library`.
2. **Minimal-invasiv:** Bestehende Vanilla-JS-Architektur und Events nutzen. Für neue UI-Tokens ggf. `public/ui-theme.css` oder eigene Styles ergänzen; Überschreibung bestehender Selektoren vermeiden. Neue JS-Module nur wenn wiederverwendbar; nicht alle 45 Spiele kopieren/neu implementieren.
3. **CSP/Sicherheit:** Kein externes Tracking, keine neuen externen CDNs, keine eingebetteten Zugangsdaten/Secrets. Unvertrauenswürdige Texte weiterhin mit `esc()`/geeigneten Safe-DOM-Techniken ausgeben. Keine Änderungen an `/api/tickets`-Adminrechten, `SITE_PASSWORD`, `TICKET_ADMIN_PASSWORD`, Proxy/HTTPS, Docker-Persistenz oder Socket-Vertraulichkeit.
4. **Rechtliche Assets:** Nur eigenständige, lizenzierte oder nachweislich erlaubte Bilder/Icons/Fonts verwenden. Keine Übernahme von Monopoly-/UNO-Logos, offiziellen Kartengrafiken oder fremden Illustrationen. Bekannte Zahlen, Standardsymbole und Spielmechaniken dürfen verständlich bleiben. Bestehende technischen IDs nicht umbenennen.
5. **Performance:** Ein einziges optionales Hub-Hintergrundbild, wenn passende Rechte/Datei vorhanden, als optimiertes AVIF/WebP; kein Animations-Video, kein 45-maliges Laden großer Bilder. GPU-intensive `backdrop-filter`-Flächen begrenzen und Fallback anbieten. Keine Layout-Shifts, kein horizontaler Seitenoverflow. Keine unnötigen Bibliotheken und keine 3D-Libs.
6. **Zugänglichkeit:** Ausreichende Kontraste, echte Buttons/Links, Keyboard und Screenreader, `aria-current`, `aria-pressed`, Fokusmanagement, sinnvolle Touch-Ziele (mindestens ungefähr 44×44), Hover ist nicht die einzige Informationsquelle, möglichst WCAG 2.2 AA. `prefers-reduced-motion` und ggf. `prefers-reduced-transparency` beachten.
7. **Responsive:** Teste Desktop 1440×900, 1920×1080, Tablet ca. 768×1024, Mobile 390×844, schmales Mobile ca. 360px und Querformat 900×450. Keine verdeckten Spielaktionen oder übergroßen Glasschichten.
8. **PWA:** `manifest.webmanifest`, Icons, Login und `public/sw.js` beibehalten. Der aktuelle Service Worker speichert bewusst keine Seiten offline – kein neues Offline-Versprechen oder unkontrolliertes Caching.
9. **Datengetriebene Oberflächen:** `account.games`, `account.planned`, Lobby-/Präsenzdaten und andere vorhandene APIs sind maßgeblich. Keine Beispielinhalte aus Referenzbild hardcoden.
10. **Keine automatische Produktivveröffentlichung:** Nicht selbst auf den Debian-Server deployen, keine `.env` im Repo committen, keine Volume-Daten löschen. Am Ende nur notwendige, zur aktuellen Deployment-Variante passende Befehle dokumentieren.

## 5. ARBEITSREIHENFOLGE (UMSETZEN, TESTEN, WEITER)

**Etappe 0 — Audit und Sicherheitsnetz:** Bestehende Komponenten, Selektoren, Routendaten und Tests kurz in `docs/ui-redesign.md` festhalten; vor Änderungen Baseline-Tests laufen lassen. Falls bereits einzelne Tests defekt sind, separat dokumentieren.

**UI-Etappe 1 — Tokens und App-Chrome (nach Identity-Gates):** Globaler Hintergrund/Fallback, Liquid-Glass-Flächen, Typografie, Abstände, Buttons, Sidebar, Mobile Navigation, Header, Profile/Login/Dialoge. Referenzstil treffen, aber ruhiger als das Mockup.

**Etappe 2 — Game Library + Startseite:** Echter 45-Spiele-Katalog, minimalistische Spielkacheln und Kategorie-Chips, Suche/Filter/Favoriten, geplante Spiele, echtes Hosten, offene Tische und lokale Letztgespielt-Daten. Responsive und nutzbar, ohne Demo-Content.

**Etappe 3 — Rest der Plattform:** Tickets mit Admin-Modus, Planung, Rückblick, Bestenlisten, Erfolge, Roadmap, Präsenz und alle Formulare/Empty-States in konsistentem Design.

**Etappe 4 — Gemeinsame Spieloberflächen:** Shared Shell und Szenendesign für alle 45 Spiele prüfen und optisch harmonisieren, spezifische Spiel-CSS nur falls erforderlich; sämtliche Spiele regelkonform funktionsfähig halten. Keine Vollbild-Fotowelten.

**Etappe 5 — Qualitätssicherung/Feinschliff:** Node-Tests, Playwright Desktop/Mobile, Smoke-Test durch alle 45 Spiel-IDs, Screenshots vorher/nachher, Layout-Fit, Lese-/Kontrast-/Performancekontrolle, Login/Tickets/Beitreten/Zuschauen/Spiel beenden, gebrochene Links und Console Errors beheben.

Arbeite **nicht** bloß die erste Etappe ab und stoppe dann ohne Grund; liefere möglichst viele aufeinander aufbauende Etappen mit einem stabilen Stand. Teile komplexe Änderungen in sinnvolle kleine Commits, falls Commit-Rechte bestehen. Vor produktivem Deployment keine schädlichen Aktionen.

## 6. TESTS UND ABNAHMEKRITERIEN

Die Umsetzung ist erst dann als vollständig zu melden, wenn mindestens Folgendes überprüft wurde:

- `npm ci`, `npm test` erfolgreich oder klar dokumentierte umgebungsbedingte Ausnahmen.
- `npm run test:ui` bzw. `npx playwright test --project=desktop` und `--project=mobil` erfolgreich oder einzelne Fehler mit Reproduktion offengelegt; Playwright-Chrome bei Bedarf mit `PLAYWRIGHT_CHANNEL=chromium` konfigurieren, gemäß Repo-Konfiguration.
- 45 aktuell registrierte Spiel-IDs aus `games/index.js` im Katalog wiederzufinden; Spielansichten ohne JS-Fehler ladefähig. Keine aus `planned.js` fälschlich startbar.
- Suche, Filter, Favoriten, Listen-/Kachelansicht, `data-host`, Hosten-Dialog, Spiellink/-code, offene/private Tische, Zuschauer, Rejoin, Profil und Hash-Navigation funktionieren.
- Ticket-Admin nicht für normale Besucher sichtbar; Admin-Login/Logout, Abstimmen, Kommentare, Statuswechsel und Löschen funktionieren weiterhin.
- Abendplanung, Rückblicke, Bestenlisten, Erfolge, Roadmap und Präsenz öffnen und bedienen sich weiterhin korrekt.
- Auf Desktop/Tablet/Mobil keine abgeschnittenen Spielbretter, Kartenhände, Dock-Aktionen oder Dialoge; insbesondere Querformat testen.
- Eine einzige dominante Hintergrund-Atmosphäre, **keine Fotomotive in Spielkacheln**, Kategorien nur Icons; Glass-Layer zurückhaltend, flüssiges Scrolling, guter Kontrast.
- Mit und ohne `backdrop-filter` lesbar, mit reduzierten Animationen benutzbar. Keine fremden Logos/geschützten Assets kopiert.
- Keine neuen externen Abhängigkeiten, die nur Dekoration liefern; keine Änderungen an persisted Daten oder kritischen Regeln ohne guten Grund.

## 7. ABSCHLUSSBERICHT — VERPFLICHTEND

Antworte nach der tatsächlichen Implementierung auf Deutsch und liefere:

1. **Was wurde konkret geändert?** Betroffene Dateien und sichtbare Verbesserungen.
2. **Welche Bereiche/Spiele wurden tatsächlich bearbeitet bzw. nur auf Kompatibilität geprüft?** Keine pauschalen Behauptungen.
3. **Testergebnisse** mit ausgeführten Befehlen, Anzahl bestandener/fehlgeschlagener Tests und verbleibenden Risiken.
4. **Screenshots** von Desktop/Mobil für Home, Game Library, Spielansicht und mindestens Tickets; möglichst direkt mit der Referenz vergleichen.
5. **Offene Punkte** einschließlich eines eventuell noch fehlenden separat lizenzierten Hintergrundbildes.
6. **Deployment-Anleitung** für das vorhandene GHCR-/Docker-Compose-Setup in `/opt/poker` (nur falls zutreffend; Produktion nicht automatisch anfassen).
7. `docs/ui-redesign.md` mit Design-Tokens, Komponenten, Asset-Herkunft, Kompatibilitätsliste und Tests aktualisieren.

**START JETZT:** Lies zuerst `games/index.js`, `public/index.html`, `public/hub.js`, `public/hub.css`, `public/core.js`, `public/style.css`, `public/game-design.js`, `public/game-design.css`, `public/games/kit.js`, die weiteren Shared Kits und repräsentative `test/ui/*.spec.js`. Prüfe dann den aktuellen Branch und implementiere eigenständig. Keine bloße Beratung, keine 3D-Experimente, keine Bilderflut, keine erfundenen Funktionen. Die freigegebene minimalistische Game-Library-Referenz ist die gestalterische Leitlinie für das gesamte Projekt.