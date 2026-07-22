/**
 * Generates build/icon.png (512×512) with zero dependencies: a hand-encoded
 * PNG of a ballot slip entering a ballot box, in the game's palette.
 * Run: node scripts/generate-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;

// Palette
const NAVY_TOP = [0x18, 0x1d, 0x2c];
const NAVY_BOTTOM = [0x0c, 0x0f, 0x18];
const BOX = [0x1d, 0x35, 0x57];
const BOX_EDGE = [0x2b, 0x4a, 0x77];
const SLOT = [0x0a, 0x0c, 0x12];
const PAPER = [0xf2, 0xe9, 0xdc];
const GOLD = [0xc9, 0xa2, 0x27];

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x < x1 && y >= y0 && y < y1;
}

/** Distance from point to segment, for drawing the check mark. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function pixel(x, y) {
  // Background: vertical gradient.
  const t = y / SIZE;
  let color = NAVY_TOP.map((c, i) => Math.round(c + (NAVY_BOTTOM[i] - c) * t));

  // Ballot slip sliding into the slot.
  if (inRect(x, y, 214, 92, 298, 260)) {
    color = PAPER;
    if (inRect(x, y, 230, 130, 282, 142)) color = GOLD; // a golden "title" line
    if (inRect(x, y, 230, 160, 282, 166)) color = [0x9a, 0x93, 0x86];
    if (inRect(x, y, 230, 182, 268, 188)) color = [0x9a, 0x93, 0x86];
  }

  // Ballot box.
  if (inRect(x, y, 118, 264, 394, 428)) {
    color = BOX;
    if (y < 276) color = BOX_EDGE; // lid highlight
    // Check mark on the front.
    const d1 = segmentDistance(x, y, 196, 342, 240, 388);
    const d2 = segmentDistance(x, y, 240, 388, 322, 306);
    if (Math.min(d1, d2) < 11) color = GOLD;
  }

  // Slot (drawn over box lid and slip).
  if (inRect(x, y, 172, 252, 340, 268)) color = SLOT;

  return color;
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type: truecolor

const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
let offset = 0;
for (let y = 0; y < SIZE; y++) {
  raw[offset++] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = pixel(x, y);
    raw[offset++] = r;
    raw[offset++] = g;
    raw[offset++] = b;
  }
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);
