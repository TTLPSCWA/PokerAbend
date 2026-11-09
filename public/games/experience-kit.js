// EXP-Spielpakete: verbindet das Erlebnis-Modul eines Spiels (/games/<id>/experience.js) mit kit.js.
// Nur Darstellung: Klang (EXP-F1), Bewegung (EXP-F2) und Highlights zu Zuständen, die der Server bereits bestätigt hat.
//
// Ein Modul exportiert als default:
//   palette   Klangpalette (public/sound/palettes/<name>.js), ambient optional (Szene aus EXP-F5)
//   winner    Optionen für configureWinnerWorld (EXP-F4)
//   key(view)               → Kennung des Darstellungsstands; ein Zustand mit gleicher Kennung gilt als Wiederholung
//   finale(view, prev)      → Millisekunden, wenn dieser Zustandswechsel ein Highlight am Spielende ist (Ergebnisfenster wartet so lange)
//   still(view, x)          → nach jedem Zeichnen: statische Zustände (z. B. Mattbild nach Neuladen), ohne Bewegung und Ton
//   change(view, prev, x)   → nur bei einem frischen, bestätigten Zustandswechsel: Töne und Bewegungen
//   select    CSS-Selektor: eigene Auswahl (Antippen) bekommt den Ton `select`
//   interval { ms, run(view, x) } → läuft, solange der Tisch sichtbar spielt (z. B. Uhr-Ticken)
import Motion from '/motion/motion.js';
import { EXPERIENCES } from '/games/experience-index.js';

