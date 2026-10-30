# Lokaler Raumhintergrund

Eigenständige neue Szene, am 30. Oktober 2026 mit dem eingebauten `image_gen`-Werkzeug erzeugt. Die Referenz wurde visuell analysiert, aber weder als Bildhintergrund verwendet noch in dieses Asset hineinkopiert. Keine fremde Stockdatei, kein Hotlink, keine übernommenen Markenlogos oder Benutzeroberflächen. Es wurden keine externen Fotos/Schriftdateien bezogen. Die Bildgenerierung ist die Herkunft dieses Assets; dies ist keine Behauptung über exklusive Urheberrechte an KI-Ausgaben.

Projektdateien (aus der erzeugten PNG-Szene technisch als WebP kodiert):

| Datei | Abmessungen | Größe | SHA-256 |
| --- | --- | --- | --- |
| `public/assets/games-lounge.webp` | 1672 × 941 | 135766 Bytes | `7fe99af98b668e65528936884ca74bd06bc2a450f46862c887c4f9a885166bcd` |
| `public/assets/games-lounge-mobile.webp` | 768 × 432 | 49618 Bytes | `8304933829b8d6f00ca4c9c7a97283a2ff3a8ad4d396a1c9051ee86416eb2aa2` |

Das Original bleibt im lokalen `generated_images`-Verzeichnis von Codex erhalten. Die Anwendung benötigt ausschließlich die beiden hier versionierten WebP-Dateien. `public/ui-theme.css` verwendet jeweils die passende Größe für eine einzige zusammenhängende Hintergrundfläche des Hubs. Dunkle Basisfarbe bei fehlendem Bild, dezenter Blur und deckende Flächen bei reduzierter Transparenz sind in CSS definiert. Keine Fotohintergründe in Spielkacheln.

Verwendeter Prompt (eingebauter Modus, keine CLI/API-Fallback-Nutzung):

> Use case: photorealistic-natural. Asset type: one original background photograph for a desktop board-game library web application, wide landscape 16:9, ideally 2560x1440. Create a coherent cosy evening games lounge interior, not a screenshot and not a website design. Camera at seated eye level across the room. Left: tall softly lit window, dark wooden frames, leafy plants. Back wall: dark walnut bookshelves with books and boardgame boxes without readable print, warm amber pendant lamp in upper left. Middle: dark forest-green walls, worn leather armchair and distant wooden game table, subtle clutter. Right: warm shaded floor lamp and fireplace glowing softly. Photographic shallow depth of field and gentle optical defocus throughout, atmospheric warm amber highlights against charcoal, dark olive green and brown shadows, quiet and elegant, realistic materials. The room must be recognisable even beneath dark translucent UI panels. Keep central and lower areas darker and calm. No people, no playing cards in the foreground, no text, no logos, no letters, no user interface, no panel shapes, no vignettes suggesting buttons. This must be a new standalone scene with no copied artwork or branded elements.
