<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\Facades\Live;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Freepeace13\InertiaLive\Tests\Fixtures\QueuedDocumentProjector;
use Illuminate\Support\Facades\Event;
use Spatie\EventSourcing\Facades\Projectionist;
use Spatie\EventSourcing\StoredEvents\Models\EloquentStoredEvent;

beforeEach(function () {
    Live::authorize('documents.{uuid}', fn () => true);
});

it('uses the applied stored event id as the version for queued projectors, not the latest id', function () {
    Event::fake([LiveChangeBroadcast::class]);
    config(['queue.default' => 'sync']);
    Projectionist::addProjector(QueuedDocumentProjector::class);

    event(new DocumentRenamed('abc', 'one'));
    $firstId = (int) EloquentStoredEvent::query()->max('id');

    // A newer event exists in the store before the first one is flushed.
    Projectionist::withoutEventHandlers();
    event(new DocumentRenamed('abc', 'two'));

    Event::assertDispatched(
        LiveChangeBroadcast::class,
        fn (LiveChangeBroadcast $e) => $e->change->version === $firstId,
    );
    expect(EloquentStoredEvent::query()->max('id'))->toBeGreaterThan($firstId);
});

it('excludes the sender socket from the broadcast', function () {
    request()->headers->set('X-Socket-ID', '123.456');

    $broadcast = new LiveChangeBroadcast(new Change('documents.abc', 1));

    expect($broadcast->socket)->toBe('123.456');
});
