// Wer bin ich? – Oberfläche: Stirn-Zettel (10 Spieler, lange Begriffe), Antwortknöpfe, eigener Zettel „?“, Rundenende mit allen Begriffen, Host-Menü ohne Bots.
// Der Zustand wird nach dem Anlegen eines echten Tisches mit gebautem Spielstand überschrieben (nur Anzeige; der Server entscheidet und schickt den eigenen Begriff nie mit).
// Läuft mit: npx playwright test test/ui/werbinich.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
import { test, expect } from './helpers.js';

async function start(page, app) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('poker:name', JSON.stringify('Anna'));
      localStorage.setItem('poker:avatar', JSON.stringify('🦉'));
      localStorage.setItem('poker:prefs', JSON.stringify({ intros: false }));
    } catch { /* egal */ }
  });
  await page.goto(app.url);
  await page.getByLabel('Passwort').fill(app.password);
  await page.getByRole('button', { name: 'Reinkommen' }).click();
  await expect(page.locator('#hub')).toBeVisible();
  await page.evaluate(() => { location.hash = '#spiele'; });
  await page.locator('[data-host="wer-bin-ich"]').first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible();
}

const WORDS = ['Elefant', 'Schwarzwälder Kirschtorte', 'Käpt\'n Blaubär', 'Pinguin', 'Wasserspringen', 'Die Bremer Stadtmusikanten', 'Zahnarzt', 'Lightning McQueen', 'Rotkäppchen', 'Feuerwehrmann'];

// Gebauter Zustand mit 10 Spielern; ich bin Spieler 0
async function fake(page, patch) {
  await page.evaluate(({ words, patch }) => {
    const patchFn = new Function('S', 'ids', 'words', patch);
    const S = JSON.parse(JSON.stringify(lastState));
    const me = S.you.id;
    const ids = [me, ...Array.from({ length: 9 }, (_, i) => 'p' + (i + 1))];
    const names = ['Anna', 'Ben', 'Clara', 'Dennis', 'Emma', 'Felix', 'Greta', 'Hanno', 'Ida', 'Jonas'];
    S.phase = 'playing'; S.roundNo = 1; S.scoreLabel = 'Punkte';
    S.you.inRound = true; S.you.playing = true;
    S.players = ids.map((id, i) => ({ id, name: names[i], avatar: '🦉', seated: true, inRound: true, connected: true, score: 0, wins: 0, place: null, qs: i, gaveUp: false, skipped: false, answered: false, writing: false }));
    S.turnId = ids[3];
    S.g = { stage: 'play', sub: 'ask', deadline: null, mode: 'category', words: Object.fromEntries(ids.map((id, i) => [id, id === me ? null : words[i]])), solved: [], qs: Object.fromEntries(ids.map((id, i) => [id, i])), gaveUp: [], q: null, gv: null, lastQ: null, hist: [], hints: [], turnQ: 0, hintReq: null, canHint: false, reveal: null };
    patchFn(S, ids, words);
    current.onState(S);
  }, { words: WORDS, patch });
}

