// ADMIN-GAMES-02: echte Browserprüfung der Adminseite (Desktop und Handy): Spieleverwaltung, Endpunktkatalog, Spielerverwaltung.
import { test, expect, login } from './helpers.js';

test.describe('Adminseite (ADMIN-GAMES-02)', () => {
  test.use({ adminPassword: 'Admin-Test-0202' });

  async function openAdmin(page, app) {
    const context = page.context(), admin = await context.newPage(); // eigener Tab im selben Browserprofil (WebKit startet neue Profile auf Windows unzuverlässig)
    const errors = [];
    admin.on('pageerror', (e) => errors.push(e.message));
    await admin.goto(app.url);
    if (await admin.getByRole('button', { name: 'Reinkommen' }).count()) {
      await admin.getByLabel('Passwort').fill(app.password);
      await admin.getByRole('button', { name: 'Reinkommen' }).click();
      await expect(admin.locator('#hub')).toBeVisible();
    }
    await admin.goto(app.url + '/admin');
    await admin.locator('#pw').fill('Admin-Test-0202');
    await admin.getByRole('button', { name: 'Anmelden' }).click();
    await expect(admin.locator('#app')).toBeVisible();
    return { context, admin, errors };
  }
  const noOverflow = (admin) => admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  test('Spiele nach Kategorie, alle drei Idle-Games, Kategorie ausblenden wirkt in der Bibliothek', async ({ page, app }, info) => {
    await login(page, app);
    const { admin, errors } = await openAdmin(page, app);
    try {
      const section = admin.locator('#mod-features');
      await section.locator('#feature-cat').selectOption('idle');
      const idle = section.locator('details[data-cat="idle"]');
      await expect(idle).toBeVisible();
      for (const name of ['Die Spielhalle', 'Game Studio Tycoon', 'Factory Empire']) await expect(idle).toContainText(name);
      await section.locator('#feature-cat').selectOption('');
      const titles = await section.locator('details.cat > summary > span:first-child').allTextContents();
      expect(titles).toEqual(['Kartenspiele', 'Würfelspiele', 'Brettspiele', 'Partyspiele', 'Einzelspieler', 'Idle-Games']);
      const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
      for (const cat of ['karten', 'wuerfel', 'brett', 'party', 'einzelspieler', 'idle']) {
        const names = await section.locator(`details[data-cat="${cat}"] .game-card b`).allTextContents();
        expect(names.length, cat).toBeGreaterThan(0);
        expect(names, `${cat} A–Z`).toEqual([...names].sort(collator.compare));
      }
      expect(await section.locator('details[data-cat="party"] .game-card', { hasText: 'Meme-Duell' }).count()).toBeGreaterThan(0);
      expect(await section.locator('details[data-cat="einzelspieler"] .game-card', { hasText: 'Slot' }).count()).toBeGreaterThan(0);
      await section.locator('button[data-bulk="off"][data-cat="wuerfel"]').click();
      await admin.locator('#confirm-ok').click();
      await expect(section.locator('details[data-cat="wuerfel"] .pill.good')).toContainText('0 aktiv');
      const me = await (await page.request.get(app.url + '/me')).json();
      expect(me.games.some((g) => g.category === 'wuerfel')).toBe(false);
      expect(await noOverflow(admin), 'kein seitliches Überlaufen').toBe(true);
      await admin.screenshot({ path: `test-results/admin-games-${info.project.name}.png` });
      expect(errors).toEqual([]);
    } finally { await admin.close(); }
  });

  test('Endpunktkatalog: /me enthalten, durchsuchbar, Pfade kopierbar, keine Schreibzugriffe per Klick', async ({ page, app }) => {
    const { admin, errors } = await openAdmin(page, app);
    try {
      const calls = [];
      admin.on('request', (r) => { if (r.url().includes('/api/') && r.method() !== 'GET') calls.push(r.method() + ' ' + r.url()); });
      const section = admin.locator('#mod-endpoints');
      await section.locator('#ep-search').fill('Konto, Spielliste');
      await expect(section.locator('.ep-path', { hasText: /^\/me$/ })).toBeVisible();
      await section.locator('#ep-search').fill('');
      await section.locator('#ep-level').selectOption('unknown');
      await expect(section).toContainText('Schutzprüfung erforderlich');
      await section.locator('#ep-level').selectOption('');
      await section.locator('#ep-method').selectOption('POST');
      await expect(section.locator('.method.write').first()).toBeVisible();
      expect(await section.locator('a[href^="/api"]').count(), 'API-Pfade sind nie verlinkt').toBe(0);
      await section.locator('#ep-method').selectOption('');
      await section.locator('#ep-search').fill('/api/me/export');
      await admin.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
      await section.locator('button[data-copy="/api/me/export"]').first().click();
      await expect(admin.locator('#msg')).toContainText('/api/me/export');
      expect(calls, 'der Katalog führt nie POST/PUT/PATCH/DELETE aus').toEqual([]);
      expect(await noOverflow(admin)).toBe(true);
      expect(errors).toEqual([]);
    } finally { await admin.close(); }
  });

  test('Spielerverwaltung: zusammenführen mit Vergleich, Mehrfachlöschung mit Voranzeige – auf isolierten Testkonten', async ({ page, app, browser }, info) => {
    for (let i = 0; i < 4; i++) { // vier weitere Gast-Konten
      const ctx = await browser.newContext(); const pg = await ctx.newPage();
      await pg.goto(app.url + '/login'); await pg.getByLabel('Passwort').fill(app.password); await pg.getByRole('button', { name: 'Reinkommen' }).click();
      await pg.waitForLoadState('networkidle'); await ctx.close();
    }
    const { admin, errors } = await openAdmin(page, app);
    try {
      const section = admin.locator('#mod-players');
      await section.locator('#player-search button[type=submit]').click();
      const total = async () => Number((await section.locator('#player-count').textContent()).match(/von (\d+)/)[1]);
      const before = await total();
      expect(before).toBeGreaterThanOrEqual(4);
      // Zusammenführen: Quelle = Zeile 1, Ziel = Zeile 2, Vergleich zeigt beide, Bestätigen
      const rows = section.locator('#players tbody tr');
      const g1 = (await rows.nth(0).locator('code').textContent()).trim(), g2 = (await rows.nth(1).locator('code').textContent()).trim();
      await rows.nth(0).locator('[data-merge-from]').click();
      await rows.nth(1).locator('[data-merge-to]').click();
      await section.locator('#merge-compare').click();
      await expect(admin.locator('#danger')).toContainText(g1);
      await expect(admin.locator('#danger')).toContainText(g2);
      await expect(admin.locator('#danger')).toContainText('Quelle');
      await admin.locator('#danger-ok').click();
      await expect(admin.locator('#msg')).toContainText('zusammengeführt');
      await expect.poll(total).toBe(before - 1);
      // Mehrfachlöschung: zwei Zeilen auswählen, Voranzeige prüfen, bestätigen
      const rows2 = section.locator('#players tbody tr');
      const gone = [(await rows2.nth(0).locator('code').textContent()).trim(), (await rows2.nth(1).locator('code').textContent()).trim()];
      await rows2.nth(0).locator('input[data-pick]').check(); await rows2.nth(1).locator('input[data-pick]').check();
      await expect(section.locator('#player-selected')).toHaveText('2 ausgewählt');
      await section.locator('#player-delete').click();
      await expect(admin.locator('#danger')).toContainText('2 Spieler endgültig löschen');
      await expect(admin.locator('#danger')).toContainText('Sicherung');
      await admin.locator('#danger-ok').click();
      await expect(admin.locator('#msg')).toContainText('2 Spieler gelöscht');
      await expect.poll(total).toBe(before - 3);
      for (const id of gone) await expect(section.locator('#players', { hasText: id })).toHaveCount(0);
      expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
    } finally { await admin.close(); }
  });

  test('Spielerverwaltung: Liste, Auswahl, Löschen abbrechen, Alle löschen verlangt Text und Passwort',async ({ page, app, browser }, info) => {
    await login(page, app, 'Anna');
    const { admin, errors } = await openAdmin(page, app);
    try {
      const section = admin.locator('#mod-players');
      await expect(section.locator('#players tbody tr').first()).toBeVisible();
      await expect(section.locator('#player-count')).toContainText('Konten');
      const first = section.locator('#players tbody tr').first();
      const gid = (await first.locator('code').textContent()).trim();
      await first.locator('input[data-pick]').check();
      await expect(section.locator('#player-selected')).toHaveText('1 ausgewählt');
      await section.locator('#player-delete').click();
      await expect(admin.locator('#danger')).toBeVisible();
      await expect(admin.locator('#danger')).toContainText('endgültig löschen');
      await admin.locator('#danger-cancel').click();
      await expect(section.locator('#players', { hasText: gid })).toBeVisible();
      await first.locator('[data-merge-from]').click();
      await expect(section.locator('#merge-compare')).toBeDisabled();
      await section.locator('#player-delete-all').click();
      await expect(admin.locator('#danger-phrase-field')).toBeVisible();
      await admin.locator('#danger-ok').click();
      await expect(admin.locator('#danger-error')).toContainText('Bestätigungstext');
      await admin.locator('#danger-phrase').fill('ALLE SPIELER LÖSCHEN');
      await admin.locator('#danger-ok').click();
      await expect(admin.locator('#danger-error')).toContainText('Passwort');
      await admin.locator('#danger-cancel').click();
      expect(await noOverflow(admin), 'kein seitliches Überlaufen').toBe(true);
      await admin.screenshot({ path: `test-results/admin-players-${info.project.name}.png` });
      expect(errors).toEqual([]);
    } finally { await admin.close(); }
  });
});

