// Ideen-Katalog für Partyspiele. Nur Anzeige/Planung, KEINE spielbaren Servermodule.
const ideas = [
  ['zahlenzoo', 'Zahlenzoo', 'Symbole und Tiere unter Zeitdruck zählen.', '2–10 Spieler', '30–60 Sek.', 'wissen', 'Niedrig'],
  ['brueckenroulette', 'Brückenroulette', 'Geheim einen Übergang wählen; manche Wege tragen nicht alle Spieler.', '2–10 Spieler', '1–2 Min.', 'bluff', 'Niedrig'],
  ['turmbauer', 'Turmbauer', 'Bewegliche Blöcke im richtigen Moment stapeln.', '2–10 Spieler', '1–2 Min.', 'geschick', 'Niedrig'],
  ['gedaechtniskueche', 'Gedächtnisküche', 'Zutaten merken und Bestellungen richtig zusammenstellen.', '2–10 Spieler', '1–2 Min.', 'wissen', 'Niedrig'],
  ['luegenbaron', 'Lügenbaron', 'Erfundene Antworten tarnen und die Wahrheit erkennen.', '3–10 Spieler', '2–5 Min.', 'bluff', 'Niedrig'],
  ['laser-huepfer', 'Laser-Hüpfer', 'Zum richtigen Zeitpunkt über wandernde Laser springen.', '2–10 Spieler', '1–2 Min.', 'reaktion', 'Mittel'],
  ['kronenjagd', 'Kronenjagd', 'Eine Krone stibitzen und möglichst lange behalten.', '2–10 Spieler', '1–3 Min.', 'echtzeit', 'Hoch'],
  ['tickendes-paket', 'Tickendes Paket', 'Ein Paket weiterreichen, bevor der geheime Timer abläuft.', '3–10 Spieler', '1–2 Min.', 'bluff', 'Niedrig'],
  ['minenlauf', 'Minenlauf', 'Mit wenigen Scans durch ein unbekanntes Minenfeld gelangen.', '2–10 Spieler', '1–3 Min.', 'geschick', 'Mittel'],
  ['sortierstation', 'Sortierstation', 'Objekte auf einem Förderband schnell richtig zuordnen.', '2–10 Spieler', '30–60 Sek.', 'reaktion', 'Niedrig'],
  ['pfeilfieber', 'Pfeilfieber', 'Immer längere Tastensequenzen möglichst schnell wiederholen.', '2–10 Spieler', '20–40 Sek.', 'reaktion', 'Niedrig'],
  ['broeckelboden', 'Bröckelboden', 'Sich auf einer zerfallenden Plattform in Sicherheit bewegen.', '2–10 Spieler', '1–2 Min.', 'echtzeit', 'Hoch'],
  ['labyrinth-chaos', 'Labyrinth-Chaos', 'Veränderliche Wege und Schlüssel im Labyrinth bewältigen.', '2–8 Spieler', '2–4 Min.', 'geschick', 'Mittel'],
  ['geschenkdiebe', 'Geschenkdiebe', 'Geschenke einsammeln und den anderen wieder abluchsen.', '2–8 Spieler', '2–3 Min.', 'echtzeit', 'Hoch'],
  ['wortjagd', 'Wortjagd', 'Wörter tippen, bevor die Zeit abläuft.', '2–10 Spieler', '30–90 Sek.', 'wissen', 'Niedrig'],
  ['puzzle-panik', 'Puzzle-Panik', 'Zerlegte Bilder schneller als die anderen zusammensetzen.', '2–10 Spieler', '1–3 Min.', 'geschick', 'Mittel'],
  ['schubsarena', 'Schubsarena', 'Mit Schubsaktionen die gegnerischen Figuren aus der Arena drängen.', '2–8 Spieler', '1–2 Min.', 'echtzeit', 'Hoch'],
  ['fallenbauer', 'Fallenbauer', 'Gemeinsam Fallen platzieren und anschließend den Parcours bestehen.', '2–8 Spieler', '2–4 Min.', 'echtzeit', 'Hoch'],
  ['regelwahnsinn', 'Regelwahnsinn', 'Alle paar Sekunden ändern sich Bewegungs- oder Siegbedingungen.', '2–10 Spieler', '1–3 Min.', 'echtzeit', 'Hoch'],
  ['rhythmus-rausch', 'Rhythmus-Rausch', 'Passende Tasten im Takt drücken und Kombos sammeln.', '2–10 Spieler', '1–2 Min.', 'reaktion', 'Mittel'],
  ['scheinwerfer-flucht', 'Scheinwerfer-Flucht', 'Den wandernden Lichtkegeln möglichst lange ausweichen.', '2–10 Spieler', '1–2 Min.', 'geschick', 'Mittel'],
  ['schatzgraeber', 'Schatzgräber', 'Hinweise kombinieren und versteckte Schätze ausgraben.', '2–10 Spieler', '2–4 Min.', 'wissen', 'Mittel'],
  ['stillgestanden', 'Stillgestanden!', 'Nur bewegen, wenn der Kontrolleur nicht hinsieht.', '2–10 Spieler', '1–2 Min.', 'reaktion', 'Niedrig'],
  ['doppelagent', 'Doppelagent', 'Einen geheimen Begriff umschreiben, ohne den ahnungslosen Mitspieler zu verraten.', '3–10 Spieler', '3–5 Min.', 'bluff', 'Niedrig'],
  ['stille-post', 'Stille Post Deluxe', 'Sätze zeichnen und Bilder wieder beschreiben.', '4–10 Spieler', '5–10 Min.', 'wissen', 'Mittel'],
  ['schaetzmeister', 'Schätzmeister', 'Ungewöhnliche Zahlen schätzen; wer am nächsten liegt, gewinnt.', '2–10 Spieler', '1–3 Min.', 'wissen', 'Niedrig'],
  ['reaktor-notfall', 'Reaktor-Notfall', 'Gemeinsam Rätsel lösen, bevor die Anlage überhitzt.', '2–8 Spieler', '3–6 Min.', 'wissen', 'Mittel'],
  ['bomben-duell', 'Bomben-Duell', 'Sprengladungen setzen und rechtzeitig in Deckung gehen.', '2–8 Spieler', '1–3 Min.', 'echtzeit', 'Hoch'],
];

// `status: geplant` bedeutet ausdrücklich: kein Spielmodus und kein erstellbarer Raum.
export const PARTY_GAMES = Object.freeze(ideas.map(([id, name, description, players, duration, subtype, effort]) =>
  Object.freeze({ id, name, description, players, duration, subtype, effort, category: 'party', status: 'geplant' })
));
