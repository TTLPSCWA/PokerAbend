# Themenwelten: Architektur und verbindliche Grundsätze

Stand: 15. November 2026 (zuletzt abgeglichen nach ART-W1, Version 3.13.0). Nichts in diesem Dokument gibt ein Arbeitspaket frei; gebaut wird nur nach ausdrücklicher Freigabe einer ID (CLAUDE.md/AGENTS.md). Weltenkatalog und Paketzuordnung: [THEME_WORLDS.md](THEME_WORLDS.md). Prüfliste für jede neue Welt: [THEME_QUALITY_CHECKLIST.md](THEME_QUALITY_CHECKLIST.md). Lizenzen: [ART_LICENSES.md](ART_LICENSES.md), [SOUND_LICENSES.md](SOUND_LICENSES.md).

> **Aktueller Stand:** Das ursprüngliche Konzept mit TW-01 bis TW-16 liegt seit dem 15.11.2026 vor und ist in `THEME_WORLDS.md` vollständig übernommen. Umgesetzt sind ART-W0 (zentrale Registry und Lebenszyklus, 3.12.0) und von ART-W1 der Monopoly-Teil von TW-01 (3.13.0).
>
> **Historischer Hinweis (Erstfassung dieses Dokuments, vor ART-W0):** Damals lag das Konzept nicht vor – weder auf `main` noch in der Git-Historie, in den Pull-Request-Zweigen des Remotes oder im privaten Vault; die Einzelprüfung von TW-01 bis TW-16 war offen. Abschnitte 1 und 6 beschreiben teilweise diesen damaligen Zustand und sind entsprechend gekennzeichnet.

## 1. Bestand: fünf getrennte Gestaltungsmechanismen

| Mechanismus | Geltung | Wer wählt, wann | Speicherort und Synchronisierung | Daten / Code |
|---|---|---|---|---|
| **Kartenwelten** (ART-T1–T6) | UNO (nur Classic), Skip-Bo, Phase 10; Winterwelten X-01–X-10 in allen drei | Host, jederzeit (auch in Runde und Pause) | Raumfeld `cardWorld`, vom Server über `worldOf()` geprüft, im Raumstand an alle, im Snapshot gespeichert; beim Spielwechsel nur behalten, wenn die Welt im neuen Spiel gilt | `public/games/card-worlds/worlds.js`, `public/card-worlds.js`, `setCardWorld` in `server/index.js` |
| **Skins Schiffe versenken** (ART-013) | nur `schiffe` | Host beim Erstellen (Vorschaukarten), danach im Host-Menü zwischen Runden | `settings.skin`, `safeSkin()` | `games/schiffe/skins.js` |
| **Monopoly-Themes** (ART-046) | `monopoly` Standard und Tempowürfel, nie Junior | Host über `settings.theme`; nur freigegebene Themes wählbar | Registry mit `released`, Feldnamen serverseitig, Asset-Manifest mit Prüfsummen | `public/games/monopoly/themes.js`, `theme-manifest.js`, `theme-renderer.js` |
| **Klangszenen** (EXP-F5) | alle Spiele, Standardszene je Spiel | Spieler (Mixer, Standard 0 %) | lokal pro Gerät | `public/sound/ambient/worlds.js`, `scenes.js` |
| **Anzeige-Thema** | ganze Seite | jeder Spieler für sich | Kontoeinstellung `display.theme` (`classic`/`night`) | `server/settings.js` |

**Befund (Stand vor ART-W0; seit 3.12.0 gibt es die zentrale Registry `public/games/theme-worlds/registry.js` für Kartenwelten und Themenwelten, siehe Abschnitt 7 – Schiffe-Skins, Monopoly-Themes, Klangszenen und Anzeige-Thema laufen weiterhin getrennt):** Eine zentrale Theme-Registry gab es nicht. Jede Lösung hat eigene Auswahl, eigene Speicherung und eigene Prüfung. Die Kartenwelten sind am weitesten (spielübergreifend, Hostauswahl auch mitten in der Runde, Lebenszyklus getestet); Monopoly hat die strengste Asset- und Freigabekette. Neue Themenwelten sollen beides vereinen, ohne die bestehenden Mechanismen zu brechen: Die vorhandenen IDs (`U-01` … `X-10`, `naval`/`space`, `modern`/`classic`) und Raumfelder bleiben unverändert.

