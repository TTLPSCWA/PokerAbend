# Monopoly: Theme-Architektur (ART-046, Paket A)

Technisches Fundament für auswählbare Designs der vorhandenen Spiel-ID `monopoly`. Paket A liefert **keine neue sichtbare Option**; es bereitet Feldnamen, Kartentexte und Asset-Manifeste vor. Renderer, Assets und UI-Tests folgen in späteren, einzeln freizugebenden Paketen.

## Drei getrennte Ebenen

| Ebene | Wo | Ein Theme darf |
|---|---|---|
| Spielregeln | `public/games/monopoly/data.js`, `games/monopoly/room.js` | nichts ändern (Preise, Mieten, Würfel, Handel, Auktion, Hypothek, Gebäude) |
| Anzeigenamen | `public/games/monopoly/themes.js` | Feldnamen (Feld-ID 0–39) und Kartentexte setzen |
| Grafikressourcen | später `public/games/monopoly/themes/<id>/manifest.json` | Bilder, Figuren, Gebäude beschreiben (Paket B ff.) |

## Einstellung

Das Raumsetting bleibt `settings.theme`. Eingebaut sind `modern` („Bisheriges Thema“, Standard) und `classic` („Klassik“); beide verhalten sich wie vor Paket A. Gespeicherte Räume behalten ihren Wert. Ein unbekannter, entfernter oder nicht freigegebener Wert ergibt `modern`.

Die Auswahl im Host-Menü (`Room.OPTIONS`) und die Annahme von Einstellungen (`clampSettings`, Abendprogramme, Wiederherstellung) kommen aus derselben Registry und zeigen nur Themes mit `released: true`, die zur Variante passen (`classic`, `speed`). **Junior (24 Felder) kennt kein Theme** und nimmt auch keines an.

## Ein Theme definieren

```js
{ id: 'fantasy', name: 'Fantasy', released: false,
  variants: ['classic', 'speed'],                  // nie 'junior'
  fields: { 0: '…', 1: '…', /* … */ 39: '…' },     // Feld-ID → Anzeigename (1–40 Zeichen); auch nur ein Teil ist erlaubt
  cards: { event: [/* 16 Texte */], chest: [/* 16 Texte */] },  // optional; Wirkung bleibt in data.js
  manifest: '/games/monopoly/themes/fantasy/manifest.json' }    // optional, fester Pfad je Theme-ID
```

`validateTheme()` lehnt falsche IDs, Junior, unbekannte Feld-IDs, zu lange Namen, falsche Kartenanzahl und fremde Manifestpfade sofort ab. Preise, Mieten und andere Regelwerte sind in einem Theme nicht möglich.

Neues Theme einbauen: Eintrag in `BUILTIN` (themes.js) mit `released: false`; erst wenn Renderer, Assets und UI-Tests vorhanden sind, auf `true` setzen. Dann erscheint es in der Auswahl.

## Feldnamen: eine Quelle für alles

Der Server löst die 40 Namen auf (`Room.fieldNames()`) und sendet sie als `g.names` im Spielzustand. Brett, Dialoge, Protokoll (`landet auf …`, `Kauf …`, Steuer) und Kartentexte nutzen dieselbe Quelle, damit nichts auseinanderläuft. Rangfolge je Feld:

1. Name aus einem **eigenen Brett** (nur die 28 Grundstücke) – eigene Bretter werden nie überschrieben oder umbenannt, die Dateien bleiben unverändert;
2. Name aus dem Theme;
3. Name des Standardbretts („Spieleabend-Stadt“) bzw. aus `data.js`.

Die zwölf Nicht-Grundstücke (Los, Gefängnis, Frei Parken, Gehe ins Gefängnis, Gemeinschaft, Ereignis, Steuern) sind in eigenen Brettern nicht editierbar; dort gilt der Theme-Name.

## Tests

`test/monopoly-themes.test.js` (Registry, Validierung, Standardwerte, Freigabe, Junior, Namen in Zustand und Protokoll, Kartentexte, eigene Bretter, Brettwechsel, Wiederherstellung, Reconnect) zusätzlich zu `test/monopoly.test.js`, `test/monopoly-variants.test.js` und `test/evening-mode.test.js`.
