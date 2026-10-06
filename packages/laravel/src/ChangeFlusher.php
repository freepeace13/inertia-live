<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Contracts\FlushesChanges;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Freepeace13\InertiaLive\Jobs\SendTrailingSignal;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Cache\Factory as CacheFactory;
use Illuminate\Contracts\Config\Repository as Config;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;
use Throwable;

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
        private readonly CacheFactory $cache,
    ) {}

    public function flush(): void
    {
        $changes = $this->buffer->drain();

        if ($changes === []) {
            return;
        }

        $this->db->afterCommit(function () use ($changes): void {
            // One failing topic (cache lock timeout, unreachable broadcaster) must not drop the rest.
            foreach ($changes as $change) {
                try {
                    $this->emit($change);
                } catch (Throwable $e) {
                    $this->logger->error('Inertia Live failed to flush a change.', [
                        'topic' => $change->topic,
                        'exception' => $e,
                    ]);
                }
            }
        });
    }

    private function emit(Change $change): void
    {
        // Every change takes the topic's next sequence number, so each signal is newer than the
        // last and none is dropped as stale. It is taken even if the signal is then rate
        // limited, so pages rendered later start from the right cursor.
        $version = $this->cursors->next($change->topic);

        $public = $this->live->isPublic($change->topic);

        // Fail closed: nobody can subscribe to a private topic without an authorizer.
        if (! $public && ! $this->live->hasAuthorizerFor($change->topic)) {
            $this->logger->warning('Inertia Live topic has no authorizer; signal not sent.', ['topic' => $change->topic]);

            return;
        }

        $max = (int) $this->config->get('inertia-live.max_signals_per_second', 10);

        if ($this->limiter->tooManyAttempts($this->limiterKey($change), $max)) {
            $this->scheduleTrailingSignal($change->topic);

            return;
        }

        $this->limiter->hit($this->limiterKey($change), 1);

        if ($this->config->get('inertia-live.debug', false)) {
            $this->logger->debug('Inertia Live signal flushed.', [
                'topic' => $change->topic,
                'version' => $version,
                'props' => $change->props,
            ]);
        }

        $this->events->dispatch(new LiveChangeBroadcast($change, $version, $public));
    }

    /**
     * The window's excess signals are not dropped, they collapse into one signal sent when
     * the window ends. A single marker per topic keeps a burst to a single queued job.
     */
    private function scheduleTrailingSignal(string $topic): void
    {
        $store = $this->cache->store($this->config->get('inertia-live.cursor_store'));

        if ($store->add('inertia-live:trailing:'.$topic, true, 1)) {
            SendTrailingSignal::dispatch($topic)->delay(1);
        }
    }

    private function limiterKey(Change $change): string
    {
        return 'inertia-live:signals:'.$change->topic;
    }
}
