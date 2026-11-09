"""Builds the CC0 sample library for Spieleabend from the Kenney packs.

Usage: python3 -I build_samples.py <kenney-root> <repo-root>
Writes public/sound/samples/<set>/<n>.mp3, public/sound/samples/catalog.js and docs/design/SOUND_LICENSES.md.
"""
import hashlib, json, pathlib, subprocess, sys
import numpy as np

KENNEY, REPO = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
OUT = REPO / 'public/sound/samples'
SR = 44100
PACKS = {
    'casino': ('kenney_casino-audio', 'Casino Audio 1.1'),
    'interface': ('kenney_interface-sounds', 'Interface Sounds'),
    'impact': ('kenney_impact-sounds', 'Impact Sounds'),
    'rpg': ('kenney_rpg-audio', 'RPG Audio'),
    'digital': ('kenney_digital-audio', 'Digital Audio'),
    'jingles': ('kenney_music-jingles', 'Music Jingles'),
}
LONG = 1.8   # win / lose / highlight / call stingers
SHORT = 0.6  # every other effect (EXP-F1 budget)

def f(pack, *names):
    return [(pack, n) for n in names]

# set name -> (max seconds, target loudness category, [(pack, file stem)])
SETS = {
    # Karten
    'card-place':   (SHORT, 'foley', f('casino', 'card-place-1', 'card-place-2', 'card-place-3', 'card-place-4')),
    'card-deal':    (SHORT, 'foley', f('casino', 'card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4')),
    'card-draw':    (SHORT, 'foley', f('casino', 'card-slide-5', 'card-slide-6', 'card-slide-7', 'card-slide-8', 'card-shove-1', 'card-shove-2')),
    'card-shuffle': (SHORT, 'foley', f('casino', 'card-fan-1', 'card-fan-2', 'card-shuffle')),
    # Chips und Münzen
    'chip-lay':     (SHORT, 'foley', f('casino', 'chip-lay-1', 'chip-lay-2', 'chip-lay-3', 'chips-stack-1', 'chips-stack-2', 'chips-stack-3', 'chips-stack-4', 'chips-stack-5', 'chips-stack-6')),
    'chip-handle':  (SHORT, 'foley', f('casino', 'chips-handle-3', 'chips-handle-4', 'chips-handle-6')),
    'chip-collide': (SHORT, 'foley', f('casino', 'chips-collide-1', 'chips-collide-2', 'chips-collide-3', 'chips-collide-4')),
    'coins':        (SHORT, 'foley', f('rpg', 'handleCoins2')),
    # Würfel
    'dice-throw':   (SHORT, 'foley', f('casino', 'dice-throw-1', 'dice-throw-2', 'dice-throw-3', 'die-throw-1', 'die-throw-2', 'die-throw-3', 'die-throw-4')),
    'dice-shake':   (SHORT, 'foley', f('casino', 'dice-shake-1', 'dice-shake-2', 'dice-shake-3')),
    # Spielsteine und Aufprall
    'wood-light':   (SHORT, 'foley', f('impact', *[f'impactWood_light_00{i}' for i in range(5)])),
    'wood-medium':  (SHORT, 'foley', f('impact', *[f'impactWood_medium_00{i}' for i in range(5)])),
    'wood-knock':   (SHORT, 'foley', f('impact', *[f'impactWood_heavy_00{i}' for i in range(5)])),
    'glass-light':  (SHORT, 'foley', f('impact', *[f'impactGlass_light_00{i}' for i in range(5)])),
    'glass-medium': (SHORT, 'foley', f('impact', *[f'impactGlass_medium_00{i}' for i in range(5)])),
    'punch':        (SHORT, 'foley', f('impact', *[f'impactPunch_medium_00{i}' for i in range(5)])),
    # Möbel, Papier
    'chair':        (SHORT, 'foley', f('rpg', 'creak3', 'creak1')),
    'cloth':        (SHORT, 'foley', f('rpg', 'cloth1', 'cloth2', 'cloth3', 'cloth4')),
    'paper':        (SHORT, 'foley', f('rpg', 'bookPlace1', 'bookPlace2', 'bookPlace3', 'bookClose')),
    # Bedienung
    'ui-click':     (SHORT, 'ui', f('interface', 'click_001', 'select_001', 'select_002', 'select_007', 'select_008')),
    'ui-confirm':   (SHORT, 'ui', f('interface', 'confirmation_001', 'confirmation_002', 'confirmation_003', 'confirmation_004')),
    'ui-error':     (SHORT, 'ui', f('interface', 'error_001', 'error_002', 'error_004', 'error_007', 'error_008')),
    'ui-turn':      (SHORT, 'ui', f('interface', 'glass_001', 'glass_002', 'glass_003')),
    'ui-pluck':     (SHORT, 'ui', f('interface', 'pluck_001', 'pluck_002')),
    'ui-back':      (SHORT, 'ui', f('interface', 'back_001', 'back_002', 'back_003', 'back_004')),
    # Arcade / Party
    'arcade-select':  (SHORT, 'ui', f('digital', 'pepSound1', 'pepSound2', 'pepSound3', 'pepSound4', 'pepSound5')),
    'arcade-confirm': (SHORT, 'ui', f('digital', 'twoTone1', 'twoTone2')),
    'arcade-deny':    (SHORT, 'ui', f('digital', 'lowDown')),
    'arcade-turn':    (SHORT, 'ui', f('digital', 'highUp')),
    'arcade-power':   (LONG, 'jingle', f('digital', 'powerUp5', 'powerUp8', 'powerUp9', 'powerUp10', 'powerUp12')),
    # Jingles (Tonhöhe gemessen: deutlich steigend = Sieg, deutlich fallend = Niederlage)
    'stinger-up':   (LONG, 'jingle', f('jingles', 'jingles_HIT12', 'jingles_HIT16')),
    'stinger-down': (LONG, 'jingle', f('jingles', 'jingles_HIT00', 'jingles_HIT13', 'jingles_HIT08')),
    'win-hit':      (LONG, 'jingle', f('jingles', 'jingles_HIT15', 'jingles_HIT11')),
    'lose-hit':     (LONG, 'jingle', f('jingles', 'jingles_HIT09', 'jingles_HIT05')),
    'win-sax':      (LONG, 'jingle', f('jingles', 'jingles_SAX02', 'jingles_SAX04', 'jingles_SAX16')),
    'lose-sax':     (LONG, 'jingle', f('jingles', 'jingles_SAX01', 'jingles_SAX05', 'jingles_SAX14')),
    'win-pizzi':    (LONG, 'jingle', f('jingles', 'jingles_PIZZI02', 'jingles_PIZZI04')),
    'lose-pizzi':   (LONG, 'jingle', f('jingles', 'jingles_PIZZI01', 'jingles_PIZZI05')),
    'win-steel':    (LONG, 'jingle', f('jingles', 'jingles_STEEL02')),
    'lose-steel':   (LONG, 'jingle', f('jingles', 'jingles_STEEL04', 'jingles_STEEL01')),
    'win-nes':      (LONG, 'jingle', f('jingles', 'jingles_NES12', 'jingles_NES14', 'jingles_NES09')),
    'lose-nes':     (LONG, 'jingle', f('jingles', 'jingles_NES11', 'jingles_NES15')),
}
# Loudness targets (RMS of the audible part, dBFS) – UI quieter than table foley, jingles in between.
TARGET = {'foley': -20.0, 'ui': -24.0, 'jingle': -21.0}
PEAK = -1.0

