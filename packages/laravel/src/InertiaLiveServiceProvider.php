<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Cursor\CacheCursorRepository;
use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Support\ServiceProvider;

final class InertiaLiveServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-live.php', 'inertia-live');

        $this->app->singleton(ChangeBuffer::class);
        $this->app->singleton(TopicResolver::class);
        $this->app->singleton(CursorRepository::class, fn ($app) => new CacheCursorRepository(
            $app['cache']->store($app['config']->get('inertia-live.cursor_store')),
        ));
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__.'/../config/inertia-live.php' => config_path('inertia-live.php'),
            ], 'inertia-live-config');
        }
    }
}
