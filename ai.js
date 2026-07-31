/* ══════════════════════════════════════════════════════════
   AL LAMEA AI™ — خبير اللامع · محرك ذكاء العملاء
   محرك قواعدي خبير يعمل فوق بيانات المتجر الحيّة فقط:
   لا يخترع منتجاً ولا سعراً ولا مقاساً ولا خصماً ولا مخزوناً.
   ══════════════════════════════════════════════════════════ */
'use strict';
(() => {

/* ─────────── سياسات الدار (يملؤها التاجر — تطابق صفحة الدفع) ─────────── */
const POLICY = {
  shipFee: 35, freeShipFrom: 350, exchangeDays: 7,
  delivery: '3 – 7 أيام عمل داخل المملكة',
  pay: 'بطاقات إلكترونية / مدى · والدفع عند الاستلام',
  confirm: 'يتواصل معك مستشار الدار خلال 24 ساعة لتأكيد التفاصيل',
  pack: 'تغليف الدار الفاخر مجاناً مع كل طلب'
};

const SB_URL = 'https://lebuvkypywblwrjhabpn.supabase.co';
const SB_KEY = 'sb_publishable_CwGqVxwacoCk_JE6s-ziig_noJ0qf0u';
let _db = null;
const DB = () => {
  if (_db) return _db;
  try {
    if (!window.supabase?.createClient || !/^https?:/.test(location.protocol)) return null;
    _db = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
    return _db;
  } catch (e) { return null; }
};

/* ── إعدادات الدار الحية: الشحن والولاء يُداران من لوحة الإدارة ── */
let LYC = null; /* إعدادات الولاء (فعلية أو لم تُفعّل بعد) */
(async () => {
  const db = DB(); if (!db) return;
  try {
    const { data, error } = await db.from('store_settings').select('key,value').in('key', ['shipping', 'loyalty']);
    if (error || !data) return;
    const sh = data.find(r => r.key === 'shipping')?.value;
    if (sh) {
      if (+sh.fee >= 0) POLICY.shipFee = +sh.fee;
      if (+sh.free_from > 0) POLICY.freeShipFrom = +sh.free_from;
      if (sh.delivery_note) POLICY.delivery = sh.delivery_note;
    }
    const ly = data.find(r => r.key === 'loyalty')?.value;
    if (ly) LYC = {
      enabled: ly.enabled !== false,
      rate: +ly.pts_per_sar || 1,
      welcome: +ly.welcome_pts || 0,
      tiers: (Array.isArray(ly.tiers) && ly.tiers.length) ? ly.tiers : [{ name: 'فضي', min: 0 }]
    };
  } catch (e) { }
})();
const loyaltyConf = async () => {
  if (LYC) return LYC;
  const db = DB(); if (!db) return (LYC = { enabled: false });
  try {
    const { data, error } = await db.from('store_settings').select('value').eq('key', 'loyalty').maybeSingle();
    if (error || !data?.value) return (LYC = { enabled: false });
    const v = data.value;
    return (LYC = { enabled: v.enabled !== false, rate: +v.pts_per_sar || 1, welcome: +v.welcome_pts || 0, tiers: (Array.isArray(v.tiers) && v.tiers.length) ? v.tiers : [{ name: 'فضي', min: 0 }] });
  } catch (e) { return (LYC = { enabled: false }); }
};

/* ─────────── أدوات ─────────── */
const $ = (s, c = document) => c.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (+n || 0).toLocaleString('en-US');
const IS_STUDIO = /studio/.test(location.pathname + location.href.split('/').pop());
const track = (type, meta, value, product) => { try { window.AlaTrack?.track(type, meta, value, product); } catch (e) { } };
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };

/* ─────────── اللغة ─────────── */
let lang = localStorage.getItem('ai-lang') || 'ar';
const EN = () => lang === 'en';
const tr = (ar, en) => EN() ? en : ar;

/* ─────────── تطبيع النصوص العربية ─────────── */
const norm = s => String(s || '').toLowerCase()
  .replace(/[ً-ْٰـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
  .replace(/[^ء-غف-ي٠-٩a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(w => w.length > 1);
const levenshtein = (a, b, maxD = 1) => {
  if (Math.abs(a.length - b.length) > maxD) return maxD + 1;
  const m = a.length, n = b.length;
  let prev = [...Array(n + 1).keys()];
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > maxD) return maxD + 1;
    prev = cur;
  }
  return prev[n];
};
function hexHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
const hueDist = (a, b) => { const x = Math.abs(a - b); return Math.min(x, 360 - x); };

/* ─────────── محوّل الكتالوج — من بيانات المتجر فقط ─────────── */
const WL = (window.ALLAMEA_WEAR || {}).labels || {};
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
const rawCatalog = () =>
  (window.Alamea?.products?.length ? window.Alamea.products :
    window.AlameaStudio?.state.products?.length ? window.AlameaStudio.state.products :
      (window.ALLAMEA_CATALOG || []));
function adapt(p) {
  const wearCat = p.wearCat || p.wear_category || (WL[p.cat] ? p.cat : null) || p.cat || null;
  return {
    id: String(p.id), name: p.name || '', nameEn: p.name_en || '', cat: WL[wearCat] || p.cat || 'مختارات الدار',
    wearCat, price: +p.price || 0, old: p.old ? +p.old : null,
    img: p.img || p.image_url || '', detail: p.detail || p.img || p.image_url || '',
    desc: p.desc || p.description || '', sizes: (p.sizes || []).length ? p.sizes : ['مقاس واحد'],
    colors: Array.isArray(p.colors) ? p.colors : [], materials: p.materials || [],
    stock: p.stock ?? 1, tags: p.tags || [], badge: p.badge || null, tryon: p.tryon ?? p.virtual_tryon ?? !!p.studio,
    sku: p.sku || '', studioRef: p
  };
}
const catalog = () => rawCatalog().map(adapt);

/* ─────────── القاموس الدلالي — فهم اللغة الطبيعية ─────────── */
const LEX = {
  wear: {
    maawaz: ['معوز', 'معاوز', 'معوزه', 'معاوزه'],
    shamzan: ['مشلح', 'مشالح', 'شمزان', 'بشت', 'البشت', 'عبايه', 'عباءه'],
    thobe: ['ثوب', 'ثياب', 'دشداشه', 'كندوره', 'قميص'],
    vest: ['صديري', 'سديري', 'صدريه'],
    jambiya: ['جنبيه', 'جنابي', 'خنجر', 'جنبي'],
    turban: ['عمامه', 'عمائم', 'مشدح', 'عمام'],
    shemagh: ['شماغ', 'غتره', 'شال', 'مشمغ'],
    belt: ['حزام', 'احزمه', 'منطقه'],
    shoes: ['حذاء', 'احذيه', 'جزمه', 'نعال', 'صندل', 'زبيريه'],
    watch: ['ساعه', 'ساعات'],
    perfume: ['عطر', 'عطور', 'بخور', 'عود', 'معطر'],
    accessories: ['اكسسوار', 'اكسسوارات', 'مسبحه', 'مسباح', 'دبله', 'كبك', 'قلم']
  },
  occ: {
    wedding: ['زواج', 'عرس', 'اعراس', 'زفاف', 'زواجه', 'معرس', 'ليله العمر'],
    eid: ['عيد', 'فطر', 'اضحي', 'عيديه', 'عيدية'],
    formal: ['رسمي', 'رسميه', 'دوام', 'شغل', 'عمل', 'مكتب', 'اجتماع', 'مقابله'],
    casual: ['يومي', 'كاجوال', 'عادي', 'بيت', 'طلعه', 'مشوار'],
    friday: ['جمعه', 'صلاه', 'الصلاه', 'مسجد'],
    grad: ['تخرج', 'تكريم', 'حفل', 'حفله', 'حفلات', 'سهرة', 'مناسبه'],
    khotba: ['خطوبه', 'ملكه', 'ملكة'],
    council: ['مجلس', 'مقلط', 'ديوانيه', 'مقاضي']
  },
  style: {
    luxury: ['فاخر', 'فخم', 'ملكي', 'راقي', 'نخبوي', 'ارقى', 'افخم', 'غالي'],
    heritage: ['تراثي', 'تقليدي', 'اصيل', 'شعبي', 'يمني', 'زي', 'ميراث', 'ارث'],
    modern: ['عصري', 'حديث', 'مودرن', 'موضه', 'ستايل'],
    classic: ['كلاسيكي', 'هادئ', 'رزين', 'كلاسيك'],
    light: ['خفيف', 'صيفي', 'مريح', 'بارد'],
    winter: ['شتوي', 'دافئ', 'ثقيل']
  },
  gift: ['هديه', 'اهداء', 'اهدي', 'مفاجاه', 'مفاجأه', 'لوالدي', 'لابي', 'لصديق', 'لزوجي', 'لاخي', 'لعروس', 'تخرج'],
  genderM: ['رجالي', 'رجال', 'لرجل', 'شبابي', 'رجاليه', 'شاب'],
  genderW: ['نسائي', 'نساء', 'حريم', 'لحرمه', 'بنت', 'سيده', 'نسائيه'],
  colors: {
    'ابيض': ['#f8f7f4'], 'عاجي': ['#efe9da', '#ded6bf'], 'كريمي': ['#e8ddc0'],
    'اسود': ['#141311'], 'زيتي': ['#232b24'], 'اخضر': ['#14382e'],
    'ذهبي': ['#b89146'], 'برونزي': ['#7a5426'], 'عسلي': ['#cbb27e'],
    'رملي': ['#a89a80'], 'بيج': ['#d8c9a8'], 'فحمي': ['#2b2a27'],
    'عنبري': ['#7a5426'], 'كحلي': ['#1e2a44'], 'بني': ['#5c4630'], 'رمادي': ['#8a8a8a']
  }
};
const OCC_WEAR = {
  wedding: ['maawaz', 'shamzan', 'turban', 'jambiya', 'thobe', 'belt', 'watch', 'perfume'],
  eid: ['maawaz', 'thobe', 'shamzan', 'belt', 'jambiya', 'perfume', 'watch'],
  formal: ['thobe', 'shamzan', 'watch', 'belt', 'perfume'],
  casual: ['thobe', 'vest', 'shemagh', 'shoes', 'perfume'],
  friday: ['thobe', 'shemagh', 'perfume', 'shoes'],
  grad: ['maawaz', 'shamzan', 'thobe', 'belt', 'watch', 'perfume'],
  khotba: ['maawaz', 'shamzan', 'turban', 'jambiya', 'belt', 'watch'],
  council: ['shamzan', 'vest', 'thobe', 'jambiya', 'watch', 'perfume'],
  any: ['thobe', 'maawaz', 'shamzan', 'vest', 'belt', 'jambiya', 'shemagh', 'turban', 'watch', 'perfume', 'shoes', 'accessories']
};
const OCC_LABEL = { wedding: 'زواج', eid: 'عيد', formal: 'رسمية', casual: 'يومية', friday: 'جمعة', grad: 'حفل', khotba: 'خطوبة', council: 'مجلس', any: 'عامة' };
const STYLE_WORDS = {
  luxury: ['فاخر', 'ملكي', 'ذهب', 'نخب', 'حرير', 'مطلي', 'محدود'],
  heritage: ['تراث', 'يمني', 'صنعاء', 'يدوي', 'اصال', 'ميراث', 'زخارف', 'منسوج'],
  modern: ['معاصر', 'عصر', 'منحوت', 'بسيط'],
  classic: ['كلاسيك', 'رسمي', 'هادئ', 'وقار'],
  light: ['خفيف', 'قطن', 'مريح', 'بارد'],
  winter: ['صوف', 'شتو', 'دافئ', 'ثقيل']
};
const styleHit = (p, style) => STYLE_WORDS[style]?.some(w => norm(p.name + ' ' + p.desc + ' ' + p.materials.join(' ')).includes(w));

/* ─────────── تحليل الاستعلام ─────────── */
function parseQuery(q) {
  const n = norm(q);
  const p = { wear: new Set(), occ: null, style: null, gift: false, gender: null, colors: [], budget: null };
  for (const [cat, words] of Object.entries(LEX.wear)) if (words.some(w => n.includes(w))) p.wear.add(cat);
  for (const [occ, words] of Object.entries(LEX.occ)) if (words.some(w => n.includes(w))) { p.occ = occ; break; }
  for (const [st, words] of Object.entries(LEX.style)) if (words.some(w => n.includes(w))) { p.style = st; break; }
  p.gift = LEX.gift.some(w => n.includes(w));
  if (LEX.genderM.some(w => n.includes(w))) p.gender = 'm';
  if (LEX.genderW.some(w => n.includes(w))) p.gender = 'w';
  for (const [cname, hexes] of Object.entries(LEX.colors)) if (n.includes(cname)) p.colors.push({ name: cname, hex: hexes[0] });
  const nums = (q.match(/\d{2,5}/g) || []).map(Number);
  if (nums.length) {
    const range = /من\s*\d{2,5}\s*(الي|الى|لـ|-|حتي)\s*\d{2,5}/.exec(norm(q));
    const maxW = /(اقل من|تحت|بحد|ضمن ميزانيه|ميزانيه|بميزانيه|اقصى|بحدود|ما يتجاوز|مو اكثر)/.test(n);
    if (range && nums.length >= 2) p.budget = { min: Math.min(...nums), max: Math.max(...nums) };
    else if (maxW || nums.length) p.budget = { max: Math.max(...nums) + (maxW ? 0 : 0) };
  }
  if (/(رخيص|اقتصادي|موفر)/.test(n)) p.budget = p.budget || { cheap: true };
  if (/(افخم|اغلى|اعلي سعرا)/.test(n)) p.budget = p.budget || { fancy: true };
  return p;
}

/* ─────────── البحث الذكي ─────────── */
function search(q) {
  const parsed = parseQuery(q);
  const words = toks(q);
  const STOP = new Set(['اريد', 'ابي', 'ابغي', 'عندك', 'عندكم', 'هل', 'من', 'في', 'عن', 'الي', 'الى', 'مع', 'شي', 'شيء', 'لي', 'لو', 'يا', 'في', 'افضل', 'قطعه', 'قطعة', 'منتج', 'بدي', 'ودي']);
  const kws = words.filter(w => !STOP.has(w));
  let list = catalog().map(p => {
    const hay = norm([p.name, p.nameEn, p.cat, p.desc, p.sku, p.tags.join(' '), p.materials.join(' '), p.colors.map(c => c.name).join(' ')].join(' '));
    let s = 0;
    const pToks = toks(hay);
    for (const w of kws) {
      if (hay.includes(w)) s += (toks(p.name).includes(w) ? 6 : 3);
      else if (w.length >= 4 && pToks.some(t => t.length >= 4 && levenshtein(w, t, 1) <= 1)) s += 2;
    }
    if (p.wearCat && parsed.wear.size && [...parsed.wear].includes(p.wearCat)) s += 10;
    if (parsed.wear.size && !parsed.wear.has(p.wearCat)) s -= 4;
    if (parsed.occ) { const pref = OCC_WEAR[parsed.occ] || []; const i = pref.indexOf(p.wearCat); if (i >= 0) s += Math.max(0, 6 - i); }
    if (parsed.style && styleHit(p, parsed.style)) s += 5;
    if (parsed.gift && ['accessories', 'perfume', 'jambiya', 'watch', 'belt'].includes(p.wearCat)) s += 4;
    if (parsed.colors.length) {
      const prefH = parsed.colors.map(c => hexHsl(c.hex)).filter(Boolean).map(x => x.h);
      const hues = p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h);
      if (hues.length && prefH.length && Math.min(...hues.flatMap(h => prefH.map(f => hueDist(h, f)))) < 32) s += 5;
    }
    if (p.stock > 0) s += 2; else s -= 30;
    if (p.badge === 'limited') s += 1; if (p.badge === 'sale') s += 1.5; if (p.badge === 'new') s += .5;
    return { p, s };
  });
  if (parsed.budget?.max) list = list.filter(x => x.p.price <= parsed.budget.max);
  if (parsed.budget?.min) list = list.filter(x => x.p.price >= parsed.budget.min - 1);
  list = list.filter(x => x.s > 0);
  if (parsed.budget?.cheap) list.sort((a, b) => a.p.price - b.p.price);
  else if (parsed.budget?.fancy) list.sort((a, b) => b.p.price - a.p.price);
  else list.sort((a, b) => b.s - a.s || b.p.price - a.p.price);
  return { hits: list.map(x => x.p), all: list, parsed };
}
let lastQuery = null;

/* ─────────── المقاس الذكي ─────────── */
const LETTER = ['S', 'M', 'L', 'XL', 'XXL'];
function recSize(h, w, body) {
  const bmi = w / ((h / 100) ** 2);
  let i = h < 160 ? 0 : h < 170 ? 1 : h < 179 ? 2 : h < 187 ? 3 : 4;
  if (body === 'heavy' || bmi >= 28) i = Math.min(4, i + 1);
  if (body === 'slim' && bmi < 19.5 && i > 0) i -= 1;
  return { letter: LETTER[i], bmi };
}
function sizeForProduct(p, letter) {
  if (p.sizes.length <= 1) return { size: p.sizes[0], fixed: true };
  if (p.sizes.every(s => /^\d+$/.test(s))) {
    const map = { S: 52, M: 54, L: 56, XL: 58, XXL: 60 };
    const t = map[letter] || 56;
    const best = p.sizes.map(Number).reduce((a, b) => Math.abs(b - t) < Math.abs(a - t) ? b : a, p.sizes.map(Number)[0]);
    return { size: String(best), numeric: true };
  }
  if (p.sizes.includes(letter)) return { size: letter };
  const idx = Math.min(p.sizes.length - 1, LETTER.indexOf(letter));
  return { size: p.sizes[idx], nearest: true };
}

/* ─────────── خبير الإطلالات ─────────── */
function buildOutfit(pref) {
  const pool = catalog().filter(p => p.stock > 0);
  if (!pool.length) return null;
  const order = OCC_WEAR[pref.occ || 'any'] || OCC_WEAR.any;
  const prefH = (pref.colors || []).map(c => hexHsl(c.hex)).filter(Boolean).map(x => x.h);
  const scoreOf = p => {
    let s = 0;
    const oi = order.indexOf(p.wearCat); if (oi >= 0) s += Math.max(0, 10 - oi);
    if (pref.style && styleHit(p, pref.style)) s += 4;
    const hues = p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h);
    if (prefH.length && hues.length && Math.min(...hues.flatMap(h => prefH.map(f => hueDist(h, f)))) < 34) s += 4;
    if (p.badge === 'limited') s += 2; if (p.badge === 'sale') s += 1.5; if (p.badge === 'new') s += 1;
    return s;
  };
  const byCat = {};
  pool.forEach(p => { if (!p.wearCat) return; (byCat[p.wearCat] = byCat[p.wearCat] || []).push(p); });
  Object.values(byCat).forEach(arr => arr.sort((a, b) => scoreOf(b) - scoreOf(a) || b.price - a.price));
  const pieces = [];
  let spend = 0;
  const budget = pref.budgetMax || null;
  const pickLimit = budget ? 5 : 4;
  for (const cat of order) {
    if (pieces.length >= pickLimit) break;
    const opts = (byCat[cat] || []).filter(o => !pieces.some(x => x.p.id === o.id));
    if (!opts.length) continue;
    const isCore = pieces.length < 2;
    const cand = opts.find(o => !budget || spend + o.price <= budget) || (isCore ? opts[opts.length - 1] : null);
    if (!cand) continue;
    pieces.push({ p: cand, cat, why: reasonFor(cand, pref), alts: opts.filter(o => o !== cand).slice(0, 2) });
    spend += cand.price;
  }
  if (!pieces.length) { const cheap = [...pool].sort((a, b) => a.price - b.price)[0]; pieces.push({ p: cheap, cat: cheap.wearCat, why: 'أخفض قطعة متوفرة حالياً', alts: [] }); spend = cheap.price; }
  return { pieces, total: pieces.reduce((a, x) => a + x.p.price, 0), budget, over: budget ? spend > budget : false };
}
function reasonFor(p, pref) {
  const parts = [];
  if (p.badge === 'sale' && p.old) parts.push(`مُخفَّض ${Math.round((1 - p.price / p.old) * 100)}% الآن`);
  if (p.badge === 'limited') parts.push('إصدار محدود لا يتكرر');
  if (p.badge === 'new') parts.push('من أحدث القطع وصولاً');
  if (pref.style && styleHit(p, pref.style)) parts.push({ luxury: 'فخامتها تليق بالمقام', heritage: 'روحها تراثية أصيلة', modern: 'قصّتها عصرية', classic: 'حضورها كلاسيكي رزين', light: 'خامة خفيفة مريحة', winter: 'دفء شتوي أنيق' }[pref.style]);
  if (pref.colors?.length) {
    const prefH = pref.colors.map(c => hexHsl(c.hex)).filter(Boolean).map(x => x.h);
    const hues = p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h);
    if (hues.length && prefH.length && Math.min(...hues.flatMap(h => prefH.map(f => hueDist(h, f)))) < 34) parts.push('لونها قريب من ذوقك');
  }
  if (p.materials[0]) parts.push(p.materials[0]);
  if (p.stock > 0 && p.stock <= 3) parts.push(`بقيت ${p.stock} فقط`);
  return (parts.slice(0, 2).join(' · ') || 'اختيار متوازن من تشكيلة الدار');
}

