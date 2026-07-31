/* ══════════════════════════════════════════════════════════
   AL LAMEA VIRTUAL STUDIO™
   استوديو اللامع الافتراضي — كل القطع تُقرأ من بيانات المتجر:
     1) الكتالوج المحلي الموحد (catalog.js) — نفس منتجات المتجر
     2) Supabase (جدول products حيث virtual_tryon = true)
   لا ملابس ثابتة داخل هذا الملف إطلاقاً.
   ══════════════════════════════════════════════════════════ */
'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('en-US');

const SB_URL = 'https://lebuvkypywblwrjhabpn.supabase.co';
const SB_KEY = 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u';
const CACHE_MS = 120000; /* دقيقتان — مزامنة سريعة مع لوحة التحكم */

const WEAR = window.ALLAMEA_WEAR || { labels: {}, order: [], defaults: {} };

/* ──────────────────────────────────────────
   الحالة
   ────────────────────────────────────────── */
const state = {
  products: [],          // القطع المعروضة في الاستوديو (من بيانات المتجر فقط)
  byCat: new Map(),      // wear_category → products[]
  worn: {},              // wear_category → productId
  lastWorn: null,
  avatar: { type: 'man', skin: 1, hairColor: 0, hair: 0, eyes: 0, beard: 0, glasses: false },
  zoom: 1, rot: 0, auto: false, bg: 'black',
  activeCat: null
};

/* ──────────────────────────────────────────
   مناطق اللبس على الشخصية (نِسَب من جسم العرض 360×760)
   [يمين, أعلى, عرض, ارتفاع] — اختيار الطبقة الافتراضي من catalog.js
   ────────────────────────────────────────── */
const REGIONS = {
  thobe:       [15, 23, 70, 68],
  maawaz:      [23, 40, 54, 52],
  shamzan:     [9, 21, 82, 72],
  vest:        [26, 25, 48, 35],
  belt:        [27, 47, 46, 14],
  jambiya:     [34, 49, 32, 23],
  accessories: [32, 26, 36, 20],
  turban:      [23, 2, 54, 25],
  shemagh:     [23, 4, 54, 27],
  watch:       [63, 49, 14, 14],
  shoes:       [26, 84, 48, 13],
  perfume:     [2, 56, 24, 28]
};
const hiddenRegion = [22, 30, 56, 46];
const FLOATERS = new Set(['perfume']);

/* ──────────────────────────────────────────
   محرك الشخصية — SVG فاخر قابل للتخصيص
   ────────────────────────────────────────── */
const SKINS = [
  { n: 'عاجي', b: '#f3d6ba', s: '#dfb28d' }, { n: 'فاتح', b: '#eec3a0', s: '#d69f76' },
  { n: 'قمحي', b: '#e0ab80', s: '#c78d5c' }, { n: 'حنطي', b: '#c98f63', s: '#a96f42' },
  { n: 'أسمر', b: '#a06a40', s: '#7f4f2b' }, { n: 'داكن', b: '#7c4c2a', s: '#5c3519' }
];
const HAIRC = [{ n: 'أسود', h: '#191410' }, { n: 'بني داكن', h: '#362114' }, { n: 'بني', h: '#5a3d22' }];
const EYES = [{ n: 'بني', c: '#53331c' }, { n: 'عسلي', c: '#7d5020' }, { n: 'عسلي فاتح', c: '#986a2c' }, { n: 'أخضر', c: '#41664e' }, { n: 'أزرق رمادي', c: '#4c6a85' }];
const BEARDS = ['بدون لحية', 'لحية خفيفة', 'لحية كاملة', 'سكسوكة'];
const HAIR_STYLES = {
  man: ['كلاسيكية', 'قصيرة أنيقة', 'كيرلي', 'طويلة للخلف'],
  woman: ['طويل', 'مموّج', 'كعكة', 'ضفيرة جانبية'],
  boy: ['كلاسيكية', 'كيرلي', 'قصيرة'],
  girl: ['بوب أنيق', 'كعكتان', 'ضفيرة', 'طويل']
};
const TYPES = {
  man: { n: 'رجل', s: 1 }, woman: { n: 'امرأة', s: .93 },
  boy: { n: 'طفل', s: .76 }, girl: { n: 'طفلة', s: .72 }
};
const FEMALE = t => t === 'woman' || t === 'girl';

