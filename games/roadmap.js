// Roadmap und Backlog gemeinsam pflegen: Bei jedem fertigen Päckchen/jeder fertigen Funktion
// diese Etappe mit dem Datum des passenden Git-Commits auf 'erledigt', die nächste auf 'jetzt' setzen.
// paeckchen/eintraege verweisen auf planned.js; geplante Inhalte hier nicht noch einmal abschreiben.
// Abschlussdaten geprüft: af1c42d, 1da6720, c75b458, 88f2293, e945d48, 522ebaa,
// 8bd8ec3, 2c82db2, 8197000, 703751d, b588e7d, 3d7366b (git log, Datum YYYY-MM-DD).
import { PLANNED } from './planned.js';
import { GAMES } from './index.js';

const punkt = (id, titel, art, text, erledigt = false) => ({ id, titel, art, text, ...(erledigt ? { erledigt: true } : {}) });
const liste = (prefix, art, rows) => rows.map(([titel, text], i) => punkt(`${prefix}-${i + 1}`, titel, art, text));
const spiele = (ids) => ids.map((id) => punkt(id, GAMES[id].name, 'spiel', GAMES[id].description, true));

export const ROADMAP = [
  { id: 'hub-paket', titel: 'Hub-Paket: Roadmap & Gerade online', satz: 'Planung und Mitspieler bekommen ihren festen Platz im Hub.', stufe: 'erledigt', datum: '2026-10-29', punkte: [
    punkt('roadmap-seite', 'Roadmap im Hub', 'funktion', 'Etappen mit Filtern, Fortschritt und Regeln für geplante Spiele.', true),
    punkt('gerade-online', 'Gerade online', 'funktion', 'Sehen, wer da ist, zuschauen oder mitspielen – mit privater Sichtbarkeit.', true),
    punkt('backlog-ergaenzen', 'Fehlende Spiele nachtragen', 'funktion', 'Der Backlog enthält auch die bisher fehlenden Spiele und Party-Funktionen.', true),
  ] },
  { id: 'ticket-board', titel: 'Ticket-Board – Ideen & Fehler melden', satz: 'Ideen und Fehler direkt im Hub sammeln und gemeinsam bewerten.', stufe: 'naechstes', punkte: liste('tickets', 'funktion', [
    ['Tickets erstellen', 'Ideen und Fehler im Hub erfassen, abstimmen und kommentieren.'],
    ['Status & Verwaltung', 'Neu, geplant, in Arbeit, erledigt oder abgelehnt; ein Admin verwaltet die Tickets.'],
    ['Markdown-Export', 'Tickets zur Weiterarbeit als Markdown exportieren.'],
  ]) },
  { id: 'party-modi', titel: 'Päckchen 7 – Party-Modi', satz: 'Mehrere Partyspiele werden zu einem gemeinsamen Programm.', stufe: 'erledigt', datum: '2026-10-29', paeckchen: '7', punkte: [
    punkt('party-mix', 'Party-Mix', 'funktion', 'Gewählte Partyspiele in zufälliger Reihenfolge, gleicher Raum und laufende Gesamtwertung.', true),
    punkt('party-turnier', 'Party-Turnier', 'funktion', 'Ein Turnier über mehrere Spiele mit Platzierungspunkten und Siegerehrung.', true),
    punkt('eigene-playlist', 'Eigene Playlist', 'funktion', 'Reihenfolge, Rundenzahl und Regeln pro Spiel; Vorlagen im Browser und Fortschritt am Tisch speichern.', true),
    punkt('team-duell', 'Team-Duell', 'funktion', 'Aufteilung in zwei feste Teams mit gemeinsamer Wertung bei geeigneten Partyspielen.', true),
  ] },
  { id: 'zeichnen', titel: 'Päckchen 7b – Zeichnen', satz: 'Eigene Bilder, überraschende Beschriftungen und gemeinsames Raten.', stufe: 'jetzt', paeckchen: '7b', punkte: [] },
  { id: 'design-toene', titel: 'Design & Töne', satz: 'Jedes Spiel bekommt mehr Atmosphäre und passt besser auf jeden Bildschirm.', stufe: 'spaeter', punkte: liste('design', 'design', [
    ['Themen pro Spiel', 'Bilder, kurze Animationen und passende Töne für die verschiedenen Spiele.'],
    ['Anpassbare Spielfelder', 'Das Spielfeld passt sich der Bildschirmgröße an; im Querformat gibt es eine eigene Anordnung.'],
    ['Kartengröße unter „Ich“', 'Normal, groß oder sehr groß pro Spieler einstellen.'],
  ]) },
  { id: 'spieleabend', titel: 'Spieleabend als Ganzes', satz: 'Aus einzelnen Partien wird ein geplanter Abend mit gemeinsamer Erinnerung.', stufe: 'spaeter', punkte: liste('abend', 'funktion', [
    ['Abend-Modus', 'Alle Spiele tragen Platzierungspunkte zur gemeinsamen Abendwertung bei.'],
    ['Abend-Rückblick', 'Ergebnisse und besondere Momente eines Abends zusammen ansehen.'],
    ['Termin & Spiele-Abstimmung', 'Einen Termin planen, Zusagen sammeln und über die Spiele abstimmen.'],
    ['Erfolge & Abzeichen', 'Persönliche Meilensteine über mehrere Abende sammeln.'],
  ]) },
  { id: 'benachrichtigungen', titel: 'Benachrichtigungen', satz: 'Eine Nachricht, wenn du dran bist oder der Tisch auf dich wartet.', stufe: 'spaeter', punkte: [punkt('push', 'Push-Mitteilungen', 'funktion', '„Du bist dran“ und „Tisch wartet“ auch außerhalb des aktiven Tabs.') ] },
  { id: 'betrieb', titel: 'Betrieb & Wartung', satz: 'Updates, Fehler und gespeicherte Abende werden verlässlicher betreut.', stufe: 'spaeter', punkte: liste('betrieb', 'betrieb', [
    ['Update-Hinweis', 'Vor einem geplanten Neustart rechtzeitig am Tisch Bescheid sagen.'],
    ['Admin-Seite', 'Zustand und Verwaltung der laufenden Instanz an einem Ort.'],
    ['Version & „Was ist neu“', 'Die aktuelle Version und ihre Änderungen im Hub zeigen.'],
    ['Browser-Fehler', 'Fehler aus dem Browser nachvollziehbar erfassen.'],
    ['Ausfall-Wächter', 'Den vorhandenen /health-Endpunkt von außen überwachen.'],
    ['Backups & Restore-Test', 'Backups außer Haus speichern und ihre Wiederherstellung regelmäßig prüfen.'],
    ['Speichern mitten in der Runde', 'Laufende Spielstände nach einem Neustart fortsetzen.'],
  ]) },
  { id: 'technik', titel: 'Technik aufräumen', satz: 'Eine klare Grundlage für weitere Spiele und verlässliche Spielerdaten.', stufe: 'spaeter', punkte: liste('technik', 'betrieb', [
    ['Tests aufteilen', 'Die gewachsene Testsammlung in überschaubare Bereiche gliedern.'],
    ['SQLite', 'Persistente Daten strukturiert in einer Datenbank halten.'],
    ['Feste Spieler-ID', 'In der Bestenliste eine feste Identität statt nur des Namens verwenden.'],
    ['Paket-Metadaten', 'package.json-Beschreibung und Versionsnummern aktuell halten.'],
  ]) },
  { id: 'englisch', titel: 'Englisch', satz: 'Sprache pro Spieler wechseln, einschließlich der Party-Inhalte.', stufe: 'spaeter', punkte: [punkt('englische-seite', 'Englische Oberfläche & Inhalte', 'funktion', 'Die ganze Seite übersetzen und englische Party-Inhalte anbieten.')] },
  { id: 'echtzeit', titel: 'Päckchen 8 – Echtzeit', satz: 'Alle bewegen sich gleichzeitig im gemeinsamen Spielfeld.', stufe: 'spaeter', paeckchen: '8', punkte: [] },
  { id: 'discord-login', titel: 'Discord-Login', satz: 'Optional mit dem eigenen Discord-Konto wiederkommen.', stufe: 'spaeter', punkte: liste('discord', 'discord', [
    ['Optionaler Discord-Login', 'Name und Bild aus Discord übernehmen und das Konto wiedererkennen.'],
    ['Tisch-Nachricht', 'Im Discord Bescheid geben, wenn jemand einen Tisch aufmacht.'],
  ]) },
  { id: 'poker-extras', titel: 'Poker-Extras', satz: 'Vorhandener Komfort und weitere Varianten für den Pokertisch.', stufe: 'spaeter', punkte: [
    punkt('turnier-blinds', 'Turniermodus mit steigenden Blinds', 'funktion', 'Blind-Level nach Zeit oder Händen mit konfigurierbarer Steigerung sind vorhanden.', true),
    punkt('time-bank', 'Time Bank', 'funktion', 'Zusätzliche, begrenzte Bedenkzeit pro Spieler.'),
    punkt('pre-actions', 'Pre-Actions', 'funktion', 'Check, Check/Fold und Call als Vorab-Aktionen sind vorhanden.', true),
    ...liste('poker-extra', 'funktion', [['Straddle', 'Optionaler zusätzlicher Blindeinsatz vor dem Geben.'], ['Bomb Pot', 'Gemeinsam mit einem festgelegten Einsatz direkt zum Flop.'], ['Run It Twice', 'Bei All-in die verbleibenden Gemeinschaftskarten zweimal geben.'], ['7-2-Bonus', 'Zusätzlicher Bonus für einen Sieg mit Sieben und Zwei.'], ['Rabbit Hunt', 'Nach einer beendeten Hand die nicht mehr gegebenen Gemeinschaftskarten ansehen.'], ['Hand-Replay', 'Eine vergangene Hand mit ihren einzelnen Aktionen erneut abspielen.']]),
  ] },
  { id: 'party-extras', titel: 'Party-Extras', satz: 'Bekannte Spiele mit wechselnden Zusatzregeln und neuen Abendformaten.', stufe: 'spaeter', eintraege: ['modifikatoren', 'chaos-modus', 'survival-abend'], punkte: [] },
  { id: 'spaetere-spiele', titel: 'Weitere Spiele', satz: 'Der übrige Backlog für kommende Spiele-Päckchen.', stufe: 'spaeter', paeckchen: 'spaeter', punkte: [] },
  { id: 'grosse-projekte', titel: 'Große Projekte', satz: 'Größere Spielsysteme und Experimente mit mehr Vorlauf.', stufe: 'gross', paeckchen: 'gross', punkte: [
    punkt('3d-experiment', '3D-Experiment', 'design', '3D-Würfel als begrenzter Test für eine räumliche Darstellung.'),
    punkt('discord-activity', 'Discord Activity', 'discord', 'Direkt gemeinsam im Discord-Sprachkanal spielen.'),
  ] },
  { id: 'wer-bin-ich-fertig', titel: 'Wer bin ich?', satz: 'Begriffe erraten und durch Ja/Nein-Fragen eingrenzen.', stufe: 'erledigt', datum: '2026-10-28', punkte: spiele(['wer-bin-ich']) },
  { id: 'phase10-fertig', titel: 'Phase-10-Verbesserungen', satz: 'Feste Joker, längere Auslagen und bessere Kartenauswahl.', stufe: 'erledigt', datum: '2026-10-28', punkte: [punkt('phase10-komfort', 'Auslagen & Kartenauswahl', 'funktion', 'Joker-Zuordnung und Auswahl am Tisch verbessert.', true)] },
  { id: 'paket6-fertig', titel: 'Päckchen 6', satz: 'Gleichzeitige Solo-Aufgaben und neue Party-Runden.', stufe: 'erledigt', datum: '2026-10-28', punkte: [
    ...spiele(['zahlenzoo', 'gedaechtnis-kueche', 'pfeilfieber', 'sortierstation', 'tickendes-paket', 'werwolf']),
    punkt('bauart-b', 'Bauart-B-Baustein', 'funktion', 'Gemeinsamer Seed, lokale Eingabe und Ergebnisprüfung auf dem Server.', true),
  ] },
  { id: 'paket5-fertig', titel: 'Päckchen 5', satz: 'Drei Würfel- und drei Brettspiele.', stufe: 'erledigt', datum: '2026-10-28', punkte: spiele(['wuerfelpoker', 'luegenwuerfel', 'chicago', 'reversi', 'dame', 'domino']) },
  { id: 'paket4-fertig', titel: 'Päckchen 4', satz: 'Weitere Kartenspiele bis zum Omaha-Poker.', stufe: 'erledigt', datum: '2026-10-28', punkte: spiele(['mogeln', 'praesident', 'durak', 'omaha']) },
  { id: 'zurueck-fertig', titel: 'Zurück-Taste am Handy repariert', satz: 'Vom Tisch wieder zur Startseite statt zum schwarzen Bildschirm.', stufe: 'erledigt', datum: '2026-10-28', punkte: [punkt('zurueck-routing', 'Browser-Verlauf', 'fehler', 'Raum-Adressen und Zurück-Navigation funktionieren zusammen.', true)] },
  { id: 'tisch-komfort-fertig', titel: 'Raum verlassen & Spiel beenden', satz: 'Den Platz behalten, eine Runde abbrechen oder den Tisch schließen.', stufe: 'erledigt', datum: '2026-10-28', punkte: [punkt('tisch-komfort', 'Raumsteuerung & Stapelansicht', 'funktion', 'Platz behalten oder verlassen, Runden ohne Wertung abbrechen und Stapel ansehen.', true)] },
  { id: 'hub-fertig', titel: 'Hub-Startseite', satz: 'Profil, Spielkatalog, Favoriten und offene Tische.', stufe: 'erledigt', datum: '2026-10-27', punkte: [punkt('hub-start', 'Hub-Navigation', 'design', 'Startseite mit Navigation auf Desktop und Handy.', true)] },
  { id: 'paket2b-fertig', titel: 'Päckchen 2b', satz: 'Gemeinsam schätzen, antworten und bluffen.', stufe: 'erledigt', datum: '2026-10-27', punkte: spiele(['schlagfertig', 'werhatdasgesagt']) },
  { id: 'schutz-fertig', titel: 'Passwortschutz & HTTPS über Traefik', satz: 'Geschützter Zugang und verschlüsselte Verbindung im Server-Betrieb.', stufe: 'erledigt', datum: '2026-10-27', punkte: [punkt('passwort-https', 'Gruppenpasswort & Traefik', 'betrieb', 'Passwortschutz vorhanden; Traefik ersetzt Caddy im Deployment.', true)] },
  { id: 'bots-fertig', titel: 'Computer-Mitspieler, Mühle & Zehntausend', satz: 'Optionale Computer-Mitspieler und zwei weitere Spiele.', stufe: 'erledigt', datum: '2026-10-25', punkte: [...spiele(['muehle', 'zehntausend']), punkt('computer-mitspieler', 'Computer-Mitspieler', 'funktion', 'Bots im Host-Menü hinzufügen oder entfernen; eigene Strategien für unterstützte Spiele.', true)] },
  { id: 'v1-fertig', titel: 'V1 Poker', satz: 'Der erste gemeinsame Pokertisch im Browser.', stufe: 'erledigt', datum: '2026-10-24', punkte: spiele(['poker']) },
];