def find(pack, stem):
    folder = KENNEY / PACKS[pack][0]
    hits = [p for p in folder.rglob('*.ogg') if p.stem == stem]
    if len(hits) != 1: raise SystemExit(f'{pack}/{stem}: {len(hits)} Treffer')
    return hits[0]

def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, dtype=np.float32).copy()

def shape(x, max_s, category):
    env = np.abs(x)
    thr = max(env.max() * 10 ** (-40 / 20), 1e-5)
    idx = np.nonzero(env > thr)[0]
    if not len(idx): raise SystemExit('stumme Datei')
    start = max(0, idx[0] - int(0.003 * SR)); end = idx[-1] + 1
    x = x[start:end]
    limit = int(max_s * SR)
    if len(x) > limit:
        x = x[:limit].copy(); fade = int(0.06 * SR)
        x[-fade:] *= np.linspace(1, 0, fade) ** 2
    else:
        fade = min(len(x) // 4, int(0.01 * SR)); x[-fade:] *= np.linspace(1, 0, fade)
    active = x[np.abs(x) > thr]
    rms = np.sqrt(np.mean(active ** 2)) if len(active) else np.sqrt(np.mean(x ** 2))
    gain = 10 ** (TARGET[category] / 20) / max(rms, 1e-6)
    gain = min(gain, 10 ** (PEAK / 20) / max(np.abs(x).max(), 1e-6))
    return (x * gain).astype(np.float32)

def encode(x, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '80k',
                    '-map_metadata', '-1', '-id3v2_version', '0', '-write_xing', '0', str(dest)], input=x.tobytes(), check=True)

