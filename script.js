/* ══════════════════════════════════════════════════
   اللامع | AL LAMEA — طبقة التفاعل
   ══════════════════════════════════════════════════ */
'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* ── المنتجات: تُقرأ من الكتالوج الموحد (catalog.js) ── */
const PRODUCTS = window.ALLAMEA_CATALOG || [];
const BADGE = { new: ['b-new', 'جديد'], sale: ['b-sale', 'خصم'], limited: ['b-limited', 'إصدار محدود'] };
const fmt = n => n.toLocaleString('en-US');
const priceHTML = (p, xl) => {
  const cur = `<small>ر.س</small>`;
  const old = p.old ? `<s>${fmt(p.old)}</s>` : '';
  return xl ? `<b class="num">${fmt(p.price)} ${cur}</b>${old}` : `<span class="p-price num">${fmt(p.price)}${cur}${old}</span>`;
};
const getP = id => PRODUCTS.find(p => p.id === id);

/* ── عميل قاعدة البيانات الموحّد (متجر عام) ─────── */
const SB_URL = 'https://lebuvkypywblwrjhabpn.supabase.co', SB_KEY = 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u';
let _db = null;
const dbClient = () => {
  if (_db) return _db;
  try { if (window.supabase?.createClient) _db = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }); } catch (e) { }
  return _db;
};

/* ── إعدادات الدار الحية: الشحن والولاء (تُدار من لوحة الإدارة) ── */
let STORE_CONF = { fee: 35, free_from: 350, delivery_note: '', loyalty: null };
async function loadStoreConf(force) {
  try {
    const c = JSON.parse(sessionStorage.getItem('allamea-conf') || 'null');
    if (!force && c && Date.now() - c.t < 600000) { STORE_CONF = c.v; return STORE_CONF; }
  } catch (e) { }
  const db = dbClient(); if (!db) return STORE_CONF;
  try {
    const { data, error } = await db.from('store_settings').select('key,value').in('key', ['shipping', 'loyalty']);
    if (error || !data) return STORE_CONF;
    const sh = data.find(r => r.key === 'shipping')?.value || {};
    const ly = data.find(r => r.key === 'loyalty')?.value || null;
    STORE_CONF = {
      fee: +sh.fee >= 0 ? +sh.fee : 35,
      free_from: +sh.free_from > 0 ? +sh.free_from : 350,
      delivery_note: sh.delivery_note || '',
      loyalty: ly && ly.enabled !== false ? { rate: +ly.pts_per_sar || 1, welcome: +ly.welcome_pts || 0, couponOn: ly.coupon_enabled !== false } : null
    };
    try { sessionStorage.setItem('allamea-conf', JSON.stringify({ t: Date.now(), v: STORE_CONF })); } catch (e) { }
  } catch (e) { }
  return STORE_CONF;
}
loadStoreConf();
const shipFee = total => total >= STORE_CONF.free_from ? 0 : STORE_CONF.fee;
const freeShipNote = () => STORE_CONF.fee ? `شحن مجاني للطلبات فوق <span class="num">${fmt(STORE_CONF.free_from)}</span> ر.س` : 'شحن مجاني لكل الطلبات';

/* ── قفل تمرير الصفحة ───────────────────────────── */
let locks = 0;
const lock = on => { locks = Math.max(0, locks + (on ? 1 : -1)); document.body.style.overflow = locks ? 'hidden' : ''; };

/* ── شاشة البداية ───────────────────────────────── */
(() => {
  const loader = $('#loader');
  const hide = () => { if (!loader.classList.contains('done')) { loader.classList.add('done'); setTimeout(() => loader.remove(), 1000); } };
  const t0 = performance.now();
  window.addEventListener('load', () => setTimeout(hide, Math.max(0, 1400 - (performance.now() - t0))));
  setTimeout(hide, 3500); /* ضمان عدم التعليق */
})();

/* ── الهيدر: زجاجي عند التمرير ──────────────────── */
const header = $('#header');
const onScrollHeader = () => header.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScrollHeader, { passive: true }); onScrollHeader();

/* ── قائمة الجوال ───────────────────────────────── */
const menuBtn = $('.menu-toggle'), nav = $('#nav');
menuBtn.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuBtn.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', open);
});
$$('#nav a').forEach(a => a.addEventListener('click', () => { nav.classList.remove('open'); menuBtn.classList.remove('open'); }));

