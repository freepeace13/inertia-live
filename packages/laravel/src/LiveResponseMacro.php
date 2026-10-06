<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;
use WeakMap;

/**
 * Registers `Inertia\Response::live()`, which binds a topic to page props.
 */
final class LiveResponseMacro
{
    public static function register(): void
    {
        Response::macro('live', function (string $topic, array $only): Response {
            /** @var Response $this */
            return LiveResponseMacro::bind($this, $topic, $only);
        });
    }

    /**
     * @param  list<string>  $only
     */
    public static function bind(Response $response, string $topic, array $only): Response
    {
        // An empty list would bind nothing: the page would subscribe but never reload.
        if ($only === []) {
            throw new InvalidArgumentException("live('{$topic}') needs `only`: the props that depend on this topic.");
        }

        /** @var WeakMap<Response, LiveBindings>|null $registry */
        static $registry = null;
        $registry ??= new WeakMap;

        if (! isset($registry[$response])) {
            $registry[$response] = app(LiveBindings::class);

            // `always` keeps `_live` in the response even when a partial reload lists only some props.
            $response->with('_live', Inertia::always($registry[$response]));
        }

        $registry[$response]->add($topic, array_values($only));

        return $response;
    }
}
