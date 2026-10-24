// Arieskonex POS — শেয়ার্ড জাভাস্ক্রিপ্ট (Developed by Arieskonex Technologies)

if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        var swUrl = (window.APP_BASE_URL || '') + '/sw.js';
        var swScope = (window.APP_BASE_URL || '') + '/';
        navigator.serviceWorker.register(swUrl, { scope: swScope }).catch(function () {
            // সার্ভিস ওয়ার্কার রেজিস্ট্রেশন ব্যর্থ হলেও অ্যাপ স্বাভাবিকভাবে চলবে
        });
    });
}

function bdMoney(n) {
    return Number(n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------------
   বারকোড/সার্চ ইনপুট সুরক্ষা
   কিছু মোবাইল কীবোর্ড (Gboard ইত্যাদি) পেজের ভাষা বাংলা দেখে নিজে থেকে
   বাংলা লেআউটে সুইচ করে ফেলে, ফলে বারকোড স্ক্যান করলে ০-৯ এর বদলে
   ০১২৩৪৫৬৭৮৯ (বাংলা অঙ্ক) টাইপ হয়ে যেতে পারে এবং বারকোড মিলে না।
   এই ফাংশনটি যেকোনো বাংলা অঙ্ককে ইংরেজি অঙ্কে রূপান্তর করে, তাই
   বারকোড মিলানো সবসময় নির্ভরযোগ্যভাবে কাজ করবে, কীবোর্ড যা-ই হোক না কেন।
   --------------------------------------------------------------------- */
var BN_DIGIT_MAP = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
function toEnglishDigits(str) {
    if (!str) return str;
    return String(str).replace(/[০-৯]/g, function (d) { return BN_DIGIT_MAP[d] || d; });
}
/* ইনপুট ফিল্ডে বসিয়ে দিলে: টাইপ করার সাথে সাথেই বাংলা অঙ্ক ইংরেজিতে বদলে যায়,
   এবং ফিল্ডটি যতটা সম্ভব ইংরেজি/ল্যাটিন কীবোর্ডে থাকার ইঙ্গিত দেয়। */
function hardenScanInput(el) {
    if (!el || el.dataset.hardened) return;
    el.dataset.hardened = '1';
    el.setAttribute('lang', 'en');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('spellcheck', 'false');
    el.addEventListener('input', function () {
        var converted = toEnglishDigits(this.value);
        if (converted !== this.value) {
            var pos = this.selectionStart;
            this.value = converted;
            if (pos !== null) { try { this.setSelectionRange(pos, pos); } catch (e) {} }
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // মোবাইলে সাইডবার টগল
    var toggleBtn = document.querySelector('.sidebar-toggle-btn');
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', function () {
            sidebar.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('open', sidebar.classList.contains('open'));
        });
        if (backdrop) {
            backdrop.addEventListener('click', function () {
                sidebar.classList.remove('open');
                backdrop.classList.remove('open');
            });
        }
        document.addEventListener('click', function (e) {
            if (window.innerWidth <= 900 && sidebar.classList.contains('open')
                && !sidebar.contains(e.target) && e.target !== toggleBtn) {
                sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('open');
            }
        });
    }

    // ফ্ল্যাশ মেসেজ কিছুক্ষণ পর নিজে থেকে মিলিয়ে যাবে
    document.querySelectorAll('.alert[data-autohide]').forEach(function (el) {
        setTimeout(function () {
            el.style.transition = 'opacity .4s ease';
            el.style.opacity = '0';
            setTimeout(function () { el.remove(); }, 400);
        }, 4000);
    });

    // ডিলিট বাটনে কনফার্মেশন
    document.querySelectorAll('[data-confirm]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            if (!confirm(el.getAttribute('data-confirm'))) {
                e.preventDefault();
            }
        });
    });

    initInstantNav();
    initGlobalScanner();
});

/* ---------------------------------------------------------------------
   শেয়ার্ড হেল্পার
   --------------------------------------------------------------------- */
