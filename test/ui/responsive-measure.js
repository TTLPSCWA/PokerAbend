// B24: gemeinsame Viewport-Liste und Layoutmessung für Audit und Regression.
export const VIEWPORTS = [
  { key: '320x568', width: 320, height: 568 },
  { key: '360x800', width: 360, height: 800 },
  { key: '390x844', width: 390, height: 844 },
  { key: '641x720', width: 641, height: 720 },
  { key: '768x1024', width: 768, height: 1024 },
  { key: '900x450', width: 900, height: 450 },
  { key: '1024x768', width: 1024, height: 768 },
  { key: '1280x720', width: 1280, height: 720 },
  { key: '1440x900', width: 1440, height: 900 },
  { key: '1682x864', width: 1682, height: 864 },
  { key: '1920x1080', width: 1920, height: 1080 },
  { key: '2560x1440', width: 2560, height: 1440 },
  { key: '3440x1440', width: 3440, height: 1440 },
  { key: '5120x1440', width: 5120, height: 1440 },
  // 200 % Browser-Zoom halbiert die CSS-Pixel: 1280×720 → 640×360, 1920×1080 → 960×540.
  { key: 'zoom200-640x360', width: 640, height: 360, zoom: true },
  { key: 'zoom200-960x540', width: 960, height: 540, zoom: true },
];

