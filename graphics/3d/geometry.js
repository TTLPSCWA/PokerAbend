import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';

const faces = [
  [1,[0,1,0],[1,0,0],[0,0,1]], [6,[0,-1,0],[1,0,0],[0,0,-1]],
  [2,[0,0,-1],[1,0,0],[0,1,0]], [5,[0,0,1],[1,0,0],[0,-1,0]],
  [3,[1,0,0],[0,0,-1],[0,-1,0]], [4,[-1,0,0],[0,0,1],[0,-1,0]],
];
const spots = {
  1:[[0,0]], 2:[[-1,-1],[1,1]], 3:[[-1,-1],[0,0],[1,1]],
  4:[[-1,-1],[1,-1],[-1,1],[1,1]], 5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
};
const empty = () => ({positions:[],indices:[],normals:[]});

function mesh(name, scene, attributes) {
  const target = new Mesh(name,scene);
  Object.assign(new VertexData(),attributes).applyToMesh(target);
  return target;
}

export function buildDie(name, scene, {low=false}={}) {
  const size = .4;
  const inner = .33;
  const grid = low ? [-size,-inner,inner,size] : [-size,-.377,-inner,inner,.377,size];
  const width = grid.length;
  const body = empty();
  const pips = empty();
  const segments = low ? 8 : 12;
  for (const [face,n,u,v] of faces) {
    const point = (depth,a,b) => n.map((axis,i) => axis * depth + u[i] * a + v[i] * b);
    const start = body.positions.length / 3;
    for (const a of grid) for (const b of grid) {
      const p = point(size,a,b);
      const core = p.map(value => Math.max(-inner,Math.min(inner,value)));
      const delta = p.map((value,i) => value - core[i]);
      const normal = delta.map(value => value / Math.hypot(...delta));
      body.positions.push(...core.map((value,i) => value + normal[i] * (size - inner)));
      body.normals.push(...normal);
    }
    for (let y=0; y<width-1; y++) for (let x=0; x<width-1; x++) {
      const a = start + y * width + x;
      body.indices.push(a,a + width,a + 1,a + 1,a + width,a + width + 1);
    }
    for (const [a,b] of spots[face]) {
      const center = pips.positions.length / 3;
      pips.positions.push(...point(size + .001,a * .181,b * .181));
      pips.normals.push(...n);
      for (let i=0;i<segments;i++) {
        const angle = 2 * Math.PI * i / segments;
        pips.positions.push(...point(size + .001,a * .181 + .055 * Math.cos(angle),b * .181 + .055*Math.sin(angle)));
        pips.normals.push(...n);
        pips.indices.push(center,center + 1 + i,center + 1 + (i + 1) % segments);
      }
    }
  }
  const shell = mesh(name,scene,body);
  const marks = mesh(name + '-marks',scene,pips);
  marks.parent = shell;
  marks.isPickable = false;
  return {shell,marks};
}

export function buildPokerChip(name, scene, {low=false}={}) {
  return CreateCylinder(name,{height:.075,diameter:.34,tessellation:low ? 14 : 28},scene);
}

export function buildPokerTable(name, scene, {low=false}={}) {
  const parts = [
    ['base',6.95,4.25,.30,-.50], ['rail',6.85,4.12,.17,-.26],
    ['inlay',6.54,3.82,.06,-.155], ['felt',6.46,3.74,.07,-.13],
  ];
  return Object.fromEntries(parts.map(([piece,x,z,height,y])=>{
    const part = CreateCylinder(name + '-' + piece,{height,diameter:2,tessellation:low?48:80},scene);
    part.scaling.set(x,1,z);
    part.position.y=y;
    part.isPickable=false;
    return [piece,part];
  }));
}

export function buildWoodTexture(scene) {
  const texture = new DynamicTexture('wood-grain',{width:256,height:256},scene,true);
  const context = texture.getContext();
  const gradient = context.createLinearGradient(0,0,0,256);
  gradient.addColorStop(0,'#553022');
  gradient.addColorStop(.45,'#89573a');
  gradient.addColorStop(1,'#503021');
  context.fillStyle = gradient;
  context.fillRect(0,0,256,256);
  for (let i=0;i<150;i++) {
    const y = i * 1.74;
    const phase = i * 2.39996;
    context.strokeStyle = i % 3 === 0 ? 'rgba(19,8,5,.16)' : 'rgba(231,165,100,.10)';
    context.lineWidth = i % 13 === 0 ? 1.8 : .6;
    context.beginPath();
    for(let x=0;x<=256;x+=4){
      const py=y + Math.sin(x / 29 + phase) * 1.8 + Math.sin(x / 61 - phase) * 2.9;
      if(x===0)context.moveTo(x,py);else context.lineTo(x,py);
    }
    context.stroke();
  }
  texture.update();
  return texture;
}
