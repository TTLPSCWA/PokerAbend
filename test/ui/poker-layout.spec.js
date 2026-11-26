import { test, expect, login, selectGame } from './helpers.js';

async function command(page, event, data = {}) {
  const reply = await page.evaluate(([name, payload]) => send(name, payload), [event, data]);
  expect(reply.ok, reply.error).toBe(true);
}

test('Hold’em keeps blinds with their seats and reserves room for the hand reference', async ({ page, app }, info) => {
  const mobile = info.project.name === 'mobil';
  await login(page, app);
  await selectGame(page, 'poker');
  await page.locator('#host-form button[type=submit]').click();
  await page.locator('[data-sit]').first().click();
  for (let index = 0; index < (mobile ? 1 : 5); index++) await command(page, 'addBot');
  await command(page, 'setCardWorld', { world: 'TW-14' });
  await command(page, 'settings', { turnTime: 0, autoNext: false });
  await command(page, 'start');
  await expect(page.locator('body')).toHaveAttribute('data-theme-world', 'TW-14');
  await expect(page.locator('#game .p-blind:visible')).toHaveCount(2);

  const roles = await page.evaluate(() => ['SB', 'BB'].map((role) => {
    const seat = lastState.hand[role.toLowerCase()];
    const marker = [...document.querySelectorAll('#game .p-blind')].find(el => el.dataset.blind === role && el.getClientRects().length);
    const owner = marker?.closest('[data-seat]');
    const wrap = marker?.closest('.plate, .me-chips');
    const rect = marker?.getBoundingClientRect(), outer = wrap?.getBoundingClientRect();
    return {
      rightOwner: owner ? Number(owner.dataset.seat) === seat : !!wrap && seat === lastState.you.seat,
      inside: !!outer && rect.left >= outer.left && rect.right <= outer.right && rect.top >= outer.top && rect.bottom <= outer.bottom,
    };
  }));
  expect(roles).toEqual([{ rightOwner: true, inside: true }, { rightOwner: true, inside: true }]);

  const button = page.locator('#dock .hands-btn');
  await button.click();
  const panel = page.locator('#game #panel');
  await expect(panel).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const view = await page.evaluate(() => {
    const panel = document.querySelector('#panel').getBoundingClientRect();
    const wrap = document.querySelector('.table-wrap').getBoundingClientRect();
    return { panelRight: panel.right, playingLeft: wrap.left };
  });
  if (mobile) await expect.poll(() => panel.evaluate(el => el.getBoundingClientRect().bottom - innerHeight)).toBeLessThanOrEqual(0);
  else expect(view.panelRight).toBeLessThanOrEqual(view.playingLeft + 1);
  for (const rank of ['J', 'Q', 'K']) {
    const card = panel.locator(`.card[data-face][aria-label^="${rank}"]`).first();
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('background-size', /22% auto/);
    expect(await card.evaluate(el => !!el.querySelector('.r')?.textContent && !!el.querySelector('.s')?.textContent)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
});
