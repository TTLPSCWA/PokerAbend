// Serialized by Playwright. Keep all browser-side code inside this function.
export function startDomPresentationCapture({ scope, expected }) {
  if (window.__experienceLeakCapture) throw Error('A leak capture is already active');
  const audit = window.__pokerRoomViewAudit;
  const initial = audit?.current();
  const sameRoom = initial && expected && initial.connection === expected.connection &&
    initial.room === expected.room && initial.viewer === expected.viewer && initial.revision >= expected.revision;
  if (expected ? !sameRoom : initial) throw Error('No captured server view for the initial DOM revision');
  if (!document.querySelector(scope)) throw Error('No presentation root for ' + scope);

  const roots = new WeakSet();
  const sampled = new WeakMap();
  const samples = [];
  let overflow = false;
  let invalidated = false;
  const animate = Element.prototype.animate;
  const ignored = new Set(['SCRIPT', 'STYLE', 'LINK', 'META']);
  const diceAttributes = ['data-die-value', 'data-dice-value', 'data-dice-values'];
  const relevant = name => name.startsWith('data-') || ['src', 'href', 'style', 'aria-label', 'alt', 'title', 'class'].includes(name);

  // Rewind a batch without touching the actual DOM. Lazy copies carry the
  // attributes, text and parent/child links as they were after each mutation.
  function snapshot() {
    const parents = new Map(), children = new Map(), attributes = new Map(), characters = new Map();
    const parent = node => parents.has(node) ? parents.get(node) : node.parentNode;
    const kids = node => children.get(node) ?? [...node.childNodes];
    const attrs = node => {
      if (!attributes.has(node)) {
        attributes.set(node, new Map([...node.attributes].filter(attr => relevant(attr.name)).map(attr => [attr.name, attr.value])));
      }
      return attributes.get(node);
    };
    const text = node => characters.has(node) ? characters.get(node) : node.data;
    return {
      parent, kids, attrs, text,
      rewind(record) {
        const node = record.target;
        if (record.type === 'attributes') {
          const name = record.attributeName;
          if (!relevant(name)) return;
          if (record.oldValue === null) attrs(node).delete(name);
          else attrs(node).set(name, record.oldValue);
        } else if (record.type === 'characterData') {
          characters.set(node, record.oldValue);
        } else {
          const added = new Set(record.addedNodes);
          const remaining = kids(node).filter(child => !added.has(child));
          const next = remaining.indexOf(record.nextSibling);
          const prev = remaining.indexOf(record.previousSibling);
          const insertion = next >= 0 ? next : prev >= 0 ? prev + 1 : remaining.length;
          remaining.splice(insertion, 0, ...record.removedNodes);
          children.set(node, remaining);
          for (const child of added) parents.set(child, null);
          for (const child of record.removedNodes) parents.set(child, node);
        }
      },
    };
  }

  function remember(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(scope)) roots.add(node);
    for (const root of node.querySelectorAll(scope)) roots.add(root);
  }

  function inScope(node, state) {
    let seen = false;
    for (let cursor = node; cursor; cursor = state.parent(cursor)) {
      seen ||= roots.has(cursor);
      if (cursor === document) return seen;
    }
    return false;
  }

  function sample(node, state, stamp, kind = 'dom', frames = []) {
    if (overflow || node?.nodeType !== 1 || ignored.has(node.tagName) || !inScope(node, state)) return;
    const attrs = state.attrs(node);
    const children = state.kids(node);
    const text = children.some(child => child.nodeType === 1) ? '' :
      children.filter(child => child.nodeType === 3).map(child => state.text(child)).join('');
    const path = attrs.get('data-view-path');
    const value = attrs.get('data-view-value') ?? attrs.get('data-card') ?? attrs.get('data-die-value');
    const attributes = Object.fromEntries([...attrs].filter(([name]) => name !== 'class'));
    const dice = diceAttributes.some(name => attrs.has(name)) || /(?:^|\s)(?:die|dice)(?:\s|$)/.test(attrs.get('class') ?? '');
    const observation = { stamp, kind, tag: node.tagName, path, value, text, attributes, frames, dice };
    let entry = sampled.get(node);
    if (!entry || entry.stamp !== stamp) {
      entry = { stamp, values: new Set() };
      sampled.set(node, entry);
    }
    const key = JSON.stringify(observation);
    if (entry.values.has(key)) return;
    if (samples.length >= 12000) {
      overflow = true;
      return;
    }
    entry.values.add(key);
    samples.push(observation);
  }

  function scan(node, state, stamp, kind) {
    if (overflow || node.nodeType !== 1) return;
    sample(node, state, stamp, kind);
    for (const child of state.kids(node)) scan(child, state, stamp, kind);
  }

  function scanRoots(stamp) {
    const state = snapshot();
    for (const root of document.querySelectorAll(scope)) {
      roots.add(root);
      scan(root, state, stamp);
    }
  }

  function collect(records, stamp) {
    if (!records.length || overflow) return;
    for (const { addedNodes, removedNodes } of records) {
      for (const node of addedNodes) remember(node);
      for (const node of removedNodes) remember(node);
    }
    const state = snapshot();
    for (let index = records.length - 1; index >= 0; index--) {
      const record = records[index];
      if (record.type === 'childList') {
        sample(record.target, state, stamp);
        for (const added of record.addedNodes) scan(added, state, stamp);
      } else if (record.type === 'characterData') {
        sample(state.parent(record.target), state, stamp);
      } else if (relevant(record.attributeName)) {
        sample(record.target, state, stamp);
      }
      state.rewind(record);
    }
  }

  scanRoots(initial);
  for (const animation of document.getAnimations()) {
    const target = animation.effect?.target;
    if (target instanceof Element) {
      const frames = animation.effect.getKeyframes().flatMap(frame => Object.values(frame).filter(v => typeof v === 'string'));
      sample(target, snapshot(), initial, 'animation', frames);
    }
  }
  if (typeof animate === 'function') Element.prototype.animate = function (frames, options) {
    const stamp = audit?.current();
    const state = snapshot();
    scan(this, state, stamp, 'animation');
    const values = Array.isArray(frames) ? frames.flatMap(frame => Object.values(frame).filter(v => typeof v === 'string')) :
      Object.values(frames || {}).flat().filter(v => typeof v === 'string');
    sample(this, state, stamp, 'animation', values);
    return animate.call(this, frames, options);
  };

  const observer = new MutationObserver(records => collect(records, audit?.current()));
  observer.observe(document, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeOldValue: true, characterDataOldValue: true });
  audit?.watch({
    flush: stamp => collect(observer.takeRecords(), stamp),
    rendered(stamp) {
      collect(observer.takeRecords(), stamp);
      scanRoots(stamp);
    },
    invalidate: () => { invalidated = true; },
  });
  window.__experienceLeakCapture = {
    finish() {
      const stamp = audit?.current();
      collect(observer.takeRecords(), stamp);
      scanRoots(stamp);
      return { samples, overflow, invalidated: invalidated || !document.querySelector(scope) };
    },
    cleanup() {
      observer.disconnect();
      audit?.watch(undefined);
      Element.prototype.animate = animate;
      delete window.__experienceLeakCapture;
    },
  };
}
