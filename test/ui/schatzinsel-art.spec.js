import {test,expect,login,selectGame} from './helpers.js';import {readFileSync} from 'node:fs';
const assets=JSON.parse(readFileSync(new URL('../../public/games/schatzinsel/asset-manifest.json',import.meta.url))).assets;
const options=info=>({viewport:info.project.use.viewport,isMobile:!!info.project.use.isMobile,hasTouch:!!info.project.use.hasTouch});
async function emit(page,event,data={}){const ack=await page.evaluate(([event,data])=>send(event,data),[event,data]);expect(ack.ok,ack.error).toBe(true);}
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
for(const n of [2,3,4])test(`schatzinsel art: ${n} human players / ${n+1} treasures, real private setup, digging, spectator, sizes and keyboard/touch`,async({page,app,browser},info)=>{
 test.setTimeout(120000);const contexts=[],peers=[],errors=[],count=n+1,press=async(p,selector)=>info.project.name==='mobil'?p.locator(selector).tap():p.locator(selector).click();
 try{
  await login(page,app);await selectGame(page,'schatzinsel');await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('.si-lobby-art svg')).toBeVisible();expect(await page.locator('.si-lobby-art svg').evaluate(e=>getComputedStyle(e).filter)).toBe('none');
  await emit(page,'sit');await emit(page,'settings',{turnTime:0,treasures:count});const code=await page.evaluate(()=>lastState.code);
  for(let i=1;i<n;i++){const c=await browser.newContext(options(info));contexts.push(c);const q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));await login(q,app,['Anna','Ben','Clara','David'][i]);await q.evaluate(code=>joinAndEnter(code,'sit'),code);await expect.poll(()=>q.evaluate(()=>lastState?.you.playing)).toBe(true);peers.push(q);}
  const c=await browser.newContext(options(info));contexts.push(c);const watch=await c.newPage();watch.on('pageerror',e=>errors.push(e.message));await login(watch,app,'Watcher');await watch.evaluate(code=>joinAndEnter(code,'watch'),code);
  await emit(page,'start');await expect(page.locator('.si-cell')).toHaveCount(64);await expect(watch.locator('.si-cell')).toHaveCount(0);
  if(info.project.name==='desktop'){await page.locator('[data-cell="0"]').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await expect(page.locator('[data-cell="1"]')).toBeFocused();await page.keyboard.press('Space');}
  else for(const cell of [0,1])await press(page,`[data-cell="${cell}"]`);
  for(let cell=2;cell<count;cell++)await press(page,`[data-cell="${cell}"]`);
  await expect(page.locator('.si-cell.chosen')).toHaveCount(count);const terrain=await page.locator('.si-terrain').innerHTML();
  if(info.project.name==='mobil'&&n===4){
   await press(page,'[data-cell="0"]');const region=page.locator('.si-scroll');await region.evaluate(e=>e.scrollLeft=e.scrollWidth);const offset=await region.evaluate(e=>e.scrollLeft);expect(offset).toBeGreaterThan(0);
   await press(page,'[data-cell="7"]');expect(await region.evaluate(e=>e.scrollLeft),'Selecting a cell retains the panned map').toBeGreaterThanOrEqual(offset-1);
   await press(page,'[data-cell="7"]');await region.evaluate(e=>e.scrollLeft=0);await press(page,'[data-cell="0"]');
  }
  await press(page,'[data-g=si-hide]');await expect.poll(()=>page.evaluate(()=>lastState.g.ready)).toBe(true);expect(await page.evaluate(()=>[...lastState.g.own].sort((a,b)=>a-b))).toEqual(Array.from({length:count},(_,i)=>i));
  expect(await watch.evaluate(()=>lastState.g.own)).toBe(null);await expect(watch.locator('[data-g=si-hide]')).toHaveCount(0);
  for(const q of peers){for(let i=0;i<count;i++)await press(q,`[data-cell="${56+i}"]`);await press(q,'[data-g=si-hide]');}
  await expect.poll(()=>page.evaluate(()=>lastState.g.stage)).toBe('dig');const enemy=await peers[0].evaluate(()=>lastState.you.id);
  await press(page,`[data-g=si-target][data-id="${enemy}"]`);await press(page,'[data-cell="56"]');await expect(page.locator('[data-cell="56"]')).toHaveClass(/found/);expect(await page.evaluate(()=>lastState.turnId===lastState.you.id)).toBe(true);
  await press(page,'[data-cell="0"]');await expect(page.locator('[data-cell="0"]')).toHaveClass(/cold/);await expect.poll(()=>page.evaluate(()=>lastState.turnId!==lastState.you.id)).toBe(true);
  await press(watch,`[data-g=si-target][data-id="${enemy}"]`);expect(await watch.evaluate(()=>lastState.g.own)).toBe(null);
  expect(await watch.locator('.si-map').innerHTML()).toBe(await page.locator('.si-map').innerHTML());
  expect(await page.locator('.si-terrain').innerHTML()).toBe(terrain);
  for(const q of [page,...peers,watch]){const g=await q.evaluate(()=>lastState.g);expect(g.hidden).toBeUndefined();for(const island of g.islands)expect(Object.keys(island).sort()).toEqual(['active','id','ready','remaining','shots']);}
  for(const [width,height]of [[1920,1080],[1440,900],[768,1024],[390,844],[360,800]]){
   await page.setViewportSize({width,height});await settle(page);await page.locator('#kg-main').evaluate(e=>{e.scrollTop=0;e.scrollLeft=0;});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const dimensions=await page.locator('.si-cell').evaluateAll(a=>a.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));expect(dimensions).toHaveLength(64);expect(dimensions.every(r=>r.w>=43.5&&r.h>=43.5)).toBe(true);
   if(width>=768){const bottom=await page.locator('[data-cell="63"]').evaluate(e=>e.getBoundingClientRect().bottom),dock=await page.locator('#kg-dock').evaluate(e=>e.getBoundingClientRect().top);expect(bottom,'All eight search rows above the dock').toBeLessThanOrEqual(dock);}
   if(width<=390){const region=page.locator('.si-scroll');await region.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);}
  }
  // A native touch pan must also reveal the right-hand search columns.
  if(info.project.name==='mobil'){
   const region=page.locator('.si-scroll');await region.evaluate(e=>e.scrollLeft=0);await region.scrollIntoViewIfNeeded();const box=await region.boundingBox(),session=await page.context().newCDPSession(page),y=box.y+Math.min(box.height/2,100),x=Math.min(box.x+box.width-30,320);
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let step=1;step<=8;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-step*15,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
  }
  await page.reload();await expect(page.locator('.si-cell')).toHaveCount(64);expect(await page.evaluate(()=>[...lastState.g.own].sort((a,b)=>a-b))).toEqual(Array.from({length:count},(_,i)=>i));
  await page.evaluate(()=>I18n.select('en'));await expect(page.locator('[data-cell="0"]')).toHaveAccessibleName('A1: dug, cold');await expect(page.locator('.si-key')).toContainText('cold');
  const link=page.getByRole('link',{name:'Island artwork: Kenney · CC0',exact:true}),res=await page.request.get(new URL(await link.getAttribute('href'),app.url).href);expect(res.status()).toBe(200);const credits=await res.text();for(const a of assets)expect(credits).toContain(a.file);
  expect(errors).toEqual([]);
 }finally{for(const c of contexts)await c.close();}
});
test('schatzinsel art: missing decorative WebPs retain all 64 readable and operable search fields',async({browser,app},info)=>{
 const context=await browser.newContext(options(info)),page=await context.newPage(),errors=[],networkErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')networkErrors.push(m.text());});
 await page.route('**/games/schatzinsel/art/*.webp',r=>r.fulfill({status:404,contentType:'text/plain',body:'Missing test artwork'}));
 try{await login(page,app);await selectGame(page,'schatzinsel');await page.locator('#host-form button[type=submit]').click();await emit(page,'sit');await emit(page,'addBot',{difficulty:'easy'});await emit(page,'settings',{turnTime:0});await emit(page,'start');
  await expect(page.locator('.si-cell')).toHaveCount(64);await page.locator('[data-cell="0"]').click();await expect(page.locator('[data-cell="0"]')).toHaveClass(/chosen/);await expect(page.locator('[data-cell="0"]')).toHaveAccessibleName('A1: Dein Schatz');expect(await page.locator('.si-coast-sand').evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(251, 233, 197)');expect(errors).toEqual([]);expect(networkErrors.length).toBeGreaterThan(0);expect(networkErrors.every(e=>/404 \(Not Found\)/.test(e)),JSON.stringify(networkErrors)).toBe(true);
 }finally{await context.close();}
});
