# Monopoly: Grafik- und Asset-Pipeline (ART-046, Paket F)

Technische Grundlage für künftige Monopoly-Designs. **Es gibt weder ein neues Design noch eine neue Auswahl**: Kein Theme außer `modern` und `classic` ist freigegeben, das produktive Brett bleibt unverändert, unter `public/` liegt kein Theme-Bundle. Die Pipeline übernimmt die technischen Konzepte des privaten V4-Prototyps (datengetriebenes Manifest mit Prüfsummen, Fokusparametern und Herkunftsangaben, Encoder-Cache, Qualitätsmessung), aber keine seiner Grafiken.

## Architektur

```
PNG-Quellen + theme-src.json ──build-monopoly-theme.mjs──▶ <Bundle>/assets/<asset>.<variante>.<sha256-12>.webp
   (nicht ausgeliefert)             (Chromium-Encoder)        <Bundle>/manifest.json
                                                                    │ verify-monopoly-theme.mjs / Tests
                                                                    ▼
                                    server/theme-assets.js: nur hashbenannte .webp ─▶ Cache-Control: public, max-age=31536000, immutable
```

| Baustein | Datei | Aufgabe |
|---|---|---|
| Manifest-Schema, Auswahl, Ladeplan, Budgets | `public/games/monopoly/theme-manifest.js` | reine Funktionen für Server, Build, Tests und später den Browser |
| Dateiprüfung | `scripts/lib/monopoly-theme-verify.mjs` | Prüfsumme, Größe, Abmessungen, Transparenz, Format, Pfade (WebP-/PNG-Köpfe ohne Abhängigkeit) |
| Build | `scripts/build-monopoly-theme.mjs` | skalieren, WebP kodieren, Qualität messen, Cache, Manifest schreiben |
| Prüfung eines Bundles | `scripts/verify-monopoly-theme.mjs` | CLI für `manifest.json` + `assets/`, `--publish` verlangt geklärte Rechte |
| Testgrafik | `scripts/monopoly-test-art.mjs` | abstrakte, prozedural gezeichnete Quellen für das Test-Theme `testbed` |
| Auslieferung | `server/theme-assets.js` | Cache-Header nur für hashbenannte Theme-Bilder |
| Theme-Registrierung | `public/games/monopoly/themes.js` (Paket A) | `manifest`-Feld, Pfad `/games/monopoly/themes/<id>/manifest.json` |

## Manifest (Version 1)

Strenges Schema: jeder unbekannte Schlüssel wird abgelehnt, ausdrücklich auch Schlüssel wie `price`, `rents`, `build`, `tax`, `money`, `rules`, `owner`. Das Manifest enthält ausschließlich Bildinformationen; Preise, Mieten und Regeln bleiben in `data.js`. Die Zuordnung zu den 40 Feldern läuft nur über `fieldIds` (Feld-ID 0–39, je Rolle höchstens ein Bild pro Feld).

```json
{
  "manifestVersion": 1, "themeId": "testbed", "release": "publishable",
  "assetBase": "/games/monopoly/themes/testbed/assets/",
  "generator": { "tool": "scripts/build-monopoly-theme.mjs@1", "encoder": "chromium-canvas-webp", "encoderVersion": "157.0.8103.51", "sourceSetHash": "f8af…" },
  "budgets": { "lobby": 307200, "mobileStart": 1572864, "desktopStart": 2621440 },
  "assets": [{
    "id": "loc-01", "role": "location", "load": "lazy", "fieldIds": [1], "alt": "Abstraktes Ortsbild 1",
    "focus": { "board": { "x": 50, "y": 46 }, "deed": { "x": 50, "y": 50 }, "mobile": { "x": 50, "y": 44 } },
    "fallback": "placeholder-tile",
    "source": { "width": 1672, "height": 941, "sha256": "…" },
    "origin": { "creator": "…", "source": "…", "license": "…", "licenseStatus": "cleared", "evidence": "…", "publication": "public-ok" },
    "variants": [
      { "name": "thumb", "file": "loc-01.thumb.<hash12>.webp", "mime": "image/webp", "width": 384, "height": 216, "bytes": 2294, "sha256": "…", "alpha": false, "quality": { "meanError": 1.25, "maxAlphaError": 0, "q": 0.78 } },
      { "name": "mobile", "…": "480×270" }, { "name": "desktop", "…": "768×432" }
    ]
  }]
}
```

