/* ══════════════════════════════════════════════════════════
   AL LAMEA Analytics Layer™
   طبقة التحليلات الموحدة — تجمع الأحداث من المتجر والاستوديو
   وترسلها إلى قاعدة البيانات + مزودي التحليلات الخارجيين.

   التفعيل الخارجي (اختياري): قبل تحميل هذا الملف عرّف:
   window.ALAMEA_ANALYTICS_CONFIG = {
     ga4:'G-XXXXXXX', meta:'123456789', tiktok:'PIXELID', clarity:'abcdefgh'
   };
   لإضافة مزود جديد: Providers.myProvider = {init(){}, event(name,params){}}
   ══════════════════════════════════════════════════════════ */
'use strict';
(() => {
  const CFG = Object.assign({ ga4: '', meta: '', tiktok: '', clarity: '' }, window.ALAMEA_ANALYTICS_CONFIG || {});
  const SB_URL = 'https://lebuvkypywblwrjhabpn.supabase.co';
  const SB_KEY = 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u';
  const APP = location.pathname.includes('studio') ? 'studio' : 'store';
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));

  /* ── هوية الزائر والجلسة ─────────────────────────── */
  let visitor = localStorage.getItem('av-visitor');
  const returning = !!visitor;
  if (!visitor) { visitor = uuid(); localStorage.setItem('av-visitor', visitor); }
  let session = sessionStorage.getItem('av-session');
  if (!session) { session = uuid(); sessionStorage.setItem('av-session', session); }

  /* ── معلومات الجهاز ─────────────────────────────── */
  const ua = navigator.userAgent;
  const device = /iPad|Tablet/i.test(ua) ? 'لوحي' : (/Mobi|Android/i.test(ua) ? 'جوال' : 'حاسوب');
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'أخرى';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'أخرى';
  const lang = (navigator.language || 'ar').split('-')[0];

  /* ── الموقع التقريبي (محاولة لطيفة مع تخزين) ────── */
  let geo = (() => { try { return JSON.parse(localStorage.getItem('av-geo') || 'null'); } catch (e) { return null; } })();
  (async () => {
    if (geo && Date.now() - geo.t < 86400000 * 7) return;
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 2800);
      const r = await fetch('https://ipapi.co/json/', { signal: ctl.signal });
      const j = await r.json();
      if (j && j.country_name) {
        geo = { country: j.country_name, city: j.city || '', t: Date.now() };
        localStorage.setItem('av-geo', JSON.stringify(geo));
        upsertSession();
      }
    } catch (e) { /* بدون تحديد موقع */ }
  })();

  /* ── عميل قاعدة البيانات ────────────────────────── */
  let db = null;
  try { if (window.supabase?.createClient) db = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }); } catch (e) { }

  const sessionRow = () => ({
    id: session, visitor_id: visitor,
    started_at: +sessionStorage.getItem('av-started') || new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    device, browser, os, lang,
    country: geo?.country || null, city: geo?.city || null,
    referrer: document.referrer || 'direct', app: APP,
    pages: +(sessionStorage.getItem('av-pages') || 1)
  });
  if (!sessionStorage.getItem('av-started')) sessionStorage.setItem('av-started', Date.now());

  /* ── مزوّدو التحليلات الخارجيون (قابل للتوسّع) ──── */
  const Providers = {
    ga4: {
      init(id) {
        const s = document.createElement('script'); s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { dataLayer.push(arguments); };
        gtag('js', new Date()); gtag('config', id, { send_page_view: true });
      },
      event: n => window.gtag?.('event', n.name, n.params)
    },
    meta: {
      init(id) {
        !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', id); fbq('track', 'PageView');
      },
      event: n => window.fbq?.('trackCustom', n.name, n.params)
    },
    tiktok: {
      init(id) {
        !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ['page', 'track']; ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat([].slice.call(arguments, 0))) } }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.load = function (e) { var s = document.createElement('script'); s.type = 'text/javascript'; s.async = !0; s.src = 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=' + e + '&lib=' + t; var a = document.getElementsByTagName('script')[0]; a.parentNode.insertBefore(s, a) }; ttq.load(id); ttq.page() }(window, document, 'ttq');
      },
      event: n => window.ttq?.track(n.name, n.params)
    },
    clarity: {
      init(id) {
        (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }; t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y) })(window, document, 'clarity', 'script', id);
      },
      event: n => window.clarity?.('event', n.name)
    }
  };
  Object.entries({ ga4: CFG.ga4, meta: CFG.meta, tiktok: CFG.tiktok, clarity: CFG.clarity })
    .forEach(([k, id]) => { if (id) { try { Providers[k].init(id); } catch (e) { } } });
  window.ALAMEA_PROVIDERS = Providers; /* مزودون جدد يُسجلون هنا دون تعديل الكود */

  /* ── قائمة الانتظار والإرسال المجمّع ─────────────── */
  const queue = [];
  let timer = null, offline = !db;
  function flush() {
    clearTimeout(timer); timer = null;
    if (!queue.length || offline) return;
    const rows = queue.splice(0, queue.length).map(e => ({
      session_id: session, visitor_id: visitor, app: APP,
      type: e.type, product_id: e.product?.id ? String(e.product.id) : null,
      product_name: e.product?.name || null, value: e.value ?? null,
      meta: e.meta || {}, country: geo?.country || null, city: geo?.city || null
    }));
    db.from('events').insert(rows, { defaultToNull: false }).then(({ error }) => { if (error) offline = true; })
      .catch(() => { offline = true; });
  }

  function track(type, meta = {}, value = null, product = null) {
    queue.push({ type, meta, value, product });
    Providers && Object.values(Providers).forEach(p => { try { p.event?.({ name: type, params: { ...meta, value } }); } catch (e) { } });
    if (!timer) timer = setTimeout(flush, 3500);
    if (queue.length >= 12) flush();
  }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  /* ── تحديث الجلسة (نبض) ─────────────────────────── */
  function upsertSession() {
    if (offline || !db) return;
    db.from('sessions').upsert(sessionRow(), { onConflict: 'id' }).then(({ error }) => { if (error) offline = true; }).catch(() => { });
  }
  upsertSession();
  setInterval(upsertSession, 30000);
  addEventListener('beforeunload', upsertSession);

  /* ── حدث الدخول التلقائي ────────────────────────── */
  track(APP === 'studio' ? 'studio_enter' : 'store_visit', { returning, url: location.pathname });

  /* ── إشارة أداء الصفحة (مرة واحدة لكل جلسة) ────── */
  addEventListener('load', () => setTimeout(() => {
    if (sessionStorage.getItem('av-perf')) return;
    try {
      sessionStorage.setItem('av-perf', '1');
      const nav = performance.getEntriesByType('navigation')[0] || {};
      track('page_perf', {
        ttfb: Math.round(nav.responseStart || 0),
        dom: Math.round(nav.domContentLoadedEventEnd || 0),
        load: Math.round(nav.loadEventEnd || performance.now()),
        mem: navigator.deviceMemory || null,
        dpr: Math.round((window.devicePixelRatio || 1) * 10) / 10,
        url: location.pathname
      });
    } catch (e) { }
  }, 2500));

  /* ── واجهة عامة ─────────────────────────────────── */
  window.AlaTrack = {
    track,
    session: { id: session, visitor, returning, device, browser, os, lang, get country() { return geo?.country; }, get city() { return geo?.city; } },
    /* قياس مدة استخدام ميزة: const t=AlaTrack.timer(); … t.stop('studio_session') */
    timer: () => { const t0 = performance.now(); return { stop: (type, meta = {}) => track(type, { ...meta, seconds: Math.round((performance.now() - t0) / 1000) }) }; }
  };
})();
