/* ══════════════════════════════════════════════════════════
   AL LAMEA Error Monitoring™ — مراقبة أخطاء العميل لحظياً
   يُحمَّل مبكراً في كل الصفحات (المتجر · الاستوديو · الإدارة).
   يرسل إلى جدول events بنوع client_error — تُعرض في لوحة الإدارة
   مع نوع الخطأ والصفحة والوقت وعدد مرات التكرار (dedupe للجلسة).
   ══════════════════════════════════════════════════════════ */
'use strict';
(() => {
  const SB_URL = 'https://lebuvkypywblwrjhabpn.supabase.co';
  const SB_KEY = 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u';
  const APP = location.pathname.includes('studio') ? 'studio' : (location.pathname.includes('admin') ? 'admin' : 'store');

  let seen;
  try { seen = new Set(JSON.parse(sessionStorage.getItem('et-seen') || '[]')); } catch (e) { seen = new Set(); }
  const persist = () => { try { sessionStorage.setItem('et-seen', JSON.stringify([...seen].slice(-50))); } catch (e) { } };

  /* عيّنات محدودة: لا نرسل أكثر من 8 أخطاء لكل جلسة ولا أخطاء مكررة */
  function push(message, meta = {}) {
    if (!message) return;
    const key = String(message).slice(0, 160);
    if (seen.has(key) || seen.size >= 8) return;
    /* تجاهل ضجيج معروف: فشل تحميل مورد اختياري أو إلغاء الصفحة */
    if (/ResizeObserver|Script error\.?$|AbortError|cancelled/i.test(key)) return;
    seen.add(key); persist();
    const row = {
      type: 'client_error', app: APP,
      meta: {
        message: key.slice(0, 280),
        page: location.pathname.split('/').pop() || 'index.html',
        stack: String(meta.stack || '').slice(0, 420),
        ua: navigator.userAgent.slice(0, 160),
        online: navigator.onLine, w: innerWidth, h: innerHeight
      }
    };
    /* المسار المفضل: طبقة التحليلات (تجميع + جلسة) */
    try { if (window.AlaTrack?.track) { window.AlaTrack.track('client_error', row.meta); return; } } catch (e) { }
    /* بديل مستقل: REST مباشر (يعمل قبل تحميل analytics.js وفي لوحة الإدارة) */
    try {
      fetch(SB_URL + '/rest/v1/events', {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(row), keepalive: true
      }).catch(() => { });
    } catch (e) { }
  }

  addEventListener('error', e => {
    if (e.target && e.target !== window) {
      /* خطأ مورد (صورة/سكربت) — نسجله بمساره فقط دون رسائل مضللة */
      const src = e.target.src || e.target.href || '';
      if (src && !/favicon|logo|leaflet/i.test(src)) push('Resource failed: ' + src.split('?')[0].split('/').slice(-2).join('/'), { resource: 1 });
      return;
    }
    push(e.message, { stack: e.error?.stack, src: e.filename });
  }, true);
  addEventListener('unhandledrejection', e => {
    const r = e.reason;
    push('Promise rejection: ' + String(r && r.message ? r.message : r).slice(0, 200), { stack: r && r.stack });
  });
})();
