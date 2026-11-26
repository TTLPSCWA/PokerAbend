// SEC-SOCKET-01: Ein Logout in einem anderen Tab sperrt die offene Verbindung dieses Tabs; der Tab führt zur Anmeldung
// und lässt den gespeicherten Platz-Token für „Weiterspielen“ stehen.
import { test, expect, login } from './helpers.js';

test('SEC-SOCKET-01: Logout in einem zweiten Tab führt den ersten Tab zur Anmeldung, der Platz-Token bleibt', async ({ page, app }) => {
  await login(page, app);
  const second = await page.context().newPage();
  await second.goto(app.url); // eigener Seitenaufruf: der Browser bekommt dabei einen neueren Cookie-Wert
  await expect(second.locator('#hub')).toBeVisible();
  // erst jetzt ablegen: beim Laden räumt die Startseite gespeicherte Plätze ohne Tisch auf
  await page.evaluate(() => localStorage.setItem('poker:session:ABCDE', JSON.stringify('platz-token-test')));
  await second.evaluate(() => fetch('/logout', { method: 'POST', redirect: 'manual' }));
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 10_000 });
  expect(await page.evaluate(() => localStorage.getItem('poker:session:ABCDE'))).toBe(JSON.stringify('platz-token-test'));
  await second.close();
});
