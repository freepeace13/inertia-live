<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\ChangeFlusher;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentProjector;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Spatie\EventSourcing\Facades\Projectionist;

beforeEach(function () {
    Event::fake([LiveChangeBroadcast::class]);
    Projectionist::addProjector(DocumentProjector::class);
});

it('sends exactly one signal per topic per request', function () {
    Route::post('/rename', function () {
        event(new DocumentRenamed('abc', 'one'));
        event(new DocumentRenamed('abc', 'two'));
        event(new DocumentRenamed('abc', 'three'));

        return response()->noContent();
    });

    $this->post('/rename')->assertNoContent();

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
    Event::assertDispatched(
        LiveChangeBroadcast::class,
        fn (LiveChangeBroadcast $e) => $e->change->topic === 'documents.abc' && $e->change->version === 3,
    );
});

it('does not broadcast before the transaction commits', function () {
    DB::beginTransaction();

    app(ChangeBuffer::class)->add(new Change('documents.abc', 5, ['document']));
    app(ChangeFlusher::class)->flush();

    Event::assertNotDispatched(LiveChangeBroadcast::class);

    DB::commit();

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
});

it('never broadcasts when the transaction rolls back', function () {
    DB::beginTransaction();

    app(ChangeBuffer::class)->add(new Change('documents.abc', 5, ['document']));
    app(ChangeFlusher::class)->flush();

    DB::rollBack();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(0);
});

it('records the cursor when flushing', function () {
    app(ChangeBuffer::class)->add(new Change('documents.abc', 5, ['document']));
    app(ChangeFlusher::class)->flush();

    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(5);
});

it('does nothing when the buffer is empty', function () {
    app(ChangeFlusher::class)->flush();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
});

it('rate limits signals per topic but still advances the cursor', function () {
    config(['inertia-live.max_signals_per_second' => 2]);

    foreach ([1, 2, 3] as $version) {
        app(ChangeBuffer::class)->add(new Change('documents.abc', $version, ['document']));
        app(ChangeFlusher::class)->flush();
    }

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 2);
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(3);
});

it('flushes after a queue job is processed', function () {
    app(ChangeBuffer::class)->add(new Change('documents.abc', 5, ['document']));

    event(new JobProcessed('sync', Mockery::mock(Job::class)));

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
});
