# Deutsch und Englisch

Stand: 30.10.2026. Die persönliche Sprachwahl ist implementiert; **Englisch ist eine Beta und noch keine vollständige Übersetzung des Projekts**.

## Bedienung

- Auf der Anmeldung und oben im Hub zwischen **Deutsch** und **English (Beta)** wählen.
- Am Tisch befindet sich dieselbe Auswahl unter **Ich → Sprache**; sie gilt auch für Poker und Omaha.
- Deutsch bleibt der Standard. Die Wahl liegt unter `poker:language` in diesem Browser und bleibt nach Neuladen/Reconnect erhalten. Andere Spieler am selben Tisch wählen unabhängig. Geöffnete Tabs desselben Browsers übernehmen die Änderung.
- Umschalten lädt die Seite nicht neu und startet keine Runde. Eingabeentwürfe mit stabiler Feld-ID und der lokale Fortschritt der Solo-Spiele bleiben erhalten. Die gemeinsame Host-Pause funktioniert weiterhin in beiden Sprachen.
- Falls der Browser lokalen Speicher sperrt, funktioniert die Wahl für die aktuelle Seite weiter.

## Tatsächlich umgesetzt

- Ein gemeinsamer Übersetzungsbaustein ohne Build-Schritt oder externen Übersetzungsdienst: `public/i18n.js` und `public/i18n-en.js`.
- Über 800 hinterlegte Oberflächentexte: Anmeldung, Hauptnavigation, Bibliothek, Kategorien, Suche, Favoriten, Tischanlage, gemeinsame Spielebedienung, persönliche Einstellungen und Host-Optionen.
- Englische Namen/Beschreibungen für alle 46 registrierten Spiele. Die Bibliothek und der Dialog zur Spielauswahl finden sowohl deutsche als auch englische Namen/Beschreibungen. Technische Spiel- und Varianten-IDs bleiben erhalten.
- Die vorhandenen Render-Vorlagen aller Spiele sind an den gemeinsamen Baustein angeschlossen. Übersetzt werden ausdrücklich markierte Oberflächentexte und bekannte Metadaten. Die DOM-Aktualisierung bearbeitet nur solche Markierungen, keine beliebigen Texte und keine Spielereingaben.
- Alle **423** eingebauten Aufgaben von **Schätzmeister (129)**, **Schlagfertig (182)** und **Wer hat das gesagt? (112)** erhalten englische Entsprechungen. Beide Sprachgruppen bekommen dieselbe Aufgabe. Auswahl, Antworten, Quellen und Wertung bleiben gleich.
- Auch die englischen Aufgaben folgen der bisherigen Sichtbarkeit: persönliche Aufgaben nur für die jeweiligen Autoren; bei Schätzmeister keine vorzeitige Veröffentlichung der richtigen Zahl. Eigene Fragen erhalten keine automatische Übersetzung.
- Schätzmeister akzeptiert im englischen Modus z. B. `1,234.5` und `1.234` als 1234,5 bzw. 1,234. Die Eingabe wird vor dem Versand als Zahl normalisiert. Der bestehende deutsche Parser und deutsche Eingaben bleiben erhalten.
- Eigene Schätzfragen im Host-Menü behalten das bisherige Listenformat einschließlich deutscher Zahlenschreibweise (`Frage | 1.234,5 | Einheit`). Die englische Hilfe weist ausdrücklich darauf hin; eigene Listen werden nicht automatisch umgeschrieben.
- Spielernamen, Chat-/Antworttexte, selbst erstellte Aufgaben, Raumcodes, Tokens, Cookies, Spielstände und Zufallsverfahren werden nicht übersetzt oder migriert.

## Weiterhin offen

Der bestehende Roadmap-Punkt `englisch` ist **nicht insgesamt erledigt**. Er zeigt die fertige Sprachwahl und die 423 Aufgaben als eigene abgeschlossene Unterpunkte. Der bisherige Unterpunkt `englische-seite` bleibt offen:

