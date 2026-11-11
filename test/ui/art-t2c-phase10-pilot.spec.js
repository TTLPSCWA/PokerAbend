// ART-T2c: Feinschliff der Phase-10-Pilotwelten P-03 Testkammer X, P-06 Kart-Grand-Prix, P-10 Rhythmus-Tour.
// ART_CAPTURE=1 legt Bildschirmfotos unter docs/design/art/ART-T2c/ ab.
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const DIR = 'docs/design/art/ART-T2c', PILOTS = ['P-03', 'P-06', 'P-10'];
const HAND = ['r7', 'g7', 'b7', 'r3', 'g4', 'b5', 'y6', 'j0', 'r8', 'b12', 's0'];

for (const id of PILOTS) {
  test(`ART-T2c ${id}: Phasenanzeige, Joker, Aussetzen, Tisch`, async ({ page, browser, app }, info) => {
    test.setTimeout(90000);
    const room = await openTable(page, browser, app, info, 'zehnetappen', 'classic', 3);
    try {
      await configure(page, app, room.code, { hand: HAND, phase: 3 });
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      // Phasenanzeige als Reise der Welt: Stationen als Felder, erledigte und aktuelle Station unterscheidbar, Text lesbar
      const trip = await page.locator('.ze-progress').evaluate((el) => {
        const dots = [...el.querySelectorAll('i')], bg = (d) => getComputedStyle(d).backgroundColor;
        return { n: dots.length, w: dots[0].getBoundingClientRect().width, done: bg(el.querySelector('i.done')), now: bg(el.querySelector('i.now')), todo: bg(dots.at(-2)), track: getComputedStyle(el).borderTopLeftRadius };
      });
      expect(trip.n).toBe(10);
      expect(trip.w).toBeGreaterThanOrEqual(15);
      expect(new Set([trip.done, trip.now, trip.todo]).size, `${id} Stationen unterscheidbar`).toBe(3);
      const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const txt = await page.locator('.ze-phase').evaluate((el) => ({ fg: getComputedStyle(el.querySelector('b')).color, bg: getComputedStyle(el).backgroundImage }));
      expect(txt.bg, `${id} Panel mit Weltgrund`).not.toMatch(/^radial-gradient\(70% 60% at 50% 0%, rgba\(255, 255, 255, 0.12\)/);
      const fgL = lum(txt.fg);
      expect(id === 'P-03' ? fgL : 1 - fgL, `${id} Phasentext Kontrast`).toBeLessThan(id === 'P-03' ? 0.1 : 0.2);
      // Joker und Aussetzen: Streifen oben, Medaillon in der Karte; Aussetzen trägt zusätzlich den roten Querstrich
      for (const [cls, slash] of [['.ze-j', false], ['.ze-s', true]]) {
        const c = page.locator(`.kg-hand .kc-ze${cls}`).first();
        await expect(c).toBeVisible();
        const r = await c.evaluate((el) => { const v = el.querySelector('.v').getBoundingClientRect(), b = el.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, inside: v.top >= b.top && v.bottom <= b.bottom + 2, h: v.height / b.width }; });
        expect(r.bg).toContain('repeating-linear-gradient');
        expect(r.bg.includes('rgba(229, 38, 45')).toBe(slash);
        expect(r.inside).toBe(true);
        expect(r.h).toBeGreaterThan(0.3);
      }
      // Zahlenkarten behalten das Weltbild
      expect(await page.locator('.kg-hand .kc-ze').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(new RegExp(`card-worlds/art/${id}/\\d\\.svg`));
      // Rückseite: Weltbild und Zahl im dunklen Band darunter
      const back = await page.locator('.kg-zehnetappen .ze-top .kc-back').first().evaluate((el) => ({ bg: getComputedStyle(el).backgroundImage, txt: el.textContent.trim() }));
      expect(back.bg).toContain(`/card-worlds/art/${id}/back.svg`);
      expect(back.bg).toContain('linear-gradient');
      expect(back.txt).toMatch(/^\d+$/);
      // Planungsfelder: nicht mehr im Standard-Blaugrün
      const slot = await page.locator('.ze-slot').first().evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(slot).not.toBe('rgba(0, 0, 0, 0.2)');
      expect(slot).not.toBe('rgb(31, 61, 67)');
      if (process.env.ART_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); await page.screenshot({ path: `${DIR}/${id}-${info.project.name}.png` }); }
    } finally { await room.close(); }
  });
}
