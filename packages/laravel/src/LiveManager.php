<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Closure;
use Illuminate\Contracts\Config\Repository as Config;
use Illuminate\Support\Facades\Broadcast;
use InvalidArgumentException;

final class LiveManager
{
    /** @var list<string> */
    private array $privatePatterns = [];

    /** @var list<string> */
    private array $publicPatterns = [];

    public function __construct(private readonly Config $config) {}

    /**
     * Authorize subscriptions to a private topic pattern, e.g. `documents.{uuid}`.
     * The callback receives the user followed by the pattern's parameters.
     */
    public function authorize(string $pattern, Closure $callback): void
    {
        $this->assertNotRegisteredAs($pattern, $this->publicPatterns, 'public');

        $this->privatePatterns[] = $pattern;

        Broadcast::channel($this->config->get('inertia-live.channel_prefix', 'live').'.'.$pattern, $callback);
    }

    /**
     * Declare a topic pattern public: anyone can subscribe, so it needs no authorizer.
     * Visibility lives here, once per pattern, rather than on each attribute or binding.
     */
    public function publicTopic(string $pattern): void
    {
        $this->assertNotRegisteredAs($pattern, $this->privatePatterns, 'private');

        $this->publicPatterns[] = $pattern;
    }

    public function isPublic(string $topic): bool
    {
        return $this->matchesAny($this->publicPatterns, $topic);
    }

    public function hasAuthorizerFor(string $topic): bool
    {
        return $this->matchesAny($this->privatePatterns, $topic);
    }

    /**
     * @param  list<string>  $others
     */
    private function assertNotRegisteredAs(string $pattern, array $others, string $visibility): void
    {
        if (in_array($pattern, $others, true)) {
            throw new InvalidArgumentException("Topic pattern [{$pattern}] is already registered as {$visibility}.");
        }
    }

    /**
     * @param  list<string>  $patterns
     */
    private function matchesAny(array $patterns, string $topic): bool
    {
        foreach ($patterns as $pattern) {
            $regex = preg_replace('/\\\\\{\w+\\\\\}/', '[^.]+', preg_quote($pattern, '/'));

            if (preg_match('/^'.$regex.'$/', $topic) === 1) {
                return true;
            }
        }

        return false;
    }
}
