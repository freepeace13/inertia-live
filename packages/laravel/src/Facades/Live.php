<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Facades;

use Closure;
use Freepeace13\InertiaLive\LiveManager;
use Illuminate\Support\Facades\Facade;

/**
 * @method static void authorize(string $pattern, Closure $callback)
 * @method static bool hasAuthorizerFor(string $topic)
 *
 * @see LiveManager
 */
final class Live extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return LiveManager::class;
    }
}
