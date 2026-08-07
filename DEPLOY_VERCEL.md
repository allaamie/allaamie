# النشر على Vercel — اللامع | AL LAMEA

تم تجهيز المشروع للنشر على Vercel. اختر إحدى الطرق التالية:

---

## الطريقة ①: عبر موقع Vercel (الأسهل) ⭐

1. افتح https://vercel.com/new
2. اختر المستودع: **allaamie/allaamie**
3. Branch: `arena/019fd9fd-allaamie` (أو أنشئ PR أولاً ثم اختر main)
4. Vercel سيكتشف تلقائياً أنه موقع ثابت — اضغط **Deploy**
5. خلال ثوانٍ ستحصل على رابط مثل: `https://allaamie-store.vercel.app`

> **مهم**: لا حاجة لإعدادات إضافية. ملف `vercel.json` يحدد rewrites و headers.

---

## الطريقة ②: عبر Vercel CLI (يحتاج توكن)

إذا عندك توكن Vercel، شغّل:

```bash
# 1. ثبّت Vercel CLI (مرة واحدة)
npm i -g vercel

# 2. صدّر التوكن
export VERCEL_TOKEN="<your-token-here>"

# 3. انشر
cd /path/to/allaamie
vercel --prod --yes
```

للحصول على توكن: https://vercel.com/account/tokens

---

## الإعدادات المطبّقة (vercel.json)

- **clean URLs**: `/admin` بدل `/admin.html`، `/studio` بدل `/studio.html`، إلخ
- **Cache headers**: سنة كاملة للأصول الثابتة (CSS/JS/صور)، `must-revalidate` لـ service worker
- **Security headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- **Rewrites**: روابط نظيفة للوحات الإدارة والاستوديو

---

## النطاق المخصّص (اختياري)

بعد النشر، من لوحة Vercel → Settings → Domains، أضف نطاقك (مثل `allamea.com`).
سيُولِّد Vercel شهادة SSL مجانية تلقائياً.

---

## النشر المستمر (CI/CD)

بمجرد ربط المستودع بـ Vercel، كل `git push` على الفرع `main` سيُنشِر تلقائياً.
الفرع الحالي `arena/019fd9fd-allaamie` سيُنشِر **Preview deployment**.
