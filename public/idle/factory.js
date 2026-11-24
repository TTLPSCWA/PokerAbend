import { factoryMarkup } from './factory-view.js';
import { problems, words } from './factory-text.js';

const endpoint = '/api/idle/factory';
const leaseKey = 'poker:factory:lease';
const tabKey = leaseKey + ':tab';
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const id = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, '0')).join('');
const coord = (x, y) => x + ',' + y;

function guide(start, end, places, side) {
  const search = [coord(...start)], target = coord(...end), previous = new Map([[search[0], null]]);
  for (let i = 0; i < search.length; i++) {
    const key = search[i];
    if (key === target) {
      const chain = [];
      for (let current = target; current; current = previous.get(current)?.key) chain.unshift(current);
      return chain.map((key, i) => ({ x: Number(key.split(',')[0]), y: Number(key.split(',')[1]),
        rotation: previous.get(chain[i + 1])?.direction }));
    }
    const [x, y] = key.split(',').map(Number);
    for (const [direction, [dx, dy]] of directions.entries()) {
      const next = coord(x + dx, y + dy);
      if (x + dx < 0 || y + dy < 0 || x + dx >= side || y + dy >= side || places.has(next) || previous.has(next)) continue;
      previous.set(next, { key, direction });
      search.push(next);
    }
  }
  return null;
}

