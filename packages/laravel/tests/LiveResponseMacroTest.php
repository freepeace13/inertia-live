<?php

declare(strict_types=1);

use Freepeace13\InertiaLive\Cursor\CursorRepository;
use Freepeace13\InertiaLive\Facades\Live;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

beforeEach(function () {
    Route::get('/docs/{uuid}', fn (string $uuid) => Inertia::render('Documents/Show', [
        'document' => ['uuid' => $uuid],
        'activity' => fn () => ['a'],
        'other' => 'x',
    ])->live("documents.{$uuid}", only: ['document', 'activity']));

    $this->inertia = ['X-Inertia' => 'true'];
});

it('adds bindings with channel, props and cursor', function () {
    $cursor = app(CursorRepository::class)->next('documents.abc');

    $this->get('/docs/abc', $this->inertia)
        ->assertOk()
        ->assertJsonPath('props._live.bindings.0', [
            'topic' => 'documents.abc',
            'channel' => 'live.documents.abc',
            'props' => ['document', 'activity'],
            'cursor' => $cursor,
            'public' => false,
        ]);
});

it('defaults the cursor to 0', function () {
    $this->get('/docs/abc', $this->inertia)->assertJsonPath('props._live.bindings.0.cursor', 0);
});

it('keeps _live on partial reloads and returns a fresh cursor', function () {
    $headers = $this->inertia + [
        'X-Inertia-Partial-Component' => 'Documents/Show',
        'X-Inertia-Partial-Data' => 'document',
    ];

    $this->get('/docs/abc', $headers)->assertJsonPath('props._live.bindings.0.cursor', 0);

    $cursor = app(CursorRepository::class)->next('documents.abc');

    $this->get('/docs/abc', $headers)
        ->assertJsonPath('props._live.bindings.0.cursor', $cursor)
        ->assertJsonMissingPath('props.other');
});

it('supports several bindings on one page', function () {
    Live::publicTopic('workspaces.{id}');
    Route::get('/multi', fn () => Inertia::render('Multi', ['a' => 1])
        ->live('documents.a', only: ['a'])
        ->live('workspaces.1', only: ['b']));

    $response = $this->get('/multi', $this->inertia);

    $response->assertJsonCount(2, 'props._live.bindings')
        ->assertJsonPath('props._live.bindings.1.topic', 'workspaces.1')
        ->assertJsonPath('props._live.bindings.1.public', true);
});

it('does not add _live to pages without bindings', function () {
    Route::get('/plain', fn () => Inertia::render('Plain', ['a' => 1]));

    $this->get('/plain', $this->inertia)->assertJsonMissingPath('props._live');
});

it('requires the props a topic drives', function () {
    Route::get('/empty', fn () => Inertia::render('Empty', ['a' => 1])->live('documents.a', only: []));

    $this->withoutExceptionHandling();
    $this->get('/empty', $this->inertia);
})->throws(InvalidArgumentException::class, 'needs `only`');