const stylesheet = (href) => {
  if (document.querySelector(`link[data-xp-css="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href; link.dataset.xpCss = href;
  document.head.append(link);
};
const centre = (target) => {
  if (target?.getBoundingClientRect) { const r = target.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  return target;
};

export function createExperience(id, def, host = globalThis) {
  const root = () => host.document.querySelector('#kg');
  const io = () => (typeof socket === 'undefined' ? null : socket);
  const roomCode = () => (typeof session === 'undefined' ? null : session?.code) ?? null;
  let code = null, motion = null, pending = null, quiet = true, latest = null, bound = false, ticker = null;
  let holdUntil = 0, holdView = null, holdFresh = false;
  let generation = 0, shownKey = null, shown = null, muted = false;
  const timers = new Set();

  const later = (fn, ms) => {
    const token = generation;
    const timer = host.setTimeout(() => { timers.delete(timer); if (generation === token && root()?.isConnected && roomCode() === code) fn(); }, ms);
    timers.add(timer);
    return timer;
  };
  function settle() {
    for (const timer of timers) host.clearTimeout(timer);
    timers.clear();
    holdUntil = 0; holdView = null; holdFresh = false;
    const r = root();
    if (r) { r.classList.remove('xp-hold'); delete r.dataset.xp; }
  }
  const table = () => {
    if (!motion || motion.disposed) motion = Motion.table('xp:' + id + ':' + code, { root: root() || host.document.body });
    return motion;
  };
  const reduced = () => table().reduceMotion();
  const animated = (view) => !view?.gamePaused && !host.document.hidden && !reduced();
  const play = (event, opts = {}) => {
    if (!def.palette || muted) return false;
    const { after = 0, ...rest } = opts;
    if (after > 0) { later(() => host.Sound?.play(event, rest), after); return true; }
    return host.Sound?.play(event, rest);
  };

  // Ein Plan beschreibt eine Bewegung; mehrere Pläne in einem run() laufen gleichzeitig (z. B. Rochade).
  const plans = {
    // Element steht schon am Ziel (vom Server bestätigt) und gleitet sichtbar von `from` dorthin.
    glide(el, from, { duration = 320, delay = 0, lift = 0 } = {}) {
      return (m) => {
        const base = m.base(el), a = centre(from), b = centre(el), dx = a.x - b.x, dy = a.y - b.y;
        const start = `translate(${dx}px, ${dy}px) ${base.transform}`.trim(), end = base.transform || 'none';
        const frames = lift ? [{ transform: start }, { transform: `translate(${dx / 2}px, ${dy / 2 - lift}px) ${base.transform} scale(1.08)`.trim(), offset: 0.5 }, { transform: end }] : [{ transform: start }, { transform: end }];
        return { el, final: base.inline, frames, duration, delay };
      };
    },
    // Frei wählbare Schlüsselbilder relativ zum fertigen Zustand; `final` bleibt immer der bestätigte Zustand.
    frames(el, list, { duration = 360, delay = 0 } = {}) {
      return (m) => {
        const base = m.base(el);
        return { el, final: base.inline, duration, delay, frames: list.map((f) => ({ ...f, ...(f.transform !== undefined ? { transform: f.transform === 'none' ? (base.transform || 'none') : `${base.transform} ${f.transform}`.trim() } : {}) })) };
      };
    },
  };
  const run = (list, opts = {}) => {
    const m = table(), items = (Array.isArray(list) ? list : [list]).filter(Boolean);
    return m.enqueue(() => items.map((build) => build(m)).filter((plan) => plan?.el?.isConnected), opts);
  };
  // Kurzes, nicht blockierendes Highlight: CSS reagiert auf [data-xp="<name>"] am Tisch oder an einem Bereich.
  // `on` begrenzt die Markierung auf einen Bereich (z. B. das Brett), damit der Browser nicht den ganzen Tisch neu bewerten muss.
  const highlight = (name, ms = 1600, on = root()) => {
    if (!on) return;
    on.dataset.xp = name;
    later(() => { if (on.dataset.xp === name) delete on.dataset.xp; }, ms);
  };
  const api = (view, prev = null) => ({
    id, view, prev, fresh: !!prev, root: root(), plans, run, play, highlight, later,
    get motion() { return table(); },
    get animated() { return animated(view); },
    get reduced() { return reduced(); },
    $: (selector) => root()?.querySelector(selector) || null,
    $$: (selector) => Array.from(root()?.querySelectorAll(selector) || []),
  });

  function bind() {
    const s = io(); if (bound || !s) return;
    bound = true;
    // Nach einem Verbindungsabbruch gilt der nächste vollständige Zustand als Ausgangslage: kein Ton, keine Bewegung.
    const lost = () => { quiet = true; settle(); motion?.setMode({ reconnecting: true }); };
    s.on('disconnect', lost); s.on('connect', lost);
    // Auswahl-Ton für die eigene Bedienung (kein Spielereignis): `select` ist ein CSS-Selektor innerhalb von #kg.
    if (def.select && def.palette) host.document.addEventListener('pointerdown', (event) => {
      const r = root();
      if (r?.dataset.xpKit === id && roomCode() === code && r.contains(event.target) && event.target.closest?.(def.select)) host.Sound?.play('select');
    }, { passive: true });
  }
  function enter() {
    bind();
    const r = root(); if (r) r.dataset.xpKit = id;
    if (def.palette) host.Sound?.use(def.palette);
    if (def.ambient) host.Sound?.ambient(def.ambient);
    if (def.interval && !ticker) ticker = host.setInterval(() => {
      const view = latest;
      if (!view || roomCode() !== code || !root()?.isConnected || root().closest('[hidden]') || host.document.hidden || view.gamePaused || view.phase !== 'playing') return;
      def.interval.run(view, api(view));
    }, def.interval.ms);
  }

  return {
    ownsSound: !!def.palette,
    // Für Messungen: die zuletzt gezeigte Änderung ohne Ton noch einmal abspielen (nur Darstellung).
    replay() {
      if (!shown || !latest) return false;
      const m = table(), view = latest, from = shown.prev;
      m.finish();
      m.update(view, () => { def.still?.(view, api(view)); muted = true; try { def.change?.(view, from, api(view, from)); } finally { muted = false; } }, { spectator: false, paused: !!view.gamePaused });
      return true;
    },
    enter,
    // „Du bist dran“ kommt aus der Palette statt aus dem alten Piepton.
    turn() { if (!def.palette) return false; host.Sound?.play('turn'); return true; },
    onState(view, prev) {
      // Derselbe Darstellungsstand noch einmal (der Server schickt z. B. das Rundenende doppelt): nichts abbrechen.
      // kit.js zeichnet trotzdem neu, deshalb läuft eine gerade begonnene Bewegung auf den neuen Elementen stumm noch einmal an.
      const key = def.key ? String(def.key(view)) : null;
      if (key !== null && key === shownKey && view.code === code && !quiet) {
        latest = view; if (holdView) holdView = view;
        pending = { view, prev: null, replay: shown && host.performance.now() - shown.at < 700 ? shown.prev : null };
        return;
      }
      settle(); generation++; shownKey = key; shown = null;
      if (view.code !== code) { if (motion) { Motion.release('xp:' + id + ':' + code); motion = null; } code = view.code; quiet = true; }
      const fresh = !!prev && prev.code === view.code && !quiet && io()?.connected !== false;
      quiet = false; latest = view;
      pending = { view, prev: fresh ? prev : null };
      if (fresh) shown = { prev, at: host.performance.now() };
      const wait = fresh && animated(view) ? Number(def.finale?.(view, prev)) || 0 : 0;
      if (wait > 0) {
        holdUntil = host.performance.now() + wait; holdView = view;
        root()?.classList.add('xp-hold');
        later(() => { root()?.classList.remove('xp-hold'); }, wait);
      }
    },
    // kit.js fragt beim Zeichnen des Ergebnisfensters, ob die Siegerbühne noch auf ein Highlight wartet.
    hold(view, fresh) {
      if (view !== holdView) return null;
      if (fresh) holdFresh = true;
      const wait = holdUntil - host.performance.now();
      return wait > 0 ? { wait, fresh: holdFresh } : null;
    },
    afterRender(view) {
      const r = root(); if (!r) return;
      r.dataset.xpKit = id;
      const x = api(view);
      if (pending?.view === view) {
        const { prev, replay } = pending; pending = null;
        const m = table(), from = prev || replay;
        m.finish(); // alte Bewegungen sofort auf ihren bestätigten Endstand, dann die neue Änderung zeigen
        m.update(view, () => {
          def.still?.(view, x);
          if (!from) return;
          muted = !prev; // Wiederholung: Töne liefen schon
          try { def.change?.(view, from, api(view, from)); } finally { muted = false; }
        }, { spectator: false, paused: !!view.gamePaused });
      } else def.still?.(view, x);
    },
  };
}

export async function attach(id) {
  if (!EXPERIENCES.includes(id)) return null;
  stylesheet('/games/experience-kit.css');
  const def = (await import(`/games/${id}/experience.js`)).default;
  if (def.css !== false) stylesheet(`/games/${id}/experience.css`);
  if (def.winner) globalThis.configureWinnerWorld?.(id, def.winner);
  const experience = createExperience(id, def);
  (globalThis.__experiences ||= {})[id] = experience;
  return experience;
}