- **Rollen:** `board`, `location` (Brettkachel), `deed` (Urkundenbild), `figure` (`slot` = Token-ID), `building` (`slot` 1–5 = Ausbaustufe), `preview` (Designauswahl), `ui`.
- **Ladezeitpunkt `load`:** `lobby` (Designauswahl), `initial` (Spielstart), `lazy` (bei Sichtbarkeit, z. B. Urkunde), `onDemand` (nur wenn gebraucht, z. B. Figuren der Mitspieler).
- **Varianten:** `desktop`, `mobile`, `thumb` mit Höchstmaßen je Rolle (Tabelle `PROFILES` im Code), nie hochskaliert. `desktop` ist Pflicht, `mobile` für `board`, `location`, `deed`, `figure`.
- **Fallback:** Verweis auf ein anderes Asset, das `initial`/`lobby` lädt, selbst keinen Fallback hat und höchstens 16 KB groß ist. `imgHTML()` setzt es als `data-fallback`.
- **Herkunft:** `creator`, `source`, `license`, `licenseStatus` (`cleared`/`open`/`blocked`), `evidence`, `publication` (`public-ok`/`private-only`). `release: "publishable"` oder `--publish` verlangt für jede Datei `cleared` und `public-ok`; ungeklärte Dateien können nicht in ein veröffentlichbares Bundle.
- **Dateinamen:** `<asset>.<variante>.<erste 12 Zeichen der sha256>.webp`. Der Name ändert sich mit dem Inhalt; deshalb ist die Datei unveränderlich cachebar. Keine Schrägstriche, keine weiteren Punkte, nur `.webp` (Pfad-Traversal ist ausgeschlossen).

## Befehle

```text
node scripts/monopoly-test-art.mjs --out <Ordner>                      # Testquellen (nur für das Test-Theme)
node scripts/build-monopoly-theme.mjs --src <Quellordner> --out <Bundle> [--prune] [--no-cache] [--channel chrome|chromium] [--json]
node scripts/verify-monopoly-theme.mjs <Bundle> [--publish]             # auch: npm run monopoly:theme-build / monopoly:theme-verify
```

`<Quellordner>` enthält `theme-src.json` und die PNG-Quellen (nur PNG, relative Pfade im Ordner). Pro Asset: `id`, `role`, `load`, `src`, optional `fieldIds`, `slot`, `alt`, `focus`, `fallback`, Pflicht `origin`. Der Build braucht den Browser, den Playwright ohnehin mitbringt (`chrome`, in der CI `chromium`); es wird nichts installiert. Wiederverwendung: Schlüssel aus Quelle, Profil, Qualitätsziel, Encoder und Version; `.build-cache.json` im Bundle. Beschädigte oder fehlende Dateien werden erkannt und neu erzeugt.

## Optimierung

- **Format:** WebP (lossy mit Alpha für Figuren; verlustfrei für die kleinen Gebäudesymbole, deren feine Linien sonst sichtbar leiden). Opake Bilder werden ohne Alphakanal gespeichert.
- **Skalierung:** in Halbierungsschritten mit hoher Glättung (kein Aliasing), nie über die Quelle hinaus.
- **Qualität statt fester Zahl:** Jede Variante wird dekodiert und gegen das verkleinerte Original gemessen (mittlerer Farbfehler ≤ 4/255, Alphafehler ≤ 48). Reicht die Profil-Qualität nicht, steigt sie in 0,05-Schritten bis verlustfrei; das gewählte `q` steht im Manifest. Die Größe wächst dann, das Budget fängt sie ab.
- **AVIF:** nicht erzeugt. Der Encoder (Browser-Canvas) kann kein AVIF (`toBlob('image/avif')` liefert PNG, im Test belegt). Ein Vorteil ließe sich nur mit einer neuen Encoder-Abhängigkeit messen; die ist hier bewusst nicht eingeführt.
- **Entpackter Speicher** (Breite × Höhe × 4): ein Ortsbild 1672×941 = 6,0 MiB, als Kachel 384×216 = 0,3 MiB; Brett 2560×1440 = 14,1 MiB, Desktop-Variante 1920×1080 = 7,9 MiB, mobil 1170×658 = 2,9 MiB.

