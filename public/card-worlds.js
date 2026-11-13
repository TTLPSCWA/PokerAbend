'use strict';
// ART-T1 Kartenwelten: Der Host wählt für UNO (Classic), Skip-Bo und Phase 10 eine Welt; sie gilt für alle am Tisch.
// Nur Darstellung. Diese Datei setzt body[data-card-world] und body[data-cw-frame] aus dem Raumstand und
// liefert die Auswahl im Host-Menü (kit.js). Daten: /games/card-worlds/worlds.js (auch vom Server geprüft).
const CardWorlds = (() => {
  let mod = null, last = null, raw = null;
  const ready = import('/games/card-worlds/worlds.js').then((m) => { mod = m; apply(last); return m; }).catch(() => null);
  const t = (de, en) => (I18n.language === 'en' ? en : de);
  // UNO-Varianten mit eigener Gestaltung (Flip, No Mercy, All Wild, Spuknacht) behalten ihr Aussehen
  const applies = (S) => !!S && (S.game !== 'farbenchaos' || (S.variant || 'classic') === 'classic');
  const current = (S) => (mod && S && applies(S) ? mod.worldOf(S.game, S.cardWorld) : null);
  // ART-T5 Schneefall: ruhige Hintergrundbewegung nur in Winterwelten, pro Gerät abschaltbar (localStorage, Standard: an)
  const SNOW_KEY = 'cwSnow';
  const snowOn = () => { try { return localStorage.getItem(SNOW_KEY) !== 'off'; } catch { return true; } };
  function snow(w) {
    const b = document.body, winter = !!w && w.game === 'all';
    let layer = document.getElementById('cw-snow'), btn = document.getElementById('cw-snow-toggle');
    if (!winter) { layer?.remove(); btn?.remove(); delete b.dataset.cwSnow; return; }
    if (!layer) { layer = document.createElement('div'); layer.id = 'cw-snow'; layer.setAttribute('aria-hidden', 'true'); layer.innerHTML = '<i></i><i></i><i></i>'; b.appendChild(layer); }
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'cw-snow-toggle'; btn.type = 'button'; btn.textContent = '❄';
      btn.addEventListener('click', () => { const on = !snowOn(); try { localStorage.setItem(SNOW_KEY, on ? 'on' : 'off'); } catch {} snow(current(last)); });
      b.appendChild(btn);
    }
    const on = snowOn();
    b.dataset.cwSnow = on ? 'on' : 'off';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? t('Schneefall ausschalten', 'Turn snowfall off') : t('Schneefall einschalten', 'Turn snowfall on'));
    btn.title = btn.getAttribute('aria-label');
  }
  // ART-T6 Wintermusik: nur in Winterwelten, eigener Knopf neben dem Schnee-Knopf, pro Gerät gespeichert (Standard: aus).
  // Wiedergabeliste aus /games/card-worlds/music/, leise, die Stücke blenden selbst ein und aus; Herkunft: docs/design/ART_LICENSES.md
  const MUSIC_KEY = 'cwMusic', MUSIC_IDX = 'cwMusicIdx', MUSIC_VOL = 0.3;
  const TRACKS = ['wintery-loop', 'dpstudio-crimson-ribbon', 'through-the-snow-slow', 'pulsebox-happy-jazz', 'winter-wind', 'atlasaudio-jazz', 'christmas-synths', 'dpstudio-winter-wonderland', 'through-the-snow', 'pulsebox-fun-jazz'];
  const musicOn = () => { try { return localStorage.getItem(MUSIC_KEY) === 'on'; } catch { return false; } };
  let au = null, musicWanted = false, musicErrors = 0, gestureWait = null;
  const trackIdx = () => { try { return Math.max(0, Number(localStorage.getItem(MUSIC_IDX)) || 0) % TRACKS.length; } catch { return 0; } };
  const nextIdx = () => { try { localStorage.setItem(MUSIC_IDX, String((trackIdx() + 1) % TRACKS.length)); } catch {} };
  function musicPlay() {
    if (!au) {
      au = new Audio(); au.preload = 'none'; au.volume = MUSIC_VOL; au.setAttribute('aria-hidden', 'true');
      au.addEventListener('ended', () => { musicErrors = 0; nextIdx(); if (musicWanted) musicPlay(); });
      au.addEventListener('error', () => { if (!musicWanted || ++musicErrors >= TRACKS.length) return; nextIdx(); setTimeout(() => musicWanted && musicPlay(), 500); });
    }
    const src = `/games/card-worlds/music/${TRACKS[trackIdx()]}.mp3`;
    if (!au.src.endsWith(src) || au.ended) au.src = src;
    const p = au.play();
    if (p?.catch) p.catch((e) => {
      // Browser verlangt erst eine Berührung: beim nächsten Tippen oder Klick starten
      if (e?.name !== 'NotAllowedError' || gestureWait) return;
      gestureWait = () => { document.removeEventListener('pointerdown', gestureWait, true); document.removeEventListener('keydown', gestureWait, true); gestureWait = null; if (musicWanted && au?.paused) musicPlay(); };
      document.addEventListener('pointerdown', gestureWait, true); document.addEventListener('keydown', gestureWait, true);
    });
  }
  function musicStop() {
    musicWanted = false;
    if (gestureWait) { document.removeEventListener('pointerdown', gestureWait, true); document.removeEventListener('keydown', gestureWait, true); gestureWait = null; }
    if (au) { au.pause(); au.removeAttribute('src'); au.load(); }
  }
  document.addEventListener('visibilitychange', () => { if (!au || !musicWanted) return; if (document.hidden) au.pause(); else musicPlay(); });
  function music(w) {
    const b = document.body, winter = !!w && w.game === 'all';
    let btn = document.getElementById('cw-music-toggle');
    if (!winter) { musicStop(); btn?.remove(); delete b.dataset.cwMusic; return; }
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'cw-music-toggle'; btn.type = 'button'; btn.textContent = '♪';
      btn.addEventListener('click', () => { const on = !musicOn(); try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch {} musicErrors = 0; music(current(last)); });
      b.appendChild(btn);
    }
    const on = musicOn();
    b.dataset.cwMusic = on ? 'on' : 'off';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? t('Musik ausschalten', 'Turn music off') : t('Musik einschalten', 'Turn music on'));
    btn.title = btn.getAttribute('aria-label');
    if (on && !musicWanted) { musicWanted = true; musicPlay(); }
    else if (!on && musicWanted) musicStop();
  }
  function apply(S) {
    last = S;
    const w = current(S), b = document.body;
    if (w) { b.dataset.cardWorld = w.id; b.dataset.cwFrame = w.frame; }
    else { delete b.dataset.cardWorld; delete b.dataset.cwFrame; }
    snow(w);
    music(w);
  }
  // Die Welt gilt nur für den Tisch, an dem man gerade sitzt (core.js: session, parked). Platz behalten, schon verlassen
  // (ein Raumstand kann nach dem Verlassen noch eintreffen) oder ein anderer Raum: Welt aus. raw merkt sich den letzten
  // Stand, damit enterGame() und returnToRoom() ihn nach der Join-Bestätigung anwenden können.
  const forTable = (S) => (S && typeof session !== 'undefined' && session && (!S.code || S.code === session.code) && !(typeof parked !== 'undefined' && parked) ? S : null);
  socket.on('state', (S) => { raw = S; apply(forTable(S)); });

  const swatch = (w) => `<span class="cwp-card" style="--c:${w.cols[0][1]};background-image:url('/games/card-worlds/art/${esc(w.id)}/0.svg')"></span>`;
  const pick = (w, selected) => `<button type="button" class="cwp-pick" data-card-world-pick="${esc(w.id)}" aria-pressed="${selected}">${swatch(w)}<span class="cwp-txt"><b>${esc(w.name)}</b><small>${esc(w.world)}</small></span></button>`;
  function controlsHTML(S) {
    if (!mod || !S?.you?.isHost || !mod.CARD_WORLD_GAMES.includes(S.game)) return '';
    const list = mod.worldsFor(S.game), own = list.filter((w) => w.game !== 'all'), winter = list.filter((w) => w.game === 'all');
    const sel = S.cardWorld || '';
    const off = !applies(S) ? `<p class="hint">${t('Kartenwelten gelten nur für die Classic-Variante. Diese Variante behält ihr eigenes Aussehen.', 'Card worlds apply to the Classic variant only. This variant keeps its own look.')}</p>` : '';
    return `<section class="cwp"><h3>${t('Kartenwelt', 'Card world')}</h3><p class="hint">${t('Nur Aussehen, für alle am Tisch. Geht auch mitten in der Runde.', 'Looks only, for everyone at the table. Works mid-round too.')}</p>${off}
      <div class="cwp-grid"><button type="button" class="cwp-pick cwp-std" data-card-world-pick="" aria-pressed="${!sel}"><span class="cwp-card cwp-none"></span><span class="cwp-txt"><b>${t('Standard', 'Standard')}</b><small>${t('Bisheriges Aussehen', 'Current look')}</small></span></button>${own.map((w) => pick(w, w.id === sel)).join('')}</div>
      <h4 class="cwp-sub">${t('Winter (alle drei Spiele)', 'Winter (all three games)')}</h4><div class="cwp-grid">${winter.map((w) => pick(w, w.id === sel)).join('')}</div></section>`;
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-card-world-pick]');
    if (!b || b.disabled) return;
    const id = b.dataset.cardWorldPick;
    const r = await send('setCardWorld', { world: id });
    if (r?.ok) b.closest('.cwp')?.querySelectorAll('[data-card-world-pick]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.cardWorldPick === id)));
  });
  // Tisch verlassen, geschlossen oder Startseite: Welt, Schnee und Musik sofort entfernen (kommt kein Raumstand mehr)
  const clear = () => apply(null);
  const reapply = () => apply(forTable(raw));
  return { controlsHTML, ready, clear, reapply, current: () => current(last), audio: () => au };
})();
