<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Attributes;

use Attribute;

#[Attribute(Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
final readonly class LiveTopic
{
    /**
     * @param  list<string>  $props
     */
    public function __construct(
        public string $template,
        public array $props = [],
        public bool $public = false,
    ) {}
}