/* ─────────── تقييم الإطلالة ─────────── */
function scorePieces(items, budget) {
  const parts = [];
  const cats = new Set(items.map(p => p.wearCat));
  const hasBase = cats.has('thobe') || cats.has('maawaz');
  const accCats = ['belt', 'jambiya', 'shemagh', 'turban', 'watch', 'vest', 'shamzan', 'perfume', 'shoes', 'accessories'];
  const acc = [...cats].filter(c => accCats.includes(c)).length;
  const cPts = (hasBase ? 14 : 4) + Math.min(2, acc) * 8;
  parts.push(['اكتمال الإطلالة', cPts, 30]);
  const hues = items.flatMap(p => p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h));
  let harm = 25, clash = null;
  if (hues.length >= 2) {
    let worst = 0;
    for (let i = 0; i < hues.length; i++) for (let j = i + 1; j < hues.length; j++) worst = Math.max(worst, hueDist(hues[i], hues[j]));
    harm = worst <= 32 ? 25 : worst <= 60 ? 20 : worst <= 100 ? 12 : 6;
    if (worst > 100) clash = 'تباين لونيّ عالٍ بين القطع — وحّد العائلة اللونية لحضور أهدأ';
  }
  parts.push(['الانسجام اللوني', harm, 25]);
  const prices = items.map(p => p.price).filter(Boolean);
  const avg = prices.reduce((a, b) => a + b, 0) / Math.max(prices.length, 1);
  const spread = prices.length > 1 ? Math.max(...prices.map(x => Math.abs(Math.log((x + 1) / (avg + 1))))) : 0;
  parts.push(['اتساق المستوى', spread < .35 ? 15 : spread < .8 ? 11 : 7, 15]);
  const inStock = items.filter(p => p.stock > 0).length;
  parts.push(['التوفر الفوري', Math.round(15 * inStock / Math.max(items.length, 1)), 15]);
  let val = 5;
  if (items.some(p => p.badge === 'sale')) val += 3;
  if (items.some(p => p.badge === 'limited')) val += 2;
  parts.push(['القيمة والتميّز', Math.min(val, 10), 10]);
  if (budget) {
    const total = items.reduce((a, p) => a + p.price, 0);
    parts.push(['ضمن الميزانية', total <= budget ? 5 : 1, 5]);
  }
  const score = Math.round(parts.reduce((a, x) => a + x[1], 0) / parts.reduce((a, x) => a + x[2], 0) * 100);
  /* نصائح التحسين — كلها من الكتالوج الحقيقي */
  const tips = [];
  const lib = catalog();
  for (const p of items) {
    for (const need of COMPLEMENTS[p.wearCat] || []) {
      if (cats.has(need)) continue;
      const cand = lib.filter(x => x.wearCat === need && x.stock > 0).sort((a, b) => b.price - a.price)[0] || lib.find(x => x.wearCat === need);
      if (cand) { tips.push(`أكمل الحضور بقطعة من ${WL[need] || need} — مثل «${cand.name}»`); break; }
    }
    if (tips.length) break;
  }
  if (clash) tips.push(clash);
  if (items.some(p => p.stock === 0)) tips.push('قطعة في إطلالتك غير متوفرة حالياً — اعرض بدائلها في المتجر');
  if (budget && items.reduce((a, p) => a + p.price, 0) > budget) tips.push('الإطلالة تتجاوز ميزانيتك — استبدل قطعة بأخرى أدنى سعراً من البدائل');
  return { score, parts, tips: tips.slice(0, 3) };
}

