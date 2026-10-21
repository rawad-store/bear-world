/* ══════════════════════════════════════════════════════════════
   Service Worker — عالم الدب الصغير v42
   ══════════════════════════════════════════════════════════════ */

const VERSION = 'bear-world-v42';

/* الملفات الأساسية التي يجب تحميلها عند التثبيت */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './bear.png',
  './icon-96.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

/* ملفات اختيارية (لن يفشل التثبيت إذا لم تكن موجودة) */
const OPTIONAL = [
  './screenshots/home-wide.png',
  './screenshots/draw-wide.png',
  './screenshots/quiz-narrow.png'
];

/* صفحة احتياطية أنيقة تظهر فقط إذا كان الجهاز بدون إنترنت تماماً */
const OFFLINE_HTML =
  '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>غير متصل — عالم الدب الصغير</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;' +
  'justify-content:center;font-family:Tajawal,Tahoma,Arial,sans-serif;' +
  'background:#eaf4ff;color:#17324d;text-align:center;padding:24px}' +
  '.box{background:#fff;border-radius:24px;padding:32px;max-width:420px;' +
  'box-shadow:0 14px 34px rgba(34,65,103,.14)}h1{font-size:26px;margin:0 0 12px}' +
  'p{color:#61758a;font-weight:700;line-height:1.7}' +
  'button{margin-top:16px;border:0;border-radius:14px;padding:12px 24px;' +
  'font:900 16px inherit;background:linear-gradient(180deg,#68b5ff,#4389f5);' +
  'color:#fff;box-shadow:0 4px 0 #2862c7;cursor:pointer}</style>' +
  '<div class="box"><div style="font-size:64px">🐻</div>' +
  '<h1>لا يوجد اتصال بالإنترنت</h1>' +
  '<p>افتح التطبيق مرة واحدة وأنت متصل ليُحمَّل للاستخدام دون اتصال.</p>' +
  '<button onclick="location.reload()">🔄 إعادة المحاولة</button></div></html>';

/* ─────────────── تثبيت SW ─────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(CORE.map(u =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => {})
    ));
    await Promise.all(OPTIONAL.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

/* ─────────────── تفعيل SW ─────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    /* احذف فقط مخازن هذا التطبيق (بادئة bear-world-) وليس كل النطاق */
    await Promise.all(
      keys
        .filter(k => k.startsWith('bear-world-') && k !== VERSION)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ─────────────── دوال مساعدة ─────────────── */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

async function putInCache(key, response) {
  try {
    if (!response) return;
    if (!response.ok && response.type !== 'opaque') return;
    const cache = await caches.open(VERSION);
    await cache.put(key, response);
  } catch (e) {}
}

/* ─────────────── استراتيجية الجلب (Fetch) ─────────────── */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (!url.protocol.startsWith('http')) return;
  if (request.headers.has('range')) return;

  /* 1) طلبات فتح الصفحة (HTML) - Network First مع مهلة 5 ثوانٍ */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await withTimeout(fetch(request), 5000);
        if (network && network.ok) {
          putInCache('./index.html', network.clone()).catch(() => {});
        }
        return network;
      } catch (e) {
        const cached =
          (await caches.match('./index.html')) ||
          (await caches.match('./')) ||
          (await caches.match(request));
        if (cached) return cached;
        return new Response(OFFLINE_HTML, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
    })());
    return;
  }

  /* 2) تصفية الروابط (السماح بالخطوط فقط من خارج الموقع) */
  const isFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !isFont) return;

  /* 3) الملفات الثابتة والصور - Stale While Revalidate */
  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkPromise = (async () => {
      try {
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
          putInCache(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (e) { return null; }
    })();
    if (cached) {
      networkPromise.catch(() => {});
      return cached;
    }
    const network = await networkPromise;
    if (network) return network;
    return new Response('', { status: 504, statusText: 'Offline' });
  })());
});