## 2. Verbindliche Grundsätze für Themenwelten

### 2.1 Zentrale Theme-Registry
- Eine Datei als einzige Quelle für alle Themenwelten (`public/games/theme-worlds/registry.js`, seit ART-W0 umgesetzt, von Server und Browser geteilt wie `card-worlds/worlds.js`). Pro Welt: stabile ID, Name (DE/EN), `released`, kompatible Spiele/Varianten, Pfad zum Asset-Manifest, Klang (optional), Lizenzstatus.
- Der Server prüft jede Auswahl gegen die Registry (wie `worldOf()`); unbekannte, nicht freigegebene oder für das Spiel ungeeignete IDs ergeben **Standard**.
- Vorhandene Mechanismen werden **nicht** umgebaut. Die Registry darf sie später als Adapter einbinden (z. B. Kartenwelten als Welten mit `games: ['farbenchaos', …]`); jede solche Zusammenführung ist ein eigenes Paket.
- IDs werden nie umnummeriert oder wiederverwendet; entfernte Welten bleiben als „zurückgezogen“ eingetragen, damit gespeicherte Räume sicher auf Standard fallen.

### 2.2 Kompatibilität zwischen Spiel und Welt
- Jede Welt nennt ausdrücklich ihre Spiele **und Varianten** (Beispiele aus dem Bestand: UNO-Varianten mit eigener Gestaltung und Monopoly Junior sind ausgeschlossen).
- Eine Welt gilt nur, wenn Spiel und Variante passen; sonst zeigt der Tisch Standard und das Host-Menü nennt den Grund (wie heute bei Kartenwelten).
- Beim Spiel- oder Variantenwechsel bleibt die Welt nur, wenn sie auch dort gilt; sonst Standard. Keine stillen Teilanwendungen.

### 2.3 Trennung von Spielmechanik und Darstellung
- Welten ändern **nie** Regeln, Zufall, Zeitlimits, Bots, Wertung, Spiel-IDs, Raumcodes oder Ereignisnamen. Server-Spiellogik liest keine Welt.
- Texte einer Welt (z. B. „+2 = Zauberspruch“) sind Beschriftung; die Wirkung kommt aus dem Spiel. Verdeckte Informationen werden durch Grafiken nie verraten (keine bildabhängigen Hinweise, keine Dateinamen mit Inhalt).
- Datenformate trennen Regeln, Anzeigenamen und Ressourcen (Muster: Monopoly-Themes und Asset-Manifest; das Manifest lehnt Spieldaten ab).

### 2.4 Standarddesign als Fallback
- „Standard“ ist immer wählbar, ist der Ausgangswert und braucht keine Welt-Assets.
- Fehlt eine Datei, scheitert ein Manifest oder lädt eine Schrift nicht: sichtbarer, lesbarer Rückfall auf Standard bzw. Platzhalter (Fallback-Datei, Systemschrift), nie eine leere oder unbedienbare Fläche.
- Ein beschädigter oder unbekannter Wert im gespeicherten Raum ergibt Standard, ohne Fehler für die Spieler.

### 2.5 Hostkontrolle
- Nur der Host wählt (Server prüft `requireHost`). Gäste und Zuschauer sehen, welche Welt gilt, können sie aber nicht ändern.
- Wann gewechselt werden darf, legt jede Welt fest: rein optische Welten wie Kartenwelten auch mitten in der Runde; Welten mit eigenem Brett-Renderer oder anderen Ressourcen (z. B. Monopoly-Szene) nur zwischen Runden.
- Persönliche Einstellungen bleiben persönlich: Effekte wie Schneefall, Musik, Lautstärke und reduzierte Bewegung schaltet jeder Spieler für sich (pro Gerät), der Host kann sie nicht für andere erzwingen.