test.describe('Idle-Spiel ausblenden (ADMIN-GAMES-02)', () => {
  test.use({ adminPassword: 'Admin-Test-0202', idleHall: true });

  test('Ausgeblendet: nicht in /me und serverseitig gesperrt; Einblenden stellt es wieder her', async ({ page, app }) => {
    await login(page, app);
    const meGames = async () => (await (await page.request.get(app.url + '/me')).json()).idleGames.map((g) => g.id);
    expect(await meGames()).toContain('spielhalle');
    const open = await page.request.get(app.url + '/api/idle/spielhalle');
    expect(open.status()).not.toBe(404);
    const admin = (path, value) => page.request.post(app.url + '/admin/api' + path, { data: value, headers: { 'x-requested-with': 'spieleabend', origin: app.url } });
    expect((await admin('/login', { password: 'Admin-Test-0202' })).status()).toBe(200);
    expect((await admin('/features/games/spielhalle', { value: false })).status()).toBe(200);
    expect(await meGames()).not.toContain('spielhalle');
    const closed = await page.request.get(app.url + '/api/idle/spielhalle');
    expect(closed.status()).toBe(404);
    expect((await closed.json()).code).toBe('game-disabled');
    expect((await page.request.post(app.url + '/api/idle/spielhalle/save', { data: {}, headers: { origin: app.url } })).status()).toBe(404);
    expect((await admin('/features/games/spielhalle', { value: true })).status()).toBe(200);
    expect(await meGames()).toContain('spielhalle');
    expect((await page.request.get(app.url + '/api/idle/spielhalle')).status()).not.toBe(404);
  });
});
