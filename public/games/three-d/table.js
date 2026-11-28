const directory = '/assets/3d/generated/';
const localAsset = /^\/(?:assets\/3d\/|games\/poker\/art\/)(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png)$/;

async function assets(game, signal) {
  const response = await fetch('/assets/3d/manifest.json', {signal});
  if (!response.ok) throw new Error('3D manifest unavailable');
  const manifest = await response.json();
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) throw new Error('3D manifest version');
  return new Map(manifest.assets.filter(asset => asset.licenseStatus === 'approved' && asset.gameScope.includes(game))
    .map(asset => [asset.id, asset]));
}

function createPhysics(signal) {
  let next = 0;
  let worker;
  const waiting = new Map();
  function close() {
    worker?.terminate();
    worker = null;
    for (const request of waiting.values()) {
      clearTimeout(request.timer);
      request.resolve(null);
    }
    waiting.clear();
  }
  signal.addEventListener('abort', close, {once:true});
  return (mode, indices) => {
    if (signal.aborted) return Promise.resolve(null);
    try {
      if (!worker) {
        worker = new Worker(directory + 'physics-worker.js');
        worker.onerror = close;
        worker.onmessage = ({data}) => {
          const request = waiting.get(data.id);
          if (!request) return;
          waiting.delete(data.id);
          clearTimeout(request.timer);
          request.resolve(data.error ? null : data);
        };
      }
      const id = ++next;
      return new Promise(resolve => {
        waiting.set(id,{resolve,timer:setTimeout(close,4500)});
        worker.postMessage({id,mode,indices});
      });
    } catch {
      close();
      return Promise.resolve(null);
    }
  };
}

export function createTableView({ game, active, sceneFactory, onStatus, onPick, composite = false }) {
  let slot, model, canvas, gl, renderer, lifetime, observer, resize, engine, instrumentation;
  let lowBudgetSince = 0;
  let pointer, surface, presentation;
  let state = 'idle';
  let frameStarted = 0;
  let stats = {};
  let lastFrame = 0;
  function updateStatus(value) {
    state = value;
    if (slot) slot.dataset.sceneState = value;
    onStatus(value, slot);
  }
  function dispose(value = 'idle') {
    if (!lifetime && state === value) return;
    lifetime?.abort();
    lifetime = null;
    lowBudgetSince = 0;
    stats = {};
    instrumentation?.dispose();
    instrumentation = undefined;
    observer?.disconnect();
    resize?.disconnect();
    try { renderer?.dispose?.(); } finally {
      try { gl?.dispose(); } finally {
        engine?.stopRenderLoop();
        engine?.dispose();
        canvas?.remove();
        renderer = gl = engine = canvas = surface = presentation = pointer = undefined;
        updateStatus(value);
      }
    }
  }
  function resizeSurface() {
    if (!canvas?.clientWidth || !canvas.clientHeight) return;
    if (!presentation) { engine.resize(); return; }
    const scale = engine.getHardwareScalingLevel();
    if (engine.setSize(canvas.clientWidth / scale, canvas.clientHeight / scale)) {
      canvas.width = surface.width;
      canvas.height = surface.height;
    }
  }
  function renderFrame() {
    gl.render();
    if (presentation) presentation.drawImage(surface, 0, 0);
  }
  function setLoop() {
    if (!engine || !renderer) return;
    engine.stopRenderLoop();
    if (!document.hidden) engine.runRenderLoop(() => {
      if (!active() || !slot?.isConnected) { dispose(); return; }
      try {
        const now = performance.now();
        renderer.frame?.(now);
        renderFrame();
        if (now - lastFrame > 900) {
          const fps = engine.getFps();
          Object.assign(stats,{sceneMeshes:String(gl.getActiveMeshes().length),sceneDraws:String(instrumentation.drawCallsCounter.current),frameMs:fps > 0 ? (1000 / fps).toFixed(1) : ''});
          Object.assign(slot.dataset,stats);
          if (now - frameStarted > 5000 && fps > 0 && fps < 10) {
            lowBudgetSince ||= now;
            if (engine.getHardwareScalingLevel() < 1.35) { engine.setHardwareScalingLevel(1.35); resizeSurface(); }
            if (now - lowBudgetSince > 6000 && fps < 7) {dispose('unavailable');return;}
          } else lowBudgetSince = 0;
          lastFrame = now;
        }
      } catch { dispose('unavailable'); }
    });
  }
  async function start() {
    const current = lifetime = new AbortController();
    const { signal } = current;
    const valid = () => !signal.aborted && active() && slot?.isConnected;
    frameStarted = performance.now();
    updateStatus('loading');
    const timer = setTimeout(() => { if (lifetime === current) dispose('unavailable'); }, 9500);
    signal.addEventListener('abort', () => clearTimeout(timer), {once:true});
    try {
      const [B, catalogue] = await Promise.all([import(directory + 'engine.mjs'), assets(game, signal)]);
      if (!valid()) { if (!signal.aborted) dispose(); return; }
      canvas = document.createElement('canvas');
      canvas.className = 'td-canvas';
      canvas.setAttribute('aria-hidden','true');
      // The scrollable dice tray needs a presentation canvas on WebKit. The same
      // Babylon frame is copied directly, with no readback or separate 2D artwork.
      surface = composite ? document.createElement('canvas') : canvas;
      presentation = composite ? canvas.getContext('2d', { alpha:false }) : null;
      if (composite && !presentation) throw new Error('Canvas presentation unavailable');
      const context = surface.getContext('webgl2', {antialias:true, alpha:false});
      if (!context) throw new Error('WebGL2 unavailable');
      slot.replaceChildren(canvas);
      engine = new B.Engine(context,true,{doNotHandleContextLost:true});
      if (presentation) engine.inputElement = canvas;
      engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.15 : 1.55));
      gl = new B.Scene(engine);
      instrumentation = new B.SceneInstrumentation(gl);
      const physics = createPhysics(signal);
      const image = async id => {
        const asset = catalogue.get(id);
        if (asset?.kind !== 'texture' || !localAsset.test(asset.uri)) throw new Error('3D texture unavailable');
        const image = new Image();
        const cancel = () => image.removeAttribute('src');
        signal.addEventListener('abort',cancel,{once:true});
        try {
          image.src = asset.uri;
          await image.decode();
          return image;
        } finally { signal.removeEventListener('abort',cancel); }
      };
      const asset = (id, kind) => {
        const entry = catalogue.get(id);
        if (entry?.kind !== kind) throw new Error('3D asset unavailable');
        return entry;
      };
      const built = await sceneFactory({B, scene:gl, canvas, physics, image, asset, fail:() => { if(lifetime===current) dispose('unavailable'); }, low:matchMedia('(pointer: coarse)').matches});
      if (!valid()) { built.dispose?.(); if (!signal.aborted) dispose(); return; }
      renderer = built;
      resize = new ResizeObserver(() => { if (slot?.isConnected && engine) resizeSurface(); });
      resize.observe(canvas);
      observer = new MutationObserver(() => { if (!active()) dispose(); });
      observer.observe(document.querySelector('#game-root'),{attributes:true,attributeFilter:['hidden']});
      const opts = {signal};
      window.addEventListener('pagehide', () => dispose(), opts);
      document.addEventListener('visibilitychange', setLoop, opts);
      surface.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose('unavailable'); }, opts);
      canvas.addEventListener('pointerdown', event => { pointer = event.isPrimary ? [event.clientX,event.clientY] : null; }, opts);
      canvas.addEventListener('pointercancel', () => { pointer = null; }, opts);
      canvas.addEventListener('pointerup', event => {
        if (pointer && event.isPrimary && Math.hypot(event.clientX - pointer[0],event.clientY - pointer[1]) < 7) {
          const rect = canvas.getBoundingClientRect();
          const hit = gl.pick(event.clientX - rect.left,event.clientY - rect.top,mesh => !!mesh.metadata?.pick);
          if (hit?.hit) onPick?.(hit.pickedMesh.metadata.pick);
        }
        pointer = null;
      }, opts);
      renderer.update(model);
      resizeSurface();
      renderFrame();
      stats.sceneReadyMs = (performance.now() - frameStarted).toFixed(1);
      Object.assign(slot.dataset,stats);
      updateStatus('ready');
      setLoop();
    } catch { if (!signal.aborted) dispose('unavailable'); }
    finally { clearTimeout(timer); }
  }
  return {
    sync(currentSlot, nextModel) {
      if (!currentSlot || !active()) { dispose(); return; }
      slot = currentSlot;
      model = nextModel;
      slot.dataset.sceneState = state;
      Object.assign(slot.dataset,stats);
      if (canvas && canvas.parentElement !== slot) {
        slot.replaceChildren(canvas);
        if (engine) resizeSurface();
      }
      if (state === 'ready') {
        try { renderer.update(model); } catch { dispose('unavailable'); }
      } else if (state === 'idle') {
        void start();
      }
    },
    action(name) { renderer?.action?.(name); },
    dispose,
    get state() { return state; },
  };
}

