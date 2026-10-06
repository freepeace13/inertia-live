<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Schema;

it('merges the package config', function () {
    expect(config('inertia-live.channel_prefix'))->toBe('live')
        ->and(config('inertia-live.max_signals_per_second'))->toBe(10);
});

it('creates the stored events table', function () {
    expect(Schema::hasTable('stored_events'))->toBeTrue();
});