// Läuft im Browser (page.evaluate). Muss in sich geschlossen bleiben.
// overflow:  horizontales Seiten-Scrollen
// clipped:   sichtbare, bedienbare Elemente, die über den Viewport-Rand oder
//            einen nicht scrollbaren, abschneidenden Vorfahren hinausragen
// covered:   Elemente im Bild, deren Mittelpunkt von etwas Fremdem überdeckt ist
// unreachable: Elemente in fixierten Ebenen (Dialoge, Leisten), die unterhalb
//            oder oberhalb des Viewports liegen und nicht erscrollbar sind
export function measureLayout() {
  const W = innerWidth, H = innerHeight, doc = document.documentElement;
  const SEL = 'button,a[href],input:not([type=hidden]),select,textarea,[role=button],[tabindex]:not([tabindex="-1"])';
  const visible = (e) => {
    if (!e.getClientRects().length) return false;
    // checkVisibility erkennt auch Inhalte geschlossener <details> (content-visibility).
    if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true, opacityProperty: true, visibilityProperty: true })) return false;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const label = (e) => (e.getAttribute('aria-label') || e.textContent || e.value || e.className || e.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 40);
  const path = (e) => {
    const parts = [];
    for (let n = e; n && n !== document.body && parts.length < 4; n = n.parentElement) {
      parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (n.classList[0] ? '.' + n.classList[0] : ''));
    }
    return parts.join('>');
  };
  const scrollable = (n) => {
    const s = getComputedStyle(n);
    const x = /(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1;
    const y = /(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1;
    return { x, y, any: /(auto|scroll)/.test(s.overflowX + s.overflowY) };
  };
  const inFixedLayer = (e) => {
    for (let n = e; n; n = n.parentElement) {
      if (n.tagName === 'DIALOG' && n.open) return n;
      const p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return n;
    }
    return null;
  };
  const clipped = [], covered = [], unreachable = [], empty = [];
  const root = document.querySelector('dialog[open]') || document.body;
  for (const e of root.querySelectorAll(SEL)) {
    if (!visible(e) || e.disabled || e.closest('[inert],[aria-hidden=true]')) continue;
    const r = e.getBoundingClientRect();
    // leer: sichtbarer Knopf ohne sichtbaren Text und ohne sichtbares Symbol/Bild
    if (e.matches('.btn,.nav-btn,.icon-btn,.tab-item') && !(e.innerText ?? e.textContent ?? '').trim() && ![...e.querySelectorAll('svg,img,canvas,i,span,b')].some((c) => { const b = c.getBoundingClientRect(); return b.width > 4 && b.height > 4 && getComputedStyle(c).visibility !== 'hidden'; }) && !/(kc|die|vg-col|cell|tile|disc|field|pt|sq|square)/.test(e.className.baseVal ?? e.className) && !getComputedStyle(e).backgroundImage.includes('url') && !['::before', '::after'].some((p) => { const s = getComputedStyle(e, p); return s.content !== 'none' && s.content !== 'normal' && (parseFloat(s.width) > 4 || s.content.length > 2 || s.backgroundImage !== 'none' || s.maskImage !== 'none'); })) empty.push({ el: path(e), label: label(e) });
    // horizontal am Viewport abgeschnitten (ohne scrollbaren Vorfahren)
    let scrollX = false, scrollY = false, clipBox = { l: -1, r: W + 1, t: -Infinity, b: Infinity }, clipBy = 'viewport';
    for (let n = e.parentElement; n && n !== doc; n = n.parentElement) {
      const sc = scrollable(n);
      if (sc.any) { scrollX ||= sc.x; scrollY ||= sc.y; if (sc.x || sc.y) break; }
      const s = getComputedStyle(n);
      if (/(hidden|clip)/.test(s.overflowX + s.overflowY) && !sc.any) {
        const b = n.getBoundingClientRect();
        const before = JSON.stringify(clipBox);
        if (/(hidden|clip)/.test(s.overflowX)) { clipBox.l = Math.max(clipBox.l, b.left - 1); clipBox.r = Math.min(clipBox.r, b.right + 1); }
        if (/(hidden|clip)/.test(s.overflowY)) { clipBox.t = Math.max(clipBox.t, b.top - 1); clipBox.b = Math.min(clipBox.b, b.bottom + 1); }
        if (JSON.stringify(clipBox) !== before && (r.left < clipBox.l - 2 || r.right > clipBox.r + 2 || r.top < clipBox.t - 2 || r.bottom > clipBox.b + 2) && clipBy === 'viewport') clipBy = path(n);
      }
    }
    const tol = 2;
    const outX = !scrollX && (r.left < clipBox.l - tol || r.right > clipBox.r + tol);
    const outY = !scrollY && (r.top < clipBox.t - tol || r.bottom > clipBox.b + tol);
    if (outX || outY) clipped.push({ el: path(e), label: label(e), by: clipBy, box: [clipBox.l, clipBox.t, clipBox.r, clipBox.b].map((v) => (Number.isFinite(v) ? Math.round(v) : null)), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
    // fixierte Ebenen: unter-/oberhalb des Viewports, ohne Scrollmöglichkeit
    const layer = inFixedLayer(e);
    if (layer && !scrollY && (r.bottom > H + tol || r.top < -tol)) unreachable.push({ el: path(e), label: label(e), r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] });
    // überdeckt (nur Elemente im sichtbaren Bereich)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    // In einem scrollbaren Vorfahren nur aus dem Bild gescrollt? Dann nicht „verdeckt“.
    let inView = true;
    for (let n = e.parentElement; n && n !== doc && inView; n = n.parentElement) {
      if (!scrollable(n).any) continue;
      const b = n.getBoundingClientRect();
      inView = cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom;
    }
    if (inView && cx > 0 && cx < W && cy > 0 && cy < H) {
      const hit = document.elementFromPoint(cx, cy);
      if (hit && hit !== e && !e.contains(hit) && !hit.contains(e)) {
        const hitLayer = inFixedLayer(hit);
        if (hitLayer && hitLayer !== layer && !hit.closest('.toast,#toast,[role=tooltip]')) {
          // Nur dauerhaft verdeckt zählt: lässt sich das Element unter der
          // fixierten Leiste hervorscrollen, ist es erreichbar.
          const lb = hitLayer.getBoundingClientRect(), sc = document.scrollingElement;
          const below = sc.scrollHeight - (sc.scrollTop + H), above = sc.scrollTop;
          const needDown = r.bottom - lb.top, needUp = lb.bottom - r.top;
          const fixable = (lb.top > H / 2 && below >= needDown) || (lb.bottom < H / 2 && above >= needUp);
          if (!fixable) covered.push({ el: path(e), label: label(e), by: path(hit) });
        }
      }
    }
  }
  const overflow = Math.max(doc.scrollWidth, document.body.scrollWidth) > W + 1;
  const culprits = [];
  if (overflow) {
    for (const e of document.body.querySelectorAll('*')) {
      if (culprits.length >= 6 || !e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.right <= W + 1 || r.width < 2) continue;
      let contained = false;
      for (let n = e.parentElement; n && n !== doc; n = n.parentElement) {
        const s = getComputedStyle(n);
        if (!/visible/.test(s.overflowX)) { contained = true; break; }
      }
      if (!contained && !(e.parentElement && e.parentElement.getBoundingClientRect().right > W + 1)) culprits.push({ el: path(e), right: Math.round(r.right) });
    }
  }
  return {
    overflow, culprits,
    scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth),
    clipped: clipped.slice(0, 15), clippedCount: clipped.length,
    covered: covered.slice(0, 10), coveredCount: covered.length,
    unreachable: unreachable.slice(0, 10), unreachableCount: unreachable.length,
    empty: empty.slice(0, 10), emptyCount: empty.length,
  };
}
