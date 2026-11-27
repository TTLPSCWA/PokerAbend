import { canSpin, evaluate, MACHINES, MACHINE_IDS, needsReset, reset, setBet, settle, spin, windowAt } from './slots-logic.js';
import { ID, newArcade, readArcade, recordSpin, writeArcade } from './slots-session.js';
import { key } from './storage.js';

const SYMBOLS = {
  cherry: ['●●', 'Kirschen', 'Cherries'], lemon: ['◒', 'Zitrone', 'Lemon'],
  bell: ['♟', 'Glocke', 'Bell'], star: ['✦', 'Stern', 'Star'], seven: ['7', 'Sieben', 'Seven'],
  bar: ['BAR', 'Balken', 'Bar'], neon7: ['7', 'Neon-Sieben', 'Neon seven'],
  robot: ['⊞', 'Roboter', 'Robot'], car: ['◢', 'Rennwagen', 'Race car'], vinyl: ['◎', 'Vinyl', 'Vinyl'],
  ace: ['A', 'Ass', 'Ace'], king: ['K', 'König', 'King'], queen: ['Q', 'Dame', 'Queen'],
  jack: ['J', 'Bube', 'Jack'], scatter: ['⚡', 'Scatter', 'Scatter'], wild: ['W', 'Wild', 'Wild'],
  dragon: ['♞', 'Drache', 'Dragon'], rune: ['ᛟ', 'Rune', 'Rune'], crystal: ['⬠', 'Kristall', 'Crystal'],
  chest: ['▣', 'Truhe', 'Chest'], sword: ['⚔', 'Schwerter', 'Swords'], shield: ['⛨', 'Schild', 'Shield'],
  gem: ['◆', 'Edelstein', 'Gem'], coin: ['◉', 'Goldmünze', 'Gold coin'],
};

const MACHINE_TEXT = {
  'lucky-sevens': ['Retro-Automat · 1 Linie', 'Retro cabinet · 1 line', '7'],
  'neon-nights': ['Neon-Automat · 10 Linien & Freispiele', 'Neon cabinet · 10 lines & free spins', '⚡'],
  'dragons-fortune': ['Fantasy-Automat · 243 Gewinnwege', 'Fantasy cabinet · 243 ways to win', '◆'],
};

const ODDS = {
  'lucky-sevens': '96.6',
  'neon-nights': '91.5',
  'dragons-fortune': '95.7',
};

const seed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const lockName = 'poker:singleplayer:slot-arcade';

