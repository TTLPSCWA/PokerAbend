import { test, expect, login } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { newArcade } from '../../public/singleplayer/slots-session.js';
import { serialize } from '../../public/singleplayer/slots-logic.js';

const slotKey = 'poker:singleplayer:slot-arcade';
const cabinet = '[data-machine]';
const saved = (page) => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.state, slotKey);

async function enter(page, app) {
  await login(page, app);
  await page.locator('.category-tabs a[href="#spiele/einzelspieler"]').click();
  await page.locator('[data-solo-start="slot-arcade"]').click();
  await expect(page.locator('[data-solo="slot-arcade"]')).toBeVisible();
}

test('cabinet switching, exact single booking, reload, and returning to the solo library', async ({page, app}, info) => {
  await enter(page, app);
  await expect(page.locator(cabinet)).toHaveAttribute('data-machine', 'lucky-sevens');
  await expect(page.locator('.slot-reel')).toHaveCount(3);
  await page.locator('[data-slot-spin]').evaluate(button => { button.click(); button.click(); });
  await expect.poll(async () => (await saved(page))?.machines['lucky-sevens'].spins).toBe(1);
  await expect(page.locator('.slot-reels')).not.toHaveClass(/is-rolling/);
  await page.screenshot({path:info.outputPath('lucky-sevens.png')});
  const first = await saved(page);
  const result = first.histories['lucky-sevens'][0];
  expect(first.machines['lucky-sevens'].balance).toBe(1000 - result.bet + result.total);
  await page.reload();
  await expect(page.locator(cabinet)).toHaveAttribute('data-machine', 'lucky-sevens');
  expect((await saved(page)).machines['lucky-sevens'].balance).toBe(first.machines['lucky-sevens'].balance);

  await page.locator('[data-slot-machine="neon-nights"]').press('Enter');
  await expect(page.locator(cabinet)).toHaveAttribute('data-machine', 'neon-nights');
  await expect(page.locator('.slot-reel')).toHaveCount(5);
  await page.locator('[data-slot-bet]').selectOption('50');
  await expect.poll(async () => (await saved(page)).machines['neon-nights'].bet).toBe(50);
  await page.locator('[data-slot-spin]').press('Space');
  await expect.poll(async () => (await saved(page)).machines['neon-nights'].spins).toBe(1);
  await expect(page.locator('.slot-reels')).not.toHaveClass(/is-rolling/);
  await page.screenshot({path:info.outputPath('neon-nights.png')});
  const neon = await saved(page);
  expect(neon.machines['neon-nights'].balance).toBe(950 + neon.histories['neon-nights'][0].total);

  await page.locator('[data-slot-machine="dragons-fortune"]').click();
  await expect(page.locator(cabinet)).toHaveAttribute('data-machine', 'dragons-fortune');
  await page.locator('[data-slot-spin]').press('Space');
  await expect.poll(async () => (await saved(page)).machines['dragons-fortune'].spins).toBe(1);
  await expect(page.locator('.slot-reels')).not.toHaveClass(/is-rolling/);
  await page.screenshot({path:info.outputPath('dragons-fortune.png')});
  await page.locator('.slot-header a').click();
  await expect(page.locator('[data-solo-start="slot-arcade"]')).toHaveText('Fortsetzen');
  await page.locator('[data-solo-start="slot-arcade"]').click();
  await expect(page.locator(cabinet)).toHaveAttribute('data-machine', 'dragons-fortune');
});

test('free refill, saved motion settings, and reachable controls on a narrow viewport', async ({page, app}, info) => {
  await enter(page, app);
  const fixture = newArcade(() => 97);
  fixture.machines['lucky-sevens'].balance = 0;
  const state = {...fixture, machines: Object.fromEntries(Object.entries(fixture.machines).map(([k, v]) => [k, serialize(v)]))};
  await page.evaluate(({key, state}) => localStorage.setItem(key, JSON.stringify({
    id: 'slot-arcade', version: 1, updatedAt: Date.now(), state,
  })), {key: slotKey, state});
  await page.reload();
  await expect(page.locator('[data-slot-refill]')).toBeVisible();
  await page.locator('[data-slot-refill]').click();
  await expect.poll(async () => (await saved(page)).machines['lucky-sevens'].balance).toBe(1000);
  await expect(page.locator('[data-slot-refill]')).toBeHidden();
  await page.locator('.slot-detail-grid details').nth(1).locator('summary').click();
  await page.locator('[data-slot-quiet]').check();
  await expect.poll(async () => (await saved(page)).quiet).toBe(true);
  await page.setViewportSize({width: 360, height: 800});
  await page.locator('[data-slot-spin]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await expect(page.locator('[data-slot-spin]')).toBeInViewport();
  await page.locator('[data-slot-spin]').click();
  await expect(page.locator('[data-slot-live]')).toContainText('Auszahlung');
  await expect(page.locator('.slot-reels')).not.toHaveClass(/is-rolling/);
  mkdirSync('artifacts/slot-arcade', {recursive: true});
  await page.screenshot({path: 'artifacts/slot-arcade/mobile-' + info.project.name + '.png', fullPage: true});
});
