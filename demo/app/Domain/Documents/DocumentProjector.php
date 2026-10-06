<?php

namespace App\Domain\Documents;

use App\Models\Comment;
use App\Models\Document;
use Freepeace13\InertiaLive\Concerns\EmitsLiveChanges;
use Spatie\EventSourcing\EventHandlers\Projectors\Projector;

final class DocumentProjector extends Projector
{
    use EmitsLiveChanges; // signals go out after each handler returns and the transaction commits

    public function onDocumentCreated(DocumentCreated $event): void
    {
        Document::create(['uuid' => $event->documentUuid, 'title' => $event->title]);
    }

    public function onDocumentRenamed(DocumentRenamed $event): void
    {
        Document::whereKey($event->documentUuid)->update(['title' => $event->title]);
    }

    public function onCommentAdded(CommentAdded $event): void
    {
        Comment::create(['document_uuid' => $event->documentUuid, 'body' => $event->body]);
    }
}