## Ladeverhalten und Cache

- `loadPlan(manifest, 'desktop'|'mobile')` trennt `lobby`, `initial`, `lazy` und `onDemand` mit URL und Größe; `selectVariant` wählt mobil/thumb mit Rückfall auf `desktop`.
- `imgHTML()` setzt immer Breite und Höhe (kein Springen), `loading="lazy"` für alles außer `initial`/`lobby`, `decoding="async"` und `data-fallback`.
- `startBytes()` zählt `initial` plus die Figuren der Mitspieler (schlimmster Fall: die 8 größten). Figuren laden also nur für die gewählten Spieler.
- **Cache:** `server/theme-assets.js` ist unter `/games/monopoly/themes` eingehängt und antwortet nur auf Pfade der Form `/<theme>/assets/<asset>.<variante>.<hash12>.webp` mit `Cache-Control: public, max-age=31536000, immutable` (+ ETag, `nosniff`). Alles andere, auch `manifest.json`, geht unverändert an die bestehende Auslieferung (`public, max-age=0`); die Anmeldeprüfung läuft davor. Es gibt keine globale Cache-Regel; HTML, APIs, Räume, Anmeldung und andere Spiele sind nicht berührt (im Test gegen einen echten Server belegt).

## Messwerte

**Test-Theme `testbed`** (25 Assets, 53 Dateien, abstrakte Grafik; die Quellen sind synthetisch und komprimieren besser als gemalte Bilder, die Werte zeigen die Pipeline, keine Endgrößen):

| Rolle | Quellen (PNG) | WebP desktop | WebP mobil | WebP thumb |
|---|---|---|---|---|
| Brett (2560×1440 → 1920×1080 / 1170×658) | 1525 KB | 37,2 KB | 18,9 KB | – |
| Ortsbild ×4 (1672×941) | 446 KB | 36,6 KB | 19,1 KB | 13,3 KB |
| Urkundenbild ×4 (gleiche Quelle) | – | 50,9 KB | 28,1 KB | – |
| Figur ×8 (389×662, transparent) | 744 KB | 125,4 KB | 66,8 KB | – |
| Gebäude ×5 (192×192, verlustfrei) | 12 KB | 7,9 KB | 10,1 KB | – |
| Vorschau, Platzhalter | 66 KB | 8,2 KB | 2,3 KB | – |
| **Summe** | **3240 KB** | | **425 KB** (alle Varianten) | |

Budgets des Test-Themes: Lobby 5,9 KB (Ziel ≤ 300 KB), mobiler Start 88,0 KB (Ziel ≤ 1,5 MB), Desktop-Start 165,0 KB (Ziel ≤ 2,5 MB). Ein vollständiger Build mit kaltem Cache dauert rund 7 s.

**Messung an echten, detailreichen Bildern** (einmalig und nur lesend an Kopien dreier privater V4-Dateien in einem temporären Ordner, danach gelöscht; nichts davon liegt im Repository): Brett 4691 KB PNG → 67 KB (desktop) / 29 KB (mobil); Ortsbild 3133 KB PNG → 97 KB (768 px) / 63 KB (480 px) / 31 KB (Kachel 384 px) und als Urkundenbild 160 KB (960 px) / 84 KB (640 px); transparente Figur 490 KB PNG → 49 KB (desktop) / 21 KB (mobil). Die Qualitätsstufung hob dabei q auf 0,85–0,93 an. Hochgerechnet auf ein Design mit 22 Ortskacheln als Startbild: Brett 67 KB + 22 × 31 KB + 8 Figuren × 49 KB ≈ **1,1 MB Desktop** (mobil ≈ 0,9 MB), Urkundenbilder lazy. Das liegt unter den Zielen; es ist eine **Hochrechnung aus drei Dateien**, kein Nachweis für ein fertiges Design.

Vorher/nachher am Beispiel: V4-Ortsbild als PNG-Quelle 3133 KB (oder als bisheriges V4-WebP rund 720 KB bei 1672×941) → Brettkachel 31 KB.