/* ─────────── التقييمات (AI Reviews) ─────────── */
const rvCache = {};
async function fetchReviews(pid) {
  if (rvCache[pid] && Date.now() - rvCache[pid].t < 60000) return rvCache[pid].rows;
  const db = DB(); if (!db) return null;
  try {
    const { data, error } = await db.from('reviews').select('*').eq('product_id', String(pid)).order('created_at', { ascending: false }).limit(150);
    if (error) return rvCache[pid] = { rows: null, t: Date.now() }, null;
    rvCache[pid] = { rows: data || [], t: Date.now() };
    return data || [];
  } catch (e) { return null; }
}
const RV_TOPICS = { 'الخامة': ['خامه', 'خامات', 'قماش', 'قطن', 'صوف', 'حرير', 'جلد'], 'الحرفية والخياطة': ['خياطه', 'تطريز', 'تفصيل', 'تشطيب', 'حرفي'], 'المقاس': ['مقاس', 'مقاسات', 'طول', 'وسع', 'ضيق'], 'السعر': ['سعر', 'غالي', 'رخيص', 'قيمه'], 'الشحن': ['شحن', 'توصيل', 'وصل', 'شحنت'], 'التغليف': ['تغليف', 'علبه', 'صندوق'], 'الخدمة': ['خدمه', 'تعامل', 'دعم', 'تواصل'] };
function summarizeReviews(rs) {
  if (!rs || !rs.length) return null;
  const avg = rs.reduce((a, r) => a + r.rating, 0) / rs.length;
  const sat = Math.round(rs.filter(r => r.rating >= 4).length / rs.length * 100);
  const notes = Object.entries(RV_TOPICS).map(([label, words]) => [label, rs.filter(r => r.comment && words.some(w => norm(r.comment).includes(w))).length])
    .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { count: rs.length, avg: Math.round(avg * 10) / 10, sat, notes, latest: rs.slice(0, 4) };
}
const stars = r => '★★★★★'.slice(0, r) + '☆☆☆☆☆'.slice(0, 5 - r);
async function mountReviews(p, host) {
  if (!host) return;
  host.innerHTML = '<p style="font-size:10px;color:#8d8a80;padding:8px 0">✦ جارٍ قراءة آراء العملاء…</p>';
  const rs = await fetchReviews(p.id);
  if (rs === null) { host.innerHTML = ''; return; } /* الجدول غير مفعّل بعد — صمت */
  const sum = summarizeReviews(rs);
  host.innerHTML = `
    <h4 style="margin-top:18px">آراء العملاء <span class="p-cat" style="font-size:9px">ملخّص ذكي من تقييمات حقيقية</span></h4>
    ${sum ? `<div class="rv-strip"><span class="stars">${stars(Math.round(sum.avg))}</span><b class="num">${sum.avg}</b>
      <span>${sum.count} ${sum.count > 2 ? 'تقييمات' : 'تقييم'} · رضا ${sum.sat}%</span></div>
      ${sum.notes.length ? `<div class="rv-notes">${sum.notes.map(([l, n]) => `<i>✦ ${l} ×${n}</i>`).join('')}</div>` : ''}
      <div class="rv-list">${sum.latest.map(r => `<div class="rv-item"><b>${esc(r.customer_name || 'عميل الدار')} <span class="stars">${stars(r.rating)}</span></b>${esc(r.comment || '')}</div>`).join('')}</div>`
      : `<p class="ai-note" style="margin-top:12px">لا توجد تقييمات لهذه القطعة بعد — <b>كن أول من يشارك تجربته</b>.</p>`}
    <form class="rv-form" id="rv-form">
      <b>قيّم هذه القطعة</b>
      <div class="rv-stars" id="rv-stars">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-r="${i}">★</button>`).join('')}</div>
      <input name="rname" placeholder="اسمك (اختياري)" maxlength="40">
      <textarea name="rcomment" rows="2" maxlength="800" placeholder="حدّثنا عن الخامة، المقاس، التجربة… (اختياري)"></textarea>
      <button class="btn-gold" type="submit">إرسال التقييم</button>
      <small id="rv-msg">تقييمك يظهر هنا ويغذّي ملخّص الذكاء فوراً</small>
    </form>`;
  let rating = 5;
  const starBtns = $$('#rv-stars button', host);
  const paintStars = () => starBtns.forEach(b => b.classList.toggle('lit', +b.dataset.r <= rating));
  starBtns.forEach(b => b.onclick = () => { rating = +b.dataset.r; paintStars(); });
  paintStars();
  $('#rv-form', host).onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const db = DB();
    const btn = $('button[type=submit]', e.target); btn.disabled = true;
    let done = false;
    if (db) {
      try {
        const { error } = await db.from('reviews').insert({
          product_id: p.id, product_name: p.name,
          customer_name: (f.get('rname') || '').trim() || 'عميل الدار',
          rating, comment: (f.get('rcomment') || '').trim() || null
        });
        done = !error;
      } catch (err) { done = false; }
    }
    const msg = $('#rv-msg', host);
    if (done) {
      delete rvCache[p.id];
      track('review_add', { rating }, null, { id: p.id, name: p.name });
      msg.textContent = '✦ وصل تقييمك — شكراً لك'; msg.style.color = '#9fe0a8';
      setTimeout(() => mountReviews(p, host), 900);
    } else {
      msg.textContent = 'تعذر الحفظ الآن — فعّل جدول التقييمات من schema.sql المحدّث'; msg.style.color = '#e8b0b0';
      btn.disabled = false;
    }
  };
}
function $$(s, c) { return [...(c || document).querySelectorAll(s)]; }

/* ─────────── المقارنة ─────────── */
async function comparePair(a, b, target) {
  const [ra, rb] = await Promise.all([fetchReviews(a.id), fetchReviews(b.id)]);
  const sa = summarizeReviews(ra || []), sb = summarizeReviews(rb || []);
  const disc = p => p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
  const row = (h, va, vb, aw, bw) => `<tr><th>${h}</th><td class="${aw ? 'win' : ''}">${va}</td><td class="${bw ? 'win' : ''}">${vb}</td></tr>`;
  const colH = p => `<td><img src="${p.img}" alt=""><b>${esc(displayName(p))}</b><span class="p-cat">${esc(p.cat)}</span></td>`;
  const verdicts = [];
  if (a.price !== b.price) {
    const cheap = a.price < b.price ? a : b, dear = cheap === a ? b : a;
    verdicts.push(`«${esc(displayName(cheap))}» أوفر بفارق <b class="num">${fmt(dear.price - cheap.price)} ر.س</b>`);
  }
  if (disc(a) !== disc(b)) { const d = disc(a) > disc(b) ? a : b; verdicts.push(`خصم حالي <b class="num">${disc(d)}%</b> على «${esc(displayName(d))}»`); }
  if (a.stock !== b.stock) { const m = a.stock > b.stock ? a : b; verdicts.push(`توفر أعلى لـ«${esc(displayName(m))}» (${m.stock} قطعة)`); }
  if (sa?.count || sb?.count) {
    if ((sa?.count || 0) && (sb?.count || 0) && sa.avg !== sb.avg) verdicts.push(`رضا العملاء أعلى لـ«${esc(displayName(sa.avg > sb.avg ? a : b))}»`);
  } else verdicts.push('لا توجد تقييمات مسجلة لأي منهما بعد — ستُعرض فور وصولها');
  if (a.colors.length !== b.colors.length) { const m = a.colors.length > b.colors.length ? a : b; verdicts.push(`خيارات ألوان أوسع لـ«${esc(displayName(m))}» (${m.colors.length} ألوان)`); }
  target.innerHTML = `<div class="ai-cmp"><table>
    <tr><th></th>${colH(a)}${colH(b)}</tr>
    ${row('السعر', `${fmt(a.price)} <span class="num">ر.س</span>${a.old ? ` <s class="num">${fmt(a.old)}</s>` : ''}`, `${fmt(b.price)} <span class="num">ر.س</span>${b.old ? ` <s class="num">${fmt(b.old)}</s>` : ''}`, a.price < b.price, b.price < a.price)}
    ${row('الخامة', esc(a.materials[0] || 'خامات الدار النخبوية'), esc(b.materials[0] || 'خامات الدار النخبوية'))}
    ${row('المميزات', esc(a.materials[1] || 'تشطيب يدوي فاخر'), esc(b.materials[1] || 'تشطيب يدوي فاخر'))}
    ${row('المقاسات', a.sizes.map(s => `<span class="num">${esc(s)}</span>`).join(' · '), b.sizes.map(s => `<span class="num">${esc(s)}</span>`).join(' · '))}
    ${row('الألوان', a.colors.map(c => `<i class="ai-sw" style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join(''), b.colors.map(c => `<i class="ai-sw" style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join(''), a.colors.length > b.colors.length, b.colors.length > a.colors.length)}
    ${row('التقييمات', sa ? `<span class="stars" style="color:#D6BE7A">${stars(Math.round(sa.avg))}</span> <span class="num">${sa.avg}</span> (${sa.count})` : '—', sb ? `<span class="stars" style="color:#D6BE7A">${stars(Math.round(sb.avg))}</span> <span class="num">${sb.avg}</span> (${sb.count})` : '—')}
    ${row('المخزون', a.stock > 0 ? `${a.stock} قطعة` : 'نفد مؤقتاً', b.stock > 0 ? `${b.stock} قطعة` : 'نفد مؤقتاً', a.stock > b.stock, b.stock > a.stock)}
    ${row('المكانة', esc(badgeLabel(a.badge)), esc(badgeLabel(b.badge)))}
  </table></div>
  <div class="ai-tips">${verdicts.map(v => `<div class="ai-tip"><span>${v}</span></div>`).join('')}</div>`;
  track('ai_compare', { a: a.id, b: b.id });
}
const badgeLabel = b => b === 'sale' ? 'خصم حالي' : b === 'limited' ? 'إصدار محدود' : b === 'new' ? 'وصل حديثاً' : 'أساسية';
const displayName = p => EN() ? (p.nameEn || p.name) : p.name;

/* ─────────── دعم العملاء ─────────── */
const ST_STEPS = ['new', 'confirmed', 'processing', 'shipped', 'delivered'];
const ST_LABEL = { new: 'استُلم', confirmed: 'مؤكد', processing: 'يُجهَّز', shipped: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي' };
async function orderStatus(phone) {
  const db = DB(); if (!db) return { err: 'offline' };
  try {
    const { data, error } = await db.rpc('order_status', { p_phone: phone });
    if (error) return { err: error.code === 'PGRST202' || /not find/i.test(error.message || '') ? 'schema' : 'query' };
    return { rows: data || [] };
  } catch (e) { return { err: 'query' }; }
}
function supportAnswer(key) {
  switch (key) {
    case 'shipping': return tr(`الشحن <b class="num">${POLICY.shipFee} ر.س</b> لجميع المدن، و<b>مجاني</b> للطلبات فوق <b class="num">${POLICY.freeShipFrom} ر.س</b>.<br>مدة التوصيل: ${POLICY.delivery}، و${POLICY.pack}.`, `Shipping is <b>SAR ${POLICY.shipFee}</b>, free over <b>SAR ${POLICY.freeShipFrom}</b>. Delivery: 3–7 business days, in the house's signature packaging.`);
    case 'exchange': return tr(`تقبل الدار <b>الاستبدال خلال ${POLICY.exchangeDays} أيام</b> من الاستلام، بشرط بقاء القطعة بحالتها الأصلية وتغليفها وختمها. اكتب لي «حالة طلبي» أو تواصل عبر قسم «الدار» ليبدأ الإجراء.`, `Exchanges accepted within <b>${POLICY.exchangeDays} days</b> in original condition with the house seal intact.`);
    case 'warranty': return tr(`كل قطعة تخرج من الدار بـ<b>ختم الأصالة الرسمي</b> ورقم تسلسلي موثّق، وتمر بفحص جودة مزدوج قبل الشحن. أي عيب مصنعي يُعالج فوراً بالاستبدال.`, `Every piece leaves with the <b>official authenticity seal</b>, a serial number, and double quality inspection.`);
    case 'payment': return tr(`طرق الدفع المتاحة في صفحة إتمام الطلب: ${POLICY.pay}، ببوابة مشفّرة وآمنة. ${POLICY.confirm}.`, `Payment options at checkout: cards / mada, and cash on delivery — all encrypted and secure.`);
    case 'offers': {
      const deals = catalog().filter(p => p.old && p.old > p.price);
      if (!deals.length) return tr('لا توجد خصومات فعّالة هذه اللحظة — إصدارات الدار المحدودة تحافظ على قيمتها. فعّل التنبيهات الذكية 🔔 لأعلمك فور انخفاض أي سعر في مفضلتك.', 'No active discounts right now — the house limited editions hold their value. Enable smart notifications and I will alert you instantly.');
      return tr(`العروض الحقيقية الفعّالة الآن (من قاعدة المتجر): ${deals.map(p => `<b>«${esc(displayName(p))}»</b> — خصم ${Math.round((1 - p.price / p.old) * 100)}%`).join(' · ')}`, `Live offers right now: ${deals.map(p => `<b>${esc(displayName(p))}</b> −${Math.round((1 - p.price / p.old) * 100)}%`).join(' · ')}`);
    }
    case 'contact': return tr('يسعد فريق الدار بخدمتك عبر نموذج التواصل في قسم «الدار» أسفل الصفحة، وبعد كل طلب يتواصل معك مستشار خلال 24 ساعة لتأكيد التفاصيل.', 'Reach the house via the contact form at the page footer; after each order a concierge calls within 24 hours.');
  }
  return '';
}

