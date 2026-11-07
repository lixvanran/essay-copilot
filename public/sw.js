/**
 * Service Worker（v0.5.0 PWA，v0.6.1 缓存版本对齐）
 *
 * 策略：
 *  - 字体/图片：cache-first（永久）
 *  - API 调用：network-only（永不缓存，避免旧结果）
 *  - 页面：network-first，失败回退到缓存
 */

const CACHE_VERSION = 'essay-copilot-v0.6.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRE_CACHE_URLS = [
  '/',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 调用：永不缓存
  if (url.pathname.startsWith('/api/')) {
    return;  // 让浏览器直接走网络
  }

  // 字体：cache-first
  if (url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 页面：network-first，失败回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 静态资源（_next/static）：cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}