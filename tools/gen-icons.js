// 纯 Node 生成 PWA 图标：温暖自然配色（蜜桃底 + 白色圆 + 自然绿点）
// 不依赖任何第三方包，用 zlib 手写 PNG 编码
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = y * (width * 4 + 1) + 1 + x * 4;
      raw[d] = rgba[s];
      raw[d + 1] = rgba[s + 1];
      raw[d + 2] = rgba[s + 2];
      raw[d + 3] = rgba[s + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const top = [255, 176, 133];   // 蜜桃
  const bot = [255, 226, 191];   // 奶油
  const cx = size / 2, cy = size / 2;
  const whiteR = size * 0.36;
  const greenR = size * 0.135;
  const green = [111, 168, 106]; // 自然绿
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const bg = [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t)];
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = bg[0], g = bg[1], b = bg[2], a = 255;
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= whiteR) { r = 255; g = 255; b = 255; }
      if (d <= greenR) { r = green[0]; g = green[1]; b = green[2]; }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
    }
  }
  return buf;
}

const sizes = [
  { f: 'icon-192.png', s: 192 },
  { f: 'icon-512.png', s: 512 },
  { f: 'apple-touch-icon.png', s: 180 },
];
for (const { f, s } of sizes) {
  fs.writeFileSync(path.join(OUT, f), encodePNG(s, s, draw(s)));
  console.log('wrote', f, s + 'x' + s);
}
console.log('done');
