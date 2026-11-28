import {mkdirSync,writeFileSync} from 'node:fs';
import { test, expect, login, selectGame } from './release-helpers.js';

async function openRoom(page, app, id, variant) {
  await login(page,app);
  await selectGame(page,id);
  if (variant) await page.locator('#host-variant').selectOption(variant);
  await page.locator('#host-form button[type=submit]').click();
  await expect.poll(()=>page.evaluate(()=>lastState?.game)).toBe(id);
}
async function stageReady(stage) {
  await expect(stage).toHaveAttribute('data-scene-state','ready',{timeout:15000});
  await expect(stage.locator('canvas')).toBeVisible();
  await expect.poll(()=>stage.getAttribute('data-scene-meshes')).toMatch(/^[1-9][0-9]*$/);
}
async function reportStage(stage, info) {
  await expect.poll(async () => {
    const shot = await stage.locator('canvas').screenshot();
    return stage.evaluate(async (_stage,png) => {
      const image=new Image();
      image.src='data:image/png;base64,'+png;
      await image.decode();
      const sample=document.createElement('canvas');
      sample.width=40;sample.height=28;
      const context=sample.getContext('2d',{willReadFrequently:true});
      context.drawImage(image,0,0,sample.width,sample.height);
      const {data}=context.getImageData(0,0,sample.width,sample.height);
      const colors=new Set();
      for(let i=0;i<data.length;i+=4)colors.add([data[i]>>3,data[i+1]>>3,data[i+2]>>3].join(','));
      return colors.size;
    },shot.toString('base64'));
  },{timeout:9500,message:'Rendered canvas has visibly distinct 3D surfaces'}).toBeGreaterThan(9);
  const stats=await stage.evaluate(el=>({
    width:el.clientWidth,height:el.clientHeight,readyMs:Number(el.dataset.sceneReadyMs),
    frameMs:Number(el.dataset.frameMs),draws:Number(el.dataset.sceneDraws),meshes:Number(el.dataset.sceneMeshes),
  }));
  expect(stats.readyMs).toBeGreaterThan(0);
  expect(stats.draws).toBeGreaterThan(0);
  mkdirSync(info.outputPath(),{recursive:true});
  writeFileSync(info.outputPath('3d-metrics.json'),JSON.stringify(stats,null,2));
  await info.attach('3d-frame-geometry',{contentType:'application/json',body:Buffer.from(JSON.stringify(stats))});
}

async function viewports(page, stage, info, prefix) {
  if(info.project.name!=='desktop')return;
  const original=page.viewportSize();
  try{
    for(const [width,height] of [[320,568],[768,1024],[1920,1080],[5120,1440]]){
      await page.setViewportSize({width,height});
      await stage.scrollIntoViewIfNeeded();
      await expect(stage.locator('canvas')).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
      await page.screenshot({path:info.outputPath(prefix+'-'+width+'x'+height+'.png')});
    }
  }finally{await page.setViewportSize(original);}
}

const revision = page => page.evaluate(() => JSON.stringify([
  lastState.hand?.no,lastState.hand?.street,lastState.hand?.toAct,lastState.hand?.currentBet,lastState.hand?.done,
]));
async function actPassively(host, guest) {
  const previous = await revision(host);
  let actor;
  await expect.poll(async () => {
    for(const page of [host,guest]){
      if((await revision(page)) === previous && await page.evaluate(()=>Boolean(lastState.legal))) {
        actor=page;return true;
      }
    }
    return false;
  }).toBe(true);
  await actor.locator('#dock [data-act=call],#dock [data-act=check]').first().click();
  await expect.poll(()=>revision(host)).not.toBe(previous);
}

