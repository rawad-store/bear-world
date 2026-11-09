/* ══════════════════════════════════════════════════════════════
   Service Worker — عالم الدب الصغير v55
   يضمن أن وضع عدم الاتصال = آخر تحديث مخزَّن للتطبيق
   ══════════════════════════════════════════════════════════════ */

/* ⚠️ غيّر هذا الرقم مع كل إصدار جديد من التطبيق */
const VERSION = 'bear-world-v55';

/* إلزامي: إن فشل تخزينه يفشل التثبيت ويُعاد لاحقًا بدل تفعيل عامل بلا صفحة مخزّنة */
const REQUIRED = ['./index.html'];

const CORE = [
  './',
  './manifest.json',
  './bear.png',
  './icon-96.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './fonts/tajawal-v12-arabic_latin-regular.woff2',
  './fonts/tajawal-v12-arabic_latin-700.woff2',
  './fonts/tajawal-v12-arabic_latin-800.woff2',
  './fonts/tajawal-v12-arabic_latin-900.woff2'
];

const OPTIONAL = [
  './screenshots/home-wide.png',
  './screenshots/draw-wide.png',
  './screenshots/quiz-narrow.png'
];

const OFFLINE_HTML =
  '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>غير متصل — عالم الدب الصغير</title>' +
  '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;' +
  'justify-content:center;font-family:Tahoma,Arial,sans-serif;' +
  'background:#eaf4ff;color:#17324d;text-align:center;padding:24px}' +
  '.box{background:#fff;border-radius:24px;padding:32px;max-width:420px;' +
  'box-shadow:0 14px 34px rgba(34,65,103,.14)}h1{font-size:26px;margin:0 0 12px}' +
  'p{color:#61758a;font-weight:700;line-height:1.7}' +
  'button{margin-top:16px;border:0;border-radius:14px;padding:12px 24px;' +
  'font:900 16px Tahoma,Arial,sans-serif;background:linear-gradient(180deg,#68b5ff,#4389f5);' +
  'color:#fff;box-shadow:0 4px 0 #2862c7;cursor:pointer}</style>' +
  '<div class="box"><div style="font-size:64px">🐻</div>' +
  '<h1>لا يوجد اتصال بالإنترنت</h1>' +
  '<p>افتح التطبيق مرة واحدة وأنت متصل ليُحمَّل آخر تحديث للاستخدام دون اتصال.</p>' +
  '<button onclick="location.reload()">🔄 إعادة المحاولة</button></div></html>';

/* ─────────────────────────── أدوات مساعدة ─────────────────────────── */

function fetchWithTimeout(request, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function putInCache(key, response) {
  try {
    if (!response) return;
    if (!response.ok && response.type !== 'opaque') return;
    const cache = await caches.open(VERSION);
    await cache.put(key, response);
  } catch (e) {}
}

/* مفتاح موحّد لصفحة التطبيق الرئيسية — يُخزَّن دائمًا تحت './index.html' */
const SHELL_KEY = './index.html';

/* نخزّن استجابة التنقل تحت SHELL_KEY فقط إذا كانت فعلاً صفحة التطبيق
   (جذر النطاق أو index.html) — حتى لا تحلّ صفحة أخرى داخل النطاق محلّها */
const SCOPE_PATH = new URL('./', self.registration.scope).pathname;
function isShellUrl(u) {
  return u.pathname === SCOPE_PATH || u.pathname === SCOPE_PATH + 'index.html';
}

/**
 * يعيد آخر نسخة من shell التطبيق المخزَّنة.
 * - يبحث أولًا في الكاش الحالي (VERSION) ثم في أي كاش bear-world- قديم
 *   كخطة احتياطية أثناء الترقية.
 */
async function cachedAppShell() {
  // 1) الكاش الحالي أولًا = آخر تحديث
  const current = await caches.open(VERSION);
  const hit =
    (await current.match(SHELL_KEY, { ignoreSearch: true })) ||
    (await current.match('./', { ignoreSearch: true }));
  if (hit) return hit;

  // 2) خطة احتياطية: أي كاش bear-world- آخر
  const keys = await caches.keys();
  const oldKeys = keys
    .filter((k) => k.startsWith('bear-world-') && k !== VERSION)
    .sort() // الأحدث لاحقًا حسب اسم الإصدار
    .reverse();
  for (const k of oldKeys) {
    const c = await caches.open(k);
    const h =
      (await c.match(SHELL_KEY, { ignoreSearch: true })) ||
      (await c.match('./', { ignoreSearch: true }));
    if (h) return h;
  }
  return null;
}

/* ─────────────────────────── التثبيت ─────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    // الصفحة الأساسية: إلزامية (الفشل يوقف التثبيت ليُعاد المحاولة لاحقًا)
    await Promise.all(
      REQUIRED.map((u) => cache.add(new Request(u, { cache: 'reload' })))
    );

    // بقية CORE: فشلها لا يوقف التثبيت لكن يُسجَّل للتشخيص
    await Promise.all(
      CORE.map((u) =>
        cache.add(new Request(u, { cache: 'reload' })).catch((err) => {
          console.warn('[SW] تعذّر تخزين', u, err && err.message);
        })
      )
    );

    // OPTIONAL: فشل أي عنصر لا يوقف التثبيت
    await Promise.all(
      OPTIONAL.map((u) => cache.add(u).catch(() => {}))
    );

    // ✅ بعد انتهاء كل التخزين
    await self.skipWaiting();
  })());
});

/* ─────────────────────────── التنشيط ─────────────────────────── */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('bear-world-') && k !== VERSION)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ─────────────────────────── الجلب ─────────────────────────── */

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }
  if (!url.protocol.startsWith('http')) return;
  if (request.headers.has('range')) return;
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

  /* ── 1) التنقل (navigate): الشبكة أولًا ثم آخر shell مخزَّن ── */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // ✅ لا نُخزِّن استجابات التنقل تحت مسار الصفحة المطلوبة
        // بل نُخزِّنها فقط تحت SHELL_KEY لضمان أن offline = آخر تحديث للتطبيق
        const network = await fetchWithTimeout(request, 4000);
        if (network && network.ok) {
          // نُخزِّن تحت مفتاح موحّد فقط لصفحة التطبيق نفسها
          if (isShellUrl(url)) {
            await putInCache(SHELL_KEY, network.clone()).catch(() => {});
          }
          return network;
        }
      } catch (e) {}

      const cached = await cachedAppShell();
      if (cached) return cached;

      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    })());
    return;
  }

  /* ── 2) بقية الطلبات: نفس الأصل فقط (الخطوط صارت محلية) ── */
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;
  /* أقل صلاحية: لا نخزّن ولا نتدخل في ملفات خارج مجلد التطبيق (النطاق مشترك مع مواقع أخرى) */
  if (sameOrigin && !url.pathname.startsWith(SCOPE_PATH)) return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);

    // stale-while-revalidate
    const cached = await cache.match(request);
    if (cached) {
      // waitUntil يمنع إيقاف العامل قبل اكتمال تحديث الكاش في الخلفية
      event.waitUntil(
        fetch(request)
          .then((response) => {
            if (response && (response.ok || response.type === 'opaque')) {
              return putInCache(request, response.clone());
            }
          })
          .catch(() => {})
      );
      return cached;
    }

    // غير مخزَّن → الشبكة
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === 'opaque')) {
        putInCache(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (e) {
      if (request.destination === 'document') {
        const shell = await cachedAppShell();
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
