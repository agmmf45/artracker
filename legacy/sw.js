// ════════════════════════════════════════════════
//  دقيق — Service Worker v7
//  • صفحات HTML: شبكة أولاً (أحدث نسخة) مع رجوع للكاش عند انقطاع الإنترنت
//  • الأصول الثابتة (خطوط/صور/JS/CSS): من الكاش فوراً + تحديث بالخلفية (SWR)
//  • /api/* وأي طلب غير GET أو خارجي: شبكة مباشرة (لا كاش)
// ════════════════════════════════════════════════
const CACHE = 'artrk-v9';
const ASSET_RE = /\.(?:woff2|woff|ttf|png|jpg|jpeg|svg|webp|gif|ico|css|js)$/i;

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch { return; }

  // مرّر للشبكة مباشرة: غير GET، أو API، أو نطاق خارجي
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return; // معالجة المتصفح الافتراضية
  }

  // صفحات HTML (تنقّل) → شبكة أولاً، ثم الكاش عند عدم الاتصال
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // الأصول الثابتة → stale-while-revalidate
  if (ASSET_RE.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // الباقي: شبكة مع رجوع للكاش
  e.respondWith(fetch(req).catch(() => caches.match(req)));
});

// النقر على الإشعار → افتح/ركّز التطبيق
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
