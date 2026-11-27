import { test, expect, login, selectGame } from './release-helpers.js';

async function state(page, stage) {
  await expect.poll(() => page.evaluate(() => lastState?.g?.stage)).toBe(stage);
}

async function hostTable(page, browser, app, info, mode) {
  await login(page, app, 'Anna');
  await selectGame(page, 'meme-duell');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('meme-duell');
  await page.locator('#kg-nav-host').click();
  await page.locator('#kg-panel select[data-kit-set=mode]').selectOption(mode);
  await expect.poll(() => page.evaluate(() => lastState?.settings?.mode)).toBe(mode);
  await page.locator('#kg-panel .icon-btn[data-kit=close]').click();
  await page.evaluate(() => send('sit'));
  const code = await page.evaluate(() => lastState.code);
  const contexts = [];
  for (const name of ['Bo','Cleo']) {
    const context = await browser.newContext({...info.project.use});
    contexts.push(context);
    const guest = await context.newPage();
    await login(guest, app, name);
    await guest.evaluate(room => joinAndEnter(room,'sit'), code);
    await expect.poll(() => guest.evaluate(() => lastState?.code)).toBe(code);
    await expect.poll(() => guest.evaluate(() => !!lastState?.you?.playing)).toBe(true);
  }
  await page.evaluate(() => send('start'));
  await state(page,'write');
  return {code, contexts, players:[page,...contexts.map(ctx=>ctx.pages()[0])]};
}

test('only the host can upload and remove a private room image', async ({page,browser,app},info) => {
  await login(page,app,'Anna');
  await selectGame(page,'meme-duell');
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => lastState?.game)).toBe('meme-duell');
  const room=await page.evaluate(()=>lastState.code);
  const context=await browser.newContext({...info.project.use});
  try {
    const guest=await context.newPage();
    await login(guest,app,'Bo');
    await guest.evaluate(code=>joinAndEnter(code,'sit'),room);
    await expect.poll(()=>guest.evaluate(()=>lastState?.code)).toBe(room);
    await expect(guest.locator('.meme-upload')).toHaveCount(0);
    await page.locator('.meme-upload summary').click();
    await page.locator('.meme-upload [data-meme-image-title]').fill('Privates Testbild');
    const bytes=await page.evaluate(() => {
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=32;
      canvas.getContext('2d').fillRect(0,0,32,32);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.locator('.meme-upload input[type=file]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
    await page.locator('[data-g="meme-upload"]').click();
    await expect.poll(()=>page.evaluate(()=>lastState?.privateMemeCards?.[0]?.title)).toBe('Privates Testbild');
    expect(await guest.evaluate(()=>('privateMemeCards' in lastState))).toBe(false);
    if (!await page.locator('.meme-upload').evaluate(details=>details.open)) await page.locator('.meme-upload summary').click();
    await page.locator('[data-g="meme-remove"]').click();
    await expect.poll(()=>page.evaluate(()=>lastState?.privateMemeCards?.length)).toBe(0);
  } finally { await context.close(); }
});

for (const mode of ['text','image','creator']) {
  test(`Meme Duel ${mode}: private state, scoring and reconnect`, async ({page,browser,app},info) => {
    test.setTimeout(60000);
    const {code, contexts, players} = await hostTable(page,browser,app,info,mode);
    try {
      await Promise.all(players.map(p=>state(p,'write')));
      const contributors = mode==='text' ? players.slice(1) : players;
      if (mode==='creator') {
        await page.locator('.meme-editor textarea').fill('Ein Text mit < und > bleibt Text.');
        await expect(page.locator('[data-meme-preview]')).toContainText('< und >');
        const addField=page.locator('[data-g="add-text"]');
        if (info.project.use.hasTouch) await addField.tap();
        else await addField.press('Enter');
        await expect(page.locator('.meme-editor textarea')).toHaveCount(2);
        await page.locator('.meme-editor textarea').nth(1).fill('Zweite Zeile');
        await expect(page.locator('[data-meme-preview]')).toContainText('Zweite Zeile');
        const download = page.waitForEvent('download');
        await page.locator('[data-g="export-meme"]').click();
        expect((await download).suggestedFilename()).toBe('spieleabend-meme.png');
        await page.locator('[data-g="submit-editor"]').click();
        await expect.poll(() => players[1].evaluate(() => JSON.stringify(lastState.g))).not.toContain('Zweite Zeile');
        for (const guest of players.slice(1)) {
          await guest.locator('.meme-editor textarea').fill('Ein anderer Beitrag');
          await guest.locator('[data-g="submit-editor"]').click();
        }
      } else {
        for (const contributor of contributors) {
          await expect(contributor.locator('[data-g="meme-card"]')).toHaveCount(mode==='text' ? 7 : 5);
          await contributor.locator('[data-g="meme-card"]').first().click();
        }
      }
      await Promise.all(players.map(p=>state(p,'vote')));
      const guest = players[1];
      await guest.reload();
      await state(guest,'vote');
      expect(await guest.evaluate(() => lastState.code)).toBe(code);
      expect(await guest.evaluate(() => lastState.g.choices.every(c=>!Object.hasOwn(c,'name')))).toBe(true);
      if(mode!=='text') await expect(guest.locator('.meme-card').filter({hasText:'Dein Beitrag'}).locator('[data-g="meme-ballot"]')).toHaveCount(0);
      const voters = mode==='text' ? [page] : players;
      for (const voter of voters) await voter.locator('[data-g="meme-ballot"]').first().click();
      await state(page,'reveal');
      await expect(page.locator('.meme-card').filter({hasText:'Gewonnen'}).first()).toBeVisible();
      await page.screenshot({path:info.outputPath(mode+'-results.png')});
      await page.locator('[data-home="open"]').click();
      await page.locator('#home-dlg [data-home-do="leave"]').click();
      await expect(page.locator('#hub')).toBeVisible();
    } finally {
      await Promise.all(contexts.map(ctx=>ctx.close()));
    }
  });
}
