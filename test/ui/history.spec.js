// Verlauf (history): Raum = /?t=CODE, Startseite = /#seite. „Zurück“ aus dem Raum führt zur Startseite (Platz bleibt), „Vor“ wieder an den Tisch;
// Links treten direkt bei; Neuladen bleibt am Tisch; Spielwechsel und bfcache hinterlassen keinen schwarzen Bildschirm.
// Läuft mit: npx playwright test test/ui/history.spec.js --project=mobil   (390 × 844, Touch)
import { test, expect } from './helpers.js';

const room = (page) => new URL(page.url()).searchParams.get('t');
const isRoomUrl = (page) => { const u = new URL(page.url()); return u.pathname === '/' && /^[A-Z2-9]{5}$/.test(u.searchParams.get('t') || '') && u.hash === ''; };

// Profil liegt schon im Browser (wie nach dem ersten Besuch); danach Passwort-Login
async function start(page, app, name = 'Anna', withProfile = true) {
  if (withProfile) {
    await page.addInitScript((n) => {
      try { // auf about:blank gibt es keinen Speicher
        if (!localStorage.getItem('poker:name')) {
          localStorage.setItem('poker:name', JSON.stringify(n));
          localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
          localStorage.setItem('poker:prefs', JSON.stringify({ intros: false }));
          localStorage.setItem('poker:favs', JSON.stringify(['maumau'])); // die Startseite zeigt nur die ersten sechs Spiele
        }
      } catch { /* egal */ }
    }, name);
  } else {
    await page.addInitScript(() => { try { localStorage.setItem('poker:prefs', JSON.stringify({ intros: false })); localStorage.setItem('poker:favs', JSON.stringify(['maumau'])); } catch { /* egal */ } });
  }
  await page.goto(app.url);
  await page.getByLabel('Passwort').fill(app.password);
  await page.getByRole('button', { name: 'Reinkommen' }).click();
  await expect(page.locator('#hub')).toBeVisible();
  // Wie ein Nutzer mit bestehender Sitzung: vor der Startseite liegt kein Login-Eintrag im Verlauf, „Zurück“ verlässt sonst die Seite
  await page.goto('about:blank');
  await page.goto(app.url);
}
// nav: false = die Kachel auf der Startseite nehmen (kein Wechsel der Hub-Seite, der Verlauf bleibt unberührt)
async function hostGame(page, id, { nav = true } = {}) {
  await expect(page.locator('#hub')).toBeVisible();
  if (nav) await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator(`[data-host="${id}"]`).first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  await expect.poll(() => isRoomUrl(page)).toBe(true);
  return room(page);
}
const guestContext = (browser) => browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('Hub → hosten → URL ist ?t=CODE → Zurück: Hub, Tisch unter „Weiterspielen“ → Vor: wieder am Tisch', async ({ page, app }) => {
  await start(page, app);
  const code = await hostGame(page, 'maumau', { nav: false });
  expect(page.url()).toBe(`${app.url}/?t=${code}`);
  await expect(page.locator('#hub')).toBeHidden();

  await page.goBack();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('#game-root')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('t')).toBeNull();
  // Platz behalten: der Tisch steht ganz vorne
  await expect(page.locator('.table-card.mine')).toContainText(code);
  await expect(page.locator('.table-card.mine')).toContainText('Mau-Mau');

  await page.goForward();
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#hub')).toBeHidden();
  expect(page.url()).toBe(`${app.url}/?t=${code}`);
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Mau-Mau');
});

test('Zurück und Vor: derselbe Raum, Zustand und Platz bleiben', async ({ page, app }) => {
  await start(page, app);
  const code = await hostGame(page, 'maumau', { nav: false });
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await expect(page.locator('#kg')).toContainText('Anna');
  await page.goBack();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('.table-card.mine')).toContainText(code);
  await page.goForward();
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#hub')).toBeHidden();
  expect(page.url()).toBe(`${app.url}/?t=${code}`);
  await expect(page.locator('#kg')).toContainText('Anna');
  await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible(); // sitzt noch
  await expect(page.locator('#lost')).toBeHidden();
});

