// CARD-UX-01: Kartenbedienung für UNO (farbenchaos), Skip-Bo (stapelrennen) und Phase 10 (zehnetappen)
// bei kleinem Bildschirm, 200 % Browser-Zoom (720×450 CSS-Pixel) und Desktop.
import {test,expect,openTable} from './card-ux-helpers.js';

const sizes=[['klein',360,640],['zoom200',720,450],['desktop',1440,900]];
const measure=(page)=>page.evaluate(()=>{
  const box=(el)=>{if(!el)return null;const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,inView:r.top>=-1&&r.left>=-1&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1};};
  return {overflowX:document.documentElement.scrollWidth-innerWidth,turn:box(document.querySelector('.cix-turn')),selected:box(document.querySelector('#kg-dock .kg-hand [aria-pressed=true]')),
    tooSmall:[...document.querySelectorAll('#kg-dock .kg-hand [data-card-key]')].filter((e)=>e.getBoundingClientRect().width<44).length};
});
for(const game of ['farbenchaos','stapelrennen','zehnetappen'])for(const [label,width,height] of sizes)
  test(`CARD-UX-01 ${game} ${label}: Zug sichtbar, gewählte Karte bleibt im Bild, kein Überlauf, Doppelklick spielt nicht`,async({page,browser,app},info)=>{
    test.setTimeout(90000);
    await page.setViewportSize({width,height});
    const t=await openTable(page,browser,app,info,game);
    try{
      if(game==='zehnetappen'){await page.locator('[data-g=draw-deck]').click();await expect.poll(()=>page.evaluate(()=>lastState.g.step)).toBe('play');}
      const before=await measure(page);
      expect(before.overflowX).toBeLessThanOrEqual(0);
      expect(before.turn?.inView).toBe(true);
      expect(before.tooSmall).toBe(0);
      // Die letzte Handkarte wählen: Sie muss nach dem Einblenden der Auswahlzeile weiterhin sichtbar sein.
      const last=page.locator('#kg-dock .kg-hand [data-card-key]').last(),key=await last.getAttribute('data-card-key');
      await last.scrollIntoViewIfNeeded();await last.click();
      await expect(page.locator(`#kg-dock .kg-hand [data-card-key="${key}"]`)).toHaveAttribute('aria-pressed','true');
      await expect.poll(async()=>(await measure(page)).selected?.inView).toBe(true);
      const after=await measure(page);
      expect(after.overflowX).toBeLessThanOrEqual(0);
      expect(after.turn?.inView).toBe(true);
      // Ein Doppelklick auf eine Karte wählt nur aus oder ab, er löst keine Spielaktion aus.
      const hand=await page.evaluate(()=>JSON.stringify(lastState.g.hand)),revision=await page.evaluate(()=>lastState.g.revision??null);
      await page.locator('#kg-dock .kg-hand [data-card-key]').first().dblclick();
      expect(await page.evaluate(()=>JSON.stringify(lastState.g.hand))).toBe(hand);
      expect(await page.evaluate(()=>lastState.g.revision??null)).toBe(revision);
    }finally{await t.close();}
  });
