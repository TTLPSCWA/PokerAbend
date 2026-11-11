// ART-T5: Feinschliff der zehn Winterwelten (X-01 bis X-10) in UNO, Skip-Bo und Phase 10 und ruhiger Schneefall.
// Prüft je Welt und Spiel: Weltbild auf den Karten, Wert im Medaillon innerhalb der Karte, Schneefall läuft,
// lässt sich ausschalten (bleibt pro Gerät gespeichert) und blockiert keine Eingabe.
// ART_CAPTURE=1 legt Bildschirmfotos unter test-results/art-t5/ ab (Übersichten: docs/design/art/ART-T5/).
import { test, expect, openTable, emit, configure } from './card-ux-helpers.js';
import { mkdirSync } from 'node:fs';
import { worldsFor } from '../../public/games/card-worlds/worlds.js';

const SHOTS = 'test-results/art-t5';
const CARD = { farbenchaos: '.kc-fc', stapelrennen: '.kc-st', zehnetappen: '.kc-ze' };
const DATA = {
  farbenchaos: { top: '7b', hand: ['Sr', 'Rb', 'Dy', 'Fw', 'Ww', '0g', '7r', '9b'] },
  stapelrennen: { hand: [1, 2, 8, 0, 12] },
  zehnetappen: { hand: ['r7', 'g7', 'b7', 'r3', 'g4', 'b5', 'y6', 'j0', 'r8', 'b12', 's0'] },
};
const MOBILE = ['X-01', 'X-04', 'X-07'];

for (const game of Object.keys(CARD)) {
  test(`ART-T5 ${game}: Winterwelten und Schneefall`, async ({ page, browser, app }, info) => {
    test.setTimeout(300000);
    const room = await openTable(page, browser, app, info, game, 'classic', 3);
    try {
      await configure(page, app, room.code, DATA[game]);
      await page.evaluate(() => CardWorlds.ready);
      const worlds = worldsFor(game).filter((w) => w.game === 'all' && (info.project.name !== 'mobil' || MOBILE.includes(w.id)));
      expect(worlds.length).toBe(info.project.name === 'mobil' ? 3 : 10);
      for (const w of worlds) {
        await emit(page, 'setCardWorld', { world: w.id });
        await expect(page.locator('body')).toHaveAttribute('data-card-world', w.id);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        const cards = page.locator(`.kg-hand ${CARD[game]}`);
        await expect(cards.first()).toBeVisible();
        const faces = await cards.evaluateAll((els) => els.map((el) => {
          const v = el.querySelector('.v'), c = el.getBoundingClientRect(), r = v.getBoundingClientRect();
          return { bg: getComputedStyle(el).backgroundImage, inside: r.top >= c.top && r.bottom <= c.bottom + 2 && r.left >= c.left - 1 && r.right <= c.right + 1, h: r.height };
        }));
        for (const f of faces) { expect(f.bg, w.id).toMatch(/card-worlds\/art\/X-\d+\/(\d|w)\.svg/); expect(f.inside, `${w.id} Medaillon`).toBe(true); expect(f.h).toBeGreaterThan(9); }
        // Schneefall: Ebene da, sichtbar, ohne Mausfang
        const snow = await page.evaluate(() => { const s = document.getElementById('cw-snow'); if (!s) return null; const st = getComputedStyle(s); return { display: st.display, pe: st.pointerEvents, kids: s.children.length, anim: getComputedStyle(s.children[0]).animationName }; });
        expect(snow, `${w.id} Schnee`).toMatchObject({ pe: 'none', kids: 3 });
        expect(snow.display).not.toBe('none');
        if (process.env.ART_CAPTURE === '1') { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${game}-${w.id}-${info.project.name}.png` }); }
      }
      // Ausschalten: Ebene weg, Wahl bleibt nach Neuaufbau erhalten, wieder einschalten
      await page.locator('#cw-snow-toggle').click();
      await expect(page.locator('body')).toHaveAttribute('data-cw-snow', 'off');
      await expect(page.locator('#cw-snow')).toBeHidden();
      await emit(page, 'setCardWorld', { world: worlds[1].id });
      await expect(page.locator('body')).toHaveAttribute('data-cw-snow', 'off');
      await page.locator('#cw-snow-toggle').click();
      await expect(page.locator('body')).toHaveAttribute('data-cw-snow', 'on');
      // Gäste sehen den Schnee ebenfalls, Standard und Nicht-Winterwelten haben keinen
      await expect(room.guests[0].locator('#cw-snow')).toHaveCount(1);
      const own = worldsFor(game).find((w) => w.game !== 'all').id;
      await emit(page, 'setCardWorld', { world: own });
      await expect(page.locator('#cw-snow')).toHaveCount(0);
      await expect(page.locator('#cw-snow-toggle')).toHaveCount(0);
      await emit(page, 'setCardWorld', { world: '' });
      await expect(page.locator('#cw-snow')).toHaveCount(0);
    } finally { await room.close(); }
  });
}

test('ART-T5 Schneefall blockiert keine Eingabe und braucht nur transform', async ({ page, browser, app }, info) => {
  test.skip(info.project.name === 'mobil', 'einmal genügt');
  test.setTimeout(120000);
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'classic', 3);
  try {
    await configure(page, app, room.code, DATA.farbenchaos);
    await emit(page, 'setCardWorld', { world: 'X-07' });
    const card = page.locator('.kg-hand .kc-fc').nth(5);
    const hit = await card.evaluate((el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.kc-fc') === el; });
    expect(hit).toBe(true);
    const keys = await page.evaluate(() => [...new Set([...document.getAnimations()].filter((a) => a.animationName?.startsWith('cw-fall')).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k))))]);
    expect(keys).toEqual(['transform']);
  } finally { await room.close(); }
});
