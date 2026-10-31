<?php
// Example only. The installer (/install/) writes app/config.php for you.
// Never commit app/config.php: it holds the database password and the encryption key.
return [
    'url' => 'https://example.com',          // the site's public address, no trailing slash
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'cpaneluser_boikonika',
        'user' => 'cpaneluser_boikonika',
        'pass' => 'change-me',
    ],
    'app_key' => 'base64 of 32 random bytes', // php -r "echo base64_encode(random_bytes(32));"
    'cron_key' => 'random hex',               // php -r "echo bin2hex(random_bytes(16));"
    'timezone' => 'Asia/Dhaka',
    'debug' => false,                         // never true on a live site
    'trust_proxy' => false,                   // true behind Cloudflare or another proxy
];
