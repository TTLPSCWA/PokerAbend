import {test,expect,login,selectGame} from './helpers.js';
import {readFileSync} from 'node:fs';
const treasures=JSON.parse(readFileSync(new URL('../../public/games/labyrinth-brett/asset-manifest.json',import.meta.url))).treasures;
async function start(page,app){
  await login(page,app);await selectGame(page,'labyrinth-brett');
  await page.locator('#host-form button[type=submit]').click();
  for(const [event,data] of [['sit',{}],['settings',{turnTime:0,tasks:2}],['addBot',{difficulty:'easy'}],['start',{}]]){
    const ack=await page.evaluate(([event,data])=>send(event,data),[event,data]);expect(ack.ok,ack.error).toBe(true);
  }
  await expect(page.locator('.ml-cell')).toHaveCount(49);
}
// Presentation-only fixture. Server gameplay remains covered by the existing BACKLOG-06 tests.
async function present(page,rotation=0){
  await page.evaluate(rotation=>{
    const s=structuredClone(lastState);s.turnId=s.you.id;s.g.stage='move';s.g.hasTask=true;s.g.task=23;s.g.legal=Array.from({length:49},(_,i)=>i);
    s.g.board=s.g.board.map((t,i)=>({...t,mask:((3<<rotation)|(3>>(4-rotation)))&15,treasure:i<23?i:null}));
    s.g.spare={...s.g.spare,treasure:23};
    // Four public pawns on the same treasure, independent of random room positions.
    s.players=Array.from({length:4},(_,i)=>({...s.players[0],id:i===0?s.you.id:'fixture-'+i,name:['Anna','Ben','Clara','David'][i]}));
    s.g.positions=Object.fromEntries(s.players.map(p=>[p.id,0]));s.g.homes=Object.fromEntries(s.players.map((p,i)=>[p.id,[0,6,48,42][i]]));
    window.artFixture=s;current.onState(s);
  },rotation);
  await page.locator('.ml-treasure-icon').evaluateAll(images=>Promise.all(images.map(image=>image.decode().catch(()=>{}))));
}
test('labyrinth-brett art: every ID, rotations, four pawns, five sizes, zoom, labels and public credits',async({page,app})=>{
  test.setTimeout(90000);await start(page,app);
  for(let rotation=0;rotation<4;rotation++){
    await present(page,rotation);
    const rendered=await page.locator('.ml-cell .ml-treasure').evaluateAll(nodes=>nodes.map(n=>({id:+n.dataset.treasure,file:n.querySelector('img')?.getAttribute('src')??null,number:n.querySelector('.ml-treasure-number').textContent})));
    expect(rendered).toEqual(treasures.slice(0,23).map(t=>({id:t.id,file:t.file?'/games/labyrinth-brett/art/'+t.file:null,number:String(t.id+1)})));
    await expect(page.locator('.ml-spare img')).toHaveAttribute('src','/games/labyrinth-brett/art/sailboat.svg');
    expect(await page.locator('.ml-treasure-icon').evaluateAll(a=>a.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  }
  for(const [width,height] of [[1920,1080],[1440,900],[768,1024],[390,844],[360,800]]){
    await page.setViewportSize({width,height});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width>=768){
      const bottom=await page.locator('[data-cell="48"]').evaluate(e=>e.getBoundingClientRect().bottom);
      const dockTop=await page.locator('#kg-dock').evaluate(e=>e.getBoundingClientRect().top);
      expect(bottom,'The last board row stays above the action dock').toBeLessThanOrEqual(dockTop);
    }
    const geometry=await page.locator('[data-cell="0"]').evaluate(cell=>{
      const treasure=cell.querySelector('.ml-treasure').getBoundingClientRect();
      return [...cell.querySelectorAll('.ml-pawns i')].map(i=>({top:i.getBoundingClientRect().top,treasureBottom:treasure.bottom}));
    });
    expect(geometry).toHaveLength(4);for(const g of geometry)expect(g.top).toBeGreaterThan(g.treasureBottom);
    const scroll=page.locator('.ml-scroll');await scroll.focus();await page.keyboard.press('ArrowRight');
    if(width<=390)await expect.poll(()=>scroll.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
  }
  const zoom=page.locator('[data-g=ml-zoom]');await zoom.focus();await page.keyboard.press('Enter');
  await expect(page.locator('.ml-grid')).toHaveClass(/zoom/);
  await page.evaluate(()=>I18n.select('en'));
  await expect(page.locator('[data-cell="1"]')).toHaveAccessibleName('Cell 2, 2 · Compass');
  await expect(page.locator('.ml-task')).toContainText('24 · Ship');
  const link=page.getByRole('link',{name:'Artwork credits',exact:true});await expect(link).toBeVisible();
  const response=await page.request.get(new URL(await link.getAttribute('href'),app.url).href);
  expect(response.status()).toBe(200);const credits=await response.text();
  for(const t of treasures.filter(t=>t.file))for(const value of [t.file,t.author,t.source,t.licenseUrl])expect(credits).toContain(value);
  // The view supplied to spectators has no owner task. Public treasure images remain visible.
  await page.evaluate(()=>{const s=structuredClone(artFixture);s.you={id:'watcher',playing:false};s.g.task=null;s.g.hasTask=false;current.onState(s);});
  await expect(page.locator('.ml-task')).toContainText('tasks stay private');
  await expect(page.locator('.ml-task img,.ml-cell.target')).toHaveCount(0);
});
test('labyrinth-brett art: actual missing SVG requests preserve the number and accessible name',async({browser,app})=>{
  // Separate page: the shared fixture deliberately treats ANY console error as a failure.
  // This test expects exactly the deliberately injected missing-image network errors.
  const context=await browser.newContext(),page=await context.newPage(),jsErrors=[],consoleErrors=[];
  page.on('pageerror',e=>jsErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.route('**/games/labyrinth-brett/art/compass.svg',r=>r.fulfill({status:404,contentType:'text/plain',body:'Missing test asset'}));
  try{
    await start(page,app);await present(page);
    const cell=page.locator('[data-cell="1"]');
    await expect(cell.locator('.ml-treasure')).toHaveClass(/ml-treasure-fallback/);
    await expect(cell.locator('img')).toHaveCount(0);
    await expect(cell.locator('.ml-treasure-number')).toHaveText('2');
    await expect(cell).toHaveAccessibleName('Feld 2, 2 · Kompass');
    await expect(page.locator('[data-cell="2"] img')).toBeVisible();
    expect(jsErrors).toEqual([]);expect(consoleErrors.length).toBeGreaterThan(0);
    expect(consoleErrors.every(e=>/404 \(Not Found\)/.test(e)),JSON.stringify(consoleErrors)).toBe(true);
  }finally{await context.close();}
});