function buildAvatar(cfg) {
  const S = SKINS[cfg.skin], H = HAIRC[cfg.hairColor].h, E = EYES[cfg.eyes].c;
  const fem = FEMALE(cfg.type), scale = TYPES[cfg.type].s;
  const lip = fem ? '#a9644d' : S.s;
  const lash = fem ? `<path d="M139 140l-6 -4M221 140l6 -4" stroke="#241812" stroke-width="2.4" stroke-linecap="round"/>` : '';
  const blush = fem ? `<ellipse cx="138" cy="176" rx="10" ry="6" fill="${S.s}" opacity=".3"/><ellipse cx="222" cy="176" rx="10" ry="6" fill="${S.s}" opacity=".3"/>` : '';

  /* الشعر — خلف الرأس أولاً */
  let backHair = '';
  const hs = cfg.hair;
  if ((cfg.type === 'woman' && hs !== 2) || cfg.type === 'girl' && hs === 3)
    backHair = `<path d="M180 70 q-84 0 -84 108 l-6 190 q-1 34 22 40 l10 -110 q-2 60 8 148 h100 q10 -88 8 -148 l10 110 q23 -6 22 -40 l-6 -190 q0 -108 -84 -108z" fill="${H}"/>`;
  if (cfg.type === 'girl' && hs === 1)
    backHair = `<circle cx="112" cy="98" r="30" fill="${H}"/><circle cx="248" cy="98" r="30" fill="${H}"/><circle cx="112" cy="98" r="14" fill="none" stroke="#B89146" stroke-width="3" opacity=".7"/><circle cx="248" cy="98" r="14" fill="none" stroke="#B89146" stroke-width="3" opacity=".7"/>`;
  if (cfg.type === 'woman' && hs === 1)
    backHair = backHair.replace('fill', 'data-x fill'); /* نفس الشكل بطابع مموّج */
  if (cfg.type === 'woman' && hs === 3)
    backHair += `<path d="M238 210 q26 60 18 150 q-3 30 -20 34 q22 -64 4 -190z" fill="${H}"/>`;

  /* غطاء الشعر الأمامي */
  let cap = '';
  if (cfg.type === 'man' || cfg.type === 'boy') {
    if (hs === 0 || (cfg.type === 'boy' && hs === 0))
      cap = `<path d="M119 150 q-4 -70 61 -72 q65 2 61 72 q-3 -32 -20 -42 q-41 -22 -82 0 q-17 10 -20 42z" fill="${H}"/><rect x="118" y="146" width="7" height="24" rx="3" fill="${H}"/><rect x="235" y="146" width="7" height="24" rx="3" fill="${H}"/>`;
    else if (hs === 1)
      cap = cfg.type === 'man'
        ? `<path d="M121 148 q-3 -64 59 -66 q62 2 59 66 q-8 -40 -59 -40 q-51 0 -59 40z" fill="${H}"/>`
        : `<path d="M115 140 q80 -90 132 0 q-6 -8 -14 -10 a70 70 0 0 0 -104 0 q-8 2 -14 10z" fill="${H}" stroke="${H}" stroke-width="14" stroke-linejoin="round"/>`;
    else if (hs === 2 && cfg.type === 'man')
      cap = `<path d="M125 190 q55 18 110 0 q10 -6 8 -16 q-60 22 -126 0 q-2 10 8 16z" fill="${H}" opacity=".45"/>`;
  }
  if (cfg.type === 'woman') {
    if (hs === 2) cap = `<path d="M118 152 q-4 -72 62 -74 q66 2 62 74 q-6 -30 -20 -38 q-42 -20 -84 0 q-14 8 -20 38z" fill="${H}"/><circle cx="180" cy="72" r="24" fill="${H}"/>`;
    else cap = `<path d="M118 150 q-4 -70 62 -72 q66 2 62 72 q-8 -26 -24 -34 q-38 -18 -76 0 q-16 8 -24 34z" fill="${H}"/>`;
  }
  if (cfg.type === 'girl') {
    cap = `<path d="M118 152 q-4 -72 62 -74 q66 2 62 74 q-8 -28 -24 -36 q-38 -20 -76 0 q-16 8 -24 36z" fill="${H}"/>`;
    if (hs === 0) cap += `<path d="M118 152 q-6 60 4 88 q10 4 16 -2 q-12 -34 -8 -88z M242 152 q6 60 -4 88 q-10 4 -16 -2 q12 -34 8 -88z" fill="${H}"/>`;
    if (hs === 2) cap += `<path d="M236 196 q14 50 4 96 m0 0 l-4 14 m0 -14 l6 12" stroke="${H}" stroke-width="11" stroke-linecap="round" fill="none"/>`;
  }

  /* الوجه */
  const eye = cx => `<g>
    <ellipse cx="${cx}" cy="146" rx="12.5" ry="7.6" fill="#ffffff" opacity=".95"/>
    <circle cx="${cx}" cy="147" r="4.8" fill="${E}"/><circle cx="${cx}" cy="147.4" r="2.1" fill="#150f0b"/>
    <circle cx="${cx + 1.8}" cy="145" r="1.4" fill="#fff" opacity=".9"/>
    <path d="M${cx - 13} 143 q13 -9 26 0" fill="none" stroke="#2b1d12" stroke-width="2.6" stroke-linecap="round"/>
  </g>`;
  const brows = fem
    ? `<path d="M136 126 q16 -9 32 -3" fill="none" stroke="#33200f" stroke-width="3" stroke-linecap="round"/><path d="M192 123 q16 -6 32 3" fill="none" stroke="#33200f" stroke-width="3" stroke-linecap="round"/>`
    : `<path d="M136 128 q16 -11 32 -6" fill="none" stroke="${H}" stroke-width="5" stroke-linecap="round"/><path d="M192 122 q16 -5 32 6" fill="none" stroke="${H}" stroke-width="5" stroke-linecap="round"/>`;
  const face = `
    ${eye(152)}${eye(208)}${brows}${lash}${blush}
    <path d="M180 152 q-3 17 -7 24 q4 6 11 4" fill="none" stroke="${S.s}" stroke-width="3" stroke-linecap="round"/>
    <path d="M163 197 q17 9 34 0 q-17 12 -34 0z" fill="${lip}" opacity=".9"/>
    <path d="M166 208 q14 5 28 0" fill="none" stroke="${S.s}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`;

  /* اللحية (رجل فقط) */
  let beard = '';
  if (cfg.type === 'man' && cfg.beard) {
    const op = cfg.beard === 1 ? .38 : .92;
    const jaw = cfg.beard === 3
      ? `<path d="M162 210 q18 12 36 0 l8 14 q-26 22 -52 0z" fill="${H}"/>`
      : `<path d="M126 172 q-2 60 54 78 q56 -18 54 -78 q-4 34 -18 44 q-8 -8 -14 -6 q-14 6 -22 6 q-8 0 -22 -6 q-6 -2 -14 6 q-14 -10 -18 -44z" fill="${H}"/>`;
    const stache = `<path d="M160 186 q20 -8 40 0 q-8 10 -20 10 q-12 0 -20 -10z" fill="${H}"/>`;
    beard = `<g opacity="${op}">${jaw}${stache}</g>`;
  }

  /* النظارة */
  const glasses = cfg.glasses ? `<g stroke="#B89146" stroke-width="2.4" fill="rgba(255,255,255,.08)">
    <rect x="136" y="134" width="33" height="25" rx="8"/><rect x="191" y="134" width="33" height="25" rx="8"/>
    <path d="M169 144 q11 -7 22 0 M136 141 l-14 -4 M224 141 l14 -4" fill="none"/></g>` : '';

  return `<svg viewBox="0 0 360 760" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="شخصية ${TYPES[cfg.type].n}">
  <defs>
    <radialGradient id="skinG" cx="38%" cy="26%" r="80%">
      <stop offset="0%" stop-color="${S.b}"/><stop offset="100%" stop-color="${S.s}"/>
    </radialGradient>
    <linearGradient id="suitG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#24211c"/><stop offset="55%" stop-color="#171512"/><stop offset="100%" stop-color="#100e0c"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g transform="translate(180 716) scale(${scale}) translate(-180 -716)">
    <ellipse cx="180" cy="716" rx="86" ry="13" fill="#000" opacity=".55" filter="url(#soft)"/>
    <g class="breathe">
      ${backHair}
      <path d="M163 214 h34 v30 q0 14 -17 14 q-17 0 -17 -14z" fill="url(#skinG)"/>
      <path d="M122 262 q-6 4 -8 20 l-7 108 q-2 62 13 96 h120 q15 -34 13 -96 l-7 -108 q-2 -16 -8 -20 q-26 -15 -58 -15 q-32 0 -58 15z" fill="url(#suitG)"/>
      <path d="M180 268 v212" stroke="#000" stroke-width="2" opacity=".25"/>
      <path d="M123 268 q-15 6 -17 30 l-9 126 q-2 46 6 60 l14 2 10 -146 q5 -50 6 -66z M237 268 q15 6 17 30 l9 126 q2 46 -6 60 l-14 2 -10 -146 q-5 -50 -6 -66z" fill="url(#suitG)"/>
      <circle cx="108" cy="494" r="13.5" fill="url(#skinG)"/><circle cx="252" cy="494" r="13.5" fill="url(#skinG)"/>
      <path d="M140 486 l-5 192 q-1 22 7 28 h76 q8 -6 7 -28 l-5 -192z" fill="url(#suitG)"/>
      <path d="M172 700 l-4 14 q14 8 32 0 l-4 -14z" fill="url(#skinG)"/>
      <ellipse cx="118" cy="166" rx="9" ry="14" fill="url(#skinG)"/><ellipse cx="242" cy="166" rx="9" ry="14" fill="url(#skinG)"/>
      <ellipse cx="180" cy="158" rx="63" ry="72" fill="url(#skinG)"/>
      <ellipse cx="180" cy="158" rx="63" ry="72" fill="#fff" opacity=".04"/>
      ${cap}${face}${beard}${glasses}
      <path d="M237 102 q14 12 16 40" stroke="#D9BF74" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>
    </g>
  </g>
</svg>`;
}