/* ── تتبع القسم النشط ───────────────────────────── */
(() => {
  const links = $$('#nav a');
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { links.forEach(a => a.classList.remove('active')); map.get(e.target.id)?.classList.add('active'); }
  }), { rootMargin: '-40% 0px -55% 0px' });
  ['top', 'collection', 'heritage', 'packaging', 'contact'].forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
})();

/* ── الظهور الناعم ──────────────────────────────── */
const rvIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); rvIO.unobserve(e.target); } }), { threshold: .12 });
$$('.rv').forEach(el => rvIO.observe(el));

/* ── Parallax ───────────────────────────────────── */
(() => {
  const heroImg = $('.hero-bg img'), pImg = $('.parallax-img'), pBox = $('.parallax-box');
  let tick = false;
  const run = () => {
    tick = false;
    if (heroImg) heroImg.style.transform = `translateY(${scrollY * .22}px) scale(1.06)`;
    if (pImg && pBox) {
      const r = pBox.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight)
        pImg.style.transform = `translateY(${(r.top + r.height / 2 - innerHeight / 2) * -.10}px)`;
    }
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
  run();
})();

/* ── عرض المنتجات مع Skeleton ───────────────────── */
(() => {
  const grid = $('#products');
  const paint = () => {
    if (!PRODUCTS.length) return;
    grid.innerHTML = PRODUCTS.map(cardHTML).join('') + teaserHTML();
    $$('.p-card', grid).forEach((c, i) => setTimeout(() => c.classList.add('in'), 90 * i + 60));
  };
  document.addEventListener('catalog:refresh', paint);
  grid.innerHTML = PRODUCTS.map(() => '<div class="skeleton"></div>').join('') + '<div class="skeleton"></div>';
  const srcs = [...new Set(PRODUCTS.flatMap(p => [p.img, p.detail]))];
  const preload = Promise.allSettled(srcs.map(s => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = s; })));
  const minDelay = new Promise(r => setTimeout(r, 800));
  Promise.all([preload, minDelay]).then(paint);

  function cardHTML(p) {
    const badge = p.badge ? `<div class="badges"><span class="badge ${BADGE[p.badge][0]}">${BADGE[p.badge][1]}</span></div>` : '';
    return `<article class="p-card" data-id="${p.id}" tabindex="0" role="button" aria-label="${p.name}">
      <div class="p-visual"><img src="${p.img}" alt="${p.name}" loading="lazy">${badge}
        <button class="quick-add" data-quick="${p.id}">إضافة سريعة</button>
      </div>
      <div class="p-info">
        <div><h3>${p.name}</h3><span class="p-cat">${p.cat}</span></div>
        ${priceHTML(p)}
      </div>
    </article>`;
  }
  function teaserHTML() {
    return `<a class="p-teaser p-card in studio-teaser" href="studio.html" aria-label="استوديو اللامع الافتراضي">
      <img src="assets/allamea-logo-mono.png" alt="" onerror="this.classList.add('logo-missing')">
      <div><h3>استوديو اللامع</h3><p>VIRTUAL STUDIO™ · جرّب 
/* ── التزامن الحي مع لوحة التحكم: كل منتج يُحفظ يظهر هنا مباشرة ── */
(async () => {
  try {
    if (!/^https?:/.test(location.protocol)) return;
    const db = dbClient(); if (!db) return;
    const { data, error } = await db.from('products').select('*,categories(name)').eq('is_active', true).order('created_at', { ascending: false }).limit(24);
    if (error || !data?.length) return;
    const WL = (window.ALLAMEA_WEAR || {}).labels || {};
    const norm = r => ({
      id: r.id, name: r.name, cat: r.categories?.name || WL[r.wear_category] || 'مختارات الدار',
      price: +(r.sale_price ?? r.price) || 0, old: r.sale_price ? +r.price : null,
      badge: r.is_new ? 'new' : (r.sale_price ? 'sale' : (r.is_limited ? 'limited' : null)),
      img: r.image_url, detail: (Array.isArray(r.gallery) && r.gallery[1]) || r.image_url,
      desc: r.description || r.short_description || '',
      sizes: (r.sizes || []).length ? r.sizes : ['مقاس واحد'],
      colors: Array.isArray(r.colors) ? r.colors : [],
      stock: r.stock ?? 0,
      name_en: r.name_en || '', wearCat: r.wear_category || null, tryon: !!r.virtual_tryon,
      tags: Array.isArray(r.tags) ? r.tags : [], sku: r.sku || '',
      materials: [(r.short_description || 'خامات نخبوية مختارة من الدار'), 'تشطيب يدوي فاخر', 'فحص جودة مزدوج قبل الشحن'],
      care: ['تنظيف جاف فقط', 'يُحفظ بعيداً عن الرطوبة', 'كيّ من الداخل بحرارة منخفضة']
    });
    PRODUCTS.length = 0;
    data.filter(r => r.image_url).forEach(r => PRODUCTS.push(norm(r)));
    document.dispatchEvent(new Event('catalog:refresh'));
  } catch (e) { /* بلا اتصال — الكتالوج المحلي يبقى */ }
})();

القطع على شخصيتك الرقمية</p></div>
      <span class="teaser-cta">ادخل الاستوديو ←</span>
    </a>`;
  }
})();

