# So arbeiten Codex und Claude Code künftig gleichzeitig an PokerAbend

Pro Auftrag eine eindeutige ID aus Großbuchstaben, Ziffern, Bindestrich oder Unterstrich wählen, zum Beispiel `VIS-012`. Mit `codex` oder `claude` die eigene Instanz angeben. Ein zweiter Auftrag desselben Agenten erhält eine andere ID. Alle Befehle hier laufen im Repository-Stamm mit Node.js 22.

## Start und laufende Arbeit

```powershell
node scripts/agent-koordination.mjs init
node scripts/agent-koordination.mjs status
node scripts/agent-koordination.mjs note codex VIS-012 START "Desktop-Darstellung prüfen."
node scripts/agent-koordination.mjs claim codex VIS-012 public/games/kniffel/kniffel.css
node scripts/agent-koordination.mjs check codex VIS-012 public/games/kniffel/kniffel.css
node scripts/agent-koordination.mjs note codex VIS-012 INFO "Desktop-Prüfung abgeschlossen." --kind TEST
```

Die Reservierung gilt für die ganze Datei. Verzeichnisse schließen alle Nachfahren ein. Groß- und Kleinschreibung und Slash-Varianten gelten als derselbe Pfad. Mehrere Pfade werden gemeinsam beansprucht. Bei Konflikt wird keiner dieser Pfade neu vergeben. Für einen weiteren Pfad zuerst `status` und dann `claim` und `check` ausführen. Auch Formatierer, Generatoren und Umbenennungen brauchen vorher Reservierungen für alle berührten Pfade.

Bei einem Konflikt den betroffenen Schreibschritt unterbrechen. Mit `note … BLOCKED "…" <Pfad>` die Blockade hinterlassen. Unabhängige Arbeit ist möglich, soweit der Git-Bereich frei ist. Nach einem `HANDOFF` gibt der bisherige Besitzer die betroffenen Pfade frei. Der übernehmende Agent liest Status, prüft den vorhandenen Diff und reserviert selbst. Offene Fragen und Dateien in der Übergabe nennen.

Zulässige Nachrichtenarten sind `START`, `INFO`, `QUESTION`, `BLOCKED`, `HANDOFF`, `WARN`, `DONE`. Nach dem einzeiligen Nachrichtentext können `--kind ENTSCHEIDUNG`, `--kind TEST`, `--kind COMMIT` oder `--kind OFFEN` und danach Dateipfade oder Commit-Hashes stehen. Bei `COMMIT` ist ein lokal vorhandener Commit-Hash erforderlich. Keine Zugangsdaten, personenbezogenen Geheimnisse oder privaten Rohdaten eintragen. Das Protokoll löst keine Benachrichtigung aus. Bei längerer Arbeit den Status regelmäßig und vor jedem neuen Schreibbereich erneut abrufen.

## Gemeinsamer Git- und Release-Bereich

Vor Paket-/Lockdateien, Versionszeilen, Changelog und gemeinsamen Roadmaps sowie vor Git-Operationen den Bereich `@git` beanspruchen. In der Windows PowerShell `'@git'` mit Anführungszeichen schreiben. Der Anspruch gelingt erst, wenn alle fremden Reservierungen freigegeben sind. Die andere Sitzung beendet dafür laufende Schreibschritte und gibt ihre Pfade gezielt frei. Während der Sperre sind Status, Nachrichten und lesende Arbeit weiterhin möglich. Release-Dateien zusammen mit `@git` oder vor ihm freigeben.

```powershell
node scripts/agent-koordination.mjs status
node scripts/agent-koordination.mjs claim codex VIS-012 '@git'
node scripts/agent-koordination.mjs git codex VIS-012 fetch
git status --short
git diff --cached
node scripts/agent-koordination.mjs git codex VIS-012 add public/games/kniffel/kniffel.css
git diff --cached
node scripts/agent-koordination.mjs git codex VIS-012 commit "style(kniffel): Beispielbetreff"
node scripts/agent-koordination.mjs status
node scripts/agent-koordination.mjs git codex VIS-012 fetch
node scripts/agent-koordination.mjs git codex VIS-012 push
```

Vor dem Push die Projektprüfungen ausführen. Der Git-Befehl prüft `main`, die Git-Reservierung sowie die eigenen Reservierungen für die Dateien im Index. Neu erzeugte Commits ordnet er dem Auftrag zu. Der Push verwendet die geprüfte konkrete Commit-ID und lehnt lokal vorliegende Commits anderer Aufträge ab. Fremde Indexeinträge separat mit dem anderen Agenten klären. `git add .`, `git add -A` und `git commit -a` entfallen. Für ausführbare Dateien (etwa Git-Hooks) setzt `git … add-executable <Datei>` beim Stagen das Ausführungsbit.

