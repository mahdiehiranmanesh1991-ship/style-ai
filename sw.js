// Offline-first service worker for «استایلیست من».
// - App shell: precached, cache-first, replaced on VERSION change.
// - ONNX runtime (vendor/, ~11 MB): cached on first use in a long-lived cache (survives app updates).
// - AI model (models/, 44 MB): NOT handled here — the background-removal worker stores it in 'style-ai-models-v1' itself.
const VERSION = 'style-ai-v1.0.0';
const VENDOR_CACHE = 'style-ai-vendor-v1';
const KEEP = new Set([VERSION, VENDOR_CACHE, 'style-ai-models-v1']);
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/db.js', './js/color.js', './js/catalog.js', './js/season.js', './js/body.js', './js/harmony.js', './js/engine.js',
  './js/image.js', './js/jalali.js', './js/demo.js', './js/bg-worker.js',
  './fonts/Vazirmatn-Variable.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('style-ai') && !KEEP.has(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/models/')) return; // the worker caches the model itself
  const cacheName = url.pathname.includes('/vendor/') ? VENDOR_CACHE : VERSION;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(cacheName).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
