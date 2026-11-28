import { cameraRig, createTableView } from '/games/three-d/table.js';
import { CHIP_INKS,chipBreakdown, pokerPresentation } from '/games/three-d/model.js';

const suits = {s:'\u2660',h:'\u2665',d:'\u2666',c:'\u2663'};
const decorate = (B, scene, color) => {
  const material = new B.StandardMaterial('surface',scene);
  material.diffuseColor = B.Color3.FromHexString(color);
  material.specularColor = new B.Color3(.18,.15,.11);
  return material;
};

async function pokerScene({B,scene,canvas,physics,image,asset,low}) {
  asset('poker-table-oval','procedural');
  asset('poker-chip-standard','procedural');
  asset('shared-wood-grain','procedural');
  scene.clearColor = new B.Color4(.055,.075,.069,1);
  scene.ambientColor = new B.Color3(.24,.27,.22);
  const sky = new B.HemisphericLight('ambient',new B.Vector3(0,1,-.4),scene);
  sky.intensity = .84;
  const light = new B.DirectionalLight('room light',new B.Vector3(-.7,-1,.48),scene);
  light.position.set(6,8,-5);
  light.intensity = .74;
  const shadows = new B.ShadowGenerator(low?512:1024,light);
  shadows.usePercentageCloserFiltering = !low;
  const table = B.buildPokerTable('club table',scene,{low});
  const wood = B.buildWoodTexture(scene);
  wood.uScale = 2;
  table.rail.material = decorate(B,scene,'#c79971');
  table.rail.material.diffuseTexture = wood;
  table.base.material = decorate(B,scene,'#42281f');
  table.inlay.material = decorate(B,scene,'#c4a262');
  table.felt.material = decorate(B,scene,'#c9d1be');
  const source = await image('poker-table-felt');
  const felt = new B.DynamicTexture('subtle felt',{width:256,height:256},scene,true);
  const grain = felt.getContext();
  grain.fillStyle = '#386e53';
  grain.fillRect(0,0,256,256);
  grain.globalAlpha = .23;
  for(const y of [0,128])for(const x of [0,128])grain.drawImage(source,x,y,128,128);
  felt.update();
  felt.uScale = felt.vScale = 2;
  table.felt.material.diffuseTexture = felt;
  table.felt.receiveShadows = true;

  const normal = {alpha:Math.PI/2,beta:.72,radius:low ? 14.2 : 11.4,target:[0,0,0]};
  const rig = cameraRig(B,scene,canvas,normal,{min:2.7,max:23,x:6,z:4});
  let scenery;
  let currentSeat;
  let counter = 0;
  let viewBefore;
  let inspector;
  const entries = new Map();
  const moving = new Map();
  const pickup = new Map();
  const cards = new Map();
  const prototypes = CHIP_INKS.map(color => {
    const base = B.buildPokerChip('chip prototype',scene,{low});
    base.material = decorate(B,scene,color);
    base.isVisible = false;
    base.isPickable = false;
    return base;
  });

  function graphic(draw,width,height) {
    const image = new B.DynamicTexture('print',{width,height},scene,true);
    const ctx = image.getContext();
    draw(ctx,width,height);
    image.update();
    const pigment = decorate(B,scene,'#ffffff');
    pigment.diffuseTexture = image;
    pigment.emissiveColor = new B.Color3(.35,.35,.34);
    pigment.backFaceCulling = false;
    pigment.specularColor = B.Color3.Black();
    return { image, pigment };
  }
  function printing(key,draw,width,height) {
    if (!cards.has(key)) cards.set(key,graphic(draw,width,height));
    return cards.get(key).pigment;
  }
  function flat(width,height) {
    const node = B.CreatePlane('table print',{width,height},scene);
    node.rotation.set(Math.PI / 2,Math.PI,0);
    node.isPickable = false;
    return node;
  }
  function landed(node,end,from=null,duration=370) {
    if (!from) { node.position.copyFromFloats(...end); return; }
    node.position.copyFromFloats(...from);
    moving.set(node,{start:performance.now(),duration,from,end});
  }
  function setItem(seen,key,signature,build) {
    seen.add(key);
    const old = entries.get(key);
    if (old?.signature === signature) return;
    if (old) clearEntry(old);
    entries.set(key,{signature,...build()});
  }
  function clearEntry(entry) {
    for (const node of entry.nodes) {
      moving.delete(node);
      shadows.removeShadowCaster(node);
      node.dispose();
    }
    entry.print?.pigment.dispose(false,true);
  }
  function card(seen,key,face,pos,preference,animate,index) {
    setItem(seen,key,JSON.stringify([face,pos,preference]),()=>{
      const card = flat(.89 * preference.size,1.22 * preference.size);
      card.material = printing(String(face) + preference.four,(ctx,w,h)=>{
        ctx.fillStyle = face ? '#f7f3e7' : '#254940';
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle = face ? '#bfb59d' : '#c3aa70';
        ctx.lineWidth = 5;
        ctx.strokeRect(11,11,w-22,h-22);
        ctx.strokeRect(19,19,w-38,h-38);
        ctx.textAlign = 'center';
        if (face) {
          const suit = face[1], value = face[0] === 'T' ? '10' : face[0];
          ctx.fillStyle = preference.four && suit === 'd' ? '#235ca9' : preference.four && suit === 'c' ? '#235f46' : 'hd'.includes(suit) ? '#961d31' : '#162322';
          ctx.font = '700 77px sans-serif';
          ctx.fillText(value,w/2,105);
          ctx.font = '80px serif';
          ctx.fillText(suits[suit],w/2,201);
        } else {
          ctx.translate(w/2,h/2);
          ctx.rotate(Math.PI/4);
          ctx.lineWidth = 6;
          ctx.strokeRect(-39,-39,78,78);
          ctx.strokeRect(-23,-23,46,46);
        }
      },192,256);
      if (animate) landed(card,pos,[4.8,.06,-1.6],310 + index * 55);
      else landed(card,pos);
      return {nodes:[card]};
    });
  }
  function label(seen,key,pos,text,emphasis=false) {
    setItem(seen,key,JSON.stringify([text,pos,emphasis]),()=>{
      const node = flat(1.73,.44);
      const print = graphic((ctx,w,h) => {
        ctx.fillStyle = emphasis ? '#5b492b' : '#142b25';
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle = emphasis ? '#ecd18e' : '#7a8f71';
        ctx.lineWidth = 4;
        ctx.strokeRect(2,2,w-4,h-4);
        ctx.fillStyle = '#fff2d3';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '700 32px sans-serif';
        ctx.fillText(text,w/2,h/2,w-20);
      },360,90);
      node.material = print.pigment;
      shadows.addShadowCaster(node);
      node.position.copyFromFloats(...pos);
      return {nodes:[node],print};
    });
  }
  function stack(seen,key,amount,blind,pos,owner,caption,animate=false) {
    const values = chipBreakdown(amount,blind);
    if (!values.length) return;
    const info = {key,amount,values,owner,caption,pos};
    pickup.set(key,info);
    setItem(seen,key,JSON.stringify([amount,blind,pos]),()=>{
      const nodes = [];
      values.forEach(({count,kind},index)=>{
        const height = Math.min(low?2:4,1 + Math.floor(Math.log10(count)));
        for (let level=0;level<height;level++) {
          const chip = prototypes[kind].createInstance('chip');
          const end = [pos[0] + index * .32,pos[1] + level*.074,pos[2]];
          chip.metadata = {pick:key};
          chip.isPickable = true;
          if (animate) landed(chip,end,[pos[0] - .7,.7,pos[2]+.6],390 + level*35);
          else landed(chip,end);
          nodes.push(chip);
        }
      });
      return {nodes};
    });
  }
  function seatPos(i,view) {
    const seated = view.seats.flatMap((seat,index)=>seat?[index]:[]);
    const own = Math.max(0,seated.indexOf(view.mySeat));
    const angle = Math.PI/2 + (seated.indexOf(i) - own) * Math.PI * 2 / Math.max(1,seated.length);
    return [5.6 * Math.cos(angle),3.24 * Math.sin(angle)];
  }
  let pulse = [];
  function chipsFly(from,to,stamp) {
    const tokens = Array.from({length:3},()=>prototypes[1].createInstance('visual flight'));
    pulse.push({tokens,from,to,start:performance.now(),stamp,frames:null});
    physics('chips',[1,2,3]).then(reply => {
      const flight = pulse.find(f => f.stamp === stamp);
      if (flight && reply?.transforms instanceof Float32Array) flight.frames = reply;
    });
  }

  return {
    update({view,preference,text}) {
      const signature = JSON.stringify({view,preference,text});
      if (signature === scenery) return;
      scenery = signature;
      const seen = new Set();
      pickup.clear();
      currentSeat = view.mySeat === null ? null : seatPos(view.mySeat,view);
      const sameRoom = viewBefore?.room === view.room;
      const animate = sameRoom && !view.paused && !document.hidden;
      if (view.paused || !sameRoom) {
        for (const [node,move] of moving) node.position.copyFromFloats(...move.end);
        moving.clear();
        for (const f of pulse) f.tokens.forEach(token=>token.dispose());
        pulse = [];
      }
      const darker = preference.theme === 'night';
      table.felt.material.diffuseColor = B.Color3.FromHexString(darker ? '#a0b4ab' : '#c9d1be');
      view.board.forEach((face,i)=>{
        if(face) card(seen,'board-'+i,face,[(i-2)*1.23,.035,.04],preference,
          animate && (viewBefore?.hand !== view.hand || !viewBefore.board[i]),i);
      });
      for (const [i,seat] of view.seats.entries()) {
        if (!seat) continue;
        const [x,z] = seatPos(i,view);
        const inward = [x*.70,z*.63];
        label(seen,'seat-'+i,[x,.035,z],seat.name,i === view.turn);
        if (i === view.button) label(seen,'dealer',[x*.78,.045,z*.78],'D',true);
        if (i !== view.mySeat || preference.seatCards) {
          seat.cards.forEach((face,k)=>card(seen,'seat-card-'+i+'-'+k,face,[inward[0]+(k-.5)*.52,.045,inward[1]],
            {...preference,size:.64 * preference.size},animate && (viewBefore.hand !== view.hand || !viewBefore.seats[i]?.cards.length),k));
        }
        stack(seen,'stack-' + i,seat.stack,view.blind,[x*.79-.12,.015,z*.88],seat.name,text.stack);
        stack(seen,'bet-' + i,seat.bet,view.blind,[x*.51,.015,z*.46],seat.name,text.bet,animate);
        if (animate && viewBefore.hand === view.hand) {
          if (seat.bet > (viewBefore.seats[i]?.bet ?? 0)) chipsFly([x*.78,.16,z*.77],[x*.50,.12,z*.46],++counter);
          else if (view.street !== viewBefore.street && viewBefore.seats[i]?.bet > 0) chipsFly([x*.51,.16,z*.46],[0,.1,-.88],++counter);
          if (view.done && !viewBefore.done && view.winners.includes(i)) chipsFly([0,.2,-.90],[x*.75,.12,z*.82],++counter);
        }
      }
      view.pots.forEach((amount,i)=>{
        const title = i ? text.side + ' ' + i : text.main;
        const pos = [((i%4)-Math.min(3,view.pots.length-1)/2)*1.44,.02,-1.34-Math.floor(i/4)*.62];
        stack(seen,'pot-' + i,amount,view.blind,pos,'',title);
        label(seen,'pot-label-'+i,[pos[0],.02,pos[2]-.28],title,true);
      });
      for (const [key,entry] of entries) if (!seen.has(key)) { clearEntry(entry); entries.delete(key); }
      viewBefore = view;
    },
    action(name) {
      if (name === 'home') rig.go(normal);
      if (name === 'board') rig.go({...normal,beta:.49,radius:7.4,target:[0,.13,.05]});
      if (name === 'seat' && currentSeat) rig.go({...normal,beta:.87,radius:6.3,target:[currentSeat[0]*.40,.17,currentSeat[1]*.58]});
      if (name === 'pot') rig.go({...normal,beta:.64,radius:6.4,target:[0,.12,-1]});
      if (pickup.has(name)) {
        inspector = pickup.get(name);
        rig.go({...normal,beta:.62,radius:3.9,target:[inspector.pos[0],.07,inspector.pos[2]]});
      }
    },
    frame(now) {
      rig.tick(now);
      for (const [node,move] of moving) {
        const p = Math.min(1,(now - move.start) / move.duration);
        const t = p * p * (3 - 2 * p);
        const v = move.end.map((value,i)=>move.from[i] + (value-move.from[i])*t + (i===1?Math.sin(Math.PI*t)*.45:0));
        node.position.copyFromFloats(...v);
        if (p === 1) moving.delete(node);
      }
      pulse = pulse.filter(({tokens,from,to,start,frames})=>{
        const p = Math.min(1,(now-start)/560);
        tokens.forEach((chip,i)=>{
          if (p === 1) { chip.dispose(); return; }
          const offset = frames ? (Math.min(frames.steps-1,Math.floor(p * frames.steps)) * tokens.length + i) * 7 : -1;
          const height = offset >= 0 ? frames.transforms[offset+1] * .33 : Math.sin(Math.PI*p) * .47;
          chip.position.set(from[0]+(to[0]-from[0])*p+i*.12,.105+height,from[2]+(to[2]-from[2])*p);
          chip.rotationQuaternion = offset >= 0 ? B.Quaternion.FromArray(frames.transforms,offset+3) : null;
        });
        return p < 1;
      });
    },
  };
}

export function pokerView({active,onStatus,onPick}) {
  return createTableView({game:'poker',active,onStatus,onPick,sceneFactory:pokerScene});
}

export function frameForPoker(state, prefs, text) {
  return {
    view:pokerPresentation(state),
    preference:{size:prefs.cardSize==='xl'?1.12:prefs.cardSize==='large'?1.05:1, four:!!prefs.fourColor, theme:prefs.theme, seatCards:!!prefs.seatCards},
    text,
  };
}

export { chipBreakdown as pokerChips };