/* ─────────── البحث بالصورة ─────────── */
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function vecOf(data) {
  const v = new Array(24).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
    if (s > .15) v[Math.floor(h / 30) % 12] += s;
    v[12 + Math.min(11, Math.floor(l * 12))]++;
  }
  const t = v.reduce((a, b) => a + b, 0) || 1;
  return v.map(x => x / t);
}
const palCache = readLS('ai-pal-1', {});
function paletteOfURL(url) {
  if (palCache[url]) return Promise.resolve(palCache[url]);
  return new Promise(res => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const S = 24, cv = document.createElement('canvas'); cv.width = cv.height = S;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(im, 0, 0, S, S);
        const v = vecOf(cx.getImageData(0, 0, S, S).data);
        palCache[url] = v;
        const ks = Object.keys(palCache); if (ks.length > 120) delete palCache[ks[0]];
        writeLS('ai-pal-1', palCache);
        res(v);
      } catch (e) { palCache[url] = null; res(null); }
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}
async function imageSearch(file, host) {
  host.innerHTML = '<div class="ai-scan">يحلّل خبير اللامع ألوان صورتك ويقارنها بكل قطع المتجر…</div>';
  let vec = null;
  try {
    const bmp = await createImageBitmap(file);
    const S = 24, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(bmp, 0, 0, S, S);
    vec = vecOf(cx.getImageData(0, 0, S, S).data);
  } catch (e) { host.innerHTML = ''; say(tr('تعذرت قراءة الصورة — جرّب صورة بصيغة JPG أو PNG.', 'Could not read that image — try JPG or PNG.')); return; }
  const list = catalog();
  let skipped = 0;
  const scored = [];
  for (const p of list) {
    const pv = await paletteOfURL(p.img);
    if (!pv) { skipped++; continue; }
    const d = pv.reduce((a, x, i) => a + Math.abs(x - vec[i]), 0);
    scored.push({ p, d });
  }
  scored.sort((a, b) => a.d - b.d);
  const mx = scored.length ? scored[scored.length - 1].d - scored[0].d || 1 : 1;
  const hits = scored.slice(0, 6).map(x => ({ p: x.p, pct: Math.min(98, Math.max(35, Math.round((1 - (x.d - scored[0].d) / mx) * 88 + 10))) }));
  track('ai_image_search', { found: hits.length });
  host.innerHTML = '';
  if (!hits.length) { say(tr('لا أستطيع تحليل صور المنتجات من هذا المتصفح حالياً — جرّب البحث النصي: صف لي القطعة بكلماتك.', 'Could not analyze the catalog images in this browser — try describing the piece in words instead.')); return; }
  say(tr(`قارنتُ صورتك بجميع <b>${list.length - skipped}</b> قطعة في المتجر — هذه الأقرب بصرياً إليها:`,
    `I compared your photo against all <b>${list.length - skipped}</b> pieces — the closest visual matches:`));
  sayCards(hits, h => `تقارب بصري ${h.pct}%`);
  if (skipped) sayNote(`<small>${skipped} صور تعذر تحليلها (قيود المتصفح) — استُبعدت بأمانة من المقارنة.</small>`);
}

/* ─────────── الصوت ─────────── */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, ttsOn = false;
function speak(text) {
  if (!ttsOn || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/[✦★☆⭐❤♥🔔🔥🟢🔴🟡💰💳📈📦🛍🛒🧥📤📸👁👤💬🤵⚖🖼📏🎙🎧⌕⏱↩🎨🔖👣]/g, '');
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = EN() ? 'en-US' : 'ar-SA'; u.rate = .98;
    const vs = speechSynthesis.getVoices();
    const v = vs.find(v => v.lang.startsWith(EN() ? 'en' : 'ar'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { }
}
function toggleMic() {
  if (!SR) { say(tr('التحكم الصوتي غير مدعوم في متصفحك — جرّب Chrome أو Edge، أو اكتب رسالتك نصاً.', 'Voice input is not supported in this browser — try Chrome or Edge.')); return; }
  const mic = $('#ai-mic');
  if (rec) { try { rec.stop(); } catch (e) { } return; }
  rec = new SR();
  rec.lang = EN() ? 'en-US' : 'ar-SA';
  rec.interimResults = true; rec.maxAlternatives = 1;
  mic.classList.add('live');
  track('ai_voice', {});
  rec.onresult = e => {
    let fin = '';
    for (const r of e.results) { $('#ai-in').value = r[0].transcript; if (r.isFinal) fin = r[0].transcript; }
    if (fin) { $('#ai-in').value = fin; setTimeout(() => $('#ai-form').requestSubmit(), 200); }
  };
  rec.onend = rec.onerror = () => { mic.classList.remove('live'); rec = null; };
  try { rec.start(); } catch (e) { mic.classList.remove('live'); rec = null; }
}

/* ─────────── التنبيهات الذكية + المفضلة ─────────── */
const readFavs = () => readLS('allamea-favs', []);
const readNotifs = () => readLS('ai-notifs-1', []);
const pushNotif = n => {
  const list = readNotifs();
  if (list.some(x => x.id === n.id)) return;
  list.unshift({ ...n, t: Date.now(), seen: false });
  writeLS('ai-notifs-1', list.slice(0, 14));
  badgeNotifs();
  track('ai_notif', { kind: n.id.split('-')[0] });
};
function diffSnapshot() {
  const list = catalog(); if (!list.length) return;
  const prev = readLS('ai-snap-1', {});
  const firstRun = !Object.keys(prev).length;
  const favs = readFavs();
  const cartIds = new Set(readLS('allamea-cart', []).map(i => String(i.id)));
  const favCats = new Set(list.filter(p => favs.includes(p.id)).map(p => p.wearCat));
  if (!firstRun) {
    list.forEach(p => {
      const o = prev[p.id];
      if (!o) { if (favCats.has(p.wearCat)) pushNotif({ icon: '✦', text: `وصل حديثاً: «${p.name}» — من فئة تقتنيها`, id: 'new-' + p.id }); return; }
      if (o.stock === 0 && p.stock > 0 && favs.includes(p.id)) pushNotif({ icon: '🛍', text: `عاد للمخزون: «${p.name}» من مفضلتك`, id: 'rs-' + p.id + '-' + p.stock });
      if (o.price > p.price && (favs.includes(p.id) || cartIds.has(p.id))) pushNotif({ icon: '💰', text: `انخفض سعر «${p.name}» إلى ${fmt(p.price)} ر.س`, id: 'pd-' + p.id + '-' + p.price });
    });
  }
  const cur = {};
  list.forEach(p => cur[p.id] = { price: p.price, stock: p.stock });
  writeLS('ai-snap-1', cur);
}
function wishlistPicks() {
  const favs = readFavs(); if (!favs.length) return null;
  const lib = catalog();
  const fp = favs.map(id => lib.find(p => p.id === id)).filter(Boolean);
  if (!fp.length) return null;
  const favHues = fp.flatMap(p => p.colors.map(c => hexHsl(c.hex))).filter(x => x && x.s > .12).map(x => x.h);
  const favCats = new Set(fp.map(p => p.wearCat));
  const avgP = fp.reduce((a, p) => a + p.price, 0) / fp.length;
  const picks = lib.filter(p => !favs.includes(p.id) && p.stock > 0).map(p => {
    let s = 0;
    if (favCats.has(p.wearCat)) s += 3;
    const hues = p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h);
    if (hues.length && favHues.length && Math.min(...hues.flatMap(h => favHues.map(f => hueDist(h, f)))) < 34) s += 3;
    if (avgP && Math.abs(p.price - avgP) / avgP < .5) s += 2;
    if (p.badge === 'sale') s += 1;
    return { p, s };
  }).filter(x => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.p);
  return { anchor: fp[fp.length - 1], picks };
}
function badgeNotifs() {
  const n = readNotifs().filter(x => !x.seen).length;
  const b1 = $('#ai-fab-badge'), b2 = $('#ai-n-count');
  if (b1) { b1.hidden = !n; b1.textContent = n; }
  if (b2) { b2.hidden = !n; b2.textContent = n; }
}

/* ═══════════════ واجهة المحادثة ═══════════════ */
const WIZ = { mode: null, answers: {}, compare: [] };
const shell = () => {
  const fab = document.createElement('button');
  fab.id = 'ai-fab'; fab.className = 'ai-fab';
  fab.setAttribute('aria-label', tr('افتح خبير اللامع', 'Open AL LAMEA AI'));
  fab.innerHTML = '✦<em id="ai-fab-badge" hidden></em>';
  document.body.appendChild(fab);
  const panel = document.createElement('section');
  panel.id = 'ai-panel'; panel.className = 'ai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-label', tr('محادثة خبير اللامع', 'AL LAMEA AI conversation'));
  panel.innerHTML = `
    <header class="ai-head">
      <div class="ai-id"><span class="ai-orb"></span><div><b data-ai="brand">خبير اللامع</b><span data-ai="sub">AL LAMEA AI™ · بيانات المتجر الحية</span></div></div>
      <div class="ai-tools">
        <button id="ai-tts" title="${tr('الرد الصوتي', 'Voice replies')}">🔇</button>
        <button id="ai-lang" title="English / عربي">${EN() ? 'ع' : 'EN'}</button>
        <button id="ai-close" title="${tr('إغلاق', 'Close')}">×</button>
      </div>
    </header>
    <nav class="ai-tabs" id="ai-tabs">
      <button data-mode="stylist">🛍 <span>${tr('إطلالة', 'Outfit')}</span></button>
      <button data-mode="support">🎧 <span>${tr('الدعم', 'Support')}</span></button>
      <button data-mode="image">🖼 <span>${tr('بالصورة', 'By photo')}</span></button>
      <button data-mode="size">📏 <span>${tr('مقاسك', 'My size')}</span></button>
      <button data-mode="compare">⚖ <span>${tr('قارن', 'Compare')}</span></button>
      <button data-mode="notifs">🔔 <span>${tr('تنبيهات', 'Alerts')}</span><em id="ai-n-count" hidden></em></button>
    </nav>
    <div class="ai-thread" id="ai-thread" aria-live="polite"></div>
    <div class="ai-sugg" id="ai-sugg"></div>
    <form class="ai-composer" id="ai-form">
      <button type="button" id="ai-mic" title="${tr('تحدّث صوتياً', 'Speak')}">🎙</button>
      <input id="ai-in" autocomplete="off" placeholder="${tr('اكتب طلبك… «أريد معوزاً فاخراً بأقل من 1500»', 'Ask me… “a luxury maawaz under 1500”')}">
      <button class="ai-send" type="submit" aria-label="${tr('إرسال', 'Send')}">←</button>
    </form>`;
  document.body.appendChild(panel);
  fab.onclick = openPanel;
  $('#ai-close').onclick = () => { panel.classList.remove('open'); fab.classList.remove('hide'); };
  $('#ai-tabs').onclick = e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    [...$('#ai-tabs').children].forEach(x => x.classList.toggle('on', x === b));
    runMode(b.dataset.mode);
  };
  $('#ai-mic').onclick = toggleMic;
  $('#ai-tts').onclick = () => {
    ttsOn = !ttsOn;
    $('#ai-tts').textContent = ttsOn ? '🔊' : '🔇';
    $('#ai-tts').classList.toggle('on', ttsOn);
    if (ttsOn) speak(tr('أهلاً، سأقرأ ردودي الآن', 'Voice replies are on'));
  };
  $('#ai-lang').onclick = () => {
    lang = EN() ? 'ar' : 'en';
    localStorage.setItem('ai-lang', lang);
    $('#ai-lang').textContent = EN() ? 'ع' : 'EN';
    $('#ai-in').placeholder = tr('اكتب طلبك… «أريد معوزاً فاخراً بأقل من 1500»', 'Ask me… “a luxury maawaz under 1500”');
    say(tr('سأخدمك بالعربية ✦', 'I will assist you in English now ✦'));
  };
  $('#ai-form').onsubmit = e => {
    e.preventDefault();
    const inp = $('#ai-in'), q = inp.value.trim();
    if (!q) return;
    inp.value = '';
    echo(q);
    route(q);
  };
};
let welcomed = false;
function openPanel() {
  const panel = $('#ai-panel');
  panel.classList.add('open');
  $('#ai-fab').classList.add('hide');
  track('ai_open', { studio: IS_STUDIO });
  badgeNotifs();
  if (!welcomed) { welcomed = true; welcome(); }
}
function welcome() {
  const studio = IS_STUDIO && window.AlameaStudio;
  say(tr(
    `أهلاً بك في دار اللامع — أنا <b>خبير اللامع</b>، مستشارك الشخصي هنا ✦<br>أقرأ <b>بيانات المتجر الحيّة</b> لحظة بلحظة: ما أعرضه موجود فعلاً، بسعره الحقيقي ومخزونه الحقيقي، وما لا أعرفه أخبرك به صراحة.`,
    `Welcome to AL LAMEA — I am your personal <b>house expert</b> ✦<br>I read the <b>live store data</b> only: real pieces, real prices, real stock — and I will honestly tell you when something is unknown.`));
  chips([
    ['🛍 ' + tr('كوّن لي إطلالة', 'Build my outfit'), () => runMode('stylist')],
    ['⌕ ' + tr('ابحث عن معوز فاخر', 'Search “luxury maawaz”'), () => route('أريد معوز فاخر', true)],
    ['🖼 ' + tr('ابحث بصورة', 'Search by photo'), () => runMode('image')],
    ['📏 ' + tr('ما مقاسي؟', 'What is my size?'), () => runMode('size')],
    studio ? ['✦ ' + tr('أكمل إطلالتي الحالية', 'Complete my current outfit'), studioComplete] : null,
    ['🎧 ' + tr('الشحن والدفع والعروض', 'Shipping & offers'), () => runMode('support')]
  ].filter(Boolean));
}
const thread = () => $('#ai-thread');
function say(html, voiceText) {
  const d = document.createElement('div');
  d.className = 'ai-msg ai'; d.innerHTML = html;
  thread().appendChild(d);
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
  speak(voiceText || html);
}
function sayNote(html) {
  const d = document.createElement('div');
  d.className = 'ai-note'; d.innerHTML = html;
  thread().appendChild(d);
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}
function echo(text) {
  const d = document.createElement('div');
  d.className = 'ai-msg user'; d.textContent = text;
  thread().appendChild(d);
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}
function typing(fn, delay = 650) {
  const t = document.createElement('div');
  t.className = 'ai-typing'; t.innerHTML = '<i></i><i></i><i></i>';
  thread().appendChild(t);
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
  setTimeout(() => { t.remove(); fn(); }, delay);
}
function chips(list) {
  const box = $('#ai-sugg');
  box.innerHTML = '';
  list.forEach(([label, fn, cls]) => {
    const b = document.createElement('button');
    b.className = 'ai-chip' + (cls ? ' ' + cls : '');
    b.innerHTML = label; /* التسميات داخلية موثوقة أو مهرّبة عند المصدر */
    b.onclick = () => fn(b);
    box.appendChild(b);
  });
}
function cardOf(p, why) {
  const out = p.stock <= 0;
  return `<article class="ai-card" data-ai-open="${p.id}">
    ${why ? `<span class="ai-match">${why}</span>` : ''}
    <img src="${p.img || p.detail}" alt="${esc(displayName(p))}" loading="lazy">
    <div><b>${esc(displayName(p))}</b>
      <span class="num">${fmt(p.price)}</span> <small>ر.س</small>${p.old ? `<s class="num">${fmt(p.old)}</s>` : ''}
      ${p.materials[0] ? `<span class="ai-why">${esc(p.materials[0])}</span>` : `<span class="ai-why">${esc(p.cat)}</span>`}
    </div>
    ${out ? '<span class="ai-out">نفدت مؤقتاً</span>' : ''}
  </article>`;
}
function sayCards(list, whyFn) {
  const d = document.createElement('div');
  d.className = 'ai-cards';
  d.innerHTML = list.map(x => cardOf(x.p || x, whyFn ? whyFn(x) : null)).join('');
  thread().appendChild(d);
  d.querySelectorAll('[data-ai-open]').forEach(c => c.onclick = () => openProductById(c.dataset.aiOpen));
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}
function openProductById(id) {
  if (window.Alamea?.open) { window.Alamea.open(id); return; }
  if (IS_STUDIO) { const sp = window.AlameaStudio?.state.products.find(p => String(p.id) === String(id)); if (sp) window.AlameaStudio.wear(sp); return; }
  location.href = 'index.html#collection';
}
function outfitHTML(out, ctx) {
  const rows = out.pieces.map(x => `
    <div class="ai-piece">
      <img src="${x.p.img || x.p.detail}" alt="">
      <div>
        <div class="pc-t"><b>${esc(displayName(x.p))}</b><span class="num">${fmt(x.p.price)} ر.س</span></div>
        <div class="why">✦ ${esc(x.why)}</div>
        ${x.alts?.length && ctx ? `<div class="alts">بدائل: ${x.alts.map(a => `<button data-swap="${x.cat}|${a.id}|${x.p.id}">${esc(displayName(a))} · ${fmt(a.price)}</button>`).join('')}</div>` : ''}
      </div>
    </div>`).join('');
  return `<div class="ai-outfit">${rows}
    <div class="ai-outfit-foot">
      <div><b>إجمالي الإطلالة</b><br><span class="num">${fmt(out.total)} ر.س</span>${out.budget ? `<br><small style="color:${out.over ? '#e8b0b0' : '#9fe0a8'}">${out.over ? 'تتجاوز ميزانيتك — جرّب بديلاً' : 'ضمن ميزانيتك ✦'}</small>` : ''}</div>
      <div style="display:grid;gap:7px">
        <button class="ai-gbtn" data-cart-all>أضف الكل للسلة · ${out.pieces.length}</button>
        <button class="ai-cbtn" data-score-it>★ قيّم هذه الإطلالة</button>
      </div>
    </div></div>`;
}
function sayOutfit(out) {
  const d = document.createElement('div');
  d.innerHTML = outfitHTML(out, true);
  const el = d.firstElementChild;
  thread().appendChild(el);
  el.querySelector('[data-cart-all]')?.addEventListener('click', () => addAll(out));
  el.querySelector('[data-score-it]')?.addEventListener('click', () => showScore(scorePieces(out.pieces.map(x => x.p), out.budget)));
  el.querySelectorAll('[data-swap]').forEach(b => b.onclick = () => {
    const [cat, newId, oldId] = b.dataset.swap.split('|');
    const lib = catalog();
    const np = lib.find(x => String(x.id) === newId);
    if (!np) return;
    out.pieces = out.pieces.map(x => x.p.id === oldId ? { ...x, p: np, why: reasonFor(np, { occ: WIZ.answers.occ, style: WIZ.answers.style, colors: WIZ.answers.colorHexes || [] }) } : x);
    out.total = out.pieces.reduce((a, x) => a + x.p.price, 0);
    echo(displayName(np));
    sayOutfit(out);
  });
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}
function addAll(out) {
  let added = 0, skipped = 0;
  out.pieces.forEach(({ p }) => {
    if (p.stock <= 0) { skipped++; return; }
    const size = p.sizes[0] || 'مقاس واحد';
    const color = (p.colors[0] || {}).name || 'أساسي';
    if (window.Alamea?.add) window.Alamea.add(p.id, size, color, 1); /* يتتبع cart_add داخلياً */
    else if (window.AlameaStudio?.pushCart) {
      window.AlameaStudio.pushCart(p.studioRef || p);
      track('cart_add', { via: 'ai_outfit', size, color }, p.price, { id: p.id, name: p.name });
    }
    added++;
  });
  if (lastQuery) track('search', { q: lastQuery, converted: true });
  say(tr(`أُضيفت <b>${added}</b> ${added > 2 ? 'قطع' : 'قطعة'} من إطلالتك إلى سلتك ✦${skipped ? `<br><small>${skipped} غير متوفرة حالياً — استُبعدت بأمانة.</small>` : ''}${window.Alamea?.openCart ? ' تفتح سلتك الآن…' : ''}`,
    `Added <b>${added}</b> pieces to your cart ✦`));
  if (window.Alamea?.openCart && !IS_STUDIO) setTimeout(() => window.Alamea.openCart(), 700);
}
function showScore(res) {
  const d = document.createElement('div');
  d.className = 'ai-score';
  d.innerHTML = `
    <div class="ai-ring"><svg viewBox="0 0 92 92"><defs><linearGradient id="aiRingGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D6BE7A"/><stop offset="1" stop-color="#8C6B2F"/></linearGradient></defs>
      <circle class="bg" cx="46" cy="46" r="42"/><circle class="fg" cx="46" cy="46" r="42"/></svg>
      <b class="num">${res.score}</b><small>من 100</small></div>
    <div class="ai-score-parts">${res.parts.map(([l, v, mx]) => `<div class="ai-sp"><span>${l}</span><b class="num">${v}/${mx}</b><i><u style="width:0%"></u></i></div>`).join('')}</div>`;
  thread().appendChild(d);
  requestAnimationFrame(() => {
    d.querySelector('.fg').style.strokeDashoffset = 264 - (264 * res.score / 100);
    d.querySelectorAll('.ai-sp u').forEach((u, i) => u.style.width = (res.parts[i][1] / res.parts[i][2] * 100) + '%');
  });
  if (res.tips.length) {
    const t = document.createElement('div');
    t.className = 'ai-tips';
    t.innerHTML = res.tips.map(x => `<div class="ai-tip"><span>${esc(x)}</span></div>`).join('');
    thread().appendChild(t);
  }
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
  track('ai_score', { score: res.score });
}