export function mountFactory(root, { english, esc, played }) {
  const tr = (de, en) => english ? en : de;
  const text = (key) => words[key]?.[english ? 1 : 0] ?? key;
  const ui = { region: 1, node: 0, x: 0, y: 0, panel: 'build', zoom: false,
    scope: 'free', rotation: 0, level: 1, tool: 'drill', selection: [], start: null };
  // The marker is shared across the Idle tabs. Tokens are isolated per game.
  if (!window.name.startsWith('poker-hall-')) window.name = 'poker-hall-' + id();
  const tab = window.name;
  const get = (key) => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const drop = () => { try { sessionStorage.removeItem(leaseKey); } catch { /* in-memory lease only */ } };
  let snapshot, busy = false, ended = false, message = '', retries, pulse = 0, seen;
  const local = (caption, action) => '<button type="button" data-fe-local="' + action + '">' + esc(caption) + '</button>';

  function render(focus = null) {
    if (ended) return;
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const attr = ['data-fe-tile', 'data-fe-panel', 'data-fe-local', 'data-fe-region', 'data-fe-action', 'data-fe-import', 'name']
      .find((key) => focused?.hasAttribute(key));
    const info = focus ?? (attr ? [attr, focused.getAttribute(attr)] : null);
    const scroller = root.querySelector('.fe-map-scroll');
    const pos = scroller && [scroller.scrollLeft, scroller.scrollTop];
    const tabScroll = root.querySelector('.fe-tabs')?.scrollLeft ?? 0;
    const phase = snapshot?.view?.phase.id, active = Boolean(snapshot?.sessionId && phase);
    const status = snapshot?.readOnly ? tr('Nur Ansicht', 'Read only') :
      snapshot?.unsavedActions ? tr('Ungespeicherte Aktionen', 'Unsaved actions') :
        snapshot?.savedAt === null ? tr('Neues Spiel · ungespeichert', 'New game · unsaved') :
          tr('Gespeichert · Rev. ', 'Saved · rev. ') + snapshot?.revision;
    const buttons = snapshot?.readOnly ? local(tr('Schreibsitzung übernehmen', 'Take over writing session'), 'takeover') :
      local(tr('Speichern', 'Save'), 'save') + local(tr('Speichern & exportieren', 'Save & export'), 'export') +
      '<label class="fe-file">' + tr('Datei importieren', 'Import file') + '<input type="file" data-fe-import accept=".spieleabend,.txt"></label>';
    const actions = active ? '<p>' + esc(status) + '</p><div class="fe-actions">' + buttons +
      (snapshot.revision ? local(tr('Bestätigte Datei', 'Confirmed file'), 'download') : '') + '</div>' :
      '<p>' + tr('Baue eine Produktionsstraße und versorge sie mit Material und Strom.',
        'Build a production line and supply it with materials and power.') + '</p>' +
      (snapshot ? local(snapshot.revision ? tr('Bestätigten Stand öffnen', 'Open confirmed save') :
        tr('Fabrik starten', 'Start factory'), 'open') : local(tr('Ansicht neu laden', 'Reload view'), 'refresh'));
    root.innerHTML = '<div class="fe-shell"' + (active ? ' data-phase="' + phase + '"' : '') +
      '><header class="fe-header">' + (active ? '<p class="fe-kicker">' + esc(text(phase)) + '</p>' : '') +
      '<h1>Factory Empire</h1>' + actions + '</header><div class="fe-status" role="status">' + esc(message) +
      (retries ? local(tr('Aktion wiederholen', 'Retry action'), 'retry') : '') + '</div>' +
      (active ? factoryMarkup(snapshot.view, ui, { esc, english, readonly: snapshot.readOnly }) : '') +
      '</div><dialog class="fe-dialog" aria-labelledby="fe-dialog-title" aria-describedby="fe-dialog-description"></dialog>';
    if (pos) root.querySelector('.fe-map-scroll')?.scrollTo(...pos);
    root.querySelector('.fe-tabs')?.scrollTo(tabScroll, 0);
    if (info) {
      const [attribute, value] = info;
      const target = [...root.querySelectorAll('[' + attribute + ']')].find((el) => el.getAttribute(attribute) === value);
      (target ?? root.querySelector('[data-fe-local="save"], [data-fe-local="takeover"]'))?.focus({ preventScroll: true });
    }
  }

  async function request(path = '', body, token) {
    const headers = { Accept: 'application/json' };
    if (token) headers['X-Idle-Token'] = token;
    if (body) Object.assign(headers, { 'Content-Type': 'application/json', 'X-Requested-With': 'spieleabend' });
    let response;
    try { response = await fetch(endpoint + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers }); }
    catch { throw Object.assign(new Error('network'), { code: 'network' }); }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error('request'), { code: json.code });
    return json;
  }
  function accept(next) {
    if (ended) return;
    snapshot = next;
    const phase = next.view?.phase.id;
    if (phase && seen && phase !== seen) message = tr('Freigeschaltet · ', 'Unlocked · ') + text(phase);
    seen = phase ?? seen;
    if (ui.scope !== next.view?.data.scope) ui.scope = 'free';
    if (!next.token) drop();
    else try {
      sessionStorage.setItem(tabKey, tab);
      sessionStorage.setItem(leaseKey, next.token);
    } catch { /* in-memory lease only */ }
  }
  async function refresh() {
    const token = snapshot?.token ?? (get(tabKey) === tab ? get(leaseKey) : null);
    if (token) accept(await request('', undefined, token));
    else if (snapshot?.sessionId) accept(await request('/session', {}));
    else accept(await request());
  }
  async function perform(fn, update = true) {
    if (busy || ended) return;
    busy = true;
    try { await fn(); }
    catch (err) {
      message = problems[err.code]?.[english ? 1 : 0] ??
        tr('Aktion fehlgeschlagen. Prüfe den aktuellen Spielstand.', 'Action failed. Check the current game state.');
      if (err.code === 'lease-conflict') {
        drop();
        try { accept(await request()); } catch { snapshot = null; }
      }
      update = true;
    } finally { busy = false; if (update) render(); }
  }
  const fields = () => ({ id: id(), token: snapshot.token, revision: snapshot.revision, sessionVersion: snapshot.sessionVersion });
  function download(file) {
    const href = URL.createObjectURL(new Blob([file], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = href; a.download = 'factory-spielstand.spieleabend'; a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1500);
  }
  async function send(path, body) {
    let answer;
    retries = null;
    try { answer = await request(path, body); }
    catch (err) { if (err.code === 'network') retries = { path, body }; throw err; }
    if (answer.file) download(answer.file);
    message = path === '/actions' ? '' : tr('Bestätigt · Rev. ', 'Confirmed · rev. ') + answer.revision;
    await refresh();
  }
  const action = (command) => {
    if (snapshot?.token) perform(() => send('/actions', { ...fields(), action: command }));
  };

  function dialog(title, paragraph, approved) {
    const dlg = root.querySelector('dialog');
    const trigger = document.activeElement;
    dlg.innerHTML = '<form method="dialog"><h2 id="fe-dialog-title">' + esc(title) +
      '</h2><p id="fe-dialog-description">' + esc(paragraph) +
      '</p><div class="fe-actions"><button value="cancel" autofocus>' + tr('Abbrechen', 'Cancel') +
      '</button><button value="confirm">' + tr('Bestätigen', 'Confirm') + '</button></div></form>';
    dlg.returnValue = '';
    dlg.addEventListener('close', () => {
      if (trigger.isConnected) trigger.focus({ preventScroll: true });
      if (dlg.returnValue === 'confirm') approved();
    }, { once: true });
    dlg.showModal();
  }

  function selectTile(el, focus = false) {
    [ui.x, ui.y] = el.dataset.feTile.split(',').map(Number);
    ui.node = Number(el.dataset.building) || 0;
    render(focus ? ['data-fe-tile', el.dataset.feTile] : null);
    if (focus) document.activeElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || busy || button.getAttribute('aria-disabled') === 'true') return;
    if (button.dataset.feTile) { selectTile(button, true); return; }
    if (button.dataset.feRegion) {
      ui.region = Number(button.dataset.feRegion); ui.node = 0; ui.x = 0; ui.y = 0; ui.start = null; ui.selection = [];
      render(); return;
    }
    if (button.dataset.fePanel) {
      ui.panel = button.dataset.fePanel; render(['data-fe-panel', ui.panel]);
      document.activeElement?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    if (button.dataset.feAction) {
      const cmd = JSON.parse(button.dataset.feAction);
      if (['remove', 'undo', 'remove-track', 'forget-blueprint'].includes(cmd.type)) dialog(tr('Aktion überprüfen', 'Review action'),
        tr('Diese Änderung wirkt sofort auf die laufende Fabrik.', 'This change applies immediately to the active factory.'), () => action(cmd));
      else action(cmd);
      return;
    }
    const data = snapshot?.view.data;
    const local = button.dataset.feLocal ?? '';
    if (local.startsWith('select:')) {
      const node = data.buildings.find(({ id }) => id === Number(local.slice(7)));
      ui.node = node.id; ui.x = node.x; ui.y = node.y; ui.panel = 'inspect'; render(['data-fe-panel', 'inspect']); return;
    }
    switch (local) {
      case 'open': perform(async () => {
        accept(await request('/session', {})); played();
        const elapsed = Math.floor((snapshot.settlement.to - snapshot.settlement.from) / 1000);
        message = elapsed ? tr('Offline abgerechnet · ', 'Offline settlement · ') + elapsed.toLocaleString(tr('de-DE', 'en-GB')) + ' s' : '';
      }); break;
      case 'refresh': perform(refresh); break;
      case 'save': case 'export': perform(() => send('/' + local, fields())); break;
      case 'download': perform(async () => download((await request('/export')).file)); break;
      case 'retry': { const retry = retries; perform(() => send(retry.path, retry.body)); break; }
      case 'zoom': ui.zoom = !ui.zoom; render(); break;
      case 'band-start': ui.start = [ui.x, ui.y]; render(); break;
      case 'band-finish': {
        const region = data.regions.find(({ id }) => id === ui.region);
        const blocked = new Set(data.buildings.filter((row) => row.region === ui.region && row.type !== 'cable')
          .flatMap(({ tiles }) => tiles.map(([x, y]) => coord(x, y))));
        const path = ui.start && !blocked.has(coord(...ui.start)) &&
          guide(ui.start, [ui.x, ui.y], blocked, region.size);
        if (!path || path.length > 128) { message = tr('Start oder Ziel belegt, oder kein freier Bandweg.', 'Start or target is occupied, or no free conveyor path.'); render(); break; }
        const level = data.bands.find((b) => b.level === Number(ui.level))?.level ?? data.bands[0].level;
        const build = path.map(({ x, y, rotation }) => ({ type: 'belt', x, y, level, rotation: rotation ?? Number(ui.rotation) }));
        ui.start = null; action({ type: 'layout', region: ui.region, scope: ui.scope, build }); break;
      }
      case 'select-blueprint':
        ui.selection = ui.selection.includes(ui.node) ? ui.selection.filter((item) => item !== ui.node) : [...ui.selection, ui.node];
        render(); break;
      case 'takeover':
        dialog(tr('Schreibsitzung übernehmen', 'Take over writing session'),
          tr('Ungespeicherte Aktionen des anderen Tabs gehen verloren.', 'Unsaved actions in the other tab will be discarded.'),
          () => perform(async () => {
            const { revision, sessionId, sessionVersion } = snapshot;
            accept(await request('/takeover', { revision, sessionId, sessionVersion, confirm: true }));
            message = tr('Schreibsitzung übernommen.', 'Writing session transferred.');
          }));
        break;
      case 'prestige':
        dialog(tr('Industriepatente bestätigen', 'Confirm industry patents'),
          tr('Neuer Run. Patente und Blaupausen bleiben. Produktionsnetze, Geld und Forschung starten neu. Neue Ansprüche: ',
            'New run. Patents and blueprints remain. Networks, money and research reset. New claims: ') +
            data.eligible.map((claim) => claim.split('-').map(text).join(' ')).join(', '), () => perform(async () => {
            await send('/prestige', { ...fields(), claims: data.eligible, confirm: true });
            Object.assign(ui, { region: 1, x: 0, y: 0, node: 0, panel: 'build', selection: [] });
          }));
        break;
    }
  });

  root.addEventListener('keydown', (event) => {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(event.target);
    if (i >= 0) {
      const next = { ArrowLeft: (i + tabs.length - 1) % tabs.length, ArrowRight: (i + 1) % tabs.length, Home: 0, End: tabs.length - 1 };
      if (Object.hasOwn(next, event.key)) { event.preventDefault(); tabs[next[event.key]].click(); }
      return;
    }
    if (!event.target.dataset.feTile) return;
    const dir = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].indexOf(event.key);
    if (dir < 0) return;
    event.preventDefault();
    const [dx, dy] = directions[dir];
    const selector = '[data-fe-tile="' + coord(ui.x + dx, ui.y + dy) + '"]';
    const next = root.querySelector(selector);
    if (next) selectTile(next, true);
  });

  root.addEventListener('change', (event) => {
    if (event.target.form?.dataset.feForm === 'build') {
      ui[event.target.name] = event.target.value;
      render(); return;
    }
    if (!event.target.matches('[data-fe-import]') || !event.target.files[0] || !snapshot?.token) return;
    const file = event.target.files[0];
    event.target.value = '';
    perform(async () => {
      if (file.size > 350000) throw Object.assign(new Error('file'), { code: 'payload-too-large' });
      const { previewId, revision, savedAt } = await request('/import/preview', { token: snapshot.token, file: await file.text() });
      if (ended) return;
      if (!snapshot.unsavedActions) { message = tr('Diese Revision ist bereits aktiv.', 'This revision is already active.'); render(); return; }
      dialog(tr('Bestätigte Revision laden', 'Restore confirmed revision'),
        tr('Signatur, Spiel und Konto geprüft. Ungespeicherte Aktionen verwerfen und Revision ',
          'Signature, game and account verified. Discard unsaved actions and restore revision ') + revision +
        ' (' + new Date(savedAt).toLocaleString(tr('de-DE', 'en-GB')) + ')?',
        () => perform(() => send('/import/confirm', { token: snapshot.token, previewId, confirm: true })));
    }, false);
  });

  root.addEventListener('submit', (event) => {
    const form = event.target.dataset.feForm;
    if (!form) return;
    event.preventDefault();
    if (!snapshot?.token || busy) return;
    const data = Object.fromEntries(new FormData(event.target));
    let cmd;
    switch (form) {
      case 'build': {
        const tile = { type: data.tool, x: ui.x, y: ui.y, rotation: Number(data.rotation), level: Number(data.level ?? 1) };
        if (data.good) tile.good = data.good;
        if (data.mode) tile.mode = data.mode;
        cmd = { type: 'layout', region: ui.region, scope: data.scope ?? 'free', build: [tile] }; break;
      }
      case 'scope': cmd = { type: 'configure', id: ui.node, scope: data.scope }; break;
      case 'tune': cmd = { type: 'configure', id: ui.node, ...data }; break;
      case 'lab': {
        const target = snapshot.view.data.research.find(({ id }) => id === data.tech);
        if (!target) return;
        cmd = { type: 'configure', id: Number(data.id), target: target.id, scope: target.scope ?? 'free' }; break;
      }
      case 'track': cmd = { type: 'track', source: Number(data.source), destination: Number(data.destination),
        wagons: Number(data.wagons), auto: Boolean(data.auto) }; break;
      case 'auto-order': cmd = { type: 'auto-order', good: data.good }; break;
      case 'blueprint': cmd = { type: 'blueprint', name: data.name, ids: ui.selection }; break;
      default: return;
    }
    action(cmd);
  });

  const unload = (event) => {
    if (snapshot?.unsavedActions && !snapshot.readOnly) { event.preventDefault(); event.returnValue = ''; }
  };
  window.addEventListener('beforeunload', unload);
  const timer = setInterval(() => {
    if (!snapshot?.sessionId || busy || root.querySelector('dialog[open]')) return;
    const editing = root.contains(document.activeElement) && document.activeElement.closest('form,.fe-file');
    perform(async () => {
      if (snapshot.token && ++pulse % 6 === 0) await request('/session/heartbeat', { token: snapshot.token });
      if (!editing) await refresh();
    }, !editing);
  }, 10000);
  perform(refresh);
  return {
    unsaved: () => Boolean(snapshot?.unsavedActions && !snapshot.readOnly),
    destroy() { ended = true; clearInterval(timer); window.removeEventListener('beforeunload', unload); },
  };
}
