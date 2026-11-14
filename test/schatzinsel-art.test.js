import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
import {Room} from '../games/schatzinsel/room.js';import {seededRandom} from '../games/bot-strategies/index.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),text=p=>read(p).toString('utf8'),manifest=JSON.parse(text('public/games/schatzinsel/asset-manifest.json'));
function renderer(lang='de'){
 let def;vm.runInNewContext(text('public/games/schatzinsel/schatzinsel.js'),{I18n:{content:(de,en)=>lang==='de'?de:en},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),BacklogKit:{commands:()=>({blocked:S=>!!S.gamePaused,notice:()=>'',run(){}})},document:{addEventListener(){},querySelector:()=>null},kitGame:d=>{def=d;return {render(){}};}});
 return def;
}
function lobby(n,count){const r=new Room('ART',{turnTime:0,treasures:count},()=>{});r.game='schatzinsel';for(let i=0;i<n;i++){const p=r.addPlayer(['Anna','Ben','Clara','David'][i],'◆');p.connected=true;r.sit(p.id);}return r;}
function render(def,S,target){def.onState(S);if(target)def.onClick({dataset:{g:'si-target',id:target}},S,{detail:1});return def.main(S)+def.dock(S);}

test('Schatzinsel art: only 11 prepared CC0 WebPs, exact bytes, local references and individual source records',()=>{
 assert.equal(manifest.assets.length,11);assert.equal(manifest.reviewedButNotUsed.length,3);
 assert.deepEqual(readdirSync(new URL('../public/games/schatzinsel/art/',import.meta.url)).sort(),manifest.assets.map(a=>a.file).sort());
 const css=text('public/games/schatzinsel/schatzinsel.css'),js=text('public/games/schatzinsel/schatzinsel.js'),licenses=text('docs/design/ART_LICENSES.md'),credits=text('public/games/schatzinsel/credits.html');let total=0;
 for(const a of manifest.assets){const bytes=read(a.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256,a.path);assert.equal(bytes.length,a.bytes);total+=bytes.length;assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(a.width,64);assert.equal(a.height,64);assert.equal(a.license,'CC0-1.0');assert.equal(a.author,'Kenney Vleugels');assert.match(a.originalSha256,/^[a-f0-9]{64}$/);for(const s of [a.path,a.sourceFile,a.author,a.licenseUrl])assert.ok(licenses.includes(s),s);for(const s of [a.file,a.sourceFile,a.author,a.licenseUrl])assert.ok(credits.includes(s),s);assert.ok(css.includes('/games/schatzinsel/art/'+a.file),a.file);}
 assert.equal(total,9884);assert.doesNotMatch(css,/url\(['"]?https?:/);assert.doesNotMatch(js,/fetch\(|Math\.random/);
 assert.match(text('public/games/schatzinsel/kenney-LICENSE.txt'),/Creative Commons Zero, CC0/);
});

test('Schatzinsel privacy: independent real rooms with different enemy secrets yield identical views and full rendered DOM (2–4 players, 3–5 treasures)',()=>{
 for(let n=2;n<=4;n++)for(let count=3;count<=5;count++){
  const seed=lobby(n,count),snapshot=seed.snapshot();seed.dispose();const rooms=[Room.restore(snapshot,()=>{}),Room.restore(snapshot,()=>{})];
  try{
   for(const [variant,r]of rooms.entries()){
    r.start(r.hostId);for(const [i,id]of r.order.entries())r.placeTreasures(id,{key:r.key,cells:(i===1?(variant?[9,19,29,39,49]:[9,18,27,36,45]):[0,7,27,56,63]).slice(0,count)});
    r.dig(r.order[0],{key:r.key,revision:r.revision,target:r.order[1],cell:9});
   }
   const [a,b]=rooms[0].order;
   assert.notDeepEqual(rooms[0].gameView(b).own,rooms[1].gameView(b).own,'Fixtures must really differ');
   for(const viewer of [a,'watcher']){
    const views=rooms.map(r=>r.view(viewer)),projected=views.map(S=>{const g=structuredClone(S.g);delete g.key;return g;});assert.deepEqual(projected[0],projected[1]);
    if(viewer==='watcher')for(const S of views)assert.equal(S.g.own,null);
    for(const lang of ['de','en']){const def=renderer(lang),html=views.map(S=>render(def,S,b));assert.equal(html[0],html[1],'Classes, attributes, URLs and labels must not depend on enemy secrets');assert.equal((html[0].match(/data-cell="/g)||[]).length,64);assert.equal((html[0].match(/class="si-cell [^"]*\bfound\b/g)||[]).length,1);}
   }
  }finally{for(const r of rooms)r.dispose();}
 }
});

test('Schatzinsel rendering: all 64 coordinates, public H/W/K/miss/hit states, private choices, spectator and paused controls',()=>{
 const r=lobby(2,3);try{r.start(r.hostId);const [a,b]=r.order;
  for(const lang of ['de','en']){
   const def=renderer(lang),hide=r.view(a);def.onState(hide);def.onClick({dataset:{g:'si-cell',cell:'0'}},hide,{detail:1});
   const chosen=def.main(hide);assert.match(chosen,/si-cell [^"]*chosen/);assert.ok(chosen.includes(lang==='de'?'A1: Dein Schatz':'A1: Your treasure'));
   const watcher=r.view('watcher');assert.doesNotMatch(render(def,watcher),/data-cell=/);assert.ok(!def.dock(watcher).includes('data-g="si-hide"'));
   r.placeTreasures(a,{key:r.key,cells:[0,7,63]});r.placeTreasures(b,{key:r.key,cells:[9,31,62]});
   const S=r.view(a);S.g.islands[1].shots=[{cell:0,hit:false,heat:'cold'},{cell:1,hit:false,heat:'warm'},{cell:2,hit:false,heat:'hot'},{cell:3,hit:false,heat:null},{cell:9,hit:true,heat:null}];
   const html=render(def,S,b);for(let cell=0;cell<64;cell++){const coord=String.fromCharCode(65+cell%8)+(Math.floor(cell/8)+1);assert.ok(html.includes(`aria-label="${coord}:`),coord);}
   for(const mark of ['K','W','H','×','◆'])assert.ok(html.includes(`aria-hidden="true">${mark}</span>`));
   assert.equal((html.match(/own-treasure/g)||[]).length,0);
   const own=render(def,S,a);assert.equal((own.match(/own-treasure/g)||[]).length,3);
   S.gamePaused=true;assert.equal((render(def,S,b).match(/data-cell="\d+" disabled/g)||[]).length,64);
   // Reset with a new round key for the next language, including actual hide state.
   r.abortRound(r.hostId);r.start(r.hostId);
  }
 }finally{r.dispose();}
});

test('Schatzinsel gameplay regression: 27 complete strategy-bot matches across 2–4 players, 3–5 treasures and all levels',()=>{
 let seed=0;for(let n=2;n<=4;n++)for(let count=3;count<=5;count++)for(const level of ['easy','medium','hard']){
  const r=lobby(n,count),rng=seededRandom(++seed);r.settings.hints=count!==4;for(const p of r.players.values()){p.bot=true;p.botDifficulty=level;}let steps=0;
  try{r.start(r.hostId);while(r.phase==='playing'&&steps++<300){const id=r.stage==='hide'?r.order.find(id=>!r.gameView(id).ready):r.currentId;r.botStep(id,rng);}
   assert.equal(r.phase,'over',`${n}/${count}/${level}`);assert.equal(r.active.size,1);assert.equal(Object.values(r.caught).reduce((a,b)=>a+b,0),Object.values(r.shots).flat().filter(s=>s.hit).length);assert.ok(r.result.winners.length>=1);assert.equal(r.gameView('watcher').own,null);
  }finally{r.dispose();}
 }
});
