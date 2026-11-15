# Prüfliste für jede neue Themenwelt

Stand: 15. November 2026. Gilt für jede neue Themenwelt (ART-W) und sinngemäß für neue Kartenwelten, Skins und Monopoly-Themes. Grundsätze: [THEME_ARCHITECTURE.md](THEME_ARCHITECTURE.md). Eine Welt gilt erst als fertig, wenn **jeder** Punkt erfüllt oder mit Begründung als „entfällt“ markiert ist. Die ausgefüllte Liste kommt mit Commit-Hash nach `docs/design/art/<ID>/README.md`. Nicht erfüllte Punkte heißen: Welt bleibt `released: false`.

## A. Rechte und Nachweise (vor jedem Commit von Dateien)

- [ ] Jede Datei (Bild, Schrift, Ton, Musik, Daten) steht in `ART_LICENSES.md` bzw. `SOUND_LICENSES.md` mit **Pfad, Titel, Urheber, Quelle (URL, möglichst gepinnt), Lizenz mit Link, Prüfdatum, Bearbeitung**.
- [ ] Lizenzart eindeutig: CC0/gemeinfrei · CC BY (Namensnennung in der App erreichbar, Titel, Urheber, Lizenzlink, Änderungen genannt) · SIL OFL 1.1 (Lizenztext und Copyright neben der Schrift, nicht einzeln verkauft, Reserved Font Names bei Änderungen beachtet) · MIT/ISC (Lizenztext beigelegt) · eigene Arbeit (Skript oder Entwurf genannt).
- [ ] Lizenz am **offiziellen** Text geprüft (Lizenzdatei im Paket oder Seite des Urhebers), nicht nur an einer Sammelseite. Nicht prüfbar → **ungeprüft** eintragen, Datei nicht ausliefern.
- [ ] Keine Lizenz mit Weitergabeverbot oder Ausnahme ohne dokumentierte Freigabe des Projektinhabers (das Repository ist öffentlich).
- [ ] Keine Marken, Logos, Figuren, Kartentexte, Namen oder wörtlichen Übersetzungen geschützter Werke; Vorbilder nicht als Marke benennen; KI-Bilder mit Generator, Datum, Prompt-Ablage und Nutzungsbedingungen.
- [ ] Nur tatsächlich benutzte Dateien im Repository; Originalpakete und Rohdaten außerhalb.

## B. Optik und Assets

- [ ] Alle Assets laden (keine 404, keine Konsolenfehler), Manifest gültig (`verify`-Skript), Prüfsummen stimmen.
- [ ] Standard-Fallback: fehlende Datei, kaputtes Manifest oder nicht geladene Schrift → lesbarer Rückfall, kein leerer Bereich.
- [ ] Werte, Farben, Symbole und Zustände (spielbar, gesperrt, ausgewählt, Besitzer) bleiben klar unterscheidbar; nie nur über Farbe.
- [ ] Kontrast WCAG AA (4,5:1 Text, 3:1 große Schrift und Bedienelemente) auf allen Welt-Hintergründen.
- [ ] Welt-Selektoren nur unter der Welt-ID; Startseite und andere Spiele unverändert (Vergleichs-Screenshot).

## C. Verhalten in allen Spielzuständen

- [ ] Lobby, Start, eigener Zug, fremder Zug, Pause, Zeitablauf, Dialoge, Rundenende, Ergebnis/Siegerbühne, Zuschauer, Bot am Zug.
- [ ] Jede kompatible Variante getestet; ausgeschlossene Varianten zeigen Standard und einen Hinweis im Host-Menü.
- [ ] Keine verdeckten Informationen über Grafik, Dateiname, Ton oder Animation.
- [ ] Englisch: keine deutschen Reste in Weltname, Beschreibung und Beschriftungen.

## D. Host-/Gast-Synchronisierung

