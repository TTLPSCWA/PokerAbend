import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const live = path.join(root, '.agent-coordination');
const mutex = path.join(live, 'write.lock');
const stateFile = path.join(live, 'state.json');
const markdown = path.join(live, 'AKTUELL.md');
const gate = '@git';
const envRun = 'POKERABEND_COORDINATION_RUN';
const types = ['START', 'INFO', 'QUESTION', 'BLOCKED', 'HANDOFF', 'WARN', 'DONE'];
const kinds = ['NACHRICHT', 'ENTSCHEIDUNG', 'TEST', 'COMMIT', 'OFFEN'];

function fail(message) { throw new Error(message); }
function stat(file) {
  try { return fs.lstatSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const now = () => new Date().toISOString();
const ownerKey = (owner) => owner.agent + '/' + owner.task;
const own = (entry, owner) => entry?.agent === owner.agent && entry?.task === owner.task;
const covers = (a, b) => a === b || b.startsWith(a + '/');
const overlaps = (a, b) => covers(a, b) || covers(b, a);

function atomicWrite(file, text, exclusive = false) {
  const temporary = path.join(path.dirname(file), '.coord-' + randomUUID() + '.tmp');
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx');
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    if (exclusive) fs.linkSync(temporary, file);
    else fs.renameSync(temporary, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (stat(temporary)) fs.unlinkSync(temporary);
  }
}

async function locked(action) {
  if (!stat(live)?.isDirectory()) fail('Koordinationsordner fehlt oder ist eine Verknüpfung. Erst init ausführen.');
  const deadline = Date.now() + 8000;
  for (;;) {
    try { fs.mkdirSync(mutex); break; }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) fail('Protokollsperre belegt. write.lock/owner.json und Wiederherstellungsanleitung prüfen.');
      await sleep(30 + Math.random() * 40);
    }
  }
  const ownerFile = path.join(mutex, 'owner.json');
  try {
    fs.writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, since: now() }), { flag: 'wx' });
    return action();
  } finally {
    if (stat(ownerFile)) fs.unlinkSync(ownerFile);
    fs.rmdirSync(mutex);
  }
}

function read() {
  if (!stat(live)?.isDirectory() || !stat(stateFile)?.isFile()) fail('Zustand fehlt. Erst init ausführen oder die Sicherung prüfen.');
  const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (data.schema !== 1 || ![data.claims, data.events, data.archives].every(Array.isArray)) fail('Unbekanntes Zustandsformat.');
  return data;
}

