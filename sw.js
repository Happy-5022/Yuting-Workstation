/* Service Worker：有网优先拿最新，离线才用缓存 —— 避免改了代码还显示旧版 */
const CACHE = 'yt-wb-v16';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css', './js/db.js', './js/app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  // 预缓存外壳；即使个别资源失败也不阻塞安装
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先：先联网取最新；失败（离线）才用缓存。改了代码刷新即生效，不再被旧缓存卡住
async function netFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cp = res.clone();
      caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
    }
    return res;
  } catch (e) {
    let cached = await caches.match(req);
    if (!cached) cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') return (await caches.match('./index.html')) || (await caches.match('./index.html', { ignoreSearch: true }));
    throw e;
  }
}

// 音频（越南语发音）走「缓存优先」：听过一次就存本地，之后离线也能听、点开也更快。
// 发音文件基本不会变，放心缓存；总量约 4.9M，不会把缓存撑爆。
async function audioFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cp = res.clone();
      caches.open(CACHE).then(c => c.put(req, cp)).catch(() => {});
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 跨域（百度、B站等）不拦截
  if (url.pathname.indexOf('/audio/') === 0) { e.respondWith(audioFirst(req)); return; }
  e.respondWith(netFirst(req));
});
