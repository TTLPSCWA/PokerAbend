// Päckchen 4 im Browser: Mogeln, Präsident, Durak und Omaha hosten, Bots dazu, starten – keine Skriptfehler, Screenshots.
// Läuft mit: npx playwright test test/ui/paeckchen4.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
import { test, expect } from './helpers.js';

async function start(page, app, name = 'Anna') {
  await page.addInitScript((n) => {
    try {
      if (!localStorage.getItem('poker:name')) {
        localStorage.setItem('poker:name', JSON.stringify(n));
        localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
        localStorage.setItem('poker:prefs', JSON.stringify({ intros: false }));
      }
    } catch { /* egal */ }
  }, name);
  await page.goto(app.url);
  await page.getByLabel('Passwort').fill(app.password);
  await page.getByRole('button', { name: 'Reinkommen' }).click();
  await expect(page.locator('#hub')).toBeVisible();
  await page.goto('about:blank');
  await page.goto(app.url);
}
async function host(page, id) {
  await expect(page.locator('#hub')).toBeVisible();
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator(`[data-host="${id}"]`).first().click();
  await page.locator('#host-form button[type=submit]').click();
}

for (const [id, bots] of [['mogeln', 2], ['praesident', 2], ['durak', 1]]) {
  test(`${id}: hosten, Bots, starten, Zug sichtbar`, async ({ page, app }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, app);
    await host(page, id);
    await expect(page.locator('#kg')).toBeVisible();
    await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    await page.locator('[data-kit-panel="host"]').first().click();
    for (let i = 0; i < bots; i++) await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText(`Bot ${bots}`);
    await page.locator('.panel-head [data-kit="close"]').click();
    await page.getByRole('button', { name: /starten/ }).first().click();
    await expect(page.locator('.kg-hand .kc').first()).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: testInfo.outputPath(`${id}-${testInfo.project.name}.png`) });
    expect(errors).toEqual([]);
  });
}

test('omaha: Poker-Oberfläche mit vier Karten, Pot-Limit', async ({ page, app }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await start(page, app);
  await host(page, 'omaha');
  await expect(page.locator('#game')).toBeVisible();
  await page.locator('[data-sit]').first().click();
  await page.locator('[data-panel="host"]').first().click();
  const controls = page.getByRole('region', { name: 'Computer-Mitspieler' });
  await controls.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
  await expect(controls).toContainText('Bot 1');
  await page.locator('[data-panel="host"]').first().click();
  await page.getByRole('button', { name: /Spiel starten/ }).first().click();
  await expect(page.locator('#dock .cards .card').first()).toBeVisible();
  await expect(page.locator('#dock .cards .card')).toHaveCount(4);
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath(`omaha-${testInfo.project.name}.png`) });
  expect(errors).toEqual([]);
});
