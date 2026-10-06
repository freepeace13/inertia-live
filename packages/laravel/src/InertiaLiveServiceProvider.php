<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Cursor\CacheCursorRepository;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Support\ServiceProvider;

final class InertiaLiveServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-live.php', 'inertia-live');

        $this->app->singleton(ChangeBuffer::class);
        $this->app->singleton(TopicResolver::class);
        $this->app->singleton(ChangeFlusher::class);
        $this->app->singleton(CursorRepository::class, fn ($app) => new CacheCursorRepository(
            $app['cache']->store($app['config']->get('inertia-live.cursor_store')),
        ));
    }

    public function boot(): void
    {
        $this->registerFlushPoints();

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
        $flush = fn () => $this->app->make(ChangeFlusher::class)->flush();

        $this->app->terminating($flush);

        $events = $this->app->make('events');
        $events->listen(JobProcessed::class, $flush);
        $events->listen(JobFailed::class, $flush);
    }
}