function renderAvatar() {
  $('#avatar-holder').innerHTML = buildAvatar(state.avatar);
}

/* ──────────────────────────────────────────
   طبقات اللبس
   ────────────────────────────────────────── */
const layerOf = p => (p.layer ?? WEAR.defaults[p.cat]) ?? 35;
const regionOf = cat => REGIONS[cat] || hiddenRegion;

function sortedLayers() {
  return Object.entries(state.worn)
    .map(([cat, id]) => ({ cat, p: state.products.find(x => x.id === id) }))
    .filter(x => x.p)
    .sort((a, b) => layerOf(a.p) - layerOf(b.p));
}

function layerHTML({ cat, p }) {
  const r = regionOf(cat);
  const src = p.studio || p.img;
  const mode = p.studio ? '' : (blendCache[src] === 'normal' ? '' : 'screen');
  const vitrine = FLOATERS.has(cat) ? 'vitrine' : '';
  return `<div class="wear-layer ${mode} ${vitrine}" data-cat="${cat}"
    style="right:${r[0]}%;top:${r[1]}%;width:${r[2]}%;height:${r[3]}%">
    <img src="${p.studio || p.img}" alt="${p.name}" onerror="this.closest('.wear-layer').style.display='none'">
  </div>`;
}

function renderWorn(applyCat = null) {
  const box = $('#wear-layers');
  const layers = sortedLayers();
  box.innerHTML = layers.map(layerHTML).join('');
  if (applyCat) {
    const el = $(`.wear-layer[data-cat="${applyCat}"]`, box);
    if (el) { el.classList.add('apply'); setTimeout(() => el.classList.remove('apply'), 1000); }
  }
  updateTotals();
}

/* تحديد نمط الدمج من سطوع الصورة (صور الاستوديو الداكنة → screen بلا إطار) */
const blendCache = {};
function sniffBlend(url) {
  if (blendCache[url]) return;
  blendCache[url] = 'screen';
  try {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 24;
        const x = c.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let lum = 0; for (let i = 0; i < d.length; i += 4) lum += (d[i] * .3 + d[i + 1] * .6 + d[i + 2] * .1) / 255;
        lum /= (d.length / 4);
        blendCache[url] = lum > .42 ? 'normal' : 'screen';
        if (Object.values(state.worn).some(id => (state.products.find(p => p.id === id) || {}).img === url)) renderWorn();
      } catch (e) { /* CORS — نبقي screen الافتراضي */ }
    };
    im.src = url;
  } catch (e) { /* تجاهل */ }
}

/* ──────────────────────────────────────────
   لبس / خلع
   ────────────────────────────────────────── */
function wear(product, silent = false) {
  if (!product) return;
  const cat = product.cat;
  if (state.worn[cat] === product.id) { /* نفس القطعة → خلعها */
    delete state.worn[cat];
    window.AlaTrack?.track('try_off', {}, product.price, { id: product.id, name: product.name });
    renderWorn(); markWornCards();
    if (!silent) toast(`خُلعت «${product.name}»`);
    return;
  }
  const replaced = state.worn[cat] && state.worn[cat] !== product.id;
  state.worn[cat] = product.id;
  state.lastWorn = product.id;
  window.AlaTrack?.track('try_on', { replaced: !!replaced }, product.price, { id: product.id, name: product.name });
  if (!product.studio) sniffBlend(product.img);
  renderWorn(cat);
  markWornCards();
  syncAdvisor();
  syncFav();
  if (!silent) toast(`${replaced ? 'استُبدلت القطعة — ' : ''}«${product.name}» على الشخصية الآن` +
    (product.stock === 0 ? ' · التجربة متاحة ونفذت الكمية من المتجر' : ''));
}
const unwornAll = () => { state.worn = {}; state.lastWorn = null; renderWorn(); markWornCards(); syncAdvisor(); syncFav(); };

function updateTotals() {
  const items = sortedLayers().map(x => x.p);
  const t = items.reduce((a, p) => a + p.price, 0);
  const box = $('#look-total');
  box.classList.toggle('show', items.length > 0);
  $('#look-total b').textContent = `${fmt(t)} ر.س`;
  $('#look-count').textContent = items.length ? `· ${items.length} ${items.length > 2 ? 'قطع' : 'قطعة'}` : '';
}

/* ──────────────────────────────────────────
   تحميل الكتالوج — المتجر أولاً ثم قاعدة البيانات
   ────────────────────────────────────────── */
async function loadCatalog() {
  const local = (window.ALLAMEA_CATALOG || [])
    .filter(p => p.tryon && p.wearCat)
    .map(p => ({ ...p, cat: p.wearCat, stock: p.stock ?? 99 }));
  applyCatalog(local);

  /* الكاش (تحديث سريع ثم مزامنة صامتة) */
  let t0 = 0;
  try { const c = JSON.parse(sessionStorage.getItem('av-cache') || 'null'); if (c && Date.now() - c.t < CACHE_MS && c.p?.length) t0 = 1, applyCatalog(normalizeRows(c.p)); } catch (e) { }

  try {
    if (!window.supabase?.createClient) return;
    const db = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
    const { data, error } = await db.from('products').select('*').eq('is_active', true).eq('virtual_tryon', true);
    if (error || !data) return;
    sessionStorage.setItem('av-cache', JSON.stringify({ t: Date.now(), p: data }));
    if (data.length && !t0) applyCatalog(normalizeRows(data));
    else if (data.length) applyCatalog(normalizeRows(data));
  } catch (e) { /* بلا اتصال — الكتالوج المحلي كافٍ */ }
}

