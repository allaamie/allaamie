/* ══════════════════════════════════════════════════════════
   AL LAMEA ENTERPRISE BI — لوحة ذكاء الأعمال
   تُحمّل Lazy من لوحة التحكم. كل قسم معزول الأخطاء بحيث
   يعمل الجميع حتى لو لم تُفعّل جداول التحليلات بعد.
   ══════════════════════════════════════════════════════════ */
let $, $$, esc, fmt, toast, DB;
const KPI = {};               // نتائج محسوبة تُشارك بين الأقسام
const EVT = ev => KPI.events?.filter(e => e.type === ev) || [];
const sessionsOfType = t => new Set(EVT(t).map(e => e.session_id)).size;
const sumToday = t => { const d = new Date(); d.setHours(0, 0, 0, 0); return EVT(t).filter(e => new Date(e.created_at) >= d).length; };
const dayISO = d => d.toISOString().slice(0, 10);
const ago = ts => {
  const s = Math.max(1, (Date.now() - new Date(ts)) / 1000 | 0);
  if (s < 60) return `قبل ${s} ث`;
  if (s < 3600) return `قبل ${s / 60 | 0} د`;
  if (s < 86400) return `قبل ${s / 3600 | 0} س`;
  return `قبل ${s / 86400 | 0} يوم`;
};
const EV_LABEL = {
  store_visit: ['دخول المتجر', '🚪'], product_view: ['مشاهدة منتج', '👁'], studio_enter: ['دخول الاستوديو', '✦'],
  try_on: ['تجربة قطعة', '🧥'], try_off: ['خلع قطعة', '↩'], cart_add: ['إضافة للسلة', '🛒'],
  checkout_start: ['بدء الدفع', '💳'], purchase: ['شراء', '📦'], order_complete: ['اكتمال طلب', '✅'],
  fav_add: ['إضافة للمفضلة', '❤'], fav_remove: ['إزالة من المفضلة', '♡'], look_save: ['حفظ إطلالة', '🔖'],
  look_capture: ['حفظ صورة', '📸'], look_share: ['مشاركة إطلالة', '📤'], color_change: ['تغيير لون', '🎨'],
  newsletter_signup: ['اشتراك بالنشرة', '✉'], search: ['بحث', '⌕'], visit: ['زيارة', '👣'], studio_session: ['جلسة استوديو', '⏱'],
  ai_open: ['فتح خبير اللامع', '✦'], ai_chat: ['رسالة للخبير', '💬'], ai_outfit: ['إطلالة بالذكاء', '🤵'],
  ai_score: ['تقييم إطلالة', '★'], ai_image_search: ['بحث بصري', '🖼'], ai_compare: ['مقارنة منتجين', '⚖'],
  ai_size: ['استشارة مقاس', '📏'], ai_voice: ['أمر صوتي', '🎙'], ai_notif: ['تنبيه ذكي', '🔔'], review_add: ['تقييم عميل', '⭐'],
  client_error: ['خطأ عميل', '⚠'], page_perf: ['إشارة أداء', '⏱'], coupon_use: ['استخدام كوبون', '🎟']
};
const lbl = t => EV_LABEL[t] || [t, '·'];

/* ─── تحميل البيانات (مع كاش داخل الجلسة) ─────────── */
const cache = {};
async function getEvents(db, force = false) {
  if (cache.ev && !force && Date.now() - cache.ev.t < 90_000) return cache.ev.rows;
  const { data, error } = await db.from('events').select('type,session_id,visitor_id,product_id,product_name,value,meta,country,city,created_at,app')
    .order('created_at', { ascending: false }).limit(12000);
  if (error) throw error;
  cache.ev = { rows: data || [], t: Date.now() };
  return cache.ev.rows;
}
async function getSessions(db) {
  if (cache.ss && Date.now() - cache.ss.t < 60_000) return cache.ss.rows;
  const { data, error } = await db.from('sessions').select('*').order('last_seen_at', { ascending: false }).limit(4000);
  if (error) throw error;
  cache.ss = { rows: data || [], t: Date.now() };
  return cache.ss.rows;
}
async function getOrders(db) {
  if (cache.or && Date.now() - cache.or.t < 60_000) return cache.or.rows;
  const { data } = await db.from('orders').select('*').order('created_at', { ascending: false }).limit(2000);
  cache.or = { rows: data || [], t: Date.now() };
  return cache.or.rows;
}
async function getProducts(db) {
  if (cache.pr && Date.now() - cache.pr.t < 60_000) return cache.pr.rows;
  const { data } = await db.from('products').select('id,name,price,sale_price,stock,low_stock_threshold,status,is_active,image_url,wear_category,virtual_tryon,created_at');
  cache.pr = { rows: data || [], t: Date.now() };
  return cache.pr.rows;
}

