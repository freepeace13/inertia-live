<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Illuminate\Contracts\Config\Repository as Config;

/**
 * The `_live` prop for one Inertia response. Resolved lazily so every render,
 * including partial reloads, reads fresh cursors.
 */
final class LiveBindings
{
    /** @var list<array{topic: string, props: list<string>}> */
    private array $bindings = [];

    public function __construct(
        private readonly CursorRepository $cursors,
        private readonly Config $config,
        private readonly LiveManager $live,
    ) {}

    /**
     * @param  list<string>  $props
     */
    public function add(string $topic, array $props): void
    {
        $this->bindings[] = ['topic' => $topic, 'props' => $props];
    }

    /**
     * @return array{bindings: list<array{topic: string, channel: string, props: list<string>, cursor: int, public: bool}>}
     */
    public function __invoke(): array
    {
        $prefix = (string) $this->config->get('inertia-live.channel_prefix', 'live');

        return [
            'bindings' => array_map(fn (array $binding) => [
                'topic' => $binding['topic'],
                'channel' => $prefix.'.'.$binding['topic'],
                'props' => $binding['props'],
                'cursor' => $this->cursors->get($binding['topic']),
                'public' => $this->live->isPublic($binding['topic']),
            ], $this->bindings),
        ];
    }
}
