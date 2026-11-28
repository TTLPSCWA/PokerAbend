import HavokPhysics from '@babylonjs/havok';

// Only visual transforms leave this worker. The caller supplies no game outcome.
const layout = {
  dice: { max: 5, width: 9, depth: 4.5, size: [0.8,0.8,0.8], pitch: 1.5, floor: 0, steps: 76 },
  chips: { max: 6, width: 10, depth: 6, size: [0.38,0.08,0.38], pitch: 0.45, floor: 0, steps: 46 },
};
const identity = [0, 0, 0, 1];
let runtime;

function check(havok, result) {
  if (result !== havok.Result.RESULT_OK) throw new Error('Havok visual simulation failed');
}

function value(havok, call) {
  check(havok, call[0]);
  return call[1];
}

function simulate(h, mode, indices) {
  const config = layout[mode];
  const world = value(h, h.HP_World_Create());
  const bodies = [];
  function box(size, at, dynamicIndex = null) {
    const shape = value(h, h.HP_Shape_CreateBox([0,0,0], identity, size));
    const owned = { shape, body: null, added: false };
    bodies.push(owned);
    const body = owned.body = value(h, h.HP_Body_Create());
    check(h,h.HP_Body_SetShape(body,shape));
    check(h,h.HP_Body_SetQTransform(body,[at,identity]));
    if (dynamicIndex !== null) {
      const i = dynamicIndex;
      check(h,h.HP_Body_SetMotionType(body,h.MotionType.DYNAMIC));
      check(h,h.HP_Body_SetMassProperties(body,[[0,0,0],1,[0.13,0.13,0.13],identity]));
      check(h,h.HP_Body_SetLinearVelocity(body,[(i % 2 ? -1 : 1) * 0.9,1.3,-2.4 - 0.35 * (i % 3)]));
      check(h,h.HP_Body_SetAngularVelocity(body,[12 + i,9 - i,6 + 2 * i]));
    } else {
      check(h,h.HP_Body_SetMotionType(body,h.MotionType.STATIC));
    }
    check(h,h.HP_World_AddBody(world,body,false));
    owned.added = true;
    return body;
  }
  try {
    check(h,h.HP_World_SetGravity(world,[0,-13.5,0]));
    const { width, depth, size, max, pitch, steps, floor } = config;
    box([width,0.2,depth],[0,floor - 0.1,0]);
    for (const side of [-1,1]) {
      box([0.2,1.2,depth],[side * width / 2,0.5,0]);
      box([width,1.2,0.2],[0,0.5,side * depth / 2]);
    }
    const moving = indices.map(i => box(size,[(i - (max - 1) / 2) * pitch,1.1 + i * 0.09,depth / 4],i));
    const transforms = new Float32Array(steps * moving.length * 7);
    let offset = 0;
    for (let step = 0; step < steps; step++) {
      for (const body of moving) {
        const [position, rotation] = value(h, h.HP_Body_GetQTransform(body));
        transforms.set(position, offset);
        transforms.set(rotation, offset + 3);
        offset += 7;
      }
      check(h,h.HP_World_Step(world,1 / 60));
    }
    return { steps, transforms };
  } finally {
    for (const {body,shape,added} of bodies.reverse()) {
      if (added) h.HP_World_RemoveBody(world,body);
      if (body !== null) h.HP_Body_Release(body);
      h.HP_Shape_Release(shape);
    }
    h.HP_World_Release(world);
  }
}

self.onmessage = async ({ data }) => {
  const { id, mode, indices } = data || {};
  const config = Object.hasOwn(layout, mode) ? layout[mode] : null;
  if (!Number.isSafeInteger(id) || !config || !Array.isArray(indices) ||
      !indices.length || indices.length > config.max || new Set(indices).size !== indices.length ||
      indices.some(index => !Number.isInteger(index) || index < 0 || index >= config.max)) return;
  let havok;
  try {
    runtime ??= HavokPhysics({locateFile: () => new URL('HavokPhysics.wasm',self.location.href).href});
    havok = await runtime;
  } catch {
    self.postMessage({ id, error: 'physics-wasm' });
    return;
  }
  try {
    const { steps, transforms } = simulate(havok, mode, indices);
    self.postMessage({ id, steps, transforms }, [transforms.buffer]);
  } catch {
    self.postMessage({ id, error: 'physics-simulation' });
  }
};
