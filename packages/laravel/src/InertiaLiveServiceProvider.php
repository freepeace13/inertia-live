<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Contracts\FlushesChanges;
use Freepeace13\InertiaLive\Cursor\CacheCursorRepository;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Database\Events\TransactionRolledBack;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;
use Spatie\EventSourcing\Events\FinishedEventReplay;

final class InertiaLiveServiceProvider extends ServiceProvider
{
    private const OCTANE_REQUEST_TERMINATED = 'Laravel\\Octane\\Events\\RequestTerminated';

    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-live.php', 'inertia-live');

        $this->app->singleton(ChangeBuffer::class);
        $this->app->singleton(ReplayBuffer::class);
        $this->app->singleton(TopicResolver::class);
        $this->app->singleton(ChangeFlusher::class);
        $this->app->bind(FlushesChanges::class, ChangeFlusher::class);
        $this->app->singleton(LiveManager::class);
        $this->app->bind(LiveBindings::class);
        $this->app->singleton(CursorRepository::class, function ($app) {
            $ttl = $app['config']->get('inertia-live.cursor_ttl');

            return new CacheCursorRepository(
                $app['cache']->store($app['config']->get('inertia-live.cursor_store')),
                $ttl === null ? null : (int) $ttl,
            );
        });
    }

    public function boot(): void
    {
        $this->validateConfig();

        $this->registerFlushPoints();

        LiveResponseMacro::register();

        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/inertia-live.php' => config_path('inertia-live.php'),
            ], 'inertia-live-config');
        }
    }

    /**
     * Flush at the end of every request/command and after every queue job.
     */
    private function registerFlushPoints(): void
    {
        // Resolve through `app()` rather than `$this->app`: under Octane the provider keeps the
        // worker's base container while requests run in sandboxes, and the buffer is a singleton.
        $flush = fn () => app(FlushesChanges::class)->flush();

        $this->app->terminating($flush);

        $events = $this->app->make('events');
        $events->listen(JobProcessed::class, $flush);
        $events->listen(JobFailed::class, $flush);

        // A rolled-back transaction undid the read-model writes its changes describe.
        $events->listen(TransactionRolledBack::class, function (TransactionRolledBack $event): void {
            app(ChangeBuffer::class)->rollBackTo($event->connection->transactionLevel());
        });

        // Octane (untested): flush against the request's own container. Flushing twice is harmless.
        if (class_exists(self::OCTANE_REQUEST_TERMINATED)) {
            $events->listen(self::OCTANE_REQUEST_TERMINATED, function (object $event): void {
                /** @phpstan-ignore-next-line */
                $event->sandbox->make(FlushesChanges::class)->flush();
            });
        }

        // After a replay, optionally emit one signal per touched topic.
        $events->listen(FinishedEventReplay::class, function () use ($flush): void {
            $changes = app(ReplayBuffer::class)->drain();

            foreach ($changes as $change) {
                app(ChangeBuffer::class)->add($change);
            }

            $flush();
        });
    }

    private function validateConfig(): void
    {
        $config = $this->app['config'];

        if (! is_string($config->get('inertia-live.channel_prefix')) || $config->get('inertia-live.channel_prefix') === '') {
            throw new InvalidArgumentException('inertia-live.channel_prefix must be a non-empty string.');
        }

        if ((int) $config->get('inertia-live.max_signals_per_second') < 1) {
            throw new InvalidArgumentException('inertia-live.max_signals_per_second must be at least 1.');
        }
    }
}
