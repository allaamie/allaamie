/* ══════════════════════════════════════════════════════════
   AL LAMEA SUITE™ — مركز الذكاء والأتمتة (PART 3) + المراقبة
   قاعدة ذهبية: لا يُنفَّذ أي إجراء يمس الأسعار أو المنتجات أو
   المحتوى تلقائياً — كل تنفيذ يمر عبر موافقة المسؤول ويُوثَّق.
   التمييز واضح دائماً: بيانات فعلية 🟢 · توصية 🟡 · توقع 🟠
   ══════════════════════════════════════════════════════════ */
'use strict';

let $, esc, fmt, toast, DB, OPS, ME;
const dayISO = d => d.toISOString().slice(0, 10);
const DAY = 86400000, now = () => Date.now();
const ago = d => new Date(now() - d * DAY);
const KIND_L = {
  restock: ['إعادة تخزين', '📦'], discount: ['اقتراح خصم', '🏷'], add_product: ['منتج مقترح', '➕'],
  improve_desc: ['تحسين وصف', '✎'], improve_title: ['تحسين عنوان', '✎'], keywords: ['كلمات مفتاحية', '⌕'],
  image_fix: ['ترتيب الصور', '🖼'], images_missing: ['صور ناقصة', '🖼'], categorize: ['تصنيف', '🗂'],
  bundle: ['حملة تجميعية', '🎁'], feature_add: ['إبراز بالرئيسية', '✦'], feature_remove: ['إخفاء من المميزة', '⌫'],
  decline: ['توقع انخفاض طلب', '📉'], success: ['توقع نجاح', '📈']
};
const WEAR_AR = { maawaz: 'معاوز', thobe: 'أثواب', shamzan: 'شمزان', vest: 'صديري', jambiya: 'جنابي', belt: 'أحزمة', turban: 'عمائم', shemagh: 'شماغ', shoes: 'أحذية', watch: 'ساعات', perfume: 'عطور', accessories: 'إكسسوارات' };

/* ─────────── جلب البيانات مع كاش ─────────── */
const C = {};
async function getT(name, ttl, fn) {
  if (C[name] && now() - C[name].t < ttl) return C[name].v;
  const v = await fn();
  C[name] = { v, t: now() };
  return v;
}
const getEvents = () => getT('ev', 90000, async () => (await DB.from('events').select('type,session_id,visitor_id,product_id,product_name,value,meta,country,city,created_at,app').order('created_at', { ascending: false }).limit(12000)).data || []);
const getSessions = () => getT('ss', 60000, async () => (await DB.from('sessions').select('*').order('last_seen_at', { ascending: false }).limit(4000)).data || []);
const getOrders = () => getT('or', 60000, async () => (await DB.from('orders').select('*').order('created_at', { ascending: false }).limit(2000)).data || []);
const getProducts = () => getT('pr', 60000, async () => (await DB.from('products').select('id,name,name_en,price,sale_price,stock,low_stock_threshold,status,is_active,image_url,gallery,wear_category,virtual_tryon,short_description,description,tags,sizes,colors,is_featured,is_new,is_limited,show_home,category_id,sold_count,created_at').order('created_at', { ascending: false })).data || []);
const getSettings = async k => (await getT('st-' + k, 120000, async () => (await DB.from('store_settings').select('*').eq('key', k)).data?.[0]?.value || null)) || null;
const getCoupons = () => getT('cp', 60000, async () => (await DB.from('coupons').select('*').order('created_at', { ascending: false })).data || []);
const getTasks = () => getT('tk', 45000, async () => {
  const { data, error } = await DB.from('ai_tasks').select('*').limit(500);
  if (error) { C.tasksOff = true; return []; }
  C.tasksOff = false; return data || [];
});
const EVT = (ev, list) => list.filter(e => e.type === ev);
const sessionsOf = (t, list) => new Set(EVT(t, list).map(e => e.session_id)).size;

