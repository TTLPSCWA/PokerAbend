import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gitBash = join(process.env.ProgramFiles || 'C:/Program Files', 'Git', 'bin', 'bash.exe');
const shell = process.platform === 'win32' && existsSync(gitBash) ? gitBash : 'bash';
const hasBash = spawnSync(shell, ['-c', 'tar --version >/dev/null'], { timeout: 5000 }).status === 0;
const repo = fileURLToPath(new URL('..', import.meta.url));
const artifact = 'spieleabend-2026-11-25_0030.tar.gz';
const old = 'spieleabend-2020-01-01_0000.tar.gz';
const only = { skip: !hasBash && 'bash mit tar nicht verfügbar' };

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'backup-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const source = join(root, 'source');
  const target = join(root, 'archives');
  mkdirSync(bin);
  mkdirSync(source);
  const tool = (name, body) => writeFileSync(join(bin, name), '#!/usr/bin/env bash\nset -eu\n' + body + '\n', { mode: 0o700 });
  tool('date', 'case "$1" in "+%F_%H%M") echo 2026-11-25_0030 ;; *) echo 2026-11-25 ;; esac');
  tool('docker', `case "$1 $2" in
    'volume ls') printf '%s\\n' "${"$"}{TEST_VOLUME_LIST:-local_poker-data}" ;;
    'volume inspect') [ "$3" = local_poker-data ] ;;
    'run --rm')
      [ "$3 $4 $5 $6" = '--network none --mount type=volume,src=local_poker-data,dst=/data,readonly' ]
      if [ "${"$"}{TEST_DOCKER_FAIL:-}" = yes ]; then printf part; exit 1; fi
      tar czf - -C "$TEST_BACKUP_SOURCE" .
      ;;
    *) exit 99 ;;
  esac`);
  tool('rclone', 'echo "$*" >&2; exit 1');
  const run = (overrides = {}) => spawnSync(shell, ['-c',
    'if command -v cygpath >/dev/null 2>&1; then bin="$(cygpath -au "$1")"; export BACKUP_DIR="$(cygpath -au "$BACKUP_DIR")" TEST_BACKUP_SOURCE="$(cygpath -au "$TEST_BACKUP_SOURCE")"; else bin="$1"; fi; export PATH="$bin:$PATH"; exec bash scripts/backup.sh',
    '_', bin], {
    cwd: repo, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, VOLUME: '', KEEP_DAYS: '', BACKUP_RSYNC_TARGET: '', BACKUP_RCLONE_TARGET: '',
      BACKUP_DIR: target.replaceAll('\\', '/'), TEST_BACKUP_SOURCE: source.replaceAll('\\', '/'), ...overrides },
  });
  return { root, source, target, run };
}

test('backup creates a complete private archive and retains an expired original', only, (t) => {
  const { source, target, run } = fixture(t);
  mkdirSync(target, { mode: 0o700 });
  writeFileSync(join(source, 'fixture.json'), '{"ok":true}');
  writeFileSync(join(target, old), 'old fixture');
  const then = new Date('2020-01-01T00:00:00Z');
  utimesSync(join(target, old), then, then);
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /1 Sicherung\(en\)/);
  assert.deepEqual(readdirSync(target).sort(), [old, artifact]);
  assert.equal(readFileSync(join(target, old), 'utf8'), 'old fixture');
  const file = join(target, artifact);
  if (process.platform !== 'win32') assert.equal(statSync(file).mode & 0o777, 0o600);
  const before = readFileSync(file);
  writeFileSync(join(source, 'fixture.json'), '{"ok":false}');
  assert.notEqual(run().status, 0, 'existing same-minute backup must stay intact');
  assert.deepEqual(readFileSync(file), before);
  assert.deepEqual(readdirSync(target).sort(), [old, artifact]);
});

test('backup fails closed on an unknown volume, blank archive or interrupted archive', only, (t) => {
  const { source, target, run } = fixture(t);
  assert.notEqual(run({ VOLUME: 'missing' }).status, 0);
  assert.notEqual(run({ TEST_VOLUME_LIST: 'first_poker-data\nsecond_poker-data' }).status, 0);
  assert.equal(existsSync(target), false);
  assert.notEqual(run().status, 0);
  writeFileSync(join(source, 'fixture.json'), '{}');
  assert.notEqual(run({ TEST_DOCKER_FAIL: 'yes' }).status, 0);
  assert.deepEqual(readdirSync(target), []);
});

test('offsite failure preserves the local archive and omits destination details', only, (t) => {
  const { source, target, run } = fixture(t);
  writeFileSync(join(source, 'fixture.json'), '{}');
  const result = run({ BACKUP_RCLONE_TARGET: 'synthetic-private-target:fixture' });
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout + result.stderr, /synthetic-private-target/);
  assert.deepEqual(readdirSync(target), [artifact]);
});
