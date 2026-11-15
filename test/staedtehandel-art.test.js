import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {Room} from '../games/staedtehandel/room.js';
import {RES,SIZES} from '../games/staedtehandel/map.js';
import {buildingFixture} from './helpers/staedtehandel-art-fixture.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),text=p=>read(p).toString('utf8');
const manifest=JSON.parse(text('public/games/staedtehandel/asset-manifest.json'));
function renderer(lang='de',decode=true){
 let def,renders=0;const images=[];
 class Image{constructor(){images.push(this);}async decode(){if(!decode)throw Error('Invalid image');}}
 vm.runInNewContext(text('public/games/staedtehandel/staedtehandel.js'),{
  I18n:{language:lang},Image,window:{innerWidth:1440},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
  document:{addEventListener(){},querySelectorAll:()=>[],querySelector:s=>s==='.st-svg'?{}:null},kitGame:d=>{def=d;return {render(){renders++;}};},
 });
 return {def,images,get renders(){return renders;},async load(){def.afterRender();await Promise.all(images.map(i=>i.onload()));}};
}

test('Städtehandel art: exactly two prepared CC0 WebPs with individual provenance and byte hashes',()=>{
 assert.equal(manifest.assets.length,2);assert.equal(manifest.reviewedButNotUsed.length,4);
 assert.deepEqual(readdirSync(new URL('../public/games/staedtehandel/art/',import.meta.url)).sort(),manifest.assets.map(a=>a.file).sort());
 const licenses=text('docs/design/ART_LICENSES.md'),credits=text('public/games/staedtehandel/credits.html'),js=text('public/games/staedtehandel/staedtehandel.js');let bytes=0;
 for(const a of manifest.assets){const b=read(a.path);assert.equal(b.length,a.bytes);bytes+=b.length;assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(a.license,'CC0-1.0');assert.equal(a.author,'Kenney Vleugels');assert.ok(a.width<=a.originalWidth&&a.height<=a.originalHeight);assert.match(a.originalSha256,/^[a-f0-9]{64}$/);for(const s of [a.path,a.author,a.sourceFile,a.licenseUrl,a.sha256])assert.ok(licenses.includes(s),s);for(const s of [a.file,a.author,a.sourceFile,a.licenseUrl,a.sha256])assert.ok(credits.includes(s),s);assert.ok(js.includes('/games/staedtehandel/art/'+a.file));}
 assert.equal(bytes,6250);const notice=text(manifest.licenseEvidence.path).replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(notice).digest('hex'),manifest.licenseEvidence.canonicalSha256);assert.match(notice,/Creative Commons Zero, CC0/);
});

test('Städtehandel art: original SVG until decoded, cached load once per file, corrupt images keep fallback',async()=>{
 const {snapshot,metadata:m}=buildingFixture(),room=Room.restore(snapshot,()=>{});
 try{const S=room.view(m.hostId),r=renderer();assert.doesNotMatch(r.def.main(S),/art-ready|<image/);await r.load();assert.equal(r.renders,2);assert.equal((r.def.main(S).match(/st-building-art/g)||[]).length,6);r.def.afterRender();assert.equal(r.images.length,2);
  const broken=renderer('de',false);await broken.load();assert.equal(broken.renders,0);assert.doesNotMatch(broken.def.main(S),/art-ready|<image/);assert.equal((broken.def.main(S).match(/st-building-fallback/g)||[]).length,6);
 }finally{room.dispose();}
});

test('Städtehandel art: native saved fixtures retain both building types, colors, geometry and resources for 3–6 players',async()=>{
 for(let n=3;n<=6;n++){const {snapshot,metadata:m}=buildingFixture(n),room=Room.restore(snapshot,()=>{});
  try{const S=room.view(m.hostId),before=JSON.stringify(S),r=renderer();await r.load();r.def.onState(S);const html=r.def.main(S);assert.equal(JSON.stringify(S),before,'Rendering is read-only');assert.equal((html.match(/class="st-bld /g)||[]).length,2*n);assert.ok(html.includes(`viewBox="${S.g.board.box.join(' ')}"`));assert.deepEqual(S.g.buildings,snapshot.extra.s.buildings);
   for(const [v,b]of Object.entries(S.g.buildings)){const [x,y]=S.g.board.vs[v];assert.ok(html.includes(`transform="translate(${x} ${y})"><title>${b.t==='c'?'Stadt':'Siedlung'}`));assert.ok(html.includes(['●','▲','■','◆','★','✚'][S.g.colors[b.o]]));}
   assert.equal(Object.values(S.g.buildings).filter(b=>b.t==='c').length,n);for(const res of RES)assert.equal(room.s.bank[res]+room.s.players.reduce((sum,p)=>sum+room.s.res[p][res],0),SIZES[m.size].bank);
   r.def.onClick({dataset:{g:'st-tool',tool:'city'}},S);const active=r.def.main(S);assert.equal((active.match(/class="st-spot city"/g)||[]).length,S.g.legal.city.length);assert.equal((active.match(/<li><button type="button" class="btn" data-g="st-spot" data-kind="city"/g)||[]).length,S.g.legal.city.length);
  }finally{room.dispose();}
 }
});

test('Städtehandel art: enemy resource composition and deck order never change rendered host or spectator markup',async()=>{
 const {snapshot,metadata:m}=buildingFixture(6),rooms=[Room.restore(structuredClone(snapshot),()=>{}),Room.restore(structuredClone(snapshot),()=>{})];
 try{const other=rooms[1].s.players.find(p=>p!==m.hostId),total=RES.reduce((n,res)=>n+rooms[0].s.res[other][res],0);assert.ok(total>0);
  for(const [i,r]of rooms.entries()){for(const res of RES)r.s.res[other][res]=0;r.s.res[other][i?'ton':'holz']=total;}
  assert.notDeepEqual(rooms[0].s.res[other],rooms[1].s.res[other]);rooms[1].s.deck.reverse();assert.notDeepEqual(rooms[0].s.deck,rooms[1].s.deck);
  for(const who of [m.hostId,'watcher'])for(const lang of ['de','en']){const views=rooms.map(r=>r.view(who)),r=renderer(lang);await r.load();assert.deepEqual(views[0].g,views[1].g);assert.equal(r.def.main(views[0]),r.def.main(views[1]));assert.equal(r.def.dock(views[0],false),r.def.dock(views[1],false));assert.ok(!JSON.stringify(views[0].g).includes('"deck"'));if(who==='watcher'){assert.equal(views[0].g.hand,null);assert.equal((r.def.main(views[0]).match(/class="st-spot /g)||[]).length,0);}}
 }finally{for(const r of rooms)r.dispose();}
});