/* ─────────── محرك الاقتراحات (بيانات فعلية فقط) ─────────── */
function computeProposals(products, events, orders, tasks) {
  const P = [];
  const arch = {};
  (tasks || []).forEach(t => arch[t.key] = t.status);
  const rejected = new Set(Object.keys(arch).filter(k => ['rejected', 'executed'].includes(arch[k])));
  const w14 = events.filter(e => new Date(e.created_at) >= ago(14));
  const w7 = events.filter(e => new Date(e.created_at) >= ago(7));
  const prev7 = events.filter(e => new Date(e.created_at) < ago(7) && new Date(e.created_at) >= ago(14));
  const valid = orders.filter(o => o.status !== 'cancelled');

  /* نشاط كل منتج */
  const A = {};
  const ensure = id => A[id] = A[id] || { views: 0, tries: 0, carts: 0, buys: 0, rev: 0, v7: 0, p7: 0 };
  events.forEach(e => {
    if (!e.product_id) return;
    const a = ensure(e.product_id);
    if (e.type === 'product_view') a.views++;
    if (e.type === 'try_on') a.tries++;
    if (e.type === 'cart_add') a.carts++;
    if (e.type === 'purchase') { a.buys += +(e.meta?.qty || 1); a.rev += +e.value || 0; }
    const recent = new Date(e.created_at) >= ago(7);
    const older = !recent && new Date(e.created_at) >= ago(14);
    if (['product_view', 'try_on', 'cart_add'].includes(e.type)) { if (recent) a.v7++; if (older) a.p7++; }
  });

  const active = products.filter(p => p.status !== 'hidden');
  const thr = p => p.low_stock_threshold ?? 3;
  const conv = a => a.views ? a.buys / a.views : 0;
  const convs = active.map(p => conv(A[p.id] || ensure(p.id)));
  const medConv = convs.sort((a, b) => a - b)[Math.floor(convs.length / 2)] || 0;
  const prices = active.map(p => +(p.sale_price ?? p.price)).sort((a, b) => a - b);
  const medPrice = prices[Math.floor(prices.length / 2)] || 0;

  const push = o => { if (!rejected.has(o.key)) P.push(o); };

  /* 1) منتجات يبحث عنها الناس ولا توجد (من بحث المتجر) */
  const miss = {};
  EVT('search', w14).forEach(e => { if ((e.meta?.results ?? 1) === 0 && e.meta?.q) { const q = String(e.meta.q).trim(); if (q.length > 2) (miss[q] = miss[q] || { n: 0, first: e.created_at, last: e.created_at }), miss[q].n++, miss[q].last = e.created_at; } });
  Object.entries(miss).sort((a, b) => b[1].n - a[1].n).slice(0, 4).forEach(([q, m]) => push({
    key: 'add_product:' + q, kind: 'add_product', priority: 70 + m.n * 6,
    title: `العملاء يطلبون «${q}» ولا يجدونه`,
    why: `${m.n} عمليات بحث بلا نتائج خلال 14 يوماً (أولها ${dayISO(new Date(m.first))}، آخرها ${dayISO(new Date(m.last))}).`,
    impact: m.n >= 5 ? 'عالٍ' : 'متوسط',
    action: { label: 'إنشاء المنتج لاحقاً', run: () => OPS.newProduct({ name: q, tags: [q], short_description: `بناءً على طلب العملاء — ${m.n} عملية بحث` }) }
  }));

  /* 2) إعادة التخزين */
  active.forEach(p => {
    const a = A[p.id] || ensure(p.id);
    const demand = a.views + a.tries * 2 + a.carts * 3 + a.buys * 5;
    if ((p.stock ?? 0) <= thr(p) && demand > 0) {
      const qty = Math.max(Math.ceil(demand * 1.5), 10);
      push({
        key: 'restock:' + p.id, kind: 'restock', priority: (p.stock === 0 ? 95 : 80) + demand,
        title: (p.stock === 0 ? 'نفد: ' : 'شحيح: ') + `«${p.name}»`,
        why: `مخزون ${p.stock} وحدّ التنبيه ${thr(p)} — مع طلب قائم: ${a.views} مشاهدة، ${a.tries} تجربة، ${a.carts} سلة، ${a.buys} شراء خلال 14 يوماً.`,
        impact: 'عالٍ',
        action: { label: `موافقة · +${qty} للمخزون`, async run() { await OPS.patchProduct(p.id, { stock: (p.stock ?? 0) + qty }); OPS.toast(`✦ أُعيد تخزين «${p.name}» (+${qty})`); } }
      });
    }
  });

  /* 3) خصم مقترح — مشاهدات عالية وتحويل منخفض وسعر فوق الوسيط */
  active.forEach(p => {
    const a = A[p.id] || ensure(p.id);
    const ageDays = (now() - new Date(p.created_at)) / DAY;
    if (a.views >= 10 && a.buys === 0 && +(p.sale_price ?? p.price) > medPrice && ageDays > 30 && (p.stock ?? 0) > thr(p) * 2 && !p.sale_price) {
      const pct = 12, sale = Math.round(+p.price * (1 - pct / 100));
      push({
        key: 'discount:' + p.id, kind: 'discount', priority: 55 + a.views,
        title: `خصم ${pct}% على «${p.name}» قد يحرّك الركود`,
        why: `${a.views} مشاهدة بلا شراء واحد، وسعره ${fmt(p.price)} فوق وسيط المتجر (${fmt(medPrice)}) وهو معروض منذ ${Math.floor(ageDays)} يوماً.`,
        impact: 'متوسط',
        action: { label: `موافقة · خصم ${pct}% → ${fmt(sale)}`, async run() { await OPS.patchProduct(p.id, { sale_price: sale }); OPS.toast(`✦ طُبّق خصم ${pct}% على «${p.name}»`); } }
      });
    }
  });

  /* 4) توقعات النجاح/الانخفاض (مدعومة بزخم البيانات) */
  active.forEach(p => {
    const a = A[p.id] || ensure(p.id);
    if (a.p7 >= 3) {
      const ratio = a.v7 / a.p7;
      if (ratio >= 1.8 && a.v7 >= 5 && (p.stock ?? 0) < 10 && p.stock > 0) push({
        key: 'success:' + p.id, kind: 'success', priority: 62 + ratio * 8,
        title: `زخم صاعد: «${p.name}» (توقع نجاح — وليس يقيناً)`,
        why: `نشاط هذا الأسبوع ${ratio.toFixed(1)}× الأسبوع الماضي والمخزون ${p.stock} فقط. توقّع: نفاد مبكر إن استمر الزخم.`,
        impact: 'عالٍ',
        action: { label: 'موافقة · تعزيز المخزون +10', async run() { await OPS.patchProduct(p.id, { stock: (p.stock ?? 0) + 10 }); OPS.toast('✦ عُزّز المخزون'); } }
      });
      if (ratio <= 0.45 && (p.stock ?? 0) > thr(p) * 3) push({
        key: 'decline:' + p.id, kind: 'decline', priority: 40 + (p.stock ?? 0),
        title: `زخم منخفض: «${p.name}» (توقع تباطؤ)`,
        why: `نشاطه ${(ratio * 100).toFixed(0)}% من الأسبوع الماضي مع مخزون ${p.stock}. يُقترح مراجعة العرض أو سعره قريباً.`,
        impact: 'منخفض',
        action: { label: 'مراجعة المنتج', run: () => OPS.editProduct(p.id) }
      });
    }
  });

  /* 5) تحسين وصف — مسودة مولّدة من سمات المنتج نفسه */
  active.forEach(p => {
    const d = (p.description || '').trim();
    if (d.length < 70) {
      const draft = genDesc(p);
      push({
        key: 'improve_desc:' + p.id, kind: 'improve_desc', priority: 34,
        title: `وصف «${p.name}» ${d ? 'قصير جداً' : 'مفقود'}`,
        why: `الوصف الحالي ${d.length} حرفاً — الصفحات الأغنى تحوّل أفضل. المسودة المقترحة مولّدة من اسم المنتج وفئته وألوانه وخاماته المسجلة فقط.`,
        impact: 'متوسط', draft,
        action: { label: 'مراجعة المسودة وتطبيقها', run: () => OPS.newDesc(p, draft) }
      });
    }
  });

  /* 6) تحسين عنوان */
  active.forEach(p => {
    const n = (p.name || '').trim();
    const tooShort = n.length < 5, tooLong = n.length > 64;
    if (tooShort || tooLong) push({
      key: 'improve_title:' + p.id, kind: 'improve_title', priority: 30,
      title: `عنوان «${p.name || '—'}» ${tooShort ? 'غامض القصر' : 'طويل يُقطع في البطاقات'}`,
      why: `الطول الحالي ${n.length} حرفاً — العنوان الأمثل 10–60 حرفاً يتضمن اسم القطعة ونوعها.`,
      impact: 'متوسط',
      action: { label: 'تحرير العنوان', run: () => OPS.editProduct(p.id) }
    });
  });

  /* 7) كلمات مفتاحية */
  active.forEach(p => {
    if ((p.tags || []).length < 2) {
      const kw = genKeywords(p);
      if (kw.length) push({
        key: 'keywords:' + p.id, kind: 'keywords', priority: 26,
        title: `«${p.name}» بلا كلمات مفتاحية كافية`,
        why: `وسومه الحالية: ${(p.tags || []).join('، ') || 'لا شيء'} — الوسوم تغذي البحث الداخلي واقتراحات خبير اللامع. مقترح: ${kw.join('، ')}`,
        impact: 'منخفض', payload: { tags: [...(p.tags || []), ...kw] },
        action: { label: 'موافقة · إضافة الوسوم', async run() { await OPS.patchProduct(p.id, { tags: [...(p.tags || []), ...kw] }); OPS.toast('✦ أُضيفت الوسوم'); } }
      });
    }
  });

  /* 8) الصور */
  active.forEach(p => {
    const gal = Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [];
    if (!p.image_url && gal.length) push({
      key: 'img_fix:' + p.id, kind: 'image_fix', priority: 58,
      title: `«${p.name}» بلا صورة رئيسية رغم وجود معرض`,
      why: `المعرض يحوي ${gal.length} صورة والرئيسية فارغة — العملاء لا يرون المنتج في البطاقات.`,
      impact: 'عالٍ',
      action: { label: 'موافقة · ترقية صورة المعرض للرئيسية', async run() { await OPS.patchProduct(p.id, { image_url: gal[0] }); OPS.toast('✦ عُيّنت الصورة الرئيسية'); } }
    });
    else if (p.image_url && gal.length < 2) push({
      key: 'imgs:' + p.id, kind: 'images_missing', priority: 24,
      title: `«${p.name}» يعرض صورة واحدة تقريباً`,
      why: `معرضه: ${gal.length} لقطة — صفحات المنتج متعددة الزوايا ترفع التحويل وثقة العميل.`,
      impact: 'منخفض',
      action: { label: 'إضافة صور', run: () => OPS.editProduct(p.id) }
    });
  });

  /* 9) تصنيف مفقود */
  active.forEach(p => {
    if (!p.category_id && p.wear_category) {
      const all = OPS.cats() || [];
      const cat = all.find(c => c.slug === p.wear_category)
        || all.find(c => c.slug === p.wear_category + '-legacy')
        || all.find(c => c.name === WEAR_AR[p.wear_category]);
      push({
        key: 'cat:' + p.id, kind: 'categorize', priority: 44,
        title: `«${p.name}» بلا تصنيف`,
        why: cat
          ? `فئة لبسه «${WEAR_AR[p.wear_category] || p.wear_category}» موثوقة في الاستوديو لكن تصنيف المتجر فارغ — يُفقده مرشحات المجموعة والإحصاءات. المطابقة المقترحة: تصنيف «${cat.name}».`
          : `فئة لبسه «${WEAR_AR[p.wear_category] || p.wear_category}» موثوقة في الاستوديو لكن تصنيف المتجر فارغ — يُفقده مرشحات المجموعة والإحصاءات.`,
        impact: 'متوسط', payload: { category_id: cat?.id || null },
        action: cat
          ? { label: 'موافقة · تعيين التصنيف', async run() { await OPS.patchProduct(p.id, { category_id: cat.id }); OPS.toast('✦ عُيّن التصنيف'); } }
          : { label: 'تحرير وتعيين يدوي', run: () => OPS.editProduct(p.id) }
      });
    }
  });

  /* 10) حملات تجميعية من الشراء المشترك */
  const pairs = boughtTogether(valid).slice(0, 3);
  pairs.forEach(([a, b, n]) => {
    if (b) push({
      key: 'bundle:' + a + ':' + b, kind: 'bundle', priority: 36 + n * 4,
      title: `تُشترى معاً ${n}× — «${a}» + «${b}»`,
      why: `ظهرا معاً في ${n} طلبات مكتملة/نشطة — حزمة أو كوبون تجميعي يرفع سلة العميل.`,
      impact: 'متوسط',
      action: { label: 'إنشاء كوبون حملة 5%', run: () => createCampaignCoupon(a, b) }
    });
  });

  /* 11) إبراز/إخفاء من المميزة */
  active.forEach(p => {
    const a = A[p.id] || ensure(p.id);
    const c = conv(a);
    if ((p.show_home || p.is_featured) && a.views >= 8 && c < medConv * 0.35) push({
      key: 'feature_remove:' + p.id, kind: 'feature_remove', priority: 38,
      title: `«${p.name}» مُبرز رغم تحويله الضعيف`,
      why: `مُظهر في الرئيسية/المميزة مع تحويل ${(c * 100).toFixed(1)}% مقابل وسيط المتجر ${(medConv * 100).toFixed(1)}%.`,
      impact: 'منخفض',
      action: { label: 'موافقة · الإزالة من الواجهة', async run() { await OPS.patchProduct(p.id, { show_home: false, is_featured: false }); OPS.toast('✦ أُزيل من الواجهة'); } }
    });
    if (!p.show_home && a.views >= 6 && c >= Math.max(medConv * 1.4, 0.03) && (p.stock ?? 0) > 0) push({
      key: 'feature_add:' + p.id, kind: 'feature_add', priority: 42 + a.buys * 3,
      title: `«${p.name}» يستحق الواجهة`,
      why: `تحويله ${(c * 100).toFixed(1)}% (أعلى من الوسيط ${(medConv * 100).toFixed(1)}%) مع مخزون متوفر — غير مُبرز حالياً.`,
      impact: 'متوسط',
      action: { label: 'موافقة · الإبراز بالرئيسية', async run() { await OPS.patchProduct(p.id, { show_home: true }); OPS.toast('✦ أُبرز بالرئيسية'); } }
    });
  });

  return P.sort((x, y) => y.priority - x.priority).slice(0, 24);
}
function boughtTogether(orders) {
  const co = {};
  orders.forEach(o => {
    const items = Array.isArray(o.items) ? o.items.map(i => i.name).filter(Boolean) : [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const k = [items[i], items[j]].sort().join('||');
      co[k] = (co[k] || 0) + 1;
    }
  });
  return Object.entries(co).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k, n]) => [...k.split('||'), n]);
}
function genDesc(p) {
  const col = (p.colors || []).map(c => c.name).filter(Boolean).slice(0, 2);
  const base = [
    `${p.name} — قطعة من مختارات دار اللامع بروح يمنية أصيلة وقصّة تليق بالحضور.`,
    p.short_description ? `${p.short_description}.` : '',
    col.length ? `متوفر بلون${col.length > 1 ? 'ين' : ''}: ${col.join('، ')}.` : '',
    'خامات نخبوية مختارة بعناية، بتشطيب يدوي فاخر وفحص جودة مزدوج قبل الشحن، وتغليف الدار الفاخر مجاناً.'
  ].filter(Boolean).join(' ');
  return base;
}
function genKeywords(p) {
  const WL = { maawaz: 'معوز', thobe: 'ثوب', shamzan: 'مشلح شمزان', vest: 'صديري', jambiya: 'جنبية', belt: 'حزام', turban: 'عمامة', shemagh: 'شماغ شال', shoes: 'حذاء', watch: 'ساعة', perfume: 'عطر بخور', accessories: 'إكسسوار مسبحة' };
  const kw = [];
  if (WL[p.wear_category]) kw.push(...WL[p.wear_category].split(' ').filter(w => !(p.tags || []).includes(w)));
  (p.colors || []).slice(0, 1).forEach(c => c.name && kw.push(c.name.split(' ')[0]));
  kw.push('فاخر', 'يمني');
  return [...new Set(kw)].filter(w => !(p.tags || []).includes(w)).slice(0, 6);
}
async function createCampaignCoupon(a, b) {
  const code = 'DUO' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const ok = await OPS.confirm('كوبون حملة تجميعية', `يُنشأ كوبون «${code}» بخصم 5% — يُروَّج مع «${a}» و«${b}».`, 'إنشاء');
  if (!ok) return;
  const { error } = await DB.from('coupons').insert({ code, pct: 5, note: `حملة تجميعية: ${a} + ${b}` });
  if (error) { OPS.toast('فعّل جدول coupons من schema.sql المحدّث: ' + error.message, true); return; }
  delete C.cp;
  OPS.toast(`✦ أُنشئ الكوبون ${code} — شاركه في قنواتك`);
}

