import { test, expect, login } from './helpers.js';

test('Spielwelten: geprüfter Pilot und drei Kartenwelten sind fertig und zweisprachig', async ({ page, app }) => {
  await login(page, app);
  await page.evaluate(() => { location.hash = '#roadmap'; });
  const later = page.locator('[data-roadmap-stage="spaeter"]');
  await later.locator('summary').first().click();
  const section = page.locator('article[aria-labelledby="roadmap-neue-spielwelten"]');
  await expect(section.getByRole('heading')).toHaveText('Neue Spielwelten & schönere Spieloberflächen');
  await expect(section.locator('progress')).toHaveAttribute('value', '2');
  await expect(section.locator('progress')).toHaveAttribute('max', '7');
  await expect(section.locator('.roadmap-points li')).toHaveCount(7);
  await expect(section.locator('.roadmap-points li').first()).toContainText('Erledigt');
  await expect(section.locator('.roadmap-points li').nth(1)).toContainText('UNO, Skip-Bo & Phase 10');
  await expect(section.locator('.roadmap-points li').nth(1)).toContainText('Erledigt');
  expect(await section.locator('[data-host],[data-plan]').count()).toBe(0);
  await page.locator('#hub-language select').selectOption('en');
  await expect(section.getByRole('heading')).toHaveText('New game worlds & better game interfaces');
  await expect(section.locator('.roadmap-points li').first()).toContainText('Done');
  await expect(section).toContainText('separate approval');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
