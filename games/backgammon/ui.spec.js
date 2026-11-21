import { test, expect, login, selectGame } from '../../test/ui/helpers.js';
import { mkdirSync } from 'node:fs';
import { applyMove, positionValue } from './rules.js';

const CAPTURE = process.env.CLASSIC_CAPTURE_EVIDENCE === '1' ? 'public/games/backgammon/evidence' : 'games/backgammon/_artifacts/screenshots';
test.use({ createLimit: '100' });

const state = (page) => page.evaluate(() => lastState);
const firstMove = (page) => page.locator('[data-g=bgm-move]').first();

async function emit(page, event, data = {}) {
  const reply = await page.evaluate(({ event, data }) => new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, data, (error, result) => error ? reject(error) : resolve(result));
  }), { event, data });
  expect(reply.ok, reply.error).toBe(true);
}

async function waitForRevision(page, previous, revision, action) {
  const { code, g: { roundKey } } = previous;
  const view = await page.waitForFunction(({ code, roundKey, revision }) => {
    const st = lastState;
    return st?.code === code && st.g?.roundKey === roundKey && st.g.revision === revision ? st : false;
  }, { code, roundKey, revision }, { timeout: 10_000 }).catch((error) => {
    throw new Error(`${action}: keine Serveransicht für ${code}/${roundKey} mit Revision ${revision}`, { cause: error });
  });
  try {
    return await view.jsonValue();
  } finally {
    await view.dispose();
  }
}

async function clickAndAdvance(page, button, before, action) {
  await expect(button, action).toBeEnabled();
  await button.click();
  return waitForRevision(page, before, before.g.revision + 1, action);
}

