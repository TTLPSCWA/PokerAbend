# Playwright-Prüfwerkzeuge

`helpers.js` exportiert die gemeinsamen Fixtures und EXP-F6-Assertions. Beispiele mit positiven und absichtlich fehlerhaften Fällen: `experience-helpers.spec.js`.

```sh
npm run test:ui -- test/ui/experience-helpers.spec.js
```

FPS-Läufe ohne parallele CPU-intensive Tests ausführen: Die Messung soll die Aktion bewerten und wird durch andere Last auf der Testmaschine beeinflusst.

Die Projekte `desktop` und `mobil` nutzen Chromium. Für FPS ist Chromium mit CDP erforderlich; ein Mobilprojekt emuliert die Ansicht und ersetzt keine Messung auf einem physischen Telefon.

## Bewegung

```js
import { test, expectSmoothMotion } from './helpers.js';
// Nach Aufbau der Seite:
const metrics = await expectSmoothMotion(page,
  () => page.evaluate(() => motionDemo.run('walk', { duration: 1800 })));
```

`expectSmoothMotion(page, action, {minFps, timeout})` drosselt die CPU über CDP auf 4×, zählt rAF-Intervalle während der Aktion und wartet auf neue endliche Web-Animations-Animationen. Schon vorher laufende oder unendliche Animationen verlängern die Messung nicht. Standardbudget: **60 FPS bei grobem Zeiger (Mobilprojekt), sonst 45 FPS**. `minFps` überschreibt das Budget. Die Messung braucht mindestens acht Frames und 200 ms; eine Sofortaktion ist kein aussagekräftiger Performancetest. `timeout` (Standard 10000 ms) begrenzt das Warten auf auslaufende Animationen, nicht die übergebene Aktion; dafür gilt Playwrights Testtimeout.

Rückgabe und Fehlermeldung enthalten FPS, rohe FPS, Frames, Dauer, Budget und Anzahl neuer Animationen. Der Vergleich rundet nur auf zwei Nachkommastellen, um rAF-Zeitstempelpräzision abzubilden. Auch bei Fehlern werden Recorder und CPU-Drosselung aufgeräumt (1×). Das Werkzeug benötigt eine exklusive Messung pro Seite; es misst rAF-Takt, keine GPU-Rasterzeit und kein vollständiges Rendering-Profil.

## Klang

```js
await page.evaluate(() => { window.__soundLog = []; }); // vor der Aktion
await page.getByRole('button', { name: 'Bestätigen' }).click();
await expectSound(page, 'confirm');
// Optional: exakte zusätzliche Felder und nur neue Einträge:
await expectSound(page, { event: 'confirm', palette: 'holz' }, { since: 0 });
```

Der F1-Testmodus protokolliert statt abzuspielen. `expectSound` wartet maximal 2500 ms (mit `timeout` änderbar) und liefert den gefundenen Eintrag. Ohne aktiviertes Array schlägt der Helfer ausdrücklich fehl. Zwischen Aktionen Array leeren oder den bisherigen Index als `since` übergeben, damit ein altes Ereignis den Test nicht erfüllt.

Das Spiel-Kit unterdrückt den Zugton beim Wiederherstellen eines laufenden Zugs nach Eintritt oder Reconnect. Der Schutz überspringt dabei auch `xp.turn` und damit den Paletten-Zugton. Beim echten Wechsel zum eigenen Zug am selben Tisch in bestehender Verbindung bleibt `xp.turn` aktiv. Hat das Erlebnis-Modul keinen eigenen Zugton, übernimmt an dieser Stelle der Fallback. Ein bereits vor der Trennung eingeplanter zweiter Fallback-Ton bleibt ein separates Thema.

## Verdeckte Informationen

```js
import { expectNoLeak, login } from './helpers.js';
await login(otherPlayerPage, app, 'Mitspieler'); // registriert die Erfassung vor der Navigation
// Beide Spieler beitreten lassen und bestätigten Zustand abwarten.
await expectNoLeak(page);
await expectNoLeak(page, { action: () => makeMove(page) });
```

Der isolierte Playwright-Server markiert jede Raumübertragung mit einer monotonen Revision. Alle Empfänger derselben Übertragung teilen die Revision und erhalten ihre eigene Socket.IO-Verbindungskennung. Der normale Server aktiviert diese Markierung nicht.

Der Testrunner erfasst Spielzustände passiv aus WebSocket-Frames und HTTP-Polling-Antworten der Testserver-Adresse. Der Client meldet für jede Darstellung die Kennung des tatsächlich gerenderten Zustands. Der Vergleich verwendet ausschließlich den im Runner erfassten passenden Frame. Fehlt er, sind Kopien widersprüchlich oder ändern sich Dokument oder Verbindung während der Prüfung, meldet der Test einen Fehler. Ein späterer Frame mit einer anderen Revision kann frühere DOM-Werte nicht autorisieren. Die Herkunft bleibt auch bei überlappenden Transporten über Revision und Verbindung eindeutig.