/* فتح المنتج / إضافة سريعة */
$('#products').addEventListener('click', e => {
  const quick = e.target.closest('[data-quick]');
  if (quick) { e.stopPropagation(); const p = getP(quick.dataset.quick); addToCart(p.id, p.sizes[0], p.colors[0].name, 1); return; }
  const card = e.target.closest('.p-card[data-id]');
  if (card) openProduct(card.dataset.id);
});
$('#products').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('.p-card[data-id]')) openProduct(e.target.dataset.id);
});

/* ── نافذة المنتج ───────────────────────────────── */
const modal = $('#p-modal'), sheet = $('#p-sheet');
let sel = null; /* الاختيارات الحالية */

function openProduct(id) {
  const p = getP(id); if (!p) return;
  sel = { id: p.id, size: p.sizes[0], color: p.colors[0].name, qty: 1 };
  window.AlaTrack?.track('product_view', { cat: p.cat }, p.price, { id: p.id, name: p.name });
  const badge = p.badge ? `<span class="badge ${BADGE[p.badge][0]}">${BADGE[p.badge][1]}</span>` : '';
  const others = PRODUCTS.filter(x => x.id !== p.id).slice(0, 3);
  sheet.innerHTML = `
    <button class="p-close icon-x" data-close aria-label="إغلاق">×</button>
    <div class="p-gallery">
      <div class="p-main"><img id="p-main-img" src="${p.img}" alt="${p.name}"></div>
      <div class="p-thumbs">
        <button class="active" data-src="${p.img}" aria-label="الصورة الرئيسية"><img src="${p.img}" alt=""></button>
        <button data-src="${p.detail}" aria-label="تفاصيل الخامة"><img src="${p.detail}" alt=""></button>
      </div>
      <div class="p-seal">
        <span class="seal-ring"><img src="assets/allamea-logo.png" alt="" onerror="this.classList.add('logo-missing')"></span>
        <div><b>ختم الأصالة الرسمي</b><span>قطعة موثّقة برقم تسلسلي من الدار</span></div>
      </div>
    </div>
    <div class="p-details">
      <img src="assets/allamea-logo.png" alt="" onerror="this.classList.add('logo-missing')">
      <div><p class="p-kicker">${p.cat} · المجموعة الأولى</p><h3>${p.name}</h3></div>
      <div class="p-price-xl">${priceHTML(p, true)}${p.badge === 'sale' ? badge : ''}</div>
      <p class="p-desc">${p.desc}</p>
      <div><div class="opt-label"><span>المقاس</span><b id="sel-size">${sel.size}</b></div>
        <div class="sizes">${p.sizes.map((s, i) => `<button class="size ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</button>`).join('')}</div></div>
      <div><div class="opt-label"><span>اللون</span><b id="sel-color">${sel.color}</b></div>
        <div class="swatches">${p.colors.map((c, i) => `<button class="swatch ${i === 0 ? 'active' : ''}" data-color="${c.name}" aria-label="${c.name}"><i style="background:${c.hex}"></i></button>`).join('')}</div></div>
      <div class="p-acc">
        <details><summary>الخامات والصناعة</summary><div class="acc-body"><ul>${p.materials.map(m => `<li>${m}</li>`).join('')}</ul></div></details>
        <details><summary>العناية بالقطعة</summary><div class="acc-body"><ul>${p.care.map(c => `<li>${c}</li>`).join('')}</ul></div></details>
        <details><summary>الشحن والاستبدال</summary><div class="acc-body"><ul><li>${freeShipNote()}${STORE_CONF.delivery_note ? ' — ' + STORE_CONF.delivery_note : ''}</li><li>استبدال خلال 7 أيام بحالتها الأصلية</li><li>تغليف الدار الفاخر مجاناً</li></ul></div></details>
      </div>
      <div class="p-reviews" id="p-reviews"></div>
      <div class="buy-row">
        <div class="qty"><button data-q="-1" aria-label="إنقاص">−</button><b id="qty">1</b><button data-q="1" aria-label="زيادة">+</button></div>
        <button class="btn btn-gold" id="p-add"><span>إضافة إلى السلة · ${fmt(p.price)} ر.س</span></button>
      </div>
      <div class="similar"><h4>قد يليق بك أيضاً</h4>
        <div class="sim-row">${others.map(o => `<button class="sim-item" data-sim="${o.id}"><img src="${o.img}" alt="${o.name}"><span style="flex:1"><b>${o.name}</b><span class="num">${fmt(o.price)} ر.س</span></span></button>`).join('')}</div>
      </div>
    </div>`;
  openLayer(modal);
  bindSheet(p);
}

function bindSheet(p) {
  const main = $('.p-main', sheet), mainImg = $('#p-main-img', sheet);
  /* المعرض */
  $$('.p-thumbs button', sheet).forEach(b => b.addEventListener('click', () => {
    $$('.p-thumbs button', sheet).forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mainImg.style.opacity = 0;
    setTimeout(() => { mainImg.src = b.dataset.src; mainImg.style.opacity = 1; }, 220);
  }));
  /* التكبير */
  main.addEventListener('mousemove', e => {
    const r = main.getBoundingClientRect();
    mainImg.style.transformOrigin = `${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`;
  });
  main.addEventListener('mouseenter', () => main.classList.add('zooming'));
  main.addEventListener('mouseleave', () => main.classList.remove('zooming'));
  main.addEventListener('click', () => main.classList.toggle('zooming')); /* لمس */
  /* الاختيارات */
  $$('.size', sheet).forEach(b => b.addEventListener('click', () => {
    $$('.size', sheet).forEach(x => x.classList.remove('active')); b.classList.add('active');
    sel.size = b.dataset.size; $('#sel-size', sheet).textContent = sel.size;
  }));
  $$('.swatch', sheet).forEach(b => b.addEventListener('click', () => {
    $$('.swatch', sheet).forEach(x => x.classList.remove('active')); b.classList.add('active');
    sel.color = b.dataset.color; $('#sel-color', sheet).textContent = sel.color;
    window.AlaTrack?.track('color_change', { color: sel.color }, null, { id: p.id, name: p.name });
  }));
  $$('[data-q]', sheet).forEach(b => b.addEventListener('click', () => {
    sel.qty = Math.max(1, sel.qty + +b.dataset.q);
    $('#qty', sheet).textContent = sel.qty;
    updateAddLabel(p);
  }));
  const updateAddLabel = p => { $('#p-add span', sheet).textContent = `إضافة إلى السلة · ${fmt(p.price * sel.qty)} ر.س`; };
  $('#p-add', sheet).addEventListener('click', () => {
    addToCart(sel.id, sel.size, sel.color, sel.qty);
    closeLayer(modal);
    setTimeout(openCart, 250);
  });
  $$('[data-sim]', sheet).forEach(b => b.addEventListener('click', () => openProduct(b.dataset.sim)));
  window.AlameaAI?.mountReviews?.(p, $('#p-reviews', sheet));
}

/* ── السلة ──────────────────────────────────────── */
const drawer = $('#cart-drawer'), overlay = $('#overlay');
let cart = [];
try { cart = JSON.parse(localStorage.getItem('allamea-cart') || '[]'); } catch (e) { cart = []; }
cart = cart.filter(i => i && getP(i.id)); /* تجاهل عناصر قديمة لم تعد موجودة */
const saveCart = () => localStorage.setItem('allamea-cart', JSON.stringify(cart));
const cartTotal = () => cart.reduce((t, i) => t + getP(i.id).price * i.qty, 0);

function addToCart(id, size, color, qty) {
  const found = cart.find(i => i.id === id && i.size === size && i.color === color);
  if (found) found.qty += qty; else cart.push({ id, size, color, qty });
  saveCart(); renderCart();
  const pp = getP(id);
  window.AlaTrack?.track('cart_add', { size, color, qty }, (pp?.price || 0) * qty, { id, name: pp?.name || '' });
  const cc = $('.cart-count'); cc.classList.remove('bump'); void cc.offsetWidth; cc.classList.add('bump');
  toast('أُضيفت القطعة إلى سلتك');
}
function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  const cc = $('.cart-count');
  cc.textContent = count; cc.classList.toggle('zero', !count);
  const items = $('#cart-items'), bottom = $('#cart-bottom');
  if (!cart.length) {
    items.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24"><path d="M6 8h12l-1.2 11.2a1.6 1.6 0 0 1-1.6 1.4H8.8a1.6 1.6 0 0 1-1.6-1.4L6 8Z"/><path d="M9 10V6.5a3 3 0 0 1 6 0V10"/></svg>
      <p>سلتك فارغة — مجموعة الدار بانتظارك.</p>
      <button class="btn btn-ghost" data-close><span>مواصلة التصفح</span></button></div>`;
    bottom.innerHTML = '';
    return;
  }
  items.innerHTML = cart.map((i, x) => {
    const p = getP(i.id);
    return `<div class="cart-row">
      <img src="${p.img}" alt="${p.name}">
      <div class="ci"><h4>${p.name}</h4><span class="ci-meta num">${i.size} · ${i.color}</span>
        <div class="qty"><button data-cart-q="-1" data-x="${x}" aria-label="إنقاص">−</button><b>${i.qty}</b><button data-cart-q="1" data-x="${x}" aria-label="زيادة">+</button></div></div>
      <div class="cart-side"><button class="ci-remove" data-remove="${x}" aria-label="حذف">×</button><b class="num">${fmt(p.price * i.qty)} ر.س</b></div>
    </div>`;
  }).join('');
  bottom.innerHTML = `
    <div class="cart-total-row"><span>المجموع الفرعي</span><b class="num">${fmt(cartTotal())} <small>ر.س</small></b></div>
    <p class="cart-note">${freeShipNote()} — يشمل الطلب تغليف الدار الفاخر.</p>
    <button class="btn btn-gold" id="go-checkout"><span>إتمام الطلب</span></button>`;
  $('#go-checkout', bottom).addEventListener('click', () => { closeCart(); setTimeout(openCheckout, 300); });
}
$('#cart-items').addEventListener('click', e => {
  const q = e.target.closest('[data-cart-q]');
  if (q) { const i = cart[+q.dataset.x]; i.qty = Math.max(1, i.qty + +q.dataset.cartQ); saveCart(); renderCart(); return; }
  const rm = e.target.closest('[data-remove]');
  if (rm) { cart.splice(+rm.dataset.remove, 1); saveCart(); renderCart(); }
});
const openCart = () => { renderCart(); drawer.classList.add('open'); overlay.classList.add('show'); lock(true); };
const closeCart = () => { if (!drawer.classList.contains('open')) return; drawer.classList.remove('open'); overlay.classList.remove('show'); lock(false); };
$('.cart-open').addEventListener('click', openCart);

