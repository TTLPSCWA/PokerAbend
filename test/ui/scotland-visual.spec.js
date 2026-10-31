import { test, expect, login, selectGame } from './helpers.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dimensions = [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [360, 800], [900, 450]];
for (const [width, height] of dimensions) test(`Scotland Yard visual states ${width}x${height}`, async ({ page, browser, app }, info) => {
  test.setTimeout(120000);
  const viewport = { width, height }, contexts = [], errors = [];
  const detailed = width === 1440 || width === 390;
  const output = resolve('artifacts/scotland-redesign', process.env.SCOTLAND_CAPTURE || 'after', info.project.name);
  mkdirSync(output, { recursive: true });
  const shot = async (target, state) => {
    expect(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), state).toBe(true);
    await target.screenshot({ path: resolve(output, `${width}x${height}-${state}.png`), fullPage: true });
  };
  const emit = async (target, event, data = {}) => {
    const reply = await target.evaluate(({ event, data }) => send(event, data), { event, data });
    expect(reply.ok, `${event}: ${reply.error}`).toBe(true);
  };
  try {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, app, 'Morgan'); await selectGame(page, 'scotland-yard');
    await page.locator('#host-form button[type=submit]').click();
    await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('scotland-yard');
    await emit(page, 'sit'); await emit(page, 'settings', { turnTime: 0, rounds: 12 });
    await shot(page, 'lobby-waiting');
    const code = await page.evaluate(() => lastState.code);
    const guests = [];
    for (const [name, mode] of [['Ada', 'sit'], ['Noah', 'sit'], ['Robin', 'watch']]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', ...(info.project.use.isMobile ? { isMobile: true, hasTouch: true } : {}) });
      contexts.push(context); const guest = await context.newPage();
      guest.on('pageerror', (e) => errors.push(e.message));
      await login(guest, app, name);
      await guest.evaluate(({ code, mode }) => joinAndEnter(code, mode), { code, mode });
      await expect.poll(() => guest.evaluate(() => lastState?.code)).toBe(code); guests.push(guest);
    }
    const [detective, second, watcher] = guests;
    const x = await page.evaluate(() => lastState.you.id);
    await emit(page, 'syRole', { target: x });
    if (detailed) await shot(page, 'lobby-ready');
    await emit(page, 'start');
    for (const target of [page, ...guests]) await expect(target.locator('.sy-map')).toBeVisible();
    await shot(page, 'mister-x-active');
    await shot(detective, 'detective-waiting');
    await shot(watcher, 'spectator');
    for (const target of [detective, watcher]) {
      expect(await target.evaluate(() => lastState.g.xPosition)).toBeNull();
      await expect(target.locator('.sy-stop.mister')).toHaveCount(0);
    }
    if (detailed) {
      await page.locator('[data-g="sy-ticket"][data-ticket="black"]').click();
      await shot(page, 'black-ticket');
      if (await page.locator('[data-g="sy-double"]').count()) {
        await page.locator('[data-g="sy-double"]').click(); await shot(page, 'double-ticket');
        await page.locator('[data-g="sy-double"]').click();
      }
    }
    const first = await page.evaluate(() => lastState.g.legal[0]);
    await emit(page, 'syMove', first);
    await expect.poll(() => detective.evaluate(() => lastState.g.legal.length)).toBeGreaterThan(0);
    await shot(detective, 'detective-active');
    if (detailed) {
      // Advance through genuine server actions. Secret information stays in this
      // test controller; detective pages receive only their ordinary legal move.
      for (let steps = 0; steps < 12 && await page.evaluate(() => lastState.g.move < 3); steps++) {
        const turn = await page.evaluate(() => lastState.turnId);
        const actor = (await Promise.all([page, detective, second].map(async (p) => [p, await p.evaluate(() => lastState.you.id)]))).find(([, id]) => id === turn)?.[0];
        expect(actor).toBeTruthy();
        await expect.poll(() => actor.evaluate(() => lastState.g.legal.length)).toBeGreaterThan(0);
        const hidden = await page.evaluate(() => lastState.g.xPosition);
        const moves = await actor.evaluate(() => lastState.g.legal);
        const move = moves.find((m) => m.to !== hidden) || moves[0];
        await emit(actor, 'syMove', move);
        await expect.poll(() => page.evaluate(() => lastState.turnId)).not.toBe(turn);
      }
      await expect.poll(() => detective.evaluate(() => lastState.g.lastSeen?.move)).toBe(3);
      await shot(detective, 'public-sighting-and-log');
      if (await detective.locator('.sy-log').count()) await detective.locator('.sy-log').screenshot({ path: resolve(output, `${width}x${height}-journal-detail.png`) });
      await emit(page, 'gamePause', { paused: true });
      await shot(page, 'paused');
      await page.locator('[data-kit-panel="me"]').click();
      await page.locator('#kg-panel [data-language]').selectOption('en');
      await page.locator('.panel-head [data-kit="close"]').click();
      await shot(page, 'english');
      await page.reload(); await expect(page.locator('.sy-map')).toBeVisible();
      await expect(page.locator('#game-pause-banner')).toBeVisible();
      await emit(page, 'gamePause', { paused: false });
      await emit(page, 'stand');
      await expect(detective.locator('.kg-over')).toBeVisible();
      await shot(detective, 'detectives-win'); await shot(page, 'mister-x-defeat');
    }
    expect(errors).toEqual([]);
  } finally { for (const context of contexts) await context.close(); }
});