test('3D Holdem uses the real server room, accessible controls and a reversible 2D switch', async ({page,app,browser}, info) => {
  test.setTimeout(65000);
  await openRoom(page,app,'poker');
  await page.locator('[data-sit]').first().click();
  const code=await page.evaluate(()=>lastState.code);
  const visitor=await browser.newContext();
  try {
    const guest=await visitor.newPage();
    await login(guest,app,'Ben');
    await guest.evaluate(code=>joinAndEnter(code,'watch'),code);
    await guest.locator('[data-sit]').first().click();
    await expect.poll(()=>page.evaluate(()=>lastState.seats.filter(Boolean).length)).toBe(2);
    expect((await page.evaluate(()=>send('settings',{autoNext:false}))).ok).toBe(true);
    await page.locator('#poker-view3d').click();
    const stage=page.locator('#poker-3d-stage');
    await stageReady(stage);
    await page.locator('#felt-msg [data-do=start]').click();
    await expect.poll(()=>page.evaluate(()=>lastState.hand?.street)).toBe('preflop');
    const hit = await stage.locator('canvas').evaluate(async canvas=>{
      const {Engine,Vector3}=await import('/assets/3d/generated/engine.mjs');
      const scene=Engine.LastCreatedScene;
      const engine=scene.getEngine();
      const stack=scene.meshes.find(mesh=>mesh.metadata?.pick==='stack-'+lastState.you.seat);
      const width=engine.getRenderWidth(),height=engine.getRenderHeight();
      const {x,y}=Vector3.Project(Vector3.Zero(),stack.getWorldMatrix(),scene.getTransformMatrix(),
        scene.activeCamera.viewport.toGlobal(width,height));
      return {x:x*canvas.clientWidth/width,y:y*canvas.clientHeight/height};
    });
    await stage.locator('canvas').click({position:hit});
    await expect(page.locator('#poker-chip-inspect')).toHaveAttribute('open','');
    const readout=page.locator('#poker-chip-inspect');
    const stacks=readout.locator('select');
    const firstStack=await stacks.locator('option').nth(1).getAttribute('value');
    await stacks.selectOption(firstStack);
    await expect(readout.locator('output')).toContainText('=');
    await page.locator('[data-poker-angle=board]').click();
    await page.locator('[data-poker-angle=home]').click();
    for (let i=0;i<2;i++) await actPassively(page,guest);
    await expect.poll(()=>page.evaluate(()=>lastState.hand?.street)).toBe('flop');
    await expect(page.locator('#board .card')).toHaveCount(3);
    await stage.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath('poker-3d-flop.png')});
    for (let i=0;i<6;i++) await actPassively(page,guest);
    await expect.poll(()=>page.evaluate(()=>lastState.hand?.street)).toBe('done');
    await expect(page.locator('#board .card')).toHaveCount(5);
    await expect(stage).toHaveAttribute('data-scene-state','ready');
    await stage.scrollIntoViewIfNeeded();
    await reportStage(stage,info);
    await page.screenshot({path:info.outputPath('poker-3d-showdown.png')});
    await viewports(page,stage,info,'poker-3d');
    await page.locator('#poker-view3d').click();
    await expect(stage.locator('canvas')).toHaveCount(0);
    await expect(page.locator('#board .card')).toHaveCount(5);
    await expect.poll(()=>page.evaluate(()=>lastState.code)).toBe(code);
  } finally {await visitor.close();}
});