test('Spielfeld mit zehn Stirn-Zetteln: eigener Zettel zeigt „?“, lange Begriffe brechen um, Antwortknöpfe sind groß', async ({ page, app }, testInfo) => {
  await start(page, app);
  await fake(page, `
    S.g.sub = 'vote'; S.g.q = { by: ids[3], text: 'Kann man mich essen?', answered: [ids[1]], mine: null };
    S.players[1].answered = true;
    S.g.lastQ = { by: ids[2], text: 'Bin ich ein Tier?', res: 'ja', counts: { ja: 6, nein: 2, weiss: 1 } };
    S.g.hist = [{ t: 'q', by: ids[0], text: 'Bin ich lebendig?', res: 'ja', counts: { ja: 7, nein: 1, weiss: 0 } }, { t: 'q', by: ids[0], text: 'Bin ich groß?', res: 'nein', counts: { ja: 1, nein: 6, weiss: 2 } }];
  `);
  const cards = page.locator('.wb-card');
  await expect(cards).toHaveCount(10);
  // Eigener Zettel: „?“ – und im ganzen Dokument steht der eigene Begriff nirgends
  await expect(cards.first().locator('.wb-note')).toHaveText('?');
  await expect(cards.nth(1).locator('.wb-note')).toHaveText('Schwarzwälder Kirschtorte');
  expect(await page.locator('#kg').innerText()).not.toContain('Elefant');
  // Lange Begriffe laufen nicht über die Karte hinaus
  const box = await cards.nth(5).boundingBox();
  const note = await cards.nth(5).locator('.wb-note').boundingBox();
  expect(note.x + note.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await expect(page.locator('.wb-centre.big')).toContainText('Kann man mich essen?');
  // Antwortknöpfe: groß genug zum Antippen
  const btns = page.locator('.wb-ans');
  await expect(btns).toHaveCount(3);
  for (let i = 0; i < 3; i++) { const b = await btns.nth(i).boundingBox(); expect(b.height).toBeGreaterThanOrEqual(56); expect(b.width).toBeGreaterThanOrEqual(80); }
  await expect(page.locator('.wb-notes')).toContainText('Bin ich lebendig?');
  await page.screenshot({ path: testInfo.outputPath(`spielfeld-${testInfo.project.name}.png`) });
  // Mein Zug: Frage, Raten
  await fake(page, `S.turnId = ids[0]; S.g.sub = 'ask'; S.g.lastQ = { by: ids[9], text: 'Ist es groß?', res: 'nein', counts: { ja: 1, nein: 5, weiss: 0 } };`);
  await expect(page.getByRole('button', { name: 'Frage gestellt' })).toBeVisible();
  await page.getByRole('button', { name: 'Ich rate' }).click();
  await expect(page.getByRole('button', { name: 'Raten', exact: true })).toBeVisible();
  await expect(page.locator('.wb-result.nein')).toContainText('NEIN');
  await page.screenshot({ path: testInfo.outputPath(`zug-${testInfo.project.name}.png`) });
});

test('Erraten: eigener Zettel wird aufgedeckt; Rundenende zeigt alle Begriffe und Fragen', async ({ page, app }, testInfo) => {
  await start(page, app);
  await fake(page, `
    S.g.solved = [ids[0], ids[1]]; S.g.words[ids[0]] = words[0]; S.players[0].place = 1; S.players[1].place = 2;
  `);
  await expect(page.locator('.wb-card').first().locator('.wb-note')).toHaveText('Elefant');
  await expect(page.locator('.wb-card.solved')).toHaveCount(2);
  await fake(page, `
    S.phase = 'over'; S.g.stage = 'over'; S.g.sub = null; S.turnId = null; S.g.solved = [ids[1], ids[0]];
    S.g.reveal = { words: Object.fromEntries(ids.map((id, i) => [id, words[i]])), qs: S.g.qs, solved: S.g.solved };
    S.g.words = S.g.reveal.words;
    S.result = { text: 'Ben war am schnellsten', winners: [ids[1]], points: Object.fromEntries(ids.map((id, i) => [id, i < 2 ? 1000 - i * 100 : 0])), players: ids };
    S.scoreLabel = 'Punkte';
  `);
  const over = page.locator('.kg-over');
  await expect(over).toBeVisible();
  await expect(over.locator('.wb-reveal')).toContainText('Elefant');
  await expect(over.locator('.wb-reveal')).toContainText('Feuerwehrmann');
  await page.waitForTimeout(500); // Einblendung abwarten
  await page.screenshot({ path: testInfo.outputPath(`rundenende-${testInfo.project.name}.png`) });
});

test('Host-Menü: Begriffe-Modus wählbar, kein „Bot hinzufügen“', async ({ page, app }) => {
  await start(page, app);
  await page.locator('[data-kit-panel="host"]').first().click();
  await expect(page.getByRole('button', { name: 'Bot hinzufügen' })).toHaveCount(0);
  await expect(page.locator('.wb-host')).toContainText('Woher kommen die Begriffe?');
  await page.locator('[data-wb-mode="category"]').check();
  await expect(page.locator('[data-wb-cat="tiere"]')).toBeChecked();
  await page.locator('[data-wb-mode="custom"]').check();
  await expect(page.locator('#wb-custom')).toBeVisible();
});
