<?php
return [
    'order' => ['awaiting_payment' => 'পেমেন্টের অপেক্ষায়', 'placed' => 'অর্ডার হয়েছে', 'completed' => 'সম্পন্ন', 'cancelled' => 'বাতিল'],
    'parcel' => ['awaiting_payment' => 'পেমেন্টের অপেক্ষায়', 'pending' => 'বিক্রেতার অপেক্ষায়', 'confirmed' => 'নিশ্চিত', 'processing' => 'প্যাক হচ্ছে', 'shipped' => 'পাঠানো হয়েছে', 'delivered' => 'ডেলিভারি সম্পন্ন', 'cancelled' => 'বাতিল', 'returned' => 'ফেরত'],
    'payment' => ['unpaid' => 'ডেলিভারিতে পরিশোধ', 'pending' => 'পেমেন্ট অপেক্ষমাণ', 'paid' => 'পরিশোধিত', 'failed' => 'পেমেন্ট ব্যর্থ', 'refunded' => 'রিফান্ড হয়েছে', 'partially_refunded' => 'আংশিক রিফান্ড', 'cancelled' => 'বাতিল'],
    'attempt' => ['initiated' => 'শুরু হয়েছে', 'pending' => 'অপেক্ষমাণ', 'paid' => 'পরিশোধিত', 'failed' => 'ব্যর্থ', 'cancelled' => 'বাতিল', 'expired' => 'মেয়াদোত্তীর্ণ'],
    'seller' => ['pending' => 'যাচাই চলছে', 'approved' => 'অনুমোদিত', 'rejected' => 'অনুমোদিত হয়নি', 'suspended' => 'স্থগিত'],
    'product' => ['pending' => 'যাচাইয়ের অপেক্ষায়', 'active' => 'চালু', 'rejected' => 'অনুমোদিত হয়নি', 'archived' => 'আর্কাইভকৃত'],
    'listing' => ['active' => 'বিক্রি চলছে', 'paused' => 'বিরতিতে', 'suspended' => 'বইকণিকা স্থগিত করেছে'],
    'refund' => ['requested' => 'অনুরোধ করা হয়েছে', 'processing' => 'প্রক্রিয়াধীন', 'completed' => 'সম্পন্ন', 'failed' => 'ব্যর্থ', 'rejected' => 'প্রত্যাখ্যাত'],
    'return' => ['requested' => 'অনুরোধ করা হয়েছে', 'approved' => 'অনুমোদিত — ফেরত পাঠান', 'rejected' => 'প্রত্যাখ্যাত', 'received' => 'বিক্রেতা পেয়েছেন', 'refunded' => 'টাকা ফেরত দেওয়া হয়েছে', 'cancelled' => 'বাতিল'],
    'payout' => ['requested' => 'অনুরোধ করা হয়েছে', 'processing' => 'প্রক্রিয়াধীন', 'paid' => 'পরিশোধিত', 'rejected' => 'প্রত্যাখ্যাত', 'cancelled' => 'বাতিল'],
    'user' => ['active' => 'সক্রিয়', 'suspended' => 'স্থগিত', 'deleted' => 'মুছে ফেলা'],
    'message' => ['new' => 'নতুন', 'open' => 'খোলা', 'replied' => 'উত্তর দেওয়া হয়েছে', 'closed' => 'বন্ধ'],
    'review' => ['published' => 'প্রকাশিত', 'hidden' => 'লুকানো'],
    'condition' => ['new' => 'নতুন', 'like_new' => 'পুরোনো — নতুনের মতো', 'good' => 'পুরোনো — ভালো', 'acceptable' => 'পুরোনো — চলনসই'],
    'method' => ['cod' => 'ক্যাশ অন ডেলিভারি', 'bkash' => 'বিকাশ', 'sslcommerz' => 'কার্ড, নগদ, রকেট বা ইন্টারনেট ব্যাংকিং'],
    'payoutMethod' => ['bkash' => 'বিকাশ', 'nagad' => 'নগদ', 'rocket' => 'রকেট', 'bank' => 'ব্যাংক অ্যাকাউন্ট'],
];
