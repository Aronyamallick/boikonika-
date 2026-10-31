<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\DB;
use App\Core\HttpException;
use App\Core\Money;
use App\Core\Paginator;
use App\Core\Request;
use App\Core\Response;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Catalog;
use App\Services\Geo;
use App\Services\Notify;
use App\Services\Orders;

final class AccountController
{
    private function page(string $view, array $data): Response
    {
        return view('account/' . $view, $data + ['area' => 'account'], 'layouts/dash');
    }

    public function dashboard(Request $req): Response
    {
        $uid = (int) Auth::id();
        $orders = DB::all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 5', [$uid]);
        $stats = DB::one("SELECT COUNT(*) AS orders, SUM(status = 'completed') AS completed, SUM(status IN ('placed', 'awaiting_payment')) AS open FROM orders WHERE user_id = ?", [$uid]);
        $wish = (int) DB::val('SELECT COUNT(*) FROM wishlist_items WHERE user_id = ?', [$uid]);
        $awaiting = DB::all("SELECT * FROM orders WHERE user_id = ? AND status = 'awaiting_payment' ORDER BY id DESC", [$uid]);
        return $this->page('dashboard', ['title' => t('account.title'), 'orders' => $orders, 'stats' => $stats, 'wish' => $wish, 'awaiting' => $awaiting]);
    }

    public function orders(Request $req): Response
    {
        $uid = (int) Auth::id();
        $total = (int) DB::val('SELECT COUNT(*) FROM orders WHERE user_id = ?', [$uid]);
        $pager = new Paginator($total, 15);
        $orders = DB::all('SELECT o.*, (SELECT COUNT(*) FROM seller_orders so WHERE so.order_id = o.id) AS parcels, (SELECT SUM(quantity) FROM order_items i WHERE i.order_id = o.id) AS items FROM orders o WHERE o.user_id = ? ORDER BY o.id DESC' . $pager->sql(), [$uid]);
        return $this->page('orders', ['title' => t('nav.orders'), 'orders' => $orders, 'pager' => $pager]);
    }

    private function myOrder(string $number): array
    {
        return DB::one('SELECT * FROM orders WHERE number = ? AND user_id = ?', [$number, Auth::id()]) ?? throw new HttpException(404);
    }

    public function order(Request $req, string $number): Response
    {
        $order = $this->myOrder($number);
        $parcels = Orders::parcels((int) $order['id']);
        $events = DB::all('SELECT * FROM order_events WHERE order_id = ? ORDER BY id', [$order['id']]);
        $refunds = DB::all('SELECT * FROM refunds WHERE order_id = ? ORDER BY id', [$order['id']]);
        $reviewed = DB::col('SELECT product_id FROM reviews WHERE user_id = ?', [Auth::id()]);
        return $this->page('order', [
            'title' => t('orders.orderTitle', ['number' => $order['number']]),
            'order' => $order,
            'parcels' => $parcels,
            'events' => $events,
            'refunds' => $refunds,
            'canCancel' => Orders::buyerCanCancel($order, $parcels),
            'reviewed' => array_map('intval', $reviewed),
            'paymentResult' => in_array($req->query('payment'), ['success', 'failed', 'cancelled', 'retry', 'check'], true) ? $req->query('payment') : null,
        ]);
    }

    public function cancelOrder(Request $req, string $number): Response
    {
        $order = $this->myOrder($number);
        $parcels = Orders::parcels((int) $order['id']);
        if (!Orders::buyerCanCancel($order, $parcels)) {
            return back()->with('error', t('orders.cannotCancel'));
        }
        $reason = in_array($req->str('reason'), ['changed_mind', 'found_cheaper', 'ordered_by_mistake', 'delivery_too_slow', 'other'], true) ? $req->str('reason') : 'other';
        Orders::cancel((int) $order['id'], $reason, Auth::id(), 'buyer');
        $paid = in_array($order['payment_status'], ['paid', 'partially_refunded'], true);
        return redirect(url('account/orders/' . $number))->with('success', $paid ? t('orders.cancelledRefund') : t('orders.cancelled'));
    }

    public function requestReturn(Request $req, string $number, string $id): Response
    {
        $order = $this->myOrder($number);
        $parcel = DB::one('SELECT * FROM seller_orders WHERE id = ? AND order_id = ?', [(int) $id, $order['id']]) ?? throw new HttpException(404);
        if (!Orders::returnWindowOpen($parcel) || DB::val("SELECT 1 FROM returns WHERE seller_order_id = ? AND status NOT IN ('rejected', 'cancelled')", [$parcel['id']])) {
            return back()->with('error', t('orders.returnClosed'));
        }
        $data = $req->only(['reason', 'details']);
        $errors = Validator::make($data, ['reason' => 'required|in:damaged,wrong_item,not_as_described,missing_parts,other', 'details' => 'required|min:10|max:1000']);
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        DB::insert('returns', [
            'seller_order_id' => $parcel['id'], 'order_id' => $order['id'], 'user_id' => Auth::id(),
            'reason' => $data['reason'], 'details' => $data['details'], 'status' => 'requested',
            'created_at' => DB::now(), 'updated_at' => DB::now(),
        ]);
        Orders::event((int) $order['id'], (int) $parcel['id'], 'return_requested', $data['reason'], Auth::id());
        $sellerUser = (int) DB::val('SELECT user_id FROM sellers WHERE id = ?', [$parcel['seller_id']]);
        Notify::user($sellerUser, 'returnRequested', ['number' => $parcel['number']], 'seller/orders/' . $parcel['number'], true, true);
        Notify::staff('refunds.manage', 'staffReturnRequested', ['number' => $parcel['number']], 'admin/returns');
        return redirect(url('account/orders/' . $number))->with('success', t('orders.returnRequested'));
    }