export function resolvedRoadmap(planned = PLANNED) {
  const used = new Set();
  const explicit = new Set(ROADMAP.flatMap((e) => e.eintraege || []));
  const result = ROADMAP.map(({ eintraege = [], ...etappe }) => {
    const entries = planned.filter((p) => eintraege.includes(p.id) || p.paeckchen === etappe.paeckchen && !explicit.has(p.id));
    const punkte = [...etappe.punkte.filter((p) => !entries.some((entry) => entry.id === p.id)), ...entries.map((p) => {
      used.add(p.id);
      return { id: p.id, titel: p.name, art: p.type === 'feature' ? 'funktion' : 'spiel', text: p.beschreibung || p.description, plannedId: p.id, ...(p.type === 'feature' ? {} : { spiel: p }) };
    })].map((p) => p.art === 'spiel' && !p.spiel && GAMES[p.id] ? { ...p, spiel: { ...GAMES[p.id], create: undefined, restore: undefined, events: undefined, options: undefined, status: 'available' } } : p);
    return { ...etappe, punkte };
  });
  for (const p of planned.filter((p) => !used.has(p.id))) {
    const target = result.find((e) => e.paeckchen === (p.paeckchen === 'gross' ? 'gross' : 'spaeter'));
    target.punkte.push({ id: p.id, titel: p.name, art: p.type === 'feature' ? 'funktion' : 'spiel', text: p.beschreibung || p.description, plannedId: p.id, ...(p.type === 'feature' ? {} : { spiel: p }) });
  }
  return result;
}