/* ═══════════════ الأنماط ═══════════════ */
function runMode(mode) {
  const lib = catalog();
  if (!lib.length) { say(tr('كتالوج المتجر لم يجهز بعد — أعد المحاولة بعد لحظات.', 'The catalog is still loading — try again in a moment.')); return; }
  ({
    stylist: flowStylist, support: flowSupport, image: flowImage,
    size: flowSize, compare: flowCompare, notifs: flowNotifs
  }[mode] || (() => { }))();
}

/* — خبير الإطلالات — */
function flowStylist() {
  WIZ.mode = 'stylist'; WIZ.answers = {};
  say(tr('بكل سرور — سأفصّل لك إطلالة من قطع الدار المتوفرة الآن. أولاً: <b>ما المناسبة؟</b>', 'With pleasure — let us tailor your outfit from the live collection. First: <b>what is the occasion?</b>'));
  chips([
    ...Object.entries(OCC_LABEL).filter(([k]) => k !== 'any').map(([k, l]) => [l, () => { echo(l); WIZ.answers.occ = k; askBudget(); }]),
    [tr('بدون مناسبة محددة', 'Just browsing'), () => { echo(tr('بدون مناسبة', 'Browsing')); askBudget(); }, 'ghosty']
  ]);
}
function askBudget() {
  say(tr('<b>وما ميزانيتك التقريبية؟</b> سألتزم بها حرفياً — لا أعرض ما يتجاوزها.', '<b>And your budget?</b> I will respect it strictly.'));
  const opts = [[500, 'حتى 500 ر.س'], [1000, 'حتى 1000 ر.س'], [2000, 'حتى 2000 ر.س'], [4000, 'حتى 4000 ر.س']];
  chips([
    ...opts.map(([v, l]) => [l, () => { echo(l); WIZ.answers.budgetMax = v; askColors(); }]),
    [tr('الميزانية مفتوحة', 'No limit'), () => { echo(tr('مفتوحة', 'Open budget')); askColors(); }, 'ghosty']
  ]);
}
function askColors() {
  say(tr('<b>ألوانك المفضلة؟</b> اختر ما يشبه ذوقك (يمكن أكثر من لون ثم «تم»).', '<b>Favorite colors?</b> pick one or more then “done”.'));
  const picked = [];
  chips([
    ...Object.entries(LEX.colors).slice(0, 10).map(([name, hexes]) => [`<i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${hexes[0]};border:1px solid rgba(255,255,255,.3)"></i> ${name}`, b => {
      const i = picked.indexOf(name);
      if (i >= 0) { picked.splice(i, 1); b.classList.remove('sel'); } else { picked.push(name); b.classList.add('sel'); }
    }]),
    [tr('تم ✦', 'Done ✦'), () => {
      WIZ.answers.colorHexes = picked.map(n => ({ name: n, hex: LEX.colors[n][0] }));
      echo(picked.length ? picked.join('، ') : tr('دون تفضيل لون', 'No color preference'));
      askGender();
    }, 'sel']
  ]);
}
function askGender() {
  say(tr('<b>لمن الإطلالة؟</b>', '<b>Who is this outfit for?</b>'));
  chips([
    [tr('رجالية', 'Men'), () => { echo(tr('رجالية', 'Men')); askStyle(); }],
    [tr('هدية لشخص', 'A gift'), () => { echo(tr('هدية', 'A gift')); WIZ.answers.gift = true; askStyle(); }],
    [tr('نسائية', 'Women'), () => {
      echo(tr('نسائية', 'Women'));
      say(tr('تشكيلة الدار الحالية <b>رجالية</b> بالكامل — لن أقترح ما لا يوجد. لكن يسعدني تكوين إطلالة مهداة لسيدة من إكسسوارات الدار الراقية ✦', 'The current collection is entirely menswear — I will not invent otherwise. I can still compose a refined gift set ✦'));
      WIZ.answers.gift = true; askStyle();
    }]
  ]);
}
function askStyle() {
  say(tr('<b>وأخيراً — أسلوبك؟</b>', '<b>Finally — your style?</b>'));
  chips([
    ['ملكي فاخر', () => finishStylist('luxury', 'ملكي فاخر')],
    ['تراثي أصيل', () => finishStylist('heritage', 'تراثي أصيل')],
    ['عصري', () => finishStylist('modern', 'عصري')],
    ['كلاسيكي هادئ', () => finishStylist('classic', 'كلاسيكي هادئ')],
    [tr('اختر أنت لي ✦', 'Surprise me ✦'), () => finishStylist(null, tr('استشارة الخبير', 'Expert pick')), 'ghosty']
  ]);
}
function finishStylist(style, styleLabel) {
  echo(styleLabel);
  typing(() => {
    const A = WIZ.answers;
    const out = buildOutfit({ occ: A.occ, budgetMax: A.budgetMax, colors: A.colorHexes || [], style, gift: A.gift });
    if (!out) { say(tr('لا تتوفر قطع في المخزون حالياً — سأعلمك فور عودتها عبر التنبيهات 🔔', 'Nothing is in stock right now — I will alert you when pieces return 🔔')); return; }
    track('ai_outfit', { occ: A.occ || 'any', budget: A.budgetMax || 0, items: out.pieces.length }, out.total);
    say(tr(`إطلالة ${OCC_LABEL[A.occ || 'any']} فصّلتها لك قطعةً قطعة — مع سبب اختيار كل منها:`,
      `Your ${(OCC_LABEL[A.occ || 'any'])} outfit, tailored piece by piece — with the reason behind each:`));
    sayOutfit(out);
    chips([
      ['🛒 ' + tr('أضف الكل للسلة', 'Add all to cart'), () => addAll(out)],
      ['★ ' + tr('قيّم الإطلالة', 'Score it'), () => showScore(scorePieces(out.pieces.map(x => x.p), out.budget))],
      IS_STUDIO && window.AlameaStudio ? ['🧥 ' + tr('جرّبها على شخصيتك', 'Try on my avatar'), () => {
        const st = window.AlameaStudio;
        let worn = 0;
        out.pieces.forEach(({ p }) => { const sp = st.state.products.find(x => String(x.id) === String(p.id)); if (sp) { st.wear(sp); worn++; } });
        say(worn ? tr(`لبّستك <b>${worn}</b> قطعة على شخصيتك الرقمية 🧥 — انظر إليها على المسرح.`,
          `Dressed <b>${worn}</b> pieces on your avatar 🧥`) : tr('هذه القطع غير مفعّلة للتجربة الافتراضية بعد — فعّلها من لوحة التحكم (Virtual Studio).', 'These pieces are not try-on enabled yet.'));
      }] : null,
      ['↺ ' + tr('إطلالة أخرى', 'Another outfit'), flowStylist, 'ghosty']
    ].filter(Boolean));
    WIZ.mode = null;
  }, 1000);
}