/* ── الدفع ──────────────────────────────────────── */
const checkout = $('#checkout'), coSheet = $('#checkout-sheet');
function openCheckout() {
  if (!cart.length) return;
  loadStoreConf();
  const total = cartTotal(), ship = shipFee(total);
  let disc = { code: '', pct: 0, amount: 0 };
  const grand = () => Math.max(0, total + ship - disc.amount);
  const L = STORE_CONF.loyalty;
  const pts = L ? Math.round(grand() * L.rate) : 0;
  coSheet.innerHTML = `
    <button class="p-close icon-x" data-close aria-label="إغلاق">×</button>
    <img src="assets/allamea-logo.png" alt="اللامع" onerror="this.classList.add('logo-missing')">
    <h3>إتمام الطلب</h3>
    <p class="checkout-sub">خطوة أخيرة وتصلك قطعتك بتغليف الدار.</p>
    <div class="co-summary">
      ${cart.map(i => { const p = getP(i.id); return `<div class="co-line"><span>${p.name} × <span class="num">${i.qty}</span></span><b class="num">${fmt(p.price * i.qty)} ر.س</b></div>`; }).join('')}
      <div class="co-line"><span>الشحن</span><b class="num">${ship ? ship + ' ر.س' : 'مجاني'}</b></div>
      <div class="co-line co-disc-line" id="co-disc-line" style="display:none"><span>خصم الكوبون</span><b class="num" id="co-disc"></b></div>
      <div class="co-line total"><span>الإجمالي</span><b class="num" id="co-grand">${fmt(grand())} ر.س</b></div>
      ${L ? `<p class="co-loyalty" id="co-loyalty">👑 يكافئ هذا الطلب سلتك بنحو <b class="num">${fmt(pts)}</b> نقطة ولاء${L.welcome ? ' + نقاط الترحيب لأول طلب' : ''}</p>` : ''}
    </div>
    <form id="co-form" novalidate>
      ${L?.couponOn ? `
      <div class="field coupon-field">
        <label>كوبون الخصم — إن وُجد</label>
        <input id="co-code" dir="ltr" autocomplete="off" placeholder="ALAMEA15" style="text-transform:uppercase;letter-spacing:1px">
        <small class="coupon-hint" id="co-code-hint"></small>
      </div>` : ''}
      <div class="field-row">
        <div class="field"><label>الاسم الكامل</label><input name="name" required placeholder="مثال: محمد الهمداني"></div>
        <div class="field"><label>رقم الجوال</label><input name="phone" required inputmode="tel" placeholder="05xxxxxxxx"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>المدينة</label><input name="city" required placeholder="الرياض"></div>
        <div class="field"><label>الحي / الرمز البريدي</label><input name="zip" placeholder="اختياري"></div>
      </div>
      <div class="field"><label>العنوان التفصيلي</label><textarea name="address" rows="2" required placeholder="اسم الشارع، رقم المبنى، أقرب معلم…"></textarea></div>
      <div class="pay-opts">
        <label class="pay-opt"><input type="radio" name="pay" value="card" checked><span>💳 بطاقة / مدى</span></label>
        <label class="pay-opt"><input type="radio" name="pay" value="cod"><span>الدفع عند الاستلام</span></label>
      </div>
      <button class="btn btn-gold" type="submit"><span>تأكيد الطلب · <span class="num" id="co-submit-amt">${fmt(grand())}</span> ر.س</span></button>
      <p class="co-secure">دفع مشفر وآمن — بياناتك محمية لدى الدار</p>
    </form>`;
  openLayer(checkout);
  window.AlaTrack?.track('checkout_start', { items: cart.length }, grand());

  const paintTotals = () => {
    const dl = $('#co-disc-line', coSheet);
    if (disc.amount > 0) { dl.style.display = ''; $('#co-disc', coSheet).textContent = '− ' + fmt(disc.amount) + ' ر.س'; }
    else dl.style.display = 'none';
    $('#co-grand', coSheet).textContent = fmt(grand()) + ' ر.س';
    const sb = $('#co-submit-amt', coSheet); if (sb) sb.textContent = fmt(grand());
    const lp = $('#co-loyalty', coSheet);
    if (lp && L) lp.innerHTML = `👑 يكافئ هذا الطلب سلتك بنحو <b class="num">${fmt(Math.round(grand() * L.rate))}</b> نقطة ولاء${L.welcome ? ' + نقاط الترحيب لأول طلب' : ''}`;
  };

  /* كوبون: فحص فوري عبر RPC آمن — لا يُحسم العدّ إلا عند تأكيد الطلب */
  const codeInp = $('#co-code', coSheet), hint = $('#co-code-hint', coSheet);
  if (codeInp) {
    let vt;
    codeInp.addEventListener('input', () => {
      clearTimeout(vt);
      const code = codeInp.value.trim().toUpperCase();
      disc = { code: '', pct: 0, amount: 0 }; paintTotals();
      if (!code) { hint.textContent = ''; return; }
      hint.innerHTML = '<span class="cp-check">نتحقق من الكوبون…</span>';
      vt = setTimeout(async () => {
        const db = dbClient();
        if (!db) { hint.textContent = ''; return; }
        try {
          const { data, error } = await db.rpc('coupon_peek', { p_code: code.toUpperCase() });
          if (error) { hint.innerHTML = '<span class="cp-bad">الكوبونات غير مفعّلة حالياً — أكمل طلبك بثقة</span>'; return; }
          const pct = +data;
          if (pct > 0) {
            disc = { code, pct, amount: Math.round(total * pct / 100) };
            hint.innerHTML = `<span class="cp-ok">✓ كوبون صالح — خصم ${pct}% يعادل ${fmt(disc.amount)} ر.س</span>`;
          } else hint.innerHTML = '<span class="cp-bad">الكود غير صالح أو منتهٍ</span>';
          paintTotals();
        } catch (e) { hint.textContent = ''; }
      }, 550);
    });
  }

  $('#co-form', coSheet).addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const missing = ['name', 'phone', 'city', 'address'].find(k => !(f.get(k) || '').trim());
    if (missing) { toast('فضلاً أكمل بيانات التوصيل'); $(`[name=${missing}]`, coSheet).focus(); return; }
    if (!/^[+\d][\d\s-]{7,}$/.test(f.get('phone').trim())) { toast('تحقق من رقم الجوال'); return; }
    let appliedCode = '', appliedDisc = 0, grant = grand();
    /* عدّ الاستخدام ذرّياً — لحظة الحقيقة الوحيدة */
    if (disc.code && disc.pct) {
      if (!navigator.onLine) { toast('الكوبون يحتاج اتصالاً لحسم قيمته — صِل ثم أعد المحاولة'); return; }
      try {
        const { data, error } = await dbClient().rpc('coupon_redeem', { p_code: disc.code });
        const pct = error ? 0 : +data;
        if (!(pct > 0)) {
          toast('انتهى الكوبون أو اكتمل استخدامه للتو — أكمل طلبك بدونه');
          disc = { code: '', pct: 0, amount: 0 }; paintTotals();
          codeInp.value = ''; hint.innerHTML = '<span class="cp-bad">لم يعد هذا الكوبون صالحاً</span>';
          return;
        }
        appliedCode = disc.code; appliedDisc = Math.round(total * pct / 100);
        grant = Math.max(0, total + ship - appliedDisc);
      } catch (err) { toast('تعذر تفعيل الكوبون الآن — حاول مجدداً'); return; }
    }
    confirmOrder({ name: f.get('name'), phone: f.get('phone').trim(), city: (f.get('city') || '').trim(), address: (f.get('address') || '').trim(), pay: f.get('pay'), grand: grant, coupon: appliedCode, discount: appliedDisc });
  });
}

