# Testmatrix für AUTH-01, NAV-01 und ROADMAP-01/02

**Finalisierte Sollmatrix am 20.11.2026.** Basis ist PokerAbend 3.17.0 bei `c3d3cd6`. Ausgeführte CI- und Browser-Gegenproben sind getrennt in [QA-CI-01](QA-CI-01.md) belegt.

Die folgenden Fälle sind Sollabnahmen für die spätere Implementierung. Testdaten sind synthetisch, Providerwechsel werden über die vorhandenen Discord-Fakes geprüft. Die Analyse liest den Code und führt vorhandene lesende Planungstests aus.

| ID | Ausgangslage / Ebene | Erwartetes Ergebnis |
| --- | --- | --- |
| A01 | Gast mit Gruppenpasswort, frisches Gastkonto; zusätzlich Open-Modus | Erstellen, Beitreten, Spielen, Solo, Einstellungen und Konto-Sync nutzbar. Geschützte Ansichten und Daten bleiben gesperrt. |
| A02 | Gast mit alter Discord-Verknüpfung, keine aktive Sitzung | `linked` bleibt verfügbar, Modulstatus inaktiv, Zugriff auf geschützte APIs abgelehnt, Start als ungewertet. |
| A03 | Passende aktive OAuth-Sitzung ohne Guild, zusätzlich Guild mit optionaler Rollenrichtlinie | Bei gültigem Seitenzugang dürfen beide geschützte Module nutzen, sofern eine ausdrücklich aktivierte Mitgliedsrichtlinie erfüllt ist. Der Identity-only-Login schafft im Passwortbetrieb keinen zusätzlichen Seitenzugang. Alte Guild-Seitenanmeldung und Objektregeln funktionieren weiter. |
| A04 | Ausgelaufene oder zu lange inaktive Sitzung; Cookie vorhanden | Folgende Requests und Downloads abgelehnt. Client verwirft bereits geladene geschützte Daten und offene Fetch-Antworten. Gastzugang mit bestehendem Gruppenpasswort bleibt nutzbar. |
| A05 | Discord-Logout oder Logout aller Geräte | Nur betroffene aktive Autorisierungen erlöschen. Verknüpfung bleibt. Gruppenzugang, Account und Einstellungen bleiben mit gültigen Gastnachweisen erhalten. |
| A06 | Discord-Entknüpfung, Rollenentzug, bestätigter Provider-Widerruf | Kein Modulzugang und keine neue Ranked-Teilnahme. Serverdaten bleiben erhalten. Laufende Partie bleibt spielbar. |
| A07 | Exklusivschalter zuerst aus, dann an. Fehlende Pflicht-OAuth-Daten, ausdrücklich konfigurierte Guild-Richtlinie ungültig oder Discord aus | Standard aus erhält das vorhandene Modulverhalten. Nach Aktivierung fehlt ohne gültige Pflichtkonfiguration jede Modulerlaubnis. Klarer Konfigurationsfehler, kein Gast-Fallback. Fehlende optionale Guild ist kein Fehler. Gastspielbetrieb und Admin bleiben erreichbar. |
| A08 | Administrator ohne Discord; Discord-Benutzer ohne Adminrolle | Bestehende Admin-Anmeldung, Ticketmoderation, Runden, Ranked und Audit nutzbar. Discord-Benutzer erhalten keine Adminrechte. Gruppenpasswort und Ticket-Admin-Kontext verhelfen dem normalen Besucherrouter nicht zu Discord-Zugriff. |
| A09 | Direktaufruf aller Methoden und Exportpfade aus der Inventartabelle; HEAD und Weiterleitung | Konsistente Guards auch ohne Navigation. Keine Nutzdaten oder Anhänge vor Authentifizierung. Sessionzustand, CSRF, Rollen- und Objektrechte bleiben unabhängig prüfbar. |
| A10 | Privater Planlink vor und nach Login; ungültige ID, fehlende Objektrechte | Vor Login keine privaten Inhalte. Nach Login sichere Rückkehr auf dieselbe Route. Objektrecht bleibt maßgebend. Bestehender Programm-/Tischablauf kann weiterlaufen. |
| A11 | Gastprofil, fremde Leistungswerte, Erfolge, eigene private Daten, Exporte, Legacy und Abend-Rückblick | Allgemeine Profile/Erfolge bleiben erreichbar. Fremde Wettbewerbsstatistiken werden serverseitig redigiert, einschließlich ableitbarer Werte. Eigener Export, Einstellungen und Löschung bleiben mit gültigem Kontonachweis möglich. Abend-Rückblick, Legacy-Statistik und Modulexporte sind geschützt. |
| A12 | Ranked, zwei verschiedene Discord-Sitzungen, identische Anzeige-Namen | Gültige technisch verschiedene Konten werten einmal. Auswahl und Variante bleiben im Ergebnis korrekt. |
| A13 | Ranked mit Gästen, bloß verknüpften Konten, Bots, doppeltem Konto oder Zuschauer | Teilnehmer ohne aktive Sitzung oder Bots verhindern Ranked. Gewertete Partien benötigen mindestens zwei verschiedene Konten und genau einen Sitz je Konto. Ein Zuschauer allein ändert die Teilnahmeliste nicht. Matchabschluss bleibt möglich. |
| A14 | Login nach Start, Verlust/Ablauf/Widerruf während der Runde, Wiederanmeldung vor Abschluss | Keine Aufwertung einer ungewertet gestarteten oder nach Sitzungsverlust herabgestuften Runde. Partie, Reconnect und nicht gewertete Ergebnisablage laufen weiter. Eine lückenlos gültige, passende Sitzung bleibt bei bloßem Netzwerkabbruch verwendbar. |
| A15 | Restore einer laufenden Partie, Teilnehmerwechsel, Snapshot und Ergebnisevent wiederholt | Keine doppelte Wertung. Bei unbelegbarer Altberechtigung ungewertet. Live-Programm, Score und Spiellogik funktionieren unverändert. |
| A16 | Bestandstest mit früheren Tickets, Einladungen, Exporten, Runden und Statistiken | Stabile IDs, Verknüpfungen, Zeitstempel, Revisionen und Archive. Klassifikation bereits gespeicherter Ergebnisse bleibt erhalten. Kontrollierte Rechteprüfung bei Abruf. |
| A17 | Provider vorübergehend nicht erreichbar, bestehende Sitzung und neuer Login | Loginfehler und bestehende Sitzungen getrennt behandeln. Neuer Login stellt ohne Nachweis keine Berechtigung aus. Für bestehende Sitzungen den freigegebenen Recheck-Vertrag einschließlich Gültigkeitsgrenzen und bestätigtem Entzug prüfen. Kein Gast-Fallback. |
| N01 | Jede vorhandene Kategorie ausblenden, Desktop und Smartphone | Seitenleiste, Mobil-Tabs, Mehr-Menü, Bibliothek, Startseite und relevante Karten konsistent. Kein leerer Block und keine falsche Anzahl. |
| N02 | Ausgeblendetes Solo bzw. Multiplayer; direkter Link, Reconnect | Spiel und Tisch per vorhandener URL erreichbar. Zustandswechsel und Browser-Historie bleiben korrekt. Favoriten- und Zuletzt-gespielt-Daten bleiben gespeichert. |
| N03 | Exklusivmodus an, Gast, Desktop-/Mobilnavigation und direkter Hash/URL | Geschützte Reiter und Startseiteneinstiege werden ausgeblendet. Direktlink zeigt Anmeldeoption mit bestätigtem Rücksprungziel. Bei Konfigurationsfehler steht der Grund anstelle unbrauchbarer Anmeldung. Direkte REST-/Exportaufrufe bleiben gesperrt. |
| N04 | Bestehende Einstellungen, zweite Browserinstanz, Offline-Änderung, Teilpatch, Reset | Gültige alte Werte bleiben bestehen. Synchronisierung, Konfliktauflösung und Konto-Trennung werden mit dem vorhandenen Datenpfad geprüft. |
| N05 | Idle fehlt bzw. ist in einer Test-Registry tatsächlich verfügbar | Ohne Registrierung kein Filter und keine leere Karte. Mit registriertem Spiel gilt derselbe Sichtbarkeitspfad. Keine Änderungen an bestehenden 107 IDs und Varianten. |
| N06 | Keyboard, Fokus nach Filteränderung, Mobile-Menü, DE/EN, leere Vorschau | Fokus bleibt bedienbar, Zustände und Gründe sind zugänglich, kein toter Einstieg und keine blinde Abfrage. |
| R01 | Quellinventar und Mapping | Alle bestehenden IDs und Status-/Belegfelder erhalten, Aliaszuordnung und Generatoren geprüft. Historische Pakete bleiben historisch. |
| R02 | Besucherprojektion, öffentliche URL, DE/EN, unbekannter Produktivstand, nur GHCR oder Rollback | Nur freigegebene Besucherfelder. „Neu veröffentlicht“ ausschließlich nach Bestätigung des Produktivdeployments mit passendem Commit. Bei unklarem Stand alte Status beibehalten. Aliasse, Filter und Zugang zur Änderungshistorie bleiben konsistent. Ein interner Abschluss ohne Produktivbeleg löst auch über „Was ist neu“ keinen Veröffentlichungsstatus aus. |
| R03 | Planungstest, CI und Spielregression | Katalog, Varianten, Generator-Konsistenz, Links und Nachweise behalten ihren Stand. Neue Regression zu zuvor fehlschlagenden Nachtjobs separat bewerten. |