function escape(value) {
  return value.replace(/[&<>\x60|]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\x60': '&#96;', '|': '&#124;' })[c]);
}

function lines(events) {
  return events.map((e) => '- ' + [e.at, e.agent, e.task, e.type, e.kind, escape(e.text),
    ...(e.refs.length ? ['Bezug: ' + e.refs.map(escape).join(', ')] : [])].join(' · ')).join('\n') || '- Keine.';
}

function currentTasks(events) {
  const tasks = new Map();
  for (const e of events) {
    const key = ownerKey(e);
    const item = tasks.get(key) ?? { start: e.at };
    const statuses = { START: 'aktiv', CLAIM: 'aktiv', BLOCKED: 'blockiert', HANDOFF: 'übergeben', DONE: 'abgeschlossen' };
    if (statuses[e.type]) item.status = statuses[e.type];
    tasks.set(key, item);
  }
  return tasks;
}

function render(data) {
  const active = [...currentTasks(data.events)].filter(([, t]) => ['aktiv', 'blockiert'].includes(t.status));
  const activities = active.map(([key, t]) => {
    const files = data.claims.filter((c) => ownerKey(c) === key).map((c) => escape(c.path));
    return '- ' + [key, t.start, t.status, files.join(', ') || 'keine Reservierung'].join(' · ');
  });
  const claims = data.claims.map((c) => '- ' + [escape(c.path), ownerKey(c), c.at].join(' · '));
  if (data.gitRun) claims.push('- Git läuft: ' + data.gitRun.action + ' · ' + ownerKey(data.gitRun) + ' · ' + data.gitRun.at);
  const bulletList = (entries) => entries.join('\n') || '- Keine.';
  return '# Agentenkoordination · Live\n\nErzeugt durch agent-koordination.mjs. Änderungen über das Skript vornehmen.\n\n'
    + '## Aktive Aufgaben\n\n' + bulletList(activities) + '\n\n## Dateireservierungen und Git\n\n' + bulletList(claims)
    + '\n\n## Gemeinsame Nachrichten (chronologisch)\n\n' + lines(data.events)
    + '\n\n## Entscheidungen und Einschränkungen\n\n' + lines(data.events.filter((e) => ['ENTSCHEIDUNG', 'OFFEN'].includes(e.kind)))
    + '\n\n## Abschluss, Tests, Commits und Übergaben\n\n'
    + lines(data.events.filter((e) => ['DONE', 'HANDOFF'].includes(e.type) || ['TEST', 'COMMIT'].includes(e.kind)))
    + '\n\n## Archive\n\n' + bulletList(data.archives.map((a) => '- ' + a.task + ' · ' + a.at + ' · ' + a.file)) + '\n';
}

function persist(data) {
  atomicWrite(stateFile, JSON.stringify(data, null, 2) + '\n');
  atomicWrite(markdown, render(data));
}

function scope(input) {
  if (input === gate) return gate;
  const normalized = input.replaceAll('\\', '/').replace(/\/$/, '').normalize('NFC');
  if (/#L\d+(?:-L?\d+)?$/i.test(normalized)) fail('Ungültiger Pfad: Datei ohne Zeilenbereich angeben.');
  const segments = normalized.split('/');
  if (segments.some((part) => !part || /[<>:"|?*\x00-\x1f]/.test(part) || /[ .]$/.test(part)
      || /~\d/i.test(part) || /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part))) {
    fail('Ungültiger Repository-Pfad: ' + input);
  }
  if (['.git', '.agent-coordination'].includes(segments[0].toLowerCase())) fail('Interner Pfad: ' + input);
  let prefix = root;
  for (const part of segments) {
    prefix = path.join(prefix, part);
    const item = stat(prefix);
    if (!item) break;
    if (item.isSymbolicLink() || (item.isFile() && item.nlink > 1) || fs.realpathSync(prefix).toLowerCase() !== prefix.toLowerCase()) {
      fail('Verknüpfung oder Pfadalias ist nicht reservierbar: ' + input);
    }
  }
  return normalized.toLowerCase();
}

function shared(name) {
  const files = ['package.json', 'package-lock.json', 'changelog.md', 'readme.md', 'docs/betrieb.md', 'games/planned.js'];
  return files.some((file) => overlaps(file, name)) || overlaps('docs/roadmap', name)
    || overlaps('docs/backlog', name) || /roadmap/.test(name) || covers(name, 'docs/design');
}

function addEvent(data, owner, type, text, refs = [], kind = 'NACHRICHT') {
  data.events.push({ at: now(), ...owner, type, kind, text, refs });
}

function requireOpen(data, owner) {
  if (data.archives.some((a) => a.task === owner.task)) fail('Auftrag archiviert. Neue Auftrags-ID wählen.');
}

function check(data, owner, names, requireOwnership) {
  const exclusive = data.claims.find((c) => c.path === gate);
  if (exclusive && !own(exclusive, owner)) fail('Git-/Release-Bereich blockiert Schreibarbeit: ' + ownerKey(exclusive));
  if (data.gitRun) fail('Git-Operation läuft: ' + data.gitRun.action);
  for (const name of names) {
    const foreign = data.claims.find((c) => !own(c, owner) && (name === gate || overlaps(c.path, name)));
    if (foreign) fail(name + ' kollidiert mit ' + foreign.path + ' (' + ownerKey(foreign) + ').');
    if (name !== gate && shared(name) && !own(exclusive, owner)) fail('Zuerst @git reservieren: ' + name);
    if (requireOwnership && !data.claims.some((c) => own(c, owner) && covers(c.path, name))) fail('Eigene Reservierung fehlt: ' + name);
  }
}

function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) fail(result.error?.message || result.stderr?.trim() || 'Git fehlgeschlagen: ' + args[0]);
  return result.stdout;
}

function checkRoot() {
  if (fs.realpathSync(git(['rev-parse', '--show-toplevel']).trim()) !== root) fail('Das Skript muss im Stamm seiner Git-Arbeitskopie liegen.');
}