/* ── الطلبات المؤجلة (Offline Orders) ───────────── */
const OFF_KEY = 'allamea-offline-orders';
const readOff = () => { try { return JSON.parse(localStorage.getItem(OFF_KEY) || '[]').filter(o => o && o.items?.length); } catch (e) { return []; } };
function queueOrder(row) {
  const q = readOff(); q.push({ ...row, queued_at: new Date().toISOString() });
  try { localStorage.setItem(OFF_KEY, JSON.stringify(q.slice(-20))); } catch (e) { }
  try { navigator.serviceWorker?.ready.then(r => r.sync?.register('sync-orders')).catch(() => { }); } catch (e) { }
}
async function flushOfflineOrders() {
  if (!navigator.onLine) return;
  const db = dbClient(); if (!db) return;
  const q = readOff(); if (!q.length) return;
  const left = [...q];
  while (left.length) {
    const { queued_at, ...clean } = left[0];
    try {
      const { error } = await db.from('orders').insert(clean);
      if (error) break;
      left.shift();
    } catch (e) { break; }
  }
  try { localStorage.setItem(OFF_KEY, JSON.stringify(left)); } catch (e) { }
  if (!left.length) toast('✦ أُرسلت طلباتك المؤجلة بنجاح');
}
addEventListener('app:flushOrders', flushOfflineOrders);
addEventListener('online', flushOfflineOrders);
flushOfflineOrders(); /* عند الإقلاع */

