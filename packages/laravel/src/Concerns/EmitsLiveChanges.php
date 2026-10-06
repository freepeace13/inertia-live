<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Concerns;

use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\TopicResolver;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;
use Spatie\EventSourcing\Projectionist;
use Spatie\EventSourcing\StoredEvents\StoredEvent;

/**
 * Marks topics as changed after a projector handler has returned.
 *
 * Hook point: Spatie's `HandlesEvents::handle(StoredEvent)` invokes every matching
 * handler method. Overriding it in the projector lets us run after the read model is
 * written, and `$storedEvent->id` is the version the projector just applied.
 *
 * @phpstan-require-extends Projector
 */
trait EmitsLiveChanges
{
    private ?int $liveVersion = null;

    public function handle(StoredEvent $storedEvent): void
    {
        $this->liveVersion = $storedEvent->id;

        try {
            parent::handle($storedEvent);

            foreach (app(TopicResolver::class)->forEvent($storedEvent->event) as $topic) {
                $this->liveChanged($topic->topic, $topic->props, $topic->public);
            }
        } finally {
            $this->liveVersion = null;
        }
    }

    /**
     * @param  list<string>  $props
     */
    protected function liveChanged(string $topic, array $props = [], bool $public = false): void
    {
        if ($this->liveVersion === null || ! $this->liveEmissionEnabled()) {
            return;
        }

        app(ChangeBuffer::class)->add(new Change($topic, $this->liveVersion, $props, $public));
    }

    private function liveEmissionEnabled(): bool
    {
        if (! config('inertia-live.enabled', true)) {
            return false;
        }

        return ! (config('inertia-live.replay.suppress', true) && app(Projectionist::class)->isReplaying());
    }
}
