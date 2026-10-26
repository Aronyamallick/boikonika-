<?php
declare(strict_types=1);

use App\Core\Router;

/** Every page of the site. Paths are the same in Bangla (/…) and English (/en/…). */
return static function (Router $r): void {
    // Storefront
    $r->get('/', 'HomeController@index');
    $r->get('/books', 'CatalogController@books');
    $r->get('/books/{slug}', 'CatalogController@product');
    $r->get('/products', 'CatalogController@general');
    $r->get('/products/{slug}', 'CatalogController@product');
    $r->get('/categories', 'CatalogController@categories');
    $r->get('/categories/{slug}', 'CatalogController@category');
    $r->get('/authors', 'CatalogController@authors');
    $r->get('/authors/{slug}', 'CatalogController@author');
    $r->get('/publishers', 'CatalogController@publishers');
    $r->get('/publishers/{slug}', 'CatalogController@publisher');
    $r->get('/stores/{slug}', 'CatalogController@store');
    $r->get('/search', 'CatalogController@search');
    $r->post('/books/{slug}/reviews', 'ReviewController@store', ['auth' => true]);
    $r->post('/wishlist/{id:\d+}', 'AccountController@toggleWishlist', ['auth' => true]);

    // Cart, checkout and payments
    $r->get('/cart', 'CartController@show');
    $r->post('/cart/add', 'CartController@add');
    $r->post('/cart/items/{id:\d+}', 'CartController@update');
    $r->post('/cart/items/{id:\d+}/remove', 'CartController@remove');
    $r->get('/checkout', 'CheckoutController@show', ['auth' => true]);
    $r->post('/checkout', 'CheckoutController@place', ['auth' => true]);
    $r->post('/checkout/address', 'CheckoutController@saveAddress', ['auth' => true]);
    $r->post('/checkout/refresh', 'CheckoutController@refresh', ['auth' => true]);
    $r->post('/orders/{number}/pay', 'PaymentController@pay', ['auth' => true]);
    // Gateways call these from their own sites: no session (it would replace the buyer's), no CSRF token.
    $r->get('/payment/bkash/callback/{ref}', 'PaymentController@bkashCallback', ['session' => false]);
    $r->post('/payment/sslcommerz/success', 'PaymentController@sslReturn', ['session' => false, 'csrf' => false]);
    $r->post('/payment/sslcommerz/fail', 'PaymentController@sslReturn', ['session' => false, 'csrf' => false]);
    $r->post('/payment/sslcommerz/cancel', 'PaymentController@sslReturn', ['session' => false, 'csrf' => false]);
    $r->post('/payment/sslcommerz/ipn', 'PaymentController@sslIpn', ['session' => false, 'csrf' => false]);

    // Sign-in
    $r->get('/login', 'AuthController@loginForm', ['guest' => true]);
    $r->post('/login', 'AuthController@login', ['guest' => true]);
    $r->get('/login/two-step', 'AuthController@twoStepForm');
    $r->post('/login/two-step', 'AuthController@twoStep');
    $r->get('/register', 'AuthController@registerForm', ['guest' => true]);
    $r->post('/register', 'AuthController@register', ['guest' => true]);
    $r->get('/register/verify', 'AuthController@verifyForm', ['guest' => true]);
    $r->post('/register/verify', 'AuthController@verify', ['guest' => true]);
    $r->post('/register/resend', 'AuthController@resend', ['guest' => true]);
    $r->get('/forgot-password', 'AuthController@forgotForm', ['guest' => true]);
    $r->post('/forgot-password', 'AuthController@forgot', ['guest' => true]);
    $r->get('/reset-password', 'AuthController@resetForm', ['guest' => true]);
    $r->post('/reset-password', 'AuthController@reset', ['guest' => true]);
    $r->post('/logout', 'AuthController@logout');

    // Account
    $r->group(['auth' => true, 'prefix' => '/account'], static function (Router $r): void {
        $r->get('', 'AccountController@dashboard');
        $r->get('/orders', 'AccountController@orders');
        $r->get('/orders/{number}', 'AccountController@order');
        $r->post('/orders/{number}/cancel', 'AccountController@cancelOrder');
        $r->post('/orders/{number}/parcels/{id:\d+}/return', 'AccountController@requestReturn');
        $r->get('/addresses', 'AccountController@addresses');
        $r->post('/addresses', 'AccountController@saveAddress');
        $r->post('/addresses/{id:\d+}/delete', 'AccountController@deleteAddress');
        $r->post('/addresses/{id:\d+}/default', 'AccountController@defaultAddress');
        $r->get('/wishlist', 'AccountController@wishlist');
        $r->get('/notifications', 'AccountController@notifications');
        $r->post('/notifications/read', 'AccountController@readNotifications');
        $r->get('/profile', 'AccountController@profile');
        $r->post('/profile', 'AccountController@saveProfile');
        $r->get('/security', 'SecurityController@show');
        $r->post('/security/password', 'SecurityController@password');
        $r->post('/security/sessions/{id:\d+}/revoke', 'SecurityController@revoke');
        $r->post('/security/sessions/revoke-others', 'SecurityController@revokeOthers');
        $r->post('/security/two-step/start', 'SecurityController@twoStepStart');
        $r->post('/security/two-step/confirm', 'SecurityController@twoStepConfirm');
        $r->post('/security/two-step/disable', 'SecurityController@twoStepDisable');
        $r->get('/privacy', 'SecurityController@privacy');
        $r->get('/privacy/export', 'SecurityController@export');
        $r->post('/privacy/delete', 'SecurityController@deleteAccount');
    });

    // Selling
    $r->get('/sell', 'Seller\ApplyController@landing');
    $r->get('/seller/apply', 'Seller\ApplyController@form', ['auth' => true]);
    $r->post('/seller/apply', 'Seller\ApplyController@submit', ['auth' => true]);
    $r->group(['seller' => true, 'prefix' => '/seller'], static function (Router $r): void {
        $r->get('', 'Seller\DashboardController@index');
        $r->get('/store', 'Seller\StoreController@edit');
        $r->post('/store', 'Seller\StoreController@update');
        $r->get('/listings', 'Seller\ListingsController@index');
        $r->get('/listings/new', 'Seller\ListingsController@create');
        $r->get('/listings/new/book', 'Seller\ListingsController@newBook');
        $r->post('/listings/new/book', 'Seller\ListingsController@storeBook');
        $r->get('/listings/new/product', 'Seller\ListingsController@newProduct');
        $r->post('/listings/new/product', 'Seller\ListingsController@storeProduct');
        $r->get('/listings/offer/{productId:\d+}', 'Seller\ListingsController@offerForm');
        $r->post('/listings/offer/{productId:\d+}', 'Seller\ListingsController@storeOffer');
        $r->get('/listings/{id:\d+}', 'Seller\ListingsController@edit');
        $r->post('/listings/{id:\d+}', 'Seller\ListingsController@update');
        $r->post('/listings/{id:\d+}/images/{imageId:\d+}/delete', 'Seller\ListingsController@deleteImage');
        $r->get('/orders', 'Seller\OrdersController@index');
        $r->get('/orders/{number}', 'Seller\OrdersController@show');
        $r->post('/orders/{number}/status', 'Seller\OrdersController@status');
        $r->post('/orders/{number}/cancel', 'Seller\OrdersController@cancel');
        $r->post('/returns/{id:\d+}', 'Seller\OrdersController@respondReturn');
        $r->get('/payouts', 'Seller\PayoutsController@index');
        $r->post('/payouts', 'Seller\PayoutsController@request');
        $r->post('/payouts/accounts', 'Seller\PayoutsController@saveAccount');
        $r->post('/payouts/accounts/{id:\d+}/delete', 'Seller\PayoutsController@deleteAccount');
    });

    // Admin
    $r->group(['perm' => 'admin.access', 'prefix' => '/admin'], static function (Router $r): void {
        $r->get('', 'Admin\DashboardController@index');
        $r->get('/users', 'Admin\UsersController@index', ['perm' => 'users.view']);
        $r->get('/users/{id:\d+}', 'Admin\UsersController@show', ['perm' => 'users.view']);
        $r->post('/users/{id:\d+}/status', 'Admin\UsersController@status', ['perm' => 'users.manage']);
        $r->post('/users/{id:\d+}/roles', 'Admin\UsersController@roles', ['perm' => 'roles.manage']);
        $r->post('/users/{id:\d+}/unlock', 'Admin\UsersController@unlock', ['perm' => 'users.manage']);

        $r->get('/sellers', 'Admin\SellersController@index', ['perm' => 'sellers.review']);
        $r->get('/sellers/{id:\d+}', 'Admin\SellersController@show', ['perm' => 'sellers.review']);
        $r->post('/sellers/{id:\d+}/review', 'Admin\SellersController@review', ['perm' => 'sellers.review']);
        $r->post('/sellers/{id:\d+}/commission', 'Admin\SellersController@commission', ['perm' => 'sellers.review']);
        $r->get('/documents/{id:\d+}/{side}', 'Admin\SellersController@document', ['perm' => 'sellers.review']);

        $r->get('/products', 'Admin\ProductsController@index', ['perm' => 'catalog.manage']);
        $r->get('/products/new', 'Admin\ProductsController@create', ['perm' => 'catalog.manage']);
        $r->post('/products/new', 'Admin\ProductsController@store', ['perm' => 'catalog.manage']);
        $r->get('/products/{id:\d+}', 'Admin\ProductsController@edit', ['perm' => 'catalog.manage']);
        $r->post('/products/{id:\d+}', 'Admin\ProductsController@update', ['perm' => 'catalog.manage']);
        $r->post('/products/{id:\d+}/review', 'Admin\ProductsController@review', ['perm' => 'catalog.manage']);
        $r->get('/listings', 'Admin\ProductsController@listings', ['perm' => 'catalog.manage']);
        $r->post('/listings/{id:\d+}/status', 'Admin\ProductsController@listingStatus', ['perm' => 'catalog.manage']);
        $r->get('/categories', 'Admin\TaxonomyController@categories', ['perm' => 'catalog.manage']);
        $r->post('/categories', 'Admin\TaxonomyController@saveCategory', ['perm' => 'catalog.manage']);
        $r->post('/categories/{id:\d+}/delete', 'Admin\TaxonomyController@deleteCategory', ['perm' => 'catalog.manage']);
        $r->get('/authors', 'Admin\TaxonomyController@authors', ['perm' => 'catalog.manage']);
        $r->get('/authors/{id:\d+}', 'Admin\TaxonomyController@editAuthor', ['perm' => 'catalog.manage']);
        $r->post('/authors', 'Admin\TaxonomyController@saveAuthor', ['perm' => 'catalog.manage']);
        $r->get('/publishers', 'Admin\TaxonomyController@publishers', ['perm' => 'catalog.manage']);
        $r->get('/publishers/{id:\d+}', 'Admin\TaxonomyController@editPublisher', ['perm' => 'catalog.manage']);
        $r->post('/publishers', 'Admin\TaxonomyController@savePublisher', ['perm' => 'catalog.manage']);
        $r->get('/reviews', 'Admin\TaxonomyController@reviews', ['perm' => 'reviews.moderate']);
        $r->post('/reviews/{id:\d+}', 'Admin\TaxonomyController@moderateReview', ['perm' => 'reviews.moderate']);

        $r->get('/orders', 'Admin\OrdersController@index', ['perm' => 'orders.manage']);
        $r->get('/orders/{number}', 'Admin\OrdersController@show', ['perm' => 'orders.manage']);
        $r->post('/orders/{number}/cancel', 'Admin\OrdersController@cancel', ['perm' => 'orders.manage']);
        $r->post('/orders/{number}/parcels/{id:\d+}/status', 'Admin\OrdersController@parcelStatus', ['perm' => 'orders.manage']);
        $r->post('/orders/{number}/payments/{id:\d+}/check', 'Admin\OrdersController@checkPayment', ['perm' => 'orders.manage']);
        $r->post('/orders/{number}/refunds', 'Admin\OrdersController@createRefund', ['perm' => 'refunds.manage']);
        $r->get('/refunds', 'Admin\MoneyController@refunds', ['perm' => 'refunds.manage']);
        $r->post('/refunds/{id:\d+}', 'Admin\MoneyController@processRefund', ['perm' => 'refunds.manage']);
        $r->get('/returns', 'Admin\MoneyController@returns', ['perm' => 'refunds.manage']);
        $r->post('/returns/{id:\d+}', 'Admin\MoneyController@decideReturn', ['perm' => 'refunds.manage']);
        $r->get('/payouts', 'Admin\MoneyController@payouts', ['perm' => 'payouts.manage']);
        $r->post('/payouts/{id:\d+}', 'Admin\MoneyController@processPayout', ['perm' => 'payouts.manage']);
        $r->get('/payouts/{id:\d+}/account', 'Admin\MoneyController@payoutAccount', ['perm' => 'payouts.manage']);
        $r->get('/coupons', 'Admin\StoreSetupController@coupons', ['perm' => 'coupons.manage']);
        $r->post('/coupons', 'Admin\StoreSetupController@saveCoupon', ['perm' => 'coupons.manage']);
        $r->get('/shipping', 'Admin\StoreSetupController@shipping', ['perm' => 'shipping.manage']);
        $r->post('/shipping', 'Admin\StoreSetupController@saveShipping', ['perm' => 'shipping.manage']);

        $r->get('/pages', 'Admin\ContentController@pages', ['perm' => 'content.manage']);
        $r->get('/pages/new', 'Admin\ContentController@editPage', ['perm' => 'content.manage']);
        $r->get('/pages/{id:\d+}', 'Admin\ContentController@editPage', ['perm' => 'content.manage']);
        $r->post('/pages', 'Admin\ContentController@savePage', ['perm' => 'content.manage']);
        $r->get('/banners', 'Admin\ContentController@banners', ['perm' => 'content.manage']);
        $r->post('/banners', 'Admin\ContentController@saveBanner', ['perm' => 'content.manage']);
        $r->post('/banners/{id:\d+}/delete', 'Admin\ContentController@deleteBanner', ['perm' => 'content.manage']);
        $r->get('/messages', 'Admin\ContentController@messages', ['perm' => 'messages.manage']);
        $r->get('/messages/{id:\d+}', 'Admin\ContentController@message', ['perm' => 'messages.manage']);
        $r->post('/messages/{id:\d+}', 'Admin\ContentController@replyMessage', ['perm' => 'messages.manage']);

        $r->get('/settings', 'Admin\SettingsController@edit', ['perm' => 'settings.manage']);
        $r->post('/settings', 'Admin\SettingsController@update', ['perm' => 'settings.manage']);
        $r->post('/settings/test-mail', 'Admin\SettingsController@testMail', ['perm' => 'settings.manage']);
        $r->get('/system', 'Admin\SettingsController@system', ['perm' => 'settings.manage']);
        $r->post('/system/migrate', 'Admin\SettingsController@migrate', ['perm' => 'settings.manage']);
        $r->post('/system/cron', 'Admin\SettingsController@runCron', ['perm' => 'settings.manage']);
        $r->get('/audit', 'Admin\SettingsController@audit', ['perm' => 'audit.view']);
    });

    // Information
    $r->get('/pages/{slug}', 'PageController@show');
    $r->get('/contact', 'PageController@contact');
    $r->post('/contact', 'PageController@sendContact');
    $r->get('/sitemap.xml', 'PageController@sitemap', ['session' => false]);
    $r->get('/robots.txt', 'PageController@robots', ['session' => false]);
    $r->get('/manifest.webmanifest', 'PageController@manifest', ['session' => false]);
    $r->get('/offline', 'PageController@offline', ['session' => false]);
};