- [ ] Nur der Host kann wählen (Server lehnt Gäste ab); Gäste und Zuschauer sehen sofort dieselbe Welt.
- [ ] Beitritt, Neuladen, Wiederverbindung, Serverneustart (Snapshot), „Weiterspielen“ und Rückkehr nach dem Parken zeigen die aktuelle Welt.
- [ ] Weltwechsel während der Runde (falls erlaubt) bzw. Sperre während der Runde (falls nicht) geprüft.
- [ ] Spiel- und Variantenwechsel: Welt bleibt nur, wenn kompatibel, sonst Standard.
- [ ] Ungültige oder nicht freigegebene ID über das Socket-Ereignis → Standard, kein Fehlerzustand.

## E. Lebenszyklus: Effekte und Ton vollständig entfernen

- [ ] Tisch verlassen, Platz behalten (parken), Tisch geschlossen, Startseite, anderer Raum, „ersetzt“ durch anderen Tab, Weltwechsel, Spielwechsel: **keine** Welt-Ebene, kein Welt-Knopf, kein `data-*`-Attribut, kein Ton, kein Zeitgeber bleibt übrig.
- [ ] Verspätet eintreffender Raumstand nach dem Verlassen schaltet nichts wieder ein (Muster: `test/ui/art-t6-winter-lebenszyklus.spec.js`).
- [ ] Musik: Standard aus, startet nur nach Nutzeraktion, pausiert bei verdecktem Tab, stoppt beim Verlassen, Fehler im Stück → nächstes Stück, Schalter pro Gerät gespeichert.
- [ ] `clear()` mehrfach hintereinander ohne Fehler; keine doppelten Ebenen oder Listener nach mehrfachem Betreten.

## F. Geräte und Bedienung

- [ ] Größen 1920×1080, 1440×900, 768×1024, 390×844, 360×800, 900×450: kein waagerechtes Überlaufen, Pflichtinfos sichtbar.
- [ ] Touch: alle Bedienelemente ≥ 44 px, Welt-Ebenen fangen keine Berührungen (`pointer-events: none`), Gesten des Spiels unverändert.
- [ ] Tastatur: Auswahl im Host-Menü und Effekt-Schalter per Tab erreichbar, sichtbarer Fokus, `aria-pressed`/`aria-label` korrekt.
- [ ] Reduzierte Bewegung (`prefers-reduced-motion`, „Ruhig“): keine Bewegungseffekte, Inhalte vollständig.

## G. Ladezeiten und Speicher

- [ ] Gemessen und eingetragen: Bytes für Auswahl-Vorschau (Ziel ≤ 300 KB), Tisch beim Start mobil (≤ 1,5 MB) und Desktop (≤ 2,5 MB), nachgeladene Bytes.
- [ ] Welt-Dateien werden erst geladen, wenn die Welt gilt; Musik erst auf Wunsch; Detailbilder lazy.
- [ ] Langes Caching nur für hashbenannte Dateien; keine globale Cache-Regel geändert.
- [ ] Entpackter Bildspeicher abgeschätzt (Breite × Höhe × 4 je Bild); keine Vollbildtexturen für kleine Flächen.
- [ ] Bildrate mit Welt ≥ 90 % der Bildrate ohne Welt bei 4× gedrosselter CPU.

## H. Regressionsfreiheit

- [ ] `npm run test:fast` grün; bekannte, dokumentierte Windows-CRLF-Fehler (`game-art-roadmap.json` / `game-experience-roadmap.json` ist aktuell) nur nennen, neue Fehler nie als bekannt einstufen.
- [ ] Bestehende Welt-, Skin- und Spieltests der betroffenen Spiele grün; Spiele ohne diese Welt unverändert (Test).
- [ ] Keine Änderung an Spiel-IDs, Spielregeln, Raumdaten, Cookies, URLs oder Datenvolumes.
- [ ] Version, CHANGELOG, README und `docs/betrieb.md` nach den Projektregeln angepasst (nur bei Seitenänderung).

## I. Dokumentation und Screenshots

- [ ] Screenshots Desktop und Handy (mindestens Lobby/Auswahl, Spielzustand, Ergebnis) unter `docs/design/art/<ID>/`, aus dem laufenden Spiel.
- [ ] README des Pakets: was sich ändert, Kompatibilität, Messwerte, Testliste, Grenzen, Commit-Hash.
- [ ] Roadmap-Eintrag (Status, Commit, Nachweise) erst nach echter Umsetzung.
