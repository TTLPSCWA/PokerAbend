import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { verify3dAssets } from '../scripts/verify-3d-assets.mjs';

const source = new URL('../public/assets/3d/manifest.json', import.meta.url);
const manifest = () => JSON.parse(readFileSync(source, 'utf8'));

test('the released 3D textures have approved provenance, exact bytes and matching dimensions', () => {
  const input = manifest();
  assert.ok(input.assets.some(asset => asset.id === 'poker-table-felt'));
  assert.equal(verify3dAssets({ manifest: input }), input.assets.length);
});

test('3D asset verification rejects duplicate IDs, unapproved sources and missing attribution', () => {
  const input = manifest();
  const first = input.assets[0];
  assert.throws(() => verify3dAssets({ manifest: {...input, assets: [first, first]} }), /duplicate ID/);
  assert.throws(() => verify3dAssets({ manifest: {...input, assets: [{...first, licenseStatus: 'review'}]} }), /unapproved license/);
  assert.throws(() => verify3dAssets({ manifest: {...input, assets: [{...first, license: 'CC-BY-4.0'}]} }), /missing attribution/);
});

test('3D asset verification rejects external or noncanonical paths and mismatched formats, bytes or hashes', () => {
  const base = manifest();
  const verify = change => verify3dAssets({ manifest: {...base, assets: [{...base.assets[0], ...change}]} });
  for (const uri of ['https://example.invalid/felt.webp', '/assets/3d/../felt.webp', '/assets/3d/%2e%2e/felt.webp']) {
    assert.throws(() => verify({uri}), /invalid local URI/);
  }
  assert.throws(() => verify({mimeType: 'text/html'}), /MIME type/);
  assert.throws(() => verify({bytes: 100}), /invalid byte size/);
  assert.throws(() => verify({sha256: '0'.repeat(64)}), /SHA-256 mismatch/);
  assert.throws(() => verify({texturePixels: 0}), /invalid texture data or dimensions/);
});
