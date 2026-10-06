<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Concerns;

use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\ReplayBuffer;
use Freepeace13\InertiaLive\TopicResolver;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;
use Spatie\EventSourcing\Projectionist;
use Spatie\EventSourcing\StoredEvents\StoredEvent;

/**
 * Marks topics as changed after a projector handler has returned.
 *
 * Hook point: Spatie's `HandlesEvents::handle(StoredEvent)` invokes every matching
 * handler method. Overriding it in the projector lets us run after the read model is
 * written. The signal's version is assigned later, by the flusher, not taken from the event.
 *
 * @phpstan-require-extends Projector
 */
trait EmitsLiveChanges
{
    private bool $handlingLiveEvent = false;

    public function handle(StoredEvent $storedEvent): void
    {
        $this->handlingLiveEvent = true;

        try {
            parent::handle($storedEvent);

            foreach (app(TopicResolver::class)->forEvent($storedEvent->event) as $topic) {
                $this->liveChanged($topic->topic, $topic->props);
            }
        } finally {
            $this->handlingLiveEvent = false;
        }
    }

    /**
     * @param  list<string>  $props
     */
    protected function liveChanged(string $topic, array $props = []): void
    {
        if (! $this->handlingLiveEvent || ! config('inertia-live.enabled', true)) {
            return;
        }

        $change = new Change($topic, $props);

        if (app(Projectionist::class)->isReplaying() && config('inertia-live.replay.suppress', true)) {
            // Replays touch every event; keep only one change per topic if requested.
            if (config('inertia-live.replay.final_signal', false)) {
                app(ReplayBuffer::class)->add($change);
            }

            return;
        }

        // The transaction level lets a rollback discard changes whose read-model writes were undone.
        app(ChangeBuffer::class)->add($change, app('db')->connection()->transactionLevel());
    }
}
