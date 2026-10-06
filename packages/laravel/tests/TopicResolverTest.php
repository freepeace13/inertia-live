<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\ResolvedTopic;
use Freepeace13\InertiaLive\Tests\Fixtures\BrokenTemplate;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentMoved;
use Freepeace13\InertiaLive\Tests\Fixtures\DocumentRenamed;
use Freepeace13\InertiaLive\Tests\Fixtures\PlainEvent;
use Freepeace13\InertiaLive\TopicResolver;

it('resolves a topic template from event properties', function () {
    $topics = (new TopicResolver)->forEvent(new DocumentRenamed('abc', 'Q4'));

    expect($topics)->toEqual([new ResolvedTopic('documents.abc', ['document', 'activity'], false)]);
});

it('resolves repeated attributes and casts scalars', function () {
    $topics = (new TopicResolver)->forEvent(new DocumentMoved('abc', 7));

    expect($topics)->toEqual([
        new ResolvedTopic('documents.abc', ['document'], false),
        new ResolvedTopic('workspaces.7', ['documents'], true),
    ]);
});

it('returns nothing for events without the attribute', function () {
    expect((new TopicResolver)->forEvent(new PlainEvent('abc')))->toBe([]);
});

it('throws when the template references a missing property', function () {
    (new TopicResolver)->forEvent(new BrokenTemplate('abc'));
})->throws(InvalidArgumentException::class, 'missing');