function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* স্ক্যানারের একটি কী-প্রেস থেকে আসল অক্ষর বের করা।
   কম্পিউটারের কীবোর্ড লেআউট বাংলা থাকলে স্ক্যানারের "1" হয়ে যায় "১", "P" হয়ে যায় "প" —
   তখন বারকোড মেলে না। তাই ফিজিক্যাল কী (e.code: Digit1, KeyP ...) থেকে ইংরেজি অক্ষর নেওয়া হয়,
   আর বাংলা অঙ্ক ইংরেজিতে রূপান্তর করা হয়। প্রিন্টযোগ্য অক্ষর না হলে null। */
function scanCharFromEvent(e) {
    var k = e.key || '';
    if (k.length === 1 && k.charCodeAt(0) < 128) return k;
    var c = e.code || '', m;
    if ((m = /^(?:Digit|Numpad)(\d)$/.exec(c))) return m[1];
    if ((m = /^Key([A-Z])$/.exec(c))) return e.shiftKey ? m[1] : m[1].toLowerCase();
    if (k.length === 1) return toEnglishDigits(k);
    return null;
}

/* ছোট টোস্ট নোটিফিকেশন (POS স্ক্যান ফিডব্যাক ইত্যাদি) — type: success | warning | danger */
function appToast(msg, type) {
    var wrap = document.getElementById('appToastWrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'appToastWrap';
        wrap.className = 'pos-toast-wrap';
        wrap.setAttribute('aria-live', 'polite');
        document.body.appendChild(wrap);
    }
    var el = document.createElement('div');
    el.className = 'pos-toast ' + (type || 'success');
    el.innerHTML = '<i class="bi ' + (type === 'danger' ? 'bi-x-octagon-fill' : type === 'warning' ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill') + '"></i><span></span>';
    el.querySelector('span').textContent = msg;
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
    setTimeout(function () {
        el.classList.add('out');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, type === 'danger' ? 3200 : 1800);
}

/* পাতায় কোনো ফর্মে অসংরক্ষিত পরিবর্তন আছে কিনা (তাহলে স্ক্যানে অন্য পাতায় চলে যাওয়া হবে না) */
function pageHasUnsavedInput() {
    var els = document.querySelectorAll('.content input, .content textarea, .content select');
    for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.disabled || el.type === 'hidden' || el.type === 'submit' || el.type === 'button') continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked !== el.defaultChecked) return true;
        } else if (el.tagName === 'SELECT') {
            // কোনো অপশনে selected অ্যাট্রিবিউট না থাকলে ব্রাউজার নিজে প্রথমটি বাছাই করে — সেটিই ডিফল্ট
            var hasDefault = false, j;
            for (j = 0; j < el.options.length; j++) { if (el.options[j].defaultSelected) { hasDefault = true; break; } }
            for (j = 0; j < el.options.length; j++) {
                var def = hasDefault ? el.options[j].defaultSelected : (j === 0 && !el.multiple && el.size <= 1);
                if (el.options[j].selected !== def) return true;
            }
        } else if (el.value !== el.defaultValue) {
            return true;
        }
    }
    return false;
}

/* ---------------------------------------------------------------------
   গ্লোবাল বারকোড স্ক্যানার
   POS পাতার বাইরে (ড্যাশবোর্ড, ইনভয়েস, তালিকা ইত্যাদি) থাকা অবস্থায় বারকোড স্ক্যান
   করলে সরাসরি POS পাতা খোলে এবং স্ক্যান করা পণ্য/সার্ভিসটি কার্টে যুক্ত হয়ে যায়।
   হার্ডওয়্যার স্ক্যানার খুব দ্রুত (প্রতি অক্ষরে ~১০-৩০ms) টাইপ করে শেষে Enter পাঠায় —
   সেই প্যাটার্ন দেখেই স্ক্যান চেনা হয়, তাই মানুষের সাধারণ টাইপিং-এ এটি ট্রিগার হয় না।
   সুরক্ষা: কোনো ইনপুটে টাইপ চলাকালীন (যেমন ক্রয়ে পণ্য খোঁজা), খোলা মডালে, বা পাতায়
   অসংরক্ষিত ফর্ম থাকলে অন্য পাতায় যাওয়া হয় না — শুধু একটি বার্তা দেখায়।
   --------------------------------------------------------------------- */
