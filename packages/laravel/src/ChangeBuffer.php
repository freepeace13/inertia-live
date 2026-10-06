<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

final class ChangeBuffer
{
    /** @var list<array{change: Change, level: int}> */
    private array $entries = [];

    /**
     * Record a change made at the given database transaction level, so a rollback can
     * discard it. Changes are coalesced by topic when drained.
     */
    public function add(Change $change, int $level = 0): void
    {
        $this->entries[] = ['change' => $change, 'level' => $level];
    }

    /**
     * Discard changes recorded inside transactions that no longer exist after a rollback
     * to `$level`: the read model writes they describe were undone.
     */
    public function rollBackTo(int $level): void
    {
        $this->entries = array_values(array_filter(
            $this->entries,
            fn (array $entry) => $entry['level'] <= $level,
        ));
    }

    /**
     * Coalesce by topic: props are unioned, so a burst becomes one signal.
     *
     * @return list<Change>
     */
    public function drain(): array
    {
        $byTopic = [];

        foreach ($this->entries as ['change' => $change]) {
            $existing = $byTopic[$change->topic] ?? null;

            $byTopic[$change->topic] = $existing === null ? $change : new Change(
                $change->topic,
                array_values(array_unique([...$existing->props, ...$change->props])),
            );
        }

        $this->entries = [];

        return array_values($byTopic);
    }

    public function isEmpty(): bool
    {
        return $this->entries === [];
    }
}
