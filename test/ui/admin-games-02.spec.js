// ADMIN-GAMES-02: echte Browserprüfung – Host-Menü „Spiel wechseln“ ist nach Kategorie und A–Z sortiert und funktioniert.
import { test, expect, login, selectGame } from './helpers.js';

const CATEGORY_ORDER = ['karten', 'wuerfel', 'brett', 'party', 'einzelspieler', 'idle'];

test('Host-Menü „Spiel wechseln“: Kategorien in fester Reihenfolge, darin A–Z, Wechsel funktioniert', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'farbenchaos'); // UNO
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  await page.locator('[data-kit-panel="host"]').first().click();
  const select = page.locator('#switch-game');
  await expect(select).toBeVisible();

  const options = await select.evaluate((el) => [...el.querySelectorAll('option')].map((o) => ({ id: o.value, name: o.textContent, group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.dataset.category : null })));
  expect(options.length).toBeGreaterThan(40);
  expect(options.find((o) => o.id === 'farbenchaos'), 'aktuelles Spiel fehlt in der Liste').toBeUndefined();
  const me = await (await page.request.get(app.url + '/me')).json();
  const category = Object.fromEntries(me.games.map((g) => [g.id, g.category]));
  const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
  let lastRank = -1, lastName = null;
  for (const o of options) {
    const rank = CATEGORY_ORDER.indexOf(category[o.id]);
    expect(rank, o.id).toBeGreaterThanOrEqual(0);
    expect(o.group, `${o.id} liegt in der Gruppe seiner Kategorie`).toBe(category[o.id]);
    if (rank === lastRank) expect(collator.compare(lastName, o.name), `${lastName} vor ${o.name}`).toBeLessThanOrEqual(0);
    else expect(rank).toBeGreaterThan(lastRank);
    lastRank = rank; lastName = o.name;
  }

  await select.selectOption('maumau');
  await page.locator('[data-switch-game]').click();
  await page.getByRole('button', { name: 'Wechseln' }).last().click();
  await expect(page.locator('#kg')).toBeVisible();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('maumau');
});
