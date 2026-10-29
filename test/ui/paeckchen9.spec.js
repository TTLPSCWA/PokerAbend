import { test, expect, login, selectGame } from './helpers.js';

async function host(page, app, id, bots = 1) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, app); await selectGame(page, id);
  await page.locator('#host-form button[type=submit]').click();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  for (let i = 0; i < bots; i++) expect((await page.evaluate(() => send('addBot'))).ok).toBe(true);
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
