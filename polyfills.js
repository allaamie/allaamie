/* ═══════════════════════════════════════════════════════════
   AL LAMEA | polyfills.js — حماية بيئية موحّدة
   يحقن قبل السكربتات الأخرى لتفادي crashes في بيئات محدودة.
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  // matchMedia — PWA + بعض المكونات
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {} }; };
  }
  // IntersectionObserver — تأثيرات الظهور والـ nav active
  if (typeof window.IntersectionObserver !== 'function') {
    window.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  }
  // ResizeObserver — بعض اللوحات
  if (typeof window.ResizeObserver !== 'function') {
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  }
  // requestIdleCallback
  if (typeof window.requestIdleCallback !== 'function') {
    window.requestIdleCallback = function (cb) { return setTimeout(function () { cb({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1); };
    window.cancelIdleCallback = function (id) { clearTimeout(id); };
  }
  // structuredClone (fallback)
  if (typeof window.structuredClone !== 'function') {
    window.structuredClone = function (v) { return JSON.parse(JSON.stringify(v)); };
  }
  // queueMicrotask
  if (typeof window.queueMicrotask !== 'function') {
    window.queueMicrotask = function (cb) { Promise.resolve().then(cb); };
  }
})();
