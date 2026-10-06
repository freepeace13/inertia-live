<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Illuminate\Support\ServiceProvider;

final class InertiaLiveServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/inertia-live.php', 'inertia-live');

        $this->app->singleton(ChangeBuffer::class);
        $this->app->singleton(TopicResolver::class);
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