test('Link ?t=CODE ohne Token, mit Profil: direkt am Tisch (ohne Zwischenstopp im Hub)', async ({ page, app, browser }) => {
  await start(page, app, 'Anna');
  const code = await hostGame(page, 'maumau', { nav: false });
  const ctx = await guestContext(browser);
  const guest = await ctx.newPage();
  const errors = [];
  guest.on('pageerror', (e) => errors.push(e.message));
  await start(guest, app, 'Zoe');
  await expect(guest.locator('#hub')).toBeVisible();
  await guest.goto(`${app.url}/?t=${code}`);
  await expect(guest.locator('#kg')).toBeVisible();
  await expect(guest.locator('#hub')).toBeHidden();
  expect(guest.url()).toBe(`${app.url}/?t=${code}`);
  await expect(guest.locator('#kg-meta .blinds')).toHaveText('Mau-Mau');
  expect(await guest.evaluate(() => lastState.you.name)).toBe('Zoe');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('Link ?t=CODE ohne Token und ohne Profil: erst Profil-Dialog, dann beitreten', async ({ page, app, browser }) => {
  await start(page, app, 'Anna');
  const code = await hostGame(page, 'maumau', { nav: false });
  const ctx = await guestContext(browser);
  const guest = await ctx.newPage();
  await start(guest, app, 'x', false);
  await guest.goto(`${app.url}/?t=${code}`);
  await expect(guest.locator('#profile-dlg')).toBeVisible();
  await expect(guest.locator('#kg')).toBeHidden();
  await guest.locator('#p-name').fill('Ben');
  await guest.getByRole('button', { name: 'Speichern' }).click();
  await expect(guest.locator('#kg')).toBeVisible();
  expect(await guest.evaluate(() => lastState.you.name)).toBe('Ben');
  expect(guest.url()).toBe(`${app.url}/?t=${code}`);
  await ctx.close();
});

test('Link zu einem Tisch, den es nicht gibt: Hinweis und Startseite, keine kaputte Adresse', async ({ page, app }) => {
  await start(page, app);
  await expect(page.locator('#hub')).toBeVisible();
  await page.goto(`${app.url}/?t=ZZZZZ`);
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('#toast')).toContainText(/nicht|gibt/i);
  await expect(page.locator('#game-root')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('t')).toBeNull();
});

test('Spiel A spielen → Hub → Spiel B betreten → Zurück: kein schwarzer Bildschirm, Hub sichtbar', async ({ page, app }) => {
  await start(page, app);
  const a = await hostGame(page, 'maumau');
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Mau-Mau');
  await page.goBack();
  await expect(page.locator('#hub')).toBeVisible();
  const b = await hostGame(page, 'viergewinnt'); // anderes Spiel, anderer Raum: die Seite lädt frisch
  expect(b).not.toBe(a);
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Vier gewinnt');
  expect(page.url()).toBe(`${app.url}/?t=${b}`);
  await expect(page.locator('#lost')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#hub')).toBeVisible();
  await expect(page.locator('#game-root')).toBeHidden();
  await page.waitForTimeout(3500); // der Wächter darf nichts melden
  await expect(page.locator('#lost')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('t')).toBeNull();
});

test('Neuladen im Raum: wieder am Tisch, Adresse unverändert', async ({ page, app }) => {
  await start(page, app);
  const code = await hostGame(page, 'maumau', { nav: false });
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await page.reload();
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#kg-meta .blinds')).toHaveText('Mau-Mau');
  expect(page.url()).toBe(`${app.url}/?t=${code}`);
  await expect(page.locator('#kg')).toContainText('Anna');
});

test('Raum betreten legt genau einen Verlaufseintrag an; die Hash-Navigation der Startseite überschreibt ?t= nicht', async ({ page, app }) => {
  await start(page, app);
  const before = await page.evaluate(() => history.length);
  const code = await hostGame(page, 'maumau', { nav: false });
  expect(await page.evaluate(() => history.length) - before).toBe(1);
  // Im Raum ändert die Hash-Navigation der Startseite nichts an der Anzeige
  await page.evaluate(() => { location.hash = '#bestenliste'; });
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#hub')).toBeHidden();
  expect(new URL(page.url()).searchParams.get('t')).toBe(code);
});

test('pageshow aus dem bfcache (persisted): die Seite lädt sich neu und ist wieder lebendig', async ({ page, app }) => {
  await start(page, app);
  const code = await hostGame(page, 'maumau', { nav: false });
  await page.evaluate(() => { window.__alt = true; });
  const reloaded = page.waitForEvent('load');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await reloaded;
  await expect(page.locator('#kg')).toBeVisible();
  expect(await page.evaluate(() => window.__alt)).toBeUndefined();
  expect(page.url()).toBe(`${app.url}/?t=${code}`);
});

test('Verbindung weg: nach 3 s Hinweis „Verbindung verloren“ mit „Neu laden“ statt schwarzem Bildschirm', async ({ page, app }) => {
  await start(page, app);
  const code = await hostGame(page, 'maumau', { nav: false });
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await expect(page.locator('#lost')).toBeHidden();
  await page.evaluate(() => socket.disconnect()); // nach einem manuellen Trennen verbindet Socket.IO nicht von selbst neu
  await expect(page.locator('#lost')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#lost')).toContainText('Verbindung verloren');
  await page.getByRole('button', { name: 'Neu laden', exact: true }).click();
  await expect(page.locator('#kg')).toBeVisible();
  await expect(page.locator('#lost')).toBeHidden();
  expect(room(page)).toBe(code);
});
