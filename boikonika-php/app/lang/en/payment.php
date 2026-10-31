<?php
return [
    'notPayable' => 'This order doesn’t need a payment.',
    'startFailed' => 'We couldn’t open the payment page. Please try again in a moment.',
    'result' => [
        'success' => 'Payment received. Thank you!',
        'failed' => 'The payment didn’t go through. You can try again.',
        'cancelled' => 'You cancelled the payment. You can pay again before the time runs out.',
        'retry' => 'We’re still waiting for the payment to be confirmed. This page will show it once it arrives.',
        'check' => 'We couldn’t confirm the payment yet. If money left your account, it will show here shortly — please don’t pay twice.',
    ],
    'payNow' => 'Pay :amount now',
    'dueBy' => 'Pay by :time or the order will be cancelled automatically.',
];
