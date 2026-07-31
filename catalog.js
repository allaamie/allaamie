/* ══════════════════════════════════════════════════
   اللامع | AL LAMEA — الكتالوج الموحد
   المصدر المحلي للمنتجات: يخدم المتجر والاستوديو معاً.
   عند تفعيل Supabase تُعرض منتجات قاعدة البيانات بدلاً منه تلقائياً.
   ══════════════════════════════════════════════════ */
'use strict';
window.ALLAMEA_CATALOG = [
  {
    id: 'thobe', name: 'ثوب اللامع المصقول', cat: 'الثياب', price: 495, old: null, badge: 'new',
    img: 'assets/p-thobe.jpg', detail: 'assets/detail-cotton.jpg',
    desc: 'ثوبٌ عاجي بقصّة معاصرة منحوتة، من قطن سويسري فئة النخبة. ياقة وأكمام مُشغولة يدوياً، وأزرار من الصدف الطبيعي.',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'عاجي ملكي', hex: '#efe9da' }, { name: 'أبيض نقي', hex: '#f8f7f4' }],
    materials: ['قطن سويسري 100% — فئة النخبة', 'أزرار صدفية طبيعية', 'خياطة يدوية عند الياقة والأساور', 'قصّة الدار الخاصة بكتفٍ منحوت'],
    care: ['تنظيف جاف فقط', 'كيّ على حرارة منخفضة', 'يُخزن على علاقة مبطنة'],
    tryon: true, wearCat: 'thobe', layer: 10, stock: 14
  },
  {
    id: 'mishlah', name: 'مشلح الحضرة', cat: 'المشلحات', price: 1450, old: null, badge: 'limited',
    img: 'assets/p-mishlah.jpg', detail: 'assets/detail-gold.jpg',
    desc: 'مشلح أسود من صوف بريطاني فاخر، تُزيّنه حوافّ مطرزة بخيوط معدنية مطلية بالذهب تُطرَّز يدوياً خلال ٢٤ ساعة عمل.',
    sizes: ['52', '54', '56', '58'],
    colors: [{ name: 'أسود فحمي', hex: '#141311' }, { name: 'زيتي داكن', hex: '#232b24' }],
    materials: ['صوف بريطاني فاخر', 'تطريز يدوي بخيوط معدنية مطلية بالذهب', 'بطانة حريرية ناعمة'],
    care: ['تنظيف جاف حصري', 'يُحفظ في غلاف الدار القطني', 'يُبعد عن الرطوبة'],
    tryon: true, wearCat: 'shamzan', layer: 30, stock: 4
  },
  {
    id: 'vest', name: 'صديري الميراث', cat: 'الصدريات', price: 525, old: 690, badge: 'sale',
    img: 'assets/p-vest.jpg', detail: 'assets/detail-gold.jpg',
    desc: 'صديري فحمي بتطريز هندسي برونزي مستوحى من زخارف صنعاء القديمة، يُلبس فوق الثوب ليكتمل الحضور.',
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [{ name: 'فحمي', hex: '#2b2a27' }, { name: 'رملي', hex: '#a89a80' }],
    materials: ['صوف معاد غزله بكثافة عالية', 'تطريز يدوي بخيوط برونزية', 'أزرار نحاسية محفورة'],
    care: ['تنظيف جاف فقط', 'لا يُعصر', 'كيّ من الداخل'],
    tryon: true, wearCat: 'vest', layer: 40, stock: 9
  },
  {
    id: 'shawl', name: 'شال المساء', cat: 'الشالات', price: 385, old: null, badge: null,
    img: 'assets/p-shawl.jpg', detail: 'assets/detail-cotton.jpg',
    desc: 'شال عاجي منسوج يدوياً بخطوط زيتية ولمعة ذهبية خفيفة، بحوافّ مسدّلة تمنح الكتف وقاراً هادئاً.',
    sizes: ['مقاس واحد'],
    colors: [{ name: 'عاجي بخطوط زيتية', hex: '#ded6bf' }, { name: 'عسلي', hex: '#cbb27e' }],
    materials: ['قطن يمني منسوج يدوياً', 'خيوط لامعة خفيفة', 'حواف مسدلة بطول ٤ سم'],
    care: ['غسيل يدوي بارد', 'تجفيف أفقي بالظل', 'يُلفّ ولا يُطوى'],
    tryon: true, wearCat: 'shemagh', layer: 80, stock: 11
  },
  {
    id: 'accessory', name: 'طقم الحضور الملكي', cat: 'الإكسسوارات', price: 640, old: null, badge: 'limited',
    img: 'assets/p-accessory.jpg', detail: 'assets/detail-gold.jpg',
    desc: 'حزام جلد طبيعي بإبزيم نحاسي محفور، مع مسبحة كهرمان بشرّابة ذهبية — اللمسة الأخيرة قبل مغادرة المجلس.',
    sizes: ['مقاس واحد'],
    colors: [{ name: 'عنبري', hex: '#7a5426' }, { name: 'أسود', hex: '#1a1917' }],
    materials: ['جلد إيطالي مدبوغ نباتياً', 'إبزيم نحاسي محفور يدوياً', 'كهرمان طبيعي معتمد'],
    care: ['يُمسح بقماش ناعم', 'يُدهن الجلد دورياً', 'يُبعد عن العطور مباشرة'],
    tryon: true, wearCat: 'belt', layer: 50, stock: 6
  }
];

/* أسماء فئات اللبس وترتيب عرضها (تبويبات الاستوديو) */
window.ALLAMEA_WEAR = {
  labels: {
    thobe: 'الثياب', maawaz: 'المعاوز', shamzan: 'الشمزان', vest: 'الصديري',
    belt: 'الأحزمة', jambiya: 'الجنابي', turban: 'العمائم', shemagh: 'الشماغ',
    shoes: 'الأحذية', watch: 'الساعات', perfume: 'العطور', accessories: 'الإكسسوارات'
  },
  order: ['maawaz', 'thobe', 'shamzan', 'vest', 'belt', 'jambiya', 'turban', 'shemagh', 'shoes', 'watch', 'accessories', 'perfume'],
  /* القيمة: [الاسم في المتغير الافتراضي, ترتيب الطبقة الافتراضي] */
  defaults: { thobe: 10, maawaz: 20, shamzan: 30, vest: 40, belt: 50, jambiya: 60, accessories: 70, turban: 80, shemagh: 80, watch: 90, shoes: 100, perfume: 5 }
};