function normalizeRows(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name,
    price: Number(r.sale_price ?? r.price) || 0,
    old: r.sale_price ? Number(r.price) : null,
    img: r.image_url || '', detail: r.image_url || '', studio: r.studio_asset || '',
    cat: r.wear_category, layer: r.layer_order ?? WEAR.defaults[r.wear_category] ?? 35,
    colors: Array.isArray(r.colors) ? r.colors : [],
    sizes: Array.isArray(r.sizes) && r.sizes.length ? r.sizes : ['مقاس واحد'],
    stock: r.stock ?? 0, desc: r.description || ''
  })).filter(p => p.cat && p.img);
}

function applyCatalog(products) {
  state.products = products;
  /* تنقية القطع الملبوسة من منتجات لم تعد موجودة (حذفها المدير) */
  Object.keys(state.worn).forEach(cat => { if (!products.some(p => p.id === state.worn[cat])) delete state.worn[cat]; });
  state.byCat = new Map();
  products.forEach(p => {
    if (!state.byCat.has(p.cat)) state.byCat.set(p.cat, []);
    state.byCat.get(p.cat).push(p);
  });
  buildTabs();
  renderWorn(); syncAdvisor();
}

/* ──────────────────────────────────────────
   التبويبات والبطاقات — ديناميكية 100%
   ────────────────────────────────────────── */
const PAGE = 6;
const shown = new Map(); /* cat → عدد البطاقات الظاهرة */
const catLabel = c => WEAR.labels[c] || c;

function orderedCats() {
  const ordered = WEAR.order.filter(c => state.byCat.has(c));
  const extra = [...state.byCat.keys()].filter(c => !WEAR.order.includes(c));
  return [...ordered, ...extra]; /* أي تصنيف جديد يظهر تلقائياً */
}

function buildTabs() {
  const cats = orderedCats();
  if (!cats.includes(state.activeCat)) state.activeCat = cats[0] || null;
  $('#tabs').innerHTML = cats.map(c =>
    `<button class="tab ${c === state.activeCat ? 'active' : ''}" data-cat="${c}">${catLabel(c)}<i>${state.byCat.get(c).length}</i></button>`).join('');
  if (!cats.length) {
    $('#cat-scroll').innerHTML = '<div class="cat-empty">لا توجد قطع مفعّلة للتجربة بعد — فعّل «Virtual Try-On» وحدد «فئة اللبس» من لوحة التحكم لأي منتج.</div>';
    return;
  }
  renderTab();
}

function stockBadge(p) {
  if (p.stock === 0) return '<span class="s-stock st-out">نفذت الكمية</span>';
  if (p.stock <= 3) return '<span class="s-stock st-low">كمية محدودة</span>';
  return '<span class="s-stock st-ok">متوفر</span>';
}

function cardHTML(p) {
  const worn = state.worn[p.cat] === p.id;
  const colors = (p.colors || []).slice(0, 4).map(c => `<i style="background:${c.hex || '#888'}" title="${c.name}"></i>`).join('');
  const more = (p.colors || []).length > 4 ? `<span>+${p.colors.length - 4}</span>` : '';
  const sizes = (p.sizes || []).slice(0, 4).join(' · ');
  return `<article class="s-card ${worn ? 'worn' : ''}" data-id="${p.id}">
    <div class="s-media"><img src="${p.img}" alt="${p.name}" loading="lazy" decoding="async">${stockBadge(p)}</div>
    <div class="s-info">
      <h4 class="s-name">${p.name}</h4>
      <div class="s-price"><span class="num">${fmt(p.price)}</span><small>ر.س</small>${p.old ? `<s class="num">${fmt(p.old)}</s>` : ''}</div>
      ${colors ? `<div class="s-dots">${colors}${more}</div>` : ''}
      ${sizes ? `<div class="s-dots" style="color:var(--muted);font-size:8.5px">${sizes}</div>` : ''}
      <button class="try-btn ${worn ? 'remove' : ''}" data-try="${p.id}">${worn ? 'خلع القطعة' : 'جرّب الآن'}</button>
    </div>
  </article>`;
}

function renderTab(append = false) {
  const sc = $('#cat-scroll'), cat = state.activeCat;
  if (!cat) { sc.innerHTML = ''; return; }
  const list = state.byCat.get(cat) || [];
  const n = Math.min(shown.get(cat) || PAGE, list.length);
  const first = list.slice(0, n).map(cardHTML).join('');
  const rest = list.length > n ? `<div class="cat-skeleton" data-more="${cat}" style="width:60px;border:0;background:none;display:grid;place-items:center;color:var(--muted);font-size:9.5px;cursor:pointer">عرض المزيد<br>(${list.length - n})</div>` : '';
  sc.innerHTML = first + rest;
  const more = $('[data-more]', sc);
  if (more) more.onclick = () => { shown.set(cat, n + PAGE); renderTab(true); };
}

function markWornCards() {
  $$('#cat-scroll .s-card').forEach(card => {
    const p = state.products.find(x => x.id === card.dataset.id);
    if (!p) return;
    const worn = state.worn[p.cat] === p.id;
    card.classList.toggle('worn', worn);
    const b = $('.try-btn', card);
    b.classList.toggle('remove', worn);
    b.textContent = worn ? 'خلع القطعة' : 'جرّب الآن';
  });
}

$('#tabs').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (!t) return;
  state.activeCat = t.dataset.cat;
  $$('#tabs .tab').forEach(x => x.classList.toggle('active', x === t));
  renderTab();
});

$('#cat-scroll').addEventListener('click', e => {
  const btn = e.target.closest('[data-try]'); if (!btn) return;
  wear(state.products.find(p => p.id === btn.dataset.try));
});

/* تمرير التبويبات بالعجلة أفقياً */
$('#cat-scroll').addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.currentTarget.scrollLeft -= e.deltaY; e.preventDefault(); }
}, { passive: false });

/* ──────────────────────────────────────────
   التحكم بالمسرح: تقريب · تدوير · خلفيات
   ────────────────────────────────────────── */