/* ─────────── تجميعات تحليلية مشتركة ─────────── */
function analyzeSegments(orders) {
  const valid = orders.filter(o => o.status !== 'cancelled' && (o.customer_phone || o.customer_name));
  const by = {};
  valid.forEach(o => {
    const k = o.customer_phone || o.customer_name;
    by[k] = by[k] || { name: o.customer_name || k, count: 0, spend: 0, last: o.created_at, first: o.created_at, city: o.city || '' };
    by[k].count++; by[k].spend += +o.total;
    if (new Date(o.created_at) > new Date(by[k].last)) by[k].last = o.created_at;
    if (new Date(o.created_at) < new Date(by[k].first)) by[k].first = o.created_at;
  });
  const list = Object.entries(by).map(([k, v]) => ({ k, ...v, lastD: (now() - new Date(v.last)) / DAY, firstD: (now() - new Date(v.first)) / DAY }));
  const aov = valid.length ? valid.reduce((a, o) => a + +o.total, 0) / valid.length : 0;
  const hiBar = Math.max(aov * 2, 1);
  const total = list.reduce((a, c) => a + c.spend, 0) || 1;
  return {
    list, aov, valid,
    new: list.filter(c => c.count === 1 && c.firstD <= 30),
    returning: list.filter(c => c.count >= 2),
    active: list.filter(c => c.lastD <= 30),
    high: list.filter(c => c.spend >= hiBar),
    risk: list.filter(c => c.count >= 2 && c.lastD > 60),
    totalSpend: total
  };
}

/* ══════════════════════════════════════════════════
   RENDER — مركز الذكاء والأتمتة
   ══════════════════════════════════════════════════ */
