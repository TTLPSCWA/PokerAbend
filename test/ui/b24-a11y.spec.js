// B24/B07: Barrierefreiheit der Responsive-Schicht – Tastaturfokus, Touchziele, Safe Areas,
// Bildschirmtastatur/dynamische Höhe und vergrößerte Standardschrift. Gemessen, nicht behauptet:
// Safe Areas über die CDP-Emulation von Chrome, Schriftgröße über eine echte Firefox-Einstellung
// (Projekt „firefox-grossschrift“ in b24-browsers.config.js). Echte Geräte ersetzt das nicht.
import { test, expect, login } from './helpers.js';
import { VIEWPORTS, measureLayout } from './responsive-measure.js';

const emit = (page, event, data = {}) => page.evaluate(([e, d]) => send(e, d), [event, data]);
const problems = (m) => ({ overflow: m.overflow, clipped: m.clipped, covered: m.covered, unreachable: m.unreachable, empty: m.empty });
const clean = { overflow: false, clipped: [], covered: [], unreachable: [], empty: [] };
const project = (info) => info.project.name;
const isChromium = (info) => (info.project.use.browserName || 'chromium') === 'chromium';

async function startGame(page, id, players) {
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator(`[data-host="${id}"]`).first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe(id);
  await emit(page, 'sit', id === 'poker' ? { seat: 0 } : {});
  for (let i = 1; i < players; i++) expect((await emit(page, 'addBot'))?.ok).toBe(true);
  expect((await emit(page, 'start'))?.ok).toBe(true);
  await expect.poll(() => page.evaluate(() => lastState?.phase)).not.toBe('lobby');
}

test('B24 A11y Tastatur: Fokus erreicht Startseite und Spiel, bleibt im Bild und ist sichtbar markiert', async ({ page, app }, info) => {
  test.skip(project(info) !== 'desktop', 'Tastatur am PC, Standardbrowser');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app);
  const walk = async (label, steps) => {
    const issues = [];
    for (let i = 0; i < steps; i++) {
      await page.keyboard.press('Tab');
      const f = await page.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        const marked = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return { el: e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''),
          inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth, marked, size: [Math.round(r.width), Math.round(r.height)] };
      });
      if (f && (!f.inView || !f.marked) && f.size[0] > 1) issues.push(f);
    }
    expect(issues, `${label}: fokussierte Elemente außerhalb des Bildes oder ohne sichtbare Markierung`).toEqual([]);
  };
  await walk('Startseite', 30);
  await startGame(page, 'maumau', 3);
  await walk('Mau-Mau', 25);
});

test('B24 A11y Touchziele: Bedienelemente in Leiste, Kopf und Aktionsleiste sind mindestens 24 px groß', async ({ page, app }, info) => {
  test.skip(!info.project.use.hasTouch, 'nur Touch-Projekte');
  test.setTimeout(90000);
  await login(page, app);
  const sizes = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)]
    .filter((e) => e.getClientRects().length && !e.disabled && getComputedStyle(e).visibility !== 'hidden')
    .map((e) => { const r = e.getBoundingClientRect(); return { el: (e.getAttribute('aria-label') || e.textContent || e.className).toString().trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((x) => x.w > 1 && x.h > 1), sel);
  const check = async (label, sel) => {
    const all = await sizes(sel);
    // WCAG 2.5.8 (AA): mindestens 24 × 24 px. Die Projektregel von 44 px gilt ab 375 px Breite (Release-Audit).
    expect(all.filter((x) => Math.min(x.w, x.h) < 24), `${label}: Ziele unter 24 px`).toEqual([]);
    return all.filter((x) => Math.min(x.w, x.h) < 44).length;
  };
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    await page.evaluate(() => { location.hash = '#start'; });
    await check(`Startseite ${size.width}`, '#hub-tabbar a, .hub-top button, .hub-top select');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, 'maumau', 3);
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    await check(`Mau-Mau ${size.width}`, '.topbar button, .topbar a, #kg-dock button');
  }
});

test('B24 A11y Safe Areas: Notch und Home-Indikator verdecken weder Tableiste noch Aktionsleiste', async ({ page, app }, info) => {
  test.skip(project(info) !== 'desktop' || !isChromium(info), 'CDP-Emulation nur in Chrome');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  const inset = { top: 47, bottom: 34, left: 0, right: 0 };
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
  await login(page, app);
  // Die Emulation wirkt: env(safe-area-inset-bottom) liefert den gesetzten Wert.
  expect(await page.evaluate(() => { const d = document.createElement('div'); d.style.paddingBottom = 'env(safe-area-inset-bottom)'; document.body.append(d); const v = getComputedStyle(d).paddingBottom; d.remove(); return v; })).toBe('34px');
  const lowest = (sel) => page.evaluate((sel) => Math.max(...[...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom)), sel);
  const highest = (sel) => page.evaluate((sel) => Math.min(...[...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().top)), sel);
  expect(await lowest('#hub-tabbar .tab-item')).toBeLessThanOrEqual(844 - inset.bottom + 1);
  expect(await highest('.hub-top button, .hub-top .hub-brand')).toBeGreaterThanOrEqual(inset.top - 1);
  await startGame(page, 'maumau', 3);
  await page.waitForTimeout(300);
  expect(await lowest('#kg-dock button')).toBeLessThanOrEqual(844 - inset.bottom + 1);
});

test('B24 A11y Bildschirmtastatur und dynamische Höhe: Eingabe und Aktionsleiste bleiben sichtbar', async ({ page, app }, info) => {
  test.skip(project(info) !== 'desktop', 'Viewport-Simulation einmal je Browser');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, app);
  // Android verkleinert beim Öffnen der Tastatur den Layout-Viewport; das bildet die Höhenänderung nach.
  const search = page.locator('#hub-search-slot input').first();
  await search.focus();
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForTimeout(250);
  await expect(search).toBeFocused();
  await expect(search).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });
  await startGame(page, 'maumau', 3);
  for (const height of [844, 640, 480, 360]) {
    await page.setViewportSize({ width: 390, height });
    await page.waitForTimeout(150);
    const dock = await page.locator('#kg-dock').boundingBox();
    expect(dock.y + dock.height, `Aktionsleiste bei Höhe ${height}`).toBeLessThanOrEqual(height + 1);
    expect(problems(await page.evaluate(measureLayout)), `Mau-Mau 390×${height}`).toEqual(clean);
  }
});

test('B24 A11y vergrößerte Standardschrift: Startseite und Spiel ohne Überbreite oder Abschneiden', async ({ page, app }, info) => {
  test.skip(project(info) !== 'firefox-grossschrift', 'nur mit echter Firefox-Schrifteinstellung');
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, app);
  // Wirkt die Einstellung? Die Standardschrift des Browsers ist auf 24 px statt 16 px gesetzt.
  expect(await page.evaluate(() => { const d = document.createElement('div'); d.style.fontSize = 'medium'; document.body.append(d); const v = getComputedStyle(d).fontSize; d.remove(); return v; })).toBe('24px');
  const sizes = VIEWPORTS.filter((v) => ['320x568', '390x844', '1280x720', '1920x1080'].includes(v.key));
  for (const hash of ['#start', '#spiele']) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    for (const vp of sizes) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(150);
      expect(problems(await page.evaluate(measureLayout)), `Hub ${hash} @ ${vp.key}`).toEqual(clean);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await startGame(page, 'maumau', 3);
  for (const vp of sizes) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(150);
    expect(problems(await page.evaluate(measureLayout)), `Mau-Mau @ ${vp.key}`).toEqual(clean);
  }
});
