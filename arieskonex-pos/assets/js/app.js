// মল্লিক বুক হাউজ এন্ড কম্পিউটার — শেয়ার্ড জাভাস্ক্রিপ্ট

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
});

/* ---------------------------------------------------------------------
   ইনস্ট্যান্ট নেভিগেশন (PJAX)
   সাইডবার / বটম-ট্যাব / স্ট্যাট-কার্ড লিঙ্কে ক্লিক করলে পুরো পেজ রিলোড
   হয় না — নতুন পেজ ফেচ হয়ে <main> ও <title> সাথে সাথে বদলে যায়।
   ফলাফল: ক্লিক-থেকে-স্ক্রিন পরিবর্তন প্রায় তাৎক্ষণিক হয়।
   সতর্কতা: ক্যাশ ৩০ সেকেন্ডের জন্য রাখা হয় যাতে ডাটা অনেক পুরনো না হয়।
   POS (sales_pos.php) ও ফর্ম-সাবমিটগুলো স্বাভাবিক নেভিগেশনে থাকে।
   --------------------------------------------------------------------- */
function initInstantNav() {
    var loader = document.getElementById('pjaxLoader');
    var sidebar = document.querySelector('.sidebar');
    var backdrop = document.getElementById('sidebarBackdrop');
    var installBtn = document.getElementById('installAppBtn');
    var installPromptEvent = null;
    var hrefCache = {};
    var CACHE_TTL = 30000; // মিলিসেকেন্ডে

    function showLoader() {
        if (loader) {
            loader.classList.remove('done');
            loader.classList.add('loading');
        }
    }
    function doneLoader() {
        if (loader) {
            loader.classList.remove('loading');
            loader.classList.add('done');
            setTimeout(function () { loader.classList.remove('done'); }, 480);
        }
    }
    function cacheGet(url) {
        var entry = hrefCache[url];
        if (entry && Date.now() - entry.t < CACHE_TTL) return entry.html;
        delete hrefCache[url];
        return null;
    }

    document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        var a = e.target.closest('.sidebar-nav a.nav-link, .bottom-tabbar a, .stat-card-link, .brand-link');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' || href.indexOf('http') === 0 || href.indexOf('logout') !== -1) return;
        // POS পাতা (sales_pos.php) সবসময় স্বাভাবিক (পূর্ণ) নেভিগেশনে লোড হবে —
        // ইনস্ট্যান্ট-ন্যাভ দিয়ে লোড হলে scanInput-এ autofocus নির্ভরযোগ্যভাবে কাজ করে না
        // এবং পণ্যের তালিকা ৩০ সেকেন্ডের ক্যাশ থেকে পুরনো (স্টেল) হতে পারে —
        // ফলে বারকোড স্ক্যান করলে মাঝে মাঝে কার্টে যোগ হয় না।
        if (href.indexOf('sales_pos.php') !== -1) return;
        e.preventDefault();
        navigateTo(href);
        closeSidebar();
    });

    if (installBtn) {
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
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    });
    window.addEventListener('appinstalled', function () {
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
    }

    function navKeyFor(url) {
        var path = url.split('?')[0].split('#')[0].split('/').pop();
        if (path === 'sales_pos.php') return 'sales';
        if (path === 'sales_list.php') return 'sales_list';
        if (path === 'sales_return.php') return 'sales_return';
        if (path === 'customers.php') return 'customers';
        if (path === 'reports.php') return 'reports';
        if (path === 'dashboard.php') return 'dashboard';
        if (path === 'stock.php') return 'stock';
        if (path === 'purchase.php') return 'purchase';
        if (path === 'suppliers.php') return 'suppliers';
        if (path === 'users.php') return 'users';
        if (path === 'payment_api.php') return 'payment_api';
        if (path === 'backup.php') return 'backup';
        if (path === 'services.php') return 'services';
        return '';
    }

    // পাতা ফাইল → নেভ কী ম্যাপ (সাবস্ট্রিং গোলমাল এড়াতে সঠিক ফাইল ম্যাচ)
    var NAV_KEY_BY_FILE = {
        'dashboard.php': 'dashboard',
        'stock.php': 'stock',
        'purchase.php': 'purchase',
        'services.php': 'services',
        'sales_pos.php': 'sales',
        'sales_list.php': 'sales_list',
        'sales_return.php': 'sales_return',
        'customers.php': 'customers',
        'suppliers.php': 'suppliers',
        'reports.php': 'reports',
        'users.php': 'users',
        'payment_api.php': 'payment_api',
        'backup.php': 'backup'
    };

    function updateActiveNav(key) {
        document.querySelectorAll('.sidebar-nav a.nav-link, .bottom-tabbar a').forEach(function (a) {
            var href = a.getAttribute('href') || '';
            var file = href.split('?')[0].split('#')[0].split('/').pop();
            var match = key && NAV_KEY_BY_FILE[file] === key;
            a.classList.toggle('active', !!match);
        });
    }

    function navigateTo(url) {
        var cached = cacheGet(url);
        if (cached) {
            swapPages(cached, url);
            return;
        }
        showLoader();
        fetch(url, { headers: { 'X-Instant-Nav': '1' }, credentials: 'same-origin' })
            .then(function (res) { return res.text(); })
            .then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                if (!doc.querySelector('.content')) {
                    // সেশন শেষ হলে/login পেজ চলে এলে স্বাভাবik নেভিগেশনে ফিরে যাই
                    location.href = url;
                    return;
                }
                hrefCache[url] = { html: html, t: Date.now() };
                swapPages(html, url);
            })
            .catch(function () {
                location.href = url;
            });
    }

    function swapPages(html, url) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var main = doc.querySelector('.content');
        var newTitle = doc.querySelector('title');
        var oldMain = document.querySelector('.content');
        if (main && oldMain) {
            oldMain.replaceWith(main);
        }
        if (newTitle) {
            document.title = newTitle.textContent;
        }
        // গতিশীল স্ক্রিপ্ট পুনরায় চালু (চার্ট, POS ইত্যাদি)
        Array.prototype.slice.call(main ? main.querySelectorAll('script') : []).forEach(function (s) {
            var ns = document.createElement('script');
            if (s.src) { ns.src = s.src; }
            else { ns.textContent = s.textContent; }
            document.body.appendChild(ns);
            document.body.removeChild(ns);
        });
        // URL ব্যাক-বাটন সাপোর্টসহ হালনাগাদ
        if (url && location.href.split('#')[0] !== url.split('#')[0]) {
            history.pushState({ pjax: url }, '', url);
        }
        updateActiveNav(navKeyFor(url));
        bindPageBehaviors();
        doneLoader();
        window.scrollTo(0, 0);
    }

    // ব্রাউজারের ব্যাক/ফরোয়ার্ড — ক্যাশ থেকে তাৎক্ষণিক দেখাও, না হলে নেটওয়ার্ক
    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.pjax) {
            var cached = cacheGet(e.state.pjax);
            if (cached) { swapPages(cached, e.state.pjax); return; }
            navigateTo(e.state.pjax);
        } else {
            location.reload();
        }
    });

    function bindPageBehaviors() {
        document.querySelectorAll('.alert[data-autohide]').forEach(function (el) {
            setTimeout(function () {
                el.style.transition = 'opacity .4s ease';
                el.style.opacity = '0';
                setTimeout(function () { el.remove(); }, 400);
            }, 4000);
        });
        document.querySelectorAll('[data-confirm]').forEach(function (el) {
            if (el.dataset.bound === '1') return;
            el.dataset.bound = '1';
            el.addEventListener('click', function (e) {
                if (!confirm(el.getAttribute('data-confirm'))) {
                    e.preventDefault();
                }
            });
        });
    }

    if (installBtn) {
        installBtn.style.display = 'none';
    }
    updateActiveNav(navKeyFor(location.href));
}
