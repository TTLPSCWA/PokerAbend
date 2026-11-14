import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {rotate} from '../games/labyrinth-brett/rules.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const manifest=JSON.parse(read('public/games/labyrinth-brett/asset-manifest.json'));
const source=read('public/games/labyrinth-brett/labyrinth-brett.js');
function renderer(language='de') {
  let def, errorHandler;
  vm.runInNewContext(source,{
    I18n:{content:(de,en)=>language==='de'?de:en},
    esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    GameDesign:{hero:()=>''},
    BacklogKit:{commands:()=>({blocked:()=>false,notice:()=>''})},
    document:{addEventListener:(type,callback,capture)=>{if(type==='error'){assert.equal(capture,true);errorHandler=callback;}else assert.equal(type,'keydown');}},
    kitGame:d=>{def=d;return {render(){}};},
  });
  return {def,errorHandler};
}
function state(treasure=0, mask=3) {
  return {turnId:'a',you:{id:'a'},players:[{id:'a',name:'Anna'},{id:'b',name:'Ben'}],g:{
    key:'fixture',revision:1,stage:'move',hasTask:true,task:treasure,
    board:Array.from({length:49},(_,id)=>({id,mask,treasure})),spare:{id:49,mask,treasure},
    legal:[0,1],positions:{a:0,b:0},homes:{a:0,b:6},
  }};
}

test('Labyrinth art: 24 stable IDs, 23 safe local SVGs, exact file hashes and complete public per-file attribution',()=>{
  assert.deepEqual(manifest.treasures.map(t=>t.id),Array.from({length:24},(_,n)=>n));
  const used=manifest.treasures.filter(t=>t.file);
  assert.equal(used.length,23);assert.equal(new Set(used.map(t=>t.file)).size,23);
  assert.deepEqual(readdirSync(new URL('../public/games/labyrinth-brett/art/',import.meta.url)).sort(),used.map(t=>t.file).sort());
  const licenses=read('docs/design/ART_LICENSES.md'),credits=read('public/games/labyrinth-brett/credits.html');
  for(const t of used){
    const svg=read(t.path);
    assert.equal(createHash('sha256').update(svg).digest('hex'),t.sha256,t.path);
    assert.ok(Buffer.byteLength(svg)<60000);assert.match(svg,/viewBox="0 0 512 512"/);
    assert.doesNotMatch(svg,/<(?:script|image|foreignObject)|\bon\w+\s*=|(?:href|url)\s*[=(]/i,t.path);
    assert.match(t.source,new RegExp('/'+manifest.sourceCommit+'/'));
    assert.ok(['Lorc','Delapouite'].includes(t.author));assert.equal(t.license,'CC-BY-3.0');
    assert.equal(t.licenseUrl,'https://creativecommons.org/licenses/by/3.0/');assert.ok(t.changes);
    for(const text of [t.path,t.source,t.author,t.licenseUrl])assert.ok(licenses.includes(text),text);
    for(const text of [t.file,t.source,t.author,t.licenseUrl])assert.ok(credits.includes(text),text);
  }
  assert.equal(manifest.treasures[11].file,null);
  assert.match(read('public/games/labyrinth-brett/game-icons-LICENSE.txt'),/Creative Commons 3.0 BY/);
});

test('Labyrinth art: all 24 IDs × all 16 corridor masks × four rotations preserve paths, upright art and spare mapping',()=>{
  const {def}=renderer();
  for(const t of manifest.treasures)for(let mask=0;mask<16;mask++)for(let turns=0;turns<4;turns++){
    const rotated=rotate(mask,turns),s=state(t.id,rotated),before=JSON.stringify(s);
    const html=def.main(s),spare=def.dock(s);
    const path=[rotated&1?'M50 50V0':'',rotated&2?'M50 50H100':'',rotated&4?'M50 50V100':'',rotated&8?'M50 50H0':''].join('');
    assert.equal((html.match(/<path d="([^"]*)"/g)||[]).length,49);
    assert.ok(html.includes(`<path d="${path}"`));assert.ok(spare.includes(`<path d="${path}"`));
    for(const output of [html,spare]){
      assert.ok(output.includes(`data-treasure="${t.id}"`));
      assert.ok(output.includes(`ml-treasure-number">${t.id+1}</span>`));
      if(t.file)assert.ok(output.includes(`src="/games/labyrinth-brett/art/${t.file}"`));
      else assert.ok(!output.includes('ml-treasure-icon'));
      assert.doesNotMatch(output,/transform=/);
    }
    assert.equal(JSON.stringify(s),before,'Rendering must not mutate state');
  }
});

test('Labyrinth art: original DE/EN names label cells and spare, secret future tasks do not alter the DOM',()=>{
  for(const lang of ['de','en']){
    const {def}=renderer(lang);
    for(const t of manifest.treasures){
      const s=state(t.id),name=lang==='de'?t.name:t.english,html=def.main(s);
      assert.ok(html.includes(`aria-label="${lang==='de'?'Feld':'Cell'} 1, ${t.id+1} · ${name}, Anna, Ben"`));
      assert.ok(def.dock(s).includes(`${t.id+1} · ${name}`));
      if(t.file)assert.ok(html.includes('alt=""')); // decorative images, names on the enclosing controls
    }
    const watch=state(0);watch.you={id:'watcher'};watch.g.hasTask=false;watch.g.task=null;
    const html=def.main(watch);
    assert.ok(!html.includes('ml-cell reachable target'));
    assert.ok(!html.match(/<p class="ml-task">([^]*?)<\/p>/)[1].includes('<img'));
    watch.g.tasks={a:[22,16],b:[11,6]};
    assert.equal(def.main(watch),html,'Even erroneously provided future tasks must not be rendered');
    assert.ok(def.rules.includes('/games/labyrinth-brett/credits.html'));
    assert.ok(def.lobby(watch).includes('/games/labyrinth-brett/credits.html'));
  }
});

test('Labyrinth art: load errors switch only this game’s images to the existing number fallback',()=>{
  const {errorHandler}=renderer();let removed=false,fallback=false;
  errorHandler({target:{matches:()=>false}});
  errorHandler({target:{matches:()=>true,closest:selector=>{assert.equal(selector,'.ml-treasure');return {classList:{add:cls=>{assert.equal(cls,'ml-treasure-fallback');fallback=true;}}};},remove:()=>{removed=true;}}});
  assert.ok(removed&&fallback);
});
