<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Cursor\CursorRepository;

it('returns 0 for unknown topics', function () {
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(0);
});

it('stores the version and never moves backwards', function () {
    $cursors = app(CursorRepository::class);

    $cursors->put('documents.abc', 10);
    $cursors->put('documents.abc', 4);

    expect($cursors->get('documents.abc'))->toBe(10);

    $cursors->put('documents.abc', 11);

    expect($cursors->get('documents.abc'))->toBe(11);
});

it('keeps topics independent', function () {
    $cursors = app(CursorRepository::class);

    $cursors->put('documents.a', 3);

    expect($cursors->get('documents.b'))->toBe(0);
});

it('uses the configured cache store', function () {
    config(['cache.stores.cursors' => ['driver' => 'array']]);
    config(['inertia-live.cursor_store' => 'cursors']);
    app()->forgetInstance(CursorRepository::class);

    app(CursorRepository::class)->put('documents.abc', 5);

    expect(Cache::store('cursors')->get('inertia-live:cursor:documents.abc'))->toBe(5)
        ->and(Cache::store('array')->get('inertia-live:cursor:documents.abc'))->toBeNull();
});