/* — البحث الذكي — */
function smartSearch(q) {
  lastQuery = q;
  const { hits, parsed } = search(q);
  track('search', { q, results: hits.length });
  if (parsed.gender === 'w') sayNote('<b>ملاحظة صادقة:</b> تشكيلة الدار الحالية رجالية — نتائجك من المتجر الفعلي.');
  if (!hits.length) {
    say(tr(`بحثت في كل المتجر عن «${esc(q)}» و<b>لم أجد ما يطابق حرفياً</b> — لن أخترع نتائج. جرّب:
      <br>· وصف أبسط: «ثوب أبيض»، «مشلح رسمي»، «هدية فاخرة»
      <br>· أو وسّع الميزانية قليلاً`,
      `I searched the whole store for “${esc(q)}” and found <b>no exact match</b> — I will not invent results. Try simpler words or widen the budget.`));
    chips([
      ...catalog().slice(0, 3).map(p => [esc(displayName(p)), () => openProductById(p.id)]),
      ['🛍 ' + tr('كوّن لي إطلالة بدلها', 'Build an outfit instead'), flowStylist, 'ghosty']
    ]);
    return;
  }
  const exact = parsed.wear.size && hits[0] && parsed.wear.has(hits[0].wearCat);
  say(tr(`وجدت <b>${hits.length}</b> ${hits.length > 2 ? 'قطع' : 'قطعة'} من المتجر تطابق «${esc(q)}»${parsed.budget?.max ? ` ضمن ميزانية <b class="num">${fmt(parsed.budget.max)}</b> ر.س` : ''}${parsed.occ ? ` لمناسبة ${OCC_LABEL[parsed.occ]}` : ''}:`,
    `Found <b>${hits.length}</b> live matches for “${esc(q)}”:`));
  sayCards(hits.slice(0, 6).map(p => ({ p })), x => x.p.stock > 3 ? 'متوفر' : (x.p.stock > 0 ? 'كمية محدودة' : null));
  if (!exact && parsed.wear.size) sayNote('لم تتوفر الفئة المطلوبة حرفياً — عرضتُ أقرب القطع إليها من مخزون المتجر الفعلي.');
  if (hits.length > 6) sayNote(`و${hits.length - 6} نتائج أخرى — اكتب «المزيد» أو دقّق وصفك أكثر.`);
  chips([
    ...hits.slice(0, 3).map(p => [esc(displayName(p)), () => openProductById(p.id)]),
    ['⚖ ' + tr('قارن أول نتيجتين', 'Compare top two'), () => { WIZ.compare = [hits[0], hits[1]]; showCompare(); }, 'ghosty'],
    ['🛍 ' + tr('إطلالة مكمّلة لها', 'Complete the outfit'), () => { WIZ.answers = { occ: parsed.occ }; flowStylist(); }, 'ghosty']
  ]);
}

/* — المقارنة — */
function flowCompare() {
  const lib = catalog();
  if (WIZ.compare.length === 2) { showCompare(); return; }
  WIZ.compare = [];
  say(tr('اختر <b>منتجين</b> من المتجر لأقارنهما جنباً إلى جنب — بالسعر والخامة والمقاسات والتقييمات الحقيقية:', 'Pick <b>two</b> pieces and I will compare them honestly:'));
  chips(lib.slice(0, 12).map(p => [esc(displayName(p)), () => {
    echo(displayName(p));
    WIZ.compare.push(p);
    if (WIZ.compare.length < 2) flowCompare();
    else showCompare();
  }]));
}
function showCompare() {
  const [a, b] = WIZ.compare;
  if (!a || !b) { flowCompare(); return; }
  const host = document.createElement('div');
  host.innerHTML = '<div class="ai-scan">أقارن القطعتين الآن — بيانات حيّة بلا تحيّز…</div>';
  thread().appendChild(host.firstElementChild);
  const scan = thread().lastElementChild;
  const out = document.createElement('div');
  out.style.alignSelf = 'stretch';
  thread().appendChild(out);
  comparePair(a, b, out).then(() => {
    scan.remove();
    thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
    chips([
      ['🛒 ' + tr('أضف الأول للسلة', 'Add the first'), () => addAll({ pieces: [{ p: a }], total: a.price })],
      ['🛒 ' + tr('أضف الثاني للسلة', 'Add the second'), () => addAll({ pieces: [{ p: b }], total: b.price })],
      ['⚖ ' + tr('مقارنة أخرى', 'New comparison'), () => { WIZ.compare = []; flowCompare(); }, 'ghosty']
    ]);
  });
  WIZ.compare = [];
}

/* — المقاس — */
function flowSize() {
  WIZ.mode = 'size'; WIZ.answers = {};
  say(tr('سأقدّر لك المقاس الأقرب من مقاسات <b>قطع الدار نفسها</b> — لا مقاسات عامة. <b>كم طولك بالسنتم؟</b>', 'I will estimate your size from the <b>actual store sizes</b>. <b>Your height in cm?</b>'));
  chips([['أقل من 165', () => sizeH(162, 'أقل من 165')], ['165 – 172', () => sizeH(168, '165 – 172')], ['173 – 180', () => sizeH(176, '173 – 180')], ['181 – 188', () => sizeH(184, '181 – 188')], ['أطول من 188', () => sizeH(192, 'أطول من 188')]]);
}
function sizeH(h, label) {
  echo(label); WIZ.answers.h = h;
  say(tr('<b>والوزن التقريبي؟</b>', '<b>And your weight?</b>'));
  chips([['أقل من 65 كجم', () => sizeW(60, 'أقل من 65')], ['65 – 80 كجم', () => sizeW(72, '65 – 80')], ['81 – 95 كجم', () => sizeW(88, '81 – 95')], ['أكثر من 95 كجم', () => sizeW(103, 'أكثر من 95')]]);
}
function sizeW(w, label) {
  echo(label + ' كجم'); WIZ.answers.w = w;
  say(tr('<b>وبنية جسمك؟</b>', '<b>Body build?</b>'));
  chips([['نحيف', () => sizeDone('slim', 'نحيف')], ['متوسط / رياضي', () => sizeDone('avg', 'متوسط')], ['ممتلئ', () => sizeDone('heavy', 'ممتلئ')]]);
}
function sizeDone(body, label) {
  echo(label);
  typing(() => {
    const { h, w } = WIZ.answers;
    const rec = recSize(h, w, body);
    const lib = catalog().filter(p => p.stock > 0 && ['thobe', 'maawaz', 'shamzan', 'vest'].includes(p.wearCat));
    const bmiTxt = rec.bmi.toFixed(1);
    say(tr(`تحليلك: طول <b class="num">${h}</b> سم · وزن <b class="num">${w}</b> كجم · مؤشر كتلة <b class="num">${bmiTxt}</b> — القاعدة المقترحة <b class="num">${rec.letter}</b>.<br>وهو على مقاسات منتجات المتجر الفعلية كالتالي:`, `Your estimate: <b>${rec.letter}</b> — mapped onto the live store sizes:`));
    const rows = lib.slice(0, 5).map(p => {
      const s = sizeForProduct(p, rec.letter);
      return `«${esc(displayName(p))}» ← مقاس <b class="num">${esc(s.size)}</b>${s.fixed ? ' (مقاس واحد)' : s.nearest ? ' (أقرب متوفر)' : ''}`;
    }).join('<br>');
    say(rows || 'لا قطع ملبوسة مدرجة حالياً.');
    sayNote('<b>تقدير استرشادي صريح:</b> المقاس النهائي يعتمد على القصّة وتفضيلك للاتساع — عند الطلب يتواصل مستشار الدار لتأكيد القياسات.');
    chips([
      ...lib.slice(0, 3).map(p => ['🧥 ' + esc(displayName(p)), () => openProductById(p.id)]),
      ['📏 ' + tr('بقياسات أخرى', 'New measurements'), flowSize, 'ghosty']
    ]);
    track('ai_size', { h, w, body, letter: rec.letter });
    WIZ.mode = null;
  }, 700);
}

