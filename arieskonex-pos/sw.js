/* Arieskonex POS — সার্ভিস ওয়ার্কার (Developed by Arieskonex Technologies)
   উদ্দেশ্য: মোবাইলে "Add to Home Screen" ইনস্টলযোগ্যতা + স্ট্যাটিক অ্যাসেটের দ্রুত লোড।

   আগের সংস্করণের সমস্যা ও সমাধান:
   - CSS/JS "ক্যাশ-ফার্স্ট" ছিল এবং কখনো হালনাগাদ হতো না — নতুন থিম/বাগ-ফিক্স ব্যবহারকারীর
     কাছে পৌঁছাত না। এখন stale-while-revalidate: ক্যাশ থেকে তাৎক্ষণিক দেখায়, পেছনে নতুন
     ভার্সন এনে রাখে। ফাইলের ?v= সংস্করণ বদলালে সাথে সাথে নতুন ফাইল লোড হয়।
   - লগইন করা প্রতিটি PHP পাতা (বিক্রয়, হিসাব) ক্যাশে জমা হতো — শেয়ার্ড ডিভাইসে গোপনীয়তার
     ঝুঁকি ও স্টোরেজ ভরে যাওয়া। এখন পাতাগুলো সবসময় সরাসরি নেটওয়ার্ক থেকে আসে, শুধু
     অফলাইনে একটি ছোট বার্তা দেখায়।
   - অন্য ডোমেইনের (CDN) রিকোয়েস্ট আর ইন্টারসেপ্ট করা হয় না। */

const CACHE_NAME = 'arieskonex-pos-v4';
const STATIC_ASSETS = [
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
        ).then(() => self.clients.claim())
    );
});

const OFFLINE_HTML = '<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>অফলাইন</title></head><body style="font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#F5F7FF;color:#1E1B4B;margin:0">'
    + '<div style="text-align:center;padding:30px"><h2>ইন্টারনেট সংযোগ নেই</h2><p>সংযোগ ফিরে এলে আবার চেষ্টা করুন।</p>'
    + '<button onclick="location.reload()" style="padding:10px 22px;border:0;border-radius:10px;background:linear-gradient(135deg,#4F46E5,#9333EA,#EC4899);color:#fff;font-size:15px">আবার চেষ্টা করুন</button></div></body></html>';

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // CDN ইত্যাদি ব্রাউজার নিজেই সামলাবে

    const isStaticAsset = /\.(css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname) && !/\/sw\.js$/.test(url.pathname);

    if (isStaticAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) =>
                cache.match(req).then((cached) => {
                    const network = fetch(req).then((res) => {
                        if (res && res.ok) cache.put(req, res.clone());
                        return res;
                    }).catch(() => cached);
                    return cached || network;
                })
            )
        );
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))
        );
    }
});
