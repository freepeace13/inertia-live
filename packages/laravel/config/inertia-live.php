<?php

declare(strict_types=1);

return [
    'enabled' => env('INERTIA_LIVE_ENABLED', true),
    'channel_prefix' => 'live',
    'cursor_store' => env('INERTIA_LIVE_CURSOR_STORE'), // null = default cache
    'cursor_ttl' => 60 * 60 * 24 * 30, // seconds after a topic's last change; null = never expire
    'max_signals_per_second' => 10, // excess signals collapse into one trailing signal
    'replay' => ['suppress' => true, 'final_signal' => false],
    'debug' => env('APP_DEBUG', false), // logs every flushed signal
];