(() => {
  const zoomEl = $('#stage-zoom'), rotEl = $('#stage-rot'), stage = $('#stage');
  const apply = () => {
    zoomEl.style.transform = `scale(${state.zoom})`;
    rotEl.style.transform = `rotateY(${state.rot}deg)`;
  };
  const zoomTo = z => { state.zoom = Math.min(2, Math.max(.8, +z.toFixed(2))); apply(); };
  $('#zoom-in').onclick = () => zoomTo(state.zoom + .18);
  $('#zoom-out').onclick = () => zoomTo(state.zoom - .18);
  $('#zoom-reset').onclick = () => { state.rot = 0; zoomTo(1); };
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomTo(state.zoom + (e.deltaY < 0 ? .1 : -.1)); }, { passive: false });

  /* سحب للتدوير */
  let dragging = false, sx = 0, sr = 0;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('button, .advisor, .zoom-fab')) return;
    dragging = true; sx = e.clientX; sr = state.rot;
    stage.setPointerCapture(e.pointerId);
    $('#stage-hint').style.opacity = 0;
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    state.rot = Math.max(-30, Math.min(30, sr + (e.clientX - sx) / 6));
    apply();
  });
  const end = () => dragging = false;
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  /* الخلفيات */
  const BGS = [
    { id: 'black', n: 'أسود فاخر', g: 'radial-gradient(circle,#262019,#090909 70%)' },
    { id: 'green', n: 'أخضر يمني', g: 'radial-gradient(circle,#2a6a52,#14382E 70%)' },
    { id: 'bronze', n: 'برونزي', g: 'radial-gradient(circle,#5a4418,#1a1206 70%)' },
    { id: 'charcoal', n: 'فحمي', g: 'radial-gradient(circle,#3a3a3a,#121212 70%)' }
  ];
  $('#bg-dots').innerHTML = BGS.map(b =>
    `<button class="dot ${b.id === state.bg ? 'active' : ''}" data-bg="${b.id}" title="${b.n}" aria-label="${b.n}"><i style="background:${b.g}"></i></button>`).join('');
  $('#bg-dots').onclick = e => {
    const d = e.target.closest('[data-bg]'); if (!d) return;
    state.bg = d.dataset.bg; stage.dataset.bg = state.bg;
    $$('#bg-dots .dot').forEach(x => x.classList.toggle('active', x === d));
  };

  /* الدوران التلقائي */
  $('#auto-rotate').onclick = () => {
    state.auto = !state.auto;
    $('#auto-rotate').classList.toggle('on', state.auto);
    $('#auto-rotate').setAttribute('aria-checked', state.auto);
    rotEl.classList.toggle('spinning', state.auto);
    document.querySelector('.pedestal').classList.toggle('spinning', state.auto);
    if (state.auto) { state.rot = 0; apply(); rotEl.style.animation = 'autoSwing 8s ease-in-out infinite'; }
    else { rotEl.style.animation = ''; }
  };
  const st = document.createElement('style');
  st.textContent = '@keyframes autoSwing{0%,100%{transform:rotateY(-16deg)}50%{transform:rotateY(16deg)}}';
  document.head.appendChild(st);
})();

/* ──────────────────────────────────────────
   الشخصية والتخصيص
   ────────────────────────────────────────── */
const CHAR_ICONS = {
  man: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></svg>',
  woman: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M7 21l5-9 5 9M5 21h14"/></svg>',
  boy: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="2.6"/><path d="M8 21v-1a4 4 0 0 1 8 0v1"/></svg>',
  girl: '<svg viewBox="0 0 24 24"><circle cx="10" cy="7" r="2.4"/><circle cx="15" cy="5.4" r="1.4"/><path d="M9 21l3-6 3 6M7.5 21h9"/></svg>'
};

function buildCharacters() {
  $('#character-grid').innerHTML = Object.entries(TYPES).map(([k, v]) =>
    `<button class="character ${state.avatar.type === k ? 'active' : ''}" data-type="${k}">${CHAR_ICONS[k]}<span>${v.n}</span></button>`).join('');
}
$('#character-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-type]'); if (!b) return;
  state.avatar.type = b.dataset.type;
  state.avatar.hair = 0; if (state.avatar.type !== 'man') state.avatar.beard = 0;
  renderAvatar(); buildCharacters(); buildCustomizer();
});

function segRow(label, items, cur, on) {
  return `<div><h5>${label}</h5><div class="seg">
    <button class="arrow" data-seg="-1" aria-label="السابق">›</button>
    <b>${items[cur]}</b>
    <button class="arrow" data-seg="1" aria-label="التالي">‹</button>
  </div></div>`;
}
function dotsRow(label, items, cur, on) {
  return `<div><h5>${label}</h5><div class="dots" data-dots>${items.map((c, i) =>
    `<button class="dot ${i === cur ? 'active' : ''}" data-i="${i}" title="${c.n}" aria-label="${c.n}"><i style="background:${c.h || c.c || c.b}"></i></button>`).join('')}</div></div>`;
}

function buildCustomizer() {
  const a = state.avatar, wrap = $('#customizer');
  const hairNames = HAIR_STYLES[a.type];
  a.hair = Math.min(a.hair, hairNames.length - 1);
  let html =
    dotsRow('لون البشرة', SKINS, a.skin) +
    segRow('التسريحة', hairNames, a.hair) +
    dotsRow('لون الشعر', HAIRC, a.hairColor) +
    dotsRow('لون العيون', EYES, a.eyes);
  if (a.type === 'man') html += segRow('اللحية', BEARDS, a.beard);
  html += `<div class="toggle-row"><span>نظارة ذهبية</span><button class="switch ${a.glasses ? 'on' : ''}" id="tgl-glasses" role="switch" aria-checked="${a.glasses}"><i></i></button></div>`;
  wrap.innerHTML = html;

  $$('[data-dots]', wrap).forEach((dotsEl, di) => {
    dotsEl.onclick = e => {
      const d = e.target.closest('.dot'); if (!d) return;
      const key = ['skin', 'hairColor', 'eyes'][di];
      a[key] = +d.dataset.i;
      renderAvatar(); buildCustomizer();
    };
  });
  $$('.seg', wrap).forEach(seg => {
    seg.onclick = e => {
      const ar = e.target.closest('[data-seg]'); if (!ar) return;
      const label = seg.previousElementSibling?.textContent || '';
      if (label.includes('التسريحة')) { a.hair = (a.hair + +ar.dataset.seg + hairNames.length) % hairNames.length; }
      else { a.beard = (a.beard + +ar.dataset.seg + BEARDS.length) % BEARDS.length; }
      renderAvatar(); buildCustomizer();
    };
  });
  const g = $('#tgl-glasses', wrap);
  if (g) g.onclick = () => { a.glasses = !a.glasses; renderAvatar(); buildCustomizer(); };
}

/* ──────────────────────────────────────────
   إعادة الضبط
   ────────────────────────────────────────── */
