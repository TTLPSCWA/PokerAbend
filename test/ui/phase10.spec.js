// Phase 10 – Oberfläche: Auswahl mit zwei Gruppen, gültige 6er-Folge, Anlegen mit leuchtenden Zielen, Joker mit festem Wert, Abwerfen.
// Der Zustand wird nach dem Start eines echten Spiels mit gebauten Karten überschrieben (nur Anzeige; der Server entscheidet).
// Läuft mit: npx playwright test test/ui/phase10.spec.js   (desktop 1440 × 900 und mobil 390 × 844)
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
  await page.locator('[data-host="zehnetappen"]').first().click();
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('#kg')).toBeVisible();
  await page.getByRole('button', { name: 'Mitspielen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zuschauen', exact: true })).toBeVisible();
  await page.locator('[data-kit-panel="host"]').first().click();
  await page.getByRole('button', { name: 'Bot hinzufügen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Computer-Mitspieler' })).toContainText('Bot 1');
  await page.locator('.panel-head [data-kit="close"]').click();
  await page.getByRole('button', { name: /starten/ }).first().click();
  await expect(page.locator('.ze-hand .kc').first()).toBeVisible();
}

// Gebauter Zustand: ich bin dran und habe gezogen
async function fake(page, { phase, hand, laid = {}, laidDone = false }) {
  await page.evaluate(({ phase, hand, laid, laidDone }) => {
    const S = JSON.parse(JSON.stringify(lastState));
    const me = S.you.id;
    S.turnId = me;
    const GROUPS = { 2: [{ type: 'set', size: 3 }, { type: 'run', size: 4 }], 4: [{ type: 'run', size: 7 }] };
    S.g.step = 'play'; S.g.myPhase = phase; S.g.myGroups = GROUPS[phase]; S.g.phaseText = phase === 2 ? 'Drilling + 4er-Folge' : '7er-Folge';
    S.g.hand = hand.map(([c, n], i) => ({ id: 9000 + i, c, n }));
    S.g.laid = laid;
    for (const p of S.players) if (p.id === me) p.laidDone = laidDone;
    current.onState(S);
  }, { phase, hand, laid, laidDone });
}
const tapHand = (page, n) => page.locator('.ze-hand .kc').nth(n).click();

test('Auswahl mit zwei Gruppen, gültige 6er-Folge, Auslegen-Knopf erst bei gültigen Gruppen', async ({ page, app }, testInfo) => {
  await start(page, app);
  // Hand (sortiert wie geliefert): 7r 7g 7b | 3r 4g 5b 6y 7y 8r(Joker-frei) + Joker + 12b
  await fake(page, { phase: 2, hand: [['r', 7], ['g', 7], ['b', 7], ['r', 3], ['g', 4], ['b', 5], ['y', 6], ['j', 0], ['r', 8], ['b', 12]] });
  const slots = page.locator('.ze-slot');
  await expect(slots).toHaveCount(2);
  await expect(page.locator('.ze-slot.active')).toContainText('Gruppe 1');
  // Drei Siebener → Gruppe 1, Zähler und Marken
  for (const i of [0, 1, 2]) await tapHand(page, i);
  await expect(slots.nth(0)).toContainText('3/3+');
  await expect(slots.nth(0)).toContainText('✓');
  await expect(page.locator('.ze-hand .ze-badge')).toHaveCount(3);
  await expect(page.locator('.ze-count')).toContainText('3 ausgewählt');
  // Gruppe 2 wählen, zwei Karten: noch keine Folge
  await slots.nth(1).locator('.ze-slot-head').click();
  await expect(page.locator('.ze-slot.active')).toContainText('Gruppe 2');
  for (const i of [3, 4]) await tapHand(page, i);
  await expect(slots.nth(1).locator('.ze-why')).toContainText(/noch 2 Karten|fehlt/);
  await expect(page.getByRole('button', { name: 'Phase auslegen' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath(`auswahl-${testInfo.project.name}.png`) });
  // Lücke: 3, 4, 6 → „5 fehlt“ (Joker noch nicht dabei)
  await tapHand(page, 6);
  await expect(slots.nth(1).locator('.ze-why')).toContainText('5 fehlt');
  // Sechserfolge 3 4 5 6 + Joker (7) + 8: mehr Karten als verlangt, gültig
  await tapHand(page, 5); await tapHand(page, 7); await tapHand(page, 8);
  await expect(slots.nth(1)).toContainText('6/4+');
  await expect(slots.nth(1).locator('.ze-why')).toContainText('✓ passt');
  await expect(page.getByRole('button', { name: 'Phase auslegen' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath(`sechser-${testInfo.project.name}.png`) });
  // Karte im Feld antippen = zurück in die Hand; Auswahl aufheben leert alles
  await slots.nth(1).locator('.kc').first().click();
  await expect(slots.nth(1)).toContainText('5/4+');
  await page.getByRole('button', { name: 'Auswahl aufheben' }).click();
  await expect(page.locator('.ze-hand .ze-badge')).toHaveCount(0);
});

test('Anlegen: passende Auslagen leuchten, Joker zeigt seinen festen Wert; Abwerfen ist ein eigener Modus', async ({ page, app }, testInfo) => {
  await start(page, app);
  const me = await page.evaluate(() => lastState.you.id);
  const laid = {
    [me]: [{ type: 'set', cards: [{ id: 1, c: 'r', n: 7 }, { id: 2, c: 'g', n: 7 }, { id: 3, c: 'b', n: 7 }], vals: [7, 7, 7] },
      { type: 'run', cards: [{ id: 4, c: 'r', n: 3 }, { id: 5, c: 'g', n: 4 }, { id: 6, c: 'j', n: 0 }, { id: 7, c: 'y', n: 6 }], vals: [3, 4, 5, 6] }],
  };
  await fake(page, { phase: 2, laidDone: true, laid, hand: [['y', 7], ['b', 9], ['j', 0], ['r', 2], ['s', 0]] });
  await expect(page.locator('.ze-jv')).toContainText('★ = 5');
  await expect(page.locator('.ze-group.can')).toHaveCount(0);
  // Gelbe 7: passt an den Satz (7) und an das obere Ende der Folge (7)
  await tapHand(page, 0);
  await expect(page.locator('.ze-group.can')).toHaveCount(2);
  await expect(page.locator('.kc.ze-sel')).toHaveCount(1);
  // Blaue 9: passt nirgends → nichts leuchtet
  await tapHand(page, 1);
  await expect(page.locator('.ze-group.can')).toHaveCount(0);
  // Joker: Satz und beide Enden der Folge → Folge zeigt „unten“ und „oben“
  await tapHand(page, 2);
  await expect(page.locator('.ze-group.can')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /unten \(2\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /oben \(7\)/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`anlegen-${testInfo.project.name}.png`) });
  // Abwerfen: eigener Modus mit rotem Rand, Ablage leuchtet, nur genau eine Karte
  await page.getByRole('button', { name: 'Karte abwerfen …' }).click();
  await expect(page.locator('.ze-group.can')).toHaveCount(0);
  await tapHand(page, 3);
  await expect(page.locator('.kc.ze-disc')).toHaveCount(1);
  await expect(page.locator('.kg-pile.ze-target')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Abwerfen', exact: true })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath(`abwerfen-${testInfo.project.name}.png`) });
  await tapHand(page, 3); // abwählen
  await expect(page.getByRole('button', { name: 'Abwerfen', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Zurück zum Anlegen' }).click();
  await expect(page.locator('.kg-pile.ze-target')).toHaveCount(0);
});
