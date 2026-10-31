// Load smoke test for the busiest public API endpoints: many readers browsing at once.
// Usage: E2E_API_URL=http://localhost:4000 LOAD_CONCURRENCY=25 LOAD_SECONDS=20 node load/smoke.mjs
// Fails (exit 1) when more than 1% of requests error or p95 latency exceeds LOAD_P95_MS.
// Every simulated reader shares this machine's IP, so run it against an API started with a raised
// RATE_LIMIT_MAX (e.g. 1000000) — otherwise the per-IP limit (120/min) answers 429, as it should.
const API = (process.env.E2E_API_URL ?? 'http://localhost:4000').replace(/\/$/, '') + '/api/v1';
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 25);
const SECONDS = Number(process.env.LOAD_SECONDS ?? 20);
const P95_LIMIT = Number(process.env.LOAD_P95_MS ?? 800);
const headers = { Accept: 'application/json', 'Accept-Language': 'bn', 'X-Requested-With': 'boikonika' };

const get = async (path) => {
  const res = await fetch(API + path, { headers });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()).data;
};

const books = (await get('/books?sort=popular&pageSize=20')).map((b) => b.slug);
if (!books.length) throw new Error('No books: seed the demo catalogue first.');
const queries = ['বই', 'রবীন্দ্রনাথ', 'উপন্যাস', 'physics', 'কবিতা', 'history'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// A reader's mix: home page, lists, a search, a book page, the feed.
const routes = [
  ['home', () => '/home'],
  ['books', () => `/books?sort=${pick(['popular', 'newest', 'rating'])}&page=${1 + Math.floor(Math.random() * 3)}`],
  ['search', () => `/search?q=${encodeURIComponent(pick(queries))}`],
  ['book', () => `/books/${encodeURIComponent(pick(books))}`],
  ['feed', () => '/feed?tab=latest'],
  ['categories', () => '/categories?for=book'],
];

const stats = Object.fromEntries(routes.map(([name]) => [name, { times: [], errors: 0 }]));
const until = Date.now() + SECONDS * 1000;
async function reader() {
  while (Date.now() < until) {
    const [name, path] = pick(routes);
    const started = performance.now();
    try {
      const res = await fetch(API + path(), { headers });
      await res.arrayBuffer();
      if (!res.ok) throw new Error(String(res.status));
      stats[name].times.push(performance.now() - started);
    } catch {
      stats[name].errors++;
    }
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, reader));
const elapsed = (Date.now() - t0) / 1000;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
let total = 0, errors = 0;
const all = [];
console.log(`${CONCURRENCY} concurrent readers for ${SECONDS}s against ${API}\n`);
console.log('route        requests  errors    p50     p95     p99 (ms)');
for (const [name, s] of Object.entries(stats)) {
  const sorted = s.times.sort((a, b) => a - b);
  all.push(...sorted);
  total += sorted.length + s.errors;
  errors += s.errors;
  console.log(`${name.padEnd(12)} ${String(sorted.length).padStart(8)} ${String(s.errors).padStart(7)} ${pct(sorted, 50).toFixed(0).padStart(6)} ${pct(sorted, 95).toFixed(0).padStart(7)} ${pct(sorted, 99).toFixed(0).padStart(7)}`);
}
all.sort((a, b) => a - b);
const p95 = pct(all, 95);
console.log(`\ntotal ${total} requests, ${(total / elapsed).toFixed(0)} req/s, ${errors} errors, p95 ${p95.toFixed(0)} ms`);
if (errors / Math.max(total, 1) > 0.01 || p95 > P95_LIMIT) {
  console.error(`FAILED: error rate ${((errors / Math.max(total, 1)) * 100).toFixed(2)}% (max 1%), p95 ${p95.toFixed(0)} ms (max ${P95_LIMIT} ms)`);
  process.exit(1);
}
