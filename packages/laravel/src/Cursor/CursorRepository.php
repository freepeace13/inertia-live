<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Cursor;

/**
 * Per-topic sequence numbers. Each broadcast signal takes the next number, so a page that
 * renders with the current number can tell exactly which later signals it has not seen.
 */
interface CursorRepository
{
    /**
     * The latest sequence number issued for the topic; 0 when none is known.
     */
    public function get(string $topic): int;

    /**
     * Atomically issue the topic's next sequence number.
     *
     * Implementations must never hand out the same number twice, and must stay above every
     * number issued before, even after the store lost its data.
     */
    public function next(string $topic): int;
}
