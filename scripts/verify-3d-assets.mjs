import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'public/assets/3d/manifest.json';
const assetPath = /^\/(?:assets\/3d\/|games\/poker\/art\/)(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(webp|png)$/;
const licenses = new Set(['LicenseRef-SpieleAbend-Own', 'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0']);
const games = new Set(['poker', 'kniffel']);
const category = new Set(['materials', 'cards', 'chips', 'dice', 'tables']);
const quality = new Set(['low', 'medium', 'high', 'shared']);

function webpSize(data) {
  if (data.length < 30 || data.toString('ascii', 0, 4) !== 'RIFF' ||
      data.readUInt32LE(4) + 8 !== data.length || data.toString('ascii', 8, 12) !== 'WEBP') return null;
  switch (data.toString('ascii', 12, 16)) {
    case 'VP8X': return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
    case 'VP8L': {
      if (data[20] !== 0x2f) return null;
      const bits = data.readUInt32LE(21);
      return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
    }
    case 'VP8 ':
      return data[23] === 0x9d && data[24] === 1 && data[25] === 0x2a
        ? [data.readUInt16LE(26) & 0x3fff, data.readUInt16LE(28) & 0x3fff] : null;
    default: return null;
  }
}

function imageSize(format, data) {
  if (format === 'webp') return webpSize(data);
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      data.readUInt32BE(8) === 13 && data.toString('ascii', 12, 16) === 'IHDR') {
    return [data.readUInt32BE(16), data.readUInt32BE(20)];
  }
  return null;
}

export function verify3dAssets({ repo = root, manifest = JSON.parse(readFileSync(join(repo, manifestPath), 'utf8')) } = {}) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length) {
    throw new Error('3D asset manifest must contain assets with schema version 1');
  }
  const publicDir = realpathSync(join(repo, 'public'));
  const ids = new Set();
  for (const asset of manifest.assets) {
    const fail = reason => { throw new Error('3D asset ' + String(asset?.id ?? '(missing ID)') + ': ' + reason); };
    if (typeof asset?.id !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(asset.id) || ids.has(asset.id)) fail('invalid or duplicate ID');
    ids.add(asset.id);
    if (asset.licenseStatus !== 'approved' || !licenses.has(asset.license) ||
        typeof asset.author !== 'string' || !asset.author.trim() || typeof asset.sourceVersion !== 'string' || !asset.sourceVersion.trim() ||
        typeof asset.verifiedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asset.verifiedAt)) fail('invalid or unapproved license');
    if (typeof asset.requiresAttribution !== 'boolean' || typeof asset.attributionText !== 'string' ||
        (asset.license.startsWith('CC-BY-') && !asset.requiresAttribution) ||
        (asset.requiresAttribution && !asset.attributionText.trim())) fail('missing attribution');
    let source;
    try { source = new URL(asset.sourceUrl); } catch { fail('missing source URL'); }
    if (source.protocol !== 'https:' || source.username || source.password || /(?:^|\.)(?:invalid|localhost)$/.test(source.hostname) ||
        typeof asset.licenseEvidence !== 'string' || !/^docs\/design\/[A-Z0-9_]+\.md$/.test(asset.licenseEvidence) ||
        !readFileSync(join(repo, asset.licenseEvidence)).length) fail('invalid provenance');
    if (!category.has(asset.category) || !quality.has(asset.quality) ||
        !Array.isArray(asset.gameScope) || !asset.gameScope.length || new Set(asset.gameScope).size !== asset.gameScope.length ||
        !asset.gameScope.every(id => games.has(id))) fail('invalid game scope or category');
    if (asset.kind === 'procedural') {
      const generator = asset.generator;
      if (asset.format !== 'generator' || asset.uri !== undefined || asset.mimeType !== undefined ||
          asset.license !== 'LicenseRef-SpieleAbend-Own' || generator?.path !== 'graphics/3d/geometry.js' ||
          !['buildDie','buildPokerChip','buildPokerTable','buildWoodTexture'].includes(generator.entry) ||
          !Number.isSafeInteger(asset.triangles) || asset.triangles < 0 || asset.triangles > 4000 ||
          !Number.isSafeInteger(asset.materials) || asset.materials < 0 || asset.materials > 8 ||
          !Number.isSafeInteger(asset.texturePixels) || asset.texturePixels < 0 || asset.texturePixels > 512 * 512) fail('invalid procedural asset');
      const source = Buffer.from(readFileSync(join(repo,generator.path),'utf8').replace(/\r\n/g,'\n'));
      if (source.length !== asset.bytes || !source.toString('utf8').includes('export function ' + generator.entry + '(') ||
          createHash('sha256').update(source).digest('hex') !== asset.sha256) fail('generator fingerprint mismatch');
      continue;
    }
    const extension = typeof asset.uri === 'string' && asset.uri.match(assetPath)?.[1];
    if (!extension || asset.kind !== 'texture' || extension !== asset.format || asset.mimeType !== 'image/' + extension) fail('invalid local URI or MIME type');
    const file = realpathSync(join(publicDir, asset.uri.slice(1)));
    const rel = relative(publicDir, file);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) fail('file resolves outside public');
    const data = readFileSync(file);
    if (data.length < 1 || data.length > 256 * 1024 || data.length !== asset.bytes) fail('invalid byte size');
    if (createHash('sha256').update(data).digest('hex') !== asset.sha256) fail('SHA-256 mismatch');
    const size = imageSize(extension, data);
    if (!size || size.some(n => n < 1 || n > 1024) || size[0] * size[1] !== asset.texturePixels ||
        asset.triangles !== 0 || asset.materials !== 0) fail('invalid texture data or dimensions');
  }
  return ids.size;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log('3D assets verified: ' + verify3dAssets());
}