### 2.6 Synchronisierung bei Beitritt und Wiederverbindung
- Die gewählte Welt ist Teil des Raumstands (wie `cardWorld`), wird bei jedem Stand mitgeschickt und im Snapshot gespeichert. Beitritt, Neuladen, Wiederverbindung, Serverneustart und „Weiterspielen“ zeigen ohne zusätzliche Aktion die aktuelle Welt.
- Der Browser wendet eine Welt nur für den Tisch an, an dem er gerade sitzt (Raumcode = aktuelle Sitzung, nicht geparkt). Ein verspätet eintreffender Stand eines verlassenen Raums darf nichts einschalten (Lehre aus den Winter-Fehlern, siehe 3).

### 2.7 Vollständiges Entfernen beim Verlassen oder Wechseln
Jede Welt hat genau **einen** Besitzer im Browser, der alles anlegt und alles wieder entfernt:
- DOM: zusätzliche Ebenen und Knöpfe (wie `#cw-snow`, `#cw-snow-toggle`, `#cw-music-toggle`), Klassen und `data-*`-Attribute an `body`/`#kg`.
- Ton: Audio-Elemente pausieren, `src` lösen, Puffer freigeben; Klangszenen auf Standard; wartende Gesten-Listener entfernen.
- Zeitgeber, `requestAnimationFrame`, Beobachter (`ResizeObserver`, `IntersectionObserver`), Ereignis-Listener am Dokument.
- Nachgeladene Stylesheets/Schriften dürfen gecacht bleiben, aber nicht mehr wirken (Selektoren hängen an der Welt-ID).
- Auslöser: Tisch verlassen, Platz behalten („parken“), Tisch geschlossen, Startseite, anderer Raum, Spiel-/Variantenwechsel, Weltwechsel, „ersetzt“ durch einen anderen Tab, Seite verlassen (`pagehide`). `clear()` muss idempotent sein und darf beliebig oft laufen.

### 2.8 Keine globalen Seiteneffekte
- Welt-CSS nur unter einem Welt-Selektor (`body[data-card-world="…"]`, `#kg[data-…]`), keine Änderungen an globalen Elementen, Schriften oder Variablen ohne diesen Präfix.
- Keine globalen Variablen außer dem einen Modul-Objekt; keine dauerhaften Listener ohne Entfernen; `localStorage` nur mit Präfix und nur für persönliche Schalter.
- Andere Spiele und die Startseite bleiben unverändert (per Test belegt).

### 2.9 Lazy Loading und Caching
- Welt-Code, -CSS, -Schriften, -Bilder und -Musik werden erst geladen, wenn die Welt gilt; Musik erst, wenn der Spieler sie einschaltet (`preload="none"`).
- Bilder über die Asset-Pipeline aus Paket F (`docs/design/MONOPOLY_THEME_ASSETS.md`): WebP, Handy-Varianten, hashbasierte Dateinamen, Manifest mit Größe, Prüfsumme und Herkunft. Langes Caching nur für hashbenannte, unveränderliche Dateien; Manifeste und HTML behalten die bisherige Regel.
- Budgets je Welt (Zielwerte, je Welt zu messen): Auswahl-Vorschau ≤ 300 KB, Tisch beim Start ≤ 1,5 MB mobil und ≤ 2,5 MB Desktop, Musik nur auf Wunsch. SVG bevorzugt für Motive (Leitplanke 7 der Grafik-Roadmap).

### 2.10 Desktop, Tablet, Smartphone
- Prüfgrößen wie in `GAME_VISUAL_GUIDELINES.md`: 1920×1080, 1440×900, 768×1024, 390×844, 360×800, 900×450 (Querformat). Kein waagerechtes Überlaufen, Bedienelemente ≥ 44 px, Pflichtinfos sichtbar.
- Effekte und große Bilder auf schwachen Geräten reduzieren (kleinere Varianten, weniger Ebenen); Schneefall o. ä. nie über Bedienelementen und ohne Zeigerereignisse.

