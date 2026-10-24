<?php
/**
 * এই ফাইলটি ইনস্টলার স্বয়ংক্রিয়ভাবে config.php নামে তৈরি করবে।
 * ম্যানুয়ালি ইনস্টল করতে চাইলে এই ফাইলের কপি করে config.php বানিয়ে
 * নিচের মান পরিবর্তন করুন।
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_username');
define('DB_PASS', 'your_database_password');

// এই লিংকটি আপনার সাইটের রুট ফোল্ডারের URL (শেষে স্ল্যাশ ছাড়া)
define('BASE_URL', 'https://example.com');

define('APP_NAME', 'Mallik Book House & Computer');
define('APP_DEVELOPER', 'Arieskonex Technologies');

// ইনভয়েস QR-কোড যাচাইকরণ টোকেনের জন্য গোপন কী — ইনস্টলের সময় এলোমেলো মান বসান
// (না বসালেও চলবে, কিন্তু নিরাপত্তার জন্য এলোমেলো একটি মান দেওয়া ভালো)
define('APP_SECRET', 'change-this-to-a-random-string');
