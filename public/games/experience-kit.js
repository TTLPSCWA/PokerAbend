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
    if (r) { r.classList.remove('xp-hold'); delete r.dataset.xp; r.querySelector(':scope > .xp-layer')?.remove(); }
  }
  // Ebene über dem Tisch für kurzlebige Zutaten (Plakette, Konfetti). Sie verschwindet mit dem nächsten Zustand.
  const layer = () => {
    const r = root(); if (!r) return null;
    let el = r.querySelector(':scope > .xp-layer');
    if (!el) { el = host.document.createElement('div'); el.className = 'xp-layer'; el.setAttribute('aria-hidden', 'true'); r.append(el); }
    return el;
  };
  const place = (el, anchor) => { const c = centre(anchor) || { x: host.innerWidth / 2, y: host.innerHeight / 2 }; el.style.left = c.x + 'px'; el.style.top = c.y + 'px'; };
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
    // Würfel kippt in seine bestätigte Augenzahl; die Augen selbst ändern sich dabei nicht.
    tumble(el, { duration = 480, delay = 0 } = {}) {
      return plans.frames(el, [{ transform: 'rotate(-160deg) scale(.85)' }, { transform: 'rotate(18deg) scale(1.06)', offset: 0.75 }, { transform: 'none' }], { duration, delay });
    },
    // Figur hüpft über Zwischenpunkte (Viewport-Punkte oder Elemente) bis zu ihrem bestätigten Platz.
    hop(el, path, { step = 150, height = 9, delay = 0 } = {}) {
      return (m) => {
        const base = m.base(el), end = centre(el), points = path.map(centre), n = Math.max(1, points.length - 1), frames = [];
        const at = (p, lift = 0, scale = 1) => `translate(${p.x - end.x}px, ${p.y - end.y - lift}px) ${base.transform}${scale === 1 ? '' : ` scale(${scale})`}`.trim();
        points.forEach((p, k) => {
          frames.push({ transform: at(p), offset: k / n });
          if (k < n) { const q = points[k + 1]; frames.push({ transform: at({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, height, 1.06), offset: (k + 0.5) / n }); }
        });
        if (points.length < 2) frames.push({ transform: base.transform || 'none', offset: 1 });
        return { el, final: base.inline, frames, duration: Math.min(1500, n * step), delay };
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
  // Plakette über dem Tisch (z. B. „Glückspilz“): eigenes Material aus EXP-F3 mit Text, erscheint kurz und verschwindet von selbst.
  const plaque = (text, { anchor, ms = 2200, material = 'plakette', cls = '' } = {}) => {
    const box = layer(); if (!box) return null;
    const el = host.document.createElement('div');
    el.className = `xp-plaque ${cls}`.trim(); place(el, anchor);
    const label = host.document.createElement('b'); label.textContent = text; el.append(label);
    box.append(el);
    if (material) import('/material/index.js').then((m) => m.createMaterial(material, { label: text })).then((svg) => { if (el.isConnected) el.prepend(svg); }).catch(() => {});
    run(plans.frames(el, [{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420 }));
    later(() => el.remove(), ms);
    return el;
  };
  // Kleines Konfetti an einer Stelle (z. B. am eigenen Haus), höchstens 16 Teile, nur transform/opacity.
  const confetti = (anchor, { count = 12, colors = ['#e3bd72', '#76ac99', '#f2e8c8'], spread = 70 } = {}) => {
    const box = layer(); if (!box || !animated(latest)) return;
    const items = Array.from({ length: Math.min(16, count) }, (_, i) => {
      const el = host.document.createElement('i');
      el.className = 'xp-confetti'; el.style.background = colors[i % colors.length]; place(el, anchor);
      box.append(el);
      const angle = (i / count) * Math.PI * 2, dx = Math.cos(angle) * spread * (0.6 + (i % 3) * 0.2), dy = Math.sin(angle) * spread * 0.6 - spread * 0.5;
      return plans.frames(el, [{ transform: 'translate(0,0) scale(.4)', opacity: 0 }, { transform: `translate(${dx * 0.7}px, ${dy}px) rotate(${i * 40}deg)`, opacity: 1, offset: 0.35 }, { transform: `translate(${dx}px, ${dy + spread * 1.3}px) rotate(${180 + i * 50}deg)`, opacity: 0 }], { duration: 1100, delay: (i % 4) * 30 });
    });
    run(items).then(() => { for (const el of box.querySelectorAll('.xp-confetti')) el.remove(); });
  };
  // Neue Sprechblasen-Aktionen seit dem vorigen Zustand (kit: acts[id] = { text, n }).
  const newActs = (view, prev) => {
    const seen = Math.max(0, ...Object.values(prev?.acts || {}).map((a) => a.n));
    return Object.entries(view?.acts || {}).filter(([, a]) => a.n > seen).sort((a, b) => a[1].n - b[1].n).map(([id, a]) => ({ id, text: a.text, n: a.n }));
  };
  const api = (view, prev = null) => ({
    id, view, prev, fresh: !!prev, root: root(), plans, run, play, highlight, later, plaque, confetti,
    acts: prev ? newActs(view, prev) : [],
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
    // Für Tests und Nachweise: zeigt einen Wechsel prev → view auf dem aktuellen Tisch (nur Darstellung, mit Ton).
    // Der Tisch selbst bleibt beim bestätigten Serverzustand.
    present(prev, view = latest) {
      if (!view || !prev) return false;
      const m = table();
      m.finish();
      m.update(view, () => { def.change?.(view, prev, api(view, prev)); }, { spectator: false, paused: false });
      shown = { prev, view, at: host.performance.now() };
      return true;
    },
    // Für Messungen: die zuletzt gezeigte Änderung ohne Ton noch einmal abspielen (nur Darstellung).
    replay() {
      if (!shown || !latest) return false;
      const m = table(), view = shown.view || latest, from = shown.prev;
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
