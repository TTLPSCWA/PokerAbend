import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { verify3dAssets } from './verify-3d-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'graphics', '3d');
const out = join(root, 'public', 'assets', '3d', 'generated');
const require = createRequire(import.meta.url);
const dependencies = join(root, 'node_modules');

verify3dAssets();
const buildOptions = {bundle:true, minify:true, platform:'browser', target:['es2022'], legalComments:'eof', write:false};
const [engine, worker, notices] = await Promise.all([
  build({...buildOptions, absWorkingDir:root, entryPoints:[join(source,'engine.js')], format:'esm'}),
  build({...buildOptions, absWorkingDir:root, entryPoints:[join(source,'physics-worker.js')], format:'iife'}),
  Promise.all([
    ['@babylonjs/core Apache-2.0', '@babylonjs/core/license.md', '@babylonjs/core/NOTICE.md'],
    ['@babylonjs/havok MIT', '@babylonjs/havok/LICENSE'],
  ].map(async ([title, ...files]) => [title, ...(await Promise.all(files.map(file => readFile(join(dependencies,file),'utf8'))))].join('\n\n'))),
]);
await mkdir(out,{recursive:true});
await Promise.all([
  writeFile(join(out,'engine.mjs'),engine.outputFiles[0].contents),
  writeFile(join(out,'physics-worker.js'),worker.outputFiles[0].contents),
  copyFile(require.resolve('@babylonjs/havok/lib/esm/HavokPhysics.wasm'),join(out,'HavokPhysics.wasm')),
  writeFile(join(out,'THIRD_PARTY_NOTICES.txt'),notices.join('\n\n'), 'utf8'),
]);
console.log('3D: engine ' + engine.outputFiles[0].contents.length + ' B, worker ' + worker.outputFiles[0].contents.length + ' B');
