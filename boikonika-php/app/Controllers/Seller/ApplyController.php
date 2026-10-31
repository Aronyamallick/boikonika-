<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\Audit;
use App\Core\Auth;
use App\Core\Crypto;
use App\Core\DB;
use App\Core\RateLimit;
use App\Core\Request;
use App\Core\Response;
use App\Core\Settings;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Catalog;
use App\Services\Geo;
use App\Services\Notify;

/** Becoming a seller: an application with identity documents, reviewed by staff. */
final class ApplyController
{
    public function landing(Request $req): Response
    {
        return view('seller/landing', [
            'title' => t('sell.title'),
            'description' => t('sell.intro'),
            'seller' => Auth::seller(),
            'commission' => Settings::get('orders.commission_percent'),
        ]);
    }

    public function form(Request $req): Response
    {
        $seller = Auth::seller();
        if ($seller && $seller['status'] === 'approved') {
            return redirect(url('seller'));
        }
        return view('seller/apply', [
            'title' => t('sell.applyTitle'),
            'seller' => $seller,
            'districts' => Geo::districtOptions(),
            'robots' => 'noindex',
        ]);
    }

    public function submit(Request $req): Response
    {
        $user = Auth::user();
        $seller = Auth::seller();
        if ($seller && in_array($seller['status'], ['approved', 'pending', 'suspended'], true)) {
            return redirect(url('seller/apply'));
        }
        RateLimit::enforce('seller-apply:' . $user['id'], 5, 86400);
        $data = $req->only(['store_name', 'phone', 'email', 'business_type', 'business_name', 'address', 'district', 'description', 'doc_type', 'doc_number']);
        $errors = Validator::make($data, [
            'store_name' => 'required|min:3|max:80',
            'phone' => 'required|phone',
            'email' => 'nullable|email',
            'business_type' => 'required|in:individual,business,publisher',
            'business_name' => 'nullable|max:160',
            'address' => 'required|min:10|max:500',
            'district' => 'required',
            'description' => 'nullable|max:2000',
            'doc_type' => 'required|in:nid,passport,birth_certificate,trade_license',
            'doc_number' => 'required|min:6|max:30',
        ]);
        if (!isset($errors['district']) && !Geo::isDistrict((string) $data['district'])) {
            $errors['district'] = t('validation.in');
        }
        $docNumber = preg_replace('/[\s\-]/', '', to_ascii_digits((string) $data['doc_number']));
        if (!isset($errors['doc_number']) && !preg_match('/^[A-Za-z0-9]{6,30}$/', (string) $docNumber)) {
            $errors['doc_number'] = t('sell.docNumberInvalid');
        }
        $front = $req->file('doc_front');
        $back = $req->file('doc_back');
        if ($err = Upload::check($front)) {
            $errors['doc_front'] = $err;
        }
        if ($back && ($err = Upload::check($back))) {
            $errors['doc_back'] = $err;
        }
        if (!$back && in_array($data['doc_type'], ['nid'], true)) {
            $errors['doc_back'] = t('sell.backRequired');
        }
        if (!$req->bool('agree')) {
            $errors['agree'] = t('validation.accept');
        }
        $name = trim((string) $data['store_name']);
        if (!isset($errors['store_name']) && DB::val('SELECT 1 FROM sellers WHERE store_name = ? AND user_id <> ?', [$name, $user['id']])) {
            $errors['store_name'] = t('sell.nameTaken');
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $frontPath = Upload::privateImage($front, 'kyc');
        $backPath = $back ? Upload::privateImage($back, 'kyc') : null;
        $now = DB::now();
        $row = [
            'user_id' => $user['id'],
            'store_name' => $name,
            'phone' => Validator::phone($data['phone']),
            'email' => $data['email'] ? mb_strtolower($data['email']) : null,
            'business_type' => $data['business_type'],
            'business_name' => $data['business_name'] ?: null,
            'address' => $data['address'],
            'district' => $data['district'],
            'description' => $data['description'] ?: null,
            'status' => 'pending',
            'review_note' => null,
            'accepted_policy_at' => $now,
            'updated_at' => $now,
        ];
        DB::tx(static function () use ($seller, $row, $data, $docNumber, $frontPath, $backPath, $now): void {
            if ($seller) {
                DB::update('sellers', $row, 'id = ?', [$seller['id']]);
                $sellerId = (int) $seller['id'];
                foreach (DB::all('SELECT * FROM seller_documents WHERE seller_id = ?', [$sellerId]) as $d) {
                    Upload::deletePrivate($d['front_path']);
                    Upload::deletePrivate($d['back_path']);
                }
                DB::exec('DELETE FROM seller_documents WHERE seller_id = ?', [$sellerId]);
            } else {
                $row['slug'] = Catalog::uniqueSlug('sellers', $row['store_name']);
                $row['created_at'] = $now;
                $sellerId = DB::insert('sellers', $row);
            }
            DB::insert('seller_documents', [
                'seller_id' => $sellerId,
                'doc_type' => $data['doc_type'],
                'number_enc' => Crypto::encrypt((string) $docNumber),
                'number_last4' => substr((string) $docNumber, -4),
                'front_path' => $frontPath,
                'back_path' => $backPath,
                'created_at' => $now,
            ]);
        });
        Audit::log('seller.applied', 'user', $user['id']);
        Notify::staff('sellers.review', 'staffSellerApplied', ['store' => $name], 'admin/sellers');
        return redirect(url('seller/apply'))->with('success', t('sell.submitted'));
    }
}