/* ── نجاح الطلب ─────────────────────────────────── */
const success = $('#success');
async function persistOrder(d) {
  const items = cart.map(i => { const p = getP(i.id); return { product_id: i.id, name: p?.name || '', size: i.size, color: i.color, qty: i.qty, price: p?.price || 0 }; });
  const row = {
    customer_name: d.name, customer_phone: d.phone, city: d.city, address: d.address,
    payment: d.pay, items, total: d.grand, status: 'new'
  };
  if (d.coupon) { row.coupon = d.coupon; row.discount = d.discount || 0; }
  const db = dbClient();
  if (!db || !navigator.onLine) { queueOrder(row); return { offline: true }; }
  try {
    const { data, error } = await db.from('orders').insert(row).select('id').maybeSingle();
    if (error) { queueOrder(row); return { offline: true }; }
    return { id: data?.id };
  } catch (e) { queueOrder(row); return { offline: true }; }
}

async function confirmOrder(d) {
  const no = 'LM-' + Date.now().toString(36).toUpperCase().slice(-6);
  $('#order-no').textContent = no;
  const items = cart.map(i => ({ ...i, p: getP(i.id) })).filter(i => i.p);
  const res = await persistOrder(d);
  window.AlaTrack?.track('order_complete', { order_no: no, order_id: res.id || null, items: items.length, offline: !!res.offline }, d.grand);
  items.forEach(i => window.AlaTrack?.track('purchase', { size: i.size, color: i.color, qty: i.qty, order_no: no }, i.p.price * i.qty, { id: i.id, name: i.p.name }));
  if (d.coupon) window.AlaTrack?.track('coupon_use', { code: d.coupon, order_no: no }, d.discount);
  cart = []; saveCart(); renderCart();
  closeLayer(checkout);
  const note = $('.success-note');
  if (res.offline) {
    note.textContent = 'اتصالك بالإنترنت متقطع الآن — حُفظ طلبك بأمان على جهازك وسيُرسل تلقائياً فور عودة الاتصال. رقم طلبك مرجعك مع مستشار الدار.';
  } else {
    const L = STORE_CONF.loyalty, pts = L ? Math.round(d.grand * L.rate) : 0;
    note.innerHTML = 'سيتواصل معك مستشار الدار خلال <span class="num">24</span> ساعة لتأكيد التفاصيل.'
      + (pts ? `<br><span class="loyalty-pts">👑 في نظام ولاء الدار تُعادل هذه السلة <b class="num">${fmt(pts)}</b> نقطة — تُرصد مع عضويتك عند إطلاق البرنامج.</span>` : '')
      + (d.coupon ? `<br><small>كوبون <b class="num" dir="ltr">${d.coupon}</b> حسم لك ${fmt(d.discount)} ر.س ✓</small>` : '');
  }
  success.classList.add('open'); lock(true);
  /* إعادة تشغيل حركة الشعار عند كل نجاح */
  const logo = $('.success-logo'); logo.style.animation = 'none'; void logo.offsetWidth; logo.style.animation = '';
}
$('#success-back').addEventListener('click', () => { success.classList.remove('open'); lock(false); });

/* ── طبقات مشتركة ───────────────────────────────── */
function openLayer(el) { el.classList.add('open'); lock(true); }
function closeLayer(el) { if (el.classList.contains('open')) { el.classList.remove('open'); lock(false); } }
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { closeLayer(modal); closeLayer(checkout); closeCart(); }
});
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (success.classList.contains('open')) { success.classList.remove('open'); lock(false); }
  else { closeLayer(modal); closeLayer(checkout); closeCart(); }
});

/* ── النشرة والتنبيهات ──────────────────────────── */
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
$('#newsletter-form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = e.target.email;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inp.value.trim())) { toast('أدخل بريداً إلكترونياً صحيحاً'); inp.focus(); return; }
  inp.value = ''; toast('أهلاً بك في قائمة الدار الخاصة');
  window.AlaTrack?.track('newsletter_signup', { email: inp.value ? '' : '' });
});

/* ── جسر منصة AL LAMEA AI™ ─────────────────────── */
window.Alamea = { products: PRODUCTS, get: getP, add: addToCart, open: openProduct, openCart, toast };

/* ── تهيئة أولية ────────────────────────────────── */
renderCart();