test('only the Havok worker response allows compilation, and simulates five visual dice', async ({page,app}) => {
  await login(page,app);
  const root = await page.request.get(app.url);
  const worker = await page.request.get(app.url+'/assets/3d/generated/physics-worker.js');
  const wasm = await page.request.get(app.url+'/assets/3d/generated/HavokPhysics.wasm');
  expect(root.ok() && worker.ok() && wasm.ok()).toBeTruthy();
  expect(root.headers()['content-security-policy']).not.toContain('wasm-unsafe-eval');
  expect(worker.headers()['content-security-policy']).toContain("'wasm-unsafe-eval'");
  expect(worker.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
  expect(wasm.headers()['content-type']).toBe('application/wasm');
  const frames = await page.evaluate(() => new Promise((resolve,reject)=>{
    const worker=new Worker('/assets/3d/generated/physics-worker.js');
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Physics response timeout'));},10000);
    worker.onmessage=({data})=>{
      clearTimeout(timer);
      worker.terminate();
      if(data.error){reject(new Error(data.error));return;}
      const { steps,transforms }=data;
      resolve({steps,start:transforms[1],end:transforms[(steps-1)*5*7+1],length:transforms.length,finite:transforms.every(Number.isFinite)});
    };
    worker.postMessage({id:1,mode:'dice',indices:[0,1,2,3,4]});
  }));
  expect(frames).toMatchObject({steps:76,length:76*5*7,finite:true});
  expect(frames.end).toBeLessThan(frames.start);
});

async function startKniffel(page) {
  expect((await page.evaluate(()=>send('sit'))).ok).toBe(true);
  expect((await page.evaluate(()=>send('start'))).ok).toBe(true);
  await expect(page.locator('.kn-sheet')).toBeVisible();
}

test('3D Kniffel holds server dice, preserves the sheet on reconnect and completes a real score card', async ({page, app}, info) => {
  test.setTimeout(95000);
  await openRoom(page,app,'kniffel');
  await startKniffel(page);
  await page.locator('#kniffel-view3d').click();
  const stage=page.locator('#kniffel-3d-stage');
  await stageReady(stage);
  const roll=page.locator('.kn-tray [data-g=roll]');
  await roll.evaluate(button=>{button.click();document.querySelector('.kn-roll').click();});
  await expect.poll(()=>page.evaluate(()=>lastState.g.rolls)).toBe(1);
  await expect(stage).toHaveAttribute('data-scene-state','ready');
  const firstValue=await page.evaluate(()=>lastState.g.dice[0]);
  const firstDie=page.locator('[data-g=keep][data-i="0"]');
  await firstDie.press('Space');
  await expect(firstDie).toHaveAttribute('aria-pressed','true');
  await firstDie.press('Space');
  await expect(firstDie).toHaveAttribute('aria-pressed','false');
  await expect.poll(()=>page.evaluate(async ()=>{
    const {Engine}=await import('/assets/3d/generated/engine.mjs');
    const die=Engine.LastCreatedScene.meshes.find(mesh=>mesh.metadata?.pick===1);
    return die.position.asArray().map(value=>Number(value.toFixed(2)));
  })).toEqual([-3.02,.41,.72]);
  const hit = await stage.evaluate(async stage=>{
    const {Engine,Matrix,Vector3}=await import('/assets/3d/generated/engine.mjs');
    const scene=Engine.LastCreatedScene;
    const die=scene.meshes.find(mesh=>mesh.metadata?.pick===1);
    const canvas=stage.querySelector('canvas');
    const viewport=scene.activeCamera.viewport.toGlobal(canvas.width,canvas.height);
    const point=Vector3.Project(die.position,Matrix.Identity(),scene.getTransformMatrix(),viewport);
    return {x:point.x*canvas.clientWidth/canvas.width,y:point.y*canvas.clientHeight/canvas.height};
  });
  if (info.project.use.hasTouch) await stage.locator('canvas').tap({position:hit});
  else await stage.locator('canvas').click({position:hit});
  await expect(firstDie).toHaveAttribute('aria-pressed','true');
  await roll.click();
  await expect.poll(()=>page.evaluate(()=>[lastState.g.rolls,lastState.g.dice[0],lastState.g.held[0]])).toEqual([2,firstValue,true]);
  await page.locator('[data-g=near3d]').click();
  await page.locator('[data-g=home3d]').click();
  await expect.poll(()=>stage.getAttribute('data-scene-meshes')).toMatch(/^[1-9][0-9]*$/);
  const expected = await page.evaluate(()=>lastState.g.dice);
  await expect.poll(()=>page.evaluate(async ()=>{
    const {Engine,Vector3}=await import('/assets/3d/generated/engine.mjs');
    const {DIE_FACES}=await import('/games/three-d/model.js');
    const dice=Engine.LastCreatedScene.meshes.filter(mesh=>mesh.name==='ivory die');
    return dice.map(mesh=>{
      let top=0;
      let number=0;
      for(const face of DIE_FACES){
        const normal=Vector3.Zero();
        new Vector3(...face.normal).rotateByQuaternionToRef(mesh.rotationQuaternion,normal);
        if(normal.y>top){top=normal.y;number=face.value;}
      }
      return top>.98?number:0;
    });
  })).toEqual(expected);
  await stage.scrollIntoViewIfNeeded();
  await reportStage(stage,info);
  await page.screenshot({path:info.outputPath('kniffel-3d-hold.png')});
  await viewports(page,stage,info,'kniffel-3d');
  const before=await page.evaluate(()=>[lastState.code,lastState.g.dice,lastState.g.rolls,lastState.you.id]);
  await page.reload();
  await stageReady(stage);
  await expect.poll(()=>page.evaluate(()=>[lastState.code,lastState.g.dice,lastState.g.rolls,lastState.you.id])).toEqual(before);
  await page.locator('#kniffel-view3d').click();
  await expect(stage.locator('canvas')).toHaveCount(0);
  await page.locator('.kn-quick [data-g=quick]').click();
  await page.locator('.kn-quick [data-g=score][data-f=chance]').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.sheets[lastState.you.id].chance)).toBeGreaterThan(0);
  expect(await page.evaluate(async ()=>{
    for (let i=0;i<12;i++) {
      if(!(await send('roll')).ok)return false;
      const field=Object.keys(lastState.g.options)[0];
      if(!(await send('score',{field})).ok)return false;
    }
    return true;
  })).toBe(true);
  await expect.poll(()=>page.evaluate(()=>lastState.phase)).toBe('over');
  await expect(page.locator('.kg-over-card')).toBeVisible();
  await page.screenshot({path:info.outputPath('kniffel-2d-result.png')});
});

