<?php

namespace App\Domain\Documents;

use Freepeace13\InertiaLive\Attributes\LiveTopic;
use Spatie\EventSourcing\StoredEvents\ShouldBeStored;

#[LiveTopic('documents.{documentUuid}', props: ['document'])]
final class DocumentRenamed extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly string $title,
    ) {}
}