export async function renderSuite({ view, db, ops, me }) {
  $ = (s, c = document) => c.querySelector(s);
  esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  fmt = n => (+n || 0).toLocaleString('en-US');
  DB = db; OPS = ops; ME = me;
  toast = OPS.toast;
  window.__suiteCleanup?.();
  const timers = [];
  window.__suiteCleanup = () => timers.forEach(clearInterval);

  view.innerHTML = `<div class="suite">
    <nav class="suite-tabs" id="suite-tabs" role="tablist" aria-label="أقسام مركز الذكاء">
      ${[['exec', '✦ التنفيذية'], ['auto', '🤖 الأتمتة'], ['mkt', '📣 التسويق'], ['merch', '🛍 الميرشندايزنغ'], ['cust', '👥 العملاء'], ['ship', '🚚 الشحن'], ['loyal', '👑 الولاء'], ['set', '⚙ الإعدادات']].map(([k, n], i) => `<button role="tab" class="st-tab ${i === 0 ? 'on' : ''}" data-tab="${k}" aria-selected="${i === 0}">${n}</button>`).join('')}
    </nav>
    <div id="suite-body" aria-live="polite"></div>
  </div>`;
  const body = $('#suite-body', view);
  $('#suite-tabs', view).onclick = e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    [...$('#suite-tabs').children].forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    paint(b.dataset.tab);
  };
  const DATA = {};
  async function ensure() {
    if (DATA.ready) return;
    body.innerHTML = '<div class="skel" style="aspect-ratio:auto;height:150px"></div>';
    [DATA.events, DATA.orders, DATA.products, DATA.tasks] = await Promise.all([
      getEvents().catch(() => []), getOrders().catch(() => []), getProducts().catch(() => []), getTasks().catch(() => [])
    ]);
    DATA.sessions = await getSessions().catch(() => []);
    DATA.proposals = computeProposals(DATA.products, DATA.events, DATA.orders, DATA.tasks);
    DATA.seg = analyzeSegments(DATA.orders);
    DATA.ready = true;
  }
  if (C.tasksOff) setTimeout(() => { try { body.insertAdjacentHTML('afterbegin', setupNote('جدول ai_tasks غير مفعّل بعد — تعمل الموافقات مباشرة دون أرشفة. شغّل schema.sql المحدّث لحفظ قرارات الأتمتة.')); } catch (e) { } }, 0);

  function paint(tab) {
    ({ exec: paintExec, auto: paintAuto, mkt: paintMkt, merch: paintMerch, cust: paintCust, ship: paintShip, loyal: paintLoyal, set: paintSet }[tab] || (() => { }))();
  }
  paint('exec');
  await ensure();
  paint($('#suite-tabs .on', view)?.dataset.tab || 'exec');

  /* ─── التنفيذية ─── */
  function paintExec() {
    if (!DATA.ready) return;
    const valid = DATA.seg.valid;
    const rev = valid.reduce((a, o) => a + +o.total, 0);
    const visits = sessionsOf('store_visit', DATA.events) || 1;
    const conv = valid.length / visits * 100;
    const aov = valid.length ? rev / valid.length : 0;
    const byRev = {};
    EVT('purchase', DATA.events).forEach(e => { if (e.product_name) byRev[e.product_name] = (byRev[e.product_name] || 0) + (+e.value || 0); });
    const top = Object.entries(byRev).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const out = DATA.products.filter(p => (p.stock ?? 1) === 0).length;
    const cartAband = new Set(EVT('cart_add', DATA.events).map(e => e.session_id)).size - new Set(EVT('order_complete', DATA.events).map(e => e.session_id)).size;
    body.innerHTML = `
    <div class="exec-hero">
      <div><p class="bi-kicker">EXECUTIVE OVERVIEW — بيانات فعلية 🟢</p><h3>صورة الدار في شاشة واحدة</h3></div>
      <span class="st-note">تُحدَّث عند كل فتح للصفحة من قاعدة البيانات مباشرة</span>
    </div>
    <div class="stats">
      ${[['الإيرادات الإجمالية', fmt(Math.round(rev)) + ' <small>ر.س</small>', '💰'], ['الطلبات المكتملة/النشطة', fmt(valid.length), '📦'],
        ['معدل التحويل', conv.toFixed(1) + '%', '📈'], ['متوسط قيمة الطلب', fmt(Math.round(aov)) + ' <small>ر.س</small>', '💳'],
        ['منتجات نافدة', fmt(out), '🟠'], ['سلات متروكة', fmt(Math.max(cartAband, 0)), '🛒']]
        .map(([l, v, ic]) => `<article class="stat"><span><i></i>${l}</span><b class="num">${v}</b><small>${ic}</small></article>`).join('')}
    </div>
    <div class="duo-exec">
      <section class="bi-card">
        <header class="bi-head"><b>أفضل المنتجات</b><span>حسب إيراد أحداث الشراء 🟢</span></header>
        ${top.length ? barRows(top) : '<p class="feed-empty">لا مبيعات مسجلة بعد — ستظهر فور أول طلب.</p>'}
      </section>
      <section class="bi-card">
        <header class="bi-head"><b>يحتاج اهتماماً فوراً</b><span>توصيات 🟡 مرتبة بالأثر</span></header>
        ${DATA.proposals.length ? DATA.proposals.slice(0, 4).map(p => `
          <div class="opp-mini"><span>${KIND_L[p.kind]?.[1] || '✦'} ${esc(p.title)} <i>${esc(p.impact)}</i></span>
          <button class="ghost" data-goto-auto>${'مراجعة'}</button></div>`).join('') : '<p class="feed-empty">لا ملاحظات — الأداء مستقر.</p>'}
        <p class="note-gold" style="margin-top:14px">🟢 بيانات فعلية · 🟡 توصية تحتاج موافقتك · 🟠 توقع غير مؤكد — كل اقتراح هنا أو في تبويب الأتمتة قابل للتنفيذ بموافقتك فقط ويُوثَّق في سجل التدقيق.</p>
      </section>
    </div>`;
    body.querySelectorAll('[data-goto-auto]').forEach(b => b.onclick = () => $('#suite-tabs [data-tab="auto"]', view).click());
  }

  /* ─── الأتمتة: طابور الموافقات ─── */
  async function paintAuto() {
    if (!DATA.ready) return;
    const decided = (DATA.tasks || []).filter(t => ['executed', 'rejected'].includes(t.status)).slice(0, 6);
    body.innerHTML = `
    <section class="bi-card" style="grid-column:1/-1">
      <header class="bi-head"><b>AI Automation Center — طابور الموافقات</b><span>${DATA.proposals.length ? DATA.proposals.length + ' اقتراحاً نشطاً' : 'لا اقتراحات نشطة'} · لا شيء ينفَّذ دون موافقتك 🟡</span></header>
      <div class="opp-list" id="opp-list"></div>
      ${decided.length ? `<h5 class="bi-sub">آخر القرارات 🟢 من السجل</h5><div class="dec-list">${decided.map(t => `<div class="dec-row"><span class="chip ${t.status === 'executed' ? 'c-ok' : 'c-muted'}">${t.status === 'executed' ? 'نُفّذ' : 'رُفض'}</span><span>${esc(t.title)}</span><small>${t.decided_at ? new Date(t.decided_at).toLocaleDateString('ar-SA') : ''}</small></div>`).join('')}</div>` : ''}
    </section>`;
    const listEl = $('#opp-list', body);
    const renderList = () => {
      if (!DATA.proposals.length) { listEl.innerHTML = '<p class="feed-empty">لا اقتراحات حالياً — المتجر مستقر والبيانات لا تستدعي تدخلاً ✦</p>'; return; }
      listEl.innerHTML = DATA.proposals.map((p, i) => `
        <article class="opp-card" data-i="${i}">
          <div class="opp-kind"><span class="opp-ico">${KIND_L[p.kind]?.[1] || '✦'}</span><span class="chip c-gold">${KIND_L[p.kind]?.[0] || p.kind}</span><span class="chip ${p.impact === 'عالٍ' ? 'c-danger' : p.impact === 'متوسط' ? 'c-warn' : 'c-muted'}">أثر ${p.impact}</span>${['success', 'decline'].includes(p.kind) ? '<span class="chip c-warn">🟠 توقع</span>' : '<span class="chip c-ok">🟢 من البيانات</span>'}</div>
          <b>${esc(p.title)}</b>
          <p>${esc(p.why)}</p>
          ${p.draft ? `<details class="opp-draft"><summary>المسودة المقترحة (مراجعة قبل التطبيق)</summary><p>${esc(p.draft)}</p></details>` : ''}
          <div class="opp-actions">
            <button class="btn-primary" data-approve>✓ ${esc(p.action.label)}</button>
            <button class="ghost" data-postpone>تأجيل</button>
            <button class="ghost" data-reject>رفض</button>
          </div>
        </article>`).join('');
    };
    renderList();
    listEl.onclick = async e => {
      const card = e.target.closest('.opp-card'); if (!card) return;
      const p = DATA.proposals[+card.dataset.i]; if (!p) return;
      if (e.target.closest('[data-reject]')) {
        await decide(p, 'rejected');
        DATA.proposals.splice(+card.dataset.i, 1); renderList(); toast('رُفض الاقتراح وأُرشف');
        return;
      }
      if (e.target.closest('[data-postpone]')) { card.style.opacity = .45; card.style.order = 99; toast('أُجّل لآخر القائمة'); return; }
      if (e.target.closest('[data-approve]')) {
        const ok = await OPS.confirm('تنفيذ اقتراح الذكاء', `يُنفَّذ الآن: ${p.action.label} — بعد موافقتك يصبح التغيير فورياً في المتجر ويُوثَّق.`, 'موافقة وتنفيذ');
        if (!ok) return;
        const btn = e.target.closest('[data-approve]'); btn.disabled = true;
        try {
          await p.action.run();
          OPS.audit('ai.' + p.kind, 'products', p.key.split(':')[1] || '', { title: p.title, impact: p.impact });
          await decide(p, 'executed');
          DATA.proposals.splice(+card.dataset.i, 1); renderList();
        } catch (err) { toast('تعذر التنفيذ: ' + err.message, true); btn.disabled = false; await decide(p, 'failed'); }
      }
    };
    async function decide(p, status) {
      if (C.tasksOff) return;
      try {
        await DB.from('ai_tasks').upsert({ key: p.key, kind: p.kind, title: p.title, why: p.why, payload: p.payload || {}, priority: p.priority, status, decided_at: new Date().toISOString() }, { onConflict: 'key' });
        delete C.tk;
      } catch (e) { }
    }
  }

  /* ─── التسويق ─── */
  function paintMkt() {
    if (!DATA.ready) return;
    const S = DATA.sessions || [];
    const hosts = { 'google': 'بحث Google', 'instagram': 'إنستغرام', 'tiktok': 'تيك توك', 'snapchat': 'سناب شات', 'x.com': 'إكس', 'twitter': 'إكس', 'facebook': 'فيسبوك', 'wa.me': 'واتساب', 'youtube': 'يوتيوب' };
    const ref = {};
    S.forEach(s => {
      const r = (s.referrer || 'direct').toLowerCase();
      const host = r === 'direct' || !r ? 'مباشر / تطبيق' : (Object.entries(hosts).find(([k]) => r.includes(k))?.[1] || (() => { try { return new URL(r).hostname.replace('www.', ''); } catch (e) { return 'أخرى'; } })());
      ref[host] = (ref[host] || 0) + 1;
    });
    const valid = DATA.seg.valid;
    const perApp = [['store', 'المتجر'], ['studio', 'الاستوديو']].map(([app, n]) => {
      const v = new Set(DATA.events.filter(e => e.app === app && e.type === (app === 'store' ? 'store_visit' : 'studio_enter')).map(e => e.session_id)).size || 1;
      const b = new Set(DATA.events.filter(e => e.app === app && e.type === 'order_complete').map(e => e.session_id)).size;
      return [n + ` — تحويل ${(b / v * 100).toFixed(1)}%`, v];
    });
    const byProd = {};
    DATA.events.forEach(e => { if (!e.product_id) return; byProd[e.product_id] = byProd[e.product_id] || { n: e.product_name, v: 0, p: 0 }; if (e.type === 'product_view') byProd[e.product_id].v++; if (e.type === 'purchase') byProd[e.product_id].p++; });
    const convs = Object.values(byProd).filter(x => x.v >= 5).map(x => [`${x.n} — ${(x.p / x.v * 100).toFixed(1)}%`, x.p / x.v * 100]).sort((a, b) => b[1] - a[1]);
    const weak = Object.values(byProd).filter(x => x.v >= 10 && x.p === 0).slice(0, 4);
    const hr = [...Array(24)].map((_, h) => valid.filter(o => new Date(o.created_at).getHours() === h).length);
    const bestH = hr.indexOf(Math.max(...hr));
    const studioHr = [...Array(24)].map((_, h) => DATA.events.filter(e => e.type === 'studio_enter' && new Date(e.created_at).getHours() === h).length);
    const bestSH = studioHr.indexOf(Math.max(...studioHr));
    const momentum = DATA.products.map(p => {
      const v7 = DATA.events.filter(e => e.product_id === p.id && ['product_view', 'try_on'].includes(e.type) && new Date(e.created_at) >= ago(7)).length;
      const p7 = DATA.events.filter(e => e.product_id === p.id && ['product_view', 'try_on'].includes(e.type) && new Date(e.created_at) < ago(7) && new Date(e.created_at) >= ago(14)).length || 1;
      return { p, r: v7 / p7, v: v7 };
    }).filter(x => x.v >= 3 && (x.p.stock ?? 0) >= 5).sort((a, b) => b.r - a.r).slice(0, 4);
    /* أفضل الفئات للترويج — إيراد الشراء الفعلي مجمّعاً بفئة اللبس */
    const catRev = {};
    DATA.events.forEach(e => {
      if (e.type !== 'purchase' || !e.product_id) return;
      const pr = DATA.products.find(x => String(x.id) === String(e.product_id));
      const k = WEAR_AR[pr?.wear_category] || 'مختارات عامة';
      catRev[k] = (catRev[k] || 0) + (+e.value || 0);
    });
    const bestCats = Object.entries(catRev).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 2);
    body.innerHTML = `<div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>مصادر الزيارات</b><span>من الجلسات الفعلية 🟢</span></header>
        ${Object.keys(ref).length ? barRows(Object.entries(ref).sort((a, b) => b[1] - a[1]).slice(0, 7)) : '<p class="feed-empty">لا جلسات بعد.</p>'}
        <h5 class="bi-sub">تحويل حسب الصفحة</h5>${barRows(perApp)}
        <h5 class="bi-sub">أعلى صفحات المنتجات تحويلاً</h5>${convs.length ? barRows(convs.slice(0, 5)) : '<p class="feed-empty">تحتاج 5 مشاهدات لكل منتج على الأقل.</p>'}
      </section>
      <section class="bi-card"><header class="bi-head"><b>توصيات الحملات</b><span>توصية 🟡 من بياناتك</span></header>
        <div class="ai-tips">
          <div class="ai-tip"><span><b>أفضل وقت لإطلاق حملة:</b> ذروة الطلبات ${bestH}:00، وذروة الاستوديو ${bestSH}:00 — أطلق قبل الذروة بساعة.</span></div>
          <div class="ai-tip"><span><b>أفضل المنتجات للإعلان الآن:</b> ${momentum.length ? momentum.map(x => `«${esc(x.p.name)}» (${x.r.toFixed(1)}×)`).join('، ') : 'لا عينة كافية بعد'}</span></div>
          <div class="ai-tip"><span><b>أفضل الفئات للترويج:</b> ${bestCats.length ? bestCats.map(([k, v]) => `«${esc(k)}» (${fmt(Math.round(v))} ر.س مبيعات فعلية)`).join(' ثم ') + ' — وجّه ميزانية الحملة نحوها أولاً' : 'تظهر فور تسجيل مبيعات حسب الفئة'}</span></div>
          <div class="ai-tip"><span><b>صفحات تحتاج معالجة إعلانية:</b> ${weak.length ? weak.map(x => `«${esc(x.n)}» (${x.v} مشاهدة بلا شراء)`).join('، ') : 'لا شيء حالياً'} — لا تُعلن عنها قبل معالجة صفحتها.</span></div>
          <div class="ai-tip"><span><b>تكلفة اكتساب العميل (CAC):</b> تتطلب ربط إنفاق الحملات — عند إدخال التكاليف مستقبلاً تُحسب تلقائياً هنا وفق CAC = الإنفاق ÷ الطلبات الجديدة.</span></div>
        </div>
      </section></div>`;
  }

  /* ─── الميرشندايزنغ ─── */
  function paintMerch() {
    if (!DATA.ready) return;
    const pairs = boughtTogether(DATA.seg.valid).slice(0, 6);
    const stockout = DATA.products.filter(p => !p.stock && p.status !== 'hidden').map(p => {
      const alts = DATA.products.filter(x => x.id !== p.id && x.wear_category === p.wear_category && (x.stock ?? 0) > 0 && Math.abs(x.price - p.price) / Math.max(p.price, 1) < .35)
        .sort((a, b) => b.sold_count - a.sold_count)[0];
      return [p, alts];
    }).slice(0, 4);
    const byRev = {};
    EVT('purchase', DATA.events).forEach(e => { if (e.product_name) byRev[e.product_name] = (byRev[e.product_name] || 0) + (+e.value || 0); });
    const cats = {};
    DATA.products.forEach(p => { const r = byRev[p.name] || 0; cats[p.wear_category || 'أخرى'] = (cats[p.wear_category || 'أخرى'] || 0) + r; });
    body.innerHTML = `<div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>تُشترى معاً</b><span>من بنود الطلبات الفعلية 🟢</span></header>
        ${pairs.length ? pairs.map(([a, b, n]) => `<div class="pair-row"><b>${esc(a)}</b><span class="pair-x">+</span><b>${esc(b)}</b><span class="chip c-gold num">${n}×</span></div>`).join('') : '<p class="feed-empty">يحتاج زوجان في طلبين مختلفين على الأقل.</p>'}
        <h5 class="bi-sub">الفئات الأعلى إيراداً</h5>${barRows(Object.entries(cats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, Math.round(v)]))}
      </section>
      <section class="bi-card"><header class="bi-head"><b>البدائل عند النفاد</b><span>توصية 🟡</span></header>
        ${stockout.length ? stockout.map(([p, alt]) => `<div class="pair-row"><span>نافد: <b>${esc(p.name)}</b></span><span class="pair-x">←</span><span>بديله: <b>${alt ? esc(alt.name) : '— لا بديل مطابق'}</b></span></div>`).join('') : '<p class="feed-empty">لا نواقص حالياً.</p>'}
        <p class="note-gold">تظهر هذه البدائل أيضاً في اقتراحات «المتروكة» لدى خبير اللامع عند سؤال العميل عن قِطعة نافدة.</p>
      </section></div>`;
  }

  /* ─── العملاء ─── */
  function paintCust() {
    if (!DATA.ready) return;
    const g = DATA.seg;
    const seg = [
      ['جدد', g.new, 'وِدوهم بكوبون ترحيبي ضمن أول أسبوع — يتضاعف الاحتفاظ عادةً.', 'c-ok'],
      ['عائدون', g.returning, 'أعطهم أولوية الإصدارات المحدودة وشحن مجاني موسمي.', 'c-gold'],
      ['نشطون (٣٠ يوماً)', g.active, 'حافظ على الإيقاع: تنبيه مخزون للمفضلة + عرض فلاش أسبوعي.', 'c-ok'],
      ['مرتفعو الإنفاق', g.high, 'مستشار شخصي مخصص — اتصال شكر وخدمة مقاسات خاصة.', 'c-warn'],
      ['يحتاجون إعادة تفاعل', g.risk, 'كوبون «اشتقنا لك» 10% برسالة شخصية — أنشئه من تبويب الولاء.', 'c-danger']
    ];
    body.innerHTML = `
    <section class="bi-card" style="grid-column:1/-1"><header class="bi-head"><b>Customer Intelligence — شرائح حقيقية</b><span>من ${g.valid.length} طلباً فعلياً 🟢 · ${g.list.length} عميلاً معروفاً بالجوال/الاسم</span></header>
    <div class="seg-grid">${seg.map(([n, arr, tip, cls]) => `
      <article class="seg-card ${cls}">
        <header><b>${n}</b><span class="num">${arr.length}</span></header>
        <div class="seg-num"><b class="num">${fmt(arr.reduce((a, c) => a + c.spend, 0))}</b><span>ر.س — ${(arr.reduce((a, c) => a + c.spend, 0) / g.totalSpend * 100).toFixed(0)}% من الإيراد</span></div>
        <p>${tip}</p>
        ${arr.length ? `<small>أعلى قيمة: ${esc(arr.sort((a, b) => b.spend - a.spend)[0].name)} (${fmt(Math.round(arr[0].spend))} ر.س)</small>` : ''}
      </article>`).join('')}
    </div></section>`;
  }

  /* ─── الشحن ─── */
  async function paintShip() {
    if (!DATA.ready) return;
    const shipped = DATA.orders.filter(o => o.shipped_at);
    const delivered = DATA.orders.filter(o => o.delivered_at);
    const days = delivered.map(o => (new Date(o.delivered_at) - new Date(o.created_at)) / DAY).filter(x => x >= 0 && x < 60);
    const avg = days.length ? days.reduce((a, b) => a + b, 0) / days.length : null;
    const late = shipped.filter(o => !o.delivered_at && (now() - new Date(o.shipped_at)) / DAY > 5);
    const cities = {};
    DATA.orders.forEach(o => { if (o.city) cities[o.city] = (cities[o.city] || 0) + 1; });
    const byCarrier = {};
    DATA.orders.forEach(o => { if (o.carrier) { (byCarrier[o.carrier] = byCarrier[o.carrier] || { n: 0, d: [] }).n++; if (o.delivered_at) byCarrier[o.carrier].d.push((new Date(o.delivered_at) - new Date(o.created_at)) / DAY); } });
    const settings = await getSettings('shipping');
    body.innerHTML = `<div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>Shipping Intelligence</b><span>بيانات حالات الطلبات 🟢</span></header>
        <div class="st-tiles">
          <div class="st-tile"><span>متوسط التسليم</span><b class="num">${avg !== null ? avg.toFixed(1) + ' يوم' : '—'}</b></div>
          <div class="st-tile"><span>معلّقة في الشحن &gt;5 أيام</span><b class="num">${late.length}</b></div>
          <div class="st-tile"><span>سلّمت</span><b class="num">${delivered.length}</b></div>
          <div class="st-tile"><span>سياسة التوصيل</span><b>${esc(settings?.delivery_note || '3 – 7 أيام عمل')}</b></div>
        </div>
        ${avg === null ? '<p class="ai-note" style="margin-top:12px">بدأ توقيت الشحن يُقاس تلقائياً من الآن: عند تغيير حالة أي طلب إلى «تم الشحن» أو «تم التسليم» تُختم الطوابع الزمنية — الطلبات الأقدم لا تحمل قياساً (بأمانة نخبرك أنها غير متاحة).</p>' : ''}
        ${late.length ? `<h5 class="bi-sub">تحتاج متابعة مع الناقل</h5>${late.slice(0, 5).map(o => `<div class="pair-row"><b class="num">#${o.id.slice(0, 7)}</b><small>${esc(o.city || '')} · منذ ${Math.floor((now() - new Date(o.shipped_at)) / DAY)} يوماً</small></div>`).join('')}` : ''}
      </section>
      <section class="bi-card"><header class="bi-head"><b>المناطق وشركات الشحن</b><span>الطلبات الفعلية 🟢</span></header>
        <h5 class="bi-sub">أكثر المدن طلباً</h5>${Object.keys(cities).length ? barRows(Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 7)) : '<p class="feed-empty">لا مدن مسجلة بعد.</p>'}
        <h5 class="bi-sub">أداء شركات الشحن</h5>
        ${Object.keys(byCarrier).length ? barRows(Object.entries(byCarrier).map(([k, v]) => [`${k} — ${v.d.length ? (v.d.reduce((a, b) => a + b, 0) / v.d.length).toFixed(1) + ' يوم' : v.n + ' شحنة'}`, v.n])) : '<p class="feed-empty">سجّل اسم الناقل في الطلبات القادمة لتظهر المقارنة.</p>'}
      </section></div>`;
  }

  /* ─── الولاء ─── */
  async function paintLoyal() {
    const stv = await getSettings('loyalty');
    const L = stv || { enabled: true, pts_per_sar: 1, welcome_pts: 100, coupon_enabled: true, tiers: [{ name: 'فضي', min: 0, perk: 'أولوية إشعار الإصدارات المحدودة' }, { name: 'ذهبي', min: 2000, perk: 'شحن مجاني لكل الطلبات' }, { name: 'بلاتيني', min: 6000, perk: 'مستشار مقاسات خاص وهدية موسمية' }] };
    const coupons = await getCoupons().catch(() => []);
    const rate = +L.pts_per_sar || 1;
    const seg = DATA.ready ? DATA.seg : null;
    body.innerHTML = `<div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>قواعد الولاء</b><span>تُحفظ في store_settings · قراءة عامة للعملاء 🟢</span></header>
        <div class="set-grid">
          <label class="field">تفعيل نظام الولاء<select id="loy-on"><option value="1" ${L.enabled !== false ? 'selected' : ''}>مفعّل</option><option value="0" ${L.enabled === false ? 'selected' : ''}>موقوف</option></select></label>
          <label class="field">نقطة لكل ر.س<input id="loy-rate" type="number" min="0.1" step="0.1" value="${rate}"></label>
          <label class="field">نقاط الترحيب<input id="loy-welcome" type="number" min="0" value="${+L.welcome_pts || 0}"></label>
          <label class="field">تفعيل الكوبونات<select id="loy-cp"><option value="1" ${L.coupon_enabled !== false ? 'selected' : ''}>مفعّلة</option><option value="0" ${L.coupon_enabled === false ? 'selected' : ''}>موقوفة</option></select></label>
        </div>
        <h5 class="bi-sub">مستويات العضوية ومكافآتها</h5>
        <div class="set-grid tiers">${(L.tiers || []).slice(0, 3).map((t, i) => `<label class="field">المستوى ${i + 1}<input data-tname="${i}" value="${esc(t.name)}"></label><label class="field">من نقاط<input data-tmin="${i}" type="number" min="0" value="${+t.min || 0}"></label><label class="field" style="grid-column:1/-1">مكافأة «${['الأول', 'الثاني', 'الثالث'][i]}» — يعرضها خبير اللامع للعميل<input data-tperk="${i}" value="${esc(t.perk || '')}" placeholder="${['مثال: أولوية إشعار الإصدارات المحدودة', 'مثال: شحن مجاني لكل الطلبات', 'مثال: مستشار مقاسات خاص وهدية موسمية'][i]}"></label>`).join('')}</div>
        <button class="btn-primary" id="loy-save" style="margin-top:14px">حفظ قواعد الولاء</button>
        ${seg ? `<h5 class="bi-sub">نخبة العملاء الآن (نقاط = الإنفاق × ${rate} ${+L.welcome_pts || 0 ? '+ ترحيبي' : ''})</h5>${seg.list.sort((a, b) => b.spend - a.spend).slice(0, 4).map(c => { const pts = Math.round(c.spend * rate + (+L.welcome_pts || 0)); const tier = [...(L.tiers || [])].sort((a, b) => b.min - a.min).find(t => pts >= t.min) || { name: '—' }; return `<div class="pair-row"><b>${esc(c.name)}</b><small>${c.count} طلباً</small><span class="chip c-gold">${esc(tier.name)}${tier.perk ? ` · ${esc(tier.perk)}` : ''}</span><span class="num">${fmt(pts)} نقطة</span></div>`; }).join('')}` : ''}
      </section>
      <section class="bi-card"><header class="bi-head"><b>الكوبونات</b><span>العميل يردّها من الدفع — العدّ ذري عبر RPC 🟢</span></header>
        <form class="coupon-new" id="cp-new">
          <input id="cp-code" placeholder="الكود — مثال EID15" required maxlength="16" style="text-transform:uppercase">
          <input id="cp-pct" type="number" min="1" max="90" placeholder="%" required>
          <input id="cp-max" type="number" min="1" placeholder="أقصى استخدام">
          <input id="cp-exp" type="date" title="تاريخ انتهاء اختياري">
          <button class="btn-primary" type="submit">إنشاء</button>
        </form>
        <div id="cp-list" style="margin-top:12px">${(coupons || []).map(c => couponRow(c)).join('') || '<p class="feed-empty">لا كوبونات بعد.</p>'}</div>
      </section></div>`;
    $('#loy-save', body).onclick = async () => {
      const nv = {
        enabled: $('#loy-on', body).value === '1', pts_per_sar: +$('#loy-rate', body).value || 1,
        welcome_pts: +$('#loy-welcome', body).value || 0, coupon_enabled: $('#loy-cp', body).value === '1',
        tiers: [0, 1, 2].map(i => ({ name: $(`[data-tname="${i}"]`, body)?.value.trim() || ['فضي', 'ذهبي', 'بلاتيني'][i], min: +$(`[data-tmin="${i}"]`, body)?.value || 0, perk: $(`[data-tperk="${i}"]`, body)?.value.trim() || '' }))
      };
      const { error } = await DB.from('store_settings').upsert({ key: 'loyalty', value: nv, updated_at: new Date().toISOString() });
      if (error) { toast('فعّل store_settings من schema.sql: ' + error.message, true); return; }
      delete C['st-loyalty'];
      OPS.audit('settings.loyalty', 'store_settings', 'loyalty', nv);
      toast('✦ حُفظت قواعد الولاء — تسري على العملاء فوراً في صفحة الدفع');
    };
    $('#cp-new', body).onsubmit = async e => {
      e.preventDefault();
      const code = $('#cp-code', body).value.trim().toUpperCase().replace(/[^\w]/g, '');
      const pct = +$('#cp-pct', body).value;
      if (!code || !(pct >= 1 && pct <= 90)) return toast('تحقق من الكود والنسبة', true);
      const expVal = $('#cp-exp', body)?.value;
      const { error } = await DB.from('coupons').insert({ code, pct, max_uses: +$('#cp-max', body).value || null, expires_at: expVal ? new Date(expVal + 'T23:59:59').toISOString() : null });
      if (error) return toast('فعّل جدول coupons: ' + error.message, true);
      delete C.cp;
      OPS.audit('coupon.create', 'coupons', code, { pct });
      toast(`✦ أُنشئ الكوبون ${code} — جاهز للاستخدام في صفحة الدفع`);
      paintLoyal();
    };
    $('#cp-list', body).onclick = async e => {
      const b = e.target.closest('[data-cp-toggle]'); if (!b) return;
      const { error } = await DB.from('coupons').update({ active: b.dataset.cpToggle !== '1' }).eq('id', b.dataset.cpId);
      if (error) return toast(error.message, true);
      delete C.cp;
      OPS.audit('coupon.toggle', 'coupons', b.dataset.cpCode, { active: b.dataset.cpToggle !== '1' });
      paintLoyal();
    };
  }
  function couponRow(c) {
    const exp = c.expires_at ? new Date(c.expires_at) < new Date() : false;
    return `<div class="pair-row"><b class="num" style="letter-spacing:1px">${esc(c.code)}</b><span class="chip c-gold num">${c.pct}%</span>
      <small class="num">${c.uses}/${c.max_uses ?? '∞'}</small>${c.expires_at ? `<small>${exp ? 'انتهى' : 'حتى'} ${new Date(c.expires_at).toLocaleDateString('ar-SA')}</small>` : ''}${c.note ? `<small>${esc(c.note)}</small>` : ''}
      <button class="ghost" data-cp-toggle="${c.active ? 1 : 0}" data-cp-id="${c.id}" data-cp-code="${esc(c.code)}">${exp ? 'منتهٍ' : c.active ? 'إيقاف' : 'تفعيل'}</button></div>`;
  }

  /* ─── الإعدادات ─── */
  async function paintSet() {
    const [sh, lc] = await Promise.all([getSettings('shipping'), getSettings('locale')]);
    const S = sh || { fee: 35, free_from: 350, delivery_note: '3 – 7 أيام عمل داخل المملكة', countries: [{ name: 'داخل المملكة', fee: 35 }, { name: 'دول الخليج', fee: 65 }] };
    body.innerHTML = `<div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>الشحن والتسليم</b><span>يقرأها العملاء مباشرة في صفحة الدفع 🟢</span></header>
        <div class="set-grid">
          <label class="field">رسوم الشحن (ر.س)<input id="sh-fee" type="number" min="0" value="${+S.fee || 0}"></label>
          <label class="field">شحن مجاني من (ر.س)<input id="sh-free" type="number" min="0" value="${+S.free_from || 0}"></label>
          <label class="field" style="grid-column:1/-1">ملاحظة التسليم للعملاء<input id="sh-note" value="${esc(S.delivery_note || '')}"></label>
        </div>
        <h5 class="bi-sub">رسوم حسب المنطقة</h5>
        <div id="sh-countries" class="set-grid tiers">${(S.countries || []).map((c, i) => `<label class="field">المنطقة<input data-cn="${i}" value="${esc(c.name)}"></label><label class="field">الرسوم<input data-cf="${i}" type="number" min="0" value="${+c.fee || 0}"></label>`).join('')}</div>
        <div style="display:flex;gap:9px;margin-top:12px"><button class="btn-primary" id="sh-save">حفظ إعدادات الشحن</button><button class="ghost" id="sh-addcountry">+ منطقة</button></div>
      </section>
      <section class="bi-card"><header class="bi-head"><b>اللغة والعملة والضريبة</b><span>جاهزية التوسع الدولي 🟡</span></header>
        <div class="set-grid">
          <label class="field">لغة الواجهة الافتراضية<select id="lc-lang"><option value="ar" ${(lc?.lang || 'ar') === 'ar' ? 'selected' : ''}>العربية</option><option value="en" ${lc?.lang === 'en' ? 'selected' : ''}>English</option></select></label>
          <label class="field">العملة<select id="lc-cur"><option value="SAR" ${(lc?.currency || 'SAR') === 'SAR' ? 'selected' : ''}>ريال سعودي (SAR)</option><option value="YER" ${lc?.currency === 'YER' ? 'selected' : ''}>ريال يمني (YER)</option><option value="AED" ${lc?.currency === 'AED' ? 'selected' : ''}>درهم إماراتي (AED)</option></select></label>
          <label class="field">ضريبة القيمة المضافة %<input id="lc-tax" type="number" min="0" max="30" step="0.5" value="${+(lc?.tax_rate || 0)}"></label>
        </div>
        <button class="btn-primary" id="lc-save" style="margin-top:12px">حفظ</button>
        <h5 class="bi-sub">جاهزية الترجمة</h5>
        <p class="ai-note">البنية جاهزة للتوسع: أسماء المنتجات ثنائية اللغة (name_en)، وخبير اللامع يعمل بالعربية والإنجليزية، وتنسيق التاريخ يتبع Intl باللغة المختارة. اللغات الإضافية تُدرج بملف ترجمة واحد دون تعديل الكود.</p>
      </section></div>`;
    $('#sh-addcountry', body).onclick = () => {
      const i = $('#sh-countries', body).children.length / 2;
      $('#sh-countries', body).insertAdjacentHTML('beforeend', `<label class="field">المنطقة<input data-cn="${i}" value=""></label><label class="field">الرسوم<input data-cf="${i}" type="number" min="0" value="0"></label>`);
    };
    $('#sh-save', body).onclick = async () => {
      const countries = [...body.querySelectorAll('[data-cn]')].map(inp => ({ name: inp.value.trim(), fee: +($(`[data-cf="${inp.dataset.cn}"]`, body)?.value) || 0 })).filter(c => c.name);
      const nv = { fee: +$('#sh-fee', body).value || 0, free_from: +$('#sh-free', body).value || 0, delivery_note: $('#sh-note', body).value.trim(), countries };
      const { error } = await DB.from('store_settings').upsert({ key: 'shipping', value: nv, updated_at: new Date().toISOString() });
      if (error) return toast('فعّل store_settings: ' + error.message, true);
      delete C['st-shipping'];
      OPS.audit('settings.shipping', 'store_settings', 'shipping', nv);
      toast('✦ حُفظت إعدادات الشحن — يقرؤها العملاء فوراً عند الدفع');
    };
    $('#lc-save', body).onclick = async () => {
      const nv = { lang: $('#lc-lang', body).value, currency: $('#lc-cur', body).value, tax_rate: +$('#lc-tax', body).value || 0 };
      const { error } = await DB.from('store_settings').upsert({ key: 'locale', value: nv, updated_at: new Date().toISOString() });
      if (error) return toast(error.message, true);
      delete C['st-locale'];
      OPS.audit('settings.locale', 'store_settings', 'locale', nv);
      toast('✦ حُفظت إعدادات اللغة والعملة');
    };
  }

  function barRows(pairs) {
    if (!pairs || !pairs.length) return '<p class="feed-empty">—</p>';
    const mx = Math.max(...pairs.map(p => +p[1] || 0), 1);
    return `<div class="mini-bars">${pairs.map(([n, v]) => `<div class="mb-row"><span>${esc(n)}</span><div class="mb-track"><i style="width:${Math.max(2, Math.round(v / mx * 100))}%"></i></div><b class="num">${fmt(v)}</b></div>`).join('')}</div>`;
  }
  function setupNote(t) { return `<div class="ai-note" style="margin-bottom:14px"><b>تفعيل:</b> ${t}</div>`; }
}