function staged(data, owner) {
  const names = git(['diff', '--cached', '--no-renames', '--name-only', '-z']).split('\0').filter(Boolean).map(scope);
  if (!names.length) fail('Keine gestagten Dateien.');
  for (const name of names) {
    if (!data.claims.some((c) => own(c, owner) && covers(c.path, name))) fail('Fremde oder nicht reservierte Datei im Index: ' + name);
  }
}

function unpublished(data, owner) {
  const commits = git(['rev-list', 'origin/main..HEAD']).trim().split('\n').filter(Boolean);
  if (commits.some((sha) => !data.events.some((event) => event.kind === 'COMMIT' && own(event, owner) && event.refs.includes(sha) && event.generated))) {
    fail('Unveröffentlichte Commits gehören nicht vollständig zu diesem Auftrag. Übergabe und Remote-Stand prüfen.');
  }
  return commits;
}

function commandFor(data, owner, action, args) {
  checkRoot();
  if (git(['branch', '--show-current']).trim() !== 'main' && action !== 'rebase-abort') fail('Git-Operation nur auf main.');
  if (['pull', 'merge', 'rebase'].includes(action) && git(['status', '--porcelain', '--untracked-files=all']).trim()) {
    fail('Für die Integration muss die Arbeitskopie einschließlich Index sauber sein.');
  }
  if (action === 'add' || action === 'add-executable') {
    const names = args.map(scope);
    if (!names.length || names.includes(gate) || args.some((f) => stat(path.join(root, f))?.isDirectory())) fail('Explizite einzelne Dateipfade zum Stagen angeben.');
    check(data, owner, names, true);
    return ['--literal-pathspecs', 'add', ...(action === 'add-executable' ? ['--chmod=+x'] : []),
      '--', ...args.map((name) => name.replaceAll('\\', '/'))];
  }
  if (action === 'commit') {
    if (args.length !== 1 || !args[0].trim()) fail('Genau einen Commit-Betreff angeben.');
    git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
    unpublished(data, owner);
    staged(data, owner);
    return ['commit', '-m', args[0]];
  }
  if (args.length) fail('Diese Git-Aktion akzeptiert keine zusätzlichen Argumente.');
  if (action === 'push') {
    const head = git(['rev-parse', 'HEAD']).trim();
    git(['merge-base', '--is-ancestor', 'origin/main', head]);
    unpublished(data, owner);
    return ['push', '--no-follow-tags', 'origin', head + ':refs/heads/main'];
  }
  if (action === 'rebase') unpublished(data, owner);
  const commands = {
    fetch: ['fetch', 'origin', 'main'],
    pull: ['pull', '--no-rebase', '--ff-only', 'origin', 'main'],
    merge: ['merge', '--ff-only', 'origin/main'],
    rebase: ['rebase', 'origin/main'],
    'rebase-abort': ['rebase', '--abort'],
  };
  return Object.hasOwn(commands, action) ? commands[action] : fail('Git-Aktion nicht zulässig.');
}

async function runGit(owner, action, args) {
  const token = randomUUID();
  const command = await locked(() => {
    const data = read();
    requireOpen(data, owner);
    check(data, owner, [gate], true);
    const command = commandFor(data, owner, action, args);
    data.gitRun = { ...owner, action, token, pid: process.pid, at: now() };
    addEvent(data, owner, 'INFO', 'Git-Aktion begonnen: ' + action);
    persist(data);
    return command;
  });
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const child = spawn('git', command, { cwd: root, stdio: 'inherit', env: { ...process.env, [envRun]: token } });
      child.on('error', reject);
      child.on('close', (code, signal) => resolve(code ?? signal));
    });
  } finally {
    await locked(() => {
      const data = read();
      if (data.gitRun?.token !== token) fail('Laufende Git-Reservierung wurde extern verändert.');
      delete data.gitRun;
      addEvent(data, owner, result === 0 ? 'INFO' : 'WARN', 'Git-Aktion beendet: ' + action + ' (' + (result ?? 'Startfehler') + ')');
      if (result === 0 && ['commit', 'rebase'].includes(action)) {
        const refs = action === 'commit' ? [git(['rev-parse', 'HEAD']).trim()] : git(['rev-list', 'origin/main..HEAD']).trim().split('\n').filter(Boolean);
        if (refs.length) {
          addEvent(data, owner, 'INFO', 'Git hat Commits erzeugt (' + action + ').', refs, 'COMMIT');
          data.events.at(-1).generated = true;
        }
      }
      persist(data);
    });
  }
  if (result !== 0) fail('Git-Aktion fehlgeschlagen: ' + action);
}

