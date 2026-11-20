// NAV-01: einheitliche Sichtbarkeit von Kategorien und Bereichen in Seitenleiste, Mobil-Tabs, Menü, Bibliothek und Startseite.
// Ausblenden betrifft nur die Anzeige: direkte Adressen bleiben nutzbar, Einstellungen bleiben am Konto erhalten.
import { test, expect, login } from './helpers.js';

test.use({ createLimit: '100' });
const CATEGORIES = ['karten', 'wuerfel', 'brett', 'party', 'einzelspieler'];
const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); };
const settings = async (page) => { await go(page, '#einstellungen/hub'); await expect(page.locator('#set-hub')).toBeVisible(); };
const hrefs = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s + ' a[href]')].map((a) => a.getAttribute('href')), sel);
const NAVS = ['#side-nav', '#hub-menu-nav'];
const toggle = (page, path, value) => page.locator(`[data-set-list="${path}"][data-value="${value}"]`);
const stored = (page) => page.evaluate(async () => (await (await fetch('/api/me/settings', { credentials: 'same-origin' })).json()).settings.hub);
const idleGame = { id: 'idle-test', name: 'Idle-Test', category: 'idle', minPlayers: 1, maxPlayers: 1, desc: 'Testspiel', icon: '⏳' };
const withIdle = (page) => page.route('**/me', async (route) => {
  if (route.request().method() !== 'GET' || new URL(route.request().url()).pathname !== '/me') return route.fallback();
  const res = await route.fetch(), body = await res.json();
  body.singleplayerGames = [...(body.singleplayerGames || []), idleGame];
  await route.fulfill({ response: res, json: body });
});

test('N01: jede Kategorie ausblenden – Seitenleiste, Menü, Chips, Bibliothek und Zähler stimmen überein', async ({ page, app }) => {
  await login(page, app);
  await go(page, '#spiele');
  const total = Number((await page.locator('.category-all span').textContent()).trim());
  const all = await page.evaluate(() => [...document.querySelectorAll('#games-body .games > li')].length);
  expect(total).toBeGreaterThan(50);
  expect(all).toBeGreaterThan(0);
  for (const id of CATEGORIES) {
    await go(page, '#spiele');
    const before = Number((await page.locator('.category-all span').textContent()).trim());
    const count = Number((await page.locator(`#side-nav a[href="#spiele/${id}"] .count`).textContent()).trim());
    expect(count, `${id} hat Spiele`).toBeGreaterThan(0);
    await settings(page);
    await toggle(page, 'hub.hiddenCategories', id).uncheck();
    for (const nav of NAVS) expect(await hrefs(page, nav), `${nav} ohne ${id}`).not.toContain(`#spiele/${id}`);
    await go(page, '#start');
    await expect(page.locator('.home-categories')).toBeVisible();
    expect(await hrefs(page, '.home-categories'), `Startseite ohne ${id}`).not.toContain(`#spiele/${id}`);
    await go(page, '#spiele');
    expect(await hrefs(page, '.category-tabs')).not.toContain(`#spiele/${id}`);
    await expect(page.locator('.category-all span')).toHaveText(String(before - count));   // keine falsche Anzahl
    for (const other of CATEGORIES.filter((c) => c !== id)) expect(await hrefs(page, '.category-tabs')).toContain(`#spiele/${other}`);
    await settings(page);
    await toggle(page, 'hub.hiddenCategories', id).check();
    for (const nav of NAVS) expect(await hrefs(page, nav)).toContain(`#spiele/${id}`);
    await go(page, '#spiele');
    await expect(page.locator('.category-all span')).toHaveText(String(before));
  }
  // alle zusammen: kein leeres Kategorie-Menü in der Seitenleiste
  await settings(page);
  for (const id of CATEGORIES) await toggle(page, 'hub.hiddenCategories', id).uncheck();
  for (const nav of NAVS) await expect(page.locator(`${nav} .side-categories`)).toHaveCount(0);
  await expect(page.locator('#side-nav a[href="#spiele"]')).toHaveCount(1);
});

