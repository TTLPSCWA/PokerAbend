import { test, expect, login } from './helpers.js';
test('Hub: Spiele filtern, Hosten-Panel schließen, Roadmap über Navigation öffnen', async ({ page, app }) => {
  await login(page, app);
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.getByRole('button', { name: 'Kurz (< 15 Min.)', exact: true }).click();
  await expect(page.locator('#games-body')).not.toContainText('Texas Hold');
  await page.getByRole('button', { name: 'Alle', exact: true }).click();
  await page.locator('[data-host="poker"]').click();
  await expect(page.locator('#host-dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#host-dlg')).not.toBeVisible();
  const nav = page.viewportSize().width < 641 ? '#hub-tabbar' : '#side-nav';
  await page.locator(nav).getByRole('link', { name: 'Roadmap', exact: true }).click();
  await expect(page).toHaveTitle('Roadmap – Spieleabend');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