export function cameraRig(B, scene, canvas, defaults, bounds) {
  const { alpha, beta, radius, target } = defaults;
  const camera = new B.ArcRotateCamera('view',alpha,beta,radius,new B.Vector3(...target),scene);
  scene.activeCamera = camera;
  camera.minZ = .12;
  camera.lowerBetaLimit = .19;
  camera.upperBetaLimit = Math.PI / 2.07;
  camera.lowerRadiusLimit = bounds.min;
  camera.upperRadiusLimit = bounds.max;
  camera.wheelDeltaPercentage = .035;
  camera.pinchDeltaPercentage = .012;
  camera.panningSensibility = 160;
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.attachControl(canvas,true);
  let travel;
  return {
    camera,
    go(to = defaults) {
      travel = {start:performance.now(),from:[camera.alpha,camera.beta,camera.radius,camera.target.clone()],to};
    },
    tick(now) {
      if (travel) {
        const {start,from,to} = travel;
        const progress = Math.min(1,(now - start) / 360);
        const step = progress * progress * (3 - 2 * progress);
        const difference = Math.atan2(Math.sin(to.alpha - from[0]),Math.cos(to.alpha - from[0]));
        camera.alpha = from[0] + difference * step;
        camera.beta = from[1] + (to.beta - from[1]) * step;
        camera.radius = from[2] + (to.radius - from[2]) * step;
        camera.target = B.Vector3.Lerp(from[3],new B.Vector3(...to.target),step);
        if (progress === 1) travel = null;
      }
      camera.target.x = Math.max(-bounds.x,Math.min(bounds.x,camera.target.x));
      camera.target.z = Math.max(-bounds.z,Math.min(bounds.z,camera.target.z));
      camera.target.y = Math.max(0,Math.min(1,camera.target.y));
    },
  };
}
