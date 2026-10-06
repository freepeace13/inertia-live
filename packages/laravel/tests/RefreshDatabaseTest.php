<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Broadcasting\LiveChangeBroadcast;
use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;
use Freepeace13\InertiaLive\ChangeFlusher;
use Freepeace13\InertiaLive\Facades\Live;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;

uses(DatabaseTransactions::class);

it('still broadcasts inside the wrapping transaction of DatabaseTransactions tests', function () {
    Event::fake([LiveChangeBroadcast::class]);
    Live::authorize('documents.{uuid}', fn () => true);

    app(ChangeBuffer::class)->add(new Change('documents.abc', ['document']));
    app(ChangeFlusher::class)->flush();

    Event::assertDispatchedTimes(LiveChangeBroadcast::class, 1);
});
