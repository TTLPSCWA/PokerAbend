import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {Room} from '../games/gebietskampf/room.js';
import {cardFixture} from './helpers/gebietskampf-art-fixture.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url)),text=p=>read(p).toString('utf8'),manifest=JSON.parse(text('public/games/gebietskampf/asset-manifest.json'));
function renderer(language='de') {
 let def;const sent=[];
 vm.runInNewContext(text('public/games/gebietskampf/gebietskampf.js'),{I18n:{language},window:{innerWidth:1440},document:{addEventListener(){},querySelector:()=>null},esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),kitGame:d=>{def=d;return{render(){}};},send:(event,payload)=>sent.push([event,JSON.parse(JSON.stringify(payload))])});
 return{def,sent,render(S){def.onState(S);return def.main(S)+def.dock(S,S.turnId===S.you?.id);}};
}
test('Gebietskampf art: only three prepared CC0 WebPs, exact byte hashes and individual source/license records',()=>{
 assert.equal(manifest.assets.length,3);assert.equal(manifest.reviewedButNotUsed.length,3);assert.deepEqual(readdirSync(new URL('../public/games/gebietskampf/art/',import.meta.url)).sort(),manifest.assets.map(a=>a.file).sort());
 const credits=text('public/games/gebietskampf/credits.html'),licenses=text('docs/design/ART_LICENSES.md'),js=text('public/games/gebietskampf/gebietskampf.js');let bytes=0;
 for(const a of manifest.assets){const b=read(a.path);bytes+=b.length;assert.equal(b.length,a.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),a.sha256);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(a.width,64);assert.equal(a.height,64);assert.equal(a.license,'CC0-1.0');assert.equal(a.author,'Kenney');assert.match(a.originalSha256,/^[a-f0-9]{64}$/);for(const v of [a.path,a.sourceFile,a.author,a.licenseUrl,a.sha256])assert.ok(licenses.includes(v),v);for(const v of [a.file,a.sourceFile,a.author,a.licenseUrl,a.sha256])assert.ok(credits.includes(v),v);assert.ok(js.includes(a.file));}
 assert.equal(bytes,2812);const notice=text(manifest.licenseEvidence.path).replaceAll('\r\n','\n');assert.equal(createHash('sha256').update(notice).digest('hex'),manifest.licenseEvidence.canonicalSha256);assert.match(notice,/Creative Commons Zero, CC0/);
});
test('Gebietskampf art: all card types and native trade indices, 2–6 players, both original maps, read-only rendering',()=>{
 for(let n=2;n<=6;n++)for(const map of ['small','full']){const{snapshot,metadata:m}=cardFixture(n,map),room=Room.restore(snapshot,()=>{});
  try{const S=room.view(m.actorId),before=JSON.stringify(S);for(const lang of ['de','en']){const r=renderer(lang),html=r.render(S);assert.equal(JSON.stringify(S),before);for(const label of lang==='de'?['Fahne','Schild','Fackel','Joker']:['Banner','Shield','Torch','Wild'])assert.ok(html.includes(label),label);for(const c of S.g.hand)if(c.t!==null)assert.ok(html.includes(S.g.map.nodes.find(t=>t.id===c.t).name));const svg=html.match(/<svg class="gk-svg"[\s\S]*?<\/svg>/)[0];assert.equal((svg.match(/data-g="gk-t"/g)||[]).length,map==='full'?42:28);assert.doesNotMatch(svg,/<image|<img/);
   for(const t of S.g.map.nodes)assert.ok(svg.includes(`data-t="${t.id}" transform="translate(${t.x} ${t.y})"`));assert.equal((svg.match(/class="gk-edge /g)||[]).length,S.g.map.edges.length);
   const set=S.g.sets[0];r.def.onClick({dataset:{g:'gk-trade',cards:set.join(',')}},S);assert.deepEqual(r.sent,[['gkTrade',{cards:set}]]);
  }}finally{room.dispose();}
 }
});
test('Gebietskampf privacy: genuinely different opponent cards/missions and deck order yield identical complete host/spectator DOM',()=>{
 for(const count of [2,6])for(const map of ['small','full']){const{snapshot,metadata:m}=cardFixture(count,map),rooms=[Room.restore(structuredClone(snapshot),()=>{}),Room.restore(structuredClone(snapshot),()=>{})];
  try{const other=rooms[0].s.players.find(p=>p!==m.actorId),b=rooms[1].s;[b.hands[other][0],b.deck[0]]=[b.deck[0],b.hands[other][0]];b.deck.reverse();b.missions[other]={kind:'strong',n:map==='full'?16:11};assert.notDeepEqual(rooms[0].gameView(other).hand,rooms[1].gameView(other).hand);assert.notDeepEqual(rooms[0].gameView(other).mission,rooms[1].gameView(other).mission);
   for(const who of [m.actorId,'watcher'])for(const lang of ['de','en']){const views=rooms.map(r=>r.view(who)),render=renderer(lang);assert.deepEqual(views[0].g,views[1].g);assert.equal(render.render(views[0]),render.render(views[1]));if(who==='watcher'){assert.equal(views[0].g.hand,null);assert.equal(views[0].g.mission,null);assert.doesNotMatch(render.render(views[0]),/class="gk-hand"|class="gk-card |data-g="gk-trade"/);}}
  }finally{for(const r of rooms)r.dispose();}
 }
});