$('#reset-all').onclick = () => {
  unwornAll();
  state.avatar = { type: 'man', skin: 1, hairColor: 0, hair: 0, eyes: 0, beard: 0, glasses: false };
  state.bg = 'black'; $('#stage').dataset.bg = 'black';
  state.zoom = 1; state.rot = 0;
  state.auto = false; $('#auto-rotate').classList.remove('on'); $('#stage-rot').style.animation = '';
  document.querySelector('.pedestal').classList.remove('spinning');
  $$('#bg-dots .dot').forEach(d => d.classList.toggle('active', d.dataset.bg === 'black'));
  $('#stage-zoom').style.transform = ''; $('#stage-rot').style.transform = '';
  renderAvatar(); buildCharacters(); buildCustomizer();
  toast('أُعيد ضبط الاستوديو');
};
$('#strip-all').onclick = () => { if (Object.keys(state.worn).length) { unwornAll(); toast('خُلعت كل القطع'); } };

/* ──────────────────────────────────────────
   المستشار الذكي
   ────────────────────────────────────────── */
const COMPLEMENTS = {
  thobe: ['belt', 'jambiya', 'shemagh', 'turban', 'watch', 'shoes', 'vest', 'perfume', 'accessories'],
  maawaz: ['belt', 'jambiya', 'shemagh', 'thobe'],
  shamzan: ['thobe', 'belt', 'jambiya', 'watch', 'perfume'],
  vest: ['thobe', 'belt', 'jambiya'],
  belt: ['thobe', 'jambiya', 'watch'],
  jambiya: ['thobe', 'belt', 'shamzan'],
  turban: ['thobe', 'shamzan', 'vest'],
  shemagh: ['thobe', 'belt', 'vest'],
  shoes: ['thobe', 'belt'], watch: ['thobe', 'shamzan'],
  accessories: ['thobe', 'vest'], perfume: ['thobe', 'shamzan']
};
function hexHue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
  return (h * 60 + 360) % 360;
}
function advise() {
  const worn = sortedLayers().map(x => x.p);
  const wornCats = new Set(worn.map(p => p.cat));
  if (!worn.length) return {
    text: 'أنا مستشارك في الدار. البِس أي قطعة من الشريط بالأسفل وسأقترح عليك أفضل ما يكملها — من منتجات المتجر نفسها.', items: []
  };
  const prio = [...new Set(worn.flatMap(p => COMPLEMENTS[p.cat] || []))].filter(c => !wornCats.has(c) && state.byCat.has(c));
  const rest = [...state.byCat.keys()].filter(c => !wornCats.has(c) && !prio.includes(c));
  const wornHues = worn.flatMap(p => (p.colors || []).map(c => hexHue(c.hex)).filter(h => h !== null));
  const avg = worn.reduce((a, p) => a + p.price, 0) / worn.length;
  const score = p => {
    let s = 0;
    if (p.stock > 0) s += 2;
    const hues = (p.colors || []).map(c => hexHue(c.hex)).filter(h => h !== null);
    if (hues.length && wornHues.length) {
      const d = Math.min(...hues.flatMap(h => wornHues.map(w => { const x = Math.abs(h - w); return Math.min(x, 360 - x); })));
      if (d < 45) s += 2; else if (d < 90) s += 1;
    }
    if (Math.abs(Math.log((p.price + 1) / (avg + 1))) < .6) s += 1;
    return s;
  };
  const picked = [];
  [...prio, ...rest].forEach(cat => {
    if (picked.length >= 5) return;
    const best = [...(state.byCat.get(cat) || [])].sort((a, b) => score(b) - score(a))[0];
    if (best) picked.push({ cat, p: best });
  });
  const last = worn[worn.length - 1];
  const text = picked.length
    ? `اخترت «${last.name}» — أرى أن هذه القطع ستكمل حضورك بامتياز:`
    : 'إطلالتك مكتملة الأركان ✨ جاهزة للحفظ أو للطلب.';
  return { text, items: picked };
}
function syncAdvisor() {
  if (!$('#advisor').classList.contains('open')) return;
  const a = advise();
  $('#adv-text').textContent = a.text;
  $('#adv-list').innerHTML = a.items.map(({ cat, p }) => `
    <div class="adv-item">
      <img src="${p.img}" alt="" loading="lazy">
      <div><span>أفضل ${catLabel(cat)}</span><b>${p.name}</b><em class="num">${fmt(p.price)} ر.س</em></div>
      <button data-adv-try="${p.id}">جرّب</button>
    </div>`).join('');
}
$('#adv-list').addEventListener('click', e => {
  const b = e.target.closest('[data-adv-try]'); if (!b) return;
  wear(state.products.find(p => p.id === b.dataset.advTry));
});
$('#adv-open').onclick = () => { $('#advisor').classList.add('open'); syncAdvisor(); };
$('#adv-close').onclick = () => $('#advisor').classList.remove('open');

/* ──────────────────────────────────────────
   السلة والمفضلة
   ────────────────────────────────────────── */
const readCart = () => { try { return JSON.parse(localStorage.getItem('allamea-cart') || '[]'); } catch (e) { return []; } };
const saveCart = c => localStorage.setItem('allamea-cart', JSON.stringify(c));
function pushCart(p) {
  const cart = readCart();
  const size = (p.sizes || [])[0] || 'مقاس واحد', color = (p.colors || [])[0]?.name || 'أساسي';
  const f = cart.find(i => i.id === p.id && i.size === size && i.color === color);
  if (f) f.qty += 1; else cart.push({ id: p.id, size, color, qty: 1 });
  saveCart(cart); updateCartCount();
}
function updateCartCount() {
  $('#cart-count').textContent = readCart().reduce((n, i) => n + i.qty, 0);
}
$('#tool-cart').onclick = () => {
  const items = sortedLayers().map(x => x.p);
  if (!items.length) return toast('البِس قطعة أولاً لتضيفها إلى سلتك');
  let added = 0, skipped = 0;
  items.forEach(p => { if (p.stock > 0) { pushCart(p); added++; window.AlaTrack?.track('cart_add', { from: 'studio' }, p.price, { id: p.id, name: p.name }); } else skipped++; });
  toast(`أُضيفت ${added} ${added > 2 ? 'قطع' : 'قطعة'} من إطلالتك إلى السلة` + (skipped ? ` · ${skipped} نفذت كميتها` : ''));
};
$('#cart-pill').onclick = () => { location.href = 'index.html'; };

