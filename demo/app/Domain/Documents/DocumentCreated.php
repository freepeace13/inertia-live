<?php

namespace App\Domain\Documents;

use Spatie\EventSourcing\StoredEvents\ShouldBeStored;

final class DocumentCreated extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly string $title,
    ) {}
}