`git … pull` und `git … merge` verwenden ausschließlich Fast-Forward. `git … rebase` ist für unveröffentlichte Commits des eigenen Auftrags verfügbar. Integration setzt eine saubere Arbeitskopie samt Index voraus. Bei einem Rebase-Konflikt `@git` halten und bei einem Abbruch `git … rebase-abort` verwenden. Bei einer erforderlichen Übernahme unveröffentlichter Commits den bisherigen Auftrag kontrolliert fortsetzen oder mit dem Nutzer klären. Die Projektregeln zu Freigaben, Remote-Abgleich und `main` gelten durchgehend.

## Abschluss

```powershell
node scripts/agent-koordination.mjs note codex VIS-012 DONE "Darstellung geprüft. Keine offene Übergabe."
node scripts/agent-koordination.mjs release codex VIS-012
node scripts/agent-koordination.mjs archive codex VIS-012
```

Ein abgeschlossener Auftrag kann archiviert werden, sobald alle aktiven Beteiligten abgeschlossen oder übergeben und ihre Reservierungen freigegeben haben. `docs/agents/sessions/<Auftrag>.md` enthält den gesamten Verlauf mit UTC-Zeiten, Reservierungen, Übergaben und Nachweisen. Vor dem Versionieren das Archiv auf vertrauliche Angaben prüfen. Für eine separat beauftragte Archivversionierung eine neue Auftrags-ID verwenden und nur das fertige Archiv stagen.

## Einrichtung, Sperrgrenzen und Wiederherstellung

Beide Agenten führen beim Start `git rev-parse --show-toplevel` und `node scripts/agent-koordination.mjs status` aus und vergleichen den absoluten Pfad. Der Pfad muss im selben lokalen Dateisystem dieselbe Arbeitskopie bezeichnen. Getrennte Klone, Worktrees oder durch Syncthing replizierte Ordner haben eigene Zustände. Für diese Anordnungen bieten lokale Sperren keine verteilte Exklusivität.

`init --hooks` aktiviert vor Beginn der gemeinsamen Arbeit die mitgelieferten Git-Hooks für diese Arbeitskopie, sofern keine andere Hook-Konfiguration entgegensteht. Danach verlangen `pre-commit` und `pre-push` den vermittelten Git-Aufruf. Die Hooks gelten auch bei manuellen Git-Aufrufen in dieser Arbeitskopie. Vorhandene individuelle Hook-Konfigurationen werden nicht überschrieben. `claim` und `check` bleiben für Dateiänderungen verbindlich. Direkte Dateisystem- und Editorzugriffe oder bewusst umgangene Hooks kann das Skript nicht verhindern.

`state.json` ist die maßgebliche Quelle. Das Skript serialisiert Änderungen mit einem atomar angelegten Sperrverzeichnis und ersetzt den Zustand und `AKTUELL.md` einzeln atomar. Ein Abbruch zwischen beiden Aktualisierungen kann ein älteres Markdown-Protokoll hinterlassen. `status` liest den maßgeblichen Zustand und `init` stellt daraus die Markdown-Ansicht wieder her. Die beiden Dateien und die Sperre sind lokal und ignoriert.

Bei einem Abbruch bleiben Reservierungen bestehen. Bevor jemand eingreift, beide Sitzungen mit Schreibzugriff anhalten, den Repo- und Index-Diff prüfen und die Koordinationsdateien sichern. Bei `write.lock` die PID in `write.lock/owner.json` und ihre Startzeit mit dem Prozess abgleichen. Das Sperrverzeichnis nur bei sicher beendeter Instanz zur Seite verschieben. Bei `gitRun` zusätzlich nach Kindprozessen und laufender Git-Integration sehen, Index, HEAD und Remote abgleichen und den Wiederherstellungsschritt vom Nutzer bestätigen lassen. Ein nachweislich verwaister `gitRun`-Eintrag kann dann mit gesichertem Zustand manuell entfernt werden. Der Nutzer oder die wiederaufgenommene Sitzung dokumentiert unter der bisherigen Agentenkennung und Auftrags-ID eine `WARN`- und `HANDOFF`-Nachricht und gibt die alten Pfade gezielt frei. Der übernehmende Agent hält die Übernahme fest und reserviert erneut. Das Alter eines Eintrags ist kein Freigabegrund.