test('Backgammon: two real players, legal preview, undo, pause, reconnect, spectator and six viewports', async ({ page, browser, app }, info) => {
  test.setTimeout(240_000);
  await login(page, app);
  await selectGame(page, 'backgammon');
  await page.locator('#host-form button[type=submit]').click();
  await emit(page, 'sit');
  const code = (await state(page)).code;
  const contexts = [];
  async function add(name, sit) {
    const context = await browser.newContext({ ...info.project.use });
    contexts.push(context);
    const peer = await context.newPage();
    await login(peer, app, name);
    await peer.evaluate(({ code, sit }) => joinAndEnter(code, sit ? 'sit' : 'watch'), { code, sit });
    await expect.poll(async () => (await state(peer))?.code).toBe(code);
    return peer;
  }

  try {
    const guest = await add('Ben', true);
    const spectator = await add('Robin', false);
    await emit(page, 'start');
    await expect(page.locator('.bgm-board')).toBeVisible();
    const opening = await state(page);
    const actor = opening.turnId === opening.you.id ? page : guest;
    let current = await waitForRevision(actor, opening, opening.g.revision, 'Eröffnung');
    const oldBoard = current.g.board;
    current = await clickAndAdvance(actor, firstMove(actor), current, 'Teilzug');
    current = await clickAndAdvance(actor, actor.locator('[data-g=bgm-undo]'), current, 'Teilzug zurücknehmen');
    expect(current.g.board).toEqual(oldBoard);
    const spectatorView = await waitForRevision(spectator, current, current.g.revision, 'Zuschauer nach Undo');
    expect(spectatorView.g.legal).toEqual([]);

    // Die Ansicht muss über die neue Verbindung eintreffen. lastState allein kann noch vom alten Socket stammen.
    const reconnectView = await actor.evaluate(({ code, roundKey, revision, player }) => new Promise((resolve, reject) => {
      const previousSocket = socket.id;
      const timeout = setTimeout(() => {
        socket.off('state', receive);
        reject(new Error('Keine bestätigte Backgammon-Ansicht nach Reconnect'));
      }, 10_000);
      function receive(st) {
        if (!socket.id || socket.id === previousSocket || st.code !== code || st.you?.id !== player ||
            st.g?.roundKey !== roundKey || st.g.revision !== revision) return;
        clearTimeout(timeout);
        socket.off('state', receive);
        resolve(st);
      }
      socket.on('state', receive);
      socket.disconnect();
      socket.connect();
    }), { code, roundKey: current.g.roundKey, revision: current.g.revision, player: current.you.id });
    await expect(firstMove(actor)).toBeEnabled();
    expect(reconnectView.g.board).toEqual(oldBoard);

    await emit(page, 'gamePause', { paused: true });
    await expect.poll(async () => (await state(actor))?.gamePaused).toBe(true);
    await expect(firstMove(actor)).toBeDisabled();
    await actor.reload();
    await expect(actor.locator('#game-pause-banner')).toBeVisible();
    const restored = await waitForRevision(actor, current, current.g.revision, 'Wiederherstellung im pausierten Spiel');
    expect(restored.you.id).toBe(current.you.id);
    expect(restored.gamePaused).toBe(true);
    expect(restored.g.board).toEqual(oldBoard);
    await emit(page, 'gamePause', { paused: false });
    await expect.poll(async () => (await state(actor))?.gamePaused).toBe(false);
    await expect(firstMove(actor)).toBeEnabled();

    mkdirSync(CAPTURE, { recursive: true });
    await actor.screenshot({ path: `${CAPTURE}/playing-${info.project.name}.png`, fullPage: true });
    if (info.project.name === 'desktop') {
      for (const [width, height] of [[1920, 1080], [1440, 900], [768, 1024], [390, 844], [360, 800], [900, 450]]) {
        await actor.setViewportSize({ width, height });
        expect(await actor.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        const dock = await actor.locator('#kg-dock').boundingBox();
        expect(dock.y).toBeGreaterThanOrEqual(0);
        expect(dock.y + dock.height).toBeLessThanOrEqual(height + 1);
        await actor.screenshot({ path: `${CAPTURE}/${width}x${height}.png`, fullPage: true });
      }
    }

    current = await waitForRevision(actor, current, current.g.revision, 'Fortsetzen der Eröffnung');
    while (current.g.legal.length > 0) {
      current = await clickAndAdvance(actor, firstMove(actor), current, 'Legal angezeigten Teilzug spielen');
    }
    await expect(firstMove(actor)).toHaveCount(0);
    current = await clickAndAdvance(actor, actor.locator('[data-g=bgm-confirm]'), current, 'Zug bestätigen');
    expect(current.g.stage).toBe('roll');

    const ids = await Promise.all([page, guest].map((peer) => peer.evaluate(() => lastState.you.id)));
    const peers = new Map([[ids[0], page], [ids[1], guest]]);
    let steps = 0;
    let cubeShot = false;
    while (current.phase === 'playing' && steps++ < 2500) {
      const turnPage = current.g.stage === 'between' ? page : peers.get(current.turnId);
      expect(turnPage, 'Aktiver Spieler gehört zu diesem Match').toBeDefined();
      current = await waitForRevision(turnPage, current, current.g.revision, 'Serveransicht des aktiven Spielers');
      const g = current.g;
      let event;
      const data = { revision: g.revision, roundKey: g.roundKey };
      if (g.stage === 'between') {
        event = 'nextGame';
      } else if (g.pending) {
        event = 'cubeAnswer';
        data.accept = true;
        if (!cubeShot) {
          await turnPage.screenshot({ path: `${CAPTURE}/double-${info.project.name}.png`, fullPage: true });
          cubeShot = true;
        }
      } else if (g.stage === 'roll') {
        event = g.canDouble ? 'double' : 'roll';
      } else if (!g.legal.length) {
        event = 'confirm';
      } else {
        event = 'move';
        const color = g.colors.indexOf(current.turnId);
        const best = [...g.legal].sort((a, b) => positionValue(applyMove(g.board, color, b), color) -
          positionValue(applyMove(g.board, color, a), color))[0];
        Object.assign(data, best);
      }
      // Maintain the existing pacing for the production socket bucket (8 events/second).
      await turnPage.waitForTimeout(140);
      await emit(turnPage, event, data);
      current = await waitForRevision(turnPage, current, g.revision + 1, event);
    }
    expect(current.phase).toBe('over');
    const finalView = await waitForRevision(spectator, current, current.g.revision, 'Matchende beim Zuschauer');
    expect(finalView.phase).toBe('over');
    await expect(spectator.locator('.kg-over')).toBeVisible();
    await page.screenshot({ path: `${CAPTURE}/match-end-${info.project.name}.png`, fullPage: true });
  } finally {
    for (const context of contexts) await context.close();
  }
});
