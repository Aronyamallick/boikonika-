<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Markdown;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;
use App\Core\Validator;
use App\Services\Notify;

final class PageController
{
    public function show(Request $req, string $slug): Response
    {
        $page = DB::one('SELECT * FROM pages WHERE slug = ? AND is_published = 1', [$slug]) ?? throw new HttpException(404);
        $body = lf($page, 'body');
        return view('pages/show', [
            'title' => lf($page, 'title'),
            'page' => $page,
            'body' => Markdown::render($body),
            'description' => Markdown::plain($body),
        ]);
    }

    public function contact(Request $req): Response
    {
        return view('pages/contact', ['title' => t('contact.title'), 'user' => Auth::user(), 'orderRef' => mb_substr($req->query('order'), 0, 30)]);
    }

    public function sendContact(Request $req): Response
    {
        RateLimit::enforce('contact:' . $req->ip(), 5, 3600);
        $data = $req->only(['name', 'email', 'phone', 'topic', 'subject', 'message', 'website']);
        // Bots fill in the hidden "website" field.
        if (($data['website'] ?? '') !== '') {
            return redirect(url('contact'))->with('success', t('contact.sent'));
        }
        $errors = Validator::make($data, [
            'name' => 'required|max:120',
            'email' => 'required|email',
            'phone' => 'nullable|phone',
            'topic' => 'required|in:order,seller,account,copyright,other',
            'subject' => 'required|min:3|max:160',
            'message' => 'required|min:10|max:5000',
        ]);
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        DB::insert('contact_messages', [
            'user_id' => Auth::id(),
            'name' => $data['name'],
            'email' => mb_strtolower($data['email']),
            'phone' => $data['phone'] ? Validator::phone($data['phone']) : null,
            'topic' => $data['topic'],
            'subject' => $data['subject'],
            'message' => $data['message'],
            'ip' => $req->ip(),
            'created_at' => DB::now(),
        ]);
        Notify::staff('messages.manage', 'staffContact', ['subject' => mb_substr($data['subject'], 0, 80)], 'admin/messages');
        return redirect(url('contact'))->with('success', t('contact.sent'));
    }

    public function sitemap(Request $req): Response
    {
        $cache = BK_STORAGE . '/cache/sitemap.xml';
        if (is_file($cache) && filemtime($cache) > time() - 3600) {
            return new Response((string) file_get_contents($cache), 200, ['Content-Type' => 'application/xml; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']);
        }
        $urls = [['', null], ['books', null], ['products', null], ['categories', null], ['authors', null], ['publishers', null], ['sell', null], ['contact', null]];
        foreach (DB::all('SELECT slug FROM categories WHERE is_active = 1') as $c) {
            $urls[] = ['categories/' . $c['slug'], null];
        }
        foreach (DB::all("SELECT slug, type, updated_at FROM products WHERE status = 'active' AND offer_count > 0 ORDER BY id DESC LIMIT 20000") as $p) {
            $urls[] = [($p['type'] === 'general' ? 'products/' : 'books/') . $p['slug'], $p['updated_at']];
        }
        foreach (DB::all("SELECT a.slug FROM authors a WHERE EXISTS (SELECT 1 FROM product_authors pa JOIN products p ON p.id = pa.product_id WHERE pa.author_id = a.id AND p.status = 'active') LIMIT 5000") as $a) {
            $urls[] = ['authors/' . $a['slug'], null];
        }
        foreach (DB::all("SELECT slug FROM publishers p WHERE EXISTS (SELECT 1 FROM products x WHERE x.publisher_id = p.id AND x.status = 'active') LIMIT 5000") as $p) {
            $urls[] = ['publishers/' . $p['slug'], null];
        }
        foreach (DB::all("SELECT slug FROM sellers WHERE status = 'approved'") as $s) {
            $urls[] = ['stores/' . $s['slug'], null];
        }
        foreach (DB::all('SELECT slug, updated_at FROM pages WHERE is_published = 1') as $p) {
            $urls[] = ['pages/' . $p['slug'], $p['updated_at']];
        }
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' . "\n";
        foreach ($urls as [$path, $mod]) {
            $bn = abs_url($path, [], 'bn');
            $en = abs_url($path, [], 'en');
            foreach ([$bn, $en] as $loc) {
                $xml .= '<url><loc>' . htmlspecialchars($loc, ENT_XML1) . '</loc>'
                    . '<xhtml:link rel="alternate" hreflang="bn" href="' . htmlspecialchars($bn, ENT_XML1) . '"/>'
                    . '<xhtml:link rel="alternate" hreflang="en" href="' . htmlspecialchars($en, ENT_XML1) . '"/>'
                    . ($mod ? '<lastmod>' . date('Y-m-d', (int) strtotime($mod)) . '</lastmod>' : '') . "</url>\n";
            }
        }
        $xml .= '</urlset>';
        @file_put_contents($cache, $xml, LOCK_EX);
        return new Response($xml, 200, ['Content-Type' => 'application/xml; charset=utf-8', 'Cache-Control' => 'public, max-age=3600']);
    }

    public function robots(Request $req): Response
    {
        $base = $req->basePath;
        if (Settings::get('site.indexing') !== '1') {
            return Response::text("User-agent: *\nDisallow: /\n");
        }
        $lines = ["User-agent: *"];
        foreach (['/account', '/cart', '/checkout', '/seller', '/admin', '/login', '/register', '/payment', '/search', '/install'] as $p) {
            $lines[] = 'Disallow: ' . $base . $p;
            $lines[] = 'Disallow: ' . $base . '/en' . $p;
        }
        $lines[] = '';
        $lines[] = 'Sitemap: ' . abs_url('sitemap.xml', [], 'bn');
        return Response::text(implode("\n", $lines) . "\n");
    }

    public function manifest(Request $req): Response
    {
        $base = $req->basePath;
        return new Response((string) json_encode([
            'name' => site_name(),
            'short_name' => site_name(),
            'description' => t('home.metaDescription'),
            'lang' => locale(),
            'start_url' => url(),
            'scope' => $base . '/',
            'display' => 'standalone',
            'background_color' => '#F8FAFC',
            'theme_color' => '#2563EB',
            'icons' => [
                ['src' => $base . '/assets/img/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
                ['src' => $base . '/assets/img/icons/icon-512.png', 'sizes' => '512x512', 'type' => 'image/png'],
                ['src' => $base . '/assets/img/icons/icon-maskable-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 200, ['Content-Type' => 'application/manifest+json; charset=utf-8', 'Cache-Control' => 'public, max-age=86400']);
    }

    public function offline(Request $req): Response
    {
        return view('pages/offline', ['title' => t('errors.offlineTitle'), 'robots' => 'noindex'], 'layouts/bare');
    }
}