test('N02: ausgeblendete Kategorie – Spiel und Bibliothek bleiben per Adresse erreichbar, Favoriten und Verlauf bleiben', async ({ page, app }) => {
  await login(page, app);
  await go(page, '#spiele/brett');
  await settings(page);
  await toggle(page, 'hub.hiddenCategories', 'brett').uncheck();
  await go(page, '#spiele/brett');
  await expect(page.locator('.library-head h1')).toContainText('Brettspiele');
  await expect(page.locator('#games-body .games > li').first()).toBeVisible();
  await expect(page.locator('.category-tabs a[href="#spiele/brett"]')).toHaveAttribute('aria-current', 'page');
  // Zurück in der Browser-Historie bleibt konsistent: Seite ohne Kategorie, danach wieder mit direktem Link
  await go(page, '#spiele');
  expect(await hrefs(page, '.category-tabs')).not.toContain('#spiele/brett');
  await page.goBack();
  await expect(page.locator('.category-tabs a[href="#spiele/brett"]')).toHaveAttribute('aria-current', 'page');
  // Einzelspieler ausgeblendet: #solo/<id> startet weiterhin
  await settings(page);
  await toggle(page, 'hub.hiddenCategories', 'einzelspieler').uncheck();
  await go(page, '#solo/sudoku');
  await expect(page.locator('#singleplayer-root')).not.toBeEmpty();
  expect(await page.evaluate(() => location.hash)).toBe('#solo/sudoku');
});

test('N01/N06: Offene Tische und Favoriten haben eigene Schalter, Tische bleiben über Code und Adresse erreichbar', async ({ page, app }) => {
  await login(page, app);
  await settings(page);
  await expect(toggle(page, 'hub.hiddenBlocks', 'tables')).toBeChecked();
  await expect(toggle(page, 'hub.hiddenBlocks', 'favorites')).toBeChecked();
  await toggle(page, 'hub.hiddenBlocks', 'tables').uncheck();
  for (const nav of NAVS) expect(await hrefs(page, nav)).not.toContain('#tische');
  expect(await hrefs(page, '#hub-tabbar')).not.toContain('#tische');
  await go(page, '#start');
  await expect(page.locator('.live-tables')).toHaveCount(0);
  await expect(page.locator('.code-box')).toBeVisible();            // Beitritt per Code bleibt sichtbar
  await expect(page.locator('.welcome [data-create-table]')).toBeVisible();
  await go(page, '#tische');                                         // direkter Link bleibt nutzbar
  await expect(page.locator('h1')).toContainText('Offene Tische');
  await expect(page.locator('.code-box')).toBeVisible();
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'tables').check();
  await toggle(page, 'hub.hiddenBlocks', 'favorites').uncheck();
  for (const nav of NAVS) { expect(await hrefs(page, nav)).not.toContain('#favoriten'); expect(await hrefs(page, nav)).toContain('#tische'); }
  expect(await hrefs(page, '#hub-tabbar')).toContain('#tische');
  await go(page, '#start');
  await expect(page.locator('.live-tables')).toBeVisible();
  await expect(page.locator('[data-local-games="favorites"]')).toHaveCount(0);
  await go(page, '#favoriten');
  await expect(page.locator('.library-head h1')).toContainText('Favoriten');
});

test('N01: Eure Spieleabende folgt den Schaltern für Abend planen und Rückblicke', async ({ page, app }) => {
  await login(page, app);
  await go(page, '#start');
  await expect(page.locator('.evening-links a[href="#planung"]')).toBeVisible();
  await expect(page.locator('.evening-links a[href="#rueckblick"]')).toBeVisible();
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'planning').uncheck();
  await go(page, '#start');
  await expect(page.locator('.evening-links a[href="#planung"]')).toHaveCount(0);
  await expect(page.locator('.evening-links a[href="#rueckblick"]')).toBeVisible();
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'reviews').uncheck();
  await go(page, '#start');
  await expect(page.locator('.evening-links')).toHaveCount(0);        // kein leerer Block
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'planning').check();
  await go(page, '#start');
  await expect(page.locator('.evening-links a[href="#planung"]')).toBeVisible();
  await expect(page.locator('.evening-links a[href="#rueckblick"]')).toHaveCount(0);
  await go(page, '#rueckblick');                                       // direkter Link bleibt nutzbar
  await expect(page.locator('#hub')).toBeVisible();
});

