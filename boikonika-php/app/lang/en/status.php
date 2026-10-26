<?php
return [
    'order' => ['awaiting_payment' => 'Awaiting payment', 'placed' => 'Placed', 'completed' => 'Completed', 'cancelled' => 'Cancelled'],
    'parcel' => ['awaiting_payment' => 'Awaiting payment', 'pending' => 'Waiting for the seller', 'confirmed' => 'Confirmed', 'processing' => 'Being packed', 'shipped' => 'Shipped', 'delivered' => 'Delivered', 'cancelled' => 'Cancelled', 'returned' => 'Returned'],
    'payment' => ['unpaid' => 'Pay on delivery', 'pending' => 'Payment pending', 'paid' => 'Paid', 'failed' => 'Payment failed', 'refunded' => 'Refunded', 'partially_refunded' => 'Partly refunded', 'cancelled' => 'Cancelled'],
    'attempt' => ['initiated' => 'Started', 'pending' => 'Pending', 'paid' => 'Paid', 'failed' => 'Failed', 'cancelled' => 'Cancelled', 'expired' => 'Expired'],
    'seller' => ['pending' => 'Under review', 'approved' => 'Approved', 'rejected' => 'Not approved', 'suspended' => 'Suspended'],
    'product' => ['pending' => 'Waiting for review', 'active' => 'Live', 'rejected' => 'Not approved', 'archived' => 'Archived'],
    'listing' => ['active' => 'On sale', 'paused' => 'Paused', 'suspended' => 'Suspended by Boikonika'],
    'refund' => ['requested' => 'Requested', 'processing' => 'Processing', 'completed' => 'Completed', 'failed' => 'Failed', 'rejected' => 'Rejected'],
    'return' => ['requested' => 'Requested', 'approved' => 'Approved — send it back', 'rejected' => 'Declined', 'received' => 'Received by the seller', 'refunded' => 'Refunded', 'cancelled' => 'Cancelled'],
    'payout' => ['requested' => 'Requested', 'processing' => 'Processing', 'paid' => 'Paid', 'rejected' => 'Rejected', 'cancelled' => 'Cancelled'],
    'user' => ['active' => 'Active', 'suspended' => 'Suspended', 'deleted' => 'Deleted'],
    'message' => ['new' => 'New', 'open' => 'Open', 'replied' => 'Replied', 'closed' => 'Closed'],
    'review' => ['published' => 'Published', 'hidden' => 'Hidden'],
    'condition' => ['new' => 'New', 'like_new' => 'Used — like new', 'good' => 'Used — good', 'acceptable' => 'Used — acceptable'],
    'method' => ['cod' => 'Cash on delivery', 'bkash' => 'bKash', 'sslcommerz' => 'Card, Nagad, Rocket or internet banking'],
    'payoutMethod' => ['bkash' => 'bKash', 'nagad' => 'Nagad', 'rocket' => 'Rocket', 'bank' => 'Bank account'],
];