## Tests

| Datei | Prüft |
|---|---|
| `test/monopoly-theme-assets.test.js` (16, ohne Browser) | Manifestschema und -fehler, keine Spielregeln im Manifest, Lizenz-/Veröffentlichungsstatus, Dateinamen und Pfad-Traversal, fehlende/geänderte/abgeschnittene/falsch bemessene Dateien, nicht unterstützte Formate (PNG, JPEG, SVG, Text, animiertes WebP), Prüfsummen, Dimensionen, Transparenz, Fallbacks, `imgHTML`, Variantenwahl, Ladeplan, Budgets an echten Dateien, Feldzuordnung, Kompatibilität mit den Themes, Quellspezifikation, Cache-Header (HTTP-Test und echter Server) |
| `test/ui/monopoly-theme-build.spec.js` (6, Chromium) | Quellen zweimal rendern = gleiche Bytes; **zwei Builds ohne Cache aus gleichen Eingaben = bitgleiche Dateien und Manifest** (Chrome und Playwright-Chromium); Wiederverwendung (0 Neukodierungen, beschädigte/fehlende Datei wird ersetzt, `--prune`); Qualitätsstufung und Budgetabbruch; unbrauchbare Quellen; Encoder-Voraussetzung |
| `test/monopoly-themes.test.js` (Paket A) | unverändert grün: vorhandene Themes und Auswahl |

Das Fixture-Bundle `test/fixtures/monopoly-theme/dist/` (612 KB) wird nie ausgeliefert. Bitgleichheit gilt für denselben Encoder; zwischen verschiedenen Browserversionen können sich die Bytes unterscheiden (die Version steht in `generator.encoderVersion`), deshalb vergleicht der Test zwei Builds im selben Lauf und nicht gegen die eingecheckten Dateien.

## Abhängigkeiten

Keine neuen. Genutzt werden Node-Module, Express (vorhanden) und Playwright (vorhandene Entwicklungsabhängigkeit) für den Browser-Encoder.

## Offene Risiken

1. **Encoder-Version:** Andere Chromium-Versionen erzeugen andere Bytes; neue Builds ergeben neue Dateinamen (unkritisch, aber Cache-Wechsel).
2. **AVIF** fehlt; wäre nur mit neuer Abhängigkeit möglich.
3. **Budgets** sind für das Test-Theme trivial erfüllt; die Hochrechnung stützt sich auf drei Bilder. Das Ladeverhalten im Browser (Lazy Loading, `data-fallback`) ist als Markup vorbereitet, aber noch nicht in der Oberfläche verdrahtet und nicht auf echten Geräten gemessen.
4. **`data-fallback`** braucht noch einen `error`-Handler im Renderer (Paket B).
5. **Lizenz:** `licenseStatus` im Manifest ist eine Selbstauskunft; die Prüfung schützt vor ungeklärten Einträgen im Bundle, ersetzt aber keine Rechteprüfung der Quellen.
6. **Speicher/Verzeichnis:** Ein veröffentlichtes Bundle muss unter `public/games/monopoly/themes/<id>/` liegen; alte Dateien bleiben liegen, bis `--prune` läuft.
7. **Windows:** Zeilenenden (CRLF) ändern Manifestbytes, aber nicht die Bilddateien; die Tests parsen das Manifest.

## Voraussetzungen für Paket B (Brett-Renderer)

- Rechteentscheidung R0 für konkrete Assets umsetzen (nur `cleared`/`public-ok` in ein Bundle).
- Echte Quellgrafiken für ein erstes Theme (Brett, Orte, Figuren, Gebäude) plus `theme-src.json`; erst dann ein Bundle unter `public/games/monopoly/themes/<id>/` bauen und das Theme in `themes.js` mit `manifest` und zunächst `released: false` eintragen.
- Renderer: Projektion/Positionierung, `loadPlan`-Nutzung (Kacheln `initial`, Urkunden `lazy`, Figuren `onDemand`), `error`-Handler für `data-fallback`, Fokuswerte anwenden.
- Messung der Ladegrößen mit dem echten Theme und auf Geräten.