### 2.11 Reduzierte Animationen und Kontraste
- `prefers-reduced-motion` und die Plattformeinstellung „Ruhig“ schalten Bewegungseffekte ab (Vorbild: `#cw-snow` steht dann still), Inhalte bleiben vollständig.
- Text und Werte erreichen mindestens WCAG-AA-Kontrast (4,5:1, große Schrift 3:1) auf allen Welt-Hintergründen; Farben werden nie allein zur Unterscheidung genutzt (Farbsymbole bleiben).
- Effekte haben einen sichtbaren, beschrifteten Schalter (`aria-pressed`, `aria-label`), Musik ist standardmäßig aus und startet nie ohne Nutzeraktion.

## 3. Lehren aus Schnee und Wintermusik (ART-T5/T6)

| Commit | Problem | Ursache | Regel daraus |
|---|---|---|---|
| `8c1cd39` | Schnee und Musik liefen nach dem Verlassen des Tisches weiter | Effekte hingen am Raumstand, Verlassen räumte nichts ab; geparkte Spieler bekamen weiter Stände | Verlassen/Parken/Startseite rufen `clear()`; während des Parkens nichts anwenden (2.7) |
| `d008f14` (3.1.1) | Welt nach „Weiterspielen“ nicht wieder an; ein ersetzter Tab spielte weiter Musik | kein erneutes Anwenden nach Rückkehr; `replaced` stoppte den Ton nicht | Rückkehr wendet den letzten Stand neu an (`reapply`); `replaced` ruft `clear()` |
| `478b690` (3.1.3) | ein nach dem Verlassen eintreffender Raumstand schaltete Welt, Schnee und Musik wieder ein | Stand wurde ohne Raumprüfung angewendet | nur Stände des aktuellen Tisches anwenden (`forTable`: Code = Sitzung, nicht geparkt); Lebenszyklus-Test `art-t6-winter-lebenszyklus.spec.js` |

Zusätzlich verbindlich: genau ein Audio-Element pro Welt, Pause bei verdecktem Tab (`visibilitychange`), Gesten-Listener für Autoplay nach Gebrauch entfernen, Lautstärke niedrig (heute 0,3), Musik pro Gerät gespeichert und Standard aus. Jede neue Welt mit Effekten übernimmt diese drei Lebenszyklus-Tests sinngemäß.

## 4. Barrierefreiheit und Verständlichkeit

- Weltname und eine Zeile „was sich ändert“ im Host-Menü (DE/EN); „Nur Aussehen, für alle am Tisch“ bleibt sichtbar.
- Beschriftungen in der Welt dürfen Spielbegriffe ergänzen, nicht ersetzen: „Aussetzen“ bleibt lesbar (z. B. als Untertitel), damit Regeln und Hilfe gültig bleiben.
- Bildschirmleser: dekorative Ebenen `aria-hidden`, Karten- und Feldnamen weiterhin als Text.

## 5. Erweiterbarkeit

- Neue Welt = Registry-Eintrag + Manifest + Assets mit Nachweis + Tests aus der Prüfliste; kein Eingriff in Spielcode.
- Neues Spiel für eine bestehende Welt = Kompatibilitätseintrag + Spiel-Adapter (Selektoren/Variablen) + Tests; andere Spiele bleiben unberührt.
- Welten können Teile teilen (Farbpalette, Schrift, Motive, Klang); geteilte Teile tragen ihre Lizenz einmal und werden je Nutzung referenziert.

## 6. Risiken und Unklarheiten

