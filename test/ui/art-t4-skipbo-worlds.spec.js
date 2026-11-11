// ART-T4 (Teil Skip-Bo): Feinschliff der übrigen sieben Skip-Bo-Welten SB-02, SB-03, SB-05, SB-06, SB-07, SB-08, SB-10.
// Prüft Bauplätze der Welt (Grund, Rand, Leiste, leerer Platz mit Weltbild), lesbare Beschriftung (Kontrast), Joker, Weltbild auf den Karten.
// ART_CAPTURE=1 legt Bildschirmfotos unter test-results/art-t4/ ab (Übersichten: docs/design/art/ART-T4/).
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const SHOTS = 'test-results/art-t4', WORLDS = ['SB-02', 'SB-03', 'SB-05', 'SB-06', 'SB-07', 'SB-08', 'SB-10'];
const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };

test('ART-T4 Skip-Bo: sieben Welten mit Bauplätzen und Joker', async ({ page, browser, app }, info) => {
  test.setTimeout(240000);
  const room = await openTable(page, browser, app, info, 'stapelrennen', 'classic', 3);
  try {
    await configure(page, app, room.code, { hand: [1, 2, 8, 0, 12] });
    await page.evaluate(() => CardWorlds.ready);
    for (const id of WORLDS) {
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const slots = await page.locator('.st-build').evaluateAll((els) => els.map((el) => {
        const s = getComputedStyle(el), p = el.querySelector('progress'), e = el.querySelector('.kc-empty');
        return { bg: s.backgroundImage, border: s.borderTopWidth, text: getComputedStyle(el.querySelector('small')).color, need: getComputedStyle(el.querySelector('.st-need')).color, pH: p.getBoundingClientRect().height, empty: e ? getComputedStyle(e).backgroundImage : null };
      }));
      expect(slots).toHaveLength(4);
      for (const sl of slots) {
        expect(sl.bg, `${id} Bauplatz-Grund`).not.toBe('none');
        expect(parseFloat(sl.border), `${id} Rand`).toBeGreaterThanOrEqual(2);
        expect(sl.pH).toBeGreaterThanOrEqual(6);
        if (sl.empty) expect(sl.empty, `${id} leerer Platz zeigt das Weltbild`).toContain(`/card-worlds/art/${id}/0.svg`);
      }
      // Beschriftung hell auf dunklem Platz oder dunkel auf hellem Platz (jeweils nicht mittelgrau)
      const light = ['SB-03', 'SB-07'].includes(id), tl = lum(slots[0].text);
      expect(light ? tl : 1 - tl, `${id} Beschriftung Kontrast`).toBeLessThan(light ? 0.12 : 0.3);
      const joker = page.locator('.kg-hand .kc-st.joker').first();
      await expect(joker).toBeVisible();
      const j = await joker.evaluate((el) => { const v = el.querySelector('.v').getBoundingClientRect(), c = el.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, inside: v.top >= c.top && v.bottom <= c.bottom + 2, h: v.height / c.width }; });
      expect(j.bg.startsWith('repeating-linear-gradient'), `${id} Joker-Streifen`).toBe(true);
      expect(j.inside).toBe(true);
      expect(j.h).toBeGreaterThan(0.3);
      expect(await page.locator('.kg-hand .kc-st').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(new RegExp(`card-worlds/art/${id}/\\d\\.svg`));
      if (process.env.ART_CAPTURE === '1') { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${id}-${info.project.name}.png` }); }
    }
    await emit(page, 'setCardWorld', { world: '' });
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
  } finally { await room.close(); }
});
