<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Cursor;

use Illuminate\Contracts\Cache\Repository;

final class CacheCursorRepository implements CursorRepository
{
    public function __construct(private readonly Repository $cache) {}

    public function get(string $topic): int
    {
        return (int) $this->cache->get($this->key($topic), 0);
    }

    public function put(string $topic, int $version): void
    {
        $store = $this->cache->getStore();

        if (! method_exists($store, 'lock')) {
            $this->putIfHigher($topic, $version);

            return;
        }

        $store->lock('lock:'.$this->key($topic), 5)->block(5, fn () => $this->putIfHigher($topic, $version));
    }

    private function putIfHigher(string $topic, int $version): void
    {
        if ($version > $this->get($topic)) {
            $this->cache->forever($this->key($topic), $version);
        }
    }

    private function key(string $topic): string
    {
        return 'inertia-live:cursor:'.$topic;
    }
}