test('N05: Idle erscheint erst mit einem registrierten Spiel und folgt dann demselben Sichtbarkeitspfad', async ({ page, app }) => {
  await login(page, app);
  // ohne Registrierung: kein Filter, kein Schalter, keine leere Karte, Direktlink fällt auf die Bibliothek zurück
  for (const nav of NAVS) expect(await hrefs(page, nav)).not.toContain('#spiele/idle');
  await settings(page);
  await expect(toggle(page, 'hub.hiddenCategories', 'idle')).toHaveCount(0);
  await go(page, '#spiele/idle');
  await expect(page.locator('.library-head h1')).toContainText('Spielebibliothek');
  expect(await hrefs(page, '.category-tabs')).not.toContain('#spiele/idle');
  expect(await page.evaluate(() => document.body.textContent.includes('Idle-Test'))).toBe(false);
  // mit registriertem Spiel (Test-Registry über die Kontoantwort)
  const second = await page.context().newPage();
  await withIdle(second);
  await second.goto(app.url);
  await expect(second.locator('#hub')).toBeVisible();
  await go(second, '#spiele/idle');
  await expect(second.locator('.library-head h1')).toContainText('Idle');
  expect(await hrefs(second, '#side-nav')).toContain('#spiele/idle');
  await settings(second);
  await expect(toggle(second, 'hub.hiddenCategories', 'idle')).toBeChecked();
  await toggle(second, 'hub.hiddenCategories', 'idle').uncheck();
  for (const nav of NAVS) expect(await hrefs(second, nav)).not.toContain('#spiele/idle');
  await go(second, '#spiele');
  expect(await hrefs(second, '.category-tabs')).not.toContain('#spiele/idle');
  // bestehende Kategorien bleiben unberührt
  for (const id of CATEGORIES) expect(await hrefs(second, '.category-tabs')).toContain(`#spiele/${id}`);
});

test('N04: Einstellungen bleiben nach dem Neuladen und in einer zweiten Browserinstanz erhalten, Reset stellt Standard her', async ({ page, app, browser }) => {
  await login(page, app);
  await settings(page);
  await toggle(page, 'hub.hiddenCategories', 'party').uncheck();
  await toggle(page, 'hub.hiddenBlocks', 'tables').uncheck();
  await toggle(page, 'hub.hiddenBlocks', 'favorites').uncheck();
  await expect.poll(async () => JSON.stringify(await stored(page))).toContain('"tables"');
  const saved = await stored(page);
  expect(saved.hiddenCategories).toEqual(['party']);
  expect(saved.hiddenBlocks.sort()).toEqual(['favorites', 'tables']);
  await page.reload();
  await expect(page.locator('#hub')).toBeVisible();
  for (const nav of NAVS) { const h = await hrefs(page, nav); expect(h).not.toContain('#tische'); expect(h).not.toContain('#favoriten'); expect(h).not.toContain('#spiele/party'); expect(h).toContain('#spiele/brett'); }
  // zweite Browserinstanz mit demselben Konto (Cookies übernommen, lokaler Speicher leer)
  const ctx = await browser.newContext({ storageState: await page.context().storageState() });
  const other = await ctx.newPage();
  await other.addInitScript(() => { try { localStorage.removeItem('poker:settings'); } catch { /* leer */ } });
  await other.goto(app.url);
  await expect(other.locator('#hub')).toBeVisible();
  await expect.poll(async () => hrefs(other, '#side-nav').then((h) => h.includes('#tische'))).toBe(false);
  expect(await hrefs(other, '#side-nav')).not.toContain('#spiele/party');
  await ctx.close();
  // Zurücksetzen des Bereichs stellt alles wieder her
  await settings(page);
  await page.locator('[data-set-reset="hub"]').click();
  await expect.poll(async () => (await stored(page)).hiddenBlocks.length).toBe(0);
  for (const nav of NAVS) { const h = await hrefs(page, nav); expect(h).toContain('#tische'); expect(h).toContain('#favoriten'); expect(h).toContain('#spiele/party'); }
});

