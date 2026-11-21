// Erzeugt den internen P1-Nachweis vor dem Docker-Build aus der lokalen Git-Historie.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { compareVersions, PUBLIC_ROADMAP_FILE, ROADMAP_BUILD_PROOF_FILE } from '../games/public-roadmap.js';

function git(...args) {
  const result = spawnSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function readGit(...args) {
  const result = git(...args);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `Git-Befehl fehlgeschlagen: ${args[0]}`);
  return result.stdout.trim();
}

const commit = readGit('rev-parse', 'HEAD');
if (process.argv[2] !== commit) throw new Error('Der erwartete Image-Commit muss exakt dem Checkout entsprechen.');
if (readGit('rev-parse', '--is-shallow-repository') !== 'false') throw new Error('Der Buildnachweis braucht die vollständige Git-Historie.');
if (readGit('diff', '--name-only', 'HEAD', '--')) throw new Error('Der Buildnachweis braucht unveränderte versionierte Build-Dateien.');

function resolveCommit(ref) {
  if (typeof ref !== 'string' || !/^[0-9a-f]{7,40}$/.test(ref)) return null;
  const result = git('rev-parse', '--verify', `${ref}^{commit}`);
  const oid = result.stdout.trim();
  return result.status === 0 && /^[0-9a-f]{40}$/.test(oid) && oid.startsWith(ref) ? oid : null;
}

function isAncestor(ancestor, descendant) {
  const result = git('merge-base', '--is-ancestor', ancestor, descendant);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(result.stderr.trim() || 'Git-Abstammung konnte nicht geprüft werden.');
}

const versionAt = (oid) => JSON.parse(readGit('show', `${oid}:package.json`)).version;
const version = versionAt(commit);
const data = JSON.parse(readGit('show', `${commit}:${PUBLIC_ROADMAP_FILE}`));
const deployments = [];
for (const entry of data.entries) {
  const proof = entry.internal?.deployment;
  if (entry.status !== 'neu' || !proof?.verified_on) continue;
  const implementationCommit = resolveCommit(proof.implementation_commit);
  const productionCommit = resolveCommit(proof.production_commit);
  if (!implementationCommit || implementationCommit !== proof.implementation_commit || !productionCommit ||
      !isAncestor(productionCommit, commit) || !isAncestor(implementationCommit, productionCommit)) continue;
  const productionVersion = versionAt(productionCommit);
  const versionOrder = compareVersions(productionVersion, entry.version);
  if (productionVersion !== proof.production_version || versionOrder === null || versionOrder < 0) continue;
  deployments.push({ implementationCommit, productionCommit, productionRef: proof.production_commit, productionVersion });
}

writeFileSync(ROADMAP_BUILD_PROOF_FILE, JSON.stringify({ schemaVersion: 1, commit, version, deployments }) + '\n');
console.log(`Roadmap-Buildnachweis: ${deployments.length} geprüfte Produktivbelege für ${commit}.`);
