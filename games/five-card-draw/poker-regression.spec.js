
import { test, expect, login, selectGame, waitForPeerServerView, waitForServerView } from '../../test/ui/helpers.js';
import { samePokerSituation, samePokerViewer } from '../../test/ui/server-view-audit.js';
import { independentPlayer } from '../../test/ui/independent-player.js';
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BASELINE = '5667b850e76cc8ccc1f064f0b21650d463beb592';
// Exact Git baseline snapshots also work in shallow CI checkouts.
const BASELINE_HASHES = {
  js: '08c585e3efc39724c96dfa1158af13ef58730bb02a1e882a2f5ce5ea919ced77',
  css: 'b8d205c1583f35fbaa8f0ae5acc49d363cf9c41269030b19e81bc8db028e688c',
};

function baselineSource(ext) {
  const body = readFileSync(new URL('./fixtures/poker-baseline.' + ext, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  expect(createHash('sha256').update(body).digest('hex'), BASELINE).toBe(BASELINE_HASHES[ext]);
  return body;
}

function metrics(page) {
  return page.locator('#game .chip').evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node);
    return { width: style.width, height: style.height, background: style.backgroundImage, shadow: style.boxShadow };
  }));
}

function handSnapshot(view) {
  const { no, street, board, button, sb, bb, toAct, currentBet, done, pots, bets, result } = view.hand;
  return {
    code: view.code, game: view.game, you: view.you.id,
    hand: { no, street, board, button, sb, bb, toAct, currentBet, done, pots, bets, result },
    seats: view.seats.map(seat => seat && ({
      id: seat.id, seat: seat.seat, stack: seat.stack, bet: seat.bet, cards: seat.cards,
      folded: seat.folded, allIn: seat.allIn, inHand: seat.inHand,
    })),
  };
}

async function emit(page, event, data = {}) {
  const reply = await page.evaluate(({ event, data }) => send(event, data), { event, data });
  expect(reply.ok, reply.error).toBe(true);
  return reply;
}

async function screenshot(page, info, game, phase) {
  const name = game + '-chips-' + phase + '-' + info.project.name + '.png';
  let path = info.outputPath(name);
  if (process.env.CLASSIC_CAPTURE_EVIDENCE === '1') {
    const dir = 'public/games/five-card-draw/evidence';
    mkdirSync(dir, { recursive: true });
    path = dir + '/' + name;
  }
  await page.screenshot({ path, fullPage: true });
}

