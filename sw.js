/* ══════════════════════════════════════════════════════════
   AL LAMEA PWA — Service Worker
   · Offline Cache لصفحات وقطع المتجر التي زرتها (SWR)
   · Background Sync للطلبات المؤجلة عند عودة الاتصال
   · Push Notifications عند توفر الخادم لاحقاً
   · تحديثات تلقائية بنظام إصدارات الكاش
   ══════════════════════════════════════════════════════════ */
'use strict';
const VERSION = 'allamea-v20260731-3';
const PRECACHE = [
  './', 'index.html', 'studio.html',
  'styles.css', 'studio.css', 'ai.css',
  'catalog.js', 'script.js', 'studio.js', 'analytics.js', 'ai.js', 'error-tracker.js', 'pwa.js',
  'manifest.webmanifest',
  'assets/allamea-hero.jpg', 'assets/heritage.jpg', 'assets/detail-cotton.jpg', 'assets/detail-gold.jpg',
  'assets/p-thobe.jpg', 'assets/p-mishlah.jpg', 'assets/p-vest.jpg', 'assets/p-shawl.jpg', 'assets/p-accessory.jpg'
];
const MAX_RUNTIME = 90;
const BYPASS = /supabase\.co|googleapis|gstatic|unpkg|leaflet|ipapi|analytics|gtag|facebook|tiktok/i;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    /* إضافة متسامحة: أي أصل مفقود لا يُسقط التثبيت */
    await Promise.allSettled(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  const url = new URL(req.url);
  if (BYPASS.test(url.href)) return;              /* بيانات حيّة — شبكة فقط */
  if (url.origin !== location.origin) return;

  /* صفحات التنقل: الشبكة أولاً مع سقوط للكاش (وضع Offline) */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  /* بقية الأصول: Stale-While-Revalidate
     (ignoreSearch: تغيير ?v= لا يكسر الكاش المثبّت) */
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => {
      if (res.ok) {
        cache.put(req, res.clone());
        trim(cache);
      }
      return res;
    }).catch(() => cached);
    return cached || fresh;
  })());
});

async function trim(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_RUNTIME) {
    /* تخلص من أقدم الأصول المضافة زمنياً (خارج قائمة التثبيت) */
    for (let i = 0; i < keys.length - MAX_RUNTIME; i++) {
      const u = new URL(keys[i].url).pathname.replace(/^\//, '');
      if (!PRECACHE.includes(u) && !PRECACHE.includes('./' + u)) await cache.delete(keys[i]);
    }
  }
}

/* مزامنة خلفية: يطلب من الصفحات المفتوحة إرسال الطلبات المؤجلة */
self.addEventListener('sync', e => {
  if (e.tag === 'sync-orders') {
    e.waitUntil((async () => {
      const cs = await self.clients.matchAll({ includeUncontrolled: true });
      cs.forEach(c => c.postMessage({ type: 'FLUSH_ORDERS' }));
    })());
  }
});

/* إشعارات Push جاهزة متى فُعّل الخادم */
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) { data = { title: 'اللامع | AL LAMEA', body: e.data?.text() || '' }; }
  e.waitUntil(self.registration.showNotification(data.title || 'اللامع | AL LAMEA', {
    body: data.body || '', icon: 'assets/favicon.png', badge: 'assets/favicon.png',
    dir: 'rtl', lang: 'ar', data: { url: data.url || './index.html' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => {
    const t = e.notification.data?.url || './index.html';
    const ex = cs.find(c => 'focus' in c);
    if (ex) { ex.focus(); ex.navigate(t); }
    else self.clients.openWindow(t);
  }));
});