test('Kniffel Triple keeps weighted scores and remains playable when WebGL2 is unavailable', async ({page, app}, info) => {
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(kind,...args){return kind==='webgl2' ? null : get.call(this,kind,...args);};
  });
  await login(page,app);
  await selectGame(page,'kniffel');
  await page.locator('#host-variant').selectOption('triple');
  await expect(page.locator('#kn-variant-summary')).toContainText('39');
  await page.locator('[data-kniffel-rule="extraBonus"]').check();
  await page.locator('[data-kniffel-rule="joker"]').check();
  await page.screenshot({path:info.outputPath('kniffel-host-triple.png')});
  await page.locator('#host-form button[type=submit]').click();
  await expect(page.locator('.kn-lobby-card')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>[lastState.variant,lastState.settings.extraBonus,lastState.settings.joker])).toEqual(['triple',true,true]);
  await page.screenshot({path:info.outputPath('kniffel-2d-lobby.png')});
  await startKniffel(page);
  await page.locator('#kniffel-view3d').click();
  await expect(page.locator('#kniffel-3d-status')).toContainText('2D');
  await expect(page.locator('#kniffel-3d-stage canvas')).toHaveCount(0);
  await page.locator('.kn-roll').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.rolls)).toBe(1);
  await page.locator('[data-g=column][data-column="2"]').click();
  const pts=await page.evaluate(()=>lastState.g.optionsByColumn[2].chance);
  await page.locator('.kn-quick [data-g=quick]').click();
  await page.locator('.kn-quick [data-g=score][data-f=chance]').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.columnSheets[lastState.you.id][2].chance)).toBe(pts);
  await expect.poll(()=>page.evaluate(()=>lastState.players.find(p=>p.id===lastState.you.id).total)).toBe(pts*3);
  await page.screenshot({path:info.outputPath('kniffel-2d-triple.png')});
});

test('a lost 3D context releases the canvas and leaves the active Kniffel turn playable', async ({page,app}) => {
  await openRoom(page,app,'kniffel');
  await startKniffel(page);
  await page.locator('#kniffel-view3d').click();
  const stage=page.locator('#kniffel-3d-stage');
  await stageReady(stage);
  const dispatched=await page.evaluate(async ()=>{
    const {Engine}=await import('/assets/3d/generated/engine.mjs');
    const surface=Engine.LastCreatedScene.getEngine().getRenderingCanvas();
    return !surface.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
  });
  expect(dispatched).toBe(true);
  await expect(stage.locator('canvas')).toHaveCount(0);
  await expect(page.locator('#kniffel-3d-status')).toContainText('2D');
  await page.locator('.kn-roll').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.rolls)).toBe(1);
});

test('missing Havok WASM falls back after the confirmed Kniffel roll', async ({page,app}) => {
  // Replace the resource name at the worker boundary so this also exercises WebKit's own worker network stack.
  await page.route('**/assets/3d/generated/physics-worker.js',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    expect(source).toContain('HavokPhysics.wasm');
    await route.fulfill({response,body:source.replaceAll('HavokPhysics.wasm','UnavailablePhysics.wasm')});
  });
  await openRoom(page,app,'kniffel');
  await startKniffel(page);
  await page.locator('#kniffel-view3d').click();
  const stage=page.locator('#kniffel-3d-stage');
  await stageReady(stage);
  await page.locator('.kn-roll').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.rolls)).toBe(1);
  await expect(stage.locator('canvas')).toHaveCount(0);
  await expect(page.locator('#kniffel-3d-status')).toContainText('2D');
  await page.locator('.kn-roll').click();
  await expect.poll(()=>page.evaluate(()=>lastState.g.rolls)).toBe(2);
});