def main():
    if OUT.exists():
        for old in OUT.rglob('*.mp3'): old.unlink()
    catalog, licenses, total = {}, [], 0
    for name, (max_s, category, files) in SETS.items():
        entries = []
        for i, (pack, stem) in enumerate(files, 1):
            src = find(pack, stem)
            x = shape(decode(src), max_s, category)
            rel = f'{name}/{i}.mp3'; dest = OUT / rel
            encode(x, dest)
            size = dest.stat().st_size; total += size
            entries.append(rel)
            licenses.append((rel, PACKS[pack][1], str(src.relative_to(KENNEY / PACKS[pack][0])), round(len(x) / SR, 3), hashlib.sha256(dest.read_bytes()).hexdigest()[:16]))
        catalog[name] = {'files': entries, 'max': max_s, 'category': category}
    js = ['// Erzeugt von scripts/sound/build_samples.py aus Kenney-Paketen (CC0). Nicht von Hand ändern.',
          '// Jede Datei steht mit Quelle und Lizenz in docs/design/SOUND_LICENSES.md.',
          'export const SAMPLE_BASE = \'/sound/samples/\';',
          'export const SAMPLE_SETS = Object.freeze(' + json.dumps(catalog, indent=2, ensure_ascii=False) + ');', '']
    (OUT / 'catalog.js').write_text('\n'.join(js))
    md = ['# Klang-Lizenzen', '',
          'Alle Audiodateien unter `public/sound/samples/` stammen aus Paketen von **Kenney** (kenney.nl) und stehen unter **Creative Commons Zero (CC0 1.0)**, also gemeinfrei: nutzbar auch kommerziell, ohne Namensnennung, Weitergabe erlaubt. Die Lizenztexte der Pakete sagen jeweils wörtlich: „License (Creative Commons Zero, CC0) … You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory.“',
          '', 'Wir nennen Kenney trotzdem gern: **Klänge: Kenney (www.kenney.nl), CC0.**', '',
          'Aufbereitung (`scripts/sound/build_samples.py`): Mono, 44,1 kHz, Stille am Anfang entfernt, Effekte auf höchstens 0,6 s und Jingles auf höchstens 1,8 s gekürzt (weich ausgeblendet), auf einheitliche Lautheit gebracht, als MP3 (80 kbit/s) gespeichert. Die synthetischen Atmosphären (`public/sound/ambient/`) sind selbst erzeugt und brauchen keine Lizenz.',
          '', '| Datei | Paket (Kenney, CC0) | Originaldatei | Länge | SHA-256 (16) |', '|---|---|---|---|---|']
    md += [f'| `{r}` | {p} | `{o}` | {d:.2f} s | `{h}` |' for r, p, o, d, h in licenses]
    (REPO / 'docs/design/SOUND_LICENSES.md').write_text('\n'.join(md) + '\n')
    print(f'{len(licenses)} Dateien, {total/1024:.0f} KB')

main()
