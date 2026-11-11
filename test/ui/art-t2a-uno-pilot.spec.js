// ART-T2a: Feinschliff der UNO-Pilotwelten U-04, U-01, U-02.
// Prüft Aktionskarten (Aussetzen, Richtungswechsel, +2, Farbwahl, +4), Rückseite, Tisch und Handy.
// ART_CAPTURE=1 legt Bildschirmfotos unter docs/design/art/ART-T2a/ ab.
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const DIR = 'docs/design/art/ART-T2a', PILOTS = ['U-04', 'U-01', 'U-02'];
const HAND = ['Sr', 'Rb', 'Dy', 'Fw', 'Ww', '0g', '7r', '9b'];

for (const id of PILOTS) {
  test(`ART-T2a ${id}: Aktionskarten, Rückseite, Tisch`, async ({ page, browser, app }, info) => {
    test.setTimeout(90000);
    const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
    try {
      await configure(page, app, room.code, { top: '7b', hand: HAND });
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const cards = page.locator('.kg-hand .kc-fc');
      await expect(cards).toHaveCount(HAND.length);
      // Jede Karte: Wert im Medaillon sichtbar und innerhalb der Karte, Weltbild vorhanden
      const faces = await cards.evaluateAll((els) => els.map((el) => {
        const v = el.querySelector('.v'), c = el.getBoundingClientRect(), r = v.getBoundingClientRect(), s = getComputedStyle(el);
        return { action: el.dataset.action, bg: s.backgroundImage, inside: r.top >= c.top && r.bottom <= c.bottom + 2 && r.left >= c.left - 1 && r.right <= c.right + 1, h: r.height, label: v.textContent.trim() };
      }));
      for (const f of faces) {
        expect(f.bg, f.action).toMatch(/card-worlds\/art\/U-0\d\/(\d|w)\.svg/);
        expect(f.inside, `${f.action} Medaillon in Karte`).toBe(true);
        expect(f.h, f.action).toBeGreaterThan(9);
      }
      // Aktionskarten haben ein Symbol statt nackter Buchstaben (kein einzelner Buchstabe S/R/D/F/W als Wert)
      for (const f of faces.filter((x) => 'SRDFW'.includes(x.action))) expect(f.label, `${f.action} Symbol`).not.toMatch(/^[SRDFW]$/);
      // Rückseite des Nachziehstapels zeigt das Weltbild
      const back = await page.locator('.kg-farbenchaos .kc-back').first().evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(back).toContain(`/card-worlds/art/${id}/back.svg`);
      if (process.env.ART_CAPTURE === '1') {
        mkdirSync(DIR, { recursive: true });
        await page.screenshot({ path: `${DIR}/${id}-${info.project.name}.png` });
        await page.locator('.kg-hand').first().screenshot({ path: `${DIR}/${id}-${info.project.name}-hand.png` });
      }
    } finally { await room.close(); }
  });
}