/* — الدعم — */
function flowSupport() {
  say(tr('أنا هنا لأجيبك من بيانات المتجر ونظام الطلبات مباشرة — بلا تحويل وبلا انتظار. اختر موضوعك:', 'I answer from live store and order data — no waiting. Pick a topic:'));
  chips([
    ['📦 ' + tr('حالة طلبي', 'Track my order'), askPhone],
    ['👑 ' + tr('نقاط ولائي', 'My loyalty points'), askLoyalty],
    ['🚚 ' + tr('الشحن والتوصيل', 'Shipping'), () => say(supportAnswer('shipping'))],
    ['↩ ' + tr('الاستبدال والإرجاع', 'Exchanges'), () => say(supportAnswer('exchange'))],
    ['🛡 ' + tr('الضمان والأصالة', 'Warranty'), () => say(supportAnswer('warranty'))],
    ['💳 ' + tr('طرق الدفع', 'Payment'), () => say(supportAnswer('payment'))],
    ['🏷 ' + tr('العروض الحالية', 'Current offers'), () => say(supportAnswer('offers'))],
    ['💬 ' + tr('التواصل مع الدار', 'Contact us'), () => say(supportAnswer('contact'))]
  ]);
}
function askPhone() {
  WIZ.mode = 'phone';
  say(tr('أدخل <b>رقم الجوال</b> الذي طلبت به (مثال: 05xxxxxxxx) وسأجلب طلباتك من النظام الآن:', 'Enter the <b>phone number</b> you ordered with: (e.g. 05xxxxxxxx)'));
}
async function showOrders(phone) {
  typing(async () => {
    const res = await orderStatus(phone);
    if (res.err === 'schema') { say(tr('نظام تتبّع الطلبات يحتاج تحديث قاعدة البيانات مرة واحدة — شغّل <b>schema.sql</b> المحدّث في Supabase ثم جرّب مجدداً.', 'Order tracking needs the updated schema.sql executed once in Supabase.')); return; }
    if (res.err) { say(tr('تعذر الوصول لنظام الطلبات الآن — تحقق من اتصالك وأعد المحاولة.', 'Could not reach the order system — check your connection.')); return; }
    if (!res.rows.length) { say(tr(`لا توجد طلبات مسجلة على الرقم <b class="num">${esc(phone)}</b> — تأكد من الرقم نفسه عند إتمام الطلب، أو اطلب الآن وسأتابع طلبك فوراً ✦`, `No orders registered under <b>${esc(phone)}</b>.`)); return; }
    say(tr(`وجدت <b>${res.rows.length}</b> ${res.rows.length > 1 ? 'طلبات' : 'طلب'} على رقمك — آخرها أولاً:`, `Found <b>${res.rows.length}</b> order(s) — latest first:`));
    res.rows.slice(0, 4).forEach(o => {
      const d = document.createElement('div');
      d.className = 'ai-order';
      const st = o.status === 'cancelled' ?
        `<div class="ai-tip" style="margin-top:8px"><span>هذا الطلب ملغي — للاستفسار تواصل مع الدار.</span></div>` : '';
      const idx = ST_STEPS.indexOf(o.status);
      const steps = ST_STEPS.map((s, i) => `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}">${i < idx ? '✓' : i === idx ? '●' : i + 1}</i>`).join('<u class="done-x"></u>');
      const date = new Date(o.created_at).toLocaleDateString(EN() ? 'en-GB' : 'ar-SA', { day: 'numeric', month: 'short' });
      d.innerHTML = `
        <div class="o-head"><b>#${esc(o.order_ref)}</b><span>${date}${o.city ? ' · ' + esc(o.city) : ''}</span></div>
        <div class="o-head" style="font-size:10px;color:#A8A8A8"><span>${o.items_count} ${o.items_count > 1 ? 'قطع' : 'قطعة'} · الإجمالي <span class="num" style="color:#D6BE7A">${fmt(o.total)} ر.س</span></span><span style="color:#D6BE7A;font-weight:600">${ST_LABEL[o.status] || o.status}</span></div>
        ${o.status !== 'cancelled' ? `<div class="ai-steps">${steps}</div>
        <div class="ai-steps-labels">${ST_STEPS.map(s => `<span>${ST_LABEL[s]}</span>`).join('')}</div>` : st}`;
      thread().appendChild(d);
    });
    sayNote('<small>الحالة تُقرأ مباشرة من نظام الطلبات — «في الطريق» تعني أن الشحنة خرجت من الدار، «قيد التجهيز» يمر الآن بفحص الجودة المزدوج.</small>');
    thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
    chips([['📦 ' + tr('رقم آخر', 'Another number'), askPhone, 'ghosty'], ['🚚 ' + tr('مدة التوصيل؟', 'Delivery time?'), () => say(supportAnswer('shipping')), 'ghosty']]);
  }, 500);
}

/* — الولاء والمكافآت — */
function askLoyalty() {
  WIZ.mode = 'loyalty';
  say(tr('أدخل <b>رقم الجوال</b> الذي تطلب به عادةً (مثال: 05xxxxxxxx) وسأحسب نقاط ولائك ومستوى عضويتك من سجل الدار الفعلي مباشرة ✦', 'Enter the <b>phone number</b> you order with — I will compute your loyalty points from the house records directly ✦'));
}
async function showLoyalty(phone) {
  typing(async () => {
    const [res, L] = await Promise.all([orderStatus(phone), loyaltyConf()]);
    if (res.err === 'schema') { say(tr('نظام الطلبات يحتاج تحديث قاعدة البيانات مرة واحدة — schema.sql المحدّث.', 'The order system needs the updated schema.sql executed once.')); return; }
    if (res.err) { say(tr('تعذر الوصول لنظام الطلبات الآن — تحقق من اتصالك وأعد المحاولة.', 'Could not reach the order system — check your connection.')); return; }
    if (!L.enabled) {
      say(tr('عضوية نخبة اللامع في لمساتها الأخيرة — <b>لم يُفعّل برنامج الولاء رسمياً بعد</b> من قبل الدار. بأمانة: كل طلباتك السابقة والقادمة مسجلة في نظامنا، وستُحتسب نقاطك فور انطلاق البرنامج دون أن تخسر شيئاً.', 'Elite membership is in its final touches — the loyalty programme is not officially enabled yet. Your past and future orders are firmly recorded and will count from day one.'));
      return;
    }
    const spend = res.rows.filter(o => o.status !== 'cancelled').reduce((a, o) => a + (+o.total || 0), 0);
    const tiers = L.tiers.map(t => ({ name: t.name, min: +t.min || 0 })).sort((a, b) => a.min - b.min);
    if (!res.rows.length) {
      say(tr(`لا توجد طلبات مسجلة بعد على الرقم <b class="num">${esc(phone)}</b> — لكن بشرى: الدار تمنح <b class="num">${fmt(L.welcome)}</b> نقطة ترحيباً مع أول طلب، وكل <b class="num">1</b> ر.س = <b class="num">${L.rate}</b> نقطة بعدها. أهديك بداية لامعة ✦`, `No orders yet under <b>${esc(phone)}</b> — good news: the house grants <b>${fmt(L.welcome)}</b> welcome points with your first order, then SAR 1 = ${L.rate} point(s) ✦`));
      chips([['🛍 ' + tr('دلّعني الآن', 'Browse with me'), () => flowStylist(), 'ghosty']]);
      return;
    }
    const pts = Math.round(spend * L.rate + L.welcome);
    const tier = [...tiers].reverse().find(t => pts >= t.min) || tiers[0];
    const next = tiers.find(t => t.min > pts);
    const remain = next ? Math.max(1, next.min - pts) : 0;
    say(tr(`مستواك الحالي: <b style="color:#D6BE7A">👑 ${esc(tier?.name || 'فضي')}</b>${tier?.perk ? ` — مكافأة مستواك: <b>${esc(tier.perk)}</b>` : ''}<br>
      • رصيدك: <b class="num" style="color:#D6BE7A">${fmt(pts)}</b> نقطة — من إنفاق فعلي ${fmt(Math.round(spend))} ر.س × ${L.rate}${L.welcome ? ' + ' + fmt(L.welcome) + ' ترحيباً' : ''}<br>
      ${next ? `• تفصلك <b class="num">${fmt(remain)}</b> نقطة عن مستوى <b>«${esc(next.name)}»</b> — تُحسب من ${fmt(next.min)} نقطة${next.perk ? `، ومكافأته: <b>${esc(next.perk)}</b>` : ''}.` : '• أنت في أعلى شرائح النخبة — مكانتك محفوظة لدى الدار.'}`,
      `Your tier: <b>👑 ${esc(tier?.name || 'Silver')}</b>${tier?.perk ? ` — perk: <b>${esc(tier.perk)}</b>` : ''} — balance: <b>${fmt(pts)}</b> pts (verified spend SAR ${fmt(Math.round(spend))} × ${L.rate}${L.welcome ? ' + ' + fmt(L.welcome) + ' welcome' : ''}). ${next ? `${fmt(remain)} pts to reach <b>${esc(next.name)}</b>${next.perk ? ` (perk: ${esc(next.perk)})` : ''}.` : 'You are at the top tier.'}`));
    sayNote(`<small>نقاطك محسوبة هذه اللحظة من ${res.rows.length} ${res.rows.length > 1 ? 'طلبات' : 'طلب'} فعلية في نظام الدار — لا تقدير ولا تقريب. سيُفعّل استبدال النقاط بالمكافآت من الدار قريباً.</small>`);
    track('ai_loyalty', { orders: res.rows.length, tier: tier?.name });
    chips([['👑 ' + tr('رقم آخر', 'Another number'), askLoyalty, 'ghosty'], ['📦 ' + tr('تتبع طلبي', 'Track my order'), askPhone, 'ghosty']]);
  }, 500);
}

/* — البحث بالصورة — */
function flowImage() {
  say(tr('أرفق صورة القطعة التي أعجبتك — سأحلل ألوانها وأقواسها وأقارنها <b>بكل منتجات المتجر فعلياً</b>، ثم أعرض الأقرب إليها. لن أخترع شيئاً خارج المتجر ✦',
    'Attach a photo and I will compare it against the entire real catalog and show the closest matches ✦'));
  const d = document.createElement('label');
  d.className = 'ai-drop';
  d.innerHTML = `<b>🖼 اختر صورة أو أسقطها هنا</b>JPG · PNG · حتى 10MB<input type="file" accept="image/*">`;
  thread().appendChild(d);
  const inp = d.querySelector('input');
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); });
  d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => {
    e.preventDefault(); d.classList.remove('over');
    if (e.dataTransfer.files[0]) { inp.files = e.dataTransfer.files; inp.dispatchEvent(new Event('change')); }
  });
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    echo(tr('📷 صورة مرفوعة للتحليل', '📷 Photo uploaded'));
    const holder = document.createElement('div');
    holder.style.alignSelf = 'stretch';
    const url = URL.createObjectURL(f);
    holder.innerHTML = `<div class="ai-msg ai" style="padding:8px"><img class="prev" src="${url}" style="max-width:140px;border-radius:12px;display:block"></div>`;
    thread().appendChild(holder);
    d.remove();
    imageSearch(f, holder);
    thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
  };
}

/* — التنبيهات — */
function flowNotifs() {
  const list = readNotifs();
  list.forEach(n => n.seen = true);
  writeLS('ai-notifs-1', list);
  badgeNotifs();
  if (!list.length) {
    say(tr('لا تنبيهات بعد ✦ عندما تنخفض أسعار مفضلتك، أو تعود قطعة نفدت، أو تصل قطعة تشبه ذوقك — ستجدني هنا أولاً. أضف قطعة لمفضلتك ♥ في الاستوديو لأراقبها لك.',
      'No alerts yet — favorite a piece in the studio and I will watch for price drops and restocks.'));
    return;
  }
  say(tr('<b>تنبيهاتك الذكية</b> — محسوبة من فروقات بيانات المتجر الفعلية:', '<b>Your smart alerts</b> — computed from real catalog changes:'));
  list.forEach(n => {
    const d = document.createElement('div');
    d.className = 'ai-notif-card' + (n.read ? '' : ' unread');
    const ago = Math.round((Date.now() - n.t) / 60000);
    d.innerHTML = `<span style="font-size:15px">${n.icon}</span><span>${esc(n.text)}</span><time>${ago < 60 ? ago + ' د' : Math.round(ago / 60) + ' س'}</time>`;
    thread().appendChild(d);
  });
  const wp = wishlistPicks();
  if (wp?.picks.length) {
    say(tr(`ولأنك تفضّل «${esc(displayName(wp.anchor))}» — هذه أقرب القطع إليها في المتجر الآن:`, `Because you favor “${esc(displayName(wp.anchor))}” — the closest live pieces:`));
    sayCards(wp.picks.map(p => ({ p })), () => 'يناسب ذوقك');
  }
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}

