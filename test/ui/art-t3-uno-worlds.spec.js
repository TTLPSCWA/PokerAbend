// ART-T3: Feinschliff der übrigen sieben UNO-Welten U-03, U-05, U-06, U-07, U-08, U-09, U-10.
// Prüft Aktionskarten (Streifen, Symbol im Medaillon), Rückseite mit Zahlenmarke, Weltbild auf allen Karten.
// ART_CAPTURE=1 legt Bildschirmfotos unter test-results/art-t3/ ab (Übersichten: docs/design/art/ART-T3/).
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';

const SHOTS = 'test-results/art-t3', WORLDS = ['U-03', 'U-05', 'U-06', 'U-07', 'U-08', 'U-09', 'U-10'];
const HAND = ['Sr', 'Rb', 'Dy', 'Fw', 'Ww', '0g', '7r', '9b'];

test('ART-T3 UNO: sieben Welten mit Aktionskarten und Rückseite', async ({ page, browser, app }, info) => {
  test.setTimeout(240000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
  try {
    await configure(page, app, room.code, { top: '7b', hand: HAND });
    await page.evaluate(() => CardWorlds.ready);
    for (const id of WORLDS) {
      await emit(page, 'setCardWorld', { world: id });
      await expect(page.locator('body')).toHaveAttribute('data-card-world', id);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const cards = page.locator('.kg-hand .kc-fc');
      await expect(cards).toHaveCount(HAND.length);
      const faces = await cards.evaluateAll((els) => els.map((el) => {
        const v = el.querySelector('.v'), c = el.getBoundingClientRect(), r = v.getBoundingClientRect();
        return { action: el.dataset.action, bg: getComputedStyle(el).backgroundImage, inside: r.top >= c.top && r.bottom <= c.bottom + 2 && r.left >= c.left - 1 && r.right <= c.right + 1, h: r.height / c.width, label: v.textContent.trim() };
      }));
      for (const f of faces) {
        expect(f.bg, `${id} ${f.action}`).toMatch(new RegExp(`card-worlds/art/${id}/(\\d|w)\\.svg`));
        expect(f.inside, `${id} ${f.action} Medaillon in Karte`).toBe(true);
        if ('SRDFW'.includes(f.action)) {
          expect(f.bg.startsWith('repeating-linear-gradient'), `${id} ${f.action} Streifen oben`).toBe(true);
          expect(f.h, `${id} ${f.action} großes Medaillon`).toBeGreaterThan(0.3);
          expect(f.label, `${id} ${f.action} Symbol`).not.toMatch(/^[SRDFW]$/);
        } else expect(f.bg.startsWith('repeating-linear-gradient'), `${id} ${f.action} ohne Streifen oben`).toBe(false);
      }
      const back = await page.locator('.kg-farbenchaos .fc-back').first().evaluate((el) => { const b = el.getBoundingClientRect(), n = el.querySelector('.fc-deck-count'), r = n.getBoundingClientRect(); return { bg: getComputedStyle(el).backgroundImage, pos: getComputedStyle(n).position, low: r.top > b.top + b.height * 0.6, inside: r.left >= b.left && r.right <= b.right }; });
      expect(back.bg).toContain(`/card-worlds/art/${id}/back.svg`);
      expect(back.pos).toBe('absolute');
      expect(back.low, `${id} Zahl unten`).toBe(true);
      expect(back.inside, `${id} Zahl in der Karte`).toBe(true);
      if (process.env.ART_CAPTURE === '1') { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${id}-${info.project.name}.png` }); }
    }
    // Pilotwelten behalten ihr Aussehen aus ART-T2a (eigene Datei), Welt wechseln zurück auf Standard
    await emit(page, 'setCardWorld', { world: '' });
    await expect(page.locator('body')).not.toHaveAttribute('data-card-world', /./);
  } finally { await room.close(); }
});
