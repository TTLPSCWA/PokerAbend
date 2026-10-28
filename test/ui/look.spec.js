// „Ansehen“: Skip-Bo-Stapelansicht (Ablagen aller, Baureihen mit Folge) und Schließen per Esc / Klick daneben.
// Läuft mit: npx playwright test test/ui/look.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
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
  await expect(page.locator('#kg')).toBeVisible();
  return new URL(page.url()).searchParams.get('t');
}

async function skipBo(page, app) {
  await start(page, app);
  await host(page, 'stapelrennen');
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await page.locator('[data-kit-panel="host"]').first().click();
  await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText('Bot 1');
  await page.locator('.panel-head [data-kit="close"]').click();
  await page.getByRole('button', { name: /starten/ }).first().click();
  await expect(page.locator('.st-builds')).toBeVisible();
}

test('Skip-Bo: Lupe öffnet Ablagen und Baureihen, Esc und Klick daneben schließen', async ({ page, app }, testInfo) => {
  await skipBo(page, app);
  await page.locator('#kg-nav-look').click();
  const dlg = page.locator('#look-dlg');
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText('Baureihen in der Mitte');
  await expect(dlg).toContainText('Deine Ablagen');
  await expect(dlg).toContainText('Ablagen von Bot 1');
  await expect(dlg).toContainText('nächste: 1');
  await expect(dlg.getByText('Handkarten')).toHaveCount(0);
  await page.waitForTimeout(400); // Einblend-Animation abwarten
  await page.screenshot({ path: testInfo.outputPath(`skipbo-ansehen-${testInfo.project.name}.png`) });
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  // Lupe neben den Ablagen
  await page.locator('.look-btn').first().click();
  await expect(dlg).toBeVisible();
  await page.mouse.click(2, 2); // daneben
  await expect(dlg).toBeHidden();
});
