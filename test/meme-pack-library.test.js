import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import express from 'express';
import { once } from 'node:events';
import { createAdmin } from '../server/admin.js';
import { createMemePackLibrary } from '../server/meme-pack-library.js';

function disk(t) {
  const path = mkdtempSync(join(tmpdir(),'meme-pack-test-'));
  t.after(()=>rmSync(path,{recursive:true,force:true}));
  return path;
}
const original = {
  type:'community', titleDe:'Wohnzimmer', titleEn:'Living room', template:'plant',
  situationDe:'Ein Gast klingelt.', situationEn:'A guest rings the bell.',
  captionDe:'Schon wieder.', captionEn:'Here we go again.',
  source:'https://example.org/rights', license:'Eigene Texte und freigegebenes internes Motiv', extended:false,
};

test('The review gate persists challenged, approved and disabled entries independently of uploads', t=>{
  const dir = disk(t), store = createMemePackLibrary(dir);
  assert.throws(()=>store.create({...original,source:'file:///fake'}), /HTTPS/);
  assert.throws(()=>store.create({...original,template:'foreign-image'}), /Motiv/);
  const pending = store.create(original);
  assert.equal(pending.status,'pending');
  assert.deepEqual(store.approved(),[]);
  assert.throws(()=>store.create({...original,titleDe:'Gleicher Beitrag'}), /existiert/);
  assert.throws(()=>store.review(pending.id,'approved',false), /ausdrücklich/);
  store.review(pending.id,'approved',true);
  let loaded = createMemePackLibrary(dir);
  assert.deepEqual(loaded.approved().map(entry=>entry.template),['plant']);
  loaded.review(pending.id,'disabled',false);
  loaded = createMemePackLibrary(dir);
  assert.deepEqual(loaded.approved(),[]);
});

test('Only an authenticated admin can approve a contribution from the browser origin', async t=>{
  const dir = disk(t), memePacks = createMemePackLibrary(dir);
  const app=express();
  const {router}=createAdmin({dataDir:dir,password:'test-admin-only',secret:'test-signing-only',log:{add(){}},memePacks});
  app.use('/admin',router);
  const server=app.listen(0,'127.0.0.1');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  await once(server,'listening');
  const origin='http://127.0.0.1:'+server.address().port;
  const call=(path,{value,cookie,source=origin}={})=>fetch(origin+'/admin/api'+path,{
    method:value ? 'POST' : 'GET',
    headers:{origin:source,'x-requested-with':'spieleabend','content-type':'application/json',...(cookie ? {cookie} : {})},
    body:value ? JSON.stringify(value) : undefined,
  });
  assert.equal((await call('/meme-packs')).status,401);
  const login=await call('/login',{value:{password:'test-admin-only'}});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/meme-packs',{cookie,value:original,source:'https://example.org'})).status,403);
  const created=await call('/meme-packs',{cookie,value:original});
  assert.equal(created.status,200);
  const {entry}=await created.json();
  assert.deepEqual(memePacks.approved(),[]);
  const review='/meme-packs/'+entry.id+'/review';
  assert.equal((await call(review,{cookie,value:{status:'approved'}})).status,400);
  assert.equal((await call(review,{cookie,value:{status:'approved',confirmed:true}})).status,200);
  assert.equal(memePacks.approved()[0].id,entry.id);
  assert.equal((await call(review,{cookie,value:{status:'disabled'}})).status,200);
  assert.deepEqual(memePacks.approved(),[]);
});

test('A fixed provider collects deduplicated chart metadata at most daily without automatically approving images', async t=>{
  let clock=100000000, attempt=0;
  const store=createMemePackLibrary(disk(t), {
    now:()=>clock,
    fetchCatalog:async url=>{
      assert.equal(url,'https://api.imgflip.com/get_memes');
      attempt++;
      return {ok:true,json:async()=>({success:true,data:{memes:[
        {id:'11',name:'First',url:'https://foreign.example/image'},
        {id:'11',name:'Duplicate'}, {id:'22',name:'FIRST'},
        ...(attempt===2 ? [{id:'99',name:'Second'}] : []),
      ]}})};
    },
  });
  assert.equal(await store.refresh(),false);
  store.configure(true);
  assert.equal(await store.refresh(),true);
  assert.equal(await store.refresh(),false);
  assert.equal(store.list().listings[0].observation,'initial');
  assert.equal(store.list().listings.length,1);
  clock+=86400000;
  await store.refresh();
  assert.equal(store.list().listings[1].observation,'new-in-chart');
  assert.ok(!JSON.stringify(store.list()).includes('foreign.example'));
  assert.deepEqual(store.approved(),[]);
});