Der Recorder erfasst den Bereich bei jedem Renderwechsel. Im beobachteten DOM rekonstruiert er die Zwischenzustände aus MutationObserver-Ereignissen, früheren Attribut- und Textwerten und den dokumentierten Änderungen der Kindknoten. Dadurch bleiben Feldbindung und Wert auch bei mehreren synchronen Mutationen oder einem Knotentausch erhalten. Der Standardbereich ist `#game-root`. Als engere `scope` eignen sich stabile Selektoren, etwa feste IDs. Jede Stichprobe muss zum exakten Transportabschnitt, Raum, zur Hand oder Rundeninstanz und zum jeweiligen Spieler- oder Zuschauerblick passen. Recorder und temporärer Animations-Wrapper werden anschließend entfernt.

Für private Kartenspiele stammen die Vergleichswerte von einem anderen Spieler derselben Übertragung. Raum, Spiel, Phase und Runde müssen übereinstimmen. Poker prüft zusätzlich die konkrete Handinstanz, Handnummer, Street und öffentliche Merkmale des Spielzustands. Die Nummer allein kann nach einem Handabbruch erneut vergeben werden. Ein privater Vergleichspartner und tatsächlich unterschiedliche private Werte sind dann Pflicht. `requireSecrets: true` erzwingt dies auch für andere Spiele. Fehlende Wurzeln und mehr als 12.000 Stichproben schlagen fehl. Eine im Node-Runner erzeugte Ansicht kann nur bei isolierten DOM-Tests ohne live gerenderten Raum als `serverView` übergeben werden.

Kartenkennungen, Farbkarten mit physischer ID, bekannte private Werte, Würfelattribute und semantische Würfelelemente werden erkannt. Gewöhnliche Zahlen wie Punktestand 6 gelten nicht als Würfelleck. Bei eigenen Darstellungen einen Serverpfad binden:

```html
<span data-view-path=".g.opponentCard" data-view-value="">??</span>
```

Ein sichtbarer Wert an diesem Pfad muss exakt der autorisierten Ansicht entsprechen; Maskierungen bleiben erlaubt. Das erkennt auch eine verdeckte Kartenposition, deren Kartenwert anderswo bereits öffentlich ist. Für eigene SVG-/Canvas-Darstellungen, übersetzte Beschriftungen oder abweichende Wertcodierungen sind solche Bindungen bzw. zusätzliche spielbezogene Assertions notwendig. Die Erfassung gilt für aufgezeichnete Mutationen im Light DOM und geprüfte Animationsziele. Canvas- und CSS-Pixel, Shadow DOM, Iframes und im Speicher erzeugte Inhalte brauchen eigene Prüfungen. Eine anhand von Klassen oder Attributen nur vorübergehend passende Bereichsauswahl wird historisch nicht neu ausgewertet. Zwischenwerte ohne Mutation im beobachteten DOM sind nicht erfasst. Die serverseitigen V2-09-Tests bleiben ergänzend erforderlich.

### Beobachtungsgrenzen

| Oberfläche | Abdeckung |
| --- | --- |
| Text im Light DOM | Text von Elementen ohne Elementkinder ist erfasst. Direkter Text neben Elementkindern fehlt auch dann, wenn er dauerhaft im DOM steht. Text in den Kind-Elementen wird separat geprüft. |
| Attribute | Geprüft werden `data-*`, `src`, `href`, `style`, `aria-label`, `alt` und `title`. `class` dient nur zur Einordnung von Würfelelementen. Attribute wie `value`, `placeholder` und `aria-valuetext` sind von der Inhaltsprüfung ausgenommen. |
| Eingabefelder | Der aktuelle Wert der Eigenschaft `input.value` gehört nicht zu den Aufnahmen. Das gilt für Benutzereingaben und für programmatische Zuweisungen. Für vertrauliche Felder den Wert auf der jeweils berechtigten und unberechtigten Seite gezielt prüfen. |
| Style und Animationen | Inline-`style` wird als Attribut erfasst, wenn der Browser dafür Mutationen meldet. Reine CSSOM-Änderungen, berechnete Styles, Pseudoelemente und nur in der visuellen Ausgabe auftretende Zwischenwerte sind nicht abgedeckt. Der Helfer untersucht die erfassten Zeichenketten der Web-Animations-Keyframes. |
| Shadow DOM | Der Observer und die Bereichssuche überschreiten keine Shadow-Root-Grenzen. Für Shadow DOM, Iframes und Canvas-Inhalte sind eigene Prüfungen erforderlich. |
| Verzögertes Rendering | Synchrone Mutationen im instrumentierten Renderaufruf erhalten dessen Serverrevision. Spätere Mutationen werden der zum Erfassungszeitpunkt zuletzt gerenderten und noch gültigen Revision zugeordnet. Bei Timern, Promises oder Animations-Callbacks kann der auslösende Frame älter sein. Die Zuordnung beweist nicht, aus welchem Frame ein verzögerter Callback seine Daten bezieht. |

## Abdeckung einzelner Szenarien

- Die Werwolf-Experience-Fälle deaktivieren Hexe, Amor und Jäger. So prüfen sie den Tag-/Nachtablauf ohne zusätzliche Rollenphasen.
- Reaktor-Notfall pausiert den Live-Tisch für die Animationsmessung. Die Rettungsanimation läuft mit einem getrennten unpausierten Darstellungssnapshot, damit die Hitzeuhr die Messung nicht beeinflusst.

Diese Szenarien decken die jeweiligen Abläufe ab. Optionalrollen und weitere Spiel- oder Animationsvarianten benötigen eigene Fälle.