for (const game of ['poker', 'omaha']) {
  test('Poker shared chip regression: ' + game + ', same real hand before/after and motion preferences', async ({ page, browser, app }, info) => {
    test.setTimeout(70000);
    const css = '**/games/poker/poker.css';
    const experienceCss = '**/games/poker/experience.css';
    const baseStyleOnly = route => route.fulfill({ contentType: 'text/css', body: '' });
    const legacyCss = route => route.fulfill({ contentType: 'text/css', body: baselineSource('css') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/games/poker/poker.js', route => route.fulfill({ contentType: 'text/javascript', body: baselineSource('js') }));
    await page.route(css, legacyCss);
    await login(page, app);
    await selectGame(page, game);
    await page.locator('#host-form button[type=submit]').click();
    await emit(page, 'sit', { seat: 0 });
    await emit(page, 'settings', { turnTime: 0, autoNext: false });
    const code = (await waitForServerView(page, view => view.game === game)).code;

    const guestContext = await browser.newContext({ ...info.project.use, reducedMotion: 'reduce' });
    const afterContext = await browser.newContext({ ...info.project.use, reducedMotion: 'reduce' });
    const guest = await guestContext.newPage();
    const after = await afterContext.newPage();
    const errors = [];
    for (const playerPage of [guest, after]) playerPage.on('pageerror', error => errors.push(error.message));

    try {
      await login(guest, app, 'Ben');
      await guest.evaluate(code => joinAndEnter(code, 'watch'), code);
      await emit(guest, 'sit', { seat: 1 });
      await emit(page, 'start');
      await emit(page, 'gamePause', { paused: true });
      const beforeView = await waitForServerView(page, view => view.code === code && view.game === game && view.hand && view.gamePaused);
      const before = handSnapshot(beforeView);
      await page.evaluate(() => document.fonts.ready);
      const beforeMetrics = await metrics(page);
      expect(beforeMetrics.length).toBeGreaterThan(0);
      await screenshot(page, info, game, 'before');

      const token = await page.evaluate(() => session.token);
      const authCookies = await page.context().cookies();
      await page.close();
      await login(after, app, 'Anna');
      await afterContext.addCookies(authCookies);
      // Keep both legacy measurements on the same CSS layers, then restore the actual current assets.
      await after.route(css, legacyCss);
      await after.route(experienceCss, baseStyleOnly);
      await after.evaluate(({ code, token }) => {
        store.set('poker:session:' + code, token);
        location.href = '/?t=' + code;
      }, { code, token });

      const samePlayer = view => view.gamePaused && samePokerViewer(beforeView, view);
      await expect(after.locator('#game')).toBeVisible();
      const legacyView = await waitForServerView(after, samePlayer);
      expect(legacyView.__roomViewAudit.connection).not.toBe(beforeView.__roomViewAudit.connection);
      expect(legacyView.__roomViewAudit.revision).toBeGreaterThan(beforeView.__roomViewAudit.revision);
      expect(handSnapshot(legacyView)).toEqual(before);
      await after.evaluate(() => document.fonts.ready);
      expect(await metrics(after)).toEqual(beforeMetrics);

      await after.unroute(css, legacyCss);
      await after.unroute(experienceCss, baseStyleOnly);
      await after.reload();
      await expect(after.locator('#game')).toBeVisible();
      const currentView = await waitForServerView(after, samePlayer);
      expect(currentView.__roomViewAudit.connection).not.toBe(legacyView.__roomViewAudit.connection);
      expect(currentView.__roomViewAudit.revision).toBeGreaterThan(legacyView.__roomViewAudit.revision);
      expect(handSnapshot(currentView)).toEqual(before);
      await after.evaluate(() => document.fonts.ready);
      const chips = await metrics(after);
      if (game === 'poker') {
        await expect(after.locator('#game')).toHaveAttribute('data-art-poker', '');
        expect(chips).toHaveLength(beforeMetrics.length);
        for (const chip of chips) {
          expect(parseFloat(chip.width)).toBeGreaterThanOrEqual(16);
          expect(parseFloat(chip.height)).toBeGreaterThanOrEqual(8);
          expect(chip.background).toMatch(/\/games\/poker\/art\/chip-(?:top|side)-c[1-5]\.svg/);
        }
      } else {
        await expect(after.locator('#game')).not.toHaveAttribute('data-art-poker');
        expect(chips).toEqual(beforeMetrics);
      }
      await screenshot(after, info, game, 'after');

      await after.setViewportSize({ width: 1440, height: 900 });
      await after.evaluate(() => current.onState(structuredClone(lastState)));
      await expect(after.locator('#game .bet')).toHaveCount(2);
      await after.emulateMedia({ reducedMotion: 'no-preference' });
      await after.evaluate(() => {
        prefs.calm = false;
        window.chipFlights = [];
        const observer = new MutationObserver(records => {
          for (const record of records) {
            for (const node of record.addedNodes) {
              if (node.nodeType === 1 && node.classList.contains('flying')) chipFlights.push(getComputedStyle(node).position);
            }
          }
        });
        observer.observe(document.body, { childList: true });
      });
      await emit(after, 'gamePause', { paused: false });
      await after.locator('#dock [data-act=call],#dock [data-act=check]').first().click();
      await guest.locator('#dock [data-act=call],#dock [data-act=check]').first().click();
      await waitForServerView(after, view => view.hand?.street === 'flop');
      await expect.poll(() => after.evaluate(() => chipFlights.length)).toBeGreaterThan(0);
      expect(await after.evaluate(() => chipFlights.every(position => position === 'fixed'))).toBe(true);
      const count = await after.evaluate(() => chipFlights.length);

      await after.evaluate(() => { prefs.calm = true; });
      await guest.locator('#dock [data-act=check]').click();
      await after.locator('#dock [data-act=check]').click();
      await waitForServerView(after, view => view.hand?.street === 'turn');
      expect(await after.evaluate(() => chipFlights.length)).toBe(count);
      await after.evaluate(() => { prefs.calm = false; });
      await after.emulateMedia({ reducedMotion: 'reduce' });
      await guest.locator('#dock [data-act=check]').click();
      await after.locator('#dock [data-act=check]').click();
      await waitForServerView(after, view => view.hand?.street === 'river');
      expect(await after.evaluate(() => chipFlights.length)).toBe(count);

      await guest.locator('#dock [data-act=check]').click();
      await after.locator('#dock [data-act=check]').click();
      const result = await waitForServerView(after, view => view.code === code && view.game === game &&
        view.you?.id === before.you && view.__roomViewAudit.room === beforeView.__roomViewAudit.room &&
        view.__roomViewAudit.hand === beforeView.__roomViewAudit.hand && view.hand?.no === before.hand.no && view.hand.done && view.hand.result);
      // Exercise the race explicitly: this next broadcast leaves the result intact.
      await emit(after, 'unlisted', { value: !result.unlisted });
      await waitForServerView(guest, view => view.__roomViewAudit.revision > result.__roomViewAudit.revision &&
        view.unlisted !== result.unlisted && samePokerSituation(result, view));
      const guestResult = await waitForPeerServerView(guest, result);
      expect(guestResult.seats.some(seat => seat?.id === guestResult.you.id)).toBe(true);
      expect(result.hand.result).toEqual(guestResult.hand.result);
      const chipsAtStart = before.seats.reduce((total, seat) => total + (seat ? seat.stack + seat.bet : 0), 0);
      expect(result.seats.reduce((total, seat) => total + (seat?.stack ?? 0), 0)).toBe(chipsAtStart);
      expect(errors).toEqual([]);
    } finally {
      await guestContext.close();
      await afterContext.close();
    }
  });
}


test('Poker shared chip regression: abort reuses a hand number without reusing the hand identity', async ({ page, app }) => {
  await login(page, app);
  await selectGame(page, 'poker');
  await page.locator('#host-form button[type=submit]').click();
  await emit(page, 'sit', { seat: 0 });
  await emit(page, 'settings', { turnTime: 0, autoNext: false });
  const room = await waitForServerView(page, view => view.game === 'poker');
  const guest = await independentPlayer(app, room.code, 'Ben', 1);
  try {
    await emit(page, 'start');
    const first = await waitForServerView(page, view => view.code === room.code && view.hand?.street === 'preflop');
    await emit(page, 'abortRound');
    await waitForServerView(page, view => view.code === room.code && !view.hand);
    await emit(page, 'start');
    const next = await waitForServerView(page, view => view.code === room.code && view.hand?.street === 'preflop');
    expect(next.__roomViewAudit.room).toBe(first.__roomViewAudit.room);
    expect(next.hand.no).toBe(first.hand.no);
    expect(next.__roomViewAudit.hand).not.toBe(first.__roomViewAudit.hand);
    // Isolate the identity check even if the new deal also changes visible turn data.
    const samePublicSituation = { ...first, __roomViewAudit: next.__roomViewAudit };
    expect(samePokerSituation(first, samePublicSituation)).toBe(false);
    expect(samePokerSituation(first, next)).toBe(false);
  } finally {
    await guest.close();
  }
});
