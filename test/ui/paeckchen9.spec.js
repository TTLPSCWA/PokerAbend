import { test, expect, login, selectGame } from './helpers.js';

async function host(page, app, id, bots = 1, settings = {}) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, id);
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  for (let i = 0; i < bots; i++) expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
  if (Object.keys(settings).length) expect((await page.evaluate((settings) => send('settings', settings), settings)).ok).toBe(true);
  expect((await page.evaluate(() => send('start'))).ok).toBe(true);
}

test('6 nimmt!: verdeckt wählen, Bot, Aufdecken, Reihenwahl, Reconnect und Querformat', async ({ page, app }, info) => {
  await host(page, app, 'sechs-nimmt');
  await expect(page.locator('.sn-row')).toHaveCount(4);
  await expect(page.locator('.sn-hand .sn-card')).toHaveCount(10);
  const card = page.locator('.sn-hand [data-g=choose]').first();
  expect((await card.boundingBox()).width).toBeGreaterThanOrEqual(32);
  await card.click();
  await expect.poll(() => page.evaluate(() => lastState.g.ready)).toBe(true);
  await page.reload(); await expect(page.locator('.sn-row')).toHaveCount(4);
  // Kleine Karten können eine Reihenwahl verlangen; sie erfolgt über die sichtbaren Ziele.
  await expect.poll(async () => {
    const button = page.locator('.sn-take').first();
    if (await button.isVisible()) await button.click();
    return page.evaluate(() => lastState.g.trick);
  }, { timeout: 15000 }).toBe(2);
  await expect(page.locator('.sn-hand .sn-card')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('sechs-nimmt.png') });
  await page.setViewportSize({ width: 900, height: 450 });
  await expect(page.locator('.sn-row').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Monopoly: mit Bot spielen, realer Handel, Würfeln, eigenes Eigentum und Brett im Querformat', async ({ page, app }, info) => {
  test.setTimeout(60000);
  await host(page, app, 'monopoly', 1, { quick: true });
  await expect(page.locator('.mo-field')).toHaveCount(40);
  expect((await page.locator('.mo-field').first().boundingBox()).width).toBeGreaterThanOrEqual(32);
  await page.getByRole('button', { name: 'Handel anbieten', exact: true }).click();
  await expect(page.locator('#mo-dialog')).toBeVisible();
  await page.getByLabel('Geld abgeben', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Angebot senden', exact: true }).click();
  await expect.poll(() => page.evaluate(() => lastState.g.people[lastState.you.id].money)).toBe(1450);
  await page.getByRole('button', { name: 'Würfeln', exact: true }).click();
  await expect.poll(() => page.evaluate(() => lastState.g.lastMove?.n || 0)).toBeGreaterThan(0);
  if (await page.getByRole('button', { name: 'Kaufen', exact: true }).isVisible()) await page.getByRole('button', { name: 'Kaufen', exact: true }).click();
  await page.reload(); await expect(page.locator('.mo-field')).toHaveCount(40);
  await page.screenshot({ path: info.outputPath('monopoly.png') });
  await page.setViewportSize({ width: 900, height: 450 });
  await expect.poll(() => page.locator('.mo-token.own').evaluate((el) => {
    const b = el.getBoundingClientRect(), v = document.querySelector('.mo-board-viewport').getBoundingClientRect();
    return b.left >= v.left && b.right <= v.right && b.top >= v.top && b.bottom <= v.bottom;
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('monopoly-querformat.png') });
});

test('Monopoly: Versteigerungs- und Zahlungsdialog mit Gebotsgrenzen und Liquidation', async ({ page, app }, info) => {
  await host(page, app, 'monopoly', 1, { quick: true });
  // Öffentliche Entscheidungsszenarien gezielt rendern; echte Transaktionen sind gegen Room getestet.
  await page.evaluate(() => {
    window.realMonopolyState = structuredClone(lastState);
    const S = structuredClone(lastState), me = S.you.id;
    S.g.auction = { field: 1, bid: 10, leader: null, passed: [], participants: [me] };
    current.onState(S);
  });
  await expect(page.locator('#mo-dialog')).toContainText('Versteigerung');
  await expect(page.getByLabel('Dein Gebot', { exact: true })).toHaveAttribute('min', '11');
  await page.getByLabel('Dein Gebot', { exact: true }).fill('21');
  await expect(page.getByRole('button', { name: 'Gebot abgeben', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('monopoly-versteigerung.png') });
  await page.evaluate(() => {
    const S = structuredClone(window.realMonopolyState), me = S.you.id;
    S.g.debt = { from: me, to: null, amount: 3000, reason: 'Testforderung' }; S.g.liquidation = 2000;
    current.onState(S);
  });
  await expect(page.locator('#mo-dialog')).toContainText('3000 bezahlen');
  await expect(page.getByRole('button', { name: 'Bankrott erklären', exact: true })).toBeEnabled();
  await expect(page.locator('.mo-debt-list [data-action=mortgage]')).toHaveCount(2);
  expect(await page.evaluate(() => document.querySelector('#mo-dialog').getBoundingClientRect().width <= innerWidth)).toBe(true);
});

test('Monopoly: eigenes Brett sicher speichern, auswählen, starten und nach Neuladen behalten', async ({ page, app }) => {
  await login(page, app); await selectGame(page, 'monopoly');
  await page.locator('#host-form button[type=submit]').click();
  await page.locator('[data-kit-panel=host]').click();
  await page.getByRole('button', { name: 'Eigenes Brett anlegen', exact: true }).click();
  await page.getByLabel('Brettname', { exact: true }).fill('Unsere Teststadt');
  await page.locator('[data-mo-name="0"]').fill('Eulen & Freunde');
  await page.getByRole('button', { name: 'Brett speichern und auswählen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => lastState.settings.board)).not.toBe('default');
  await page.locator('#kg-panel .icon-btn[data-kit=close]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await page.evaluate(() => send('addBot')); await page.evaluate(() => send('start'));
  await expect(page.locator('.mo-center h2')).toHaveText('Unsere Teststadt');
  await expect(page.locator('[data-field="1"].mo-field')).toContainText('Eulen & Freunde');
  await page.reload(); await expect(page.locator('.mo-center h2')).toHaveText('Unsere Teststadt');
});

test('Monopoly Deal: mit Bot anspielen, Zielauswahl, Bank/Auslage und Reconnect', async ({ page, app }, info) => {
  await host(page, app, 'monopoly-deal');
  await expect(page.locator('.md-player')).toHaveCount(2);
  const cardId = await page.evaluate(() => lastState.g.hand[0]);
  await page.locator(`.md-hand [data-card="${cardId}"]`).click();
  await expect(page.locator('#md-dialog')).toBeVisible();
  if (await page.locator('#md-color').isVisible()) {
    await page.locator('#md-color').selectOption({ index: 0 });
    await page.getByRole('button', { name: 'Grundstück auslegen', exact: true }).click();
  } else await page.locator('[data-md=bank]').click();
  await expect.poll(() => page.evaluate(() => lastState.g.actions)).toBe(1);
  await page.reload(); await expect(page.locator('.md-player')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => lastState.g.actions)).toBe(1);
  await expect(page.locator('.md-hand .md-card')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('monopoly-deal.png') });
});

test('Monopoly Deal: Zahlungsdialog zeigt Summe, verhindert zu wenig und bleibt am Handy bedienbar', async ({ page, app }, info) => {
  await host(page, app, 'monopoly-deal');
  // Eine öffentliche Forderungsansicht gezielt anzeigen; Zahlungsregeln laufen zusätzlich gegen den echten Raum in node:test.
  await page.evaluate(async () => {
    const { CARDS } = await import('/games/monopoly-deal/cards.js');
    const S = structuredClone(lastState), me = S.you.id, actor = S.players.find((p) => p.id !== me).id;
    const cash = Object.values(CARDS).filter((c) => c.kind === 'money' && [1, 5].includes(c.value));
    const one = cash.find((c) => c.value === 1), five = cash.find((c) => c.value === 5);
    S.g.assets = [{ card: one.id, kind: 'bank', value: 1 }, { card: five.id, kind: 'bank', value: 5 }];
    S.g.pending = { actor, target: me, targets: [me], index: 0, responder: me, stage: 'pay', kind: 'payment', amount: 3, chain: [] };
    S.turnId = me; current.onState(S);
  });
  await expect(page.locator('#md-dialog')).toBeVisible();
  await expect(page.locator('[data-md=pay]')).toBeDisabled();
  await page.locator('[data-md-pay]').first().check();
  await expect(page.locator('#md-pay-total')).toContainText('1 M / 3 M');
  await expect(page.locator('[data-md=pay]')).toBeDisabled();
  await page.locator('[data-md-pay]').last().check();
  await expect(page.locator('#md-pay-total')).toContainText('kein Wechselgeld');
  await expect(page.locator('[data-md=pay]')).toBeEnabled();
  expect(await page.evaluate(() => document.querySelector('#md-dialog').getBoundingClientRect().width <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('monopoly-deal-zahlung.png') });
});
