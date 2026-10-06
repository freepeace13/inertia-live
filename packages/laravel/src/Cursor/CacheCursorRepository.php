<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Cursor;

use Illuminate\Contracts\Cache\Repository;
use RuntimeException;

/**
 * Sequence numbers kept in a cache store that supports atomic `increment` (Redis, database,
 * Memcached, array). The `file` store does not, so concurrent workers can issue duplicates.
 *
 * A new counter starts at the current time in microseconds (about 1.8e15, still a safe integer
 * in JavaScript until the year 2255) rather than at 0. If the store is flushed or a key
 * expires, the counter restarts above everything issued before, so clients holding an older
 * cursor never mistake a new signal for a stale one. That holds as long as a topic is not
 * signalled faster than a million times per second.
 */
final class CacheCursorRepository implements CursorRepository
{
    /**
     * @param  int|null  $ttl  Seconds a counter lives after it was created; null keeps it forever.
     */
    public function __construct(private readonly Repository $cache, private readonly ?int $ttl = null) {}

    public function get(string $topic): int
    {
        return (int) $this->cache->get($this->key($topic), 0);
    }

    public function next(string $topic): int
    {
        $key = $this->key($topic);

        // No-op when the counter exists; seeds it from the clock when it does not.
        $this->cache->add($key, (int) (microtime(true) * 1_000_000), $this->ttl);

        $next = $this->cache->increment($key);

        if (! is_int($next)) {
            throw new RuntimeException('The inertia-live cursor store must support atomic increment.');
        }

        return $next;
    }

    private function key(string $topic): string
    {
        return 'inertia-live:cursor:'.$topic;
    }
}