1. **Konzept (erledigt am 15.11.2026):** Das Konzept TW-01 bis TW-16 liegt vor und ist in `THEME_WORLDS.md` übernommen; der Prüfstand der Quellen steht dort in den Abschnitten 4.1 und 6. Weiterhin fehlt der TW-01-Entwurf `ART-046-mythos-weltkonzept.md`. *(Ursprünglicher Eintrag: „Konzept fehlt: TW-01 bis TW-16 und die dort genannten Quellen sind ungeprüft.“)*
2. **Vorbilder aus geschützten Marken:** Die interne Vorbild-Tabelle der Kartenwelten nennt u. a. Harry Potter, The Witcher, Minecraft, Pokémon, Super Mario, Fortnite. Stil und Stimmung sind nicht geschützt, Namen, Logos, Figuren, typische Gestaltung und wörtliche Übersetzungen von Marken können es sein (z. B. „Taschenmonster“ ≈ „Pocket Monsters“, „Hauswahl“ im „Zaubersaal“). Das Repository ist öffentlich. Empfehlung: für neue Welten keine Marken als Vorbild nennen und Namen auf Verwechslungsgefahr prüfen; bestehende Welten gesondert prüfen lassen (keine Rechtsberatung in diesem Dokument).
3. **Pixabay-Musik:** Die Pixabay-Inhaltslizenz (Nutzungsbedingungen, Stand 20. Oktober 2026) verbietet die Weitergabe „on a Standalone basis“, definiert als Inhalt ohne kreative Bearbeitung „in substantially the same form“. Die fünf Stücke liegen nach Neukodierung, Lautheitsangleich und Blenden im **öffentlichen** Repository und sind dort einzeln abrufbar. Ob das als eigenständige Weitergabe gilt, ist **ungeprüft**; Alternative: durch CC0-Stücke ersetzen oder nicht im öffentlichen Repository führen.
4. **Unvollständige Musiknachweise:** „Winter Wind Loop“ ohne Urheber; die OpenGameArt-Seiten waren bei dieser Prüfung nicht abrufbar (HTTP 403), die CC0-Angaben der fünf OpenGameArt-Stücke sind deshalb **nicht erneut geprüft**.
5. **Projektlizenz:** `package.json` nennt `UNLICENSED`, eine `LICENSE`-Datei fehlt. „Eigene Grafiken, gleiche Lizenz wie das Projekt“ heißt damit: alle Rechte vorbehalten, keine Lizenz an Dritte. Für eigene Weltgrafiken genügt das; eine Weitergabe an andere wäre gesondert zu regeln.
6. **Fünf Mechanismen:** Ohne Registry drohten doppelte Auswahl, widersprüchliche Fallbacks und verschiedene Lebenszyklen. Seit ART-W0 laufen Karten- und Themenwelten über eine Registry; Schiffe-Skins, Monopoly-Themes (`settings.theme`), Klangszenen und Anzeige-Thema sind weiterhin eigene Mechanismen.
7. **Performance:** Mehrere Effekt-Ebenen (Schnee, Szenen-Renderer, Welt-CSS) gleichzeitig sind nicht gemessen; jede Welt braucht eine Bildratenmessung (Grafik-Roadmap: ≥ 90 % bei 4× CPU-Drosselung).
8. **KI-generierte Bilder:** Herkunft und Nutzungsbedingungen des Generators müssen je Datei belegt sein; Darstellungen geschützter Figuren oder Orte bleiben auch als KI-Bild geschützt (siehe ART-046).

## 7. Umsetzung ART-W0: Themenwelten-Fundament (Stand 3.12.0)

Der Projektinhaber hat ART-W0 als technisches Fundament freigegeben (Registry, Lebenszyklus, Synchronisierung). Das bestehende System wurde erweitert, keine parallele Auswahl geschaffen:

