// 本地预览服务器：托管整个工作台，故意不对 sw.js 响应，避免缓存旧版
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PORT = 7788;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  // 不提供 service worker，防止本地缓存干扰预览
  if (req.url.split('?')[0] === '/sw.js') {
    res.writeHead(404); res.end('no sw in preview'); return;
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('预览已启动 → http://127.0.0.1:' + PORT);
});
server.on('error', (e) => {
  console.error('启动失败:', e.message);
  process.exit(1);
});
