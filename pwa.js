/* ══════════════════════════════════════════════════════════
   AL LAMEA PWA Layer™ — طبقة التطبيق التقدمي
   · تسجيل الـ Service Worker وتحديثه بسلاسة دون قطع تجربة العميل
   · لافتة تثبيت ذهبية لائقة (Android) + تلميح iOS لمرة واحدة
   · ترحيل طلبات Offline المؤجلة فور عودة الاتصال (Background Sync)
   ══════════════════════════════════════════════════════════ */
'use strict';
(() => {
  /* ── نخب عابر موحّد ─────────────────────────────── */
  const toast = m => {
    try {
      if (window.Alamea?.toast) return window.Alamea.toast(m);
      const t = document.getElementById('toast');
      if (t) { t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3200); }
    } catch (e) { }
  };

  /* ── Service Worker ─────────────────────────────── */
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
        /* تحديث جديد: نفعّله بهدوء ثم نحدّث الصفحة مرة واحدة */
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      }).catch(() => { /* التطبيق يعمل دون كاش */ });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return; reloading = true;
      toast('✦ نسخة أحدث من الدار جاهزة — نعيد التحميل');
      setTimeout(() => location.reload(), 900);
    });

    /* رسائل الـ SW: مزامنة الطلبات المؤجلة */
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'FLUSH_ORDERS') dispatchEvent(new Event('app:flushOrders'));
    });
  }

  /* عودة الاتصال = إرسال أي طلب مؤجل حتى بلا Background Sync */
  addEventListener('online', () => {
    dispatchEvent(new Event('app:flushOrders'));
    toast('✦ عاد الاتصال — يُزامَن كل مؤجل');
  });

  /* ── لافتة التثبيت (Android / Desktop Chrome) ──── */
  let deferred = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    const dismissed = +localStorage.getItem('ai-install-dismissed') || 0;
    if (Date.now() - dismissed < 7 * 864e5) return; // مرة كل ٧ أيام بحد أقصى
    deferred = e;
    setTimeout(showInstallBanner, 14000); // بعد أن يتذوق العميل التجربة
  });

  function showInstallBanner() {
    if (!deferred || document.getElementById('pwa-install')) return;
    const css = document.createElement('style');
    css.textContent = `
      #pwa-install{position:fixed;inset-inline:16px;bottom:18px;z-index:9999;display:flex;align-items:center;gap:13px;
        padding:15px 17px;border-radius:18px;border:1px solid rgba(184,145,70,.45);
        background:linear-gradient(150deg,rgba(28,26,20,.97),rgba(15,14,11,.97));backdrop-filter:blur(16px);
        box-shadow:0 24px 60px -18px rgba(0,0,0,.8),0 0 0 1px rgba(184,145,70,.08);
        animation:pwaIn .7s cubic-bezier(.2,.9,.25,1) both;font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif}
      @keyframes pwaIn{from{opacity:0;transform:translateY(24px) scale(.97)}to{opacity:1;transform:none}}
      #pwa-install .pw-badge{width:44px;height:44px;border-radius:13px;flex:none;display:grid;place-items:center;
        background:linear-gradient(140deg,#D6BE7A,#B89146 60%,#8C6B2F);color:#14100a;font-size:17px;font-weight:700}
      #pwa-install b{display:block;color:#FAFAFA;font-size:12.5px;line-height:1.5}
      #pwa-install small{display:block;color:#9A9A9A;font-size:10px;margin-top:3px;line-height:1.7}
      #pwa-install .pw-act{flex:none;display:flex;flex-direction:column;gap:7px;margin-inline-start:auto}
      #pwa-install .pw-do{padding:10px 20px;border-radius:12px;border:none;cursor:pointer;font-weight:700;font-size:11.5px;
        background:linear-gradient(120deg,#D6BE7A,#B89146 60%,#8C6B2F);color:#14100a;font-family:inherit}
      #pwa-install .pw-no{background:none;border:none;color:#8a8a86;font-size:9.5px;cursor:pointer;font-family:inherit}
      @media(max-width:560px){#pwa-install{inset-inline:10px}.pw-badge{display:none}}`;
    const el = document.createElement('div');
    el.id = 'pwa-install';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'تثبيت تطبيق اللامع');
    el.innerHTML = `<span class="pw-badge">لا</span>
      <div><b>ثبّت «اللامع» على جهازك</b><small>وصول أسرع كتطبيق مستقل · يعمل حتى مع انقطاع الاتصال</small></div>
      <div class="pw-act"><button class="pw-do" type="button">تثبيت التطبيق</button><button class="pw-no" type="button">ليس الآن</button></div>`;
    document.head.appendChild(css); document.body.appendChild(el);
    el.querySelector('.pw-do').onclick = async () => {
      el.remove();
      try { deferred.prompt(); await deferred.userChoice; } catch (e) { }
      deferred = null;
    };
    el.querySelector('.pw-no').onclick = () => {
      localStorage.setItem('ai-install-dismissed', String(Date.now()));
      el.remove();
    };
  }

  /* ── تلميح iOS Safari (لا يدعم beforeinstallprompt) ── */
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (ios && !standalone && !localStorage.getItem('ai-install-dismissed')) {
    setTimeout(() => {
      if (deferred || document.getElementById('pwa-install')) return;
      toast('✦ أضف اللامع لشاشتك الرئيسية من زر المشاركة في Safari');
      localStorage.setItem('ai-install-dismissed', String(Date.now()));
    }, 20000);
  }
})();
