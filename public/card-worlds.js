'use strict';
// ART-T1 Kartenwelten: Der Host wählt für UNO (Classic), Skip-Bo und Phase 10 eine Welt; sie gilt für alle am Tisch.
// Nur Darstellung. Seit ART-W0 laufen Auswahl, Anwenden und Aufräumen über den gemeinsamen Lebenszyklus (theme-worlds.js):
// Diese Datei meldet die Art „card“ (body[data-card-world], body[data-cw-frame]) und die Effekte „snow“ und „music“ an
// und liefert die Auswahl im Host-Menü (kit.js). Daten: /games/card-worlds/worlds.js (über die Registry auch vom Server geprüft).
const CardWorlds = (() => {
  let mod = null, lastAudio = null;
  const t = (de, en) => (I18n.language === 'en' ? en : de);
  const loaded = import('/games/card-worlds/worlds.js').then((m) => { mod = m; return m; }).catch(() => null);
  const ready = Promise.all([loaded, ThemeWorlds.ready]).then(([m]) => m);
  // UNO-Varianten mit eigener Gestaltung (Flip, No Mercy, All Wild, Spuknacht) behalten ihr Aussehen (Registry: variants)
  const applies = (S) => !!S && (S.game !== 'farbenchaos' || (S.variant || 'classic') === 'classic');

  ThemeWorlds.kind('card', {
    activate(ctx) { ctx.scope.data(document.body, 'cardWorld', ctx.world.id); ctx.scope.data(document.body, 'cwFrame', ctx.world.card.frame); },
  });

  // ART-T5 Schneefall: ruhige Hintergrundbewegung nur in Winterwelten, pro Gerät abschaltbar (localStorage, Standard: an)
  const SNOW_KEY = 'cwSnow';
  const snowOn = () => { try { return localStorage.getItem(SNOW_KEY) !== 'off'; } catch { return true; } };
  ThemeWorlds.effect('snow', {
    activate(ctx) {
      const layer = document.createElement('div'); layer.id = 'cw-snow'; layer.setAttribute('aria-hidden', 'true'); layer.innerHTML = '<i></i><i></i><i></i>';
      ctx.scope.el(layer);
      const btn = document.createElement('button'); btn.id = 'cw-snow-toggle'; btn.type = 'button'; btn.textContent = '❄';
      ctx.scope.on(btn, 'click', () => { const on = !snowOn(); try { localStorage.setItem(SNOW_KEY, on ? 'on' : 'off'); } catch {} ctx.refresh(); });
      ctx.scope.el(btn);
      return { btn };
    },
    update(ctx, st) {
      const on = snowOn();
      ctx.scope.data(document.body, 'cwSnow', on ? 'on' : 'off');
      st.btn.setAttribute('aria-pressed', String(on));
      st.btn.setAttribute('aria-label', on ? t('Schneefall ausschalten', 'Turn snowfall off') : t('Schneefall einschalten', 'Turn snowfall on'));
      st.btn.title = st.btn.getAttribute('aria-label');
    },
  });

  // ART-T6 Wintermusik: nur in Winterwelten, eigener Knopf neben dem Schnee-Knopf, pro Gerät gespeichert (Standard: aus).
  // Wiedergabeliste aus /games/card-worlds/music/, leise, die Stücke blenden selbst ein und aus; Herkunft: docs/design/ART_LICENSES.md
  const MUSIC_KEY = 'cwMusic', MUSIC_IDX = 'cwMusicIdx', MUSIC_VOL = 0.3;
  const TRACKS = ['wintery-loop', 'dpstudio-crimson-ribbon', 'through-the-snow-slow', 'pulsebox-happy-jazz', 'winter-wind', 'atlasaudio-jazz', 'christmas-synths', 'dpstudio-winter-wonderland', 'through-the-snow', 'pulsebox-fun-jazz'];
  const musicOn = () => { try { return localStorage.getItem(MUSIC_KEY) === 'on'; } catch { return false; } };
  const trackIdx = () => { try { return Math.max(0, Number(localStorage.getItem(MUSIC_IDX)) || 0) % TRACKS.length; } catch { return 0; } };
  const nextIdx = () => { try { localStorage.setItem(MUSIC_IDX, String((trackIdx() + 1) % TRACKS.length)); } catch {} };
  function musicPlay(st, scope) {
    if (!scope.open || !st.wanted) return;
    if (!st.au) {
      st.au = scope.audio(new Audio()); st.au.preload = 'none'; st.au.volume = MUSIC_VOL; st.au.setAttribute('aria-hidden', 'true'); lastAudio = st.au;
      scope.on(st.au, 'ended', () => { st.errors = 0; nextIdx(); if (st.wanted) musicPlay(st, scope); });
      scope.on(st.au, 'error', () => { if (!st.wanted || ++st.errors >= TRACKS.length) return; nextIdx(); scope.timeout(() => musicPlay(st, scope), 500); });
    }
    const src = `/games/card-worlds/music/${TRACKS[trackIdx()]}.mp3`;
    if (!st.au.src.endsWith(src) || st.au.ended) st.au.src = src;
    const p = st.au.play();
    if (p?.catch) p.catch((e) => {
      // Browser verlangt erst eine Berührung: beim nächsten Tippen oder Klick starten
      if (e?.name !== 'NotAllowedError' || st.gesture) return;
      const go = () => { st.gestureOff?.(); if (st.wanted && st.au?.paused) musicPlay(st, scope); };
      const offDown = scope.on(document, 'pointerdown', go, true), offKey = scope.on(document, 'keydown', go, true);
      st.gesture = go; st.gestureOff = () => { offDown(); offKey(); st.gesture = null; st.gestureOff = null; };
    });
  }
  function musicStop(st) {
    st.wanted = false;
    st.gestureOff?.();
    if (st.au) { st.au.pause(); st.au.removeAttribute('src'); st.au.load(); }
  }
  ThemeWorlds.effect('music', {
    activate(ctx) {
      const st = { au: null, wanted: false, errors: 0, gesture: null, suspended: false };
      const btn = document.createElement('button'); btn.id = 'cw-music-toggle'; btn.type = 'button'; btn.textContent = '♪';
      ctx.scope.on(btn, 'click', () => { const on = !musicOn(); try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch {} st.errors = 0; ctx.refresh(); });
      ctx.scope.el(btn); st.btn = btn;
      ctx.scope.on(document, 'visibilitychange', () => { if (!st.au || !st.wanted) return; if (document.hidden) st.au.pause(); else musicPlay(st, ctx.scope); });
      return st;
    },
    update(ctx, st) {
      const on = musicOn();
      ctx.scope.data(document.body, 'cwMusic', on ? 'on' : 'off');
      st.btn.setAttribute('aria-pressed', String(on));
      st.btn.setAttribute('aria-label', on ? t('Musik ausschalten', 'Turn music off') : t('Musik einschalten', 'Turn music on'));
      st.btn.title = st.btn.getAttribute('aria-label');
      if (on && !st.wanted) { st.wanted = true; st.suspended = false; musicPlay(st, ctx.scope); }
      else if (on && st.suspended) { st.suspended = false; if (!document.hidden) musicPlay(st, ctx.scope); }
      else if (!on && st.wanted) musicStop(st);
    },
    suspend(ctx, st) { if (st.au && st.wanted) { st.au.pause(); st.suspended = true; } },
    deactivate(ctx, st) { musicStop(st); },
  });

  const swatch = (w) => `<span class="cwp-card" style="--c:${w.cols[0][1]};background-image:url('/games/card-worlds/art/${esc(w.id)}/0.svg')"></span>`;
  const pick = (w, selected) => `<button type="button" class="cwp-pick" data-card-world-pick="${esc(w.id)}" aria-pressed="${selected}">${swatch(w)}<span class="cwp-txt"><b>${esc(w.name)}</b><small>${esc(w.world)}</small></span></button>`;
  function controlsHTML(S) {
    if (!mod || !S?.you?.isHost) return '';
    if (!mod.CARD_WORLD_GAMES.includes(S.game)) return ThemeWorlds.controlsHTML(S); // andere Spiele: allgemeine Themenwelten (heute keine)
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
  const clear = () => ThemeWorlds.cleanup();
  const reapply = () => ThemeWorlds.reapply();
  const current = () => { const w = ThemeWorlds.current(); return w && w.kind === 'card' && mod ? mod.WORLDS.find((x) => x.id === w.id) || null : null; };
  return { controlsHTML, ready, clear, reapply, current, audio: () => lastAudio };
})();
