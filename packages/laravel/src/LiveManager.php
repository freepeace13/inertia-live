<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Closure;
use Illuminate\Contracts\Config\Repository as Config;
use Illuminate\Support\Facades\Broadcast;

final class LiveManager
{
    /** @var list<string> */
    private array $patterns = [];

    public function __construct(private readonly Config $config) {}

    /**
     * Authorize subscriptions to a private topic pattern, e.g. `documents.{uuid}`.
     * The callback receives the user followed by the pattern's parameters.
     */
    public function authorize(string $pattern, Closure $callback): void
    {
        $this->patterns[] = $pattern;

        Broadcast::channel($this->config->get('inertia-live.channel_prefix', 'live').'.'.$pattern, $callback);
    }

    public function hasAuthorizerFor(string $topic): bool
    {
        foreach ($this->patterns as $pattern) {
            $regex = preg_replace('/\\\\\{\w+\\\\\}/', '[^.]+', preg_quote($pattern, '/'));

            if (preg_match('/^'.$regex.'$/', $topic) === 1) {
                return true;
            }
        }

        return false;
    }
}
