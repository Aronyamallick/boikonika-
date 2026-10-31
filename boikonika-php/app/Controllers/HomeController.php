<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\DB;
use App\Core\Request;
use App\Services\Catalog;

final class HomeController
{
    public function index(Request $req)
    {
        $banners = DB::all('SELECT * FROM banners WHERE is_active = 1 AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW()) ORDER BY position, id LIMIT 3');
        $sellers = DB::all("SELECT s.id, s.store_name, s.slug, s.logo_path, s.district, COUNT(l.id) AS offers
            FROM sellers s JOIN listings l ON l.seller_id = s.id AND l.status = 'active' AND l.stock > 0
            WHERE s.status = 'approved' GROUP BY s.id ORDER BY offers DESC LIMIT 6");
        return view('home/index', [
            'banners' => $banners,
            'bookCategories' => Catalog::tree('book'),
            'generalCategories' => Catalog::tree('general'),
            'featured' => Catalog::section('featured', 10),
            'newBooks' => Catalog::section('new', 10),
            'bestsellers' => Catalog::section('bestsellers', 10),
            'discounted' => Catalog::section('discounted', 10),
            'used' => Catalog::section('used', 10),
            'general' => Catalog::section('general', 10),
            'sellers' => $sellers,
            'jsonLd' => [
                '@context' => 'https://schema.org',
                '@type' => 'WebSite',
                'name' => site_name(),
                'url' => abs_url(),
                'potentialAction' => ['@type' => 'SearchAction', 'target' => abs_url('search') . '?q={q}', 'query-input' => 'required name=q'],
            ],
        ]);
    }
}