test('N06: Schalter sind per Tastatur bedienbar, Fokus bleibt auf dem Schalter, Mobil-Tabs ohne Überlaufen', async ({ page, app }) => {
  await login(page, app);
  await settings(page);
  const sw = toggle(page, 'hub.hiddenBlocks', 'tables');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).not.toBeChecked();
  await expect(sw).toBeFocused();
  expect(await sw.getAttribute('role')).toBe('switch');
  await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  for (const id of ['tables', 'favorites']) await toggle(page, 'hub.hiddenBlocks', id).uncheck();
  await toggle(page, 'hub.hiddenBlocks', 'leaderboard').uncheck();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.locator('#set-hub').scrollIntoViewIfNeeded();
  // Englisch: neue Schalter sind übersetzt
  await page.locator('[data-set="display.language"]').selectOption('en');
  await expect(page.locator('#set-hub')).toContainText('Open tables');
  await expect(page.locator('#set-hub')).toContainText('Open tables');
  await expect(page.locator('#set-hub')).toContainText('Favourites');
});

test('N02: Favoriten – markieren, Ansicht aus- und einblenden, Kategorie aus- und einblenden, Neuladen', async ({ page, app }) => {
  await login(page, app);
  await go(page, '#spiele/brett');
  const card = page.locator('#games-body .games > li').first();
  const id = await card.getAttribute('data-id');
  await card.locator('[data-fav]').click();
  await expect(card.locator('[data-fav]')).toHaveAttribute('aria-pressed', 'true');
  const entry = page.locator(`#games-body .games > li[data-id="${id}"]`);
  await go(page, '#favoriten');
  await expect(entry).toBeVisible();
  await expect(page.locator('#games-body .games > li')).toHaveCount(1);
  // Favoriten-Bereich ausblenden: Reiter und Startseitenblock weg, Direktlink und Eintrag bleiben
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'favorites').uncheck();
  for (const nav of NAVS) expect(await hrefs(page, nav)).not.toContain('#favoriten');
  await go(page, '#start');
  await expect(page.locator('[data-local-games="favorites"]')).toHaveCount(0);
  await go(page, '#favoriten');
  await expect(entry).toBeVisible();
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'favorites').check();
  for (const nav of NAVS) expect(await hrefs(page, nav)).toContain('#favoriten');
  await go(page, '#start');
  await expect(page.locator(`[data-local-games="favorites"] [data-game-open="${id}"]`)).toBeVisible();
  // Kategorie des Favoriten ausblenden: der Eintrag fehlt in der Anzeige, der Favorit selbst bleibt gespeichert
  await settings(page);
  await toggle(page, 'hub.hiddenCategories', 'brett').uncheck();
  await go(page, '#favoriten');
  await expect(entry).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('poker:favs') || '[]'))).toContain(id);
  await settings(page);
  await toggle(page, 'hub.hiddenCategories', 'brett').check();
  await go(page, '#favoriten');
  await expect(entry).toBeVisible();
  // Neuladen: Favorit und Schalterzustand bleiben
  await settings(page);
  await toggle(page, 'hub.hiddenBlocks', 'favorites').uncheck();
  await page.reload();
  await expect(page.locator('#hub')).toBeVisible();
  for (const nav of NAVS) expect(await hrefs(page, nav)).not.toContain('#favoriten');
  await go(page, '#favoriten');
  await expect(entry).toBeVisible();
  // Offen (nicht automatisiert): Reconnect an einem laufenden Tisch und zweite Browserinstanz – Favoriten liegen nur im lokalen Browserspeicher.
});

