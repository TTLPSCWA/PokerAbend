import { test, expect, login, selectGame, screenshot } from './helpers.js';

test('Spielkategorien lassen sich per Tastatur öffnen; Auswahl bleibt beim Einklappen und Neuladen erhalten', async ({ page, app }) => {
  await login(page, app);
  const cards = page.locator('[data-category="karten"]');
  const dice = page.locator('[data-category="wuerfel"]');
  await expect(page.locator('#game-list details[open]')).toHaveCount(0);
  await expect(page.locator('#chosen-game')).toHaveText("Gewählt: Texas Hold'em");
  await screenshot(page, 'menu-kompakt');

  await cards.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-game="farbenchaos"]')).toBeVisible();
  await selectGame(page, 'farbenchaos');
  await expect(page.locator('[data-game="farbenchaos"]')).toBeFocused();
  await expect(page.getByLabel('Karten pro Spieler')).toHaveValue('7');
  await selectGame(page, 'maexchen');
  await expect(cards).toHaveAttribute('open', '');
  await expect(dice).toHaveAttribute('open', '');
  await dice.locator('summary').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-game="maexchen"]')).not.toBeVisible();
  await expect(page.locator('#chosen-game')).toHaveText('Gewählt: Mäxchen');
  await expect(page.getByLabel('Leben pro Spieler')).toHaveValue('3');
  await expect(page.locator('#f-submit')).toHaveText('Mäxchen hosten');

  await page.reload();
  await expect(page.locator('#chosen-game')).toHaveText('Gewählt: Mäxchen');
  await expect(page.locator('#game-list details[open]')).toHaveCount(0);
  await selectGame(page, 'huetchen');
  await screenshot(page, 'menu-brettspiele');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('Dein Name').fill('Anna');
  await page.getByRole('button', { name: 'Mensch ärgere Dich nicht hosten', exact: true }).click();
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Mensch ärgere Dich nicht');
});
