// VIS-013 (Erweiterung): eigener Lobbybildschirm für Schiffe versenken, je Design. Geprüft im laufenden Spiel: Inhalt aus dem Raumzustand,
// keine zweite Spielerliste (die Plätze zeigt die Plattform), keine Bereitschaft vor dem Start, Host-/Raumaktionen erreichbar, Zuschauer,
// Wiederverbinden, Englisch, sechs Größen. Mit LOBBY_CAPTURE=1 entstehen die Bilder unter docs/design/screenshots/schiffe/lobby-*.jpg.
import { test, expect, login, selectGame } from './helpers.js';
import { independentPlayer } from './independent-player.js';
import { mkdirSync } from 'node:fs';
import { SKINS } from '../../games/schiffe/skins.js';

const DIR = 'docs/design/screenshots/schiffe';
const SKIN_IDS = SKINS.map((s) => s.id);
const SIZES = [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [360, 800], [900, 450]];
const GERMAN = /(?:^|[^A-Za-zÄÖÜäöüß])(und|oder|nicht|noch|eure|euch|ihr|wer|der|die|das|ein|eine|mit|auf|wird|ist|beide|Plätze|Schiffe|Flotte|Variante|Mitspieler|Zuschauer)(?=$|[^A-Za-zÄÖÜäöüß])/;
const shot = async (page, name) => {
  if (process.env.LOBBY_CAPTURE === '1') { mkdirSync(DIR, { recursive: true }); await page.screenshot({ path: `${DIR}/${name}.jpg`, type: 'jpeg', quality: 82 }); }
};
async function host(page, app, { skin, variant = 'classic', sit = true } = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, 'schiffe');
  if (await page.locator('[data-choice-key=skin]').count()) await page.locator(`[data-choice-key=skin][data-choice-value="${skin}"]`).click();
  await page.locator('#host-variant').selectOption(variant);
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('.sv-lobby')).toBeVisible();
  if (sit) await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  return page.evaluate(() => lastState.code);
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);

for (const skin of SKIN_IDS) for (const variant of ['classic', 'salvo']) {
  test(`VIS-013 Lobby ${skin}/${variant}: Inhalt aus dem Raumzustand, leer, halb, voll, Start`, async ({ page, app }, info) => {
    test.setTimeout(90000);
    const code = await host(page, app, { skin, variant, sit: false });
    const lobby = page.locator('.sv-lobby');
    await expect(lobby).toHaveAttribute('data-skin', skin);
    const text = () => lobby.innerText();
    // leer: niemand sitzt, Zuschauerstatus
    await expect(page.locator('.sv-lb-status b')).toContainText('0 / 2');
    await expect(page.locator('.sv-lb-status')).toContainText('Mitspieler');
    expect(await text()).toContain('Du schaust zu');
    await shot(page, `lobby-${skin}-${variant}-leer-${info.project.name}`);
    // Raumwerte stammen aus dem Zustand
    const st = await page.evaluate(() => ({ skin: lastState.settings.skin, variant: lastState.variant, classic: lastState.settings.classic, turnTime: lastState.settings.turnTime }));
    expect(st.skin).toBe(skin);
    await expect(page.locator('.sv-lb-facts')).toContainText(skin === 'space' ? 'Taktik-Konsole' : 'Klassisch');
    await expect(page.locator('.sv-lb-facts')).toContainText(variant === 'salvo' ? 'Salvo' : 'Treffer');
    await expect(page.locator('.sv-lb-facts')).toContainText('5 Schiffe');
    await expect(page.locator('.sv-lb-facts')).toContainText(`${st.turnTime} s`);
    await expect(page.locator('.sv-lb-steps')).toContainText(variant === 'salvo' ? 'Salve' : 'Feuern');
    // halb: der Host sitzt
    await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
    await expect(page.locator('.sv-lb-status b')).toContainText('1 / 2');
    expect(await text()).not.toContain('Du schaust zu');
    await expect(page.locator('[data-kit=start]')).toBeDisabled();
    // keine zweite Spielerliste und keine Bereitschaft in der Lobby: weder Name noch Spielerplatz noch Knopf
    expect(await text()).not.toContain('Anna');
    await expect(lobby.locator('.ks, .kp, button, input, select')).toHaveCount(0);
    // nichts aus dem Spiel in der Lobby
    await expect(page.locator('.sv-cell, .sv-board, .sv-vessel')).toHaveCount(0);
    // voll: zweiter Platz, Host kann starten
    const ben = await independentPlayer(app, code, 'Ben');
    try {
      await expect(page.locator('.sv-lb-status b')).toContainText('2 / 2');
      await expect(page.locator('.sv-lb-status')).toContainText('du kannst die Runde unten starten');
      await expect(page.locator('[data-kit=start]')).toBeEnabled();
      await expect(page.locator('.sv-lb-pips i.on')).toHaveCount(2);
      await shot(page, `lobby-${skin}-${variant}-voll-${info.project.name}`);
      // Gast sieht denselben Raum, aber ohne Startrecht
      expect((await page.evaluate(() => send('start'))).ok).toBe(true);
      await expect(page.locator('.sv-lobby')).toHaveCount(0);
      await expect(page.locator('.sv-board').first()).toBeVisible();
      await expect(page.locator('#kg')).toHaveAttribute('data-sv-skin', skin);
    } finally { await ben.close(); }
  });
}

