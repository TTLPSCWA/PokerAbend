import { resolve } from 'node:path';
import { configure, emit, expect, openTable, test } from './card-ux-helpers.js';

const tables = [
  { game: 'farbenchaos', hand: ['7r', 'Ww'], world: null, pile: '.fc-deck-count' },
  { game: 'stapelrennen', hand: [1, 2, 8, 0, 12], world: 'SB-09', pile: '.st-goal-stock small b' },
  { game: 'zehnetappen', hand: ['r7', 'g7', 'r3', 'j0', 'b12'], world: 'P-06', pile: '.ze-top .kc-back' },
];

for (const { game, hand, world, pile } of tables) {
  test(`${game}: public counters stay with their owner and table assets load at compact widths`, async ({ page, browser, app }, info) => {
    test.setTimeout(60000);
    const room = await openTable(page, browser, app, info, game, 'classic', 3);
    try {
      await configure(page, app, room.code, { hand });
      if (world) {
        await emit(page, 'setCardWorld', { world });
        await expect(page.locator('body')).toHaveAttribute('data-card-world', world);
        const art = await page.locator('.kg-hand .kc').first().evaluate((card) => {
          const url = getComputedStyle(card).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
          return url ? new URL(url, location.href).pathname : null;
        });
        expect(art).toMatch(new RegExp(`/card-worlds/art/${world}/\\d+\\.svg$`));
        await expect.poll(() => page.evaluate(async (url) => {
          const image = new Image();
          image.src = url;
          try {
            await image.decode();
            return image.naturalWidth;
          } catch {
            return 0;
          }
        }, art)).toBeGreaterThan(0);
      } else {
        await expect(page.locator('.fc-back-emblem svg')).toBeVisible();
      }

      const { players, turnId, pileCount } = await page.evaluate((id) => ({
        players: lastState.players.filter((player) => player.inRound).map(({ id, name, cards }) => ({ id, name, cards })),
        turnId: lastState.turnId,
        pileCount: id === 'stapelrennen' ? lastState.players.find((player) => player.id === lastState.you.id).stock : lastState.g.deck,
      }), game);
      const sizes = page.viewportSize().width < 400 ? [[360, 800]] : [[1440, 900], [768, 1024], [390, 844]];
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await expect(page.locator('.kp.turn[data-pid]')).toHaveCount(1);
        await expect(page.locator('.kp.turn[data-pid]')).toHaveAttribute('data-pid', turnId);
        for (const player of players) {
          const badge = page.locator(`.kp[data-pid="${player.id}"] .cix-count`);
          await expect(badge).toHaveAttribute('aria-label', new RegExp(`^${player.name} · ${player.cards} `));
          await expect(badge.locator('[data-hand-count]')).toHaveText(String(player.cards));
          expect(await badge.evaluate((element) => {
            const { left, right } = element.getBoundingClientRect();
            const owner = element.closest('.kp').getBoundingClientRect();
            const avatar = element.closest('.kp').querySelector('.kp-av').getBoundingClientRect();
            return left >= owner.left - 1 && right <= owner.right + 1 && left >= avatar.right - 1;
          })).toBe(true);
        }
        if (width <= 390) {
          const direction = page.locator('.kp-watch').filter({ hasText: /Richtung|andersherum/ });
          await expect(direction).toHaveCount(1);
          expect(await direction.evaluate((element) => {
            const label = element.querySelector('small').getBoundingClientRect();
            return element.getBoundingClientRect().width - label.width;
          })).toBeLessThanOrEqual(32);
        }
        await expect(page.locator(pile)).toHaveText(new RegExp(`^${pileCount}(Karten|cards)?$`));
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        if (process.env.CARD_LAYOUT_EVIDENCE) {
          await page.screenshot({ path: resolve(process.env.CARD_LAYOUT_EVIDENCE, info.project.name, `${game}-${width}x${height}.png`), animations: 'disabled' });
        }
      }
    } finally {
      await room.close();
    }
  });
}
