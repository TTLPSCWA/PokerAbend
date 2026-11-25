import { createReadStream } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createGunzip } from 'node:zlib';

const BLOCK_SIZE = 512;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const zeroBlock = (block) => block.every((byte) => byte === 0);
const invalid = () => new Error('Ungültiges oder nicht unterstütztes Sicherungsarchiv.');

function field(block) {
  const end = block.indexOf(0);
  return utf8.decode(end < 0 ? block : block.subarray(0, end));
}

function number(block) {
  const octal = field(block).trim();
  if (!/^[0-7]+$/.test(octal)) throw invalid();
  return Number.parseInt(octal, 8);
}

function readMember(block) {
  let checksum = 0;
  for (let i = 0; i < BLOCK_SIZE; i++) checksum += i >= 148 && i < 156 ? 32 : block[i];
  const type = block[156];
  const directory = type === 53;
  if (number(block.subarray(148, 156)) !== checksum || (!directory && type !== 0 && type !== 48)) throw invalid();
  const size = number(block.subarray(124, 136));
  if (directory && size !== 0) throw invalid();
  const prefix = block.subarray(257, 263).equals(Buffer.from('ustar\0')) ? field(block.subarray(345, 500)) : '';
  const name = field(block.subarray(0, 100));
  let path = (prefix ? prefix + '/' + name : name).replace(/^\.\//, '');
  if (directory) path = path.replace(/\/$/, '');
  if (directory && (path === '' || path === '.') && (name === './' || name === '.')) return { parts: [], directory, size };
  const parts = path.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\\:<>|"*?\x00-\x1f\x7f]/u.test(part) ||
      /[ .]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part) ||
      part !== part.normalize('NFC'))) throw invalid();
  return { parts, directory, size };
}

// Extract only regular files and directories from tar/gzip into a newly created
// private directory. Never interpret archive links, access modes or metadata.
export async function extractRestoreArchive(archive, destination, signal) {
  await mkdir(destination, { mode: 0o700 });
  const source = createReadStream(archive, { signal });
  const zip = createGunzip();
  source.on('error', (error) => zip.destroy(error));
  source.pipe(zip);
  const bytes = zip[Symbol.asyncIterator]();
  let chunk = Buffer.alloc(0);
  async function read(count, allowEnd = false) {
    const block = Buffer.alloc(count);
    for (let offset = 0; offset < count;) {
      if (!chunk.length) {
        const next = await bytes.next();
        if (next.done) {
          if (allowEnd && offset === 0) return null;
          throw invalid();
        }
        chunk = next.value;
      }
      const copied = chunk.copy(block, offset, 0, count - offset);
      chunk = chunk.subarray(copied);
      offset += copied;
    }
    return block;
  }

  const seen = new Map();
  let files = 0;
  try {
    for (;;) {
      const block = await read(BLOCK_SIZE);
      if (zeroBlock(block)) break;
      const member = readMember(block);
      if (!member.parts.length) continue;
      for (let depth = 1; depth <= member.parts.length; depth++) {
        const name = member.parts.slice(0, depth).join('/');
        const key = name.toLowerCase();
        const last = depth === member.parts.length;
        const type = last && !member.directory ? 'file' : 'dir';
        const previous = seen.get(key);
        if (previous && (previous.type !== type || previous.name !== name || (last && previous.explicit))) throw invalid();
        if (!previous || last) seen.set(key, { name, type, explicit: last });
      }
      const path = join(destination, ...member.parts);
      await mkdir(member.directory ? path : dirname(path), { mode: 0o700, recursive: true });
      if (member.directory) continue;
      const output = await open(path, 'wx', 0o600);
      try {
        for (let left = member.size; left > 0;) {
          const data = await read(Math.min(left, 64 * 1024));
          await output.writeFile(data);
          left -= data.length;
        }
      } finally {
        await output.close();
      }
      await read((BLOCK_SIZE - member.size % BLOCK_SIZE) % BLOCK_SIZE);
      files++;
    }
    if (!zeroBlock(await read(BLOCK_SIZE)) || files === 0) throw invalid();
    // Read through the gzip trailer to detect truncation or additional data.
    for (let block; (block = await read(BLOCK_SIZE, true));) {
      if (!zeroBlock(block)) throw invalid();
    }
  } finally {
    source.destroy();
    zip.destroy();
  }
}
