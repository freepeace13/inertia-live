<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Facades;

use Closure;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\Contracts\FlushesChanges;
use Freepeace13\InertiaLive\LiveManager;
use Freepeace13\InertiaLive\Testing\LiveFake;
use Illuminate\Support\Facades\Facade;

/**
 * @method static void authorize(string $pattern, Closure $callback)
 * @method static void publicTopic(string $pattern)
 * @method static bool isPublic(string $topic)
 * @method static bool hasAuthorizerFor(string $topic)
 * @method static void assertChanged(string $topic, ?array<int, string> $props = null)
 * @method static void assertNothingChangedFor(string $topic)
 * @method static void assertChangedTimes(string $topic, int $times)
 *
 * @see LiveManager
 */
final class Live extends Facade
{
    /**
     * Record flushed changes instead of broadcasting them.
     */
    public static function fake(): LiveFake
    {
        $fake = new LiveFake(app(ChangeBuffer::class), app(LiveManager::class));

        // Not `Facade::swap()`: that rebinds LiveManager::class to the fake, so a second
        // `fake()` (or anything resolving the real manager) would receive a LiveFake.
        app()->instance(FlushesChanges::class, $fake);
        app()->instance(LiveFake::class, $fake);

        return $fake;
    }

    public static function getFacadeRoot(): mixed
    {
        return app()->bound(LiveFake::class) ? app(LiveFake::class) : parent::getFacadeRoot();
    }

    protected static function getFacadeAccessor(): string
    {
        return LiveManager::class;
    }
}