    public function addresses(Request $req): Response
    {
        $rows = DB::all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [Auth::id()]);
        return $this->page('addresses', ['title' => t('addresses.title'), 'rows' => $rows, 'districts' => Geo::districtOptions()]);
    }

    public function saveAddress(Request $req): Response
    {
        $_POST['return'] = 'account/addresses';
        return (new CheckoutController())->saveAddress($req);
    }

    public function deleteAddress(Request $req, string $id): Response
    {
        $uid = (int) Auth::id();
        $wasDefault = (int) DB::val('SELECT is_default FROM addresses WHERE id = ? AND user_id = ?', [(int) $id, $uid]);
        DB::exec('DELETE FROM addresses WHERE id = ? AND user_id = ?', [(int) $id, $uid]);
        if ($wasDefault) {
            DB::exec('UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY id DESC LIMIT 1', [$uid]);
        }
        return redirect(url('account/addresses'))->with('success', t('addresses.deleted'));
    }

    public function defaultAddress(Request $req, string $id): Response
    {
        $uid = (int) Auth::id();
        if (DB::val('SELECT 1 FROM addresses WHERE id = ? AND user_id = ?', [(int) $id, $uid])) {
            DB::exec('UPDATE addresses SET is_default = (id = ?) WHERE user_id = ?', [(int) $id, $uid]);
        }
        return redirect(url('account/addresses'));
    }

    public function wishlist(Request $req): Response
    {
        $rows = DB::all('SELECT ' . Catalog::cardColumns() . ' FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.user_id = ? AND p.status = ? ORDER BY w.created_at DESC LIMIT 200', [Auth::id(), 'active']);
        return $this->page('wishlist', ['title' => t('nav.wishlist'), 'products' => $rows]);
    }

    public function toggleWishlist(Request $req, string $id): Response
    {
        $uid = (int) Auth::id();
        $pid = (int) $id;
        if (!DB::val("SELECT 1 FROM products WHERE id = ? AND status = 'active'", [$pid])) {
            throw new HttpException(404);
        }
        if (DB::exec('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?', [$uid, $pid])) {
            flash('success', t('catalog.wishlistRemoved'));
        } else {
            if ((int) DB::val('SELECT COUNT(*) FROM wishlist_items WHERE user_id = ?', [$uid]) < 500) {
                DB::insert('wishlist_items', ['user_id' => $uid, 'product_id' => $pid, 'created_at' => DB::now()]);
            }
            flash('success', t('catalog.wishlistAdded'));
        }
        return back(url('account/wishlist'));
    }

    public function notifications(Request $req): Response
    {
        $uid = (int) Auth::id();
        $total = (int) DB::val('SELECT COUNT(*) FROM notifications WHERE user_id = ?', [$uid]);
        $pager = new Paginator($total, 30);
        $rows = DB::all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC' . $pager->sql(), [$uid]);
        $unread = (int) DB::val('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND read_at IS NULL', [$uid]);
        return $this->page('notifications', ['title' => t('nav.notifications'), 'rows' => $rows, 'pager' => $pager, 'unread' => $unread]);
    }

    public function readNotifications(Request $req): Response
    {
        DB::exec('UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL', [Auth::id()]);
        return redirect(url('account/notifications'));
    }

    public function profile(Request $req): Response
    {
        return $this->page('profile', ['title' => t('account.profile'), 'user' => Auth::user()]);
    }

    public function saveProfile(Request $req): Response
    {
        $u = Auth::user();
        $data = $req->only(['name', 'phone']);
        $errors = Validator::make($data, ['name' => 'required|min:2|max:120', 'phone' => 'nullable|phone']);
        $phone = $data['phone'] ? Validator::phone($data['phone']) : null;
        if ($phone && !isset($errors['phone']) && DB::val('SELECT 1 FROM users WHERE phone = ? AND id <> ?', [$phone, $u['id']])) {
            $errors['phone'] = t('auth.phoneTaken');
        }
        $avatar = $req->file('avatar');
        if ($avatar && ($err = Upload::check($avatar))) {
            $errors['avatar'] = $err;
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $set = [
            'name' => $data['name'],
            'phone' => $phone,
            'locale' => in_array($req->str('locale'), ['bn', 'en'], true) ? $req->str('locale') : $u['locale'],
            'notify_email' => $req->bool('notify_email') ? 1 : 0,
            'updated_at' => DB::now(),
        ];
        if ($avatar) {
            $set['avatar_path'] = Upload::image($avatar, 'avatars', 400, 400);
            Upload::delete($u['avatar_path']);
        } elseif ($req->bool('remove_avatar')) {
            $set['avatar_path'] = null;
            Upload::delete($u['avatar_path']);
        }
        DB::update('users', $set, 'id = ?', [$u['id']]);
        return redirect(url('account/profile'))->with('success', t('common.saved'));
    }
}