test('N01: alle Kategorien ausgeblendet – keine leeren Blöcke, verständlicher Leerzustand, Direktlinks bleiben', async ({ page, app }) => {
  await login(page, app);
  await settings(page);
  for (const id of CATEGORIES) await toggle(page, 'hub.hiddenCategories', id).uncheck();
  await go(page, '#start');
  await expect(page.locator('.welcome')).toBeVisible();
  await expect(page.locator('.featured-games')).toHaveCount(0);
  await expect(page.locator('.home-categories')).toHaveCount(0);
  await go(page, '#spiele');
  await expect(page.locator('.category-all span')).toHaveText('0');
  const hint = page.locator('[data-all-hidden]');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Alle Spielkategorien sind in deinen Einstellungen ausgeblendet');
  await expect(page.locator('#games-body')).not.toContainText('anderen Filter');
  await go(page, '#favoriten');
  await expect(page.locator('[data-all-hidden]')).toBeVisible();
  // Direktlink zu einer ausgeblendeten Kategorie bleibt nutzbar
  await go(page, '#spiele/brett');
  await expect(page.locator('#games-body .games > li').first()).toBeVisible();
  await expect(page.locator('[data-all-hidden]')).toHaveCount(0);
  // Der Hinweis führt zu den Einstellungen; dort wieder einblenden stellt alles her
  await go(page, '#spiele');
  await page.locator('[data-all-hidden] a').click();
  await expect(page.locator('#set-hub')).toBeVisible();
  expect(await page.evaluate(() => location.hash)).toBe('#einstellungen/hub');
  await toggle(page, 'hub.hiddenCategories', 'karten').check();
  await go(page, '#start');
  await expect(page.locator('.featured-games')).toBeVisible();
  await expect(page.locator('.home-categories a')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  // Englisch
  await settings(page);
  await page.locator('[data-set="display.language"]').selectOption('en');
  await toggle(page, 'hub.hiddenCategories', 'karten').uncheck();
  await go(page, '#spiele');
  await expect(page.locator('[data-all-hidden]')).toContainText('All game categories are hidden in your settings.');
  await expect(page.locator('[data-all-hidden] a')).toHaveText('Show categories');
});

test('N06: Abendblock ist auf Deutsch und Englisch übersetzt, auch nach Sprachwechsel, Neuladen und neuem Rendern', async ({ page, app }) => {
  await login(page, app);
  const text = () => page.locator('.evening-links p').textContent().then((t) => t.trim());
  const DE = { both: 'Plant euren nächsten Abend oder schaut auf die letzten Runden zurück.', plan: 'Plant euren nächsten Abend.', review: 'Schaut auf die letzten Runden zurück.' };
  const EN = { both: 'Plan your next evening or look back on recent rounds.', plan: 'Plan your next evening.', review: 'Look back on recent rounds.' };
  const setBlocks = async (planning, reviews) => { await settings(page); await toggle(page, 'hub.hiddenBlocks', 'planning')[planning ? 'check' : 'uncheck'](); await toggle(page, 'hub.hiddenBlocks', 'reviews')[reviews ? 'check' : 'uncheck'](); await go(page, '#start'); };
  await go(page, '#start');
  expect(await text()).toBe(DE.both);
  await settings(page);
  await page.locator('[data-set="display.language"]').selectOption('en');
  await go(page, '#start');
  expect(await text()).toBe(EN.both);
  await expect(page.locator('.evening-links .btn').first()).toHaveText('Plan the next evening');
  await setBlocks(true, false); expect(await text()).toBe(EN.plan);
  await setBlocks(false, true); expect(await text()).toBe(EN.review);
  await page.reload();                                   // Neuladen behält Sprache und Schalter
  await expect(page.locator('#hub')).toBeVisible();
  await go(page, '#start');
  expect(await text()).toBe(EN.review);
  await settings(page);
  await page.locator('[data-set="display.language"]').selectOption('de');
  await go(page, '#start');
  expect(await text()).toBe(DE.review);                 // zurück auf Deutsch ohne Neuladen
  await setBlocks(true, true); expect(await text()).toBe(DE.both);
});
