// B24 Adaptive Responsive UI – gemeinsame Laufzeithilfe.
// Ein einziger, pro Bildschirmbild gedrosselter Größen-Takt für die ganze Seite statt
// vieler Einzel-Listener. Das Layout selbst macht CSS (responsive.css); JavaScript
// hilft nur dort, wo Renderer echte Containergrößen brauchen.
//
// Öffentlich:  Responsive.size     'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl'
//              Responsive.orient   'portrait' | 'landscape'
//              Responsive.onResize(fn)       fn({ width, height, size, orient }) höchstens 1× pro Frame,
//                                            nur wenn sich die Layoutgröße ändert (nicht bei Tastatur)
//              Responsive.onChange(fn)       nur bei Wechsel der Größenklasse oder Ausrichtung
//              Responsive.observe(el, fn)    gemeinsamer ResizeObserver; liefert eine Abmeldefunktion
// Am <html>:   data-rs-size, data-rs-orient, --rs-vvh (sichtbare Höhe), --rs-kb (verdeckte Höhe
//              durch Bildschirmtastatur oder Browserleisten)
(() => {
  if (window.Responsive) return;
  const root = document.documentElement;
  // Grenzen passen zu den CSS-Stufen in responsive.css und den bestehenden 640/1100-px-Regeln.
  const SIZES = [['xs', 0], ['s', 375], ['m', 641], ['l', 1100], ['xl', 1800], ['xxl', 3000]];
  const resizeFns = new Set(), changeFns = new Set();
  const state = { width: 0, height: 0, size: '', orient: '', heightClass: '', aspect: '' };
  let keyboardInset = 0;
  const call = (fns, arg) => { for (const fn of fns) { try { fn(arg); } catch (e) { setTimeout(() => { throw e; }); } } };

  function update() {
    const vv = window.visualViewport;
    const width = innerWidth, height = innerHeight;
    let size = 'xs';
    for (const [name, min] of SIZES) if (width >= min) size = name;
    const orient = width >= height ? 'landscape' : 'portrait';
    const heightClass = height <= 560 ? 'short' : height <= 740 ? 'compact' : 'normal';
    const aspect = width >= height * 2 ? 'ultrawide' : orient;
    const visible = vv ? vv.height : height;
    const inset = Math.max(0, Math.round(height - visible - (vv?.offsetTop || 0)));
    const editable = document.activeElement?.matches?.('textarea, input:not([type=button]):not([type=range]):not([type=checkbox]), [contenteditable=true]');
    const probableKeyboard = editable && (vv?.scale ?? 1) === 1 && inset >= 110;
    const nextKeyboardInset = probableKeyboard ? inset : 0;
    root.style.setProperty('--rs-vvh', Math.round(visible) + 'px');
    root.style.setProperty('--rs-kb', nextKeyboardInset + 'px');
    root.dataset.rsKeyboard = probableKeyboard ? 'open' : 'closed';
    if (nextKeyboardInset && Math.abs(nextKeyboardInset - keyboardInset) > 10) {
      document.activeElement.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    keyboardInset = nextKeyboardInset;
    const changed = size !== state.size || orient !== state.orient || heightClass !== state.heightClass || aspect !== state.aspect;
    // Nur echte Layoutänderungen melden. Eine Bildschirmtastatur (visualViewport)
    // ändert allein --rs-vvh/--rs-kb, damit Renderer nicht während der Eingabe neu zeichnen.
    const resized = width !== state.width || height !== state.height;
    Object.assign(state, { width, height, size, orient, heightClass, aspect });
    if (changed) {
      root.dataset.rsSize = size;
      root.dataset.rsOrient = orient;
      root.dataset.rsHeight = heightClass;
      root.dataset.rsAspect = aspect;
    }
    if (resized) call(resizeFns, { ...state });
    if (changed) call(changeFns, { ...state });
  }

  let frame = 0;
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
  addEventListener('resize', schedule, { passive: true });
  addEventListener('orientationchange', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });

  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
  addEventListener('focusin', schedule, { passive: true });
  addEventListener('focusout', schedule, { passive: true });

  // Ein gemeinsamer Beobachter für alle Renderer, keine Beobachter pro Karte oder Feld.
  const watched = new Map();
  let observer = null;
  function observe(el, fn) {
    if (!el || typeof fn !== 'function') return () => {};
    observer ||= new ResizeObserver((entries) => {
      for (const entry of entries) call(watched.get(entry.target) || [], entry.contentRect);
    });
    if (!watched.has(el)) { watched.set(el, new Set()); observer.observe(el); }
    watched.get(el).add(fn);
    return () => {
      const fns = watched.get(el);
      if (!fns) return;
      fns.delete(fn);
      if (!fns.size) { watched.delete(el); observer.unobserve(el); }
    };
  }

  update();
  window.Responsive = {
    get size() { return state.size; },
    get orient() { return state.orient; },
    get width() { return state.width; },
    get height() { return state.height; },
    get heightClass() { return state.heightClass; },
    get aspect() { return state.aspect; },
    onResize(fn) { resizeFns.add(fn); return () => resizeFns.delete(fn); },
    onChange(fn) { changeFns.add(fn); return () => changeFns.delete(fn); },
    observe,
  };
})();
