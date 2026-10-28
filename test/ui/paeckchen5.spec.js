// Päckchen 5 im Browser: Würfelpoker, Lügenwürfel, Chicago, Reversi, Dame und Domino hosten, Bot dazu, starten – keine Skriptfehler, Screenshots.
// Läuft mit: npx playwright test test/ui/paeckchen5.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
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

for (const [id, bots] of [['wuerfelpoker', 1], ['luegenwuerfel', 1], ['chicago', 1], ['reversi', 1], ['dame', 1], ['domino', 1]]) {
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
    await expect(page.locator('.kg-main .kg-table')).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: testInfo.outputPath(`${id}-${testInfo.project.name}.png`) });
    expect(errors).toEqual([]);
  });
}

