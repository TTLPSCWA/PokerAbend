// ART-T4 (Teil Phase 10): Feinschliff der übrigen sieben Phase-10-Welten P-01, P-02, P-04, P-05, P-07, P-08, P-09.
// Prüft Phasenanzeige als Reise (zehn Stationen unterscheidbar), Phasentext mit Kontrast, Joker und Aussetzen, Rückseite, Planungsfelder.
// ART_CAPTURE=1 legt Bildschirmfotos unter test-results/art-t4/ ab (Übersichten: docs/design/art/ART-T4/).
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const SHOTS = 'test-results/art-t4', WORLDS = ['P-01', 'P-02', 'P-04', 'P-05', 'P-07', 'P-08', 'P-09'];
const HAND = ['r7', 'g7', 'b7', 'r3', 'g4', 'b5', 'y6', 'j0', 'r8', 'b12', 's0'];
const LIGHT = ['P-07', 'P-09'];
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };

test('ART-T4 Phase 10: sieben Welten mit Reise, Joker und Rückseite', async ({ page, browser, app }, info) => {
  test.setTimeout(240000);
  const room = await openTable(page, browser, app, info, 'zehnetappen', 'classic', 3);
  try {
    await configure(page, app, room.code, { hand: HAND, phase: 3 });
    await page.evaluate(() => CardWorlds.ready);
    for (const id of WORLDS) {
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const trip = await page.locator('.ze-progress').evaluate((el) => {
        const dots = [...el.querySelectorAll('i')], bg = (d) => getComputedStyle(d).backgroundColor;
        return { n: dots.length, w: dots[0].getBoundingClientRect().width, done: bg(el.querySelector('i.done')), now: bg(el.querySelector('i.now')), todo: bg(dots.at(-2)) };
      });
      expect(trip.n).toBe(10);
      expect(trip.w).toBeGreaterThanOrEqual(15);
      expect(new Set([trip.done, trip.now, trip.todo]).size, `${id} Stationen unterscheidbar`).toBe(3);
      const txt = await page.locator('.ze-phase').evaluate((el) => ({ fg: getComputedStyle(el.querySelector('b')).color, bg: getComputedStyle(el).backgroundImage }));
      expect(txt.bg, `${id} Panel mit Weltgrund`).not.toMatch(/^radial-gradient\(70% 60% at 50% 0%, rgba\(255, 255, 255, 0.12\)/);
      const fgL = lum(txt.fg);
      expect(LIGHT.includes(id) ? fgL : 1 - fgL, `${id} Phasentext Kontrast`).toBeLessThan(LIGHT.includes(id) ? 0.1 : 0.2);
      for (const [cls, slash] of [['.ze-j', false], ['.ze-s', true]]) {
        const c = page.locator(`.kg-hand .kc-ze${cls}`).first();
        await expect(c).toBeVisible();
        const r = await c.evaluate((el) => { const v = el.querySelector('.v').getBoundingClientRect(), b = el.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, inside: v.top >= b.top && v.bottom <= b.bottom + 2, h: v.height / b.width }; });
        expect(r.bg, `${id} ${cls}`).toContain('repeating-linear-gradient');
        expect(r.bg.includes('rgba(229, 38, 45'), `${id} ${cls} Querstrich`).toBe(slash);
        expect(r.inside).toBe(true);
        expect(r.h).toBeGreaterThan(0.3);
      }
      expect(await page.locator('.kg-hand .kc-ze').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(new RegExp(`card-worlds/art/${id}/\\d\\.svg`));
      const back = await page.locator('.kg-zehnetappen .ze-top .kc-back').first().evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, txt: el.textContent.trim() }));
      expect(back.bg).toContain(`/card-worlds/art/${id}/back.svg`);
      expect(back.bg).toContain('linear-gradient');
      expect(back.txt).toMatch(/^\d+$/);
      const slot = await page.locator('.ze-slot').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(slot).not.toBe('rgba(0, 0, 0, 0.2)');
      expect(slot).not.toBe('rgb(31, 61, 67)');
      if (process.env.ART_CAPTURE === '1') { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${id}-${info.project.name}.png` }); }
    }
    await emit(page, 'setCardWorld', { world: '' });
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
  } finally { await room.close(); }
});