CI-Abnahme für das Stabilisierungspaket ist in [QA-CI-01](QA-CI-01.md) beschrieben. Bestands-Fakes und Tests. [Discord inprocess](../../test/discord-inprocess.test.js) · [Ranked](../../test/ranked.test.js) · [Tickets](../../test/ticket-api.test.js) · [Planung](../../test/plan-api.test.js) · [Profile](../../test/profile.test.js) · [Rückblicke](../../test/evening-reviews.test.js) · [UI-Einstellungen](../../test/ui/settings.spec.js)

## Nachtrag 20.11.2026: NAV-01-Stand (Version 3.18.0)

Die Matrix oben bleibt die Sollmatrix bei `c3d3cd6`. Stand der NAV-Fälle nach der Umsetzung (Commit `0f14e19`, Volllauf #230 grün):

| ID | Stand |
| --- | --- |
| N01 | erfüllt, einschließlich „alle Kategorien ausgeblendet“ (Desktop, Mobil, Deutsch, Englisch). |
| N02 | teilweise: Direktlinks, Zurück und Favoriten (Markieren, Ansicht, Kategorie, Neuladen) geprüft. Offen: Entfernen per Stern, Reconnect, zweite Browserinstanz. |
| N03 | **offen**, abhängig von AUTH-01. |
| N04 | erfüllt für Neuladen, zweite Instanz und Zurücksetzen; Offline und Konfliktauflösung stützen sich auf bestehende Tests. |
| N05 | erfüllt (ohne Registrierung, mit Registrierung, ausgeblendet). Offen: Idle unter Mehrspieler-Spielen. |
| N06 | teilweise: Schalter per Tastatur, Fokus, Englisch, Mobil-Menü (HTML und Öffnen). Offen: Tab-Navigation im geöffneten Mobil-Menü, Überlaufen im Englischen mit allen Schaltern. |

Alle A-, R- und PUB-Fälle bleiben unverändert offen.

## Lokaler Nachweis für AUTH-01 3.20.0

Die HTTP-Fälle verwenden temporäre Datenverzeichnisse, synthetische Konten und den Discord-Nachbau. Die Browserfälle verwenden Desktop und Mobil mit einem kontrollierten Statuswechsel. Die Windows-Prüfung ersetzt den CI-Volllauf nicht.

| ID | Datei | Positive und negative Beobachtung |
| --- | --- | --- |
| A01 | [Discord](../../test/discord.test.js), [Identität](../../test/identity.test.js), [Navigation](../../test/ui/nav-visibility.spec.js) | Regulärer Passwort-/Open-Zugang, Gastkonto, Gerätesync, Einstellungen und Gast-Sockets bleiben möglich. Gastrequests für exklusive Module werden abgelehnt. |
| A02 | [Discord](../../test/discord.test.js), [Ranked](../../test/ranked.test.js) | Verknüpfung vorhanden und Status inaktiv. Ohne Sitzung keine Wertung. Erst später alle Sitzungen einzurichten ändert die Runde nicht. |
| A03 | [Discord](../../test/discord.test.js) | OAuth ohne Guild mit regulärem Zugang erfolgreich. Cookie allein gibt dabei keinen Seitenzugang. Synthetisches Mitglied mit Rolle erhält Zugriff, Mitglied ohne Rolle wird abgelehnt. |
| A04 | [Discord](../../test/discord.test.js), [Browser](../../test/ui/auth-01.spec.js) | Testkonten erhalten vor Ablauf Zugriff. Nach absolutem Ablauf oder Inaktivität bleibt der Gruppenzugang nutzbar, Daten und Anhänge sind gesperrt. Die UI verwirft eine verspätete Antwort nach gesperrtem Status. |
| A05 | [Discord](../../test/discord.test.js) | Einzelabmeldung betrifft nur die jeweilige Sitzung. Geräteübergreifende Abmeldung entzieht den zweiten Zugriff und erhält Verknüpfung, Passwortzugang und eigenen Export. |
| A06 | [Discord](../../test/discord.test.js), [Ranked](../../test/ranked.test.js) | Erforderliche Rolle und Verknüpfung erlauben anfänglich den Zugriff. Rollenentzug und Entknüpfung sperren ihn. Die Spielrunde wird trotz Sitzungsverlust abgeschlossen. |
| A07 | [Discord](../../test/discord.test.js), [Funktionen](../../test/features.test.js) | Modusschalter aus erhält Gastzugriffe. Modus an ohne Pflichtwerte oder mit Rollen-ID ohne Guild liefert 503. Profile und Seitenzugang bleiben verfügbar. |
| A08 | [Discord](../../test/discord.test.js), [Tickets](../../test/ticket-api.test.js) | Admin ohne Discord erreicht Moderation, Runden und Export. Discord allein erhält keine Adminfunktion. Admin-Cookie gewährt keinen Besucherzugriff auf ein gesperrtes Modul. |
| A09 | [Discord](../../test/discord.test.js), [Tickets](../../test/ticket-api.test.js), [Planung](../../test/plan-api.test.js) | Je Modul GET/HEAD sowie ausgewählte Mutationen geprüft. Gast bekommt 403 ohne Anhang, das passende Konto geht zur Objektprüfung weiter. Bestehende CSRF- und Rollenprüfungen bleiben geprüft. |
| A10 | [Discord](../../test/discord.test.js), [Planung](../../test/plan-api.test.js), [Browser](../../test/ui/auth-01.spec.js) | Gast erhält keinen privaten Plan. Berechtigte Anfrage erreicht den echten Plan. Rückkehr-Hash geprüft, ungültige ID und fremde Verwaltungsversuche scheitern. |
| A11 | [Discord](../../test/discord.test.js), [Profil](../../test/profile.test.js) | Fremde Leistungswerte und Namensaggregation redigiert. Eigenes Profil, Einstellungen und Export mit Kontobeleg erfolgreich. Legacy und Rückblicke sind für Gast gesperrt. |
| A12 | [Ranked](../../test/ranked.test.js), [Discord/Socket](../../test/discord.test.js) | Mit zwei passenden Sitzungen und gleichen Anzeigenamen im Testmodell wird genau einmal verbucht. Eine echte Vier-Gewinnt-Partie mit zwei Sitzungen wird gewertet. |
| A13 | [Ranked](../../test/ranked.test.js), [Discord/Socket](../../test/discord.test.js) | Gast, Bot, nur verknüpftes Konto und doppelte Sitzbelegung führen zu keiner Wertung. Ein Zuschauer verhindert die Wertung der zwei echten Teilnehmer nicht. |
| A14 | [Ranked](../../test/ranked.test.js), [Discord/Socket](../../test/discord.test.js) | Dieselbe Sitzung erhält beim Reconnect die Wertung. Logout und Wiederanmeldung während des Spiels erlauben den Abschluss als ungewertete Runde. |
| A15 | [Ranked](../../test/ranked.test.js) | Stabile Ergebnis-ID und Restore ohne belegte Sitzung. Fremde Teilnehmer werden erkannt. Wiederholtes Ergebnis erzeugt keinen zweiten Eintrag. |
| A16 | [Ranked](../../test/ranked.test.js), [Planung](../../test/plan-api.test.js), [Tickets](../../test/ticket-api.test.js) | Alte Namensstatistik, historische Ranked-Runden, gespeicherte Pläne, Ticketbestände und Revisionen überstehen erneutes Laden. Prüfungen arbeiten mit Kopien synthetischer Altdaten. |
| A17 | [Discord](../../test/discord.test.js) | Bei Providerausfall bleibt die vorher nachgewiesene Sitzung gültig. Eine neue Anmeldung erzeugt keine Sitzung. Nach Rückkehr des Providers sperrt der bestätigte Rollenentzug. |
| N03 | [Browser](../../test/ui/auth-01.spec.js), [NAV-Nachbartests](../../test/ui/nav-visibility.spec.js) | Seitennavigation, Mobil-Tabs, Mehr-Menü, Startseite, Direktlink, Fokus, Sprache und Berechtigungsverlust geprüft. Ohne Berechtigung werden keine geschützten Ansichtsabfragen ausgelöst. |

Die kombinierte Matrix nutzt getrennte Server- und Browsernachweise. Die Tests führen weder eine Anmeldung am späteren produktiven Discord-Client noch eine Betriebsaktivierung aus.

## Vollständige CI-Abnahme für 3.20.2

Der erste Workflowversuch #241 lief auf `28a9e3f0015b78550109c84a2f1b6a36654f9c64`. Vier Node-Shards meldeten 2.311 bestandene und drei ausgelassene Fälle. In den Browser-Shards bestanden 1.476 Fälle im ersten Versuch und drei nach Retry. 277 Fälle waren gemäß bestehenden Testbedingungen ausgelassen. Es gab keinen endgültigen Testfehler. [Workflow](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305) · [Node-Shard mit AUTH](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801542) · [Zusammenfassung](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136940326890)

| Shard | Bestanden im ersten Versuch | Bestanden nach Retry | Ausgelassen |
| --- | ---: | ---: | ---: |
| [Browser 1](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801670) | 127 | 0 | 2 |
| [Browser 2](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801452) | 127 | 0 | 3 |
| [Browser 3](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801512) | 129 | 0 | 0 |
| [Browser 4](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801550) | 131 | 0 | 0 |
| [Browser 5](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801411) | 127 | 0 | 108 |
| [Browser 6](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801684) | 128 | 0 | 0 |
| [Browser 7](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801559) | 114 | 1 | 14 |
| [Browser 8](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801628) | 113 | 2 | 11 |
| [Browser 9](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801626) | 112 | 0 | 17 |
| [Browser 10](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801545) | 125 | 0 | 6 |
| [Browser 11](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801582) | 120 | 0 | 115 |
| [Browser 12](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801554) | 123 | 0 | 1 |

Der mobile Würfeljagd-Test in Shard 7, der mobile UNO-Flip-Kartenwelttest und der mobile Doppelkopf-Erlebnistest in Shard 8 bestanden jeweils beim einzigen Retry. Die AUTH- und N03-Browserfälle bestanden auf Desktop und Mobil im ersten Versuch. Der Ranked-Erfolgstest spielte in beiden Projekten mit zwei Sitzungen des synthetischen OAuth-Providers. [AUTH Desktop](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801670) · [AUTH Mobil](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801559) · [Ranked-Erfolg Desktop](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801684) · [Ranked-Erfolg Mobil](https://github.com/TTLPSCWA/PokerAbend/actions/runs/44932771305/job/136932801554)