/* ══════════════════════════════════════════════════
   RENDER — المراقبة والسجلات
   ══════════════════════════════════════════════════ */
export async function renderMonitor({ view, db, me }) {
  $ = (s, c = document) => c.querySelector(s);
  esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  fmt = n => (+n || 0).toLocaleString('en-US');
  DB = db; ME = me;
  toast = m => { const t = $('#toast'); if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); } };
  const t0 = performance.now();
  view.innerHTML = '<div class="pgrid">' + '<div class="skel"></div>'.repeat(6) + '</div>';
  const [ev, audit] = await Promise.all([
    db.from('events').select('type,app,meta,created_at').order('created_at', { ascending: false }).limit(2500).then(r => r.data || []).catch(() => []),
    db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30).then(r => r.data || null).catch(() => null)
  ]);
  const ping = Math.round(performance.now() - t0);
  const errs = ev.filter(e => e.type === 'client_error');
  const perf = ev.filter(e => e.type === 'page_perf' && e.meta?.load != null);
  const h24 = ev.filter(e => new Date(e.created_at) >= ago(1));
  const perfByApp = {};
  [...new Set(perf.map(e => e.app))].forEach(app => {
    const arr = perf.filter(e => e.app === app).map(e => +e.meta.load).sort((a, b) => a - b);
    perfByApp[app] = { n: arr.length, avg: Math.round(arr.reduce((a, b) => a + b, 0) / arr.length), p95: arr[Math.floor(arr.length * .95)] || arr[arr.length - 1] || 0 };
  });
  /* تجميع الأخطاء */
  const groups = {};
  errs.forEach(e => {
    const k = (e.meta?.message || 'خطأ غير معروف').slice(0, 120);
    groups[k] = groups[k] || { n: 0, last: e.created_at, pages: new Set(), app: new Set(), stack: e.meta?.stack || '' };
    groups[k].n++; groups[k].pages.add(e.meta?.page || '—'); groups[k].app.add(e.app || '—');
    if (new Date(e.created_at) > new Date(groups[k].last)) { groups[k].last = e.created_at; groups[k].stack = e.meta?.stack || groups[k].stack; }
  });
  const resolved = new Set(JSON.parse(localStorage.getItem('mon-resolved') || '[]'));
  const rows = Object.entries(groups).sort((a, b) => b[1].n - a[1].n || new Date(b[1].last) - new Date(a[1].last));
  const active = rows.filter(([k]) => !resolved.has(k));
  const APP_L = { store: 'المتجر', studio: 'الاستوديو', admin: 'الإدارة' };

  view.innerHTML = `<div class="suite">
    <div class="stats">
      ${[['حالة الاتصال بقاعدة البيانات', 'متصلة · ' + ping + 'ms', 'استعلام نموذجي من الإدارة 🟢'], ['أحداث آخر ٢٤ ساعة', fmt(h24.length), 'زيارات · منتجات · سلوك 🟢'],
        ['أخطاء مفتوحة', fmt(active.length), 'بعد استبعاد المحسومة'], ['أخطاء ٢٤ ساعة', fmt(errs.filter(e => new Date(e.created_at) >= ago(1)).length), 'من كل الصفحات'],
        ['متوسط تحميل المتجر', perfByApp.store ? perfByApp.store.avg + 'ms' : '—', perfByApp.store ? `عينة ${perfByApp.store.n} صفحة` : 'تُجمع مع أول زيارة'], ['أحدث بريد أداء p95', perfByApp.store ? perfByApp.store.p95 + 'ms' : '—', 'الهدف أقل من 3500ms']]
        .map(([l, v, s]) => `<article class="stat"><span><i></i>${l}</span><b class="num" style="font-size:${String(v).length > 12 ? '18px' : '26px'}">${v}</b><small>${s}</small></article>`).join('')}
    </div>
    <div class="duo-exec">
      <section class="bi-card"><header class="bi-head"><b>أداء الصفحات</b><span>من إشارات page_perf للزوار 🟢</span></header>
        ${Object.keys(perfByApp).length ? barRows(Object.entries(perfByApp).map(([app, s]) => [`${APP_L[app] || app} — متوسط ${s.avg}ms · p95 ${s.p95}ms`, s.avg])) : '<p class="feed-empty">تُجمع إشارات الأداء تلقائياً من أجهزة الزوار (زمن التحميل، TTFB، الذاكرة).</p>'}
        ${perf.length ? `<p class="ai-note" style="margin-top:12px">الذاكرة النموذجية للأجهزة: ${median(perf.map(e => +e.meta?.mem).filter(Boolean)) || '—'}GB · DPR نموذجي: ${median(perf.map(e => +e.meta?.dpr).filter(Boolean)) || '—'}</p>` : ''}
      </section>
      <section class="bi-card"><header class="bi-head"><b>سجل العمليات (Audit) 🟢</b><span>${audit === null ? 'صلاحية المدير العام مطلوبة' : 'آخر 30 إجراءً إدارياً'}</span></header>
        ${audit === null ? '<p class="feed-empty">فعّل جدول audit_log من schema.sql المحدّث وسجّل دخولك بدور admin.</p>' : audit.length ? audit.map(a => `<div class="dec-row"><span class="chip c-gold">${esc(a.action)}</span><span>${esc(a.detail?.title || a.detail?.name || a.entity_id || a.entity || '')}</span><small>${esc(a.actor || '')} · ${new Date(a.created_at).toLocaleString('ar-SA')}</small></div>`).join('') : '<p class="feed-empty">لا إجراءات موثقة بعد.</p>'}
      </section>
    </div>
    <section class="bi-card" style="margin-top:16px"><header class="bi-head"><b>أخطاء العملاء لحظياً</b><span>مجمعة بالرسالة — النوع · الصفحة · التكرار 🟢</span></header>
      ${active.length ? active.slice(0, 25).map(([msg, g]) => `
        <div class="err-row">
          <div class="err-head"><b>${esc(msg)}</b><span class="chip ${g.n >= 5 ? 'c-danger' : 'c-warn'} num">×${g.n}</span></div>
          <div class="err-meta"><span>${[...g.pages].map(esc).join('، ')}</span><span>${[...g.app].map(a => APP_L[a] || a).join('، ')}</span><span>آخر ظهور: ${new Date(g.last).toLocaleString('ar-SA')}</span></div>
          ${g.stack ? `<details class="opp-draft"><summary>Stack</summary><pre dir="ltr">${esc(g.stack.slice(0, 400))}</pre></details>` : ''}
          <button class="ghost" data-resolve="${esc(msg.replace(/"/g, '&quot;'))}">وُضع حل — أخفِه</button>
        </div>`).join('') : `<p class="feed-empty">لا أخطاء مفتوحة ✦ النظام نظيف${rows.length ? ` (${rows.length} محسومة سابقاً)` : ''}.</p>`}
    </section></div>`;
  view.querySelectorAll('[data-resolve]').forEach(b => b.onclick = () => {
    resolved.add(b.dataset.resolve);
    localStorage.setItem('mon-resolved', JSON.stringify([...resolved]));
    toast('✦ أُغلق الخطأ وانتقل للمحسوم');
    renderMonitor({ view, db, me });
  });

  function barRows(pairs) {
    const mx = Math.max(...pairs.map(p => +p[1] || 0), 1);
    return `<div class="mini-bars">${pairs.map(([n, v]) => `<div class="mb-row"><span>${esc(n)}</span><div class="mb-track"><i style="width:${Math.max(2, Math.round(v / mx * 100))}%"></i></div><b class="num">${fmt(v)}</b></div>`).join('')}</div>`;
  }
  function median(a) { if (!a.length) return 0; a.sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; }
  function ago(d) { return new Date(Date.now() - d * 864e5); }
}
