import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { readFileSync } from 'node:fs';
import { buildDie, buildPokerChip, buildPokerTable } from '../graphics/3d/geometry.js';
import { chipBreakdown, DIE_FACES, pokerPresentation, rollChanged } from '../public/games/three-d/model.js';

test('3D poker receives only view-authorized faces, and unrelated private data is excluded', () => {
  const state = {
    code:'TEST1',you:{seat:0},blinds:{bb:100},
    seats:[{cards:['As','Tc']},{cards:['Kh','Qd']},{cards:['??','??']}],
    hand:{no:2,street:'turn',board:['Ks','8c','9s','Tc'],pots:[200,100]},
  };
  const actor = pokerPresentation(state);
  assert.deepEqual(actor.seats.map(seat=>seat.cards),[['As','Tc'],[null,null],[null,null]]);
  assert.deepEqual(actor.board,state.hand.board);
  assert.deepEqual(actor.pots,[200,100]);
  assert.deepEqual(pokerPresentation({...state,you:null}).seats.map(seat=>seat.cards),[[null,null],[null,null],[null,null]]);
  const showdown=pokerPresentation({...state,hand:{...state.hand,done:true},seats:[
    state.seats[0],state.seats[1],{cards:['??','invalid']},
  ]});
  assert.deepEqual(showdown.seats[1].cards,['Kh','Qd']);
  assert.deepEqual(showdown.seats[2].cards,[null,null]);
});

test('bounded chip denomination groups exactly reconstruct bets, pots and large stacks', () => {
  for (const amount of [0,1,19,250,19267,Number.MAX_SAFE_INTEGER]) {
    for (const blind of [1,25,100,7]) {
      const groups = chipBreakdown(amount,blind);
      assert.ok(groups.length <= 6);
      assert.equal(groups.reduce((total,group)=>total+group.count*group.value,0),amount);
    }
  }
});

test('each server die value maps to its correct visible face, and reconnect does not imply a roll', () => {
  assert.deepEqual(DIE_FACES.map(face=>face.value).sort(),[1,2,3,4,5,6]);
  for (const face of DIE_FACES) {
    const up = Vector3.Zero();
    new Vector3(...face.normal).rotateByQuaternionToRef(Quaternion.RotationAxis(new Vector3(...face.axis),face.angle),up);
    assert.ok(up.subtract(Vector3.Up()).length() < 1e-7);
  }
  const a={room:'TEST1',round:2,turn:'p',rolls:1};
  assert.equal(rollChanged(a,{...a,rolls:2}),true);
  assert.equal(rollChanged(a,{...a}),false);
  assert.equal(rollChanged(a,{...a,turn:'x',rolls:2}),false);
  assert.equal(rollChanged(a,{...a,room:'TEST2',rolls:2}),false);
});

test('generated shared geometry stays within the registered high and low triangle budgets', () => {
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/3d/manifest.json',import.meta.url),'utf8'));
  const engine=new NullEngine();
  const scene=new Scene(engine);
  try {
    for(const [id,build] of [
      ['kniffel-ivory-die',buildDie],['poker-chip-standard',buildPokerChip],['poker-table-oval',buildPokerTable],
    ]) {
      const high=build('high',scene);
      const low=build('low',scene,{low:true});
      const triangles=result=>(result.getTotalIndices?[result]:Object.values(result)).reduce((sum,mesh)=>sum+mesh.getTotalIndices()/3,0);
      assert.equal(triangles(high),manifest.assets.find(a=>a.id===id).triangles,id);
      assert.ok(triangles(low)<triangles(high),id);
    }
  } finally { scene.dispose(); engine.dispose(); }
});
