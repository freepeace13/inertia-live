<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Tests\Fixtures;

use Freepeace13\InertiaLive\Attributes\LiveTopic;
use Spatie\EventSourcing\StoredEvents\ShouldBeStored;

#[LiveTopic('documents.{documentUuid}', props: ['document'])]
#[LiveTopic('workspaces.{workspaceId}', props: ['documents'], public: true)]
final class DocumentMoved extends ShouldBeStored
{
    public function __construct(
        public readonly string $documentUuid,
        public readonly int $workspaceId,
    ) {}
}
