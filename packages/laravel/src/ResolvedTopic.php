<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

final readonly class ResolvedTopic
{
    /**
     * @param  list<string>  $props
     */
    public function __construct(
        public string $topic,
        public array $props,
        public bool $public,
    ) {}
}
