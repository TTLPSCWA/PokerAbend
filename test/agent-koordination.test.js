import test from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile, execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const exec = promisify(execFile);
const source = new URL('../scripts/agent-koordination.mjs', import.meta.url);

function sandbox(t, withRemote = false, preload = '') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pokerabend-coordination-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.match(path.basename(temp), /^pokerabend-coordination-/);
    fs.rmSync(temp, { recursive: true, force: true });
  });
  const repo = path.join(temp, 'repo');
  const remote = path.join(temp, 'remote.git');
  fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  const write = (name, content) => {
    fs.mkdirSync(path.dirname(path.join(repo, name)), { recursive: true });
    fs.writeFileSync(path.join(repo, name), content);
  };
  const cli = async (...args) => {
    try {
      const nodeArgs = preload ? ['--import', preload] : [];
      const { stdout, stderr } = await exec(process.execPath, [...nodeArgs, 'scripts/agent-koordination.mjs', ...args], { cwd: repo });
      return { code: 0, out: stdout + stderr };
    } catch (error) {
      return { code: error.code, out: (error.stdout || '') + (error.stderr || '') };
    }
  };
  const script = 'scripts/agent-koordination.mjs';
  write(script, fs.readFileSync(source));
  write('.gitignore', '/.agent-coordination/\n');
  if (withRemote) {
    git('config', 'user.name', 'Coordination Test');
    git('config', 'user.email', 'coordination@example.invalid');
    for (const hook of ['pre-commit', 'pre-push']) {
      const relative = '.githooks/' + hook;
      write(relative, fs.readFileSync(new URL('../' + relative, import.meta.url), 'utf8').replaceAll('\r\n', '\n'));
      fs.chmodSync(path.join(repo, relative), 0o755);
    }
    write('fremd.txt', 'base\n');
    write('eigen.txt', 'base\n');
    git('add', '--', script, '.gitignore', '.githooks', 'fremd.txt', 'eigen.txt');
    git('commit', '-m', 'Fixture');
    git('init', '--bare', '-b', 'main', remote);
    git('remote', 'add', 'origin', remote);
    git('push', '-u', 'origin', 'main');
  }
  const state = () => JSON.parse(fs.readFileSync(path.join(repo, '.agent-coordination/state.json'), 'utf8'));
  return { repo, git, write, cli, state, read: (name) => fs.readFileSync(path.join(repo, name), 'utf8') };
}
function ok(result) { assert.equal(result.code, 0, result.out); }
function denied(result, why) { assert.equal(result.code, 1, result.out); assert.match(result.out, why); }

test('concurrent init and messages preserve every event across Node invocations', async (t) => {
  const { cli, state, read } = sandbox(t);
  (await Promise.all([cli('init'), cli('init')])).forEach(ok);
  const sent = Array.from({ length: 20 }, (_, i) => 'Nachricht ' + i);
  (await Promise.all(sent.map((message, i) => cli('note', i % 2 ? 'codex' : 'claude', 'PARALLEL', 'INFO', message)))).forEach(ok);
  const events = state().events;
  assert.deepEqual(events.map((e) => e.text).sort(), sent.sort());
  assert.ok(events.every((e) => /^\d{4}-\d\d-\d\dT.*Z$/.test(e.at)));
  ok(await cli('init'));
  assert.deepEqual(state().events, events);
  for (const message of sent) assert.ok(read('.agent-coordination/AKTUELL.md').includes(message + '\n'));
});

test('atomic state replacement retries transient file locks without deleting the old state', async (t) => {
  const preload = `import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const rename = fs.renameSync;
let attempts = 0;
fs.renameSync = (from, to) => {
  if (process.argv[2] === 'note' && to.endsWith('state.json')) {
    const outcome = process.argv[6];
    const before = JSON.parse(fs.readFileSync(to, 'utf8'));
    if (before.events.length !== 0) throw Error('old state must remain installed');
    if (outcome !== 'transient' || ++attempts <= 2) {
      const code = outcome === 'fatal' ? 'EACCES' : 'EPERM';
      throw Object.assign(Error(code + ': injected replacement failure'), { code });
    }
  }
  return rename(from, to);
};
syncBuiltinESMExports();`;
  const fixture = sandbox(t, false, 'data:text/javascript,' + encodeURIComponent(preload));
  const { cli, state, repo } = fixture;
  ok(await cli('init'));
  const files = () => fs.readdirSync(path.join(repo, '.agent-coordination')).sort();
  const expected = ['AKTUELL.md', 'state.json'];
  denied(await cli('note', 'codex', 'LOCK', 'INFO', 'fatal'), /EACCES/);
  assert.deepEqual(state().events, []);
  assert.deepEqual(files(), expected);
  denied(await cli('note', 'codex', 'LOCK', 'INFO', 'persistent'), /EPERM/);
  assert.deepEqual(state().events, []);
  assert.deepEqual(files(), expected);
  ok(await cli('note', 'codex', 'LOCK', 'INFO', 'transient'));
  assert.deepEqual(state().events.map(event => event.text), ['transient']);
  assert.deepEqual(files(), expected);
});