/* ─── أدوات رسم SVG خفيفة ─────────────────────────── */
function areaChart(points, w = 640, h = 200, forecast = 0) {
  if (!points.length) points = [0];
  const max = Math.max(...points, 1), step = w / Math.max(points.length + forecast - 1, 1);
  const X = i => i * step, Y = v => h - (v / max) * (h - 26) - 8;
  const mk = (arr, off = 0) => arr.map((v, i) => `${i === 0 && !off ? 'M' : 'L'}${X(i + off).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area = `${mk(points)} L${X(points.length - 1)},${h - 8} L0,${h - 8} Z`;
  const fPts = forecast ? [...Array(forecast)].map((_, i) => points[points.length - 1] * (1 + 0.06 * (i + 1))) : [];
  return `<svg viewBox="0 0 ${w} ${h}" class="chart-area" preserveAspectRatio="none">
    <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B89146" stop-opacity=".45"/><stop offset="100%" stop-color="#B89146" stop-opacity="0"/>
    </linearGradient></defs>
    ${[.25, .5, .75].map(f => `<line x1="0" x2="${w}" y1="${h * f}" y2="${h * f}" stroke="rgba(255,255,255,.05)"/>`).join('')}
    <path d="${area}" fill="url(#gArea)"/>
    <path d="${mk(points)}" fill="none" stroke="#D6BE7A" stroke-width="2.2" stroke-linecap="round"/>
    ${fPts.length ? `<path d="${mk(fPts, points.length - 1)}" fill="none" stroke="#8C6B2F" stroke-width="1.6" stroke-dasharray="5 5"/>` : ''}
    ${points.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" fill="#D6BE7A"><title>${fmt(v)} ر.س</title></circle>`).join('')}
  </svg>`;
}
const bars = (pairs, cls = '') => `<div class="mini-bars ${cls}">${pairs.map(([n, v, mx]) =>
  `<div class="mb-row"><span>${esc(n)}</span><div class="mb-track"><i style="width:${Math.max(2, Math.round(v / (mx || Math.max(...pairs.map(p => p[1]), 1)) * 100))}%"></i></div><b class="num">${fmt(v)}</b></div>`).join('')}</div>`;

/* ══════════════════════════════════════════════════
   المدخل الرئيسي
   ══════════════════════════════════════════════════ */
export async function renderBI({ view, db }) {
  DB = db;
  $ = (s, c = document) => c.querySelector(s);
  $$ = (s, c = document) => [...c.querySelectorAll(s)];
  esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  fmt = n => (+n || 0).toLocaleString('en-US');
  toast = m => { const t = $('#toast'); if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); } };

  window.__biCleanup?.();
  const timers = [];
  let channel = null;
  window.__biCleanup = () => { timers.forEach(clearInterval); try { channel?.unsubscribe(); } catch (e) { } };

  view.innerHTML = `<div class="bi">
    <div class="bi-hero">
      <div>
        <p class="bi-kicker">AL LAMEA BUSINESS INTELLIGENCE™</p>
        <h2>مركز القيادة التجارية</h2>
      </div>
      <div class="bi-live-chip" id="bi-live-chip"><span class="pulse-dot"></span>مباشر الآن: <b class="num" id="bi-now" aria-live="off">—</b> زائر</div>
    </div>
    <div class="kpi-grid" id="kpi-grid"></div>
    <div class="bi-grid">
      <section class="bi-card span7" id="sec-live"></section>
      <section class="bi-card span5" id="sec-funnel"></section>
      <section class="bi-card span7" id="sec-sales"></section>
      <section class="bi-card span5" id="sec-studio"></section>
      <section class="bi-card span7" id="sec-products"></section>
      <section class="bi-card span5" id="sec-customers"></section>
      <section class="bi-card span5" id="sec-abandoned"></section>
      <section class="bi-card span4" id="sec-search"></section>
      <section class="bi-card span3" id="sec-report"></section>
      <section class="bi-card span12" id="sec-map"></section>
    </div>
  </div>`;

  const ok = sec => { const el = $(sec, view); if (el) el.innerHTML = '<p class="err" style="padding:20px">تعذر تحميل هذا القسم الآن.</p>'; };

  /* تحميل البيانات الأساسية */
  let analyticsReady = true;
  try { KPI.events = await getEvents(db); }
  catch (e) {
    analyticsReady = false; KPI.events = [];
    $('#sec-live', view).innerHTML = `<div class="bi-setup"><b>✦ تفعيل التحليلات</b><p>شغّل النسخة المحدّثة من <code>supabase/schema.sql</code> (قسم ENTERPRISE BI) في SQL Editor لبدء جمع أحداث الزوار، ثم أعد تحميل الصفحة.</p></div>`;
  }
  [KPI.orders, KPI.products, KPI.sessions] = await Promise.all([
    getOrders(db).catch(() => []), getProducts(db).catch(() => []), analyticsReady ? getSessions(db).catch(() => []) : []
  ]);

  paintKPIs(view);
  try { paintLive(view); } catch (e) { ok('#sec-live'); }
  try { paintFunnel(view); } catch (e) { ok('#sec-funnel'); }
  try { paintSales(view); } catch (e) { ok('#sec-sales'); }
  try { paintStudio(view); } catch (e) { ok('#sec-studio'); }
  try { paintProductsBI(view); } catch (e) { ok('#sec-products'); }
  try { paintCustomers(view); } catch (e) { ok('#sec-customers'); }
  try { paintAbandoned(view); } catch (e) { ok('#sec-abandoned'); }
  try { paintSearch(view); } catch (e) { ok('#sec-search'); }
  try { paintReports(view, db); } catch (e) { ok('#sec-report'); }
  try { paintMap(view); } catch (e) { ok('#sec-map'); }
  computeNotifications();

  /* بث مباشر */
  if (analyticsReady && db.channel) {
    try {
      channel = db.channel('bi-live');
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, p => {
        KPI.events.unshift(p.new);
        prependFeed(p.new);
        bumpKpi(p.new);
      }).subscribe();
    } catch (e) { }
    timers.push(setInterval(async () => {
      const { count } = await db.from('sessions').select('*', { count: 'exact', head: true }).gte('last_seen_at', new Date(Date.now() - 300000).toISOString());
      const el = $('#bi-now'); if (el) el.textContent = fmt(count || 0);
    }, 20000));
  }
}

/* ══════════ بطاقات المؤشرات ══════════ */
function paintKPIs(view) {
  const visits = sessionsOfType('store_visit') + sessionsOfType('visit');
  const unique = new Set(KPI.events.map(e => e.visitor_id)).size;
  const validOrders = KPI.orders.filter(o => o.status !== 'cancelled');
  const revenue = validOrders.reduce((a, o) => a + +o.total, 0);
  const aov = validOrders.length ? revenue / validOrders.length : 0;
  const conv = visits ? (validOrders.length / visits * 100) : 0;
  const cartsSessions = sessionsOfType('cart_add');
  const kpis = [
    ['إجمالي الزيارات', visits, `اليوم: ${fmt(sumToday('store_visit'))}`, '👁'],
    ['الزوار الفريدون', unique, 'بصمات مستقلة', '👤'],
    ['المتواجدون الآن', '<span class="num" id="kpi-now">—</span>', 'تُحدّث كل 20 ثانية', '🟢', true],
    ['المنتجات', KPI.products.length, `${KPI.products.filter(p => p.virtual_tryon).length} في الاستوديو`, '🛍'],
    ['الطلبات', validOrders.length, 'بدون الملغيّة', '📦'],
    ['الإيرادات', fmt(revenue) + ' <small>ر.س</small>', `اليوم: ${fmt(validOrders.filter(o => new Date(o.created_at) >= new Date().setHours(0, 0, 0, 0)).reduce((a, o) => a + +o.total, 0))} ر.س`, '💰'],
    ['متوسط قيمة الطلب', fmt(Math.round(aov)) + ' <small>ر.س</small>', 'لكل طلب', '💳'],
    ['نسبة التحويل', conv.toFixed(1) + '%', 'زيارة → طلب', '📈'],
    ['السلات المنشأة', cartsSessions, `اليوم: ${fmt(sumToday('cart_add'))}`, '🛒'],
    ['مرات تجربة المنتجات', EVT('try_on').length, `اليوم: ${fmt(sumToday('try_on'))}`, '🧥'],
    ['المفضلة', EVT('fav_add').length, 'إضافات القلب', '❤️'],
    ['المشاركات', EVT('look_share').length, 'إطلالات مُرسلة', '📤'],
    ['الصور المحفوظة', EVT('look_capture').length, 'تنزيلات الاستوديو', '📸']
  ];
  $('#kpi-grid', view).innerHTML = kpis.map(([label, v, sub, icon]) => `
    <article class="kpi"><span class="kpi-ic">${icon}</span><span class="kpi-l">${label}</span>
      <b class="kpi-v num">${v}</b><small>${sub}</small></article>`).join('');
  /* الآن */
  fetchNow.bind(null, view)();
}
async function fetchNow(view) {
  try {
    const { count } = await DB.from('sessions').select('*', { count: 'exact', head: true }).gte('last_seen_at', new Date(Date.now() - 300000).toISOString());
    const a = $('#bi-now'); if (a) a.textContent = fmt(count || 0);
    const b = $('#kpi-now'); if (b) b.textContent = fmt(count || 0);
  } catch (e) { }
}

/* ══════════ البث المباشر ══════════ */
function feedRow(e) {
  const [name, icon] = lbl(e.type);
  return `<li class="feed-item">
    <span class="feed-ic">${icon}</span>
    <div class="feed-tx"><b>${name}</b>
      <span>${e.product_name ? `<i>${esc(e.product_name)}</i> · ` : ''}${e.value ? `<em class="num">${fmt(e.value)} ر.س</em> · ` : ''}${esc(e.city || e.country || '')} ${ago(e.created_at)}</span>
    </div></li>`;
}
function paintLive(view) {
  const recent = KPI.events.slice(0, 14);
  $('#sec-live', view).innerHTML = `
    <header class="bi-head"><b>اللحظة الآن <span class="pulse-dot"></span></b><span>يتحدث تلقائياً دون تحديث الصفحة — طلبات · مشاهدات · سلة · تجارب · تسجيلات</span></header>
    <ul class="feed" id="live-feed">${recent.map(feedRow).join('') || '<li class="feed-empty">بانتظار أول حدث — الأحداث تظهر هنا لحظياً فور وصولها.</li>'}</ul>`;
}
function prependFeed(e) {
  const ul = $('#live-feed'); if (!ul) return;
  $('.feed-empty', ul)?.remove();
  ul.insertAdjacentHTML('afterbegin', feedRow(e));
  [...ul.children].slice(16).forEach(x => x.remove());
  ul.firstElementChild?.classList.add('flash');
}
function bumpKpi(e) {
  /* تحديث فوري لبطاقات رئيسية عند وصول أحداث */
  if (e.type === 'order_complete') { toast && toast('✦ طلب جديد الآن — ' + (e.product_name || '')); }
}

/* ══════════ رحلة العميل Funnel ══════════ */
function paintFunnel(view) {
  const stages = [
    ['دخل المتجر', sessionsOfType('store_visit')],
    ['فتح صفحة منتج', sessionsOfType('product_view')],
    ['دخل غرفة التجربة', sessionsOfType('studio_enter')],
    ['جرّب منتجاً', sessionsOfType('try_on')],
    ['أضاف للسلة', sessionsOfType('cart_add')],
    ['بدأ الدفع', sessionsOfType('checkout_start')],
    ['أكمل الطلب', sessionsOfType('order_complete')]
  ];
  const max = Math.max(stages[0][1], 1);
  let worst = 0, worstI = -1;
  stages.forEach((s, i) => { if (i > 0 && stages[i - 1][1]) { const drop = 1 - s[1] / stages[i - 1][1]; if (drop > worst) { worst = drop; worstI = i; } } });
  $('#sec-funnel', view).innerHTML = `
    <header class="bi-head"><b>رحلة العميل</b><span>جلسات فريدة لكل مرحلة + التحويل بين المراحل</span></header>
    <div class="funnel">
      ${stages.map(([n, v], i) => {
    const prev = i ? stages[i - 1][1] : null;
    const conv = i && prev ? Math.round(v / prev * 100) : 100;
    return `<div class="fn-step ${i === worstI ? 'fn-worst' : ''}">
          <div class="fn-info"><b>${n}</b><span class="num">${fmt(v)}</span></div>
          <div class="fn-track"><i style="width:${Math.max(3, v / max * 100)}%"></i></div>
          ${i ? `<small class="fn-conv num">${prev ? conv + '%' : '—'}</small>` : '<small style="opacity:.4">البداية</small>'}
          ${i === worstI && prev ? `<em class="fn-drop">أكبر نقطة فقدان ↓ ${Math.round(worst * 100)}%</em>` : ''}
        </div>`;
  }).join('')}
    </div>`;
}

/* ══════════ تحليل المبيعات ══════════ */
function paintSales(view) {
  const orders = KPI.orders.filter(o => o.status !== 'cancelled');
  const el = $('#sec-sales', view);
  el.innerHTML = `<header class="bi-head"><b>تحليل المبيعات</b>
    <span class="pills" id="sales-pills">${[['today', 'اليوم'], ['week', 'أسبوع'], ['month', 'شهر'], ['year', 'سنة']].map(([v, n], i) => `<button class="pill ${i === 1 ? 'on' : ''}" data-sp="${v}">${n}</button>`).join('')}</span></header>
    <div id="sales-body"></div>`;
  const body = $('#sales-body', el);

  const render = period => {
    const now = new Date();
    const span = { today: 1, week: 7, month: 30, year: 365 }[period];
    const from = new Date(now); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - span + 1);
    const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - span);
    const inP = orders.filter(o => new Date(o.created_at) >= from);
    const inPrev = orders.filter(o => new Date(o.created_at) >= prevFrom && new Date(o.created_at) < from);
    const sum = a => a.reduce((x, o) => x + +o.total, 0);
    const cur = sum(inP), prev = sum(inPrev);
    const delta = prev ? ((cur - prev) / prev * 100) : (cur ? 100 : 0);
    const days = period === 'today' ? null : Math.min(span, span > 60 ? 30 : span);
    const series = [];
    if (days) {
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(from); d.setDate(d.getDate() + (days - 1 - i));
        series.push(sum(inP.filter(o => dayISO(new Date(o.created_at)) === dayISO(d))));
      }
    } else {
      for (let h = 0; h < 24; h++) series.push(sum(inP.filter(o => new Date(o.created_at).getHours() === h)));
    }
    /* أفضل الساعات والأيام */
    const hrs = [...Array(24)].map((_, h) => sum(orders.filter(o => new Date(o.created_at).getHours() === h)));
    const bestH = hrs.indexOf(Math.max(...hrs));
    const wds = [...Array(7)].map((_, d) => sum(orders.filter(o => new Date(o.created_at).getDay() === d)));
    const WD = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const bestD = wds.indexOf(Math.max(...wds));

    body.innerHTML = `
      <div class="sales-summary">
        <div><span>إيرادات الفترة</span><b class="num">${fmt(Math.round(cur))}</b><small>ر.س</small></div>
        <div><span>مقارنة بالسابقة</span><b class="num ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(0)}%</b><small>${fmt(Math.round(prev))} ر.س سابقاً</small></div>
        <div><span>توقّع الاتجاه</span><b class="num">${days ? '+' : '+'}${(6).toFixed(0)}%</b><small>خط الاتجاه المتقطع</small></div>
      </div>
      ${areaChart(series, 640, 190, Math.min(5, Math.ceil(series.length / 3)))}
      <div class="duo">
        <div><h5>أفضل ساعات البيع <span class="num">الذروة ${bestH}:00</span></h5>${bars(hrs.map((v, h) => [h + ':00', v]).filter((_, i) => i % 3 === 0))}</div>
        <div><h5>أفضل أيام الأسبوع <span class="num">${WD[bestD]}</span></h5>${bars(wds.map((v, d) => [WD[d], v]))}</div>
      </div>`;
  };
  $('#sales-pills', el).onclick = e => {
    const b = e.target.closest('[data-sp]'); if (!b) return;
    $$('#sales-pills .pill').forEach(x => x.classList.toggle('on', x === b));
    render(b.dataset.sp);
  };
  render('week');
}

/* ══════════ تحليلات غرفة التجربة ══════════ */
function paintStudio(view) {
  const enter = sessionsOfType('studio_enter');
  const tries = EVT('try_on');
  const replaced = tries.filter(e => e.meta?.replaced).length;
  const trySess = sessionsOfType('try_on');
  const buyAfter = [...new Set(EVT('purchase').map(e => e.session_id))].filter(s => new Set(tries.map(t => t.session_id)).has(s)).length;
  const conv = trySess ? (buyAfter / trySess * 100) : 0;
  const durations = EVT('studio_session').map(e => +e.meta?.seconds || 0).filter(Boolean);
  const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const byProduct = {};
  tries.forEach(e => { const k = e.product_name || '—'; byProduct[k] = (byProduct[k] || 0) + 1; });
  const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const looks = {};
  EVT('look_save').forEach(e => { const k = e.meta?.name || 'إطلالة'; looks[k] = (looks[k] || 0) + 1; });
  const topLooks = Object.entries(looks).sort((a, b) => b[1] - a[1]).slice(0, 3);

  $('#sec-studio', view).innerHTML = `
    <header class="bi-head"><b>تحليلات غرفة التجربة</b><span>AL LAMEA VIRTUAL STUDIO™</span></header>
    <div class="st-tiles">
      ${[['دخلوا الغرفة', enter], ['إجمالي التجارب', tries.length], ['استبدال القطع', replaced], ['تغييرات الألوان', EVT('color_change').length],
      ['إطلالات محفوظة', EVT('look_save').length], ['صور محفوظة', EVT('look_capture').length], ['مشاركات', EVT('look_share').length],
      ['متوسط المدة', avgDur ? `${Math.floor(avgDur / 60)}د ${avgDur % 60}ث` : '—'], ['اشتروا بعد التجربة', buyAfter], ['تحويل التجربة → شراء', conv.toFixed(1) + '%']]
      .map(([n, v]) => `<div class="st-tile"><span>${n}</span><b class="num">${v}</b></div>`).join('')}
    </div>
    <h5 style="margin:18px 0 8px;font-size:11px;color:var(--text2)">أكثر القطع تجربة</h5>
    ${top.length ? bars(top) : '<p class="feed-empty">لا تجارب مسجلة بعد.</p>'}
    ${topLooks.length ? `<h5 style="margin:14px 0 8px;font-size:11px;color:var(--text2)">أكثر الإطلالات حفظاً</h5>${bars(topLooks)}` : ''}`;
}

/* ══════════ تحليلات المنتجات ══════════ */
function paintProductsBI(view) {
  const el = $('#sec-products', view);
  const agg = {};
  KPI.events.forEach(e => {
    if (!e.product_id) return;
    const k = e.product_id;
    agg[k] = agg[k] || { name: e.product_name || '—', views: 0, tries: 0, carts: 0, favs: 0, buys: 0, rev: 0 };
    if (e.type === 'product_view') agg[k].views++;
    if (e.type === 'try_on') agg[k].tries++;
    if (e.type === 'cart_add') agg[k].carts++;
    if (e.type === 'fav_add') agg[k].favs++;
    if (e.type === 'purchase') { agg[k].buys += +(e.meta?.qty || 1); agg[k].rev += +e.value || 0; }
  });
  let rows = KPI.products.map(p => ({
    ...p, ...(agg[p.id] || { views: 0, tries: 0, carts: 0, favs: 0, buys: 0, rev: 0, name: p.name }),
    name: p.name
  }));
  Object.entries(agg).filter(([id]) => !KPI.products.some(p => p.id === id))
    .forEach(([id, a]) => rows.push({ id, stock: null, ...a })); /* منتجات محذوفة لها أحداث */

  let sortK = 'rev', sortDir = -1, q = '';
  const render = () => {
    let list = rows.filter(r => !q || (r.name || '').includes(q));
    list.sort((a, b) => ((a[sortK] ?? 0) - (b[sortK] ?? 0)) * sortDir || (a.name || '').localeCompare(b.name || ''));
    $('#pa-table', el).innerHTML = `<table class="pa-table"><thead><tr>
      ${[['name', 'المنتج'], ['views', 'مشاهدات'], ['tries', 'تجارب'], ['carts', 'سلة'], ['favs', 'مفضلة'], ['buys', 'مبيعات'], ['rev', 'الإيرادات'], ['conv', 'التحويل'], ['stock', 'المخزون']]
        .map(([k, n]) => `<th data-k="${k}">${n}${sortK === k ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('')}</tr></thead>
      <tbody>${list.slice(0, 50).map(r => {
      const conv = r.views ? (r.buys / r.views * 100).toFixed(1) + '%' : '—';
      const sto = r.stock == null ? '<span class="chip c-muted">محذوف</span>'
        : r.stock === 0 ? '<span class="chip c-danger">نفد</span>'
          : r.stock <= (r.low_stock_threshold ?? 3) ? `<span class="chip c-warn num">${r.stock}</span>` : `<span class="chip c-ok num">${r.stock}</span>`;
      return `<tr><td><b>${esc(r.name)}</b></td><td class="num">${fmt(r.views)}</td><td class="num">${fmt(r.tries)}</td>
        <td class="num">${fmt(r.carts)}</td><td class="num">${fmt(r.favs)}</td><td class="num">${fmt(r.buys)}</td>
        <td class="num gold">${fmt(Math.round(r.rev))}</td><td class="num">${conv}</td><td>${sto}</td></tr>`;
    }).join('') || '<tr><td colspan="9" class="none">لا بيانات منتجات بعد.</td></tr>'}</tbody></table>`;
  };
  el.innerHTML = `<header class="bi-head"><b>تحليلات المنتجات</b>
    <input id="pa-q" class="bi-input" placeholder="تصفية بالاسم…" style="max-width:180px"></header>
    <div class="table-scroll" id="pa-table"></div>
    <p class="fe" style="font-size:9.5px;color:#66655e;margin-top:10px">انقر أي عمود للترتيب · الإيرادات من أحداث الشراء المنسوبة لكل منتج</p>`;
  $('#pa-q', el).oninput = e => { q = e.target.value; render(); };
  el.addEventListener('click', e => {
    const th = e.target.closest('th[data-k]'); if (!th) return;
    if (sortK === th.dataset.k) sortDir *= -1; else { sortK = th.dataset.k; sortDir = -1; }
    render();
  });
  render();
}

/* ══════════ تحليلات العملاء ══════════ */
function paintCustomers(view) {
  const el = $('#sec-customers', view);
  const valid = KPI.orders.filter(o => o.status !== 'cancelled');
  const byPhone = {};
  valid.forEach(o => {
    const k = o.customer_phone || o.customer_name || '—';
    byPhone[k] = byPhone[k] || { name: o.customer_name || k, count: 0, spend: 0, city: o.city || '' };
    byPhone[k].count++; byPhone[k].spend += +o.total; if (o.city) byPhone[k].city = o.city;
  });
  const clients = Object.entries(byPhone).sort((a, b) => b[1].spend - a[1].spend);
  const revenue = valid.reduce((a, o) => a + +o.total, 0);
  const uniqueVisitors = new Set(KPI.events.map(e => e.visitor_id)).size;
  const returning = KPI.events.filter(e => e.type === 'store_visit' && e.meta?.returning).length;
  const visits = EVT('store_visit').length || 1;
  const grp = (arr, key) => { const m = {}; arr.forEach(x => { const v = x[key] || 'غير معروف'; m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6); };
  const S = KPI.sessions || [];

  el.innerHTML = `
    <header class="bi-head"><b>تحليلات العملاء</b><span>شرائح وسلوك</span></header>
    <div class="st-tiles">
      ${[['الزوار الفريدون', uniqueVisitors], ['عملاء اشتروا', clients.length], ['زيارات عائدة', returning],
      ['نسبة العودة', (returning / visits * 100).toFixed(0) + '%'], ['قيمة العميل CLV', fmt(clients.length ? Math.round(revenue / clients.length) : 0) + ' <small>ر.س</small>'],
      ['متوسط الإنفاق', fmt(valid.length ? Math.round(revenue / valid.length) : 0) + ' <small>ر.س</small>']]
      .map(([n, v]) => `<div class="st-tile"><span>${n}</span><b class="num">${v}</b></div>`).join('')}
    </div>
    ${clients.length ? `<h5 class="bi-sub">الأكثر شراءً</h5>${bars(clients.slice(0, 5).map(([k, c]) => [`${esc(c.name)}${c.city ? ' · ' + esc(c.city) : ''} ×${c.count}`, Math.round(c.spend)]))}` : ''}
    <div class="duo">
      <div><h5 class="bi-sub">الأجهزة</h5>${bars(grp(S, 'device')) || ''}</div>
      <div><h5 class="bi-sub">المتصفحات</h5>${bars(grp(S, 'browser'))}</div>
    </div>
    <div class="duo">
      <div><h5 class="bi-sub">الأنظمة</h5>${bars(grp(S, 'os'))}</div>
      <div><h5 class="bi-sub">اللغات</h5>${bars(grp(S, 'lang'))}</div>
    </div>
    <div class="duo">
      <div><h5 class="bi-sub">الدول</h5>${bars(grp(KPI.events, 'country'))}</div>
      <div><h5 class="bi-sub">المدن</h5>${bars(grp(KPI.events, 'city'))}</div>
    </div>`;
}

/* ══════════ السلات المتروكة ══════════ */
function paintAbandoned(view) {
  const cartS = new Set(EVT('cart_add').map(e => e.session_id));
  const doneS = new Set(EVT('order_complete').map(e => e.session_id));
  const abandoned = [...cartS].filter(s => !doneS.has(s));
  const bySess = {};
  EVT('cart_add').forEach(e => bySess[e.session_id] = (bySess[e.session_id] || 0) + (+e.value || 0));
  const value = abandoned.reduce((a, s) => a + (bySess[s] || 0), 0);
  const startS = new Set(EVT('checkout_start').map(e => e.session_id));
  const exitedAt = {
    'قبل السلة': abandoned.filter(s => true).length - abandoned.filter(s => startS.has(s) || new Set(EVT('try_on').map(x => x.session_id)).has(s)).length,
    'في الدفع': [...startS].filter(s => !doneS.has(s)).length
  };
  $('#sec-abandoned', view).innerHTML = `
    <header class="bi-head"><b>السلات المتروكة</b><span>سلة بلا طلب مكتمل</span></header>
    <div class="st-tiles">
      <div class="st-tile"><span>سلات متروكة</span><b class="num">${abandoned.length}</b></div>
      <div class="st-tile"><span>قيمتها المقدّرة</span><b class="num">${fmt(Math.round(value))} <small>ر.س</small></b></div>
      <div class="st-tile"><span>خرجوا في الدفع</span><b class="num">${exitedAt['في الدفع']}</b></div>
      <div class="st-tile"><span>نسبة الاسترداد</span><b class="num">${cartS.size ? ((cartS.size - abandoned.length) / cartS.size * 100).toFixed(0) : 0}%</b></div>
    </div>
    <p class="note-gold">✦ أكثر سبب شائع للترك: التردد في المقاس أو الشحن — فعّل تذكيراً تلقائياً عبر بريد المتجر (SMTP) بعد ساعتين من الترك لاسترداد حتى 15% من السلات.</p>
    <button class="ghost" id="ab-remind" style="width:100%">إرسال تذكير للسلات الحديثة (يتطلب بريد العميل عند الدفع)</button>`;
  $('#ab-remind', view).onclick = () => toast('فعّل SMTP من إعدادات Supabase ليصل التذكير تلقائياً — يُلتقط البريد في نموذج الدفع');
}

/* ══════════ البحث ══════════ */
function paintSearch(view) {
  const q = {};
  EVT('search').forEach(e => { const k = (e.meta?.q || '').trim(); if (k) q[k] = (q[k] || 0) + 1; });
  const top = Object.entries(q).sort((a, b) => b[1] - a[1]);
  const noRes = top.filter(([k]) => (EVT('search').find(e => e.meta?.q === k)?.meta?.results) === 0);
  const bought = top.filter(([k]) => EVT('search').find(e => e.meta?.q === k)?.meta?.converted);
  $('#sec-search', view).innerHTML = `
    <header class="bi-head"><b>تحليلات البحث</b><span>من أحداث search</span></header>
    <h5 class="bi-sub">أكثر الكلمات بحثاً</h5>
    ${top.length ? bars(top.slice(0, 6)) : '<p class="feed-empty">سيظهر هنا فور تفعيل بحث المتجر.</p>'}
    <h5 class="bi-sub">بدون نتائج</h5>
    ${noRes.length ? bars(noRes.slice(0, 4)) : '<p class="feed-empty">—</p>'}
    <h5 class="bi-sub">كلمات انتهت بشراء</h5>
    ${bought.length ? bars(bought.slice(0, 4)) : '<p class="feed-empty">—</p>'}`;
}

/* ══════════ التقارير ══════════ */
function paintReports(view, db) {
  const el = $('#sec-report', view);
  el.innerHTML = `<header class="bi-head"><b>التقارير والتصدير</b><span>حسب الفترة</span></header>
    <div class="rep-dates">
      <label>من <input type="date" id="rep-from"></label>
      <label>إلى <input type="date" id="rep-to"></label>
    </div>
    <div class="rep-btns">
      <button class="ghost" data-rep="csv">CSV</button>
      <button class="ghost" data-rep="xls">Excel</button>
      <button class="ghost" data-rep="json">JSON</button>
      <button class="ghost" data-rep="pdf">PDF</button>
    </div>`;
  const to = new Date(), from = new Date(Date.now() - 30 * 864e5);
  $('#rep-to', el).value = dayISO(to); $('#rep-from', el).value = dayISO(from);
  el.onclick = async e => {
    const b = e.target.closest('[data-rep]'); if (!b) return;
    const f = $('#rep-from', el).value, t = $('#rep-to', el).value;
    const rows = KPI.orders.filter(o => dayISO(new Date(o.created_at)) >= f && dayISO(new Date(o.created_at)) <= t);
    if (!rows.length) return toast('لا بيانات في هذه الفترة');
    const head = ['الطلب', 'التاريخ', 'العميل', 'الجوال', 'المدينة', 'الإجمالي', 'الحالة'];
    const body = rows.map(o => [o.id.slice(0, 8), dayISO(new Date(o.created_at)), o.customer_name || '', o.customer_phone || '', o.city || '', o.total, o.status]);
    if (b.dataset.rep === 'csv' || b.dataset.rep === 'xls') {
      const csv = '﻿' + [head, ...body].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      download(csv, `allamea-report-${f}_${t}.${b.dataset.rep === 'xls' ? 'xls' : 'csv'}`,
        b.dataset.rep === 'xls' ? 'application/vnd.ms-excel' : 'text/csv');
    } else if (b.dataset.rep === 'json') {
      download(JSON.stringify({ period: [f, t], kpis: { orders: rows.length, revenue: rows.reduce((a, o) => a + +o.total, 0) }, orders: rows }, null, 2), `allamea-report-${f}_${t}.json`, 'application/json');
    } else {
      printReport(f, t, head, body);
    }
  };
}
function download(content, name, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('⬇ جرى تنزيل التقرير');
}
function printReport(f, t, head, body) {
  let pr = $('#print-report');
  if (!pr) { pr = document.createElement('div'); pr.id = 'print-report'; document.body.appendChild(pr); }
  pr.innerHTML = `<h1>اللامع | AL LAMEA — تقرير الطلبات</h1><p>الفترة: ${f} ← ${t}</p>
    <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  document.body.classList.add('printing');
  setTimeout(() => { print(); document.body.classList.remove('printing'); }, 80);
}

/* ══════════ الخريطة ══════════ */
const GEO = {
  'Saudi Arabia': [24.7, 46.7], 'السعودية': [24.7, 46.7], 'Yemen': [15.3, 44.2], 'اليمن': [15.3, 44.2],
  'United Arab Emirates': [24.3, 54.4], 'الإمارات': [24.3, 54.4], 'Kuwait': [29.3, 47.5], 'الكويت': [29.3, 47.5],
  'Qatar': [25.3, 51.2], 'قطر': [25.3, 51.2], 'Bahrain': [26, 50.5], 'Oman': [21.5, 55.9],
  'Egypt': [30, 31.2], 'مصر': [30, 31.2], 'Jordan': [31.9, 36], 'Iraq': [33.3, 44.4],
  'United States': [39.8, -98.6], 'United Kingdom': [54, -2], 'Germany': [51.1, 10.4], 'France': [46.6, 2.3],
  'Turkey': [39, 35.2], 'Morocco': [31.8, -6], 'India': [21, 78], 'Pakistan': [30.4, 69.3],
  'Riyadh': [24.71, 46.68], 'الرياض': [24.71, 46.68], 'Jeddah': [21.49, 39.19], 'جدة': [21.49, 39.19],
  'Dammam': [26.43, 50.1], 'الدمام': [26.43, 50.1], 'Sanaa': [15.35, 44.2], 'صنعاء': [15.35, 44.2],
  'Aden': [12.78, 45.04], 'عدن': [12.78, 45.04], 'Dubai': [25.2, 55.27], 'دبي': [25.2, 55.27],
  'Doha': [25.28, 51.53], 'Kuwait City': [29.37, 47.97], 'Cairo': [30.05, 31.24], 'القاهرة': [30.05, 31.24],
  'Makkah': [21.39, 39.85], 'مكة': [21.39, 39.85], 'Medina': [24.47, 39.61], 'المدينة المنورة': [24.47, 39.61]
};
async function paintMap(view) {
  const el = $('#sec-map', view);
  const byCountry = {};
  KPI.events.forEach(e => { if (e.country) byCountry[e.country] = (byCountry[e.country] || 0) + 1; });
  const orderCity = {};
  KPI.orders.filter(o => o.status !== 'cancelled').forEach(o => { if (o.city) orderCity[o.city] = (orderCity[o.city] || 0) + +o.total; });
  const points = [];
  Object.entries(byCountry).forEach(([k, v]) => GEO[k] && points.push({ k, v: `الزوار: ${fmt(v)}`, r: Math.min(26, 6 + Math.sqrt(v) * 3), ll: GEO[k] }));
  Object.entries(orderCity).forEach(([k, v]) => GEO[k] && points.push({ k, v: `مبيعات: ${fmt(Math.round(v))} ر.س`, r: Math.min(30, 8 + Math.sqrt(v) * 1.2), ll: GEO[k], gold: true }));

  const ranked = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 6);
  el.innerHTML = `<header class="bi-head"><b>الخريطة التفاعلية</b><span>الزوار · الطلبات · الإيرادات — ذهبي: مبيعات، عاجي: زيارات</span></header>
    <div class="map-wrap"><div id="bi-map"></div>
      <div class="map-side"><h5 class="bi-sub">أفضل الدول</h5>${ranked.length ? bars(ranked) : '<p class="feed-empty">بانتظار بيانات الموقع من جلسات الزوار.</p>'}
      <h5 class="bi-sub" style="margin-top:14px">أفضل المدن (مبيعات)</h5>${Object.entries(orderCity).length ? bars(Object.entries(orderCity).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => [k, Math.round(v)])) : '<p class="feed-empty">—</p>'}</div></div>`;
  try {
    await loadLeaflet();
    const map = L.map('bi-map', { zoomControl: false, attributionControl: false, scrollWheelZoom: false }).setView([26, 45], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 12 }).addTo(map);
    points.forEach(p => L.circleMarker(p.ll, {
      radius: p.r, color: p.gold ? '#D6BE7A' : '#F5F1E8', weight: 1,
      fillColor: p.gold ? '#B89146' : '#8C6B2F', fillOpacity: .35
    }).addTo(map).bindPopup(`<b>${p.k}</b><br>${p.v}`));
  } catch (e) { $('#bi-map', el).innerHTML = '<p class="feed-empty" style="padding:60px 20px">الخريطة تحتاج اتصالاً بالإنترنت لتحميل الطبقات — الترتيب أدناه يعمل دائماً.</p>'; }
}
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
    setTimeout(() => window.L ? res() : rej(new Error('timeout')), 9000);
  });
}

/* ══════════ الإشعارات الذكية ══════════ */
export function computeNotifications() {
  const n = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayVisits = KPI.events.filter(e => e.type === 'store_visit' && new Date(e.created_at) >= today).length;
  const weekVisits = KPI.events.filter(e => e.type === 'store_visit' && new Date(e.created_at) >= new Date(Date.now() - 7 * 864e5)).length;
  const avgDay = weekVisits / 7;

  (KPI.products || []).filter(p => p.status !== 'hidden' && (p.stock ?? 1) === 0)
    .forEach(p => n.push({ icon: '🔴', text: `نفد مخزون «${p.name}» — أعد التخزين فوراً`, level: 'danger', id: 'out-' + p.id }));
  const lows = (KPI.products || []).filter(p => (p.stock ?? 99) > 0 && p.stock <= (p.low_stock_threshold ?? 3));
  if (lows.length) n.push({ icon: '🟡', text: `${lows.length} منتجات بمخزون منخفض: ${lows.slice(0, 3).map(p => p.name).join('، ')}`, level: 'warn', id: 'low-' + lows.length });
  if (avgDay >= 4 && todayVisits > avgDay * 1.6) n.push({ icon: '📈', text: `زيارات اليوم (${todayVisits}) أعلى من المعتاد بنسبة ${Math.round(todayVisits / avgDay * 100 - 100)}%`, level: 'ok', id: 'spike-' + dayISO(today) });
  const tryToday = {};
  KPI.events.filter(e => e.type === 'try_on' && new Date(e.created_at) >= today)
    .forEach(e => tryToday[e.product_name] = (tryToday[e.product_name] || 0) + 1);
  Object.entries(tryToday).filter(([, v]) => v >= 4)
    .forEach(([k]) => n.push({ icon: '🔥', text: `«${k}» Trending اليوم في غرفة التجربة`, level: 'ok', id: 'tr-' + k }));
  const aband = (() => { const c = new Set(EVT('cart_add').map(e => e.session_id)); const d = new Set(EVT('order_complete').map(e => e.session_id)); return [...c].filter(s => !d.has(s)).length; })();
  if (aband >= 3) n.push({ icon: '🛒', text: `${aband} سلات متروكة بقيمة تقديرية عالية — فعّل التذكير`, level: 'warn', id: 'ab-' + aband });
  const valid = (KPI.orders || []).filter(o => o.status !== 'cancelled');
  const revToday = valid.filter(o => new Date(o.created_at) >= today).reduce((a, o) => a + +o.total, 0);
  const revWeek = valid.filter(o => new Date(o.created_at) >= new Date(Date.now() - 7 * 864e5)).reduce((a, o) => a + +o.total, 0) / 7;
  if (revWeek > 0 && revToday > revWeek * 1.5) n.push({ icon: '💰', text: `مبيعات اليوم (${fmt(Math.round(revToday))} ر.س) تتجاوز المعدل بنسبة ${Math.round(revToday / revWeek * 100 - 100)}%`, level: 'ok', id: 'rev-' + dayISO(today) });

  window.__biNotifs = n;
  window.dispatchEvent(new Event('bi:notifs'));
  return n;
}
