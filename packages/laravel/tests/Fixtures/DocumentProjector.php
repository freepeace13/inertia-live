<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Tests\Fixtures;

use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;
use RuntimeException;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;

final class DocumentProjector extends Projector
{
    use EmitsLiveChanges;

    public static bool $fail = false;

    /** @var list<string> */
    public static array $handled = [];

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        if (self::$fail) {
            throw new RuntimeException('projection failed');
        }

        self::$handled[] = $event->documentUuid;
    }

    public function onPlainEvent(PlainEvent $event): void
    {
        $this->liveChanged('documents.'.$event->documentUuid, ['document']);
    }
}
