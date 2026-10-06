<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Facades\Live;
use Freepeace13\InertiaLive\Tests\Fixtures\TestBroadcaster;
use Illuminate\Support\Facades\Broadcast;

beforeEach(function () {
    $broadcaster = new TestBroadcaster;
    $this->broadcaster = $broadcaster;
    Broadcast::extend('testing', fn () => $broadcaster);
    config(['broadcasting.default' => 'testing', 'broadcasting.connections.testing' => ['driver' => 'testing']]);
});

it('lets authorized users subscribe and passes topic parameters', function () {
    Live::authorize('documents.{uuid}', fn ($user, string $uuid) => $user->id === 1 && $uuid === 'abc');

    expect($this->broadcaster->canAccess((object) ['id' => 1], 'live.documents.abc'))->toBeTrue()
        ->and($this->broadcaster->canAccess((object) ['id' => 2], 'live.documents.abc'))->toBeFalse()
        ->and($this->broadcaster->canAccess((object) ['id' => 1], 'live.documents.other'))->toBeFalse();
});

it('denies topics with no registered authorizer', function () {
    Live::authorize('documents.{uuid}', fn () => true);

    expect($this->broadcaster->canAccess((object) ['id' => 1], 'live.invoices.1'))->toBeFalse();
});

it('uses the configured channel prefix', function () {
    config(['inertia-live.channel_prefix' => 'pulse']);

    Live::authorize('documents.{uuid}', fn () => true);

    expect($this->broadcaster->canAccess((object) ['id' => 1], 'pulse.documents.abc'))->toBeTrue();
});

it('knows which topics have an authorizer', function () {
    Live::authorize('documents.{uuid}', fn () => true);

    expect(Live::hasAuthorizerFor('documents.abc'))->toBeTrue()
        ->and(Live::hasAuthorizerFor('documents.abc.extra'))->toBeFalse()
        ->and(Live::hasAuthorizerFor('invoices.1'))->toBeFalse();
});

it('knows which topic patterns are public', function () {
    Live::publicTopic('workspaces.{id}');

    expect(Live::isPublic('workspaces.7'))->toBeTrue()
        ->and(Live::isPublic('documents.7'))->toBeFalse();
});

it('refuses a pattern registered as both public and private', function () {
    Live::authorize('documents.{uuid}', fn () => true);
    Live::publicTopic('documents.{uuid}');
})->throws(InvalidArgumentException::class, 'already registered as private');