const readFavs = () => { try { return JSON.parse(localStorage.getItem('allamea-favs') || '[]'); } catch (e) { return []; } };
function syncFav() {
  const on = state.lastWorn && readFavs().includes(state.lastWorn);
  $('#tool-fav').classList.toggle('active', !!on);
}
$('#tool-fav').onclick = () => {
  if (!state.lastWorn) return toast('البِس قطعة أولاً لتضيفها لمفضلتك');
  const favs = readFavs(), i = favs.indexOf(state.lastWorn);
  const favP = state.products.find(x => x.id === state.lastWorn);
  if (i >= 0) { favs.splice(i, 1); toast('أُزيلت من المفضلة'); window.AlaTrack?.track('fav_remove', {}, null, { id: state.lastWorn, name: favP?.name }); }
  else { favs.push(state.lastWorn); toast('أُضيفت إلى مفضلتك ♥'); window.AlaTrack?.track('fav_add', {}, favP?.price, { id: state.lastWorn, name: favP?.name }); }
  localStorage.setItem('allamea-favs', JSON.stringify(favs));
  syncFav();
  document.dispatchEvent(new CustomEvent('fav:change', { detail: { id: state.lastWorn, added: i < 0 } }));
};

/* ──────────────────────────────────────────
   الإطلالات المحفوظة
   ────────────────────────────────────────── */
const LOOKS_KEY = 'allamea-looks';
const readLooks = () => { try { return JSON.parse(localStorage.getItem(LOOKS_KEY) || '[]'); } catch (e) { return []; } };
const saveLooks = l => localStorage.setItem(LOOKS_KEY, JSON.stringify(l));
const SUGG = ['إطلالة العيد', 'إطلالة المناسبات', 'إطلالة العمل', 'إطلالة الجمعة', 'إطلالة الشتاء'];

$('#tool-save').onclick = () => {
  if (!Object.keys(state.worn).length) return toast('كوّن إطلالتك أولاً ثم احفظها');
  $('#look-sugg').innerHTML = SUGG.map(s => `<button>${s}</button>`).join('');
  $('#save-look-dialog').classList.add('open');
  setTimeout(() => $('#look-name').focus(), 300);
};
$('#look-sugg').onclick = e => { if (e.target.tagName === 'BUTTON') $('#look-name').value = e.target.textContent; };
$('#save-look-cancel').onclick = () => $('#save-look-dialog').classList.remove('open');
$('#save-look-ok').onclick = () => {
  const name = $('#look-name').value.trim() || `إطلالة ${readLooks().length + 1}`;
  const looks = readLooks();
  looks.unshift({ id: Date.now().toString(36), name, avatar: { ...state.avatar }, worn: { ...state.worn }, bg: state.bg, at: Date.now() });
  saveLooks(looks);
  window.AlaTrack?.track('look_save', { name, items: Object.keys(state.worn).length });
  $('#save-look-dialog').classList.remove('open');
  $('#look-name').value = '';
  toast(`حُفظت «${name}» ضمن إطلالاتك`);
};

function renderLooks() {
  const looks = readLooks(), body = $('#looks-body');
  if (!looks.length) {
    body.innerHTML = `<div class="looks-empty">
      <svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1Z"/></svg>
      <p>لا إطلالات محفوظة بعد.<br>كوّن إطلالتك واحفظها لتعود إليها متى شئت.</p></div>`;
    return;
  }
  body.innerHTML = looks.map(l => {
    const chips = Object.entries(l.worn).map(([c, id]) => {
      const p = state.products.find(x => x.id === id);
      return `<i>${p ? p.name : 'قطعة لم تعد متاحة'}</i>`;
    }).join('');
    return `<div class="look-card">
      <b>${l.name}</b>
      <span>${TYPES[l.avatar.type]?.n || 'رجل'} · ${new Date(l.at).toLocaleDateString('ar-SA')}</span>
      <div class="look-chips">${chips || '<i>بدون قطع</i>'}</div>
      <div class="look-actions">
        <button class="wear-look" data-wear-look="${l.id}">ارتداء الإطلالة</button>
        <button class="del-look" data-del-look="${l.id}" aria-label="حذف">×</button>
      </div>
    </div>`;
  }).join('');
}
$('#tool-looks').onclick = () => { renderLooks(); $('#looks').classList.add('open'); };
$('#looks-close').onclick = () => $('#looks').classList.remove('open');
$('#looks-body').addEventListener('click', e => {
  const w = e.target.closest('[data-wear-look]');
  const d = e.target.closest('[data-del-look]');
  if (d) {
    saveLooks(readLooks().filter(l => l.id !== d.dataset.delLook));
    renderLooks(); toast('حُذفت الإطلالة');
    return;
  }
  if (!w) return;
  const look = readLooks().find(l => l.id === w.dataset.wearLook);
  if (!look) return;
  state.avatar = { ...state.avatar, ...look.avatar };
  state.bg = look.bg || 'black'; $('#stage').dataset.bg = state.bg;
  $$('#bg-dots .dot').forEach(x => x.classList.toggle('active', x.dataset.bg === state.bg));
  state.worn = {};
  let missing = 0;
  Object.entries(look.worn).forEach(([cat, id]) => {
    if (state.products.some(p => p.id === id)) state.worn[cat] = id; else missing++;
  });
  renderAvatar(); buildCharacters(); buildCustomizer();
  renderWorn(); markWornCards();
  $('#looks').classList.remove('open');
  toast(`«${look.name}» على الشخصية الآن` + (missing ? ` · ${missing} ${missing > 1 ? 'قطع لم تعد' : 'قطعة لم تعد'} متاحة` : ''));
});

/* ──────────────────────────────────────────
   التقاط صورة الإطلالة (Canvas)
   ────────────────────────────────────────── */