function initGlobalScanner() {
    if (!window.APP_SCAN_TO_POS) return;
    if (document.body.classList.contains('page-pos')) return; // POS-এর নিজস্ব স্ক্যানার আছে
    var MAX_GAP = 50, MIN_LEN = 3;
    var buf = '', start = 0, last = 0, origin = null;
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
        var now = performance.now();
        if (e.key === 'Enter' || e.key === 'Tab') {
            var avg = buf.length > 1 ? (last - start) / (buf.length - 1) : Infinity;
            var isScan = buf.length >= MIN_LEN && (now - last) < 120 && avg < MAX_GAP;
            var fromInput = origin && origin.matches && origin.matches('input, textarea, select, [contenteditable]');
            var code = buf.trim();
            buf = ''; start = 0; last = 0; origin = null;
            // কোনো ইনপুটে স্ক্যান হলে সেই পাতার নিজস্ব লজিক কাজ করুক (যেমন ক্রয়ে পণ্য যোগ)
            if (!isScan || fromInput || !code) return;
            e.preventDefault();
            e.stopPropagation();
            if (document.querySelector('.modal.show') || pageHasUnsavedInput()) {
                appToast('স্ক্যান: ' + code + ' — এই পাতায় অসংরক্ষিত তথ্য আছে। বিক্রয়ের জন্য আগে POS খুলুন।', 'warning');
                return;
            }
            var loader = document.getElementById('pjaxLoader');
            if (loader) loader.classList.add('loading');
            location.href = (window.APP_BASE_URL || '') + '/modules/sales_pos.php?scan=' + encodeURIComponent(code);
            return;
        }
        var ch = scanCharFromEvent(e);
        if (ch === null) return; // Shift ইত্যাদি বাফার ভাঙে না
        if (now - last > MAX_GAP * 2 || !buf) { buf = ''; start = now; origin = e.target; }
        buf += ch;
        last = now;
    }, true);
}

/* ---------------------------------------------------------------------
   নেভিগেশন ফিডব্যাক ও অ্যাপ ইনস্টল
   আগে এখানে PJAX (fetch করে <main> বদলানো) ব্যবহৃত হতো। কিন্তু প্রায় প্রতিটি পাতার
   নিজস্ব ইনলাইন স্ক্রিপ্ট আছে — সেগুলো গ্লোবাল স্কোপে বারবার চালানোয় `const` ঘোষণা
   সংঘর্ষ (SyntaxError), Chart.js/QR লাইব্রেরি লোডের আগে কোড চলা, এবং ইভেন্ট লিসেনার
   জমে যাওয়ার মতো সমস্যা হতো — পাতা "ফ্রিজ" হয়ে যেত, রিলোড করলে আবার ঠিক হতো।
   এখন স্বাভাবিক (নির্ভরযোগ্য) নেভিগেশন হয়, আর ক্লিকের সাথে সাথে উপরে একটি লোডিং বার
   দেখায় যাতে ব্যবহারকারী তাৎক্ষণিক ফিডব্যাক পান।
   --------------------------------------------------------------------- */
function initInstantNav() {
    var loader = document.getElementById('pjaxLoader');
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    var installBtn = document.getElementById('installAppBtn');
    var installPromptEvent = null;

    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        var a = e.target.closest('.sidebar-nav a.nav-link, .bottom-tabbar a, .stat-card-link, .brand-link');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' || a.target === '_blank') return;
        if (loader) { loader.classList.remove('done'); loader.classList.add('loading'); }
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    });
    // ব্যাক-বাটনে ব্রাউজার ক্যাশ থেকে ফিরলে লোডার বন্ধ
    window.addEventListener('pageshow', function () {
        if (loader) loader.classList.remove('loading', 'done');
    });

    if (installBtn) {
        installBtn.style.display = 'none';
        installBtn.addEventListener('click', function () {
            if (!installPromptEvent) return;
            installPromptEvent.prompt();
            installPromptEvent.userChoice.then(function () {
                installPromptEvent = null;
                installBtn.style.display = 'none';
            });
        });
    }
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        installPromptEvent = e;
        if (installBtn) installBtn.style.display = 'inline-flex';
    });
    window.addEventListener('appinstalled', function () {
        if (installBtn) installBtn.style.display = 'none';
    });
}
