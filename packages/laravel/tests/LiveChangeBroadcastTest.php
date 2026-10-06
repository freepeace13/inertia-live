<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Change;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

it('broadcasts on a private channel by default', function () {
    $broadcast = new LiveChangeBroadcast(new Change('documents.abc', ['document']), 12);
    $channel = $broadcast->broadcastOn();

    expect($channel)->toBeInstanceOf(PrivateChannel::class)
        ->and($channel->name)->toBe('private-live.documents.abc')
        ->and($broadcast->broadcastAs())->toBe('live.changed');
});

it('broadcasts on a public channel when the topic is public', function () {
    $channel = (new LiveChangeBroadcast(new Change('workspaces.1'), 1, public: true))->broadcastOn();

    expect($channel)->toBeInstanceOf(Channel::class)
        ->and($channel)->not->toBeInstanceOf(PrivateChannel::class)
        ->and($channel->name)->toBe('live.workspaces.1');
});

it('honours a custom channel prefix', function () {
    config(['inertia-live.channel_prefix' => 'pulse']);

    expect((new LiveChangeBroadcast(new Change('documents.abc'), 1))->broadcastOn()->name)
        ->toBe('private-pulse.documents.abc');
});

it('carries only topic, version and prop keys', function () {
    $payload = (new LiveChangeBroadcast(new Change('documents.abc', ['document', 'activity']), 12))->broadcastWith();

    expect($payload)->toBe(['topic' => 'documents.abc', 'version' => 12, 'props' => ['document', 'activity']]);
});
