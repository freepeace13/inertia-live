<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\ChangeFlusher;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Freepeace13\InertiaLive\Facades\Live;
use Freepeace13\InertiaLive\Jobs\SendTrailingSignal;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentProjector;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Route;
use Spatie\EventSourcing\Facades\Projectionist;

beforeEach(function () {
    Event::fake([LiveChangeBroadcast::class]);
    Projectionist::addProjector(DocumentProjector::class);
    Live::authorize('documents.{uuid}', fn () => true);
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
        fn (LiveChangeBroadcast $e) => $e->change->topic === 'documents.abc' && $e->change->props === ['document', 'activity'],
    );
});

it('does not broadcast before the transaction commits', function () {
    DB::beginTransaction();

    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
    app(ChangeFlusher::class)->flush();

    Event::assertNotDispatched(LiveChangeBroadcast::class);

    DB::commit();

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
});

it('never broadcasts when the transaction rolls back', function () {
    DB::beginTransaction();

    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
    app(ChangeFlusher::class)->flush();

    DB::rollBack();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(0);
});

it('broadcasts the topic sequence number and records it as the cursor', function () {
    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
    app(ChangeFlusher::class)->flush();

    $cursor = app(CursorRepository::class)->get('documents.abc');

    expect($cursor)->toBeGreaterThan(0);
    Event::assertDispatched(LiveChangeBroadcast::class, fn (LiveChangeBroadcast $e) => $e->version === $cursor);
});

it('gives every flush a newer version, however many projectors touched the topic', function () {
    $versions = [];

    // E.g. a sync projector flushing with the request, then a queued projector with its job.
    foreach (['sync projector', 'queued projector', 'another worker'] as $_) {
        app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
        app(ChangeFlusher::class)->flush();
        $versions[] = app(CursorRepository::class)->get('documents.abc');
    }

    expect($versions)->toBe(collect($versions)->unique()->sort()->values()->all());
    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 3);
});

it('does nothing when the buffer is empty', function () {
    app(ChangeFlusher::class)->flush();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
});

it('rate limits signals per topic but still advances the cursor', function () {
    Queue::fake();
    config(['inertia-live.max_signals_per_second' => 2]);

    $before = app(CursorRepository::class)->get('documents.abc');

    foreach ([1, 2, 3] as $_) {
        app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
        app(ChangeFlusher::class)->flush();
    }

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 2);
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(app(CursorRepository::class)->get('documents.abc'))
        ->and(app(CursorRepository::class)->get('documents.abc'))->toBeGreaterThan($before);
});

it('sends one trailing signal for a rate limited burst instead of dropping it', function () {
    Queue::fake();
    config(['inertia-live.max_signals_per_second' => 1]);

    foreach ([1, 2, 3, 4] as $_) {
        app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
        app(ChangeFlusher::class)->flush();
    }

    Queue::assertPushed(SendTrailingSignal::class, 1);

    // When the window ends the job announces the latest cursor for everything bound.
    app()->call([new SendTrailingSignal('documents.abc'), 'handle']);

    $latest = app(CursorRepository::class)->get('documents.abc');

    Event::assertDispatched(
        LiveChangeBroadcast::class,
        fn (LiveChangeBroadcast $e) => $e->version === $latest && $e->change->props === [],
    );
});

it('flushes after a queue job is processed', function () {
    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));

    event(new JobProcessed('sync', Mockery::mock(Job::class)));

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
});

it('fails closed and logs a warning for private topics without an authorizer', function () {
    Log::spy();

    app(ChangeBuffer::class)->add(new Change('invoices.1', ['invoice']));
    app(ChangeFlusher::class)->flush();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
    Log::shouldHaveReceived('warning')->once();
});

it('still sends public topics without an authorizer', function () {
    Live::publicTopic('workspaces.{id}');

    app(ChangeBuffer::class)->add(new Change('workspaces.1', ['documents']));
    app(ChangeFlusher::class)->flush();

    Event::assertDispatched(LiveChangeBroadcast::class, fn (LiveChangeBroadcast $e) => $e->public === true);
});

it('keeps flushing other topics when one fails', function () {
    Log::spy();
    Live::authorize('folders.{uuid}', fn () => true);

    app()->instance(CursorRepository::class, new class implements CursorRepository
    {
        public function get(string $topic): int
        {
            return 0;
        }

        public function next(string $topic): int
        {
            if ($topic === 'documents.abc') {
                throw new RuntimeException('lock timeout');
            }

            return 1;
        }
    });

    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
    app(ChangeBuffer::class)->add(new Change('folders.x', ['documents']));
    app()->forgetInstance(ChangeFlusher::class);
    app(ChangeFlusher::class)->flush();

    Event::assertDispatched(LiveChangeBroadcast::class, fn (LiveChangeBroadcast $e) => $e->change->topic === 'folders.x');
    Log::shouldHaveReceived('error')->once();
});

it('discards changes from a transaction that rolled back during the request', function () {
    Route::post('/rolled-back', function () {
        try {
            DB::transaction(function () {
                event(new DocumentRenamed('abc', 'one'));

                throw new RuntimeException('abort');
            });
        } catch (RuntimeException) {
            // The request carries on, as controllers commonly do.
        }

        return response()->noContent();
    });

    $this->post('/rolled-back')->assertNoContent();

    Event::assertNotDispatched(LiveChangeBroadcast::class);
    expect(app(CursorRepository::class)->get('documents.abc'))->toBe(0);
});

it('keeps changes made outside the rolled back transaction', function () {
    Route::post('/partly', function () {
        event(new DocumentRenamed('kept', 'one'));

        try {
            DB::transaction(function () {
                event(new DocumentRenamed('lost', 'two'));

                throw new RuntimeException('abort');
            });
        } catch (RuntimeException) {
        }

        return response()->noContent();
    });

    $this->post('/partly');

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
    Event::assertDispatched(LiveChangeBroadcast::class, fn (LiveChangeBroadcast $e) => $e->change->topic === 'documents.kept');
});
