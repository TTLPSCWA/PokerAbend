import { deflateSync } from 'node:zlib';

export const SIDE = 160;
export const CHUNK_LENGTH = 12000;
const pixelCount = SIDE * SIDE * 4;
export const ENCODED_LENGTH = Math.ceil(pixelCount / 3) * 4;
export const CHUNK_COUNT = Math.ceil(ENCODED_LENGTH / CHUNK_LENGTH);

const crcTable = Uint32Array.from({length:256}, (_, index) => {
  let n = index;
  for (let bit = 0; bit < 8; bit++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  return n;
});

function pngChunk(kind, content) {
  const chunk = Buffer.alloc(12 + content.length);
  chunk.writeUInt32BE(content.length, 0);
  chunk.write(kind, 4);
  content.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return chunk;
}

// The server receives only a bounded, fixed-size RGBA raster. It never parses
// the originally selected file or serves client-controlled metadata or URLs.
export function encodeRaster(encoded) {
  if (typeof encoded !== 'string' || encoded.length !== ENCODED_LENGTH ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw Error('Ungültige Bilddaten');
  const rgba = Buffer.from(encoded, 'base64');
  if (rgba.length !== pixelCount || rgba.toString('base64') !== encoded) throw Error('Ungültige Bilddaten');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIDE, 0);
  header.writeUInt32BE(SIDE, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = SIDE * 4;
  const rows = Buffer.alloc(SIDE * (stride + 1));
  for (let row = 0; row < SIDE; row++) rgba.copy(rows, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, {level:3})),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return 'data:image/png;base64,' + png.toString('base64');
}
