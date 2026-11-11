// ART-T2b: Feinschliff der Skip-Bo-Pilotwelten SB-09 Burgenbau, SB-01 Montagewerk 12, SB-04 Orbitalstation.
// Prüft Baureihen als Bauplätze der Welt (Bauplatz-Namen, Fortschritt, leerer Platz mit Weltmotiv), Joker, Rückseite, Tisch.
// ART_CAPTURE=1 legt Bildschirmfotos unter docs/design/art/ART-T2b/ ab.
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const DIR = 'docs/design/art/ART-T2b', PILOTS = ['SB-09', 'SB-01', 'SB-04'];

for (const id of PILOTS) {
  test(`ART-T2b ${id}: Baureihen, Joker, Rückseite, Tisch`, async ({ page, browser, app }, info) => {
    test.setTimeout(90000);
    const room = await openTable(page, browser, app, info, 'stapelrennen', 'classic', 3);
    try {
      await configure(page, app, room.code, { hand: [1, 2, 8, 0, 12] });
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      // Baureihen sind Bauplätze der Welt: eigener Hintergrund, Rand und Leiste in der Weltfarbe, lesbare Beschriftung
      const slots = await page.locator('.st-build').evaluateAll((els) => els.map((el) => {
        const s = getComputedStyle(el), p = el.querySelector('progress'), c = getComputedStyle(el.querySelector('.st-need')), e = el.querySelector('.kc-empty');
        return { bg: s.backgroundImage, border: s.borderTopWidth, need: c.color, pH: p.getBoundingClientRect().height, empty: e ? getComputedStyle(e).backgroundImage : null };
      }));
      expect(slots).toHaveLength(4);
      for (const sl of slots) {
        expect(sl.bg, `${id} Bauplatz`).not.toBe('none');
        expect(parseFloat(sl.border)).toBeGreaterThanOrEqual(2);
        expect(sl.pH).toBeGreaterThanOrEqual(6);
        expect(sl.need).not.toBe('rgb(35, 78, 66)'); // nicht mehr das dunkle Grün des Standard-Aussehens
        if (sl.empty) expect(sl.empty, `${id} leerer Platz zeigt das Weltbild`).toContain(`/card-worlds/art/${id}/0.svg`);
      }
      // Beschriftung der Baureihen hat genug Kontrast zum Hintergrund
      const head = await page.locator('.st-shared .cw-eyebrow').first().evaluate((el) => getComputedStyle(el).color);
      expect(head).not.toBe('rgb(104, 126, 108)');
      // Joker: Streifen oben und großes Symbol, Medaillon innerhalb der Karte
      const joker = page.locator('.kg-hand .kc-st.joker').first();
      await expect(joker).toBeVisible();
      const j = await joker.evaluate((el) => { const v = el.querySelector('.v').getBoundingClientRect(), c = el.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, inside: v.top >= c.top && v.bottom <= c.bottom + 2, h: v.height / c.width }; });
      expect(j.bg).toContain('repeating-linear-gradient');
      expect(j.inside).toBe(true);
      expect(j.h).toBeGreaterThan(0.3);
      // Zahlenkarten behalten das Weltbild
      expect(await page.locator('.kg-hand .kc-st').first().evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(new RegExp(`card-worlds/art/${id}/\\d\\.svg`));
      if (process.env.ART_CAPTURE === '1') {
        mkdirSync(DIR, { recursive: true });
        await page.screenshot({ path: `${DIR}/${id}-${info.project.name}.png` });
      }
    } finally { await room.close(); }
  });
}
