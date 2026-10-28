// Päckchen 6 im Browser: Zahlenzoo, Gedächtnisküche, Pfeilfieber, Sortierstation, Tickendes Paket und Werwolf hosten, Bots dazu, starten, kurz spielen – keine Skriptfehler, Screenshots.
// Läuft mit: npx playwright test test/ui/paeckchen6.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
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

const SPIELE = [
  ['zahlenzoo', 2, async (page) => { await expect(page.locator('#so-area')).toBeVisible(); await page.locator('.pk-input').fill('3'); await page.getByRole('button', { name: 'Antworten' }).click(); await expect(page.locator('.so-wait')).toContainText(/Wertung|Abgegeben/); }],
  ['gedaechtnis-kueche', 2, async (page) => { await expect(page.locator('#so-area')).toBeVisible(); await expect(page.locator('[data-g="gk-tap"]').first()).toBeVisible({ timeout: 8000 }); await page.locator('[data-g="gk-tap"]').first().click(); }],
  ['pfeilfieber', 2, async (page) => { await expect(page.locator('.pf-btn').first()).toBeVisible(); await page.locator('.pf-btn').first().dispatchEvent('pointerdown'); await expect(page.locator('.pf-info')).toContainText('Fehler'); }],
  ['sortierstation', 2, async (page) => { await expect(page.locator('.ss-box').first()).toBeVisible(); await page.waitForTimeout(700); await page.locator('.ss-box').first().click(); }],
  ['tickendes-paket', 3, async (page) => { await expect(page.locator('.tp-prompt')).toBeVisible(); }],
  ['werwolf', 6, async (page) => { await expect(page.locator('.ww-role')).toBeVisible(); }],
];
for (const [id, players, act] of SPIELE) {
  test(`${id}: hosten, Bots, starten, kurz spielen`, async ({ page, app }, testInfo) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await start(page, app);
    await host(page, id);
    await expect(page.locator('#kg')).toBeVisible();
    await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible(); // sitzt wirklich
    await page.locator('[data-kit-panel="host"]').first().click();
    for (let i = 1; i < players; i++) {
      await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText(`Bot ${i}`);
    }
    await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText(`Bot ${players - 1}`);
    await page.locator('.panel-head [data-kit="close"]').click();
    await page.getByRole('button', { name: /starten/ }).first().click();
    await act(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath(`${id}-${testInfo.project.name}.png`) });
    expect(errors).toEqual([]);
  });
}