| Teil | Datei | Aufgabe |
|---|---|---|
| Registry | `public/games/theme-worlds/registry.js` (Server und Browser) | Weltdefinition (ID, Art, Name/Beschreibung DE/EN, Spiele, Varianten, Assets, Farben, Schriften, Effekte, Fallback, Freigabe, Herkunft), strenge Prüfung (`validateWorld`, `createRegistry`; Spielmechanik-Schlüssel und fremde Pfade abgelehnt), `worldFor`, `worldsFor`, `appliesTo`, `assertGames`. Die 40 Kartenwelten sind als Art `card` eingebunden (`cardWorldDefinition`). |
| Server | `server/index.js` | Startprüfung `assertGames` (Welt nennt nur vorhandene Spiele), Ereignis `setCardWorld` und Raumfeld `cardWorld` bleiben die eine Weltauswahl: nur der Host, Prüfung über die Registry, unbekannte/inkompatible IDs abgelehnt, beim Neustart und Spielwechsel auf Standard zurück. |
| Lebenszyklus | `public/theme-worlds.js` (`ThemeWorlds`) | activate → update → deactivate → cleanup. Je Welt und je Effekt ein Scope (DOM, `data-*`, Klassen, Listener, Zeitgeber, `requestAnimationFrame`, Beobachter, Audio); erledigte Einträge verschwinden sofort, `cleanup()` ist beliebig oft aufrufbar. Gemeinsame Effekte bleiben beim Weltwechsel bestehen. Nur der aktuelle Tisch zählt (Sitzung, nicht geparkt); Verbindungsabbruch hält den Ton an, der nächste Raumstand setzt fort; `pagehide` räumt ab; fehlende oder unbrauchbare Vorschau-/Vorladedateien → Standard. |
| Kartenwelten | `public/card-worlds.js` | meldet Art `card` und die Effekte `snow` und `music` an (IDs, Attribute, Speicherschlüssel und Verhalten unverändert); Host-Menü wie bisher, für andere Spiele die allgemeine Auswahl (heute leer). |
| Tests | `test/theme-worlds.test.js`, `test/ui/theme-worlds.spec.js` | Registry und Validierung, Gleichwertigkeit mit der bisherigen Prüfung, zwei Räume, Rechte, späte Spieler, Wiederverbindung, Neustart; im Browser mehrfacher Wechsel ohne Rückstände, Abbruch/Wiederverbindung, fehlende und unbrauchbare Dateien, andere Weltart, Tisch geschlossen, Seite verlassen, Parken, reduzierte Bewegung, Mobil. |

Neue Welt (ab ART-W1): Eintrag in `BUILTIN` der Registry mit `released: false`, Effekt-Umsetzungen über `ThemeWorlds.effect(typ, { activate, update, suspend, deactivate })`, Art-Darstellung über `ThemeWorlds.kind(art, { activate, update, deactivate })`; alle Ressourcen nur über den übergebenen Scope anlegen. Freischalten erst nach der Prüfliste.

## 8. ART-W1: Referenzwelt TW-01 für Monopoly (Stand 3.13.0)

Freigegeben als erste vollständige Welt auf dem ART-W0-Fundament: TW-01 „Schatten über Neuengland“ (Konzept, Palette und Grenzen in [THEME_WORLDS.md](THEME_WORLDS.md)). Erweiterungen dafür:

- Registry: optionales Feld `texts` (Darstellungstexte `fields`, `cards`, `tokens`; nur Text, nie Wirkung), Welt-Art `board`, Varianten `monopoly: classic, speed`.
- Server (`games/monopoly/room.js`): die Welt des Raums (`cardWorld`) liefert Feld-, Karten- und Figurennamen; Rangfolge eigenes Brett → Welt → Monopoly-Theme → Standard (`public/games/monopoly/themes.js`). Regeln, Ereignisse und IDs unverändert.
- Browser: Welt-Stylesheet `tw-01.css` wird nur während der Welt geladen (Scope entfernt den `<link>`); der Monopoly-Client trägt dafür reine Anzeige-Attribute (`data-group`, `data-type`, `data-level`, `data-token`). Allgemeine Auswahl im Host-Menü mit Vorschaubild und Variantenprüfung.

## 9. Paketstruktur (an das Konzept angeglichen)

Die fachliche Zuordnung folgt dem ursprünglichen Konzept (`THEME_WORLDS.md`, Abschnitt 7). Eine frühere Fassung dieses Dokuments hatte ART-W2 als Asset-/Klangpipeline und ART-W3/W4 als allgemeines Ausrollen gedeutet; diese Deutung ist **ersetzt**. Abgeschlossene Pakete behalten ID und Inhalt.