export function mount(root, id, memory, ctx) {
  const { tx, esc } = ctx;
  const formatter = new Intl.NumberFormat(tx('de-DE', 'en-GB'));
  const number = n => formatter.format(n);
  let storage;
  try { storage = window.localStorage; } catch { /* This session can still be played. */ }
  const loaded = readArcade(storage);
  let arcade = loaded.state || memory?.arcade || newArcade(seed);
  let status = loaded.status;
  let working = false;
  let rolling = false;
  let closed = false;
  let timer;
  let audio;
  let showing;
  let resultMessage = '';
  const signals = new AbortController();
  const listen = (target, event, callback) => target.addEventListener(event, callback, {signal: signals.signal});
  const find = selector => root.querySelector(selector);
  const cabinet = () => MACHINES[arcade.selected];
  const current = () => arcade.machines[arcade.selected];
  const damagedSave = () => status === 'corrupt' || status === 'version';
  const label = symbol => tx(...SYMBOLS[symbol].slice(1));
  const balanceLabel = () => tx('Spielchips', 'Play chips');

  function baseFrame() {
    const m = cabinet();
    const last = arcade.histories[m.id][0];
    const draw = windowAt(m, last?.stops || Array(m.reels).fill(0));
    const wins = last ? evaluate(m, draw).wins : [];
    return { draw, wins };
  }

  function announce(message) {
    resultMessage = message;
    const element = find('[data-slot-live]');
    if (element) element.textContent = message;
  }

  function save() {
    status = writeArcade(storage, arcade) ? 'saved' : 'unavailable';
  }

  function selectView(resetFrame = false) {
    if (resetFrame || !showing) showing = baseFrame();
    const machine = cabinet();
    const player = current();
    const checked = value => value ? 'checked' : '';
    find('[data-slot-panel]').innerHTML = `
      <div class="slot-console" data-machine="${machine.id}">
        <header class="slot-marquee">
          <h2>${esc(machine.name)}</h2>
          <span>${esc(tx(...MACHINE_TEXT[machine.id].slice(0, 2)))}</span>
        </header>
        <div class="slot-play">
          <div class="slot-reels" data-slot-reels role="group" aria-label="${tx('Walzen', 'Reels')}"></div>
          <div class="slot-actions">
            <label>${tx('Einsatz', 'Bet')}
              <select data-slot-bet>
                ${machine.bets.map(value => `<option value="${value}" ${value === player.bet ? 'selected' : ''}>${number(value)}</option>`).join('')}
              </select>
            </label>
            <button type="button" class="slot-spin" data-slot-spin>${tx('Drehen', 'Spin')}</button>
          </div>
          <p class="slot-message" data-slot-live role="status" aria-atomic="true"></p>
          <p class="slot-message" data-slot-error role="status"></p>
          <button class="btn slot-secondary" type="button" data-slot-refill hidden>${tx('Kostenlos auffüllen', 'Refill for free')}</button>
          <button class="btn slot-secondary" type="button" data-slot-recover hidden>${tx('Beschädigten Spielstand zurücksetzen', 'Reset incompatible save')}</button>
        </div>
        <aside class="slot-aside">
          <div class="slot-balance">
            <span>${balanceLabel()}</span>
            <strong data-slot-balance></strong>
          </div>
          <dl class="slot-metrics">
            <div><dt>${tx('Drehungen', 'Spins')}</dt><dd data-slot-spins></dd></div>
            <div><dt>${tx('Größter Gewinn', 'Best win')}</dt><dd data-slot-best></dd></div>
            <div><dt>${tx('Bonus-Runden', 'Bonus rounds')}</dt><dd data-slot-bonuses></dd></div>
          </dl>
          <div data-slot-wins class="slot-wins"></div>
        </aside>
      </div>
      <div class="slot-detail-grid">
        <details class="sp-details">
          <summary>${tx('Gewinnregeln und Tabelle', 'Rules and payouts')}</summary>
          ${rules(machine)}
        </details>
        <details class="sp-details">
          <summary>${tx('Letzte Drehungen und Einstellungen', 'Recent spins and settings')}</summary>
          <ol class="slot-history" data-slot-history></ol>
          <label class="slot-setting">${tx('Lautstärke', 'Volume')} <input type="range" min="0" max="100" step="5" value="${arcade.volume}" data-slot-volume></label>
          <label class="sp-check slot-setting"><input type="checkbox" data-slot-quiet ${checked(arcade.quiet)}> ${tx('Animationen reduzieren', 'Reduce animations')}</label>
        </details>
      </div>`;
    find('[data-slot-reels]').style.setProperty('--slot-columns', machine.reels);
    [...root.querySelectorAll('[data-slot-machine]')].forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.slotMachine === machine.id));
    });
    paintFrame(showing);
    paintStatus();
    announce(resultMessage);
  }

  function rules(machine) {
    const general = tx('Gewertet wird von links. Der Tabellensatz gilt je Linie beziehungsweise Gewinnweg.',
      'Wins start on the left. The paytable applies per line or winning way.');
    const rulesById = {
      'lucky-sevens': tx('Nur die mittlere Linie zählt. Zwei Kirschen von links reichen für einen Gewinn.',
        'Only the middle line counts. Two cherries from the left already pay.'),
      'neon-nights': tx('Zehn Linien. Wild ersetzt normale Symbole. Drei bis fünf Scatter-Walzen gewähren 7, 10 oder 16 Freispiele mit ×2.',
        'Ten lines. Wild substitutes for regular symbols. Three to five scatter reels award 7, 10 or 16 free spins at ×2.'),
      'dragons-fortune': tx('Bis zu 3⁵ = 243 Wege. Treffer je Walze werden multipliziert. Drei bis fünf Scatter-Walzen gewähren 4, 6 oder 10 Freispiele mit steigendem ×1 bis ×5.',
        'Up to 3⁵ = 243 ways. Matches per reel multiply. Three to five scatter reels award 4, 6 or 10 free spins with rising ×1 to ×5.'),
    };
    const scatter = machine.scatter ? `<p>${tx('Scatter zahlt auf den Gesamteinsatz. Freispiele lösen keine neuen Freispiele aus.',
      'Scatter pays on the full bet. Free spins do not retrigger.')}</p>` : '';
    return `<p>${rulesById[machine.id]} ${general}</p>
      <p>${tx('Berechnete Auszahlungsquote', 'Calculated return')}: ${number(Number(ODDS[machine.id]))} %. ${tx('Der Linieneinsatz ist der Gesamteinsatz geteilt durch', 'The unit wager is the total bet divided by')} ${machine.divisor}.</p>${scatter}
      <ul class="slot-paytable">${Object.entries(machine.pays).map(([sym, pays]) =>
        `<li><b>${label(sym)}</b> ${Object.entries(pays).map(([count, value]) => `${count} → ×${value}`).join(' · ')}</li>`
      ).join('')}</ul>`;
  }

  function paintFrame({ draw, wins }, reveal = true) {
    const grid = find('[data-slot-reels]');
    const lit = new Set(reveal ? wins.flatMap(win => win.positions.map(pair => pair.join(':'))) : []);
    grid.innerHTML = draw.map((reel, column) =>
      `<div class="slot-reel" style="--slot-delay:${column * 18}ms">${reel.map((symbol, row) => {
        const icon = SYMBOLS[symbol][0];
        return `<div class="slot-symbol${lit.has([column, row].join(':')) ? ' is-win' : ''}" data-symbol="${symbol}">
          <span aria-hidden="true">${icon}</span><span class="slot-sr">${label(symbol)}</span>
        </div>`;
      }).join('')}</div>`
    ).join('');
    if (!reveal) {
      find('[data-slot-wins]').textContent = '';
      return;
    }
    const visibleWins = wins.slice(0, 10);
    find('[data-slot-wins]').innerHTML = visibleWins.length ? `<h3>${tx('Gewinntreffer', 'Winning combinations')}</h3><ul>${visibleWins.map(win =>
      `<li>${win.line === undefined ? `${win.ways} ${tx('Wege', 'ways')}` : `${tx('Linie', 'Line')} ${win.line + 1}`} · ${win.count} × ${label(win.symbol)}</li>`
    ).join('')}</ul>` : '';
  }

  function paintStatus() {
    const player = current();
    find('[data-slot-balance]').textContent = number(player.balance);
    find('[data-slot-spins]').textContent = number(player.stats.spins);
    find('[data-slot-best]').textContent = number(player.stats.biggestWin);
    find('[data-slot-bonuses]').textContent = number(player.stats.bonusRounds);
    find('[data-slot-bet]').value = String(player.bet);
    find('[data-slot-bet]').disabled = rolling || damagedSave();
    find('[data-slot-spin]').disabled = damagedSave() || (!working && !canSpin(player));
    find('[data-slot-spin]').setAttribute('aria-disabled', String(working || !canSpin(player) || damagedSave()));
    find('[data-slot-spin]').textContent = rolling ? tx('Walzen laufen', 'Reels spinning') : tx('Drehen', 'Spin');
    find('[data-slot-refill]').hidden = !needsReset(player) || rolling || damagedSave();
    find('[data-slot-recover]').hidden = !damagedSave();
    find('[data-slot-error]').textContent = damagedSave()
      ? tx('Der gespeicherte Stand konnte nicht geladen werden. Du kannst ihn ausdrücklich zurücksetzen.', 'The saved game could not be loaded. You can explicitly reset it.')
      : status === 'unavailable'
        ? tx('Browser-Speicher nicht verfügbar. Dieser Stand gilt nur in diesem Tab.', 'Browser storage unavailable. Progress stays in this tab.')
        : !canSpin(player) && !needsReset(player) && !working
          ? tx('Wähle einen kleineren Einsatz.', 'Choose a smaller bet.')
          : '';
    const history = arcade.histories[player.machine];
    find('[data-slot-history]').innerHTML = history.length ? history.map(row =>
      `<li>#${number(row.id)} · ${tx('Einsatz', 'Bet')} ${number(row.bet)} · ${tx('Gewinn', 'Payout')} ${number(row.total)}</li>`
    ).join('') : `<li>${tx('Noch keine Drehung.', 'No spins yet.')}</li>`;
  }

  function sound(result) {
    if (!audio || arcade.volume === 0 || audio.state !== 'running') return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    const start = audio.currentTime;
    oscillator.frequency.setValueAtTime(result ? 480 : 150, start);
    oscillator.frequency.exponentialRampToValueAtTime(result ? 760 : 100, start + 0.12);
    gain.gain.setValueAtTime(0.06 * arcade.volume / 100, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.20);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.21);
  }

  function armSound() {
    if (!arcade.volume || !window.AudioContext) return;
    try {
      audio ||= new window.AudioContext();
      audio.resume().catch(() => {});
    } catch { /* The visual result remains available. */ }
  }

  function finish(result) {
    rolling = false;
    settle(current());
    find('[data-slot-reels]').classList.remove('is-rolling');
    paintFrame(showing);
    paintStatus();
    sound(result.total > 0);
    const bonus = result.free.length ? ` · ${result.free.length} ${tx('Freispiele', 'free spins')}` : '';
    announce(`${tx('Auszahlung', 'Payout')} ${number(result.total)} ${balanceLabel()} — ${tx('Einsatz', 'bet')} ${number(result.bet)}${bonus}`);
  }

  function animate(result) {
    const reduced = arcade.quiet || ctx.calm() || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames = [{window: result.window, wins: result.wins}, ...result.free];
    let index = 0;
    const show = entry => ({draw: entry.window, wins: entry.wins});
    if (reduced) {
      showing = show(frames.at(-1));
      finish(result);
      return;
    }
    rolling = true;
    paintStatus();
    const grid = find('[data-slot-reels]');
    grid.classList.add('is-rolling');
    function step() {
      if (closed) return;
      const next = frames[index++];
      showing = show(next);
      paintFrame(showing, true);
      if (index === frames.length) {
        finish(result);
      } else {
        announce(`${tx('Freispiel', 'Free spin')} ${index}/${result.free.length} · ×${frames[index].multiplier}`);
        timer = setTimeout(step, 200);
      }
    }
    announce(tx('Drehung läuft.', 'Spinning.'));
    timer = setTimeout(step, 480);
  }

  async function change(action) {
    if (working || rolling || closed) return;
    working = true;
    paintStatus();
    const apply = () => {
      if (closed) return null;
      if (status !== 'unavailable') {
        const latest = readArcade(storage);
        if (latest.state) arcade = latest.state;
        status = latest.status;
      }
      const answer = action();
      if (answer) save();
      return answer;
    };
    try {
      return await (navigator.locks?.request ? navigator.locks.request(lockName, apply) : apply());
    } finally {
      working = false;
      if (!closed) paintStatus();
    }
  }

  async function click(event) {
    const button = event.target.closest('button');
    if (!button || working || rolling || closed) return;
    const target = button.dataset.slotMachine;
    const viewed = arcade.selected;
    if (target && MACHINE_IDS.includes(target)) {
      if (!damagedSave()) await change(() => { arcade.selected = target; return true; });
      if (!closed) {
        resultMessage = '';
        selectView(true);
      }
    } else if (button.hasAttribute('data-slot-spin')) {
      armSound();
      const result = await change(() => {
        if (damagedSave() || arcade.selected !== viewed) return null;
        const result = spin(current());
        if (result) recordSpin(arcade, result);
        return result;
      });
      if (closed) return;
      if (result) {
        ctx.recent();
        animate(result);
      } else {
        selectView(true);
      }
    } else if (button.hasAttribute('data-slot-refill')) {
      const ok = await change(() => !damagedSave() && arcade.selected === viewed && reset(current()));
      if (ok && !closed) {
        announce(tx('1.000 kostenlose Spielchips gutgeschrieben.', '1,000 free play chips added.'));
        find('[data-slot-spin]').focus();
      }
    } else if (button.hasAttribute('data-slot-recover')) {
      const ok = await change(() => {
        if (!damagedSave()) return false;
        arcade = newArcade(seed);
        return true;
      });
      if (ok && !closed) selectView(true);
    }
  }

  async function edit(event) {
    if (working || rolling || damagedSave()) return;
    const field = event.target;
    const value = field.value;
    const checked = field.checked;
    const viewed = arcade.selected;
    await change(() => {
      if (damagedSave() || arcade.selected !== viewed) return false;
      if (field.hasAttribute('data-slot-bet')) return setBet(current(), Number(value));
      if (field.hasAttribute('data-slot-quiet')) {
        arcade.quiet = checked;
        return true;
      }
      if (field.hasAttribute('data-slot-volume')) {
        arcade.volume = Number(value);
        return true;
      }
      return false;
    });
    if (!closed && arcade.selected !== viewed) selectView(true);
  }

  root.innerHTML = `<section class="singleplayer slot-arcade" data-solo="${ID}" aria-label="Slot Arcade">
    <header class="slot-header">
      <a href="#spiele/einzelspieler">‹ ${tx('Einzelspieler', 'Single player')}</a>
      <h1>Slot Arcade</h1>
      <p>${tx('Drei Automaten mit kostenlosen virtuellen Spielchips ohne Geldwert.', 'Three cabinets with free virtual play chips of no monetary value.')}</p>
    </header>
    <nav class="slot-choices" aria-label="${tx('Automat wählen', 'Choose a cabinet')}">
      ${MACHINE_IDS.map(machine => `<button class="slot-choice" data-slot-machine="${machine}" type="button" aria-pressed="false"><span aria-hidden="true">${MACHINE_TEXT[machine][2]}</span><b>${esc(MACHINES[machine].name)}</b><small>${esc(tx(...MACHINE_TEXT[machine].slice(0, 2)))}</small></button>`).join('')}
    </nav>
    <div data-slot-panel></div>
  </section>`;
  listen(root, 'click', event => { click(event).catch(() => announce(tx('Aktion konnte nicht ausgeführt werden.', 'Action could not be completed.'))); });
  listen(root, 'change', event => { edit(event).catch(() => announce(tx('Einstellung konnte nicht gespeichert werden.', 'Could not save settings.'))); });
  listen(window, 'storage', event => {
    if (event.key !== key(id) || working || rolling || closed) return;
    const incoming = readArcade(storage);
    status = incoming.status;
    if (incoming.state) arcade = incoming.state;
    selectView(true);
  });
  selectView(true);
  return {
    destroy() {
      closed = true;
      signals.abort();
      clearTimeout(timer);
      settle(current());
      audio?.close().catch(() => {});
      return {arcade};
    },
  };
}
