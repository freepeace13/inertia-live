<?php

declare(strict_types=1);

return [
    'enabled' => env('INERTIA_LIVE_ENABLED', true),
    'channel_prefix' => 'live',
    'cursor_store' => env('INERTIA_LIVE_CURSOR_STORE'), // null = default cache
    'max_signals_per_second' => 10,
    'replay' => ['suppress' => true, 'final_signal' => false],
    'debug' => env('APP_DEBUG', false), // logs every flushed signal
];