| Paket | Inhalt (Konzept) | Stand | Technische Voraussetzungen (Teil des jeweiligen Pakets, keine eigene Freigabe) |
|---|---|---|---|
| **ART-W0** | Fundament: Registry, Host-Auswahl, Lebenszyklus, Server-Prüfung | umgesetzt (3.12.0) | – |
| **ART-W1** | Monopoly + Monopoly Deal mit TW-01 | teilweise: Monopoly umgesetzt (3.13.0), Monopoly Deal offen | Deal: Kartenfronten-Renderer mit Anzeige-Attributen; Darstellungstexte für Deal-Karten |
| **ART-W2** | Würfelbecher-Welten TW-14, TW-11, TW-09, TW-13 für alle 13 Würfelspiele | umgesetzt (3.14.0): gemeinsamer Baustein `dice/dice-worlds.css`, Welt-Dateien nur mit Variablen | gemeinsamer Würfel-/Becher-Baustein statt Einzelanpassungen; Wurfgeräusch nur als Effekt mit Schalter (Standard aus), Lebenszyklus-Tests wie Wintermusik |
| **ART-W3** | Klassische Bretter (Schach, Mühle, Dame, Reversi, Hex, Vier gewinnt, Backgammon) mit TW-08, TW-09, TW-10 | geplant | je Spiel Anzeige-Attribute im Renderer; Figurensätze für Schach als eigene oder geprüfte CC0-Grafiken; Lesbarkeit der Steine (Farbe nie allein) |
| **ART-W4** | Kartenrücken-Welten für Kartenspiele außerhalb von ART-T | geplant | gemeinsamer Kartenrücken-Baustein; Einzelspieler (`solitaire`, `mahjong-solitaire`) brauchen eine persönliche Auswahl ohne Raum (Registry-Erweiterung) |
| **ART-W5 …** | weitere Monopoly-Editionen und Einzelwelten nach Bedarf | Idee | – |

Die Asset-Pipeline aus ART-046 Paket F (`MONOPOLY_THEME_ASSETS.md`) und Schriften als selbst gehostete OFL-Dateien (wie bei den Kartenwelten) werden **innerhalb** dieser Pakete genutzt, wenn eine Welt Rastergrafiken oder Webfonts braucht.

## 10. Technische Risiken (Stand 3.13.0)

| Risiko | Auswirkung | Umgang |
|---|---|---|
| Registry gilt nur für Mehrspieler-Tische (`GAMES`, Raumfeld `cardWorld`) | Welten für Einzelspieler (Abschnitt 3.5 des Konzepts) nicht möglich | eigene Erweiterung mit persönlicher Auswahl, gesondert freigeben |
| Jede Spieloberfläche braucht Anzeige-Attribute (wie `data-group`, `data-level`, `data-token` bei Monopoly) | Aufwand je Spiel, Gefahr unbeabsichtigter Änderungen | nur Attribute, keine Logik; Regressionstests je Spiel |
| Feldnamen-Auflösung ist Monopoly-spezifisch (`room.js`, `themes.js`) | Darstellungstexte anderer Spiele brauchen eigene Anbindung | pro Spiel klein halten, Texte nur über `texts` der Registry |
| Asset-Fallback prüft nur Vorschau-/Vorladedateien | fehlende, nur per CSS geladene Dateien fallen nicht auf Standard zurück | wichtige Dateien in `assets.preload` aufnehmen |
| Webfonts pro Welt (Konzept: IM Fell English, Limelight, Playfair Display, Rye, Pirata One) | Ladezeit, Lizenzdateien | selbst hosten, nur bei aktiver Welt laden, Lizenztext neben die Datei |
| Firefox: „Platz behalten“ während das Spielmodul lädt, holt zurück an den Tisch (`core.js`, vorbestehend) | Welt erscheint wieder | eigener Fehlerauftrag für `core.js` |
| WebKit: Test-Hilfe `openTable` startet gelegentlich zu früh; `page.route` fängt Bildanfragen nicht ab | sporadische Fehlschläge nur in Tests | Hilfe härten (gesondert), Fallback-Test in WebKit übersprungen |
| Mehrere Effekt-Ebenen gleichzeitig nicht gemessen | Bildrate auf schwachen Geräten | Bildratenmessung je Welt (Grafik-Roadmap) |
