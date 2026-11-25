# HTTP und Socket.IO

## Zugang und Identität

- `GET /health` meldet Version, Build-Kürzel und Laufzeit. Ein Produktivnachweis braucht außerdem den tatsächlich gestarteten Build.
- Das Gruppenpasswort erlaubt den Seitenzugang. Discord OAuth lässt sich auch ohne Guild-ID nach regulärem Seitenzugang verwenden. Der direkte Seitenzugang per Discord erfordert die passende Guild-Konfiguration und Mitgliedschaft. Signierte Gast-Identität und Discord-Sitzung sind eigene Nachweise.
- Das Gast-Cookie wird nur einem noch vorhandenen Konto zugeordnet. Ein gelöschtes Konto wird dadurch nicht neu angelegt. Neue Gastkonten erhalten eine neue ID. Eine öffentliche Game-ID allein berechtigt zu keinem Schreibzugriff.
- `GET /me` liefert unter anderem die freigeschalteten Idle-Spiele. `GET /api/discord-access` meldet die Discord-Einschränkungen. Wenn der Exklusivmodus aktiv ist, sind Tickets, Abendplanung, Rückblicke, Bestenlisten, Ranked und der Altnamen-Zugriff serverseitig geschützt. Fehlende Sitzung und fehlende Konfiguration ergeben getrennte Fehlerantworten.
- `GET /api/roadmap` projiziert die kuratierten Besucherdaten. Bei `approved: false` bleiben sie geschlossen. Details zu Build- und Produktivbelegen stehen in der [Betriebsanleitung](betrieb.md#öffentliche-roadmap-und-freigabeschalter-seit-3190).

[Server und Routen](../server/index.js) · [Discord](../server/auth-discord.js) · [Konten](../server/account-store.js).

## Räume und Zuschauer

| Schnittstelle | Verhalten |
| --- | --- |
| Socket-Handschlag | Seitenzugang, Herkunft und Verbindungsgrenze werden serverseitig geprüft. |
| `create`, `join`, `peek` | Tisch öffnen, beitreten oder zuschauen. Ein Reconnect verwendet den vom Server vergebenen Platz-Token. |
| `state` | Der Server berechnet `room.view(p.id)` je Empfänger und sendet die Ansicht einzeln auf dessen Socket. Spielersicht und Zuschaueransicht können verschiedene Daten enthalten. |
| `lobby` | Abonnierte Liste öffentlicher Tische mit sichtbaren Metadaten. Keine Platz-Token oder privaten Karten. |
| Raumaktionen | Spiel- und Plattform-Handler prüfen Raum, Spieler, Rollen und Regeln. Die Bestätigung signalisiert Erfolg oder einen fachlichen Fehler. Bei einer Spielpause bleibt nur die vorgesehene Teilmenge an Aktionen verfügbar. |
| `maintenance`, `restarting`, `version` | Zustandsmeldungen zum Betrieb und Build. Sie ersetzen keine Spielansicht. |

Die privaten Revisionsstempel für die Testprüfung werden nur im isolierten Testbetrieb zugeschaltet. Die gewöhnliche Socket-Antwort enthält diese Testdaten nicht.

[Socket-Handler](../server/index.js#L865) · [Raumbasis](../server/base-room.js) · [Browserprüfung](../test/ui/server-view-audit.js).

## Idle-Speicherung

`/api/idle` wird bei registrierten Idle-Modulen eingebunden. Die Pfade verlangen Seitenzugang und ein vorhandenes Konto. Aktionen verwenden JSON vom gleichen Ursprung und eine Schreibsitzung. Der Spielerzustand kommt aus dem jeweiligen Servermodul und wird getrennt je Konto und Spiel geführt.

| Operation | Wirkung |
| --- | --- |
| `GET /api/idle/:gameId` | Vorschau. Mit `x-idle-token` Ansicht der zugehörigen Sitzung. |
| `POST …/session`, `…/session/heartbeat`, `…/takeover` | Lease öffnen oder erhalten. Ein bestätigter Wechsel entwertet die bisherige Schreibsitzung. |
| `POST …/actions`, `…/save` | Spielaktion zunächst flüchtig. `save` bestätigt Revision und Zeitanker. |
| `GET …/export`, `POST …/export` | Bestätigten Stand als signierte Datei lesen. Die Schreibvariante speichert und exportiert. |
| `POST …/import/preview`, `…/import/confirm` | Signatur und Bindung prüfen. Wiedereinlesen über die bestätigte Vorschau der aktuellen Revision. |
| `POST …/prestige` | Bestätigter neuer Lauf für gültige neue Ansprüche. |

[Idle-API](../server/idle/api.js) · [Engine- und Speichervertrag](idle-engine.md) · [Integrationsregressionen](../test/idle-integration.test.js).
