/* ══════════════════════════════════════════════════════════
   لوحة تحكم اللامع — نظام إدارة المنتجات المتكامل
   كل تغيير هنا ينعكس مباشرة: المتجر · الاستوديو · البحث
   ══════════════════════════════════════════════════════════ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db = createClient('https://lebuvkypywblwrjhabpn.supabase.co', 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u');

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (+n || 0).toLocaleString('en-US');
const money = n => `${fmt(n)} ر.س`;
const view = $('#view');
let me = null;

/* ─── ثوابت النظام ─────────────────────────── */
const WEAR_CATS = [
  ['maawaz', 'معاوز'], ['thobe', 'أثواب'], ['shamzan', 'شمزان'], ['vest', 'صديري'],
  ['jambiya', 'جنابي'], ['belt', 'أحزمة'], ['turban', 'عمائم'], ['shemagh', 'شماغ'],
  ['shoes', 'أحذية'], ['watch', 'ساعات'], ['perfume', 'عطور'], ['accessories', 'إكسسوارات']
];
const LAYER_DEFAULT = { perfume: 5, thobe: 10, maawaz: 20, shamzan: 30, vest: 40, belt: 50, jambiya: 60, accessories: 70, turban: 80, shemagh: 80, watch: 90, shoes: 100 };
const STD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const FLAGS = [
  ['is_new', 'منتج جديد', 'شارة "جديد" في المتجر'],
  ['is_best_seller', 'الأكثر مبيعًا', 'للترتيب والإبراز'],
  ['is_limited', 'إصدار محدود', 'شارة الإصدار المحدود'],
  ['is_featured', 'منتج مميز', 'إبراز خاص'],
  ['show_home', 'إظهار في الرئيسية', 'قسم المميزين'],
  ['show_offers', 'إظهار في العروض', 'قسم التخفيضات'],
  ['allow_reviews', 'السماح بالتقييمات', 'تفعيل التقييم لاحقاً']
];
const STATUS_OPTS = [['active', 'متوفر'], ['draft', 'مسودة'], ['hidden', 'مخفي']];
const rand = n => Math.random().toString(36).slice(2, 2 + n).toUpperCase();
const genSlug = p => ((p.name_en || p.name || 'product').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-').replace(/^-+|-+$/g, '') || 'product') + '-' + rand(4).toLowerCase();
const genSKU = () => 'LM-' + rand(6);
const toLocal = iso => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const finalPrice = x => +(x.sale_price ?? x.price) || 0;
const threshold = x => x.low_stock_threshold ?? 3;
function statusOf(x) {
  if (x.status === 'draft') return ['draft', 'مسودة', 'c-warn'];
  if (x.status === 'hidden' || x.is_active === false) return ['hidden', 'مخفي', 'c-muted'];
  if ((x.stock ?? 0) === 0) return ['out', 'نفد', 'c-danger'];
  if ((x.stock ?? 0) <= threshold(x)) return ['low', 'قريب النفاد', 'c-warn'];
  return ['ok', 'متوفر', 'c-ok'];
}

/* ─── تنبيهات وحوار تأكيد ───────────────────── */
let toastT;
function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', err); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}
function confirmDlg(title, msg, label = 'تأكيد') {
  return new Promise(res => {
    const d = $('#confirm-dialog');
    $('#confirm-title').textContent = title;
    $('#confirm-msg').textContent = msg;
    $('#confirm-yes').textContent = label;
    d.showModal();
    $('#confirm-yes').onclick = () => { d.close(); res(true); };
    $('#confirm-no').onclick = () => { d.close(); res(false); };
  });
}

/* ══════════ الدخول ══════════ */
async function start() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;
  const { data: p } = await db.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  if (!p) { $('#auth-msg').textContent = 'الحساب موجود، لكن لم تُمنح له صلاحية بعد. راجع خطوة تعيين المدير في ملف schema.sql.'; return; }
  me = p;
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#role').textContent = p.full_name || p.role;
  load('dashboard');
}
$('#login').onsubmit = async e => {
  e.preventDefault();
  $('#auth-msg').textContent = 'جارٍ التحقق…';
  const f = new FormData(e.target);
  const { error } = await db.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
  $('#auth-msg').textContent = error ? 'بيانات الدخول غير صحيحة.' : '';
  if (!error) start();
};
$('#signout').onclick = async () => { await db.auth.signOut(); location.reload(); };
/* إظهار كلمة المرور */
(() => {
  const inp = $('#password'), t = $('.password-toggle');
  const toggle = () => { const shown = inp.type === 'text'; inp.type = shown ? 'password' : 'text'; t.classList.toggle('shown', !shown); };
  t.onclick = toggle;
  t.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
})();
/* استعادة */
const resetDlg = $('#reset-dialog');
$('#forgot-password').onclick = e => {
  e.preventDefault();
  const em = $('#login [name=email]').value.trim();
  if (em) resetDlg.querySelector('[name=reset-email]').value = em;
  resetDlg.showModal();
};
$('#reset-close').onclick = () => resetDlg.close();
$('#reset-form').onsubmit = async e => {
  e.preventDefault();
  const email = new FormData(e.target).get('reset-email');
  $('#reset-msg').textContent = 'جارٍ الإرسال…';
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  $('#reset-msg').textContent = error ? 'تعذر الإرسال. تأكد من البريد.' : 'تم الإرسال — تحقق من بريدك.';
};
$('#today').textContent = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'full' }).format(new Date());

/* ══════════ التوجيه ══════════ */
$$('.side nav button').forEach(b => b.onclick = () => load(b.dataset.page));
let AIADM = null;
const loadAIAdmin = () => AIADM || (AIADM = import('./ai-admin.js?v=20260731-2'));
function load(page) {
  window.__biCleanup?.(); window.__suiteCleanup?.();
  $('.side nav .active').classList.remove('active');
  $(`.side nav [data-page="${page}"]`).classList.add('active');
  $('#page-title').textContent = { dashboard: 'القيادة الذكية', suite: 'مركز الذكاء والأتمتة', monitor: 'المراقبة والسجلات', products: 'إدارة المنتجات', orders: 'الطلبات', team: 'فريق العمل' }[page];
  ({ dashboard, suite, monitor, products, orders, team })[page]();
}

/* ══════════ مركز الذكاء والأتمتة (PART 3 — تحميل كسول) ══════════ */
async function suite() {
  view.innerHTML = `<div class="bi-loading"><div class="skel" style="aspect-ratio:auto;height:120px;margin-bottom:18px"></div><div class="pgrid">${'<div class="skel"></div>'.repeat(6)}</div></div>`;
  try {
    const m = await loadAIAdmin();
    await m.renderSuite({ view, db, ops, me });
  } catch (e) { view.innerHTML = `<p class="err">تعذر تحميل مركز الذكاء: ${esc(e.message)}</p>`; }
}

/* ══════════ المراقبة والسجلات ══════════ */
async function monitor() {
  view.innerHTML = `<div class="bi-loading"><div class="pgrid">${'<div class="skel"></div>'.repeat(6)}</div></div>`;
  try {
    const m = await loadAIAdmin();
    await m.renderMonitor({ view, db, me });
  } catch (e) { view.innerHTML = `<p class="err">تعذر تحميل المراقبة: ${esc(e.message)}</p>`; }
}

/* ══════════ سجل التدقيق (Audit) ══════════ */
async function audit(action, entity, id, detail = {}) {
  try { await db.from('audit_log').insert({ actor: me?.full_name || me?.role || 'staff', action, entity, entity_id: String(id || ''), detail }); } catch (e) { }
}

