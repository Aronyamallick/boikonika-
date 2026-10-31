<?php
declare(strict_types=1);

/**
 * Reference data for a new install: settings, categories, delivery methods and information pages.
 * Safe to run again — existing rows are left as they are.
 */
return static function (PDO $pdo): void {
    $now = date('Y-m-d H:i:s');

    $setting = $pdo->prepare('INSERT IGNORE INTO settings (`key`, value, updated_at) VALUES (?, ?, ?)');
    foreach (\App\Core\Settings::DEFAULTS as $k => $v) {
        $setting->execute([$k, $v, $now]);
    }

    $books = [
        ['fiction', 'কথাসাহিত্য', 'Fiction', [['novels', 'উপন্যাস', 'Novels'], ['short-stories', 'ছোটগল্প', 'Short stories'], ['thriller', 'থ্রিলার ও রহস্য', 'Thriller & mystery'], ['science-fiction', 'বৈজ্ঞানিক কল্পকাহিনি', 'Science fiction'], ['translated', 'অনূদিত সাহিত্য', 'Translated literature']]],
        ['poetry', 'কবিতা', 'Poetry', []],
        ['bangla-literature', 'বাংলা সাহিত্য', 'Bangla literature', [['classics', 'চিরায়ত সাহিত্য', 'Classics'], ['essays', 'প্রবন্ধ', 'Essays']]],
        ['non-fiction', 'নন-ফিকশন', 'Non-fiction', [['biography', 'জীবনী ও স্মৃতিকথা', 'Biography & memoir'], ['history', 'ইতিহাস', 'History'], ['self-development', 'আত্মউন্নয়ন', 'Self-development'], ['business', 'ব্যবসা ও অর্থনীতি', 'Business & economics'], ['science', 'বিজ্ঞান', 'Science'], ['technology', 'প্রযুক্তি', 'Technology'], ['programming', 'প্রোগ্রামিং', 'Programming']]],
        ['academic', 'একাডেমিক', 'Academic', [['primary', 'প্রাথমিক', 'Primary'], ['ssc', 'এসএসসি', 'SSC'], ['hsc', 'এইচএসসি', 'HSC'], ['admission', 'ভর্তি প্রস্তুতি', 'Admission preparation'], ['university', 'বিশ্ববিদ্যালয়', 'University'], ['job-preparation', 'চাকরির প্রস্তুতি', 'Job preparation']]],
        ['children', 'শিশু-কিশোর', 'Children & teens', [['picture-books', 'ছবির বই', 'Picture books'], ['comics', 'কমিকস', 'Comics']]],
        ['religion', 'ধর্ম ও দর্শন', 'Religion & philosophy', [['islamic', 'ইসলামি বই', 'Islamic books']]],
        ['research', 'গবেষণা', 'Research', []],
    ];
    $general = [
        ['stationery', 'স্টেশনারি', 'Stationery', [['pens', 'কলম', 'Pens'], ['notebooks', 'খাতা ও নোটবুক', 'Notebooks'], ['paper', 'কাগজ', 'Paper']]],
        ['school-supplies', 'স্কুল সামগ্রী', 'School supplies', [['geometry-boxes', 'জ্যামিতি বক্স', 'Geometry boxes'], ['calculators', 'ক্যালকুলেটর', 'Calculators']]],
        ['art-supplies', 'আর্ট সামগ্রী', 'Art supplies', []],
        ['bags', 'ব্যাগ', 'Bags', []],
        ['office-products', 'অফিস সামগ্রী', 'Office products', []],
        ['study-accessories', 'পড়ার সহায়ক', 'Study accessories', [['book-stands', 'বুক স্ট্যান্ড', 'Book stands'], ['reading-lamps', 'রিডিং ল্যাম্প', 'Reading lamps']]],
        ['electronics', 'ইলেকট্রনিক্স', 'Electronics', [['e-readers', 'ই-রিডার', 'E-readers']]],
        ['educational-tools', 'শিক্ষা উপকরণ', 'Educational tools', []],
    ];
    $insertCat = $pdo->prepare('INSERT IGNORE INTO categories (parent_id, kind, slug, name_bn, name_en, position, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)');
    $findCat = $pdo->prepare('SELECT id FROM categories WHERE slug = ?');
    foreach (['book' => $books, 'general' => $general] as $kind => $tree) {
        foreach ($tree as $i => [$slug, $bn, $en, $children]) {
            $insertCat->execute([null, $kind, $slug, $bn, $en, $i]);
            $findCat->execute([$slug]);
            $parent = (int) $findCat->fetchColumn();
            foreach ($children as $j => [$cs, $cbn, $cen]) {
                $insertCat->execute([$parent, $kind, $cs, $cbn, $cen, $j]);
            }
        }
    }

    $ship = $pdo->prepare('INSERT IGNORE INTO shipping_methods (code, name_bn, name_en, inside_dhaka_fee, outside_dhaka_fee, free_threshold, min_days, max_days, is_active, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)');
    $ship->execute(['standard', 'সাধারণ ডেলিভারি', 'Standard delivery', '60.00', '120.00', '1500.00', 2, 5, 0]);
    $ship->execute(['express', 'দ্রুত ডেলিভারি', 'Express delivery', '100.00', '160.00', null, 1, 2, 1]);

    $page = $pdo->prepare('INSERT IGNORE INTO pages (slug, title_bn, title_en, body_bn, body_en, is_published, footer_group, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)');
    foreach ((require __DIR__ . '/pages.php') as $i => $p) {
        $page->execute([$p['slug'], $p['title_bn'], $p['title_en'], $p['body_bn'], $p['body_en'], $p['group'], $i, $now, $now]);
    }
};
