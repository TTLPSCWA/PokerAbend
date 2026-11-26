import { test, expect, openTable, configure, emit } from './card-ux-helpers.js';
import { login, selectGame } from './helpers.js';

test('UNO creation and Host agree on which variants accept Classic house rules', async ({ page, app, browser }, info) => {
  test.setTimeout(60000);
  await login(page, app, 'Anna');
  await selectGame(page, 'farbenchaos');
  const variant = page.locator('#host-variant');
  const size = page.locator('#host-form [data-cf="handSize"]');
  await expect(size).toBeVisible();
  for (const mode of ['flip', 'no-mercy', 'all-wild']) {
    await variant.selectOption(mode);
    await expect(size).toBeHidden();
    await expect(size).toBeDisabled();
  }
  await variant.selectOption('halloween-ghosthunt');
  await expect(size).toBeVisible();
  await expect(size).toBeEnabled();
  await size.fill('5');
  await page.locator('#host-form button[type=submit]').click();
  await emit(page, 'sit');

  const peerContext = await browser.newContext({ ...info.project.use });
  try {
    const peer = await peerContext.newPage();
    await login(peer, app, 'Ben');
    const code = await page.evaluate(() => lastState.code);
    await peer.evaluate(id => joinAndEnter(id, 'sit'), code);
    await expect.poll(() => peer.evaluate(() => lastState?.code)).toBe(code);

    await page.locator('#kg-nav-host').click();
    const toggle = page.locator('#kg-panel [data-kit-set="stacking"]');
    await expect(toggle).toBeVisible();
    await toggle.check();
    await expect.poll(() => peer.evaluate(() => lastState.settings)).toMatchObject({ handSize: 5, stacking: true });
    await page.keyboard.press('Escape');
    await emit(page, 'start');
    await expect.poll(() => page.evaluate(() => lastState.g.hand.length)).toBe(5);
    await expect.poll(() => peer.evaluate(() => lastState.g.hand.length)).toBe(5);
  } finally { await peerContext.close(); }
});

test('UNO Flip explains fixed rules and places its count below both card faces', async ({ page, browser, app }, info) => {
  const room = await openTable(page, browser, app, info, 'farbenchaos', 'flip');
  try {
    await page.locator('#kg-nav-host').click();
    await expect(page.locator('#kg-panel .fc-fixed-rules')).toBeVisible();
    await expect(page.locator('#kg-panel [data-kit-set]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await configure(page, app, room.code, { side: 0, top: '7b', hand: ['Lb','1r','2y','3g','4b','5r','6y'] });
    const deck = page.locator('.fc-flip-deck');
    const check = async (side, back) => {
      await expect(page.locator('#kg')).toHaveAttribute('data-uno-side', side);
      await expect(deck.locator('.kc')).toHaveAttribute('data-face', back);
      const value = await deck.evaluate(el => {
        const count = el.querySelector('.fc-deck-count');
        return {
          measured: parseInt(count.textContent, 10), expected: lastState.g.deck,
          gap: count.getBoundingClientRect().top - el.querySelector('.kc').getBoundingClientRect().bottom,
        };
      });
      expect(value.measured).toBe(value.expected);
      expect(value.gap).toBeGreaterThanOrEqual(4);
    };
    await check('light', 'dark');
    await page.locator('#kg-dock .kg-hand [data-action="L"]').click();
    await page.locator('#kg-dock [data-g="play-selected"]').click();
    await check('dark', 'light');
  } finally { await room.close(); }
});
