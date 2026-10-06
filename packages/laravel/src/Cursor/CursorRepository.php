<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Cursor;

interface CursorRepository
{
    /**
     * Last version applied to the topic's read model; 0 when unknown.
     */
    public function get(string $topic): int;

    /**
     * Record a version, never moving the cursor backwards.
     */
    public function put(string $topic, int $version): void;
}
