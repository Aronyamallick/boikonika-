/* মল্লিক বুক হাউজ এন্ড কম্পিউটার — সার্ভিস ওয়ার্কার
   উদ্দেশ্য: মোবাইলে "Add to Home Screen" ইনস্টলযোগ্যতা + স্ট্যাটিক অ্যাসেটের অফলাইন ক্যাশ।
   দোকানের হিসাব-নিকাশ সবসময় লাইভ/আপডেটেড দেখানোর জন্য পিএইচপি পাতাগুলো নেটওয়ার্ক-ফার্স্ট রাখা হয়েছে। */

const CACHE_NAME = 'mbh-cache-v2';
const STATIC_ASSETS = [
    'assets/css/style.css',
    'assets/js/app.js',
    'assets/img/icon-192.png',
    'assets/img/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname);

    if (isStaticAsset) {
        // স্ট্যাটিক অ্যাসেট: ক্যাশ-ফার্স্ট
        event.respondWith(
            caches.match(req).then((cached) => cached || fetch(req).then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                return res;
            }))
        );
    } else {
        // পিএইচপি/HTML পাতা: নেটওয়ার্ক-ফার্স্ট (লাইভ ডাটা), অফলাইনে সর্বশেষ ক্যাশড ভার্সন
        event.respondWith(
            fetch(req).then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
                return res;
            }).catch(() => caches.match(req))
        );
    }
});
