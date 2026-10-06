<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\InertiaLiveServiceProvider;

it('rejects an empty channel prefix', function () {
    config(['inertia-live.channel_prefix' => '']);

    (new InertiaLiveServiceProvider(app()))->boot();
})->throws(InvalidArgumentException::class, 'channel_prefix');

it('rejects a non-positive signal rate', function () {
    config(['inertia-live.max_signals_per_second' => 0]);

    (new InertiaLiveServiceProvider(app()))->boot();
})->throws(InvalidArgumentException::class, 'max_signals_per_second');

it('accepts the default config', function () {
    (new InertiaLiveServiceProvider(app()))->boot();

    expect(true)->toBeTrue();
});
