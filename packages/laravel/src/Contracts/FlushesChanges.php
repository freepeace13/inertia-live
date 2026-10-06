<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Contracts;

interface FlushesChanges
{
    public function flush(): void;
}
