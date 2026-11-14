// Presentation only: V4 projection, anchors and slots. Never contains economic/game rules.
export function validateLayout(l) {
  const errors=[],finite=n=>Number.isFinite(n),point=p=>p&&finite(p.x)&&finite(p.y);
  if(!l||l.version!==1||!finite(l.width)||!finite(l.height)||l.width<=0||l.height<=0)return ['Invalid layout header'];
  const g=l.geometry;if(!g||!['cx','cy','pxu','tilt_deg'].every(k=>finite(g[k]))||g.pxu<=0)errors.push('Invalid projection');
  if(!Array.isArray(l.fields)||l.fields.length!==40||new Set(l.fields.map(f=>f.index)).size!==40)errors.push('Expected 40 unique fields');
  for(const f of l.fields||[]){if(!Number.isInteger(f.index)||f.index<0||f.index>39||!f.rect||!['x','y','width','height'].every(k=>finite(f.rect[k]))||f.rect.width<=0||f.rect.height<=0)errors.push('Invalid field rectangle');if(!point(f.figureArea?.anchor)||!point(f.buildingArea?.anchor))errors.push('Invalid anchor');for(const z of Object.values(f.zones||{}))if(!Array.isArray(z)||z.length!==4||z.some(n=>!finite(n)||n<0||n>1)||z[0]+z[2]>1.001||z[1]+z[3]>1.001)errors.push('Invalid content zone');for(const k of ['price','rents','build','tax','name','owner','money'])if(k in f)errors.push('Game data in layout: '+k);}
  if(!l.figures||Object.keys(l.figures).length!==8)errors.push('Expected eight figure slots');
  for(const f of Object.values(l.figures||{}))if(!point(f.anchor)||!finite(f.baseWidth)||f.baseWidth<=0||!finite(f.width)||!finite(f.height)||f.anchor.x<0||f.anchor.y<0||f.anchor.x>f.width||f.anchor.y>f.height)errors.push('Invalid figure geometry');
  return errors;
}
export const project=(l,x,y)=>({x:l.geometry.cx+x*l.geometry.pxu,y:l.geometry.cy-y*Math.cos(l.geometry.tilt_deg*Math.PI/180)*l.geometry.pxu});
export function fieldRect(l,i){const r=l.fields.find(f=>f.index===i).rect,p=project(l,r.x,r.y+r.height);return {...p,width:r.width*l.geometry.pxu,height:r.height*Math.cos(l.geometry.tilt_deg*Math.PI/180)*l.geometry.pxu};}
export function fieldCenter(l,i){const r=fieldRect(l,i);return {x:r.x+r.width/2,y:r.y+r.height/2};}
export function piecePositions(l,players,people,tokens,occupied=[]){
  const placed=[],intersect=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const groups=new Map();for(const p of players){if(!people[p.id]||people[p.id].out)continue;const i=people[p.id].position;if(!groups.has(i))groups.set(i,[]);groups.get(i).push(p);}
  for(const [field,group]of groups){const area=l.fields.find(f=>f.index===field).figureArea,c=project(l,area.anchor.x,area.anchor.y);
    for(let n=0;n<group.length;n++){const player=group[n],slot=tokens[player.id],fig=l.figures[slot];if(!fig)continue;const base=area.baseWidth||42,s=base/fig.baseWidth,cols=area.columns||4,row=Math.floor(n/cols),total=Math.min(cols,group.length-row*cols),ideal={x:c.x+(n%cols-(total-1)/2)*(area.stepX||64),y:c.y+row*(area.stepY||100)};
      let at=ideal;const candidates=[{x:0,y:0}];for(let ring=1;ring<=12;ring++)for(let y=-ring;y<=ring;y++)for(let x=-ring;x<=ring;x++)if(Math.max(Math.abs(x),Math.abs(y))===ring)candidates.push({x:x*64,y:y*100});
      for(const d of candidates){const next={x:ideal.x+d.x,y:ideal.y+d.y},box={x:next.x-30,y:next.y-fig.anchor.y*s-4,w:60,h:fig.height*s+25};if(next.x<330||next.x>1230||next.y<350||next.y>1090||placed.some(p=>intersect(p.box,box))||occupied.some(p=>intersect(p,box)))continue;at=next;break;}
      placed.push({id:player.id,field,slot,...at,scale:s,box:{x:at.x-30,y:at.y-fig.anchor.y*s-4,w:60,h:fig.height*s+25}});
    }
  }return placed;
}
