// Home-Knopf (Platz behalten / Tisch verlassen) und Host-Menü „Spiel beenden“.
// Läuft mit: npx playwright test test/ui/leave.spec.js --project=mobil   (390 × 844, Touch)
import { test, expect } from './helpers.js';

async function start(page, app, name = 'Anna') {
  await page.addInitScript((n) => {
    try {
      if (!localStorage.getItem('poker:name')) {
        localStorage.setItem('poker:name', JSON.stringify(n));
        localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
        localStorage.setItem('poker:prefs', JSON.stringify({ intros: false }));
        localStorage.setItem('poker:favs', JSON.stringify(['maumau'])); // die Startseite zeigt nur die ersten sechs Spiele
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
  await page.locator(`[data-host="${id}"]`).first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  return new URL(page.url()).searchParams.get('t');
}

test('Home-Knopf: Platz behalten → Tisch unter „Weiterspielen“ → zurück an den Tisch', async ({ page, app }) => {
  await start(page, app);
  const code = await host(page, 'maumau');
  await page.locator('#kg [data-home="open"]').click();
  await expect(page.locator('#home-dlg')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath('home-dialog.png') });
  await page.getByRole('button', { name: 'Platz behalten' }).click();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('.table-card.mine')).toContainText(code);
  await page.locator('.table-card.mine .tc-actions button, .table-card.mine .tc-actions a').first().click();
  await expect(page.locator('#kg')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('t')).toBe(code);
});

test('Home-Knopf: Tisch verlassen → kein Weiterspielen mehr, Code frei', async ({ page, app }) => {
  await start(page, app);
  await host(page, 'maumau');
  await page.locator('#kg [data-home="open"]').click();
  await page.getByRole('button', { name: 'Tisch verlassen' }).click();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('.table-card.mine')).toHaveCount(0);
});

test('Host-Menü „Spiel beenden“: Runde abbrechen und Tisch schließen mit Bestätigung', async ({ page, app }) => {
  await start(page, app);
  await host(page, 'maumau');
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await page.locator('#kg [data-kit-panel="host"]').click();
  await expect(page.locator('[data-end="abort"]')).toBeDisabled();
  await page.screenshot({ path: test.info().outputPath('host-spiel-beenden.png') });
  await page.locator('[data-end="close"]').click();
  await expect(page.locator('#dlg')).toBeVisible();
  await page.locator('#dlg-ok').click();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('geschlossen');
});