function hook(name) {
  const data = read();
  const run = data.gitRun;
  if (!run || run.token !== process.env[envRun] || !data.claims.some((c) => c.path === gate && own(c, run))) {
    fail('Git-Hook: Koordinationsskript und eigene @git-Reservierung verwenden.');
  }
  if (name === 'pre-commit' && run.action === 'commit') staged(data, run);
  else if (name !== 'pre-push' || run.action !== 'push') fail('Git-Hook: Aktion stimmt nicht mit der laufenden Reservierung überein.');
}

function archive(data, owner) {
  if (data.archives.some((a) => a.task === owner.task)) return;
  const events = data.events.filter((e) => e.task === owner.task);
  const tasks = currentTasks(events);
  if (tasks.get(ownerKey(owner))?.status !== 'abgeschlossen') fail('Vor dem Archivieren DONE protokollieren.');
  if ([...tasks.values()].some((t) => ['aktiv', 'blockiert'].includes(t.status))) fail('Andere Beteiligte müssen abschließen oder übergeben.');
  if (data.claims.some((c) => c.task === owner.task || c.path === gate) || data.gitRun) fail('Vor dem Archivieren Auftrags- und Git-Reservierungen freigeben.');
  const generated = events.filter((e) => e.generated).flatMap((e) => e.refs);
  if (generated.length && git(['rev-list', 'origin/main..HEAD']).trim().split('\n').some((sha) => generated.includes(sha))) {
    fail('Auftrag hat noch unveröffentlichte Commits.');
  }
  const file = 'docs/agents/sessions/' + owner.task + '.md';
  const name = scope(file);
  if (data.claims.some((c) => overlaps(c.path, name))) fail('Archivpfad ist anderweitig reserviert.');
  const at = events.at(-1).at;
  const target = path.join(root, file);
  const people = [...new Set(events.map((e) => e.agent))].sort();
  const content = '# Auftrag ' + owner.task + '\n\n- Beginn (UTC): ' + events[0].at
    + '\n- Ende (UTC): ' + at + '\n- Beteiligte: ' + people.join(', ') + '\n\n'
    + '## Vollständiger Verlauf\n\n' + lines(events) + '\n\n## Entscheidungen, Tests, Commits und offene Punkte\n\n'
    + lines(events.filter((e) => e.kind !== 'NACHRICHT' || ['DONE', 'HANDOFF', 'BLOCKED'].includes(e.type))) + '\n';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!stat(target)) atomicWrite(target, content, true);
  else if (!stat(target).isFile() || fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== content) fail('Archiv existiert mit anderem Inhalt: ' + file);
  data.archives.push({ task: owner.task, at, file });
  data.events = data.events.filter((e) => e.task !== owner.task);
}

function installHooks(data) {
  if (data.claims.length || data.gitRun) fail('Hooks erst im koordinierten Leerlauf aktivieren.');
  const setting = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
  if (setting.status === 0 && setting.stdout.trim() === '.githooks') return;
  const defaultHooks = path.resolve(root, git(['rev-parse', '--git-path', 'hooks']).trim());
  const activeHooks = stat(defaultHooks)?.isDirectory()
    && fs.readdirSync(defaultHooks).some((name) => !name.endsWith('.sample') && !name.startsWith('.'));
  if (setting.status !== 1 || activeHooks) {
    fail('Bestehende Git-Hooks beibehalten. Git-Wrapper verwenden oder Hooks manuell integrieren.');
  }
  git(['config', '--local', 'core.hooksPath', '.githooks']);
}

