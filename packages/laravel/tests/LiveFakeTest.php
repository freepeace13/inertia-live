<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Facades\Live;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentProjector;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\AssertionFailedError;
use Spatie\EventSourcing\Facades\Projectionist;

beforeEach(function () {
    Projectionist::addProjector(DocumentProjector::class);

    Route::post('/rename', function () {
        event(new DocumentRenamed('abc', 'one'));
        event(new DocumentRenamed('abc', 'two'));

        return response()->noContent();
    });
});

it('records changes made during a request', function () {
    Live::fake();

    $this->post('/rename')->assertNoContent();

    Live::assertChanged('documents.abc', props: ['document']);
    Live::assertChanged('documents.abc');
    Live::assertNothingChangedFor('documents.other');
});

it('proves coalescing with assertChangedTimes', function () {
    Live::fake();

    $this->post('/rename');

    Live::assertChangedTimes('documents.abc', 1);
});

it('does not broadcast while faked', function () {
    Event::fake([LiveChangeBroadcast::class]);
    Live::fake();

    $this->post('/rename');

    Event::assertNotDispatched(LiveChangeBroadcast::class);
});

it('fails assertions that do not hold', function () {
    Live::fake();

    $this->post('/rename');

    expect(fn () => Live::assertChanged('documents.other'))->toThrow(AssertionFailedError::class)
        ->and(fn () => Live::assertNothingChangedFor('documents.abc'))->toThrow(AssertionFailedError::class)
        ->and(fn () => Live::assertChanged('documents.abc', props: ['nope']))->toThrow(AssertionFailedError::class)
        ->and(fn () => Live::assertChangedTimes('documents.abc', 2))->toThrow(AssertionFailedError::class);
});

it('still delegates authorizers while faked', function () {
    Live::fake();
    Live::authorize('documents.{uuid}', fn () => true);

    expect(Live::hasAuthorizerFor('documents.abc'))->toBeTrue();
});
