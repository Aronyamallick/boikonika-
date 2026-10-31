<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\Crypto;
use App\Core\DB;
use App\Core\Money;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;
use App\Core\Validator;
use App\Services\Notify;
use App\Services\Sellers;

final class PayoutsController
{
    use SellerPage;

    public function index(Request $req): Response
    {
        $sid = $this->sid();
        $accounts = DB::all('SELECT * FROM payout_accounts WHERE seller_id = ? ORDER BY is_default DESC, id', [$sid]);
        $payouts = DB::all('SELECT * FROM payouts WHERE seller_id = ? ORDER BY id DESC LIMIT 50', [$sid]);
        $earnings = DB::all("SELECT number, subtotal, shipping_fee, commission_amount, seller_earning, delivered_at FROM seller_orders WHERE seller_id = ? AND status = 'delivered' ORDER BY delivered_at DESC LIMIT 20", [$sid]);
        return $this->page('payouts', [
            'title' => t('seller.payouts'),
            'balance' => Sellers::balance($sid),
            'accounts' => $accounts,
            'payouts' => $payouts,
            'earnings' => $earnings,
            'min' => Settings::get('orders.min_payout'),
            'days' => Settings::int('orders.return_window_days'),
        ]);
    }

    public function saveAccount(Request $req): Response
    {
        $sid = $this->sid();
        $data = $req->only(['method', 'account_name', 'account_number', 'bank_name', 'branch', 'routing_number']);
        $rules = ['method' => 'required|in:bkash,nagad,rocket,bank', 'account_name' => 'required|max:120', 'account_number' => 'required|max:30'];
        if (($data['method'] ?? '') === 'bank') {
            $rules += ['bank_name' => 'required|max:120', 'branch' => 'required|max:120', 'routing_number' => 'nullable|max:20'];
        }
        $errors = Validator::make($data, $rules);
        $number = preg_replace('/[\s\-]/', '', to_ascii_digits((string) $data['account_number']));
        if (!isset($errors['account_number'])) {
            if ($data['method'] !== 'bank' && !Validator::phone($number)) {
                $errors['account_number'] = t('validation.phone');
            } elseif ($data['method'] === 'bank' && !preg_match('/^\d{6,20}$/', (string) $number)) {
                $errors['account_number'] = t('seller.bankNumberInvalid');
            }
        }
        if ((int) DB::val('SELECT COUNT(*) FROM payout_accounts WHERE seller_id = ?', [$sid]) >= 5) {
            $errors['account_number'] = t('seller.tooManyAccounts');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        if ($data['method'] !== 'bank') {
            $number = Validator::phone($number);
        }
        $first = !DB::val('SELECT 1 FROM payout_accounts WHERE seller_id = ?', [$sid]);
        DB::insert('payout_accounts', [
            'seller_id' => $sid,
            'method' => $data['method'],
            'account_name' => $data['account_name'],
            'account_number_enc' => Crypto::encrypt((string) $number),
            'account_last4' => substr((string) $number, -4),
            'bank_name' => $data['method'] === 'bank' ? $data['bank_name'] : null,
            'branch' => $data['method'] === 'bank' ? $data['branch'] : null,
            'routing_number' => $data['method'] === 'bank' ? ($data['routing_number'] ?: null) : null,
            'is_default' => $first ? 1 : 0,
            'created_at' => DB::now(),
        ]);
        \App\Core\Audit::log('seller.payout_account_added', 'seller', $sid);
        return redirect(url('seller/payouts'))->with('success', t('seller.accountSaved'));
    }

    public function deleteAccount(Request $req, string $id): Response
    {
        $sid = $this->sid();
        if (DB::val("SELECT 1 FROM payouts WHERE payout_account_id = ? AND status IN ('requested', 'processing')", [(int) $id])) {
            return back()->with('error', t('seller.accountInUse'));
        }
        DB::exec('DELETE FROM payout_accounts WHERE id = ? AND seller_id = ?', [(int) $id, $sid]);
        return redirect(url('seller/payouts'))->with('success', t('common.deleted'));
    }

    public function request(Request $req): Response
    {
        $sid = $this->sid();
        RateLimit::enforce('payout:' . $sid, 5, 3600);
        $account = DB::one('SELECT * FROM payout_accounts WHERE id = ? AND seller_id = ?', [$req->int('account_id'), $sid]);
        $amount = $req->str('amount');
        $errors = Validator::make(['amount' => $amount], ['amount' => 'required|money_positive']);
        if (!$account) {
            $errors['account_id'] = t('seller.chooseAccount');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $poisha = Money::toPoisha($amount);
        $result = DB::tx(static function () use ($sid, $poisha, $account): ?string {
            DB::one('SELECT id FROM sellers WHERE id = ? FOR UPDATE', [$sid]);
            $balance = Sellers::balance($sid);
            if ($poisha > $balance['withdrawable']) {
                return 'seller.overBalance';
            }
            if ($poisha < Money::toPoisha(Settings::get('orders.min_payout', '0'))) {
                return 'seller.belowMinimum';
            }
            $label = t('status.payoutMethod.' . $account['method']) . ' ' . Crypto::mask($account['account_last4']) . ($account['bank_name'] ? ' · ' . $account['bank_name'] : '');
            DB::insert('payouts', [
                'seller_id' => $sid,
                'payout_account_id' => $account['id'],
                'amount' => Money::toDecimal($poisha),
                'status' => 'requested',
                'method_snapshot' => mb_substr($label, 0, 160),
                'requested_at' => DB::now(),
            ]);
            return null;
        });
        if ($result) {
            return back()->with('error', t($result, ['min' => money(Settings::get('orders.min_payout'))]))->withInput();
        }
        Notify::staff('payouts.manage', 'staffPayoutRequested', ['store' => $this->seller()['store_name'], 'amount' => money($poisha)], 'admin/payouts');
        return redirect(url('seller/payouts'))->with('success', t('seller.payoutRequested'));
    }
}
