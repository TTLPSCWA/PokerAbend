// All text and template concepts are authored for Spieleabend.
export const PACKS = {
  classics: ['Klassiker', 'Classics'],
  gaming: ['Gaming', 'Gaming'],
  everyday: ['Internet & Alltag', 'Internet & everyday'],
  absurd: ['Absurd', 'Absurd'],
  community: ['Community', 'Community'],
  trending: ['Trending', 'Trending'],
};

const SCENES = [
  ['classics','desk','Die Abgabefrist ist in fünf Minuten.','The deadline is in five minutes.','Noch eine kleine Änderung.','Just one tiny change.'],
  ['classics','door','Jemand klingelt, nachdem alle gegangen sind.','Someone rings the bell after everyone has left.','Das ist Teil des Plans.','This is part of the plan.'],
  ['classics','coffee','Du hast den ersten Kaffee verschüttet.','You spilled the first coffee.','Damit hatte ich gerechnet.','I saw that coming.'],
  ['gaming','orbit','Der Boss hat plötzlich eine zweite Phase.','The boss suddenly has a second phase.','Ich kenne einen geheimen Weg.','I know a secret route.'],
  ['gaming','crates','Dein Inventar ist voller Dinge, die du nie benutzt.','Your inventory is full of things you never use.','Das brauche ich für später.','I need this for later.'],
  ['gaming','laser','Die Verbindung bricht kurz vor dem Ziel ab.','The connection drops right before the finish.','Das war nur ein Probelauf.','That was just a practice round.'],
  ['everyday','queue','Die kürzeste Schlange ist jetzt die längste.','The shortest queue is now the longest.','Ich habe mich freiwillig gemeldet.','I volunteered for this.'],
  ['everyday','letter','Du öffnest eine E-Mail mit leerem Betreff.','You open an email with an empty subject.','Ich war im anderen Tab.','I was in the other tab.'],
  ['everyday','laundry','Die Waschmaschine hat eine einzelne Socke behalten.','The washing machine kept one sock.','Ein Fall für die Wissenschaft.','A case for science.'],
  ['absurd','moon','Der Mond möchte seine Miete zurück.','The moon wants its rent back.','Dafür fehlt ein Formular.','There is a form missing for that.'],
  ['absurd','plant','Deine Zimmerpflanze hält eine Pressekonferenz.','Your houseplant is giving a press conference.','Das Mikrofon ist für die Pflanze.','The microphone is for the plant.'],
  ['absurd','umbrella','Im Wohnzimmer gilt plötzlich Schirm-Pflicht.','Umbrellas are now mandatory in the living room.','Der Wetterbericht war eindeutig.','The forecast was very clear.'],
  ['community','party','Alle bringen denselben Snack mit.','Everyone brings the same snack.','Wir haben das gemeinsam entschieden.','We decided this together.'],
  ['community','cards','Der Spieleabend beginnt mit einer Diskussion über die Regeln.','Game night starts with a debate about the rules.','Ich lese nur den letzten Absatz.','I only read the last paragraph.'],
  ['community','coat','Jemand tauscht versehentlich zwei Jacken.','Someone accidentally swaps two coats.','In der Tasche ist ein Hinweis.','There is a clue in the pocket.'],
  ['trending','spark','Ein neuer Filter macht alles ein bisschen verwirrend.','A new filter makes everything a little confusing.','Alles ist jetzt im Hochformat.','Everything is vertical now.'],
  ['trending','waves','Alle reden plötzlich von einem unbekannten Begriff.','Everyone is suddenly using an unfamiliar word.','Ich nicke einfach weiter.','I will just keep nodding.'],
  ['trending','signal','Du entdeckst einen neuen Trend genau einen Tag zu spät.','You discover a new trend exactly one day too late.','Morgen starte ich einen Gegentrend.','I will start a countertrend tomorrow.'],
];

export const CARDS = SCENES.map(([pack, id, de, en, captionDe, captionEn]) => ({
  pack, id, situation: [de, en], caption: [captionDe, captionEn], template: id,
}));
export const EXTRA_CAPTIONS = [
  ['Die Besprechung hätte ein Zettel sein können.','This meeting could have been a note.'],
  ['Ich glaube, das Kabel ist emotional verbunden.','I think the cable is emotionally connected.'],
  ['Der Knopf sah wichtiger aus als er war.','The button looked more important than it was.'],
  ['Der Beweis liegt im Kühlschrank.','The evidence is in the fridge.'],
  ['Ich warte auf die nächste Generation.','I am waiting for the next generation.'],
  ['Das ist mein Blick für dringende Anrufe.','This is my face for urgent calls.'],
  ['Die Anleitung war linksherum.','The instructions were backwards.'],
  ['Einen Moment, ich suche die Verantwortung.','One moment, I am looking for responsibility.'],
  ['Bitte als erfolgreich verbuchen.','Please record it as a success.'],
  ['Es war die einzige freie Steckdose.','That was the only free socket.'],
  ['Das Licht war schon vorher so.','The light was already like that.'],
  ['Wir treffen uns einfach am nächsten Dienstag.','Let us just meet next Tuesday.'],
  ['Nicht schlecht für einen Zufall.','Not bad for an accident.'],
  ['Ich habe das Wort „optional“ falsch verstanden.','I misunderstood the word “optional”.'],
  ['In meinem Kalender stand: improvisieren.','My calendar said: improvise.'],
  ['So sieht ein sorgfältiger Plan B aus.','This is what a careful plan B looks like.'],
  ['Wir hätten den Fahrstuhl nehmen sollen.','We should have taken the lift.'],
  ['Jetzt einfach selbstbewusst auftreten.','Now just look confident.'],
  ['Ich bin nur wegen der Kekse hier.','I am only here for the biscuits.'],
  ['Es wollte schon immer ein Raumschiff sein.','It always wanted to be a spaceship.'],
  ['Das Ergebnis ist erstaunlich beige.','The result is surprisingly beige.'],
  ['Diese Minute hätte ich gern zurück.','I would like that minute back.'],
  ['Absichtlich der falsche Hebel.','The wrong lever on purpose.'],
  ['Perfekt für ein zweites Frühstück.','Perfect for a second breakfast.'],
];
export const EXTENDED_CAPTIONS = [
  ['Mein Geduldsfaden hat gekündigt.','My patience has handed in its notice.'],
  ['Was für eine grandiose Schnapsidee.','What a magnificent terrible idea.'],
  ['Zum Kuckuck mit dem Zeitplan.','To heck with the schedule.'],
];
