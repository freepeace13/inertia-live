<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

/**
 * Holds changes produced during a projector replay until the replay finishes.
 */
final class ReplayBuffer
{
    private readonly ChangeBuffer $buffer;

    public function __construct()
    {
        $this->buffer = new ChangeBuffer;
    }

    public function add(Change $change): void
    {
        $this->buffer->add($change);
    }

    /**
     * @return list<Change>
     */
    public function drain(): array
    {
        return $this->buffer->drain();
    }
}