- Fehlende längere Regeln, Einführungen, spielbezogene Beschriftungen und Variantenbeschreibungen weiterer Spiele.
- Weitere Begriffskataloge, insbesondere Wer bin ich?, Tickendes Paket, Zeichenspiele und Begriffe in Solo-Spielen. Hier braucht es neben Textübersetzungen passende englische Antwort-Aliasse bzw. überprüfte Sprachregeln.
- Noch nicht übersetzte dynamische Server-/Verlaufsmeldungen und Texte älterer Hub-Bereiche wie Tickets, Abendplanung, Rückblicke, Erfolge und übrige Roadmap-Beschreibungen.

Für fehlende Einträge erscheint der ursprüngliche deutsche Text. Die Sprachwahl ersetzt keine funktionierende Spiellogik und täuscht keine vollständige englische Abdeckung vor.

## Prüfungen und Nachweise

- `npm test`: **822 bestanden, 0 fehlgeschlagen** (lokal Node 24.22.0, abschließend 98,4 Sekunden).
- `node node_modules/@playwright/test/cli.js test --workers=2 --output=artifacts/i18n-ui-results`: **303 bestanden, 1 planmäßig übersprungen, 0 fehlgeschlagen** (14,2 Minuten). Das ist die vollständige bisherige Suite einschließlich der 28 neuen Sprachprüfungen.
- Gezielte Nachprüfung auf dem letzten Stand: **alle 28 Sprachprüfungen bestanden**. Im ergänzten Suchtest wurden zunächst auch Buttons aus dem geschlossenen Auswahldialog gefunden; nach Begrenzung des Selektors auf die Bibliothek bestanden beide Wiederholungen (26 + 2). Protokolle: `artifacts/i18n-language-complete.log` und `artifacts/i18n-search-final.log`.
- `git diff --check` und Syntaxprüfung der neuen Laufzeit/zentralen Dateien: bestanden.
- Neue Unit-Tests für Standard/Fallback, Speicherung und gesperrten Speicher, Tabsynchronisierung, sichere Interpolation, beide Umschaltrichtungen, alle 46 Katalogeinträge, alle 423 Aufgaben, Geheimhaltung und Zahlenformate.
- Neue Playwright-Prüfungen auf Desktop/Handy: Anmeldung, englische Suche, gespeicherte Sprachwahl, zwei Sprachen am selben Tisch, Pause/Reconnect, Eingabeentwurf, englische Zahleneingabe und erhaltener Rezeptfortschritt.
- Englischer Start- und Einstellungsdurchlauf durch alle 46 Spiele auf Desktop und Handy; außerdem die vollständige bestehende Browser-Suite.
- Reproduzierbare Screenshots: `artifacts/language/english-home-desktop.png`, `english-home-mobil.png`, `english-party-desktop.png`, `english-party-mobil.png`. Testartefakte werden wie bisher nicht versioniert.
- Ein erster Node-Lauf zeigte fehlende I18n-Laufzeit in zwei isolierten UI-Testumgebungen. Die Tests laden jetzt den echten gemeinsamen Baustein; anschließend bestanden sie.
- Ein überlappender Browserlauf kollidierte mit dem gemeinsamen Trace-Verzeichnis. Der Abschlusslauf verwendet ein eigenes Ausgabeverzeichnis und läuft ohne einen zweiten Playwright-Prozess. Erwartete HTTP-401-Antworten im Passwort-Negativtest werden explizit geprüft; die normale Browserfehlerprüfung bleibt unverändert.
- Die isolierten englischen Tischtests warten vor dem Beenden ihres Testservers auf ausstehende Hub-Ressourcen. Dadurch verursacht der nachgeladene Hintergrund keinen künstlichen Verbindungsfehler beim Testabbau.

Keine `.env`-/Produktivdatenänderung und kein manuelles Produktivdeployment.