async function init(hooks) {
  checkRoot();
  try { fs.mkdirSync(live); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  return locked(() => {
    if (stat(stateFile)) {
      const data = read();
      atomicWrite(markdown, render(data));
      if (hooks) installHooks(data);
    } else {
      if (stat(markdown)) fail('state.json fehlt bei vorhandenem Live-Protokoll. Wiederherstellung prüfen.');
      const data = { schema: 1, claims: [], events: [], archives: [] };
      persist(data);
      if (hooks) installHooks(data);
    }
    console.log('Gemeinsame Arbeitskopie: ' + root);
  });
}

function note(data, owner, [type, message, ...refs]) {
  if (!types.includes(type) || !message?.trim()) fail('Nachrichtentyp und Text angeben.');
  let kind = 'NACHRICHT';
  if (refs[0] === '--kind') { refs.shift(); kind = refs.shift(); }
  if (!kinds.includes(kind) || [message, ...refs].some((s) => /[\x00-\x1f\x7f]/.test(s))) fail('Einzeilige Nachricht und gültigen Abschnitt angeben.');
  if (kind === 'COMMIT') {
    const hashes = refs.filter((ref) => /^[a-f0-9]{7,40}$/.test(ref));
    if (!hashes.length || hashes.some((hash) => git(['cat-file', '-t', hash]).trim() !== 'commit')) fail('COMMIT braucht einen tatsächlichen Git-Commit als Bezug.');
  }
  addEvent(data, owner, type, message, refs, kind);
}

function reserve(data, owner, action, args) {
  if (!args.length && action !== 'release') fail('Mindestens einen Pfad oder @git angeben.');
  const names = [...new Set(args.map(scope))];
  if (action === 'claim') {
    check(data, owner, names, false);
    for (const name of names) {
      if (data.claims.some((c) => c.path === name && own(c, owner))) continue;
      data.claims.push({ ...owner, path: name, at: now() });
      addEvent(data, owner, 'CLAIM', 'Reserviert', [name]);
    }
    return;
  }
  if (own(data.gitRun, owner)) fail('Während einer Git-Operation sind eigene Reservierungen gebunden.');
  const claims = data.claims.filter((c) => own(c, owner));
  if (names.some((name) => !claims.some((c) => c.path === name))) fail('Nur eigene exakte Reservierungen freigeben.');
  const remove = claims.filter((c) => !names.length || names.includes(c.path));
  if (remove.some((c) => c.path === gate)) {
    if (claims.some((c) => c.path !== gate && shared(c.path) && !remove.includes(c))) {
      fail('Gemeinsame Release-Dateien zusammen mit @git oder davor freigeben.');
    }
    if (['rebase-merge', 'rebase-apply', 'MERGE_HEAD'].some((file) => stat(path.resolve(root, git(['rev-parse', '--git-path', file]).trim())))) {
      fail('Git-Integration läuft noch. Vor Freigabe kontrolliert abschließen oder abbrechen.');
    }
  }
  data.claims = data.claims.filter((c) => !remove.includes(c));
  if (remove.length) addEvent(data, owner, 'RELEASE', 'Freigegeben', remove.map((c) => c.path));
}

async function main([action, agent, task, ...args]) {
  if (action === 'hook') return hook(agent);
  if (action === 'init' && (agent === undefined || (agent === '--hooks' && task === undefined))) return init(agent === '--hooks');
  if (action === 'status' && agent === undefined) return console.log('Gemeinsame Arbeitskopie: ' + root + '\n\n' + render(read()));
  if (!['claude', 'codex'].includes(agent) || !/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(task ?? '')) {
    fail('Befehle: init [--hooks], status, claim, check, note, release, archive, git. Agent und Auftrags-ID angeben.');
  }
  const owner = { agent, task };
  if (action === 'git') return runGit(owner, args[0], args.slice(1));
  return locked(() => {
    const data = read();
    if (action !== 'archive') requireOpen(data, owner);
    if (action === 'check') {
      if (!args.length) fail('Mindestens einen Pfad angeben.');
      check(data, owner, args.map(scope), true);
      return console.log('Reservierung geprüft.');
    }
    if (['claim', 'release'].includes(action)) reserve(data, owner, action, args);
    else if (action === 'note') note(data, owner, args);
    else if (action === 'archive' && !args.length) archive(data, owner);
    else fail('Unbekannter Befehl oder zusätzliche Argumente.');
    persist(data);
    console.log(action + ': ' + ownerKey(owner));
  });
}

try { await main(process.argv.slice(2)); }
catch (error) { console.error('Agentenkoordination: ' + error.message); process.exitCode = 1; }
