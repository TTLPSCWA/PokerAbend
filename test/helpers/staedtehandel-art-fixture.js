// Isolated saved-game fixtures. Setup and upgrades use the original engine.
// Only starting test resources are granted explicitly, taking them from the bank.
import {Room} from '../../games/staedtehandel/room.js';
import {topology,RES,SIZES} from '../../games/staedtehandel/map.js';
import {seededRandom} from '../../games/bot-strategies/index.js';
export function buildingFixture(count=3,layout=count===3?'beginner':'random'){
 const size=count<=4?'standard':'xl',code=`ART${count}A`,r=new Room(code,{size,layout,target:14,turnTime:0},()=>{});r.game='staedtehandel';r.rng=seededRandom(123+count);
 for(let i=0;i<count;i++){const p=r.addPlayer(['Anna','Ben','Clara','David','Eva','Felix'][i],'🦊');p.connected=true;r.sit(p.id);}
 r.start(r.hostId);const t=topology(size);
 while(r.s.stage==='setup'){
  const g=r.gameView(r.s.cur),kind=g.setup.step,spots=g.legal[kind];
  const at=kind==='settlement'?[...spots].sort((a,b)=>Math.hypot(t.vs[a].x,t.vs[a].y)-Math.hypot(t.vs[b].x,t.vs[b].y)||a-b)[0]:spots[0];
  r.ssBuild(r.s.cur,{kind,at});
 }
 const grant=(id,want)=>{for(const [res,n]of Object.entries(want)){const add=Math.max(0,n-r.s.res[id][res]);if(r.s.bank[res]<add)throw Error('Insufficient fixture bank');r.s.bank[res]-=add;r.s.res[id][res]+=add;}};
 for(let i=0;i<count;i++){
  const id=r.s.cur;r.diceQueue=[[1,1]];r.ssRoll(id);grant(id,{korn:2,kupfer:3});const at=Number(Object.entries(r.s.buildings).find(([,b])=>b.o===id&&b.t==='s')[0]);r.ssBuild(id,{kind:'city',at});r.ssEnd(id);
 }
 grant(r.s.cur,{korn:2,kupfer:3,holz:1,ton:1});r.diceQueue=[[1,1]];r.ssRoll(r.s.cur);
 for(const res of RES)if(r.s.bank[res]+r.s.players.reduce((n,p)=>n+r.s.res[p][res],0)!==SIZES[size].bank)throw Error('Fixture resources not conserved');
 const snapshot=JSON.parse(JSON.stringify({...r.snapshot(),game:'staedtehandel'})),host=snapshot.players.find(p=>p.id===snapshot.hostId);
 const metadata={count,size,layout,code,hostId:host.id,hostToken:host.token,buildings:snapshot.extra.s.buildings};r.dispose();return {snapshot,metadata};
}
