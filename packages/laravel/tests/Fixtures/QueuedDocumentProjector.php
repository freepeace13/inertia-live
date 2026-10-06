<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Tests\Fixtures;

use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;
use Illuminate\Contracts\Queue\ShouldQueue;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;

final class QueuedDocumentProjector extends Projector implements ShouldQueue
{
    use EmitsLiveChanges;

    public function onDocumentRenamed(DocumentRenamed $event): void {}
}
