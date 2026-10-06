<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Testing;

use Closure;
use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\Contracts\FlushesChanges;
use Freepeace13\InertiaLive\LiveManager;
use PHPUnit\Framework\Assert as PHPUnit;

/**
 * Records flushed changes instead of broadcasting them. Installed by `Live::fake()`.
 */
final class LiveFake implements FlushesChanges
{
    /** @var list<Change> */
    private array $flushed = [];

    public function __construct(
        private readonly ChangeBuffer $buffer,
        private readonly LiveManager $manager,
    ) {}

    public function flush(): void
    {
        array_push($this->flushed, ...$this->buffer->drain());
    }

    public function authorize(string $pattern, Closure $callback): void
    {
        $this->manager->authorize($pattern, $callback);
    }

    public function hasAuthorizerFor(string $topic): bool
    {
        return $this->manager->hasAuthorizerFor($topic);
    }

    /**
     * @param  list<string>|null  $props  Props that must be among the changed props.
     */
    public function assertChanged(string $topic, ?array $props = null): void
    {
        $changes = $this->changesFor($topic);

        PHPUnit::assertNotEmpty($changes, "Expected a live change for topic [{$topic}], but none was flushed.");

        if ($props === null) {
            return;
        }

        $matching = array_filter($changes, fn (Change $change) => array_diff($props, $change->props) === []);

        PHPUnit::assertNotEmpty(
            $matching,
            "Topic [{$topic}] changed, but not with props [".implode(', ', $props).'].',
        );
    }

    public function assertNothingChangedFor(string $topic): void
    {
        PHPUnit::assertEmpty($this->changesFor($topic), "Unexpected live change for topic [{$topic}].");
    }

    public function assertChangedTimes(string $topic, int $times): void
    {
        PHPUnit::assertCount(
            $times,
            $this->changesFor($topic),
            "Expected topic [{$topic}] to change {$times} time(s).",
        );
    }

    /**
     * @return list<Change>
     */
    private function changesFor(string $topic): array
    {
        return array_values(array_filter($this->flushed, fn (Change $change) => $change->topic === $topic));
    }
}
