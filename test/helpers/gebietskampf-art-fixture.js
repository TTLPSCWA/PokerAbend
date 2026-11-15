// Native map/setup; controlled saved test hands drawn from that map's real deck.
// Test cards/mission assignments are explicit, not claimed to be naturally earned.
import {Room} from '../../games/gebietskampf/room.js';
import {seededRandom} from '../../games/bot-strategies/index.js';
export function cardFixture(count=3,map='full') {
 const r=new Room(`GK${count}${map==='full'?'F':'S'}`,{map,mode:'mission',turnTime:0},()=>{});r.game='gebietskampf';r.rng=seededRandom(210+count);
 for(let i=0;i<count;i++){const p=r.addPlayer(['Anna','Ben','Clara','David','Eva','Felix'][i],'🦊');p.connected=true;r.sit(p.id);}
 r.start(r.hostId);
 const take=(id,symbol)=>{const at=r.s.deck.findIndex(c=>symbol==='wild'?c.t===null:c.t!==null&&c.s===symbol);if(at<0)throw Error('Fixture card missing');r.s.hands[id].push(r.s.deck.splice(at,1)[0]);};
 for(const symbol of [0,1,2,'wild',0])take(r.currentId,symbol);
 for(const id of r.s.players){r.s.missions[id]={kind:'territories',n:map==='full'?24:16};if(id!==r.currentId)for(const symbol of [1,2])take(id,symbol);}
 const pool=[...r.s.deck,...r.s.discard,...Object.values(r.s.hands).flat()];if(pool.length!==(map==='full'?44:30))throw Error('Fixture deck not conserved');
 const snapshot=JSON.parse(JSON.stringify({...r.snapshot(),game:'gebietskampf'})),actor=snapshot.players.find(p=>p.id===r.currentId),metadata={count,map,code:r.code,actorId:actor.id,actorToken:actor.token,name:actor.name};r.dispose();return {snapshot,metadata};
}
