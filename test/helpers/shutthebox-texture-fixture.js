import {Room} from '../../games/shutthebox/room.js';
// Native lobby snapshots with 1–8 test seats. No saved live-game format or
// production data is changed; the browser starts the original room normally.
export function boxLobby(count=1,twelve=false) {
 const r=new Room(`SB${count}${twelve?'T':'N'}`,{rounds:1,twelve,turnTime:0},()=>{});r.game='shutthebox';
 for(let i=0;i<count;i++){const p=r.addPlayer(['Anna','Ben','Clara','David','Eva','Felix','Gina','Hugo'][i],'🦊');p.connected=true;r.sit(p.id);}
 const snapshot=JSON.parse(JSON.stringify({...r.snapshot(),game:'shutthebox'})),actor=snapshot.players.find(p=>p.id===r.hostId);r.dispose();return{snapshot,meta:{count,twelve,code:snapshot.code,id:actor.id,token:actor.token,name:actor.name}};
}
