<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

final class ChangeBuffer
{
    /** @var array<string, Change> */
    private array $changes = [];

    /**
     * Record a change, coalescing by topic: highest version wins and props are unioned.
     */
    public function add(Change $change): void
    {
        $existing = $this->changes[$change->topic] ?? null;

        if ($existing === null) {
            $this->changes[$change->topic] = $change;

            return;
        }

        $this->changes[$change->topic] = new Change(
            $change->topic,
            max($existing->version, $change->version),
            array_values(array_unique([...$existing->props, ...$change->props])),
            $existing->public || $change->public,
        );
    }

    /**
     * @return list<Change>
     */
    public function drain(): array
    {
        $changes = array_values($this->changes);

        $this->changes = [];

        return $changes;
    }

    public function isEmpty(): bool
    {
        return $this->changes === [];
    }
}
