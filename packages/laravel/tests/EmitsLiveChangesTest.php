<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentProjector;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Freepeace13\InertiaLive\Tests\Fixtures\PlainEvent;
use Spatie\EventSourcing\Facades\Projectionist;
use Spatie\EventSourcing\StoredEvents\Models\EloquentStoredEvent;

beforeEach(function () {
    DocumentProjector::$fail = false;
    DocumentProjector::$handled = [];
    Projectionist::addProjector(DocumentProjector::class);
});

it('buffers the topic with the stored event id after the handler returns', function () {
    event(new DocumentRenamed('abc', 'Q4'));

    $id = EloquentStoredEvent::query()->max('id');

    expect(DocumentProjector::$handled)->toBe(['abc'])
        ->and(app(ChangeBuffer::class)->drain())->toEqual([
            new Change('documents.abc', $id, ['document', 'activity']),
        ]);
});

it('buffers nothing when the handler throws', function () {
    DocumentProjector::$fail = true;

    try {
        event(new DocumentRenamed('abc', 'Q4'));
    } catch (Throwable) {
    }

    expect(app(ChangeBuffer::class)->isEmpty())->toBeTrue();
});

it('supports explicit liveChanged() calls for events without the attribute', function () {
    event(new PlainEvent('abc'));

    $changes = app(ChangeBuffer::class)->drain();

    expect($changes)->toHaveCount(1)
        ->and($changes[0]->topic)->toBe('documents.abc')
        ->and($changes[0]->props)->toBe(['document']);
});

it('does nothing when disabled', function () {
    config(['inertia-live.enabled' => false]);

    event(new DocumentRenamed('abc', 'Q4'));

    expect(app(ChangeBuffer::class)->isEmpty())->toBeTrue();
});