test('VIS-013 Lobby: Zuschauer und Mitspieler sehen denselben Raum, nur der Host startet; Wiederverbinden und Rückkehr', async ({ page, app, browser }, info) => {
  test.setTimeout(90000);
  const skin = SKIN_IDS.at(-1);
  const code = await host(page, app, { skin, variant: 'salvo' });
  const ben = await independentPlayer(app, code, 'Ben');
  const context = await browser.newContext({ ...info.project.use, viewport: page.viewportSize() });
  try {
    const watcher = await context.newPage(); await login(watcher, app, 'Zoe');
    await watcher.evaluate((c) => joinAndEnter(c, 'watch'), code);
    await expect(watcher.locator('.sv-lobby')).toHaveAttribute('data-skin', skin);
    await expect(watcher.locator('.sv-lb-facts')).toContainText('Salvo');
    await expect(watcher.locator('.sv-lb-status')).toContainText('Du schaust zu');
    await expect(watcher.locator('.sv-lb-status')).toContainText('der Host startet');
    await expect(watcher.locator('.sv-lb-status')).toContainText('1 Zuschauer');
    await expect(watcher.locator('[data-kit=start]')).toHaveCount(0);
    // Wiederverbinden: Neuladen bringt dieselbe Lobby zurück
    await page.reload();
    await expect(page.locator('.sv-lobby')).toHaveAttribute('data-skin', skin);
    await expect(page.locator('.sv-lb-status b')).toContainText('2 / 2');
    // Rückkehr: zur Startseite und wieder an den Tisch
    await page.evaluate(() => { location.hash = '#start'; });
    await page.evaluate((c) => joinAndEnter(c), code);
    await expect(page.locator('.sv-lobby')).toBeVisible();
  } finally { await context.close(); await ben.close(); }
});

for (const skin of SKIN_IDS) test(`VIS-013 Lobby ${skin}: Englisch ohne deutsche Reste`, async ({ page, app }) => {
  test.setTimeout(60000);
  await host(page, app, { skin });
  await page.evaluate(() => I18n.select('en'));
  await expect(page.locator('.sv-lb-status')).toContainText('seats taken');
  const text = await page.locator('.sv-lobby').innerText();
  const found = text.split(/\n+/).filter((l) => GERMAN.test(l));
  expect(found, 'deutsche Reste: ' + JSON.stringify(found)).toEqual([]);
  expect(text).toMatch(/Two fleets/i);
});

for (const [w, h] of SIZES) for (const skin of SKIN_IDS) {
  test(`VIS-013 Lobby ${skin} ${w}×${h}: nichts läuft über, Raumaktionen erreichbar`, async ({ page, app }, info) => {
    test.setTimeout(60000);
    test.skip(info.project.name === 'mobil' && w > 800, 'Desktopgrößen gehören zum Desktop-Projekt');
    await page.setViewportSize({ width: w, height: h });
    const code = await host(page, app, { skin });
    const ben = await independentPlayer(app, code, 'Ben');
    try {
      await expect(page.locator('.sv-lb-status b')).toContainText('2 / 2');
      expect(await noOverflow(page)).toBe(true);
      const start = page.locator('[data-kit=start]');
      await expect(start).toBeVisible(); await expect(start).toBeEnabled();
      const box = await start.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.y + box.height).toBeLessThanOrEqual(h + 1);
      const host_ = page.locator('#kg-nav-host'); await expect(host_).toBeVisible(); // Host-Menü
      await expect(page.locator('.sv-lb-status')).toBeVisible();
      await page.locator('.sv-lb-status').scrollIntoViewIfNeeded();
      await shot(page, `lobby-${skin}-${w}x${h}`);
    } finally { await ben.close(); }
  });
}

test('VIS-013 Lobby: andere Spiele behalten ihre Lobby', async ({ page, app }) => {
  await login(page, app); await selectGame(page, 'viergewinnt');
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('.kg-lobby')).toBeVisible();
  await expect(page.locator('.sv-lobby')).toHaveCount(0);
});
