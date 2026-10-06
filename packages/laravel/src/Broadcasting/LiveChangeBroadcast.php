<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Broadcasting;

use Freepeace13\InertiaLive\Change;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

final class LiveChangeBroadcast implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public readonly Change $change)
    {
        // Skip the sender's own socket (X-Socket-ID); they already get fresh props from Inertia.
        $this->dontBroadcastToCurrentUser();
    }

    public function broadcastOn(): Channel
    {
        $name = config('inertia-live.channel_prefix', 'live').'.'.$this->change->topic;

        return $this->change->public ? new Channel($name) : new PrivateChannel($name);
    }

    public function broadcastAs(): string
    {
        return 'live.changed';
    }

    /**
     * The signal never carries model data: topic, version and affected prop keys only.
     *
     * @return array{topic: string, version: int, props: list<string>}
     */
    public function broadcastWith(): array
    {
        return [
            'topic' => $this->change->topic,
            'version' => $this->change->version,
            'props' => $this->change->props,
        ];
    }
}
