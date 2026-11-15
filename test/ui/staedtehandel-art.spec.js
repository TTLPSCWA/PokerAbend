import {test,expect,login} from './helpers.js';
import {buildingFixture} from '../helpers/staedtehandel-art-fixture.js';
const fixtures=[3,4,5,6].map(n=>buildingFixture(n));
test.use({seedFiles:{'rooms.json':fixtures.map(f=>f.snapshot)}});
for(const {metadata:m}of fixtures)test(`Städtehandel Kenney: ${m.count} players, real saved game, owner glyphs, build, pan and reconnect`,async({page,app},info)=>{
 await page.addInitScript(m=>localStorage.setItem('poker:session:'+m.code,JSON.stringify(m.hostToken)),m);
 await login(page,app);await page.evaluate(code=>joinAndEnter(code),m.code);
 await expect(page.locator('.st-bld.art-ready')).toHaveCount(m.count*2);await expect(page.locator('.st-land')).toHaveCount(m.count<=4?19:30);await expect(page.locator('.st-bld.city')).toHaveCount(m.count);
 const box=await page.locator('.st-svg').getAttribute('viewBox');
 const marks=await page.locator('.st-building-illustration').evaluateAll(gs=>gs.map(g=>({color:g.querySelector('ellipse').getAttribute('fill'),glyph:g.querySelector('text').textContent,pointer:getComputedStyle(g.querySelector('image')).pointerEvents,hidden:g.getAttribute('aria-hidden'),width:g.querySelector('image').width.baseVal.value})));
 expect(new Set(marks.map(m=>m.color)).size).toBe(m.count);expect(new Set(marks.map(m=>m.glyph)).size).toBe(m.count);expect(marks.every(m=>m.pointer==='none'&&m.hidden==='true'&&[28,32].includes(m.width))).toBe(true);
 expect(await page.evaluate(()=>{
  const rect=e=>e.getBoundingClientRect(),builds=[...document.querySelectorAll('.st-bld')].map(rect),details=[...document.querySelectorAll('.st-token,.st-port circle,.st-hex .st-art')].map(rect);
  const overlap=(a,b)=>a.left<b.right-.1&&a.right>b.left+.1&&a.top<b.bottom-.1&&a.bottom>b.top+.1;
  return builds.every((a,i)=>details.every(b=>!overlap(a,b))&&builds.slice(i+1).every(b=>!overlap(a,b)));
 }),'Buildings leave numbers, resource icons, ports and neighbouring buildings clear').toBe(true);
 await page.locator('[data-g=st-zoom][data-z="+"]').click();expect(await page.locator('.st-svg').getAttribute('viewBox')).toBe(box);
 const region=page.locator('.st-viewport');await region.evaluate(e=>e.scrollLeft=0);
 if(info.project.name==='mobil'){
  const b=await region.boundingBox(),cdp=await page.context().newCDPSession(page),x=Math.min(b.x+b.width-25,350),y=b.y+45;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*15,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }else{await region.focus();await page.keyboard.press('ArrowRight');}
 await expect.poll(()=>region.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
 await page.locator('[data-g=st-zoom][data-z=fit]').click();await page.locator('[data-g=st-tool][data-tool=city]').click();await expect(page.locator('.st-spot.city')).toHaveCount(1);await expect(page.locator('.st-buildlist [data-kind=city]')).toHaveCount(1);
 // A decorative building must not intercept its legal upgrade target.
 await page.locator('.st-spot.city').scrollIntoViewIfNeeded();
 expect(await page.locator('.st-spot.city').evaluate(e=>{const r=e.querySelector('.ring').getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit?.closest('.st-spot')===e;})).toBe(true);
 if(info.project.name==='mobil')await page.locator('.st-buildlist [data-kind=city]').tap();else{await page.locator('.st-spot.city').focus();await page.keyboard.press('Enter');}
 await expect(page.locator('.st-bld.city')).toHaveCount(m.count+1);const buildings=await page.evaluate(()=>lastState.g.buildings);await page.reload();await expect(page.locator('.st-bld.art-ready')).toHaveCount(m.count*2);expect(await page.evaluate(()=>lastState.g.buildings)).toEqual(buildings);
 await page.evaluate(()=>I18n.select('en'));await expect(page.locator('.st-side')).toContainText('Costs');await expect(page.getByRole('link',{name:'Artwork credits'})).toHaveAttribute('href','/games/staedtehandel/credits.html');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('Städtehandel Kenney: HTTP failure, corrupt image and partial loading retain real SVG fallback',async({browser,app},info)=>{
 for(const fault of ['missing','corrupt','city-only','svg-error']){
  // Network fault injection must bypass a service worker's valid cached copy.
  const context=await browser.newContext({...info.project.use,serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const requests=new Map();
  try{await page.route('**/games/staedtehandel/art/*.webp*',r=>{const url=r.request().url();requests.set(url,(requests.get(url)||0)+1);return fault==='city-only'&&url.endsWith('_000.webp')||fault==='svg-error'&&!url.includes('?svg-error')?r.continue():r.fulfill({status:fault==='missing'||fault==='svg-error'?404:200,contentType:'image/webp',body:'invalid WebP test bytes'});});
   await login(page,app,'Watcher '+fault);await page.evaluate(code=>joinAndEnter(code),fixtures[0].metadata.code);await expect(page.locator('.st-bld')).toHaveCount(6);
   await expect.poll(()=>requests.size).toBe(2);
   // A fresh URL forces an actual SVG error after successful HTML preloading;
   // reusing the URL would simply reuse Chromium's decoded memory cache.
   if(fault==='svg-error'){
    await expect(page.locator('.st-bld.art-ready')).toHaveCount(6);
    await page.locator('.st-building-art').evaluateAll(images=>images.forEach(i=>i.setAttribute('href',i.getAttribute('href')+'?svg-error=1')));
    await expect.poll(()=>requests.size).toBe(4);
   }
   if(fault==='city-only')await expect(page.locator('.st-bld.art-ready')).toHaveCount(3);else await expect(page.locator('.st-bld.art-ready')).toHaveCount(0);
   expect(await page.locator('.st-bld:not(.art-ready) .st-building-fallback').evaluateAll(gs=>gs.every(g=>getComputedStyle(g).visibility==='visible'&&!!g.querySelector('path').getAttribute('fill')&&!!g.querySelector('text').textContent))).toBe(true);
   const count=fault==='city-only'?3:6;await expect(page.locator('.st-bld:not(.art-ready)')).toHaveCount(count);await expect(page.locator('.st-spot')).toHaveCount(0);expect(await page.evaluate(()=>lastState.g.hand)).toBe(null);
   await page.locator('[data-g=st-zoom][data-z="+"]').click();await expect(page.locator('.st-bld:not(.art-ready)')).toHaveCount(count);expect(errors).toEqual([]);
  }finally{await context.close();}
 }
});
