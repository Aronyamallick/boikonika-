<?php
declare(strict_types=1);

namespace App\Services;

use App\Core\App;
use App\Core\Auth;
use App\Core\DB;
use App\Core\Money;

/**
 * Shopping cart for guests (a random cookie token) and accounts. A guest cart joins the account cart
 * at sign-in. Prices are never trusted from the cart: checkout reads them again from the listings.
 */
final class Cart
{
    public const COOKIE = 'bk_cart';
    public const MAX_QTY = 20;
    private static ?array $cart = null;
    private static ?int $count = null;

    public static function current(bool $create = false): ?array
    {
        if (self::$cart !== null) {
            return self::$cart;
        }
        $uid = Auth::id();
        if ($uid) {
            $cart = DB::one('SELECT * FROM carts WHERE user_id = ?', [$uid]);
            if (!$cart && $create) {
                DB::exec('INSERT IGNORE INTO carts (user_id, updated_at) VALUES (?, NOW())', [$uid]);
                $cart = DB::one('SELECT * FROM carts WHERE user_id = ?', [$uid]);
            }
            return self::$cart = $cart;
        }
        $token = (string) ($_COOKIE[self::COOKIE] ?? '');
        if (preg_match('/^[a-f0-9]{64}$/', $token)) {
            $cart = DB::one('SELECT * FROM carts WHERE token = ? AND user_id IS NULL', [hash('sha256', $token)]);
            if ($cart) {
                return self::$cart = $cart;
            }
        }
        if (!$create) {
            return null;
        }
        $token = bin2hex(random_bytes(32));
        $id = DB::insert('carts', ['token' => hash('sha256', $token), 'updated_at' => DB::now()]);
        setcookie(self::COOKIE, $token, [
            'expires' => time() + 30 * 86400,
            'path' => (App::$request->basePath ?: '') . '/',
            'secure' => str_starts_with((string) App::config('url', ''), 'https://'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        return self::$cart = DB::one('SELECT * FROM carts WHERE id = ?', [$id]);
    }

    /** Number of items (sum of quantities) for the header badge. */
    public static function count(): int
    {
        if (self::$count !== null) {
            return self::$count;
        }
        $cart = self::current();
        return self::$count = $cart ? (int) DB::val('SELECT COALESCE(SUM(quantity), 0) FROM cart_items WHERE cart_id = ?', [$cart['id']]) : 0;
    }

    /** Adds a listing. Returns an error translation key, or null. */
    public static function add(int $listingId, int $qty): ?string
    {
        $listing = self::buyable($listingId);
        if (!$listing) {
            return 'cart.unavailable';
        }
        if (Auth::isSeller() && (int) $listing['seller_id'] === (int) Auth::seller()['id']) {
            return 'cart.ownListing';
        }
        $cart = self::current(true);
        $existing = (int) DB::val('SELECT quantity FROM cart_items WHERE cart_id = ? AND listing_id = ?', [$cart['id'], $listingId]);
        $want = max(1, $existing + $qty);
        $max = min(self::MAX_QTY, (int) $listing['stock']);
        $error = $want > $max ? 'cart.limited' : null;
        $want = min($want, $max);
        DB::exec('INSERT INTO cart_items (cart_id, listing_id, quantity, added_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)', [$cart['id'], $listingId, $want]);
        DB::exec('UPDATE carts SET updated_at = NOW() WHERE id = ?', [$cart['id']]);
        self::$count = null;
        return $error;
    }

    public static function setQuantity(int $itemId, int $qty): void
    {
        $cart = self::current();
        if (!$cart) {
            return;
        }
        if ($qty <= 0) {
            self::remove($itemId);
            return;
        }
        $row = DB::one('SELECT ci.id, l.stock FROM cart_items ci JOIN listings l ON l.id = ci.listing_id WHERE ci.id = ? AND ci.cart_id = ?', [$itemId, $cart['id']]);
        if ($row) {
            DB::exec('UPDATE cart_items SET quantity = ? WHERE id = ?', [max(1, min($qty, self::MAX_QTY, max(1, (int) $row['stock']))), $itemId]);
        }
        self::$count = null;
    }

    public static function remove(int $itemId): void
    {
        $cart = self::current();
        if ($cart) {
            DB::exec('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [$itemId, $cart['id']]);
        }
        self::$count = null;
    }

    /** Moves a guest cart into the account's cart after sign-in. */
    public static function mergeGuestInto(int $userId): void
    {
        $token = (string) ($_COOKIE[self::COOKIE] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
            return;
        }
        $guest = DB::one('SELECT * FROM carts WHERE token = ? AND user_id IS NULL', [hash('sha256', $token)]);
        if ($guest) {
            DB::exec('INSERT IGNORE INTO carts (user_id, updated_at) VALUES (?, NOW())', [$userId]);
            $mine = (int) DB::val('SELECT id FROM carts WHERE user_id = ?', [$userId]);
            foreach (DB::all('SELECT listing_id, quantity FROM cart_items WHERE cart_id = ?', [$guest['id']]) as $it) {
                DB::exec('INSERT INTO cart_items (cart_id, listing_id, quantity, added_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE quantity = LEAST(?, GREATEST(quantity, VALUES(quantity)))', [$mine, $it['listing_id'], $it['quantity'], self::MAX_QTY]);
            }
            DB::exec('DELETE FROM carts WHERE id = ?', [$guest['id']]);
        }
        setcookie(self::COOKIE, '', ['expires' => time() - 3600, 'path' => (App::$request->basePath ?: '') . '/', 'httponly' => true, 'samesite' => 'Lax']);
        self::$cart = null;
        self::$count = null;
    }

    /** A listing that can be bought right now (active, in stock, live product, approved seller). */
    public static function buyable(int $listingId): ?array
    {
        return DB::one("SELECT l.*, p.title, p.slug, p.type FROM listings l JOIN products p ON p.id = l.product_id JOIN sellers s ON s.id = l.seller_id
            WHERE l.id = ? AND l.status = 'active' AND l.stock > 0 AND p.status = 'active' AND s.status = 'approved'", [$listingId]);
    }

    /**
     * Cart lines grouped by seller, with availability.
     * @return array{groups:list<array>, items:int, subtotal:int, problems:bool, lines:list<array>}
     */
    public static function contents(?array $cart = null): array
    {
        $cart ??= self::current();
        $empty = ['groups' => [], 'items' => 0, 'subtotal' => 0, 'problems' => false, 'lines' => []];
        if (!$cart) {
            return $empty;
        }
        $lines = DB::all("SELECT ci.id AS item_id, ci.quantity, l.id AS listing_id, l.price, l.compare_at_price, l.stock, l.status AS listing_status, l.item_condition, l.seller_id,
                p.id AS product_id, p.title, p.slug, p.type, p.cover_path, p.status AS product_status,
                s.store_name, s.slug AS store_slug, s.status AS seller_status
            FROM cart_items ci JOIN listings l ON l.id = ci.listing_id JOIN products p ON p.id = l.product_id JOIN sellers s ON s.id = l.seller_id
            WHERE ci.cart_id = ? ORDER BY s.store_name, ci.added_at", [$cart['id']]);
        if (!$lines) {
            return $empty;
        }
        $groups = [];
        $subtotal = 0;
        $items = 0;
        $problems = false;
        foreach ($lines as &$l) {
            $available = $l['listing_status'] === 'active' && $l['product_status'] === 'active' && $l['seller_status'] === 'approved' && (int) $l['stock'] > 0;
            $l['available'] = $available;
            $l['too_many'] = $available && (int) $l['quantity'] > (int) $l['stock'];
            $l['line_total'] = Money::toPoisha($l['price']) * (int) $l['quantity'];
            if (!$available || $l['too_many']) {
                $problems = true;
            }
            if ($available) {
                $subtotal += $l['line_total'];
                $items += (int) $l['quantity'];
            }
            $sid = (int) $l['seller_id'];
            $groups[$sid] ??= ['seller_id' => $sid, 'store_name' => $l['store_name'], 'store_slug' => $l['store_slug'], 'lines' => [], 'subtotal' => 0];
            $groups[$sid]['lines'][] = $l;
            if ($available) {
                $groups[$sid]['subtotal'] += $l['line_total'];
            }
        }
        return ['groups' => array_values($groups), 'items' => $items, 'subtotal' => $subtotal, 'problems' => $problems, 'lines' => $lines];
    }
}
