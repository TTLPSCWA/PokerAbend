# CODEX / CLAUDE CODE — MASTERPROMPT: PokerAbend UI-Redesign (Game Library + Subtle Liquid Glass)

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

Lies insbesondere die genannten Dateien und zugehörigen Tests. **Führe nicht blind einen Komplett-Rewrite durch.** Nimm keine Migration zu React, Tailwind, Vite oder einer neuen Serverarchitektur vor. Keine Änderungen an Regeln, RNG, Kartenverteilung, Zugrechten, Authentifizierung, Socket-Events, Raumcodes, DB/Dateispeicherung oder Deploy-Konfiguration, sofern dies nicht nachweislich zwingend zur UI notwendig ist.

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

### A. Navigation, Header, Profile
- Bestehende Hash-Routen **erhalten**: `#start`, `#spiele`, `#spiele/karten`, `#spiele/wuerfel`, `#spiele/brett`, `#spiele/party`, `#favoriten`, `#tische`, `#bestenliste`, `#roadmap`, `#tickets`, `#tickets/<id>`, `#rueckblick`, `#rueckblick/<id>`, `#planung`, `#planung/<id>`, `#erfolge`.
- Desktop: übersichtliche vertikale Sidebar, aktuelle Seite sichtbar markiert, klare Gruppen. Tablet: kollabierbar. Mobil: vorhandene Bottom-Navigation/geeignete Kompaktnavigation beibehalten und optisch integrieren. **Alle Seiten weiterhin erreichbar**, nicht bloß die fünf im Mockup.
- Search, Seitenpasswort-/Loginansicht, Profildialog, Avatarauswahl, Login/Logout, Info- und Bestätigungsdialoge, Toasts, Fehlermeldungen ebenfalls angleichen.
- Keine neuen Konto-, Freundschafts- oder Chat-APIs erfinden. Der aktuelle Nutzer hat einen lokal gespeicherten Namen/Avatar. Präsenzfunktion nur so darstellen, wie sie technisch tatsächlich existiert.

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

**Etappe 1 — Tokens und App-Chrome:** Globaler Hintergrund/Fallback, Liquid-Glass-Flächen, Typografie, Abstände, Buttons, Sidebar, Mobile Navigation, Header, Profile/Login/Dialoge. Referenzstil treffen, aber ruhiger als das Mockup.

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
