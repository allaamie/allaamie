#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
اللامع | AL LAMEA — خط معالجة الشعار الرسمي
═══════════════════════════════════════════════
يحوّل صورة الشعار الأصلية (ذهبي على خلفية سوداء) إلى الأصول اللازمة للموقع
دون أي تعديل على الرسم أو الألوان:

  1) assets/allamea-logo.png        → خلفية شفافة (الأسود يصبح قناة ألفا، اللون كما هو)
  2) assets/allamea-logo-mono.png   → نسخة أحادية اللون بالذهبي #B89146 (للفوتر والتغليف)
  3) assets/favicon.png             → أيقونة المتصفح

الاستخدام:
  python3 tools/prepare-logo.py [مسار_صورة_الشعار]

إن لم يُمرَّر مسار، يُبحث عن الملف في المواقع المعتادة للمرفقات.
"""
import sys, subprocess, os, glob

try:
    from PIL import Image, ImageChops
except ImportError:
    print("… تثبيت Pillow")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "pillow"])
    from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
GOLD_MONO = (184, 145, 70)          # #B89146 — الذهبي الأساسي للهوية
MAX_SIDE = 900                       # أقصى بعد للشعار المستخدم داخل الموقع

CANDIDATES = [
    "/home/user/uploads/3769C967-B8A9-4C58-9547-9CC83C1A49EB.png",
    "/home/user/uploads/*.png",
    os.path.join(ROOT, "assets", "_logo-source.png"),
    os.path.join(ROOT, "logo-source*.png"),
]

def find_source():
    for pat in CANDIDATES:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[0]
    sys.exit("لم يُعثر على صورة الشعار. مرّر مسارها: python3 tools/prepare-logo.py <path>")

def main():
    src_path = find_source()
    print(f"المصدر: {src_path}")
    src = Image.open(src_path).convert("RGB")

    # ألفا = أعلى قناة لونية → الأسود الخالص يصير شفافاً، ويحتفظ التوهج بلمعانه
    r, g, b = src.split()
    alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)

    # قصّ الهوامش السوداء مع مساحة تنفّس صغيرة
    bbox = alpha.point(lambda a: 255 if a > 6 else 0).getbbox()
    if bbox:
        pad = 14
        l, t, rr, bb = bbox
        l = max(0, l - pad); t = max(0, t - pad)
        rr = min(src.width, rr + pad); bb = min(src.height, bb + pad)
        src, alpha = src.crop((l, t, rr, bb)), alpha.crop((l, t, rr, bb))

    if max(src.size) > MAX_SIDE:
        scale = MAX_SIDE / max(src.size)
        size = (round(src.width * scale), round(src.height * scale))
        src, alpha = src.resize(size, Image.LANCZOS), alpha.resize(size, Image.LANCZOS)

    # 1) النسخة الشفافة — اللون الأصلي كما هو دون مساس
    logo = src.copy(); logo.putalpha(alpha)
    out1 = os.path.join(ASSETS, "allamea-logo.png"); logo.save(out1, optimize=True)

    # 2) النسخة أحادية اللون (ذهبي مصمت) بنفس قناة ألفا الأصلية
    mono = Image.new("RGB", src.size, GOLD_MONO)
    mono.putalpha(alpha)
    out2 = os.path.join(ASSETS, "allamea-logo-mono.png"); mono.save(out2, optimize=True)

    # 3) أيقونة المتصفح — مربعة مع هوامش متناسقة
    side = 256
    fav = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    inner = round(side * 0.82)
    thumb = logo.copy(); thumb.thumbnail((inner, inner), Image.LANCZOS)
    fav.paste(thumb, ((side - thumb.width) // 2, (side - thumb.height) // 2), thumb)
    out3 = os.path.join(ASSETS, "favicon.png"); fav.save(out3, optimize=True)

    for f in (out1, out2, out3):
        print("✓", f, Image.open(f).size)
    print("تم تجهيز الشعار — حدّث الصفحة لترى النتيجة.")

if __name__ == "__main__":
    main()
