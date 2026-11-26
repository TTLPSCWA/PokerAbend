import {test,expect,login,selectGame} from './helpers.js';import {mkdirSync} from 'node:fs';
import { neighbours, slide } from '../../games/puzzle-panik/logic.js';
const ids=['puzzle-panik','wortjagd','kistenchaos','gummiband-challenge'];
const emit=async(page,event,data={})=>{const r=await page.evaluate(([e,d])=>send(e,d),[event,data]);expect(r.ok,r.error).toBe(true);return r;};
const frame=page=>page.evaluate(()=>window.challengeFrame||lastState.g);
async function capture(page,info,id,name){const dir=`artifacts/backlog10-ui/${id}`;mkdirSync(dir,{recursive:true});await page.screenshot({path:`${dir}/${info.project.name}-${name}.png`,fullPage:true});}
async function tapCell(page,cell,g,touch){const c=page.locator('#rt-canvas'),b=await c.boundingBox(),cols=g.size||g.cols,rows=g.size||g.rows;const position={x:(cell%cols+.5)*b.width/cols,y:(Math.floor(cell/cols)+.5)*b.height/rows*(g.kind==='words'?5/6:1)};if(touch)await c.tap({position});else await c.click({position});}
async function revealPuzzleTile(page, cell, size) {
  const canvas = page.locator('#rt-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const pointOnTile = () => canvas.evaluate((node, { cell, size }) => {
    const pane = node.closest('.rt-wrap');
    const point = () => {
      const rect = node.getBoundingClientRect();
      const scaleX = rect.width / node.offsetWidth;
      const scaleY = rect.height / node.offsetHeight;
      return {
        x: rect.left + (node.clientLeft + (cell % size + .5) * node.clientWidth / size) * scaleX,
        y: rect.top + (node.clientTop + (Math.floor(cell / size) + .5) * node.clientHeight / size) * scaleY,
      };
    };
    // The zoomed canvas scrolls inside its board pane. The game area can
    // also scroll vertically between the fixed player bar and controls.
    for (const scroller of [pane, pane.closest('#kg-main')]) {
      const before = point();
      const clip = scroller.getBoundingClientRect();
      if (before.x < clip.left || before.x >= clip.left + scroller.clientWidth) {
        scroller.scrollLeft += before.x - clip.left - scroller.clientWidth / 2;
      }
      if (before.y < clip.top || before.y >= clip.top + scroller.clientHeight) {
        scroller.scrollTop += before.y - clip.top - scroller.clientHeight / 2;
      }
    }
    const shown = point();
    return { ...shown, hitsCanvas: document.elementFromPoint(shown.x, shown.y) === node };
  }, { cell, size });
  let point;
  await expect.poll(async () => {
    point = await pointOnTile();
    return point.hitsCanvas;
  }).toBe(true);
  return point;
}

