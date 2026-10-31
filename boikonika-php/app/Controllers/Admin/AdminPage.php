<?php
declare(strict_types=1);

namespace App\Controllers\Admin;

use App\Core\Response;

trait AdminPage
{
    private function page(string $view, array $data): Response
    {
        return view('admin/' . $view, $data + ['area' => 'admin'], 'layouts/dash');
    }
}
