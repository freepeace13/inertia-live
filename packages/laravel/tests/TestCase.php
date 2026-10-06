<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Tests;

use Freepeace13\InertiaLive\InertiaLiveServiceProvider;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Foundation\Application;
use Inertia\ServiceProvider as InertiaServiceProvider;
use Orchestra\Testbench\TestCase as Orchestra;
use Spatie\EventSourcing\EventSourcingServiceProvider;

abstract class TestCase extends Orchestra
{
    /**
     * @param  Application  $app
     * @return list<class-string>
     */
    protected function getPackageProviders($app): array
    {
        return [
            InertiaServiceProvider::class,
            EventSourcingServiceProvider::class,
            InertiaLiveServiceProvider::class,
        ];
    }

    /**
     * @param  Application  $app
     */
    protected function defineEnvironment($app): void
    {
        tap($app['config'], function (Repository $config) {
            $config->set('database.default', 'testing');
            $config->set('cache.default', 'array');
            $config->set('broadcasting.default', 'null');
        });
    }

    protected function defineDatabaseMigrations(): void
    {
        $migration = require __DIR__.'/../vendor/spatie/laravel-event-sourcing/database/migrations/create_stored_events_table.php.stub';
        $migration->up();
    }
}
