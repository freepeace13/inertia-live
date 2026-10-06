<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Contracts\FlushesChanges;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Config\Repository as Config;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;

/**
 * Turns buffered changes into broadcasts once the database transaction has committed.
 */
final class ChangeFlusher implements FlushesChanges
{
    public function __construct(
        private readonly ChangeBuffer $buffer,
        private readonly CursorRepository $cursors,
        private readonly Dispatcher $events,
        private readonly DatabaseManager $db,
        private readonly RateLimiter $limiter,
        private readonly Config $config,
        private readonly LoggerInterface $logger,
        private readonly LiveManager $live,
    ) {}

    public function flush(): void
    {
        $changes = $this->buffer->drain();

        if ($changes === []) {
            return;
        }

        $this->db->afterCommit(function () use ($changes): void {
            foreach ($changes as $change) {
                $this->emit($change);
            }
        });
    }

    private function emit(Change $change): void
    {
        // The cursor tracks what the read model contains, so it is always recorded,
        // even when the signal itself is rate limited.
        $this->cursors->put($change->topic, $change->version);

        // Fail closed: nobody can subscribe to a private topic without an authorizer.
        if (! $change->public && ! $this->live->hasAuthorizerFor($change->topic)) {
            $this->logger->warning('Inertia Live topic has no authorizer; signal not sent.', ['topic' => $change->topic]);

            return;
        }

        $max = (int) $this->config->get('inertia-live.max_signals_per_second', 10);

        if ($this->limiter->tooManyAttempts($this->limiterKey($change), $max)) {
            $this->logger->warning('Inertia Live signal dropped by rate limit.', ['topic' => $change->topic]);

            return;
        }

        $this->limiter->hit($this->limiterKey($change), 1);

        if ($this->config->get('inertia-live.debug', false)) {
            $this->logger->debug('Inertia Live signal flushed.', [
                'topic' => $change->topic,
                'version' => $change->version,
                'props' => $change->props,
            ]);
        }

        $this->events->dispatch(new LiveChangeBroadcast($change));
    }

    private function limiterKey(Change $change): string
    {
        return 'inertia-live:signals:'.$change->topic;
    }
}
