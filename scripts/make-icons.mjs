// Generates the PWA icons (public/icons/*.png) with Node built-ins only (no image dependency).
// Placeholder design: dark background, sky-blue disc with a white "speech" dot pair. Run: node scripts/make-icons.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');

const BG = [0x0f, 0x17, 0x2a];
const SKY = [0x38, 0xbd, 0xf8];
const WHITE = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Color of one point (u, v in 0..1) for a disc of radius `r`. */
function shade(u, v, r) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  if (dx * dx + dy * dy > r * r) return BG;
  const dot = r * 0.16;
  for (const cx of [-r * 0.32, r * 0.32]) {
    const ex = dx - cx;
    if (ex * ex + dy * dy < dot * dot) return WHITE;
  }
  return SKY;
}

function png(size, discRadius) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = shade((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, discRadius);
          acc[0] += c[0];
          acc[1] += c[1];
          acc[2] += c[2];
        }
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(acc[i] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), png(192, 0.42));
writeFileSync(join(outDir, 'icon-512.png'), png(512, 0.42));
// Maskable: the launcher may crop to a circle of 80% diameter, so keep the disc inside it.
writeFileSync(join(outDir, 'icon-maskable-512.png'), png(512, 0.32));
console.log('icons written to public/icons/');
