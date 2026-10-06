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

        app()->instance(FlushesChanges::class, $fake);
        self::swap($fake);

        return $fake;
    }

    protected static function getFacadeAccessor(): string
    {
        return LiveManager::class;
    }
}
