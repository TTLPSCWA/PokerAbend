'use strict';
// ART-W0: Lebenszyklus der Themenwelten im Browser: activate → update → deactivate → cleanup.
// Eine Stelle entscheidet, welche Welt am aktuellen Tisch gilt (Raumstand, Registry, Spiel und Variante) und räumt alles wieder ab.
// Jede Welt und jeder Effekt (Schnee, Musik …) bekommt einen eigenen „Scope“, der DOM-Knoten, Attribute, Listener, Zeitgeber,
// Animationen, Beobachter und Audio verfolgt; cleanup() entfernt genau diese Dinge und ist beliebig oft aufrufbar.
// Effekte, die die neue Welt ebenfalls nutzt, bleiben beim Weltwechsel bestehen (z. B. Musik zwischen zwei Winterwelten).
// Die Kartenwelten (card-worlds.js) melden ihre Art „card“ und die Effekte „snow“ und „music“ hier an.
const ThemeWorlds = (() => {
  let reg = null, last = null, raw = null, active = null, suspended = false;
  const kinds = new Map(), effects = new Map(), failed = new Set();
  const stats = { activations: 0, deactivations: 0, updates: 0, fallbacks: 0 };

  // ---------- Scope: alles, was eine Welt oder ein Effekt anlegt, wird hier eingetragen ----------
  function createScope(name = '') {
    const undo = new Set(); // Aufräumschritte; erledigte Einträge (Listener entfernt, Zeitgeber abgelaufen) verschwinden sofort wieder
    let open = true;
    const track = (fn) => { if (!open) { fn(); return () => {}; } undo.add(fn); return () => { if (undo.delete(fn)) fn(); }; };
    const forget = (fn) => undo.delete(fn);
    const scope = {
      name,
      get open() { return open; },
      size: () => undo.size,
      el(node, parent = document.body) { if (!open) return node; parent.appendChild(node); track(() => node.remove()); return node; },
      data(target, key, value) { if (!open) return; if (!(key in target.dataset)) track(() => { delete target.dataset[key]; }); target.dataset[key] = value; },
      cls(target, name) { if (!open || target.classList.contains(name)) return; target.classList.add(name); track(() => target.classList.remove(name)); },
      on(target, type, fn, opts) { if (!open) return () => {}; target.addEventListener(type, fn, opts); return track(() => target.removeEventListener(type, fn, opts)); },
      timeout(fn, ms) { const stop = () => clearTimeout(id); const id = setTimeout(() => { forget(stop); fn(); }, ms); track(stop); return id; },
      interval(fn, ms) { const id = setInterval(fn, ms); track(() => clearInterval(id)); return id; },
      raf(fn) { const stop = () => cancelAnimationFrame(id); const id = requestAnimationFrame((ts) => { forget(stop); fn(ts); }); track(stop); return id; },
      observer(obs) { track(() => obs.disconnect()); return obs; },
      audio(au) { track(() => { try { au.pause(); au.removeAttribute('src'); au.load(); } catch { /* bereits entladen */ } }); return au; },
      defer(fn) { return track(fn); },
      cleanup() { if (!open) return; open = false; for (const fn of [...undo].reverse()) { undo.delete(fn); try { fn(); } catch (e) { console.warn('Themenwelt: Aufräumen', e); } } },
    };
    return scope;
  }

  const t = (de, en) => (typeof I18n !== 'undefined' && I18n.language === 'en' ? en : de);
  const ctxOf = (world, S, scope) => ({ world, S, scope, t, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, refresh: () => apply(last) });
  // Welt gilt nur für den Tisch, an dem man gerade sitzt (core.js: session, parked); verspätete Stände anderer Räume ändern nichts
  const forTable = (S) => (S && typeof session !== 'undefined' && session && (!S.code || S.code === session.code) && !(typeof parked !== 'undefined' && parked) ? S : null);
  const resolve = (S) => {
    if (!reg || !S || !S.cardWorld) return null;
    const w = reg.worldFor(S.game, S.cardWorld);
    return w && reg.appliesTo(w, S.game, S.variant) && !failed.has(w.id) ? w : null;
  };

  // ---------- Effekte ----------
  function syncEffects(world, S) {
    const want = new Map((world?.effects || []).map((e) => [e.type, e]));
    for (const [type, inst] of [...(active?.effects || new Map())]) {
      if (want.has(type)) continue;
      try { inst.impl.deactivate?.(inst.ctx, inst.state); } finally { inst.ctx.scope.cleanup(); active.effects.delete(type); }
    }
    if (!world) return;
    for (const [type, opts] of want) {
      const impl = effects.get(type);
      if (!impl) continue; // Umsetzung (noch) nicht geladen: Welt bleibt ohne diesen Effekt nutzbar
      let inst = active.effects.get(type);
      if (!inst) { const ctx = { ...ctxOf(world, S, createScope('effect:' + type)), options: opts }; inst = { impl, ctx, state: impl.activate(ctx) }; active.effects.set(type, inst); }
      else Object.assign(inst.ctx, { world, S, options: opts });
      inst.impl.update?.(inst.ctx, inst.state);
      if (suspended) inst.impl.suspend?.(inst.ctx, inst.state);
    }
  }

  // ---------- Lebenszyklus ----------
  function activate(world, S, carried) {
    const scope = createScope('world:' + world.id);
    active = { world, scope, effects: carried || new Map(), kind: kinds.get(world.kind) };
    stats.activations++;
    scope.data(document.body, 'themeWorld', world.id);
    scope.data(document.body, 'themeKind', world.kind);
    for (const href of world.assets.css) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; scope.el(l, document.head); }
    active.kind?.activate?.(ctxOf(world, S, scope));
    checkAssets(world);
  }
  function update(S) {
    stats.updates++;
    active.kind?.update?.(ctxOf(active.world, S, active.scope));
    syncEffects(active.world, S);
  }
  function deactivate({ keep = null } = {}) {
    if (!active) return new Map();
    const a = active, carried = new Map();
    for (const [type, inst] of a.effects) { if (keep?.has(type)) carried.set(type, inst); else { try { inst.impl.deactivate?.(inst.ctx, inst.state); } finally { inst.ctx.scope.cleanup(); } } }
    try { a.kind?.deactivate?.(ctxOf(a.world, last, a.scope)); } finally { a.scope.cleanup(); }
    active = null; stats.deactivations++;
    return carried;
  }
  function apply(S) {
    last = S;
    const world = resolve(S);
    if (!world) { deactivate(); return; }
    if (active && active.world.id === world.id) { update(S); return; }
    const keep = new Set(world.effects.map((e) => e.type));
    const carried = deactivate({ keep });
    activate(world, S, carried);
    update(S);
  }
  // Fehlende Welt-Assets: zurück auf Standard (Welt für diese Seite gesperrt), kein halber Zustand
  function checkAssets(world) {
    const urls = world.assets.preload;
    if (!urls.length) return;
    for (const url of urls) {
      const img = new Image();
      img.onerror = () => { if (active?.world.id !== world.id) return; failed.add(world.id); stats.fallbacks++; console.warn('Themenwelt ' + world.id + ': Datei fehlt, Standarddesign aktiv (' + url + ')'); apply(last); };
      img.src = url;
    }
  }

  // Verbindung weg: Ton anhalten (wir wissen nicht, ob wir noch am Tisch sind); der nächste Raumstand setzt fort oder räumt ab
  function suspend() { suspended = true; for (const inst of active?.effects.values() || []) inst.impl.suspend?.(inst.ctx, inst.state); }

  const ready = import('/games/theme-worlds/registry.js').then((m) => { reg = m.themeRegistry(); apply(last); return m; }).catch((e) => { console.warn('Themenwelten nicht geladen', e); return null; });
  socket.on('state', (S) => { raw = S; suspended = false; apply(forTable(S)); });
  socket.on('disconnect', suspend);
  // Seite verlassen: alles abräumen (Rückkehr aus dem Zurück-Cache lädt core.js ohnehin neu)
  window.addEventListener('pagehide', () => apply(null));

  // Host-Menü für Spiele ohne eigene Kartenwelt-Auswahl: alle freigegebenen Themenwelten des Spiels (heute keine)
  function controlsHTML(S) {
    if (!reg || !S?.you?.isHost) return '';
    const list = reg.worldsFor(S.game); if (!list.length) return '';
    const sel = S.cardWorld || '', lang = typeof I18n !== 'undefined' && I18n.language === 'en' ? 'en' : 'de';
    const pick = (id, name, desc, on) => `<button type="button" class="cwp-pick" data-card-world-pick="${esc(id)}" aria-pressed="${on}"><span class="cwp-txt"><b>${esc(name)}</b><small>${esc(desc)}</small></span></button>`;
    return `<section class="cwp twp"><h3>${t('Themenwelt', 'Theme world')}</h3><p class="hint">${t('Nur Aussehen, für alle am Tisch.', 'Looks only, for everyone at the table.')}</p><div class="cwp-grid">${pick('', t('Standard', 'Standard'), t('Bisheriges Aussehen', 'Current look'), !sel)}${list.map((w) => pick(w.id, w.name[lang], w.description[lang], w.id === sel)).join('')}</div></section>`;
  }

  return {
    ready,
    controlsHTML,
    apply: (S) => apply(forTable(S)),
    reapply: () => apply(forTable(raw)),
    cleanup: () => apply(null),
    refresh: () => apply(last),
    current: () => active?.world || null,
    worldsFor: (game) => reg?.worldsFor(game) || [],
    kind: (name, impl) => { kinds.set(name, impl); if (active?.world.kind === name) apply(last); },
    effect: (type, impl) => { effects.set(type, impl); if (active) apply(last); },
    createScope,
    // Prüfhilfen für Tests (lesen nur Zustände, ändern nichts an der Auswahl)
    status: () => ({ world: active?.world.id || null, effects: [...(active?.effects.keys() || [])], scope: active?.scope.size() || 0, effectScopes: [...(active?.effects.values() || [])].reduce((n, i) => n + i.ctx.scope.size(), 0), failed: [...failed], suspended, ...stats }),
    useRegistry: (r) => { reg = r; failed.clear(); apply(last); },
  };
})();
