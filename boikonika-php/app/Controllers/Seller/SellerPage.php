<?php
declare(strict_types=1);

namespace App\Controllers\Seller;

use App\Core\Auth;
use App\Core\Response;

trait SellerPage
{
    private function seller(): array
    {
        return Auth::seller();
    }

    private function sid(): int
    {
        return (int) Auth::seller()['id'];
    }

    private function page(string $view, array $data): Response
    {
        return view('seller/' . $view, $data + ['area' => 'seller', 'seller' => Auth::seller()], 'layouts/dash');
    }
}