async function captureLook() {
  const items = sortedLayers().map(x => x.p);
  if (!items.length) return null;
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');

  /* الخلفية حسب أجواء المسرح */
  const bgStops = { black: ['#171310', '#090909'], green: ['#1d4d3e', '#0a1f19'], bronze: ['#33250f', '#120c05'], charcoal: ['#242424', '#0e0e0e'] }[state.bg] || ['#171310', '#090909'];
  const g = x.createRadialGradient(W / 2, H * .46, 80, W / 2, H * .46, H * .75);
  g.addColorStop(0, bgStops[0]); g.addColorStop(1, bgStops[1]);
  x.fillStyle = g; x.fillRect(0, 0, W, H);

  /* إطار ذهبي مزدوج + معينات الزوايا (لغة الشعار) */
  x.strokeStyle = '#B89146'; x.lineWidth = 2; x.strokeRect(34, 34, W - 68, H - 68);
  x.strokeStyle = 'rgba(184,145,70,.4)'; x.lineWidth = 1; x.strokeRect(46, 46, W - 92, H - 92);
  x.fillStyle = '#D9BF74';
  [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(([cx, cy]) => {
    x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4); x.fillRect(-7, -7, 14, 14); x.restore();
  });

  await document.fonts.ready.catch(() => { });
  x.textAlign = 'center';
  x.fillStyle = '#D9BF74'; x.font = '600 34px Inter, sans-serif'; x.direction = 'ltr';
  x.fillText('AL LAMEA VIRTUAL STUDIO™', W / 2, 108);
  x.fillStyle = '#8f8a7d'; x.font = '300 27px "IBM Plex Sans Arabic", sans-serif'; x.direction = 'rtl';
  x.fillText('إطلالتك من استوديو اللامع الافتراضي', W / 2, 152);

  /* منطقة الشخصية */
  const bh = 760, bw = Math.round(bh * 360 / 760), bx = (W - bw) / 2, by = 210;
  const load = src => new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

  const svgStr = buildAvatar(state.avatar).replace('<svg ', `<svg width="360" height="760" `);
  const avIm = await load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr));
  if (avIm) x.drawImage(avIm, bx, by, bw, bh);

  /* القطع الملبوسة بنفس ترتيب الطبقات */
  for (const it of sortedLayers()) {
    const im = await load(it.p.img); if (!im) continue;
    const r = regionOf(it.cat);
    x.globalCompositeOperation = blendCache[it.p.img] === 'normal' ? 'source-over' : 'lighter';
    x.drawImage(im, bx + bw * r[0] / 100, by + bh * r[1] / 100, bw * r[2] / 100, bh * r[3] / 100);
  }
  x.globalCompositeOperation = 'source-over';

  /* قائمة القطع والإجمالي */
  let yy = by + bh + 44;
  x.textAlign = 'right'; x.direction = 'rtl';
  x.font = '400 25px "IBM Plex Sans Arabic", sans-serif';
  const rx = W - 110;
  items.slice(0, 5).forEach(p => {
    x.fillStyle = '#F6F3EC'; x.fillText(p.name, rx, yy);
    x.fillStyle = '#D9BF74'; x.font = '500 23px Inter, sans-serif'; x.direction = 'ltr'; x.textAlign = 'left';
    x.fillText(fmt(p.price), 110, yy);
    x.textAlign = 'right'; x.direction = 'rtl'; x.font = '400 25px "IBM Plex Sans Arabic", sans-serif';
    yy += 42;
  });
  const total = items.reduce((a, p) => a + p.price, 0);
  x.strokeStyle = 'rgba(184,145,70,.4)'; x.beginPath(); x.moveTo(110, yy - 14); x.lineTo(W - 110, yy - 14); x.stroke();
  x.fillStyle = '#A8A8A8'; x.font = '300 24px "IBM Plex Sans Arabic", sans-serif';
  x.fillText('إجمالي الإطلالة', rx, yy + 26);
  x.fillStyle = '#D9BF74'; x.font = '600 30px Inter, sans-serif'; x.direction = 'ltr'; x.textAlign = 'left';
  x.fillText(fmt(total) + ' SAR', 110, yy + 26);

  x.textAlign = 'center'; x.fillStyle = '#6d675c'; x.font = '300 20px "IBM Plex Sans Arabic", sans-serif'; x.direction = 'rtl';
  x.fillText('جميع القطع من متجر اللامع — تجربة الاستوديو الافتراضي · 2026', W / 2, H - 62);

  return new Promise(res => { try { cv.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } });
}

$('#tool-shot').onclick = async () => {
  const blob = await captureLook();
  if (!blob) return toast(Object.keys(state.worn).length ? 'تعذر إنشاء الصورة — حاول مجدداً' : 'البِس قطعة أولاً');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'allamea-look.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  window.AlaTrack?.track('look_capture', { items: sortedLayers().length });
  toast('حُمّلت صورة إطلالتك بجودة عالية');
};

$('#tool-share').onclick = async () => {
  const items = sortedLayers().map(x => x.p);
  if (!items.length) return toast('البِس قطعة أولاً ثم شارك إطلالتك');
  const blob = await captureLook();
  const total = items.reduce((a, p) => a + p.price, 0);
  const text = `إطلالتي من استوديو اللامع الافتراضي ✦\n${items.map(p => `• ${p.name}`).join('\n')}\nالإجمالي: ${fmt(total)} ر.س`;
  window.AlaTrack?.track('look_share', { items: items.length }, total);
  try {
    const file = blob && new File([blob], 'allamea-look.png', { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'إطلالة اللامع', text });
      return;
    }
    if (navigator.share) { await navigator.share({ title: 'إطلالة اللامع', text }); return; }
    await navigator.clipboard.writeText(text);
    toast('نُسخ وصف إطلالتك — شاركه أينما تحب');
  } catch (e) { /* ألغى المستخدم */ }
};

/* ──────────────────────────────────────────
   أدوات عامة
   ────────────────────────────────────────── */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  t.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 3000);
}

addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  $('#advisor').classList.remove('open');
  $('#looks').classList.remove('open');
  $('#save-look-dialog').classList.remove('open');
  $('#rail-r').classList.remove('open');
});

/* لوحة الإعدادات على الشاشات الصغيرة */
const panelBtn = document.createElement('button');
panelBtn.className = 'tool';
panelBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2.2"/><circle cx="10" cy="16" r="2.2"/></svg><small>الإعدادات</small>';
panelBtn.id = 'tool-panel';
panelBtn.onclick = () => $('#rail-r').classList.toggle('open');
$('#tool-fav').after(panelBtn);
$('#rail-r-close').onclick = () => $('#rail-r').classList.remove('open');

/* ──────────────────────────────────────────
   الإقلاع
   ────────────────────────────────────────── */
(() => {
  const loader = $('#loader');
  const hide = () => { loader.classList.add('done'); setTimeout(() => loader.remove(), 900); };
  addEventListener('load', () => setTimeout(hide, 900));
  setTimeout(hide, 3500);
  setTimeout(() => $('#stage-hint').style.opacity = 0, 9000);
})();

const __studioTimer = window.AlaTrack?.timer ? window.AlaTrack.timer() : null;
addEventListener('pagehide', () => __studioTimer?.stop('studio_session'));
/* جسر منصة AL LAMEA AI™ — يقرأ حالة الاستوديو الحية فقط */
window.AlameaStudio = { state, wear, unwornAll, pushCart, advise, sortedLayers, catLabel, toast, refresh: loadCatalog };
renderAvatar();
buildCharacters();
buildCustomizer();
updateCartCount();
syncFav();
loadCatalog();
