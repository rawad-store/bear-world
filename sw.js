const CACHE_NAME = 'bear-world-v31'; // ⚠️ مهم: ارفع هذا الرقم مع كل تحديث تقوم به

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './bear.png', // تأكد من وجود هذه الصورة
  './bear-world.png'
];

self.addEventListener('install', (e) => {
  // إجبار الـ Service Worker الجديد على التفعيل فوراً
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  // السيطرة على جميع الصفحات المفتوحة فوراً
  e.waitUntil(self.clients.claim());
  
  // حذف جميع الكاشات القديمة (التي لا تحمل الاسم الجديد)
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // استراتيجية "الشبكة أولاً" للملفات الأساسية لضمان أحدث نسخة
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  
  // للملفات الأخرى (صور، أصوات)، استخدم الكاش أولاً
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
