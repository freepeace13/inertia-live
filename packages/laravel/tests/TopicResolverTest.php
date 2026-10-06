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

    expect($topics)->toEqual([new ResolvedTopic('documents.abc', ['document', 'activity'])]);
});

it('resolves repeated attributes and casts scalars', function () {
    $topics = (new TopicResolver)->forEvent(new DocumentMoved('abc', 7));

    expect($topics)->toEqual([
        new ResolvedTopic('documents.abc', ['document']),
        new ResolvedTopic('workspaces.7', ['documents']),
    ]);
});

it('returns nothing for events without the attribute', function () {
    expect((new TopicResolver)->forEvent(new PlainEvent('abc')))->toBe([]);
});

it('throws when the template references a missing property', function () {
    (new TopicResolver)->forEvent(new BrokenTemplate('abc'));
})->throws(InvalidArgumentException::class, 'missing');

it('rejects placeholder values that no authorizer or channel name could carry', function (string $value) {
    (new TopicResolver)->forEvent(new DocumentRenamed($value, 'Q4'));
})->with(['v1.2', 'a b', 'a/b', 'a:b'])->throws(InvalidArgumentException::class, 'not usable in a channel name');
