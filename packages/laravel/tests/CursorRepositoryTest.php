<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Cursor\CacheCursorRepository;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;

it('returns 0 for unknown topics', function () {
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(0);
});

it('issues strictly increasing numbers and exposes the latest through get', function () {
    $cursors = app(CursorRepository::class);

    $first = $cursors->next('documents.abc');
    $second = $cursors->next('documents.abc');
    $third = $cursors->next('documents.abc');

    expect($second)->toBe($first + 1)
        ->and($third)->toBe($first + 2)
        ->and($cursors->get('documents.abc'))->toBe($third);
});

it('keeps topics independent', function () {
    $cursors = app(CursorRepository::class);

    $cursors->next('documents.a');

    expect($cursors->get('documents.b'))->toBe(0);
});

it('restarts above every earlier number after the store loses its data', function () {
    $cursors = app(CursorRepository::class);

    foreach (range(1, 50) as $_) {
        $cursors->next('documents.abc');
    }
    $before = $cursors->get('documents.abc');

    Cache::flush();

    expect($cursors->next('documents.abc'))->toBeGreaterThan($before);
});

it('uses the configured cache store', function () {
    config(['cache.stores.cursors' => ['driver' => 'array']]);
    config(['inertia-live.cursor_store' => 'cursors']);
    app()->forgetInstance(CursorRepository::class);

    $version = app(CursorRepository::class)->next('documents.abc');

    expect(Cache::store('cursors')->get('inertia-live:cursor:documents.abc'))->toBe($version)
        ->and(Cache::store('array')->get('inertia-live:cursor:documents.abc'))->toBeNull();
});

it('rejects a store without atomic increment', function () {
    $cache = Mockery::mock(Repository::class);
    $cache->shouldReceive('add')->andReturn(true);
    $cache->shouldReceive('increment')->andReturn(false);

    (new CacheCursorRepository($cache))->next('documents.abc');
})->throws(RuntimeException::class, 'atomic increment');
