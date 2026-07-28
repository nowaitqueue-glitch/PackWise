import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPNG(size, rgb) {
  const [r, g, b] = rgb;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 3;
      const cx = size / 2;
      const cy = size / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / (size * 0.35);
      if (dist < 1) {
        raw[i] = Math.min(255, r + 40);
        raw[i + 1] = Math.min(255, g + 40);
        raw[i + 2] = Math.min(255, b + 40);
      } else {
        raw[i] = r;
        raw[i + 1] = g;
        raw[i + 2] = b;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(root, "public", "icons");
fs.mkdirSync(iconsDir, { recursive: true });
const color = [15, 118, 110];
fs.writeFileSync(path.join(iconsDir, "icon-192.png"), createPNG(192, color));
fs.writeFileSync(path.join(iconsDir, "icon-512.png"), createPNG(512, color));
fs.writeFileSync(path.join(root, "public", "favicon-32.png"), createPNG(32, color));
console.log("PWA icons written to public/icons");
