<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;

it('coalesces changes to one per topic', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', ['document']));
    $buffer->add(new Change('documents.a', ['document']));
    $buffer->add(new Change('documents.a', ['document']));

    expect($buffer->drain())->toEqual([new Change('documents.a', ['document'])]);
});

it('unions props across coalesced changes', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', ['document', 'activity']));
    $buffer->add(new Change('documents.a', ['activity', 'comments']));

    expect($buffer->drain()[0]->props)->toBe(['document', 'activity', 'comments']);
});

it('keeps separate topics separate', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a'));
    $buffer->add(new Change('documents.b'));

    expect($buffer->drain())->toHaveCount(2);
});

it('clears after draining', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a'));

    expect($buffer->isEmpty())->toBeFalse();

    $buffer->drain();

    expect($buffer->isEmpty())->toBeTrue()
        ->and($buffer->drain())->toBe([]);
});

it('drops changes recorded in transactions deeper than the rollback level', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a'), level: 0);
    $buffer->add(new Change('documents.b'), level: 2);

    $buffer->rollBackTo(1);

    expect($buffer->drain())->toEqual([new Change('documents.a')]);
});