test('exclusive file, path aliases, overlapping trees, different paths, and owner-only release', async (t) => {
  const { cli, state, write } = sandbox(t);
  ok(await cli('init'));
  write('public/board/one.js', 'one\ntwo\n');
  const results = await Promise.all([
    cli('claim', 'codex', 'A', 'public/board/one.js'),
    cli('claim', 'claude', 'B', 'PUBLIC\\board\\one.js'),
  ]);
  assert.deepEqual(results.map((r) => r.code).sort(), [0, 1]);
  assert.match(results.find((r) => r.code === 1).out, /kollidiert/);
  const [{ agent, task, path: file }] = state().claims;
  const [other, otherTask] = agent === 'codex' ? ['claude', 'B'] : ['codex', 'A'];
  denied(await cli('claim', other, otherTask, 'public/board', 'unrelated.txt'), /kollidiert/);
  assert.equal(state().claims.length, 1);
  denied(await cli('claim', other, otherTask, file + '#L2'), /kollidiert|Ungültiger/);
  denied(await cli('release', other, otherTask, file), /Nur eigene/);
  denied(await cli('claim', other, otherTask, '../out.txt'), /Ungültiger/);
  ok(await cli('claim', other, otherTask, 'public/unrelated.txt'));
  ok(await cli('check', agent, task, file));
  ok(await cli('release', agent, task, file));
  ok(await cli('claim', other, otherTask, 'public/board'));
  denied(await cli('claim', agent, task, 'public/board/deeper/new.js'), /kollidiert/);
  ok(await cli('check', other, otherTask, 'public/board/deeper/new.js'));
});

test('Git gate requires quiescence and blocks other edits but not communication', async (t) => {
  const { cli, state } = sandbox(t);
  ok(await cli('init'));
  denied(await cli('claim', 'codex', 'A', 'package.json'), /Zuerst @git/);
  ok(await cli('claim', 'claude', 'B', 'file.js'));
  denied(await cli('claim', 'codex', 'A', '@git'), /kollidiert/);
  ok(await cli('release', 'claude', 'B'));
  const race = await Promise.all([cli('claim', 'codex', 'A', '@git'), cli('claim', 'claude', 'B', '@git')]);
  assert.deepEqual(race.map((r) => r.code).sort(), [0, 1]);
  const [{ agent, task }] = state().claims;
  const [other, otherTask] = agent === 'codex' ? ['claude', 'B'] : ['codex', 'A'];
  denied(await cli('claim', other, otherTask, 'new.js'), /Git-\/Release-Bereich/);
  denied(await cli('check', other, otherTask, 'new.js'), /Git-\/Release-Bereich/);
  denied(await cli('release', other, otherTask, '@git'), /Nur eigene/);
  ok(await cli('note', other, otherTask, 'BLOCKED', 'Warte auf Git-Freigabe.'));
  ok(await cli('claim', agent, task, 'package.json'));
  denied(await cli('release', agent, task, '@git'), /zusammen mit @git/);
  ok(await cli('release', agent, task));
  ok(await cli('claim', other, otherTask, 'new.js'));
});

