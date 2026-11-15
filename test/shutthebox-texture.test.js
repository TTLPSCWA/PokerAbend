import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync,readdirSync}from'node:fs';import{createHash}from'node:crypto';
import{Room}from'../games/shutthebox/room.js';import{seededRandom}from'../games/bot-strategies/index.js';import{boxLobby}from'./helpers/shutthebox-texture-fixture.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),text=p=>read(p).toString('utf8'),manifest=JSON.parse(text('public/games/shutthebox/asset-manifest.json'));
test('Shut the Box texture: one prepared CC0 image, exact bytes and individual original/license records',()=>{
 assert.deepEqual(readdirSync(new URL('../public/games/shutthebox/art/',import.meta.url)),[manifest.file]);const bytes=read(manifest.path);assert.equal(bytes.length,25602);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.width,512);assert.equal(manifest.height,512);for(const h of [manifest.originalSha256,manifest.licenseEvidenceSha256])assert.match(h,/^[a-f0-9]{64}$/);const licenses=text('docs/design/ART_LICENSES.md');for(const s of [manifest.path,manifest.sha256,manifest.sourceUrl,manifest.licenseUrl,'ambientCG'])assert.ok(licenses.includes(s),s);
});
test('Shut the Box: complete native 1–8 player games with 9/12 flaps, public scores and active-player-only combinations',()=>{
 for(let count=1;count<=8;count++)for(const twelve of [false,true]){const{snapshot,meta:m}=boxLobby(count,twelve),r=Room.restore(snapshot,()=>{}),rng=seededRandom(723+count+(twelve?20:0));r.roll=()=>1+Math.floor(rng()*6);
  try{r.start(m.id);assert.equal(r.order.length,count);let steps=0;while(r.phase==='playing'&&steps++<600){const id=r.currentId;r.onTimeout(id);for(const box of Object.values(r.boxes))assert.ok(box.every(n=>Number.isInteger(n)&&n>=1&&n<=(twelve?12:9)));const watch=r.gameView('watcher');assert.equal(watch.combos,null);assert.equal(watch.canOneDie,false);}assert.equal(r.phase,'over');assert.ok(r.result.winners.length>=1);for(const values of Object.values(r.results)){assert.equal(values.length,1);assert.ok(Number.isInteger(values[0])&&values[0]>=0&&values[0]<=(twelve?78:45));}}
  finally{r.dispose();}
 }
});
