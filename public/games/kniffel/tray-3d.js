import { cameraRig, createTableView } from '/games/three-d/table.js';
import { DIE_FACES, rollChanged } from '/games/three-d/model.js';

function surface(B,scene,color,shine=.13) {
  const material=new B.StandardMaterial('dice material',scene);
  material.diffuseColor=B.Color3.FromHexString(color);
  material.specularColor=new B.Color3(shine,shine,shine);
  material.backFaceCulling=false;
  return material;
}

function diceScene({B,scene,canvas,physics,asset,low,fail}) {
  asset('kniffel-ivory-die','procedural');
  asset('shared-wood-grain','procedural');
  scene.clearColor=new B.Color4(.063,.095,.08,1);
  const fill=new B.HemisphericLight('soft light',new B.Vector3(0,1,0),scene);
  fill.intensity=.69;
  const key=new B.DirectionalLight('window light',new B.Vector3(-.8,-1,.48),scene);
  key.position.set(4,7,-5);
  key.intensity=.81;
  const shadows=new B.ShadowGenerator(low?512:1024,key);
  shadows.usePercentageCloserFiltering=!low;
  const wood=surface(B,scene,'#c18c56');
  wood.diffuseTexture=B.buildWoodTexture(scene);
  const felt=surface(B,scene,'#245b43',0);
  const pad=surface(B,scene,'#41664c',0);
  const brass=surface(B,scene,'#c49b57',.35);
  const ivory=surface(B,scene,'#f6ead3',.26);
  const ink=surface(B,scene,'#212520',0);
  function box(name,width,height,depth,position,material) {
    const mesh=B.CreateBox(name,{width,height,depth},scene);
    mesh.position.copyFromFloats(...position);
    mesh.material=material;
    mesh.isPickable=false;
    return mesh;
  }
  box('tray plinth',9.6,.32,5,[0,-.24,0],wood);
  box('rolling surface',9.1,.12,4.48,[0,-.06,0],felt).receiveShadows=true;
  box('holding shelf',8.9,.06,1.50,[0,.025,-1.38],pad).receiveShadows=true;
  box('shelf edge',9,.09,.075,[0,.045,-.53],brass);
  for(const side of [-1,1]){
    box('tray side',.24,.34,5,[side*4.7,.02,0],wood);
    box('tray end',9.54,.34,.24,[0,.02,side*2.39],wood);
  }
  const dice=Array.from({length:5},(_,i)=>{
    const {shell,marks}=B.buildDie('ivory die',scene,{low});
    shell.material=ivory;
    marks.material=ink;
    shell.metadata={pick:i+1};
    shadows.addShadowCaster(shell,false);
    return {shell,marks};
  });
  const up=new Map(DIE_FACES.map(face=>[face.value,B.Quaternion.RotationAxis(new B.Vector3(...face.axis),face.angle)]));
  const defaults={alpha:Math.PI/2,beta:.73,radius:low ? 10.2 : 8.25,target:[0,0,-.2]};
  const rig=cameraRig(B,scene,canvas,defaults,{min:6,max:16,x:3,z:1.4});
  let model, generation=0, animation=null, pending=false;
  function rest(index,held,value) {
    return {
      position:new B.Vector3((index-2)*1.51,held ? .48 : .41,held ? -1.43 : .72),
      rotation:(up.get(value)||B.Quaternion.Identity()).clone(),
    };
  }
  function applyRest(next,retain=new Set()) {
    dice.forEach(({shell,marks},i)=>{
      if(retain.has(i))return;
      const pose=rest(i,next.held[i],next.values[i]);
      shell.position.copyFrom(pose.position);
      shell.rotationQuaternion=pose.rotation;
      marks.setEnabled(next.values[i]>0);
    });
  }
  return {
    update(next) {
      const same=!!model && model.room===next.room && model.round===next.round &&
        model.turn===next.turn && model.rolls===next.rolls;
      if(same && !next.paused) {
        model=next;
        if(!animation&&!pending)applyRest(next);
        return;
      }
      const animate=rollChanged(model,next)&&!next.paused&&!document.hidden;
      model=next;
      const stamp=++generation;
      animation=null;pending=false;
      const indices=animate?next.held.flatMap((held,i)=>held?[]:[i]):[];
      if(!indices.length){applyRest(next);return;}
      applyRest(next,new Set(indices));
      pending=true;
      physics('dice',indices).then(reply=>{
        if(stamp!==generation)return;
        pending=false;
        if(!reply?.transforms||reply.transforms.length!==reply.steps*indices.length*7){fail();return;}
        for(const i of indices)dice[i].marks.setEnabled(true);
        animation={reply,indices,start:performance.now(),stamp};
      });
    },
    frame(now) {
      rig.tick(now);
      if(!animation)return;
      const {reply,indices,start,stamp}=animation;
      if(stamp!==generation){animation=null;return;}
      const elapsed=now-start;
      const flightTime=780;
      const blend=Math.max(0,Math.min(1,(elapsed-flightTime)/210));
      const sample=Math.min(reply.steps-1,Math.floor(Math.min(1,elapsed/flightTime)*reply.steps));
      for(const [j,index] of indices.entries()){
        const offset=(sample*indices.length+j)*7;
        const pose=rest(index,model.held[index],model.values[index]);
        const simulated=B.Vector3.FromArray(reply.transforms,offset);
        const orientation=B.Quaternion.FromArray(reply.transforms,offset+3);
        const {shell}=dice[index];
        shell.position.copyFrom(B.Vector3.Lerp(simulated,pose.position,blend));
        shell.rotationQuaternion=B.Quaternion.Slerp(orientation,pose.rotation,blend);
      }
      if(blend===1){animation=null;applyRest(model);}
    },
    action(name) {
      if(name==='near')rig.go({...defaults,beta:.57,radius:7.1});
      if(name==='home')rig.go(defaults);
    },
    dispose(){generation++;animation=null;},
  };
}

export const kniffelView=({active,onPick,onStatus})=>createTableView({game:'kniffel',active,onPick,onStatus,sceneFactory:diceScene,composite:true});