test('archive retains both agents, reservations and handoff, and is idempotent', async (t) => {
  const { cli, git, state, read } = sandbox(t, true);
  ok(await cli('init'));
  ok(await cli('note', 'claude', 'ABGABE', 'START', 'Auftrag begonnen.'));
  ok(await cli('claim', 'claude', 'ABGABE', 'eigen.txt'));
  ok(await cli('note', 'claude', 'ABGABE', 'HANDOFF', 'Datei übergeben.', 'eigen.txt'));
  ok(await cli('release', 'claude', 'ABGABE'));
  ok(await cli('claim', 'codex', 'ABGABE', 'eigen.txt'));
  ok(await cli('note', 'codex', 'ABGABE', 'INFO', 'Entschieden.', '--kind', 'ENTSCHEIDUNG'));
  ok(await cli('note', 'codex', 'ABGABE', 'INFO', 'Referenzcommit geprüft.', '--kind', 'COMMIT', git('rev-parse', 'HEAD')));
  ok(await cli('note', 'codex', 'ABGABE', 'INFO', 'Tests bestanden.', '--kind', 'TEST'));
  ok(await cli('note', 'codex', 'ABGABE', 'DONE', 'Fertig.'));
  denied(await cli('archive', 'codex', 'ABGABE'), /freigeben/);
  ok(await cli('release', 'codex', 'ABGABE'));
  ok(await cli('archive', 'codex', 'ABGABE'));
  const file = 'docs/agents/sessions/ABGABE.md';
  const bytes = read(file);
  for (const marker of ['claude, codex', 'START', 'HANDOFF', 'CLAIM', 'RELEASE', 'ENTSCHEIDUNG', 'COMMIT', 'TEST', 'DONE']) assert.ok(bytes.includes(marker), marker);
  assert.deepEqual(state().events, []);
  ok(await cli('archive', 'codex', 'ABGABE'));
  assert.equal(read(file), bytes);
  denied(await cli('note', 'codex', 'ABGABE', 'INFO', 'Zu spät.'), /archiviert/);
});

test('Git wrapper and hooks reject direct commit/push and foreign staged or unpublished changes', async (t) => {
  const { cli, git, write, state } = sandbox(t, true);
  ok(await cli('init', '--hooks'));
  assert.equal(git('config', '--local', '--get', 'core.hooksPath'), '.githooks');
  ok(await cli('claim', 'codex', 'GIT-A', '@git'));
  ok(await cli('claim', 'codex', 'GIT-A', 'eigen.txt'));
  write('eigen.txt', 'my change\n');
  write('fremd.txt', 'their change\n');
  denied(await cli('git', 'codex', 'GIT-A', 'add', '.'), /Ungültiger/);
  denied(await cli('git', 'claude', 'GIT-B', 'push'), /Git-\/Release-Bereich/);
  git('add', '--', 'fremd.txt');
  denied(await cli('git', 'codex', 'GIT-A', 'commit', 'Forbidden staged content'), /Fremde oder nicht reservierte/);
  assert.equal(git('diff', '--cached', '--name-only'), 'fremd.txt');
  git('restore', '--staged', '--', 'fremd.txt');
  ok(await cli('git', 'codex', 'GIT-A', 'add', 'eigen.txt'));
  assert.throws(() => git('commit', '-m', 'Direct commit'), /Koordinationsskript/);
  ok(await cli('git', 'codex', 'GIT-A', 'commit', 'Own changes'));
  assert.equal(git('show', '--format=', '--name-only', 'HEAD'), 'eigen.txt');
  assert.throws(() => git('push', 'origin', 'main'), /Koordinationsskript/);
  ok(await cli('release', 'codex', 'GIT-A'));
  ok(await cli('claim', 'claude', 'GIT-B', '@git'));
  denied(await cli('git', 'claude', 'GIT-B', 'push'), /Unveröffentlichte Commits/);
  ok(await cli('release', 'claude', 'GIT-B'));
  ok(await cli('claim', 'codex', 'GIT-A', '@git'));
  write('.agent-coordination/hold.cjs', "const fs = require('node:fs'); const timeout = Date.now() + 5000; const timer = setInterval(() => { if (fs.existsSync('.agent-coordination/go')) clearInterval(timer); else if (Date.now() > timeout) process.exit(1); }, 30);\n");
  write('.githooks/pre-push', '#!/bin/sh\nnode .agent-coordination/hold.cjs || exit 1\nexec node scripts/agent-koordination.mjs hook pre-push\n');
  const push = cli('git', 'codex', 'GIT-A', 'push');
  try {
    for (let i = 0; !state().gitRun && i < 100; i++) await sleep(30);
    assert.equal(state().gitRun?.action, 'push');
    denied(await cli('release', 'codex', 'GIT-A'), /Git-Operation/);
    denied(await cli('claim', 'claude', 'GIT-B', 'fremd.txt'), /Git-\/Release-Bereich/);
    ok(await cli('note', 'claude', 'GIT-B', 'INFO', 'Nachricht während Push.'));
  } finally {
    write('.agent-coordination/go', '');
    ok(await push);
  }
  assert.equal(git('rev-parse', 'HEAD'), git('rev-parse', 'origin/main'));
  assert.match(git('status', '--porcelain'), /(?:^|\n) M fremd\.txt$/);
});
