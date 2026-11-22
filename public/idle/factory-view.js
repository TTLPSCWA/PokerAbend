import { formatQuantity } from './engine.js';
import { words } from './factory-text.js';

const marks = { dock: '⇥', drill: '⛏', furnace: '◩', press: '▤', warehouse: '▣', cable: '╋', generator: 'ϟ',
  electricDrill: '⛏', electricFurnace: '◩', wire: '⌁', assembly: '⊕', lab: '⚗', splitter: '⑃',
  merger: '⑂', station: '▰', quartzFurnace: '◇', chipPlant: '▦', modulePlant: '⊞', renewable: '♧' };
export const arrows = ['→', '↓', '←', '↑'];

export function factoryMarkup(view, ui, common) {
  const d = view.data, { esc, english, readonly } = common;
  const tr = (de, en) => english ? en : de;
  const name = (id) => words[id]?.[english ? 1 : 0] ?? id;
  const good = (id) => name(id === 'wire' ? 'wireGood' : id);
  const n = (value, scale = 0) => formatQuantity(String(value ?? 0), { scale, locale: tr('de-DE', 'en-GB') });
  const stock = (value) => {
    const amount = BigInt(value ?? 0);
    return amount % 1000n ? n(amount, 3) : n(amount / 1000n);
  };
  const region = d.regions.find(({ id }) => id === ui.region) ?? d.regions[0];
  const nodes = d.buildings.filter((row) => row.region === region.id);
  const chosen = nodes.find(({ id }) => id === ui.node);
  const dockBusy = (id) => d.manual.some((item) => item.region === id) ?
    tr('Manuelle Buchung wartet am Dock.', 'Manual transaction queued at the dock.') : '';
  const amount = (key) => BigInt(d.amounts[key] ?? '0');
  const field = (x, y) => d.fields.find((row) => row.region === region.id && row.areas.some(([fx, fy, w, h]) =>
    x >= fx && x < fx + w && y >= fy && y < fy + h));
  const section = (label, contents) => '<section class="fe-card"><h2>' + esc(label) + '</h2>' + contents + '</section>';
  const local = (label, key) => '<button type="button" data-fe-local="' + esc(key) + '">' + esc(label) + '</button>';
  const send = (label, action, reason = '') => '<button type="button" data-fe-action="' + esc(JSON.stringify(action)) +
    (readonly || reason ? '" aria-disabled="true" title="' + esc(reason || tr('Nur Ansicht', 'Read only')) : '') +
    '">' + esc(label) + '</button>' + (reason ? '<small class="fe-lock">' + esc(reason) + '</small>' : '');
  const stat = (label, value) => '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
  const option = (value, title, selected) => '<option value="' + esc(String(value)) + '"' +
    (String(value) === String(selected) ? ' selected' : '') + '>' + esc(title) + '</option>';
  const select = (label, key, values, selected, display = name) => '<label>' + esc(label) + '<select name="' + key + '">' +
    values.map((value) => option(value, display(value), selected)).join('') + '</select></label>';
  const submit = (label) => '<button type="submit"' + (readonly ? ' disabled' : '') + '>' + esc(label) + '</button>';
  const storeNode = (row) => ['warehouse', 'station', 'lab'].includes(row.type);
  const techLabel = (id) => id === 'warehouse' ? tr('Lagerausbau', 'Warehouse expansion') : name(id);
  const nodeName = (row) => name(row.type) + ' · ' + row.x + '/' + row.y;
  const shortTrack = (id) => tr('Strecke ', 'Route ') + id;

  function map() {
    const laid = new Map(), wired = new Set();
    for (const row of nodes) for (const [x, y] of row.tiles) {
      if (row.type === 'cable') wired.add(x + ',' + y);
      if (row.type !== 'cable' || !laid.has(x + ',' + y)) laid.set(x + ',' + y, row);
    }
    const cells = Array.from({ length: region.size ** 2 }, (_, index) => {
      const x = index % region.size, y = Math.floor(index / region.size);
      const key = x + ',' + y, row = laid.get(key), deposit = field(x, y);
      const picked = ui.x === x && ui.y === y;
      const text = row ? name(row.type) + ', ' + name(row.status) : deposit ? good(deposit.good) : tr('frei', 'empty');
      const sign = row ? row.type === 'belt' ? arrows[row.rotation] : marks[row.type] : deposit ? '•' : '';
      return '<button type="button" class="fe-tile' + (row ? ' fe-' + row.type : deposit ? ' fe-ore' : '') +
        (deposit?.good === 'copperOre' ? ' fe-copper' : deposit?.good === 'quartz' ? ' fe-quartz' : '') +
        (wired.has(key) ? ' fe-wired' : '') + '" data-fe-state="' + (row?.status ?? '') +
        '" data-fe-tile="' + key + '" data-building="' + (row?.id ?? '') +
        '" aria-pressed="' + picked + '" tabindex="' + (picked ? '0' : '-1') +
        '" aria-label="' + esc(tr('Kachel ', 'Tile ') + x + '/' + y + ', ' + text) +
        '"><span aria-hidden="true">' + (row && (row.x !== x || row.y !== y) ? '' : sign) + '</span></button>';
    }).join('');
    return '<div class="fe-map-head"><div class="fe-actions">' + d.regions.map(({ id }) => '<button type="button" data-fe-region="' + id +
      '" aria-pressed="' + (id === region.id) + '">' + name(id) + '</button>').join('') + '</div>' +
      local(ui.zoom ? tr('Karte verkleinern', 'Zoom out') : tr('Karte vergrößern', 'Zoom in'), 'zoom') +
      '</div><div class="fe-map-scroll"><div class="fe-map' + (ui.zoom ? ' fe-zoom' : '') + '" role="group" aria-label="' +
      esc(tr('Fabrikkarte ', 'Factory map ') + name(region.id)) + '" style="--side:' + region.size + '">' + cells + '</div></div>' +
      '<p>' + esc(tr('Kachel ', 'Tile ') + ui.x + '/' + ui.y + (ui.start ? ' · ' +
        tr('Bandstart ', 'Conveyor start ') + ui.start.join('/') : '')) + '</p>';
  }

  function buildingPanel() {
    const tool = d.tools.find(({ type }) => type === ui.tool) ?? d.tools[0];
    const band = d.bands.find(({ level }) => level === Number(ui.level)) ?? d.bands[0];
    const locked = tool.type === 'belt' && !band;
    const needsGood = ['lab', 'station', 'warehouse'].includes(tool.type);
    const outputs = tool.outputs ? tool.outputs.filter((key) => key !== 'copperIngot' || d.research.some((r) => r.id === 'copper' && r.complete)) : null;
    const price = tool.type === 'belt' && band ? band.cost : tool.cost;
    const startWorks = nodes.some((node) => node.tiles.some(([x, y]) => x === ui.x && y === ui.y) &&
      !(node.type === 'belt' && tool.type === 'cable' || node.type === 'cable' && tool.type === 'belt'));
    return section(tr('Bauwerkzeuge', 'Build tools'),
      '<form data-fe-form="build"><div class="fe-form">' +
      select(tr('Gebäude', 'Building'), 'tool', d.tools.map(({ type }) => type), tool.type) +
      select(tr('Ausrichtung', 'Direction'), 'rotation', [0, 1, 2, 3], ui.rotation, (id) => arrows[id]) +
      (d.scope ? select(tr('Materialkreislauf', 'Material circuit'), 'scope', ['free', d.scope], ui.scope) : '') +
      (tool.type === 'belt' ? select(tr('Bandstufe', 'Conveyor tier'), 'level', d.bands.map(({ level }) => level), band?.level,
        (id) => 'Mk' + id) : '') +
      (outputs?.length || needsGood ? select(tr('Gut', 'Good'), 'good', outputs?.length ? outputs : d.goods, ui.good, good) : '') +
      (tool.type === 'station' ? select(tr('Bahnhofsfunktion', 'Station role'), 'mode', ['out', 'in'], ui.mode) : '') + '</div>' +
      '<p>' + esc(n(price) + ' Credits · ' + tr('Anker ', 'Anchor ') + ui.x + '/' + ui.y) + '</p>' +
      '<div class="fe-actions">' + (locked || startWorks ? '<small class="fe-lock">' +
        esc(locked ? tr('Keine Bandstufe verfügbar.', 'No conveyor tier available.') :
          tr('Ankerkachel belegt. Andere Kachel wählen.', 'The anchor tile is occupied. Select another tile.')) + '</small>' :
        submit(tr('Auf dieser Kachel bauen', 'Build on this tile'))) + '</div></form>' +
      (d.bands.length ? '<div class="fe-actions">' + local(tr('Bandstart setzen', 'Set conveyor start'), 'band-start') +
        (ui.start ? local(tr('Band zum Ziel bauen', 'Build conveyor to target'), 'band-finish') : '') + '</div>' : '') +
      send(tr('Letzten Bau rückgängig', 'Undo last build'), { type: 'undo' }, !d.lastBuild ? tr('Kein offener Bau zum Rückgängigmachen.', 'No recent build to undo.') : ''));
  }

  function inspection() {
    const f = field(ui.x, ui.y);
    const mine = f ? send(tr('Manuell fördern', 'Mine manually'), { type: 'mine', field: f.id, scope: ui.scope || 'free' },
      d.mineWait ? tr('Förderpause läuft', 'Mining cooldown') : '') + '<p>' + esc(good(f.good) + ' · ' + stock(f.stocks.free) +
      ' ' + tr('frei', 'free')) + '</p>' : '';
    if (!chosen) return section(tr('Inspektor', 'Inspector'), '<p>' + tr('Wähle eine Kachel oder Maschine.', 'Select a tile or machine.') +
      '</p>' + mine);
    const input = d.flows.filter((e) => e.to === chosen.id), out = d.flows.filter((e) => e.from === chosen.id);
    const describe = (links) => links.length ? links.map((link) => {
      const other = d.buildings.find(({ id }) => id === (link.from === chosen.id ? link.to : link.from));
      return name(other.type) + ' ' + other.x + '/' + other.y + ' · ' + stock(link.rate) + '/s';
    }).join(', ') : tr('kein Fluss', 'no flow');
    const swapScope = d.scope && chosen.type !== 'dock' ? '<form data-fe-form="scope">' +
      select(tr('Materialkreislauf', 'Material circuit'), 'scope', ['free', d.scope], chosen.scope) +
      submit(tr('Kreislauf setzen', 'Set circuit')) + '</form>' : '';
    const canHandleStock = storeNode(chosen) && chosen.good;
    const recovery = chosen.disconnectedOutput ?
      tr('Der Ausgang ist nicht verbunden. Drehe die Maschine zum Eingang eines Abnehmers oder lege ein Band zum Ausgang.',
        'The outlet is disconnected. Rotate the machine towards a consumer input or connect a conveyor to the outlet.') : {
      'no-power': tr('Pausiere andere Verbraucher oder verbinde ein zusätzliches Kraftwerk. Markiere wichtige Maschinen als kritisch.',
        'Pause other consumers or connect another generator. Mark essential machines as critical.'),
      full: tr('Trage Ware ins Hoflager und nutze das Dock oder schließe ab Phase 3 einen freien Abnehmer an.',
        'Carry goods to the yard and use the dock, or connect an available consumer from phase 3.'),
      waiting: tr('Prüfe Gut und Ausrichtung am Eingang. Verbinde einen freien Abnehmer oder leere das nächste Lager.',
        'Check the incoming good and direction. Connect an available consumer or clear the next storage unit.'),
      paused: tr('Starte die Maschine erneut oder lass sie pausiert, um anderen Maschinen Platz im Stromnetz zu geben.',
        'Resume the machine or leave it paused to give other machines power capacity.'),
    }[chosen.status];
    const trades = ['ironOre', 'copperOre', 'ironIngot', 'copperIngot', 'gear', 'wire', 'motor', 'controlModule'];
    const stateControls = chosen.type === 'dock' ? '' : '<div class="fe-actions">' +
      send(tr('Drehen', 'Rotate'), { type: 'rotate', id: chosen.id }) +
      send(chosen.enabled ? tr('Pausieren', 'Pause') : tr('Wieder starten', 'Resume'), { type: 'toggle', id: chosen.id }) +
      (d.tools.find(({ type }) => type === chosen.type)?.power ?
        send(chosen.critical ? tr('Kritisch aufheben', 'Clear critical status') : tr('Kritisch markieren', 'Mark critical'),
          { type: 'critical', id: chosen.id }) : '') +
      send(tr('Demontieren', 'Dismantle'), { type: 'remove', id: chosen.id }) + '</div>';
    return section(tr('Inspektor · ', 'Inspector · ') + nodeName(chosen),
      '<p>' + esc(name(chosen.status) + (chosen.critical ? ' · ' + tr('kritisch', 'critical') : '') +
        ' · ' + name(chosen.scope)) + '</p>' +
      (recovery ? '<p>' + esc(recovery) + '</p>' : '') +
      '<dl class="fe-mini">' + stat(tr('Eingänge', 'Inputs'), describe(input)) + stat(tr('Ausgänge', 'Outputs'), describe(out)) +
      (canHandleStock ? stat(good(chosen.good), stock(chosen.inventory) + ' / ' + stock(chosen.capacity)) : '') + '</dl>' +
      (chosen.band ? '<p>' + esc(tr('Band ', 'Conveyor ') + stock(chosen.band.current) + ' / ' + stock(chosen.band.max) +
        '/s · ' + tr('Quelle bis ', 'Source up to ') + stock(chosen.band.offered) + '/s') + '</p>' +
        (chosen.band.limited ? send(tr('Bandengpass bestätigen', 'Confirm conveyor bottleneck'), { type: 'inspect', id: chosen.id }) : '') : '') +
      stateControls + mine + swapScope +
      (canHandleStock ? '<div class="fe-actions">' +
        send(tr('Ins Hoflager tragen', 'Carry to yard'), { type: 'move', region: region.id, from: chosen.id, good: chosen.good, scope: chosen.scope },
          BigInt(chosen.inventory) === 0n ? tr('Lager leer', 'Storage empty') : '') +
        (chosen.type !== 'station' || chosen.mode === 'out' ? send(tr('Aus Hoflager holen', 'Fetch from yard'),
          { type: 'move', region: region.id, to: chosen.id, good: chosen.good, scope: chosen.scope }) : '') +
        (chosen.scope === 'free' && trades.includes(chosen.good) ? send(tr('Am Dock verkaufen', 'Sell at dock'),
          { type: 'sell', region: region.id, from: chosen.id, good: chosen.good }, dockBusy(region.id)) : '') + '</div>' : '') +
      (canHandleStock || ['furnace','electricFurnace','splitter'].includes(chosen.type) ? '<form data-fe-form="tune">' +
        (chosen.type === 'splitter' ? select(tr('Verteilung', 'Distribution'), 'mode', ['equal', 'priority'], chosen.mode) :
          select(tr('Gut', 'Good'), 'good', canHandleStock ? d.goods : ['ironIngot', ...d.research.some((r) => r.id === 'copper' && r.complete) ? ['copperIngot'] : []], chosen.good, good)) +
        submit(tr('Einstellung übernehmen', 'Apply setting')) + '</form>' : '') +
      (d.phase === 5 && d.research.some(({ id, complete }) => id === 'blueprint' && complete) && chosen.type !== 'dock' ?
        local(ui.selection.includes(chosen.id) ? tr('Aus Auswahl entfernen', 'Remove from selection') : tr('Für Blaupause auswählen', 'Select for blueprint'), 'select-blueprint') : ''));
  }

  function logistics() {
    const inbound = d.buildings.filter((n) => n.type === 'station' && n.mode === 'in');
    const outbound = d.buildings.filter((n) => n.type === 'station' && n.mode === 'out');
    const stationName = (id) => {
      const row = d.buildings.find((n) => n.id === id);
      return name(row.region) + ' · ' + nodeName(row) + ' · ' + good(row.good);
    };
    return section(tr('Bahnlogistik', 'Rail logistics'),
      (outbound.length && inbound.length ? '<form data-fe-form="track" class="fe-form">' +
        select(tr('Abfahrt', 'Departure'), 'source', outbound.map(({ id }) => id), '', stationName) +
        select(tr('Ankunft', 'Arrival'), 'destination', inbound.map(({ id }) => id), '', stationName) +
        select(tr('Wagen', 'Wagons'), 'wagons', [1, 2, 3], 1, String) +
        '<label class="fe-check"><input type="checkbox" name="auto"> ' + tr('Pflichtaufträge automatisch verladen', 'Auto-load required orders') +
        '</label>' + submit(tr('Strecke bauen', 'Build route')) + '</form>' :
        '<p>' + tr('Baue einen Verlade- und einen Empfangsbahnhof in verschiedenen Regionen.', 'Build loading and receiving stations in different regions.') + '</p>') +
      d.tracks.map((track) => '<article class="fe-row"><strong>' + esc(shortTrack(track.id) + ' · ' +
        stationName(track.source) + ' → ' + stationName(track.destination)) + '</strong><p>' +
        esc(track.wagons * 50 + tr(' Stück je 120 s', ' items per 120 s') +
          (track.manifest ? ' · ' + tr('Ankunft ', 'Arrived ') + stock(track.manifest.unloaded) + ' / ' + stock(track.manifest.amount) : '')) +
        '</p><div class="fe-actions">' + send(tr('Bestand verladen und senden', 'Load stock and dispatch'),
          { type: 'dispatch', id: track.id }, track.manifest ? tr('Fracht unterwegs', 'Cargo in transit') : '') +
        send(track.auto ? tr('Automatik aus', 'Disable automation') : tr('Automatik an', 'Enable automation'),
          { type: 'auto-train', id: track.id }) + send(tr('Strecke abbauen', 'Remove route'),
          { type: 'remove-track', id: track.id }, track.manifest ? tr('Fracht unterwegs', 'Cargo in transit') : '') + '</div></article>').join('') +
      (d.nextRegion ? '<p>' + esc(name(d.nextRegion.id) + ' · ' + n(d.nextRegion.credits) + ' Credits · ' +
        Object.entries(d.nextRegion.parts).map(([key, qty]) => n(qty) + ' ' + good(key)).join(', ')) + '</p>' +
        send(tr('Nächste Region erschließen', 'Open next region'), { type: 'region', from: region.id }) : ''));
  }

  function progress() {
    return section(view.next ? tr('Nächstes Ziel · ', 'Next goal · ') + name(view.next) :
      view.progress.every(({ met }) => met) ? tr('Alle Abschlussziele erreicht', 'All completion goals met') : tr('Abschlussziele', 'Completion goals'),
    '<ul class="fe-goals">' + view.progress.map((goal) => '<li><span>' + (goal.met ? '✓ ' : '○ ') + esc(name(goal.key)) +
      '</span><strong>' + (goal.target === true ? (goal.met ? tr('Erfüllt', 'Met') : tr('Offen', 'Open')) :
        n(goal.current ?? 0) + ' / ' + n(goal.target)) + '</strong></li>').join('') + '</ul>');
  }

  function material() {
    const scopes = d.scope ? ['free', d.scope] : ['free'];
    const stocks = d.goods.flatMap((key) => scopes.map((lane) => ({ key, lane, total:
      ['free', 'line', 'pilot', 'rail'].filter((scope) => lane === scope || lane === 'free' && scope !== d.scope &&
        !(d.phase < 3 && scope === 'line')).reduce((sum, scope) => sum + amount('yard:' + region.id + ':' + scope + ':' + key), 0n) })))
      .filter(({ total }) => total > 0n);
    return section(tr('Rohstoffe und Hoflager', 'Deposits and yard inventory'),
      (dockBusy(region.id) ? '<p role="status">' + esc(dockBusy(region.id)) + '</p>' : '') +
      d.fields.filter((row) => row.region === region.id).map((row) => '<article class="fe-row"><strong>' + esc(good(row.good) + ' · ' + row.id) +
        '</strong><p>' + esc(tr('Frei ', 'Free ') + stock(row.stocks.free) +
          (d.scope ? ' · ' + tr('Gebunden ', 'Reserved ') + stock(row.stocks[d.scope]) : '')) + '</p>' +
        send(tr('Manuell abbauen', 'Mine by hand') + ' · ' + good(row.good),
          { type: 'mine', field: row.id }, d.mineWait ? tr('Förderpause läuft', 'Mining cooldown') : '') + '</article>').join('') +
      (d.rescue ? send(tr('Notschürfen', 'Emergency mining'), { type: 'mine', field: 'rescue' },
        d.mineWait ? tr('Förderpause läuft', 'Mining cooldown') : '') : '') +
      (d.rescueOre !== '0' ? send(tr('Noterz am Dock verkaufen', 'Sell emergency ore at the dock') + ' · ' +
        stock(d.rescueOre), { type: 'sell-rescue' }, dockBusy(1)) : '') +
      (stocks.length ? stocks.map(({ key, lane, total }) => '<article class="fe-row"><strong>' + esc(good(key) + ' · ' + name(lane)) +
        '</strong><span>' + stock(total) + '</span>' + (lane === 'free' && Object.hasOwn(d.prices, key) ?
          send(tr('Verkaufen', 'Sell') + ' · ' + good(key), { type: 'sell', region: region.id, good: key }, dockBusy(region.id)) : '') + '</article>').join('') :
        '<p>' + tr('Das Hoflager ist leer.', 'The yard is empty.') + '</p>'));
  }

  function technology() {
    const labs = nodes.filter((row) => row.type === 'lab');
    return section(tr('Forschung', 'Research'),
      (labs.length ? '<form data-fe-form="lab" class="fe-form">' +
        select(tr('Labor', 'Lab'), 'id', labs.map(({ id }) => id), chosen?.id, (id) => nodeName(labs.find((n) => n.id === id))) +
        select(tr('Forschungsziel', 'Research target'), 'tech', d.research.filter((row) => !row.complete).map(({ id }) => id), '', techLabel) +
        submit(tr('Forschungsziel einstellen', 'Set research target')) + '</form>' :
        '<p>' + tr('Baue und versorge ein Labor, um Bauteile für Forschung anzuliefern.', 'Build and power a lab to deliver components for research.') + '</p>') +
      d.research.map((row) => {
        const lab = labs.find((node) => node.target === row.id);
        return '<article class="fe-row"><strong>' + esc(techLabel(row.id)) + '</strong><p>' +
          esc(row.complete ? tr('Erforscht', 'Research complete') : row.amount + ' ' + good(row.good) + ' · ' +
            row.cost + ' Credits' + (row.prior ? ' · ' + tr('Benötigt ', 'Requires ') + techLabel(row.prior) : '')) +
          '</p>' + (lab && !row.complete ? send(tr('Forschung abschließen', 'Complete research'),
            { type: 'research', id: lab.id, tech: row.id }, BigInt(lab.inventory) < BigInt(row.amount) * 1000n ?
              tr('Bauteile fehlen', 'Components missing') : '') : '') + '</article>';
      }).join(''));
  }

  function orderBoard() {
    return section(tr('Auftragsbrett', 'Order board'), (d.phase >= 4 ? '<form data-fe-form="auto-order">' +
      select(tr('Autovertrags-Profil', 'Automatic order profile'), 'good', ['', ...d.goods], d.autoOrder,
        (key) => key ? good(key) : tr('Aus', 'Off')) + submit(tr('Profil speichern', 'Save profile')) + '</form>' : '') +
      d.orders.map((row) => '<article class="fe-row"><strong>' + esc(row.id === 'pilot' ? name('pilot') : row.id) +
        '</strong><p>' + esc(good(row.good) + ' · ' + stock(row.received) + ' / ' +
          n(row.amount) + ' · ' + row.reward + ' Credits · ' + name(row.region) +
          (row.rail ? ' · ' + tr('Bahnankunft', 'Rail arrival') : '')) + '</p>' +
        (row.complete ? '<p>' + tr('Erfüllt', 'Fulfilled') + '</p>' : '<div class="fe-actions">' +
          send(row.active ? tr('Auftrag zurückgeben', 'Return order') : tr('Auftrag annehmen', 'Accept order'),
            { type: row.active ? 'return' : 'accept', id: row.id }) +
          (row.active && !row.rail && row.region === region.id ? send(tr('Vom Hoflager liefern', 'Deliver from yard'),
            { type: 'deliver', region: region.id, good: row.good, scope: row.scope, order: row.id }, dockBusy(region.id)) : '') + '</div>') + '</article>').join(''));
  }

  function blueprints() {
    const permit = d.research.some(({ id, complete }) => id === 'blueprint' && complete);
    return section(tr('Blaupausen', 'Blueprints'), permit ? '<p>' + tr('Wähle Maschinen im Inspektor. Der Wiederaufbau kostet den vollen Baupreis.',
      'Select machines in the inspector. Rebuilding costs the full construction price.') + '</p>' +
      '<form data-fe-form="blueprint"><label>' + tr('Name', 'Name') + '<input name="name" maxlength="36" required></label>' +
      '<p>' + ui.selection.length + ' ' + tr('ausgewählt', 'selected') + '</p>' + submit(tr('Auswahl speichern', 'Save selection')) + '</form>' +
      d.blueprints.map((row, index) => '<article class="fe-row"><strong>' + esc(row.name) + '</strong>' +
        send(tr('An gewählter Kachel bauen', 'Build at selected tile'), { type: 'build-blueprint', index, x: ui.x, y: ui.y, region: region.id }) +
        send(tr('Blaupause entfernen', 'Remove blueprint'), { type: 'forget-blueprint', index }) + '</article>').join('') :
      '<p>' + tr('Erforsche zuerst Blaupausen.', 'Research blueprints first.') + '</p>');
  }

  const panels = [
    ['build', tr('Bau', 'Build'), buildingPanel],
    ['inspect', tr('Inspektor', 'Inspector'), inspection],
    ['material', tr('Material', 'Materials'), material],
    ['list', tr('Maschinen', 'Machines'), () => section(tr('Maschinen und Durchsatz', 'Machines and throughput'), nodes.map((n) =>
      '<div class="fe-row">' + local(nodeName(n), 'select:' + n.id) + '<span>' + esc(name(n.status)) + '</span></div>').join(''))],
  ];
  if (d.phase >= 3) panels.push(['power', tr('Strom', 'Power'), () => section(tr('Leistung je Netz', 'Power per grid'),
    (d.power.filter((row) => row.region === region.id).map((row) => '<article class="fe-row"><strong>' +
      esc(tr('Netz ', 'Grid ') + row.id) + '</strong><p>' + row.used + ' / ' + row.supply + ' MW · ' +
      row.demand + ' MW ' + tr('Bedarf', 'demand') + '</p></article>').join('') || '<p>' + tr('Kein Stromnetz in dieser Region.', 'No power grid in this region.') + '</p>'))],
  ['research', tr('Forschung', 'Research'), technology], ['orders', tr('Aufträge', 'Orders'), orderBoard]);
  if (d.phase >= 4) panels.push(['rail', tr('Regionen und Bahn', 'Regions and rail'), logistics]);
  if (d.phase === 5) panels.push(['plans', tr('Blaupausen', 'Blueprints'), blueprints]);
  const panel = panels.find(([id]) => id === ui.panel) ?? panels[0];
  const power = d.power.filter((row) => row.region === region.id);
  const ramp = d.phase === 1 ?
    tr('Fördere Eisenerz von Hand und verkaufe es am Dock. Ein Bohrer auf Kachel 9/5 mit Auslass nach Osten kann das auch automatisch.',
      'Mine iron ore by hand and sell it at the dock. A drill on tile 9/5 with its outlet facing east can do this automatically.') :
    !d.record.beltBottleneckShown && d.phase === 2 ?
    tr('Ein förderndes Band prüfen. Bei 5/s von 10/s hilft ein zweiter Weg oder später Mk2.', 'Inspect a working conveyor. At 5/s from 10/s, add a second path or research Mk2 later.') :
    d.phase >= 4 ? tr('Verladen und anliefern. Aufträge zählen bei Ankunft, leere oder stromlose Strecken transportieren nichts.',
      'Load and deliver. Orders count on arrival, and empty or unpowered routes carry nothing.') :
      tr('Prüfe Ausrichtung, Bestände und Anschluss. Bei Stau Lager ausbauen oder am Dock verkaufen.',
        'Check direction, stock and connections. When blocked, add storage or sell at the dock.');
  return '<dl class="fe-stats">' + stat('Credits', stock(d.free)) +
    (d.scope || d.phase === 1 ? stat(name(d.scope ?? 'line'), stock(d.reserve)) : '') +
    stat(tr('Verkaufserlös', 'Sales receipts'), stock(d.revenue) + ' Credits') +
    stat(tr('Verkäufe im nächsten Takt', 'Sales next tick'), stock(d.salesRate) + ' Credits') +
    (d.phase >= 3 ? stat(tr('Strom hier', 'Power here'), power.reduce((n, g) => n + g.used, 0) + ' / ' + power.reduce((n, g) => n + g.supply, 0) + ' MW') : '') +
    '</dl><div class="fe-workspace"><div class="fe-map-column">' + map() +
    progress() + section(tr('Engpass und Abhilfe', 'Bottleneck and recovery'), '<p>' + ramp + '</p>' +
      (d.scope ? send(tr('Freie Credits binden', 'Reserve available credits'), { type: 'fund' }) : '') +
      (d.phase === 5 && d.eligible.length && !readonly ? local(tr('Industriepatente-Vorschau', 'Industry patent preview'), 'prestige') : '')) +
    '</div><aside><div role="tablist" aria-label="' + tr('Fabrikbereiche', 'Factory sections') + '" class="fe-tabs">' +
    panels.map(([id, label]) => '<button type="button" role="tab" id="fe-tab-' + id + '" data-fe-panel="' + id +
      '" aria-selected="' + (id === panel[0]) + '" aria-controls="fe-panel" tabindex="' + (id === panel[0] ? '0' : '-1') + '">' + esc(label) + '</button>').join('') +
    '</div><div id="fe-panel" role="tabpanel" aria-labelledby="fe-tab-' + panel[0] + '">' + panel[2]() + '</div></aside></div>';
}