/* ══════════ جسر عمليات مقترحات الذكاء — كل تنفيذ بعد موافقة المسؤول ══════════ */
const ops = {
  toast, audit, confirm: confirmDlg,
  products: () => items, cats: () => cats, db,
  gotoProducts() { load('products'); },
  newProduct(prefill = {}) { load('products'); openEditor(); Object.assign(ed, prefill); edDirty = true; renderEditor(); },
  newDesc(p, draft) {
    const item = items.find(x => x.id === p.id);
    if (!item) return toast('المنتج غير محمّل حالياً — حدّث قائمة المنتجات', true);
    if ($('.side nav .active')?.dataset.page !== 'products') load('products');
    openEditor(item);
    ed.description = draft;
    edDirty = true;
    renderEditor();
    toast('✦ أُدرجت المسودة — راجعها ثم احفظ لاعتمادها');
  },
  editProduct(id) {
    const p = items.find(x => x.id === id);
    if (!p) return toast('المنتج غير محمّل حالياً — حدّث قائمة المنتجات', true);
    if ($('.side nav .active')?.dataset.page !== 'products') load('products');
    openEditor(p);
  },
  async patchProduct(id, patch, auditDetail = {}) {
    const p = items.find(x => x.id === id);
    if (!p) return null;
    const { error } = await db.from('products').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast('فشل التحديث: ' + error.message, true); return null; }
    Object.assign(p, patch);
    paintProducts();
    return p;
  }
};

/* ══════════ نظرة عامة — لوحة ذكاء الأعمال (تحميل كسول) ══════════ */
async function dashboard() {
  view.innerHTML = `<div class="bi-loading"><div class="skel" style="aspect-ratio:auto;height:130px;margin-bottom:18px"></div><div class="pgrid">${'<div class="skel"></div>'.repeat(8)}</div></div>`;
  try {
    window.__biCleanup?.();
    const m = await import('./bi.js?v=20260731-2');
    await m.renderBI({ view, db });
  } catch (e) {
    view.innerHTML = `<p class="err">تعذر تحميل لوحة المؤشرات: ${esc(e.message)}</p>`;
  }
}

