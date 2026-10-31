<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\DB;
use App\Core\Request;
use App\Core\Response;
use App\Core\Upload;
use App\Core\Validator;
use App\Services\Geo;

final class StoreController
{
    use SellerPage;

    public function edit(Request $req): Response
    {
        return $this->page('store', ['title' => t('seller.storeSettings'), 'districts' => Geo::districtOptions()]);
    }

    public function update(Request $req): Response
    {
        $s = $this->seller();
        $data = $req->only(['store_name', 'description', 'phone', 'email', 'address', 'district']);
        $errors = Validator::make($data, [
            'store_name' => 'required|min:3|max:80',
            'description' => 'nullable|max:2000',
            'phone' => 'required|phone',
            'email' => 'nullable|email',
            'address' => 'required|min:10|max:500',
            'district' => 'required',
        ]);
        if (!isset($errors['district']) && !Geo::isDistrict((string) $data['district'])) {
            $errors['district'] = t('validation.in');
        }
        if (!isset($errors['store_name']) && DB::val('SELECT 1 FROM sellers WHERE store_name = ? AND id <> ?', [$data['store_name'], $s['id']])) {
            $errors['store_name'] = t('sell.nameTaken');
        }
        $logo = $req->file('logo');
        $banner = $req->file('banner');
        foreach (['logo' => $logo, 'banner' => $banner] as $k => $f) {
            if ($f && ($err = Upload::check($f))) {
                $errors[$k] = $err;
            }
        }
        if ($errors) {
            return back()->withErrors($errors)->withInput();
        }
        $set = [
            'store_name' => $data['store_name'],
            'description' => $data['description'] ?: null,
            'phone' => Validator::phone($data['phone']),
            'email' => $data['email'] ? mb_strtolower($data['email']) : null,
            'address' => $data['address'],
            'district' => $data['district'],
            'updated_at' => DB::now(),
        ];
        if ($logo) {
            $set['logo_path'] = Upload::image($logo, 'stores', 400, 400);
            Upload::delete($s['logo_path']);
        }
        if ($banner) {
            $set['banner_path'] = Upload::image($banner, 'stores', 1600, 500);
            Upload::delete($s['banner_path']);
        }
        DB::update('sellers', $set, 'id = ?', [$s['id']]);
        return redirect(url('seller/store'))->with('success', t('common.saved'));
    }
}