async function tapPuzzleTile(page, cell, size, touch) {
  const { x, y } = await revealPuzzleTile(page, cell, size);
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}
async function arrow(page,dir,touch){const key={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'}[dir];if(!touch){await page.keyboard.down(key);return()=>page.keyboard.up(key);}const b=await page.locator(`[data-rt-dir=${dir}]`).boundingBox(),cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});return async()=>{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();};}
for (const size of [3, 4]) {
 test(`Puzzle-Panik: sichtbare Canvas-Felder bei ${size}×${size} und Zoom`, async ({ page, app, browser }, info) => {
  const touch = info.project.name === 'mobil';
  await login(page, app);
  await selectGame(page, 'puzzle-panik');
  await page.locator('#host-form button[type=submit]').click();
  await emit(page, 'settings', { size: String(size) });
  await emit(page, 'sit');
  const code = await page.evaluate(() => lastState.code);
  const peer = await browser.newContext();
  try {
    const guest = await peer.newPage();
    await login(guest, app, 'Puzzlegast');
    await guest.evaluate((code) => joinAndEnter(code, 'sit'), code);
    await page.bringToFront();
    await page.evaluate(() => socket.on('arena', (view) => { window.challengeFrame = view; }));
    await emit(page, 'start');
    await expect.poll(async () => (await frame(page))?.elapsed, { timeout: 12000 }).toBeGreaterThanOrEqual(0);
    const canvas = page.locator('#rt-canvas');
    const zoom = page.locator('[data-g=ch-zoom]');
    let initial;
    for (const zoomed of [false, true]) {
      if (zoomed) {
        await zoom.click();
        await expect(zoom).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(() => canvas.evaluate((node) => node.clientWidth > node.parentElement.clientWidth)).toBe(true);
        const corners = [0, size - 1, size * (size - 1), size * size - 1];
        for (const corner of corners) await revealPuzzleTile(page, corner, size);
      }
      const g = await frame(page);
      expect(g.size).toBe(size);
      const gap = g.board.indexOf(0);
      const tile = initial ?? neighbours(gap, size).find((i) => i !== g.board.length - 1);
      const expected = [...g.board];
      expect(slide(expected, size, tile)).toBe(true);
      await tapPuzzleTile(page, tile, size, touch);
      await expect.poll(async () => (await frame(page)).board).toEqual(expected);
      initial = gap;
    }
  } finally { await peer.close(); }
 });
}

for(const id of ids)test(`BACKLOG-10 ${id}: original lobby and scene, DE/EN rules, keyboard/touch, private views, host pause, reload and real timed result`,async({page,app,browser},info)=>{
 test.setTimeout(150000);const touch=info.project.name==='mobil';await login(page,app);await selectGame(page,id);await page.locator('#host-form button[type=submit]').click();await expect(page.locator('.ch-lobby svg')).toBeVisible();await capture(page,info,id,'lobby');if(id!=='wortjagd')await emit(page,'settings',{playSecs:id==='gummiband-challenge'?10:15});else await emit(page,'settings',{language:touch?'en':'de'});await emit(page,'sit');await emit(page,'addBot');
 const code=await page.evaluate(()=>lastState.code),guestContext=await browser.newContext({viewport:page.viewportSize()}),watchContext=await browser.newContext({viewport:page.viewportSize()});try{
  const guest=await guestContext.newPage(),watch=await watchContext.newPage();await login(guest,app,'Ben');await guest.evaluate(code=>joinAndEnter(code,'sit'),code);await login(watch,app,'Observer');await watch.evaluate(code=>joinAndEnter(code,'watch'),code);
  for(const p of [page,guest,watch])await p.evaluate(()=>{window.challengeFrame=null;window.challengePackets=[];socket.on('arena',g=>{challengeFrame=g;challengePackets.push(g);if(challengePackets.length>80)challengePackets.shift();});});
  await page.locator('#kg [data-kit=help]').click();await page.locator('[data-help-more]').click();await expect(page.locator('.kg-rules')).toContainText('Server');await page.locator('#kg-panel .icon-btn[data-kit=close]').click();await page.evaluate(()=>I18n.select('en'));await page.locator('#kg [data-kit=help]').click();await page.locator('[data-help-more]').click();await expect(page.locator('.kg-rules')).toContainText('server');await capture(page,info,id,'english-rules');await page.locator('#kg-panel .icon-btn[data-kit=close]').click();
  await emit(page,'start');await expect.poll(()=>page.evaluate(()=>challengeFrame?.elapsed??-3000),{timeout:12000}).toBeGreaterThanOrEqual(0);await page.bringToFront();
  if (id === 'puzzle-panik') {
    const initial = await frame(page);
    expect(initial.size).toBe(3);
    const cell = neighbours(initial.board.indexOf(0), initial.size).find((i) => i % initial.size === 1);
    const expected = [...initial.board];
    expect(slide(expected, initial.size, cell)).toBe(true);
    await tapPuzzleTile(page, cell, initial.size, touch);
    await expect.poll(async () => (await frame(page)).board).toEqual(expected);

    // A held direction repeats. From the centre column, left has exactly
    // one legal move before the edge, so the observed result persists.
    expect(slide(expected, initial.size, cell - 1)).toBe(true);
    const release = await arrow(page, 'left', touch);
    try {
      await expect.poll(async () => (await frame(page)).board).toEqual(expected);
    } finally { await release(); }
    expect((await guest.evaluate(()=>challengeFrame||lastState.g)).board).toEqual(initial.board);
    expect((await watch.evaluate(()=>challengeFrame||lastState.g)).board).toEqual([]);
  }
  if(id==='wortjagd'){const g=await frame(page),word=g.board.slice(0,g.size).join('');for(let i=0;i<g.size;i++)await tapCell(page,i,g,touch);await expect(page.locator('#ch-word')).toHaveValue(word);await page.locator('.ch-word-form button[type=submit]').click();await expect.poll(async()=>(await frame(page)).accepted.includes(word)).toBe(true);expect((await guest.evaluate(()=>challengeFrame||lastState.g)).accepted).toEqual([]);expect((await watch.evaluate(()=>challengeFrame||lastState.g)).accepted).toEqual([]);await guest.locator('#ch-word').fill(word);await guest.locator('.ch-word-form button[type=submit]').click();await expect.poll(()=>guest.evaluate(()=>challengeFrame?.accepted.length||0)).toBe(1);const before=(await frame(page)).accepted;const bad=await page.evaluate(g=>send('expeditionAction',{runId:g.runId,round:g.round,seq:99,action:'word',word:'XYZXYZXYZ'}),g);expect(bad.ok).toBe(false);expect((await frame(page)).accepted).toEqual(before);}
  if(id==='kistenchaos'){const g=await frame(page),you=await page.evaluate(()=>lastState.you.id),cell=g.positions[you],dir=cell%g.cols===0?'right':'left',to=cell+(dir==='right'?1:-1);await tapCell(page,to,g,touch);await expect.poll(async()=>(await frame(page)).positions[you]).toBe(to);const release=await arrow(page,dir,touch);try{await expect.poll(async()=>(await frame(page)).bodies.find(p=>p.id===you).moves).toBeGreaterThan(1);}finally{await release();}}
  if(id==='gummiband-challenge'){const before=(await frame(page)).band.tension;if(touch){const b=await page.locator('[data-ch-hold]').boundingBox(),cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});try{await expect.poll(async()=>(await frame(page)).band.tension).toBeGreaterThan(before+8);}finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}}else{await page.keyboard.down('Space');try{await expect.poll(async()=>(await frame(page)).band.tension).toBeGreaterThan(before+8);}finally{await page.keyboard.up('Space');}}expect((await watch.evaluate(()=>challengeFrame||lastState.g)).band).toBe(null);}
  await capture(page,info,id,'playing');const denied=await guest.evaluate(()=>send('gamePause',{paused:true}));expect(denied.ok).toBe(false);await emit(page,'gamePause',{paused:true});const saved=await page.evaluate(()=>({id:lastState.you.id,g:lastState.g}));await capture(page,info,id,'paused');await capture(watch,info,id,'spectator');await page.reload();await expect.poll(()=>page.evaluate(()=>lastState?.gamePaused)).toBe(true);expect(await page.evaluate(()=>lastState.you.id)).toBe(saved.id);expect(await page.evaluate(()=>lastState.g.board)).toEqual(saved.g.board);expect(await page.evaluate(()=>lastState.g.band)).toEqual(saved.g.band);await capture(page,info,id,'reconnect');
  for(const [width,height]of (touch?[[390,844],[360,800]]:[[1920,1080],[1440,900],[768,1024],[390,844],[360,800],[900,450]])){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${id} ${width}`).toBe(true);await capture(page,info,id,`${width}x${height}`);}await page.setViewportSize(touch?{width:390,height:844}:{width:1440,height:900});
  await page.evaluate(()=>{window.challengeFrame=lastState.g;socket.on('arena',g=>challengeFrame=g);});await emit(page,'gamePause',{paused:false});
  if(id!=='gummiband-challenge'&&id!=='wortjagd'){await page.locator('[data-g=ch-zoom]').click();await expect(page.locator('[data-g=ch-zoom]')).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>{const w=document.querySelector('.rt-wrap');return w.scrollWidth>w.clientWidth;})).toBe(true);await capture(page,info,id,'zoom');await page.locator('[data-g=ch-zoom]').click();}
  await page.evaluate(()=>{window.challengeFrame=lastState.g;socket.on('arena',g=>challengeFrame=g);});await emit(page,'gamePause',{paused:false});await expect.poll(()=>page.evaluate(()=>lastState.phase),{timeout:id==='wortjagd'?70000:25000}).toBe('over');await expect(page.locator('.kg-over')).toBeVisible();await expect(page.locator('#kg-over-title')).toHaveText('The highest score wins.');expect(await page.evaluate(()=>Object.values(lastState.result.points).every(Number.isFinite))).toBe(true);if(id==='wortjagd'){await expect(page.locator('.ch-word-results')).toBeVisible();await expect(page.locator('.ch-duplicate').first()).toBeVisible();}await capture(page,info,id,'result');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 }finally{await guestContext.close();await watchContext.close();}
});