/* ══════════ الطلبات ══════════ */
async function orders() {
  const { data } = await db.from('orders').select('*').order('created_at', { ascending: false });
  const st = { new: 'جديد', confirmed: 'مؤكد', processing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي' };
  /* الناقلون المعهودون + أي ناقل سُجّل سابقاً — يغذي Shipping Intelligence ببيانات فعلية */
  const known = [...new Set((data || []).map(o => o.carrier).filter(Boolean))];
  const carriers = [...new Set(['سمسا SMSA', 'أرامكس Aramex', 'ناقل Naqel', 'سبل SPL', 'إي إم إكس iMile', 'جي أند كي G&K', ...known])];
  view.innerHTML = `<div class="table-wrap"><table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>الإجمالي</th><th>الناقل</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>
    ${(data || []).map(x => `<tr><td><b class="num">#${x.id.slice(0, 7)}</b>${x.coupon ? `<small class="c-gold" style="display:block">كوبون ${esc(x.coupon)} −${money(x.discount || 0)}</small>` : ''}</td><td><b>${esc(x.customer_name || '—')}</b><small>${esc(x.customer_phone || '')}</small></td><td class="num">${money(x.total)}</td>
      <td><input class="order-carrier" list="carrier-list" data-id="${x.id}" value="${esc(x.carrier || '')}" placeholder="سمسا / أرامكس…" aria-label="شركة الشحن"></td>
      <td><select class="order-status" data-id="${x.id}">${Object.entries(st).map(([v, n]) => `<option value="${v}" ${x.status === v ? 'selected' : ''}>${n}</option>`).join('')}</select></td><td>${new Date(x.created_at).toLocaleDateString('ar-SA')}</td></tr>`).join('') || '<tr><td colspan="6" class="none">لا توجد طلبات حتى الآن.</td></tr>'}
  </tbody></table></div>
  <datalist id="carrier-list">${carriers.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
  $$('.order-status').forEach(s => s.onchange = async () => {
    const stamp = {};
    if (s.value === 'shipped') stamp.shipped_at = new Date().toISOString();
    if (s.value === 'delivered') stamp.delivered_at = new Date().toISOString();
    const { error } = await db.from('orders').update({ status: s.value, ...stamp }).eq('id', s.dataset.id);
    if (error) { toast(error.message, true); return; }
    audit('order.status', 'orders', s.dataset.id, { to: s.value });
    toast(`حُدّث الطلب إلى «${st[s.value]}»`);
  });
  $$('.order-carrier').forEach(inp => inp.onchange = async () => {
    const carrier = inp.value.trim().slice(0, 60);
    const { error } = await db.from('orders').update({ carrier: carrier || null }).eq('id', inp.dataset.id);
    if (error) { toast(error.message, true); return; }
    audit('order.carrier', 'orders', inp.dataset.id, { carrier });
    toast(carrier ? `✦ سُجّل الناقل «${carrier}» — يظهر في Shipping Intelligence` : 'أُزيل اسم الناقل');
  });
}

/* ══════════ الفريق ══════════ */
function team() {
  view.innerHTML = `<section class="welcome"><p>إدارة الفريق</p><h2>إضافة الأعضاء<br>تتم بأمان من Supabase.</h2>
  <ol><li>اذهب إلى <b>Authentication → Users</b> وأنشئ مستخدماً.</li>
  <li>من SQL Editor أضف له سجل profile وحدد الدور: admin أو products أو orders.</li>
  <li>دور products يتيح إدارة المنتجات والتصنيفات فقط ولا يرى الطلبات.</li></ol></section>`;
}

/* ══════════════════════════════════════════════
   نموذج المنتجات — الإدارة الكاملة
   ══════════════════════════════════════════════ */
let items = [], cats = [];
const F = { q: '', cat: '', status: 'all', min: '', max: '', tag: '', sort: 'new' };

async function products() {
  view.innerHTML = `<div class="stats">${'<div class="skel" style="aspect-ratio:4"></div>'.repeat(4)}</div><div class="pgrid">${'<div class="skel"></div>'.repeat(6)}</div>`;
  const [{ data: it }, { data: ct }] = await Promise.all([
    db.from('products').select('*,categories(name)').order('created_at', { ascending: false }),
    db.from('categories').select('*').order('name')
  ]);
  items = it || []; cats = ct || [];
  paintProducts();
}

function counters() {
  return {
    total: items.length,
    ok: items.filter(x => statusOf(x)[0] === 'ok').length,
    low: items.filter(x => ['low', 'out'].includes(statusOf(x)[0])).length,
    hidden: items.filter(x => statusOf(x)[0] === 'hidden').length,
    draft: items.filter(x => statusOf(x)[0] === 'draft').length
  };
}

function filtered() {
  let list = [...items];
  const q = F.q.trim();
  if (q) list = list.filter(x => [x.name, x.name_en, x.sku, x.slug, x.barcode].some(v => (v || '').toLowerCase().includes(q.toLowerCase())));
  if (F.cat) list = list.filter(x => x.category_id === F.cat);
  if (F.status !== 'all') list = list.filter(x => statusOf(x)[0] === F.status || (F.status === 'low' && ['low', 'out'].includes(statusOf(x)[0])));
  if (F.min !== '') list = list.filter(x => finalPrice(x) >= +F.min);
  if (F.max !== '') list = list.filter(x => finalPrice(x) <= +F.max);
  if (F.tag) list = list.filter(x => (x.tags || []).includes(F.tag));
  const sorters = {
    new: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    old: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    priceAsc: (a, b) => finalPrice(a) - finalPrice(b),
    priceDesc: (a, b) => finalPrice(b) - finalPrice(a),
    sold: (a, b) => (b.sold_count || 0) - (a.sold_count || 0),
    name: (a, b) => (a.name || '').localeCompare(b.name || '', 'ar')
  };
  return list.sort(sorters[F.sort] || sorters.new);
}

function paintProducts() {
  const c = counters();
  const allTags = [...new Set(items.flatMap(x => x.tags || []))];
  view.innerHTML = `
  <div class="stats">
    <article class="stat"><span><i></i>إجمالي المنتجات</span><b class="num">${c.total}</b><small>كل القطع</small></article>
    <article class="stat ok"><span><i></i>متوفرة</span><b class="num">${c.ok}</b><small>ظاهرة في المتجر</small></article>
    <article class="stat warn"><span><i></i>مخزون منخفض / نافد</span><b class="num">${c.low}</b><small>تحتاج انتباهاً</small></article>
    <article class="stat"><span><i></i>مخفية</span><b class="num">${c.hidden}</b><small>لا تظهر للعملاء</small></article>
    <article class="stat"><span><i></i>مسودات</span><b class="num">${c.draft}</b><small>قيد العمل</small></article>
  </div>

  <div class="toolbar">
    <div class="tb-row">
      <div class="tb-title"><b>المنتجات</b><span>إدارة كاملة — كل تغيير ينعكس مباشرة على المتجر والاستوديو</span></div>
      <div class="tb-actions">
        <button class="ghost" id="p-export">⬇ تصدير CSV</button>
        <button class="ghost" id="p-import">⬆ استيراد CSV/Excel</button>
        <input type="file" id="p-import-file" accept=".csv,text/csv" hidden>
        <button class="btn-primary" id="add-p"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>إضافة منتج جديد</button>
      </div>
    </div>
    <div class="tb-row">
      <div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg><input id="fq" placeholder="ابحث بالاسم، الإنجليزي، SKU، الباركود…" value="${esc(F.q)}"></div>
      <select class="f-select" id="fcat"><option value="">كل التصنيفات</option>
        ${cats.map(x => `<option value="${x.id}" ${F.cat === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <select class="f-select" id="fsort">
        ${[['new', 'الأحدث'], ['old', 'الأقدم'], ['priceDesc', 'السعر: الأعلى'], ['priceAsc', 'السعر: الأدنى'], ['sold', 'الأكثر مبيعًا'], ['name', 'الاسم أبجدياً']].map(([v, n]) => `<option value="${v}" ${F.sort === v ? 'selected' : ''}>${n}</option>`).join('')}
      </select>
      ${allTags.length ? `<select class="f-select" id="ftag"><option value="">كل العلامات</option>${allTags.map(t => `<option ${F.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
    </div>
    <div class="tb-row">
      <div class="chips">
        ${[['all', 'الكل'], ['ok', 'متوفر'], ['low', 'منخفض/نافد'], ['hidden', 'مخفي'], ['draft', 'مسودة']].map(([v, n]) => `<button class="f-chip ${F.status === v ? 'on' : ''}" data-st="${v}">${n}</button>`).join('')}
      </div>
      <div class="price-range">
        <span>السعر من</span><input type="number" id="fmin" placeholder="0" value="${F.min}">
        <span>إلى</span><input type="number" id="fmax" placeholder="∞" value="${F.max}">
      </div>
    </div>
  </div>

  <div class="pgrid" id="pgrid"></div>`;

  $('#add-p').onclick = () => openEditor();
  $('#p-export').onclick = exportProductsCSV;
  $('#p-import').onclick = () => $('#p-import-file').click();
  $('#p-import-file').onchange = e => importProductsCSV(e.target.files[0]);
  let deb;
  $('#fq').oninput = e => { clearTimeout(deb); deb = setTimeout(() => { F.q = e.target.value; paintGrid(); }, 180); };
  $('#fcat').onchange = e => { F.cat = e.target.value; paintGrid(); };
  $('#fsort').onchange = e => { F.sort = e.target.value; paintGrid(); };
  const tg = $('#ftag'); if (tg) tg.onchange = e => { F.tag = e.target.value; paintGrid(); };
  $$('[data-st]').forEach(b => b.onclick = () => { F.status = b.dataset.st; $$('[data-st]').forEach(x => x.classList.toggle('on', x === b)); paintGrid(); });
  $('#fmin').onchange = e => { F.min = e.target.value; paintGrid(); };
  $('#fmax').onchange = e => { F.max = e.target.value; paintGrid(); };
  paintGrid();
}

function paintGrid() {
  const list = filtered();
  const grid = $('#pgrid');
  grid.innerHTML = list.map((x, i) => cardHTML(x, i)).join('') || `<div class="empty-grid">
    <svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z"/></svg>
    <b>${items.length ? 'لا نتائج مطابقة' : 'لا توجد منتجات بعد'}</b>
    ${items.length ? 'جرّب توسيع البحث أو إزالة الفلاتر.' : 'ابدأ بإضافة أول قطعة لمتجرك.'}</div>`;
  $$('.pcard', grid).forEach((card, i) => card.style.animationDelay = Math.min(i * 40, 400) + 'ms');

  $$('[data-edit]', grid).forEach(b => b.onclick = () => openEditor(items.find(x => x.id === b.dataset.edit)));
  $$('[data-menu]', grid).forEach(b => b.onclick = e => {
    e.stopPropagation();
    const card = b.closest('.pcard'), was = card.classList.contains('menu-open');
    $$('.pcard.menu-open').forEach(c => c.classList.remove('menu-open'));
    if (!was) card.classList.add('menu-open');
  });
  $$('[data-act]', grid).forEach(b => b.onclick = () => cardAction(b.dataset.act, b.dataset.id));
  $$('[data-vt]', grid).forEach(b => b.onclick = async () => {
    const x = items.find(i => i.id === b.dataset.vt);
    const nv = !x.virtual_tryon;
    b.classList.toggle('on', nv); b.textContent = nv ? '✦' : '✧';
    x.virtual_tryon = nv;
    const { error } = await db.from('products').update({ virtual_tryon: nv }).eq('id', x.id);
    if (error) { x.virtual_tryon = !nv; b.classList.toggle('on', !nv); toast('تعذر التحديث', true); }
    else toast(nv ? `«${x.name}» يظهر الآن في الاستوديو الافتراضي` : `أُخفي «${x.name}» من الاستوديو`);
  });
}

function cardHTML(x) {
  const [st, stName, stCls] = statusOf(x);
  const flags = [
    x.is_new ? ['جديد', 'c-gold'] : null,
    x.is_limited ? ['محدود', 'c-warn'] : null,
    x.sale_price ? ['خصم', 'c-danger'] : null,
    x.is_best_seller ? ['مبيعاً', 'c-ok'] : null
  ].filter(Boolean);
  return `<article class="pcard" data-id="${x.id}">
    <div class="pm">
      ${x.image_url ? `<img src="${esc(x.image_url)}" alt="${esc(x.name)}" loading="lazy">` : '<div class="noimg">بدون صورة</div>'}
      <div class="pm-badges">
        <span class="chip ${stCls}">${stName}</span>
        ${flags.map(([n, c]) => `<span class="chip ${c}">${n}</span>`).join('')}
      </div>
      <button class="pm-vt ${x.virtual_tryon ? 'on' : ''}" data-vt="${x.id}" title="الظهور في الاستوديو الافتراضي">${x.virtual_tryon ? '✦' : '✧'}</button>
    </div>
    <div class="pi">
      <div class="pi-top">
        <h4>${esc(x.name)}<small>${esc(x.name_en || x.sku || '')}</small></h4>
        <div class="pi-price">${fmt(finalPrice(x))}<s>${x.sale_price ? fmt(x.price) : ''}</s></div>
      </div>
      <div class="pi-meta">
        <span>${esc(x.categories?.name || 'بلا تصنيف')}</span><i class="dot-sep"></i>
        <span class="num">مخزون ${x.stock ?? 0}</span><i class="dot-sep"></i>
        <span>${(x.sizes || []).length ? (x.sizes || []).join(' · ') : 'بلا مقاسات'}</span>
      </div>
      <div class="pi-actions">
        <button class="edit" data-edit="${x.id}">تعديل المنتج</button>
        <button class="mnu" data-menu aria-label="خيارات">⋯</button>
      </div>
    </div>
    <div class="card-menu">
      <button data-act="dup" data-id="${x.id}">⧉ نسخ المنتج</button>
      <button data-act="vis" data-id="${x.id}">${st === 'hidden' ? '◉ إظهار في المتجر' : '◎ إخفاء من المتجر'}</button>
      <button data-act="del" data-id="${x.id}" class="del">🗑 حذف نهائي</button>
    </div>
  </article>`;
}

async function cardAction(act, id) {
  const x = items.find(i => i.id === id);
  if (!x) return;
  if (act === 'dup') {
    const { id: _1, created_at, updated_at, ...body } = x;
    delete body.categories;
    body.name = x.name + ' — نسخة';
    body.slug = genSlug(x);
    body.sku = genSKU();
    body.status = 'draft'; body.is_active = false;
    const { error } = await db.from('products').insert(body);
    if (error) return toast(error.message, true);
    toast(`أُنشئت نسخة مسودة من «${x.name}»`);
    products();
  }
  if (act === 'vis') {
    const show = statusOf(x)[0] === 'hidden';
    x.status = show ? 'active' : 'hidden'; x.is_active = show;
    await db.from('products').update({ status: x.status, is_active: show }).eq('id', id);
    paintProducts();
    toast(show ? `«${x.name}» ظاهر الآن في المتجر` : `أُخفي «${x.name}» من المتجر`);
  }
  if (act === 'del') {
    if (!(await confirmDlg('حذف المنتج', `سيُحذف «${x.name}» نهائياً من المتجر والاستوديو. لا يمكن التراجع.`, 'حذف نهائي'))) return;
    const { error } = await db.from('products').delete().eq('id', id);
    if (error) return toast(error.message, true);
    audit('product.delete', 'products', id, { name: x.name });
    items = items.filter(i => i.id !== id);
    paintProducts();
    toast(`حُذف «${x.name}»`);
  }
}

/* ══════════════════════════════════════════════
   محرّر المنتج — كل الأقسام
   ══════════════════════════════════════════════ */
let ed = null, edDirty = false;
const edRoot = document.createElement('div');
document.body.appendChild(edRoot);

function blankProduct() {
  return {
    id: null, name: '', name_en: '', short_description: '', description: '',
    sku: '', barcode: '', category_id: '', tags: [],
    image_url: '', gallery: [], image_360: '', studio_asset: '',
    colors: [], sizes: [], size_stock: {},
    price: '', sale_price: '', sale_start: '', sale_end: '', currency: 'SAR', tax_rate: 0,
    stock: 0, low_stock_threshold: 3, status: 'active',
    flags: { is_new: true, is_best_seller: false, is_limited: false, is_featured: false, show_home: true, show_offers: false, allow_reviews: true },
    virtual_tryon: false, wear_category: '', layer_order: '',
    meta_title: '', meta_description: '', og_image: '', slug: ''
  };
}
function normProduct(p) {
  const b = blankProduct();
  Object.keys(b).forEach(k => { if (p[k] !== undefined && p[k] !== null) b[k] = p[k]; });
  b.flags = {};
  FLAGS.forEach(([k]) => b.flags[k] = !!p[k]);
  b.colors = Array.isArray(p.colors) ? p.colors.map(c => ({ name: c.name || '', hex: c.hex || '#B89146', image: c.image || '' })) : [];
  b.gallery = Array.isArray(p.gallery) ? [...p.gallery] : [];
  b.size_stock = p.size_stock && typeof p.size_stock === 'object' ? { ...p.size_stock } : {};
  b.sizes = Array.isArray(p.sizes) ? [...p.sizes] : [];
  b.tags = Array.isArray(p.tags) ? [...p.tags] : [];
  b.sale_start = toLocal(p.sale_start); b.sale_end = toLocal(p.sale_end);
  b.layer_order = p.layer_order ?? '';
  return b;
}

const ICO = {
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v.5M12 11v5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 18 5-5 3 3 4-4 4 4"/></svg>',
  color: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.3-2.2s-.3-2.3 1.2-2.6c2.6-.5 4.5-2.2 4.5-4.7C19 6 15.9 3 12 3Z"/></svg>',
  size: '<svg viewBox="0 0 24 24"><path d="M4 7h16v10H4z"/><path d="M8 7v3M12 7v4M16 7v3"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="m20.6 13.4-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="8" cy="8" r="1.6"/></svg>',
  price: '<svg viewBox="0 0 24 24"><path d="M12 3v18M17 6.5c-.8-1.6-2.7-2.5-5-2.5-3 0-5 1.5-5 4s2 3.5 5 3.5 5 1.5 5 4-2 4-5 4c-2.3 0-4.2-.9-5-2.5"/></svg>',
  stock: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4v8l-8 4-8-4V8Z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>',
  flags: '<svg viewBox="0 0 24 24"><path d="M5 21V4c4-2 7 2 11 0v9c-4 2-7-2-11 0"/></svg>',
  studio: '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><path d="M6 21v-1.5a6 6 0 0 1 12 0V21M4 4l2 2M20 4l-2 2"/></svg>',
  seo: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6M11 8v6"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 20h14"/></svg>'
};

function imgField(key, label, hint, ph = 'https://…') {
  const v = ed[key] || '';
  return `<div>
    <label class="field">${label}</label>
    <div class="img-mainbox" style="margin-top:8px">
      <div class="img-preview" data-prev="${key}">${v ? `<img src="${esc(v)}" alt="">` : `<span class="ph">معاينة<br>${label}</span>`}</div>
      <div>
        <input type="url" data-set="${key}" value="${esc(v)}" placeholder="${ph}" dir="ltr">
        <div class="dropzone" data-upload="${key}" style="margin-top:10px">
          ${ICO.up}<br>اسحب صورة هنا أو انقر للرفع
          <input type="file" accept="image/*">
          <small>${hint} · يُرفع إلى مخزن Supabase أو يُدرج كرابط</small>
        </div>
      </div>
    </div>
  </div>`;
}

function openEditor(p = null) {
  ed = normProduct(p || {});
  edDirty = false;
  renderEditor();
  requestAnimationFrame(() => $('.editor', edRoot).classList.add('open'));
  document.body.style.overflow = 'hidden';
}
function closeEditor(force = false) {
  if (!force && edDirty) { confirmDlg('إغلاق المحرر', 'لديك تغييرات غير محفوظة. هل تريد الإغلاق والتخلص منها؟', 'إغلاق').then(ok => { if (ok) reallyClose(); }); return; }
  reallyClose();
}
function reallyClose() {
  $('.editor', edRoot).classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => edRoot.innerHTML = '', 450);
}

function renderEditor() {
  const isNew = !ed.id;
  edRoot.innerHTML = `
  <div class="editor">
    <header class="ed-top">
      <div class="tt"><h2>${isNew ? 'منتج جديد' : 'تعديل: ' + esc(ed.name)}</h2><span>${isNew ? 'أضف قطعة جديدة — تظهر فور الحفظ في المتجر والاستوديو' : 'SKU: ' + esc(ed.sku || '—')}</span></div>
      <button class="ed-x" id="ed-x" aria-label="إغلاق">×</button>
    </header>
    <div class="ed-body" id="ed-body">
      <div class="ed-grid">
        <div class="ed-col">

          <section class="sect">
            <h3><i>${ICO.info}</i>المعلومات الأساسية</h3>
            <div class="f-grid">
              <label class="field">اسم المنتج <b style="color:var(--gold)">*</b><input data-set="name" value="${esc(ed.name)}" placeholder="مثال: ثوب اللامع المصقول"></label>
              <label class="field">الاسم بالإنجليزية<input data-set="name_en" value="${esc(ed.name_en)}" dir="ltr" placeholder="Signature Thobe"></label>
              <label class="field full">الوصف المختصر<input data-set="short_description" value="${esc(ed.short_description)}" placeholder="سطر واحد يظهر في البطاقات"></label>
              <label class="field full">الوصف الكامل<textarea data-set="description" placeholder="قصة القطعة، الخامات، التفاصيل…">${esc(ed.description)}</textarea></label>
              <label class="field">SKU<div class="url-row" style="margin-top:8px"><input data-set="sku" value="${esc(ed.sku)}" dir="ltr" placeholder="LM-XXXXXX"><button type="button" id="gen-sku">توليد</button></div></label>
              <label class="field">الباركود<input data-set="barcode" value="${esc(ed.barcode)}" dir="ltr" placeholder="6281000000000"></label>
            </div>
          </section>

          <section class="sect">
            <h3><i>${ICO.img}</i>الصور</h3>
            <p class="sub">الصورة الرئيسية تظهر في المتجر والاستوديو. معرض الصور لصفحة المنتج. صورة Studio الشفافة تُستخدم للّبس على الشخصية إن وُجدت.</p>
            ${imgField('image_url', 'الصورة الرئيسية', 'مطلوبة')}
            <div style="margin-top:22px">
              <label class="field">معرض الصور <span class="hint">اسحب لإعادة الترتيب — الأولى بعد الرئيسية</span></label>
              <div class="gal" id="gal"></div>
              <div class="url-row">
                <input type="url" id="gal-url" placeholder="ألصق رابط صورة ثم أضف…" dir="ltr">
                <button type="button" id="gal-add-url">إضافة رابط</button>
                <button type="button" id="gal-add-file">رفع ملفات</button>
                <input type="file" id="gal-files" accept="image/*" multiple hidden>
              </div>
            </div>
            <div class="f-grid" style="margin-top:22px">
              ${imgField('image_360', 'صورة 360°', 'اختياري')}
              ${imgField('studio_asset', 'Studio Asset — بخلفية شفافة', 'PNG شفاف لغرفة التجربة')}
            </div>
          </section>

          <section class="sect">
            <h3><i>${ICO.color}</i>الألوان <span class="hint">عدد غير محدود — اسم + كود + صورة اختيارية لكل لون</span></h3>
            <div id="color-rows"></div>
            <button type="button" class="add-line" id="add-color">+ إضافة لون</button>
          </section>

          <section class="sect">
            <h3><i>${ICO.size}</i>المقاسات والكميات</h3>
            <div class="size-chips" id="size-chips"></div>
            <div class="custom-size">
              <input id="custom-size-in" placeholder="مقاس مخصص (مثال: 54 أو XXXL)">
              <button type="button" id="custom-size-add">إضافة المقاس</button>
            </div>
            <div class="size-qty" id="size-qty"></div>
            <div class="stock-auto" id="stock-auto"></div>
          </section>

        </div>
        <div class="ed-col">

          <section class="sect">
            <h3><i>${ICO.tag}</i>التصنيف والعلامات</h3>
            <label class="field">التصنيف
              <select data-set="category_id"><option value="">— اختر التصنيف —</option>
                ${cats.map(c => `<option value="${c.id}" ${ed.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            </label>
            <div class="custom-size" style="margin-top:10px">
              <input id="new-cat-in" placeholder="تصنيف جديد مستقبلاً…">
              <button type="button" id="new-cat-add">+ تصنيف</button>
            </div>
            <label class="field" style="margin-top:16px">العلامات Tags
              <div class="tags-input" id="tags-box"><input id="tag-in" placeholder="اكتب ثم Enter — مثل: عيد، صيف، فاخر"></div>
            </label>
          </section>

          <section class="sect">
            <h3><i>${ICO.price}</i>السعر</h3>
            <div class="f-grid">
              <label class="field">السعر الأساسي <b style="color:var(--gold)">*</b><input type="number" data-set="price" value="${ed.price}" min="0" step="0.01" placeholder="0.00"></label>
              <label class="field">سعر الخصم<input type="number" data-set="sale_price" value="${ed.sale_price}" min="0" step="0.01" placeholder="—"></label>
              <label class="field">بداية الخصم<input type="datetime-local" data-set="sale_start" value="${ed.sale_start}"></label>
              <label class="field">نهاية الخصم<input type="datetime-local" data-set="sale_end" value="${ed.sale_end}"></label>
              <label class="field">العملة<select data-set="currency">
                ${[['SAR', 'ريال سعودي SAR'], ['YER', 'ريال يمني YER'], ['USD', 'دولار USD'], ['AED', 'درهم AED']].map(([v, n]) => `<option value="${v}" ${ed.currency === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
              <label class="field">الضريبة %<input type="number" data-set="tax_rate" value="${ed.tax_rate}" min="0" max="100" step="0.5"></label>
            </div>
          </section>

          <section class="sect">
            <h3><i>${ICO.stock}</i>المخزون</h3>
            <div class="f-grid">
              <label class="field">الكمية<input type="number" data-set="stock" id="stock-in" value="${ed.stock}" min="0"></label>
              <label class="field">حد التنبيه<input type="number" data-set="low_stock_threshold" value="${ed.low_stock_threshold}" min="0"></label>
              <label class="field full">حالة المنتج<select data-set="status">
                ${STATUS_OPTS.map(([v, n]) => `<option value="${v}" ${ed.status === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
                <p class="hint">نفد وقريب النفاد يُحسبان تلقائياً من الكمية وحد التنبيه.</p></label>
            </div>
          </section>

          <section class="sect">
            <h3><i>${ICO.flags}</i>خيارات المنتج</h3>
            <div class="opt-grid">
              ${FLAGS.map(([k, n, d]) => `<div class="opt"><span>${n}<small>${d}</small></span><button type="button" class="switch ${ed.flags[k] ? 'on' : ''}" data-flag="${k}" role="switch" aria-checked="${ed.flags[k]}"><i></i></button></div>`).join('')}
            </div>
          </section>

          <section class="sect studio-sect">
            <h3><i>${ICO.studio}</i>AL LAMEA VIRTUAL STUDIO™</h3>
            <div class="studio-note">عند تفعيل Try-On تظهر القطعة فوراً في غرفة التجربة الافتراضية بالموقع، وتُلبس على الشخصية حسب فئة اللبس وترتيب الطبقة.</div>
            <div class="opt" style="margin-bottom:14px"><span>Virtual Try-On<small>تشغيل / إيقاف الظهور في الاستوديو</small></span>
              <button type="button" class="switch ${ed.virtual_tryon ? 'on' : ''}" data-sw="virtual_tryon" role="switch" aria-checked="${ed.virtual_tryon}"><i></i></button></div>
            <div class="f-grid">
              <label class="field">Wear Category<select data-set="wear_category">
                <option value="">— بدون —</option>
                ${WEAR_CATS.map(([v, n]) => `<option value="${v}" ${ed.wear_category === v ? 'selected' : ''}>${n} (${v.charAt(0).toUpperCase() + v.slice(1)})</option>`).join('')}</select></label>
              <label class="field">Layer Order<input type="number" data-set="layer_order" value="${ed.layer_order}" min="0" max="100" placeholder="تلقائي: ${LAYER_DEFAULT[ed.wear_category] ?? 'حسب الفئة'}">
                <p class="hint">ترتيب اللبس على الشخصية: الثوب ١٠ حتى الحذاء ١٠٠</p></label>
            </div>
          </section>

          <section class="sect">
            <h3><i>${ICO.seo}</i>SEO</h3>
            <div class="f-grid">
              <label class="field full">Meta Title<input data-set="meta_title" value="${esc(ed.meta_title)}" placeholder="${esc(ed.name) || 'اسم المنتج'} | اللامع"></label>
              <label class="field full">Meta Description<textarea data-set="meta_description" style="min-height:64px" placeholder="وصف ١٦٠ حرفاً لمحركات البحث…">${esc(ed.meta_description)}</textarea></label>
              <label class="field full">Slug<div class="url-row" style="margin-top:8px"><input data-set="slug" value="${esc(ed.slug)}" dir="ltr" placeholder="auto-generated"><button type="button" id="gen-slug">توليد</button></div></label>
              <label class="field full">Open Graph Image<input type="url" data-set="og_image" value="${esc(ed.og_image)}" dir="ltr" placeholder="https://… (افتراضياً الصورة الرئيسية)"></label>
            </div>
          </section>

        </div>
      </div>
    </div>
    <footer class="ed-save">
      <div class="st" id="save-state">${isNew ? 'حقول مطلوبة: <b>الاسم</b> و<b>السعر</b>' : 'آخر تعديل يُحفظ فور النقر'}</div>
      <div class="acts">
        <button class="ghost" id="cancel-ed">إلغاء</button>
        <button class="ghost" id="save-draft">حفظ كمسودة</button>
        <button class="btn-gold" id="save-ed" style="width:auto;min-width:170px">حفظ المنتج ✦</button>
      </div>
    </footer>
  </div>`;

  bindEditor();
}

/* ─── ربط عناصر المحرر ─── */
function bindEditor() {
  const root = $('.editor', edRoot);
  $('#ed-x', root).onclick = () => closeEditor();
  $('#cancel-ed', root).onclick = () => closeEditor();

  /* حقول نصية عامة */
  $$('[data-set]', root).forEach(el => {
    el.addEventListener('input', () => { ed[el.dataset.set] = el.value; edDirty = true; if (el.dataset.set === 'wear_category') refreshLayerHint(); });
    el.addEventListener('change', () => { ed[el.dataset.set] = el.value; edDirty = true; if (el.dataset.set === 'wear_category') refreshLayerHint(); });
  });
  function refreshLayerHint() {
    const inp = $('[data-set="layer_order"]', root);
    if (inp) inp.placeholder = `تلقائي: ${LAYER_DEFAULT[ed.wear_category] ?? 'حسب الفئة'}`;
  }

  /* مفاتيح التبديل */
  $$('[data-flag]', root).forEach(sw => sw.onclick = () => {
    const k = sw.dataset.flag; ed.flags[k] = !ed.flags[k];
    sw.classList.toggle('on', ed.flags[k]); sw.setAttribute('aria-checked', ed.flags[k]); edDirty = true;
  });
  $$('[data-sw]', root).forEach(sw => sw.onclick = () => {
    const k = sw.dataset.sw; ed[k] = !ed[k];
    sw.classList.toggle('on', ed[k]); edDirty = true;
  });

  /* توليد */
  $('#gen-sku', root).onclick = () => { ed.sku = genSKU(); $('[data-set="sku"]', root).value = ed.sku; edDirty = true; };
  $('#gen-slug', root).onclick = () => { ed.slug = genSlug(ed); $('[data-set="slug"]', root).value = ed.slug; edDirty = true; };

  /* الصور */
  $$('.dropzone[data-upload]', root).forEach(dz => setupDropzone(dz, url => { ed[dz.dataset.upload] = url; edDirty = true; refreshEditorSection(); }));
  $$('.img-preview', root); /* المعاينات تتحدث مع إعادة العرض */
  ['image_url', 'image_360', 'studio_asset'].forEach(k => {
    const inp = $(`[data-set="${k}"]`, root);
    inp.addEventListener('change', () => {
      const prev = $(`[data-prev="${k}"]`, root);
      prev.innerHTML = inp.value ? `<img src="${esc(inp.value)}">` : `<span class="ph">معاينة</span>`;
    });
  });

  /* المعرض */
  paintGal();
  $('#gal-add-url', root).onclick = () => {
    const v = $('#gal-url', root).value.trim();
    if (!v) return;
    ed.gallery.push(v); $('#gal-url', root).value = ''; edDirty = true; paintGal();
  };
  $('#gal-add-file', root).onclick = () => $('#gal-files', root).click();
  $('#gal-files', root).onchange = async e => {
    for (const f of e.target.files) ed.gallery.push(await uploadImage(f));
    e.target.value = ''; edDirty = true; paintGal();
  };

  /* الألوان */
  paintColors();
  $('#add-color', root).onclick = () => { ed.colors.push({ name: '', hex: '#B89146', image: '' }); edDirty = true; paintColors(); };

  /* المقاسات */
  paintSizes();
  $('#custom-size-add', root).onclick = () => {
    const v = $('#custom-size-in', root).value.trim();
    if (!v || ed.sizes.includes(v)) return;
    ed.sizes.push(v); ed.size_stock[v] = ed.size_stock[v] ?? 1;
    $('#custom-size-in', root).value = ''; edDirty = true; paintSizes();
  };

  /* العلامات */
  paintTags();
  const tagIn = $('#tag-in', root);
  tagIn.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ',') && tagIn.value.trim()) {
      e.preventDefault();
      const v = tagIn.value.trim().replace(/,$/, '');
      if (!ed.tags.includes(v)) ed.tags.push(v);
      tagIn.value = ''; edDirty = true; paintTags();
    }
  });
  $('#tags-box', root).onclick = () => tagIn.focus();

  /* تصنيف جديد */
  $('#new-cat-add', root).onclick = async () => {
    const v = $('#new-cat-in', root).value.trim(); if (!v) return;
    const slugC = v.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/gi, '-') + '-' + rand(3).toLowerCase();
    const { data, error } = await db.from('categories').insert({ name: v, slug: slugC }).select().maybeSingle();
    if (error) return toast('إضافة التصنيفات تتطلب صلاحية مدير', true);
    cats.push(data);
    ed.category_id = data.id;
    edDirty = true; refreshEditorSection();
    toast(`أُضيف تصنيف «${v}» — سيظهر في كل القوائم`);
  };

  /* الحفظ */
  $('#save-ed', root).onclick = () => saveProduct('keep');
  $('#save-draft', root).onclick = () => saveProduct('draft');
}

/* تحديث أجزاء دون فقدان التركيز — للصور والتصنيف */
function refreshEditorSection() {
  ['image_url', 'image_360', 'studio_asset'].forEach(k => {
    const prev = $(`[data-prev="${k}"]`, edRoot);
    if (prev) prev.innerHTML = ed[k] ? `<img src="${esc(ed[k])}">` : '<span class="ph">معاينة</span>';
    const inp = $(`[data-set="${k}"]`, edRoot); if (inp) inp.value = ed[k] || '';
  });
  const sel = $('[data-set="category_id"]', edRoot);
  if (sel) sel.innerHTML = '<option value="">— اختر التصنيف —</option>' + cats.map(c => `<option value="${c.id}" ${ed.category_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
}

/* ─── المعرض: عرض + سحب للترتيب ─── */
function paintGal() {
  const box = $('#gal', edRoot); if (!box) return;
  box.innerHTML = ed.gallery.map((u, i) => `
    <div class="gal-item" draggable="true" data-gi="${i}">
      <img src="${esc(u)}" alt=""><b class="gx" data-grm="${i}">×</b><span class="gi num">${i + 1}</span>
    </div>`).join('') + `<div class="gal-add" id="gal-add-tile" title="إضافة صور">+</div>`;

  $('#gal-add-tile', box).onclick = () => $('#gal-files', edRoot).click();
  $$('[data-grm]', box).forEach(b => b.onclick = e => {
    e.stopPropagation();
    ed.gallery.splice(+b.dataset.grm, 1); edDirty = true; paintGal();
  });
  let dragI = null;
  $$('.gal-item', box).forEach(it => {
    it.ondragstart = () => { dragI = +it.dataset.gi; it.classList.add('dragging'); };
    it.ondragend = () => it.classList.remove('dragging');
    it.ondragover = e => e.preventDefault();
    it.ondrop = e => {
      e.preventDefault();
      const to = +it.dataset.gi;
      if (dragI === null || dragI === to) return;
      const [m] = ed.gallery.splice(dragI, 1);
      ed.gallery.splice(to, 0, m);
      edDirty = true; paintGal();
    };
  });
}

/* ─── الألوان ─── */
function paintColors() {
  const box = $('#color-rows', edRoot); if (!box) return;
  box.innerHTML = ed.colors.map((c, i) => `
    <div class="color-row">
      <input type="color" value="${esc(c.hex || '#B89146')}" data-ci="${i}" data-ck="hex" title="كود اللون">
      <input placeholder="اسم اللون — مثال: عاجي ملكي" value="${esc(c.name)}" data-ci="${i}" data-ck="name">
      <input dir="ltr" placeholder="رابط صورة اللون (اختياري)" value="${esc(c.image)}" data-ci="${i}" data-ck="image">
      <div class="cimg" data-cup="${i}" title="رفع صورة للون">${c.image ? `<img src="${esc(c.image)}">` : '＋'}</div>
      <button type="button" class="rm" data-crm="${i}" aria-label="حذف اللون">×</button>
    </div>`).join('') || '<p class="hint" style="margin-bottom:10px">لا ألوان — أضف أول لون لهذا المنتج.</p>';

  $$('input[data-ci]', box).forEach(inp => inp.addEventListener('input', () => {
    ed.colors[+inp.dataset.ci][inp.dataset.ck] = inp.value; edDirty = true;
    if (inp.dataset.ck === 'image' && inp.value) paintColors();
  }));
  $$('[data-cup]', box).forEach(t => t.onclick = async () => {
    const f = await pickFile();
    if (f) { ed.colors[+t.dataset.cup].image = await uploadImage(f); edDirty = true; paintColors(); }
  });
  $$('[data-crm]', box).forEach(b => b.onclick = () => { ed.colors.splice(+b.dataset.crm, 1); edDirty = true; paintColors(); });
}

/* ─── المقاسات ─── */
function paintSizes() {
  const chips = $('#size-chips', edRoot); if (!chips) return;
  const all = [...new Set([...STD_SIZES, ...ed.sizes])];
  chips.innerHTML = all.map(s => {
    const on = ed.sizes.includes(s);
    const q = on && ed.size_stock[s] > 0 ? `<span class="qs num">${ed.size_stock[s]}</span>` : on ? '<span class="qs">بدون كمية</span>' : '';
    return `<button type="button" class="s-chip ${on ? 'on' : ''}" data-size="${esc(s)}">${esc(s)}${q}</button>`;
  }).join('');
  $$('[data-size]', chips).forEach(c => c.onclick = () => {
    const s = c.dataset.size;
    if (ed.sizes.includes(s)) { ed.sizes = ed.sizes.filter(x => x !== s); delete ed.size_stock[s]; }
    else { ed.sizes.push(s); ed.size_stock[s] = ed.size_stock[s] ?? 0; }
    edDirty = true; paintSizes();
  });
  const qBox = $('#size-qty', edRoot);
  qBox.innerHTML = ed.sizes.map(s => `
    <div class="sq"><b class="num">${esc(s)}</b><input type="number" min="0" value="${ed.size_stock[s] ?? 0}" data-sq="${esc(s)}"></div>`).join('');
  $$('[data-sq]', qBox).forEach(inp => inp.addEventListener('input', () => {
    ed.size_stock[inp.dataset.sq] = Math.max(0, +inp.value || 0);
    edDirty = true; paintStockAuto();
  }));
  paintStockAuto();
}
function paintStockAuto() {
  const el = $('#stock-auto', edRoot); if (!el) return;
  const sum = Object.values(ed.size_stock).reduce((a, b) => a + (+b || 0), 0);
  const hasQty = sum > 0;
  const stockIn = $('#stock-in', edRoot);
  if (hasQty) { ed.stock = sum; if (stockIn) { stockIn.value = sum; stockIn.disabled = true; } }
  else if (stockIn) { stockIn.disabled = false; }
  el.innerHTML = hasQty
    ? `إجمالي المخزون يُحسب تلقائياً من المقاسات: <b class="num">${sum}</b> قطعة`
    : 'لا كميات مسجلة للمقاسات — حقل الكمية اليدوي في قسم المخزون هو المعتمد.';
}

/* ─── العلامات ─── */
function paintTags() {
  const box = $('#tags-box', edRoot); if (!box) return;
  $$('.tag-chip', box).forEach(c => c.remove());
  const inp = $('#tag-in', box);
  ed.tags.forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${esc(t)}<b data-trm="${i}">×</b>`;
    box.insertBefore(chip, inp);
  });
  $$('[data-trm]', box).forEach(b => b.onclick = e => {
    e.stopPropagation();
    ed.tags.splice(+b.dataset.trm, 1); edDirty = true; paintTags();
  });
}

/* ─── الرفع: Supabase Storage مع احتياط Data-URL ─── */
function pickFile() {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => res(inp.files[0] || null);
    inp.click();
  });
}
const fileToDataUrl = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
async function uploadImage(file) {
  try {
    const path = `p/${Date.now().toString(36)}-${file.name.replace(/[^\w.]+/g, '-')}`;
    const { error } = await db.storage.from('products').upload(path, file, { cacheControl: '31536000', upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = db.storage.from('products').getPublicUrl(path);
    toast('رُفعت الصورة إلى المخزن');
    return publicUrl;
  } catch (e) {
    toast('المخزن السحابي غير مفعّل — أُدرجت الصورة مؤقتاً كبيانات مضمنة. أنشئ bucket عام باسم products من schema.sql');
    return fileToDataUrl(file);
  }
}
function setupDropzone(dz, onUrl) {
  const inp = dz.querySelector('input[type=file]');
  dz.onclick = () => inp.click();
  inp.onchange = async () => { if (inp.files[0]) onUrl(await uploadImage(inp.files[0])); };
  dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
  dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = async e => {
    e.preventDefault(); dz.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) onUrl(await uploadImage(f));
  };
}

/* ─── الحفظ النهائي ─── */
async function saveProduct(mode) {
  const name = (ed.name || '').trim();
  if (!name) return toast('اسم المنتج مطلوب', true), $('[data-set="name"]', edRoot).focus();
  const price = +ed.price;
  if (!(price > 0)) return toast('السعر الأساسي مطلوب ويجب أن يكون أكبر من صفر', true), $('[data-set="price"]', edRoot).focus();
  if (ed.virtual_tryon && !ed.wear_category) toast('تنبيه: Try-On مفعّل بدون Wear Category — لن تظهر القطعة حتى تحددها');

  if (mode === 'draft') ed.status = 'draft';
  const sumQty = Object.values(ed.size_stock).reduce((a, b) => a + (+b || 0), 0);
  const stock = sumQty > 0 ? sumQty : Math.max(0, +ed.stock || 0);

  const payload = {
    name, name_en: ed.name_en.trim(), short_description: ed.short_description.trim(), description: ed.description,
    sku: (ed.sku || genSKU()), barcode: ed.barcode.trim() || null,
    category_id: ed.category_id || null, tags: ed.tags,
    image_url: ed.image_url || null, gallery: ed.gallery, image_360: ed.image_360 || null, studio_asset: ed.studio_asset || null,
    colors: ed.colors.filter(c => c.name.trim()),
    sizes: ed.sizes, size_stock: ed.size_stock,
    price, sale_price: ed.sale_price ? +ed.sale_price : null,
    sale_start: ed.sale_start ? new Date(ed.sale_start).toISOString() : null,
    sale_end: ed.sale_end ? new Date(ed.sale_end).toISOString() : null,
    currency: ed.currency || 'SAR', tax_rate: +ed.tax_rate || 0,
    stock, low_stock_threshold: Math.max(0, +ed.low_stock_threshold || 0),
    status: ed.status, is_active: ed.status === 'active',
    ...ed.flags,
    virtual_tryon: ed.virtual_tryon, wear_category: ed.wear_category || null,
    layer_order: ed.layer_order === '' || ed.layer_order == null ? (LAYER_DEFAULT[ed.wear_category] ?? 0) : +ed.layer_order,
    slug: (ed.slug || genSlug(ed)), meta_title: ed.meta_title.trim() || null,
    meta_description: ed.meta_description.trim() || null, og_image: ed.og_image.trim() || null,
    updated_at: new Date().toISOString()
  };

  const btn = $('#save-ed', edRoot);
  btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
  const { error } = ed.id
    ? await db.from('products').update(payload).eq('id', ed.id)
    : await db.from('products').insert(payload);
  btn.disabled = false; btn.textContent = 'حفظ المنتج ✦';
  if (error) return toast('خطأ في الحفظ: ' + error.message, true);

  edDirty = false;
  reallyClose();
  audit(ed.id ? 'product.update' : 'product.save', 'products', ed.id || payload.slug, { name, price, stock });
  toast(`✦ حُفظ «${name}» — يظهر الآن في المتجر${ed.virtual_tryon ? ' وفي الاستوديو الافتراضي' : ''}`);
  products();
}


/* ══════════ استيراد/تصدير المنتجات ══════════ */
function exportProductsCSV() {
  if (!items.length) return toast('لا منتجات للتصدير');
  const head = ['name', 'name_en', 'sku', 'barcode', 'price', 'sale_price', 'stock', 'category', 'wear_category', 'sizes', 'status'];
  const rows = items.map(x => [x.name, x.name_en || '', x.sku || '', x.barcode || '', x.price, x.sale_price ?? '', x.stock, x.categories?.name || '', x.wear_category || '', (x.sizes || []).join('|'), x.status || 'active']);
  const csv = '\ufeff' + [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'allamea-products.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('⬇ صُدّرت قائمة المنتجات');
}
function parseCSV(text) {
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (cur || row.length) { row.push(cur); out.push(row); row = []; cur = ''; } }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.length > 1 || r[0]);
}
async function importProductsCSV(file) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text.replace(/^\ufeff/, ''));
  if (rows.length < 2) return toast('الملف فارغ أو غير صالح — استخدم تنسيق التصدير نفسه', true);
  const head = rows[0].map(h => h.trim().toLowerCase());
  const idx = k => head.indexOf(k);
  if (idx('name') < 0 || idx('price') < 0) return toast('الأعمدة المطلوبة: name و price على الأقل', true);
  const payload = rows.slice(1).map(r => ({
    name: r[idx('name')] || 'منتج', name_en: r[idx('name_en')] || '',
    sku: r[idx('sku')] || genSKU(), barcode: r[idx('barcode')] || null,
    price: +r[idx('price')] || 0, sale_price: +r[idx('sale_price')] || null,
    stock: Math.max(0, +r[idx('stock')] || 0),
    category_id: cats.find(c => c.name === (r[idx('category')] || ''))?.id || null,
    wear_category: r[idx('wear_category')] || null,
    sizes: idx('sizes') >= 0 ? (r[idx('sizes')] || '').split('|').filter(Boolean) : [],
    status: r[idx('status')] || 'active', is_active: (r[idx('status')] || 'active') === 'active',
    slug: genSlug({ name_en: r[idx('name_en')], name: r[idx('name')] }),
    virtual_tryon: !!r[idx('wear_category')], updated_at: new Date().toISOString()
  })).filter(p => p.name && p.price > 0);
  if (!payload.length) return toast('لا صفوف صالحة في الملف', true);
  const { error } = await db.from('products').insert(payload);
  if (error) return toast(error.message, true);
  toast(`✦ استُورد ${payload.length} منتجاً دفعة واحدة`);
  products();
}

/* ══════════ الوضع الفاتح / الداكن ══════════ */
document.body.dataset.theme = localStorage.getItem('bi-theme') || 'dark';
$('#theme-toggle').onclick = () => {
  const t = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  document.body.dataset.theme = t;
  localStorage.setItem('bi-theme', t);
};

/* ══════════ جرس الإشعارات الذكية ══════════ */
const notifPanel = $('#notif-panel');
const dismissed = new Set(JSON.parse(localStorage.getItem('bi-notif-dismissed') || '[]'));
async function renderNotifs() {
  const list = window.__biNotifs || [];
  const fresh = list.filter(n => !dismissed.has(n.id));
  const badge = $('#bell-count');
  badge.hidden = !fresh.length;
  badge.textContent = fresh.length;
  notifPanel.innerHTML = `<header>الإشعارات الذكية${list.length ? ' <button id="notif-clear">تجاهل الكل</button>' : ''}</header>` +
    (fresh.length ? fresh.map(n => `<div class="notif-item ${n.level}">${n.icon} ${esc(n.text)}</div>`).join('')
      : `<p class="notif-empty">${list.length ? 'تمت قراءة كل التنبيهات ✦' : 'لا تنبيهات الآن — تُحسب تلقائياً من بياناتك'}</p>`);
  $('#notif-clear', notifPanel)?.addEventListener('click', () => {
    list.forEach(n => dismissed.add(n.id));
    localStorage.setItem('bi-notif-dismissed', JSON.stringify([...dismissed]));
    renderNotifs();
  });
}
$('#bell').onclick = async e => {
  e.stopPropagation();
  notifPanel.hidden = !notifPanel.hidden;
  if (!notifPanel.hidden) renderNotifs();
};
document.addEventListener('click', e => {
  if (!e.target.closest('#notif-panel') && !e.target.closest('#bell')) notifPanel.hidden = true;
});
addEventListener('bi:notifs', renderNotifs);

/* ══════════ إقلاع ══════════ */
addEventListener('keydown', e => { if (e.key === 'Escape' && $('.editor.open', edRoot)) closeEditor(); });
document.addEventListener('click', e => { if (!e.target.closest('.card-menu') && !e.target.closest('[data-menu]')) $$('.pcard.menu-open').forEach(c => c.classList.remove('menu-open')); });
start();
