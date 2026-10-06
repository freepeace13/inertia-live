<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Change;
use Freepeace13\InertiaLive\ChangeBuffer;

it('coalesces changes to one per topic keeping the highest version', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', 5, ['document']));
    $buffer->add(new Change('documents.a', 9, ['document']));
    $buffer->add(new Change('documents.a', 7, ['document']));

    expect($buffer->drain())->toEqual([new Change('documents.a', 9, ['document'])]);
});

it('unions props across coalesced changes', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', 1, ['document', 'activity']));
    $buffer->add(new Change('documents.a', 2, ['activity', 'comments']));

    expect($buffer->drain()[0]->props)->toBe(['document', 'activity', 'comments']);
});

it('keeps separate topics separate', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', 1));
    $buffer->add(new Change('documents.b', 2));

    expect($buffer->drain())->toHaveCount(2);
});

it('clears after draining', function () {
    $buffer = new ChangeBuffer;
    $buffer->add(new Change('documents.a', 1));

    expect($buffer->isEmpty())->toBeFalse();

    $buffer->drain();

    expect($buffer->isEmpty())->toBeTrue()
        ->and($buffer->drain())->toBe([]);
});
