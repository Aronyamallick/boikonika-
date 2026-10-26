/* Boikonika — small progressive enhancements. Every page also works without JavaScript. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var base = doc.getAttribute('data-base') || '';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // Theme: light / dark, remembered on this device.
  $all('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var current = doc.getAttribute('data-theme');
      if (!current) current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      doc.setAttribute('data-theme', next);
      try { localStorage.setItem('bk-theme', next); } catch (e) { /* private mode */ }
      btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
    });
  });

  // Mobile menu drawer.
  var drawer = $('#drawer');
  var lastFocus = null;
  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add('open');
    drawer.removeAttribute('hidden');
    var first = $('a, button', drawer.querySelector('.drawer-panel'));
    if (first) first.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  $all('[data-drawer-open]').forEach(function (b) { b.addEventListener('click', openDrawer); });
  $all('[data-drawer-close]').forEach(function (b) { b.addEventListener('click', closeDrawer); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (drawer && drawer.classList.contains('open')) closeDrawer();
      $all('details[open].user-menu').forEach(function (d) { d.removeAttribute('open'); });
    }
  });
  document.addEventListener('click', function (e) {
    $all('details[open].user-menu').forEach(function (d) { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });

  // Quantity steppers.
  $all('[data-qty]').forEach(function (wrap) {
    var input = $('input', wrap);
    $all('button[data-step]', wrap).forEach(function (b) {
      b.addEventListener('click', function () {
        var min = parseInt(input.min || '1', 10), max = parseInt(input.max || '99', 10);
        var v = (parseInt(input.value, 10) || min) + parseInt(b.getAttribute('data-step'), 10);
        input.value = String(Math.max(min, Math.min(max, v)));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
  $all('[data-autosubmit]').forEach(function (el) {
    el.addEventListener('change', function () { if (el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit(); });
  });

  // Show / hide password.
  $all('[data-toggle-password]').forEach(function (b) {
    b.addEventListener('click', function () {
      var input = document.getElementById(b.getAttribute('data-toggle-password'));
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.setAttribute('aria-pressed', show ? 'true' : 'false');
    });
  });

  // Ask before destructive actions.
  $all('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // Prevent double submits (orders, payments).
  $all('form[data-once]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (f.getAttribute('data-sent')) { e.preventDefault(); return; }
      f.setAttribute('data-sent', '1');
      $all('button[type=submit]', f).forEach(function (b) {
        b.setAttribute('aria-disabled', 'true');
        if (b.getAttribute('data-busy')) b.textContent = b.getAttribute('data-busy');
      });
    });
  });

  // Image previews for file inputs.
  $all('input[type=file][data-preview]').forEach(function (input) {
    input.addEventListener('change', function () {
      var target = document.getElementById(input.getAttribute('data-preview'));
      if (!target) return;
      target.innerHTML = '';
      Array.prototype.slice.call(input.files || [], 0, 8).forEach(function (file) {
        if (!/^image\//.test(file.type)) return;
        var img = document.createElement('img');
        img.className = 'preview-img';
        img.alt = '';
        img.src = URL.createObjectURL(file);
        target.appendChild(img);
      });
    });
  });

  // Add to cart without leaving the page.
  var toastTimer = null;
  function toast(html) {
    var t = $('#toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.innerHTML = html;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 5000);
  }
  $all('form[data-cart-form]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.fetch || e.submitter && e.submitter.name === 'buy_now') return;
      e.preventDefault();
      var btn = $('button[type=submit]', f);
      if (btn) btn.setAttribute('aria-disabled', 'true');
      fetch(f.action, { method: 'POST', body: new FormData(f), headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok) {
            $all('[data-cart-count]').forEach(function (el) {
              el.textContent = data.countLabel;
              el.hidden = data.count === 0;
            });
            $all('[data-cart-link]').forEach(function (el) { el.setAttribute('aria-label', data.ariaLabel); });
          }
          toast('<span></span>' + (data && data.ok ? ' <a href="' + base + data.cartPath + '"></a>' : ''));
          var t = $('#toast');
          t.firstChild.textContent = (data && data.message) || '';
          if (data && data.ok) t.querySelector('a').textContent = data.viewCart;
        })
        .catch(function () { f.submit(); })
        .then(function () { if (btn) btn.removeAttribute('aria-disabled'); });
    });
  });

  // Offline support (installable app).
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).catch(function () { /* optional */ });
    });
  }
})();