/* — إكمال إطلالة الاستوديو — */
function studioComplete() {
  const st = window.AlameaStudio;
  if (!st) return;
  const worn = st.state.worn || {};
  const wornItems = Object.keys(worn).map(c => st.state.products.find(p => String(p.id) === String(worn[c]))).filter(Boolean).map(p => ({ ...adapt(p), studioRef: p }));
  if (!wornItems.length) { say(tr('ألبِس قطعة أولاً على شخصيتك في الاستوديو — وسأكملها بما يليق من المتجر ✦', 'Wear a piece on your avatar first, and I will complete it ✦')); return; }
  const wornCats = new Set(wornItems.map(p => p.wearCat));
  const lib = catalog();
  const prio = [...new Set(wornItems.flatMap(p => COMPLEMENTS[p.wearCat] || []))].filter(c => !wornCats.has(c));
  const wornHues = wornItems.flatMap(p => p.colors.map(c => hexHsl(c.hex))).filter(x => x && x.s > .12).map(x => x.h);
  const sugg = [];
  prio.slice(0, 5).forEach(cat => {
    const opts = lib.filter(p => p.wearCat === cat && p.stock > 0);
    if (!opts.length) return;
    const best = [...opts].sort((a, b) => {
      const hd = p => { const hs = p.colors.map(c => hexHsl(c.hex)).filter(x => x && x.s > .12).map(x => x.h); return hs.length && wornHues.length ? Math.min(...hs.flatMap(h => wornHues.map(w => hueDist(h, w)))) : 180; };
      return hd(a) - hd(b);
    })[0];
    sugg.push({ p: best, cat });
  });
  say(tr(`إطلالتك الآن: ${wornItems.map(p => `«${esc(displayName(p))}»`).join(' + ')} —<br>من المتجر نفسه، هذه القطع تكملها بتناغم الألوان:`, `Worn now: ${wornItems.map(p => esc(displayName(p))).join(' + ')} — live pieces that complete it:`));
  if (!sugg.length) { say(tr('إطلالتك مكتملة الأركان من المتجر ✨ — أصفّق لذوقك.', 'Your outfit is already complete ✨')); return; }
  const d = document.createElement('div');
  d.className = 'ai-outfit';
  d.innerHTML = sugg.map(({ p, cat }) => `
    <div class="ai-piece">
      <img src="${p.img || p.detail}" alt="">
      <div>
        <div class="pc-t"><b>${esc(displayName(p))}</b><span class="num">${fmt(p.price)} ر.س</span></div>
        <div class="why">✦ أفضل ${WL[cat] || cat} تناغماً مع ألوانك الحالية · ${esc(p.stock <= 3 ? 'كمية محدودة' : 'متوفر الآن')}</div>
        <div class="alts"><button data-wear="${p.id}" ${p.studioRef ? '' : 'disabled'}>🧥 جرّبها</button><button data-bag="${p.id}">🛒 للسلة</button></div>
      </div>
    </div>`).join('');
  thread().appendChild(d);
  d.querySelectorAll('[data-wear]').forEach(b => b.onclick = () => {
    const sp = st.state.products.find(x => String(x.id) === b.dataset.wear);
    if (sp) { st.wear(sp); b.textContent = '✓ على شخصيتك'; }
  });
  d.querySelectorAll('[data-bag]').forEach(b => b.onclick = () => addAll({ pieces: [{ p: catalog().find(x => String(x.id) === b.dataset.bag) }], total: 0 }));
  chips([
    ['★ ' + tr('قيّم إطلالتي الحالية', 'Score my outfit'), () => showScore(scorePieces(wornItems.map(p => adapt(p))))],
    ['🛒 ' + tr('الإطلالة كلها للسلة', 'Whole outfit to cart'), () => addAll({ pieces: wornItems.map(p => ({ p })), total: 0 })]
  ]);
  thread().scrollTo({ top: thread().scrollHeight, behavior: 'smooth' });
}

/* ═══════════════ الموجّه الذكي ═══════════════ */
function route(q, inner) {
  const n = norm(q);
  track('ai_chat', { intent: 'auto' });
  if (WIZ.mode === 'phone' || WIZ.mode === 'loyalty') {
    const phone = (q.match(/[+\d][\d\s-]{6,}/) || [])[0];
    if (!phone) { say(tr('أدخل رقم جوال صحيحاً من 9 خانات فأكثر — مثال: 05xxxxxxxx', 'Please enter a valid phone number (9+ digits).')); return; }
    const m = WIZ.mode; WIZ.mode = null;
    if (m === 'loyalty') showLoyalty(phone); else showOrders(phone);
    return;
  }
  /* نوايا صريحة */
  if (/(قارن|مقارنه|الفرق بين|vs\b)/.test(n)) { flowCompare(); return; }
  if (/(مقاس|مقاسي|طولي|وزني|بالطول|بالوزن)/.test(n) && !toks(q).some(t => toks(JSON.stringify(LEX.colors)).includes(t))) { flowSize(); return; }
  if (/(ولاء|نقاط|نقاطي|مستواي|مستوى|مستوايا|عضويتي|عضويه|مكافآت|مكافأه|مكافات)/.test(n)) { askLoyalty(); return; }
  if (/(وين طلبي|طلبي|حاله الطلب|تتبع الطلب|شحنتي|وصّل|وصل)/.test(n) || /^(طلب|طلبات)/.test(n)) { askPhone(); return; }
  if (/(صوره|بالصوره|صورة|بصوره|ارفع صوره)/.test(n)) { flowImage(); return; }
  if (/(شحن|توصيل|يوصل|كلفه الشحن)/.test(n)) { say(supportAnswer('shipping')); return; }
  if (/(استرجاع|استبدال|ارجاع|ارجع|رجّع|رجع)/.test(n)) { say(supportAnswer('exchange')); return; }
  if (/(ضمان|اصاله|تقليد|اصليه)/.test(n)) { say(supportAnswer('warranty')); return; }
  if (/(دفع|مدى|بطاقه|فيزا|كاش|عند الاستلام)/.test(n)) { say(supportAnswer('payment')); return; }
  if (/(عرض|عروض|خصم|خصومات|كوبون|تخفيض)/.test(n)) { say(supportAnswer('offers')); return; }
  if (/(تواصل|خدمه العملاء|اتصل|رقمكم|واتس)/.test(n)) { say(supportAnswer('contact')); return; }
  if (/(تقييم|تقييمات|مراجعات|راي العملاء|اراء)/.test(n)) { reviewsChat(); return; }
  if (/(اكمل|كمّل|يكمل).*(اطلال|لبس)|(ما يناسب|ماذا يناسب|بم ينسجم)/.test(n) && IS_STUDIO) { studioComplete(); return; }
  if (/(قيّم|قيم).*(اطلال|لبس)|تقييم اطلالتي/.test(n)) {
    IS_STUDIO ? studioScoreNow() : say(tr('افتح الاستوديو وألبِس قطعك — ثم اطلب تقييم الإطلالة وسأقيّمها بالتفصيل ✦', 'Open the studio, wear your pieces, then ask me to score the outfit ✦'));
    return;
  }
  if (/(تنبيه|اشعار|اشعارات|مفضل|مفضله)/.test(n)) { flowNotifs(); return; }
  /* لاتيني غالب → إنجليزية */
  if (!inner && /[a-z]{3}/i.test(q) && !/[\u0600-\u06FF]/.test(q) && toks(q).length < 14 && !search(q).hits.length) {
    if (!EN()) $('#ai-lang')?.click();
  }
  /* ترحيب */
  if (/^(السلام|سلام|مرحبا|هلا|اهلا|هاي|صباح|مساء|hi|hello|hey)/.test(n)) {
    welcomeOnce(); return;
  }
  if (/(شكرا|يعطيك|تسلم|ممتاز|احسنت)/.test(n)) {
    say(tr('العفو — وجودي لخدمتك ✦ أخبرني إن احتجت إطلالة أخرى أو مقارنة أو تتبع طلب.', 'Always at your service ✦'));
    return;
  }
  if (/(اطلاله|إطلاله|البدني|البسني|فصّل لي|ماذا البس|كوّن لي|كمل اطلالتي)/.test(n)) { flowStylist(); return; }
  /* بحث منتجات */
  const { hits, parsed } = search(q);
  if (hits.length || parsed.wear.size || parsed.gift || parsed.budget) { smartSearch(q); return; }
  /* افتراضي */
  say(tr('لم أفهم مقصدك تماماً — هذه مجالات خبرتي، كلها من بيانات المتجر الحيّة:', 'I did not fully catch that — here is what I master, all over live store data:'));
  flowSupportChips();
}
function welcomeOnce() {
  say(tr('وعليكم السلام وأهلاً وسهلاً ✦ أنا خبير اللامع — كيف أخدمك اليوم؟', 'Hello and welcome ✦ I am your house expert — how may I serve you today?'));
  flowSupportChips();
}
function flowSupportChips() {
  chips([
    ['🛍 ' + tr('إطلالة كاملة', 'Full outfit'), flowStylist],
    ['⌕ ' + tr('بحث عن قطعة', 'Find a piece'), () => { say(tr('اكتب وصفك بحرية — «ثوب رسمي»، «هدية لوالدي بأقل من 800»…', 'Describe it freely — “formal thobe”, “gift under 800”…')); $('#ai-in').focus(); }],
    ['⚖ ' + tr('قارن منتجين', 'Compare two'), flowCompare],
    ['📦 ' + tr('أين طلبي؟', 'Where is my order?'), askPhone],
    ['🏷 ' + tr('العروض', 'Offers'), () => say(supportAnswer('offers'))]
  ]);
}
function studioScoreNow() {
  const st = window.AlameaStudio;
  const worn = Object.keys(st?.state.worn || {});
  if (!worn.length) { say(tr('لا تلبس شيئاً بعد — ألبِس قطعك في الاستوديو أولاً ✦', 'You are not wearing anything yet — wear pieces in the studio first ✦')); return; }
  const items = worn.map(c => st.state.products.find(p => String(p.id) === String(st.state.worn[c]))).filter(Boolean).map(adapt);
  showScore(scorePieces(items));
}
async function reviewsChat() {
  const lib = catalog();
  const lib2 = lib.filter(p => p.stock > 0).slice(0, 6);
  say(tr('اختر القطعة لألخّص لك آراء عملائها الحقيقية — المتوسط، نسبة الرضا، وأكثر الملاحظات تكراراً:', 'Pick a piece and I will summarize its real customer reviews:'));
  chips(lib2.map(p => [esc(displayName(p)), async () => {
    echo(displayName(p));
    typing(async () => {
      const rs = await fetchReviews(p.id);
      if (rs === null) { say(tr('التقييمات تحتاج تفعيل جدول reviews من schema.sql المحدّث — ثم تظهر هنا فوراً.', 'Reviews need the updated schema.sql — then they appear here instantly.')); return; }
      const s = summarizeReviews(rs);
      if (!s) { say(tr(`لا تقييمات بعد لـ«${esc(displayName(p))}» — كن أول من يقيّمها من صفحة المنتج ⭐`, `No reviews yet for “${esc(displayName(p))}”.`)); openProductById(p.id); return; }
      say(tr(`ملخّص ${s.count} ${s.count > 2 ? 'تقييمات' : 'تقييم'} حقيقية لـ«${esc(displayName(p))}»:
        <br>★ المتوسط <b class="num">${s.avg}/5</b> · رضا <b class="num">${s.sat}%</b>
        ${s.notes.length ? `<br>أكثر ما يُمدح: ${s.notes.map(([l]) => `<b>${l}</b>`).join('، ')}` : ''}`,
        `${s.count} reviews for “${esc(displayName(p))}”: avg <b>${s.avg}/5</b>, satisfaction ${s.sat}%.`));
      openProductById(p.id);
    }, 600);
  }]));
}

/* ═══════════════ الإقلاع ═══════════════ */
function boot() {
  if (IS_STUDIO && !window.AlameaStudio) { setTimeout(boot, 400); return; }
  shell();
  badgeNotifs();
  /* لا يغطي الزر العائم النوافذ المنبثقة (سلة، منتج، دفع) */
  const cover = () => {
    const blocked = !!document.querySelector('.overlay.show, .p-modal.open, .checkout.open, .success.open, .looks.open');
    $('#ai-fab')?.classList.toggle('cover', blocked);
    if (blocked) {
      $('#ai-panel')?.classList.remove('open');
      $('#ai-fab')?.classList.remove('hide');
    }
  };
  new MutationObserver(cover).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  /* في الاستوديو: زر المستشار القديم يفتح خبير اللامع الآن */
  if (IS_STUDIO) {
    const advBtn = $('#adv-open');
    if (advBtn) {
      advBtn.innerHTML = '✦ خبير اللامع AI™';
      advBtn.onclick = () => {
        $('#advisor')?.classList.remove('open');
        openPanel();
        chips([[tr('✦ أكمل إطلالتي الحالية', 'Complete my outfit'), studioComplete], ['★ ' + tr('قيّم إطلالتي', 'Score it'), studioScoreNow]]);
      };
    }
  }
  const snap = () => diffSnapshot();
  document.addEventListener('catalog:refresh', () => setTimeout(snap, 300));
  setTimeout(snap, 2500);
  if (IS_STUDIO) { const iv = setInterval(() => { if (window.AlameaStudio?.state.products.length) { clearInterval(iv); diffSnapshot(); } }, 1500); setTimeout(() => clearInterval(iv), 12000); }
  document.addEventListener('fav:change', e => {
    if (e.detail?.added && $('#ai-panel')?.classList.contains('open')) {
      const wp = wishlistPicks();
      if (wp?.picks.length) { say(tr(`أضفت «${esc(displayName(wp.anchor))}» لمفضلتك ♥ — سأراقب سعرها وتوفرها. ولأنها أعجبتك:`, `Noted ♥ I will watch its price and stock. Because you liked it:`)); sayCards(wp.picks.slice(0, 3).map(p => ({ p })), () => 'يناسب ذوقك'); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#ai-panel')?.classList.contains('open')) { $('#ai-panel').classList.remove('open'); $('#ai-fab')?.classList.remove('hide'); }
  });
  /* كشف صوتي من سياق صفحة المنتج حالياً */
  window.AlameaAI = { mountReviews, search, parseQuery, scorePieces, fetchReviews, summarizeReviews, open: openPanel, speak };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
