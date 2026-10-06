<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive\Tests\Fixtures;

use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Broadcaster that exposes channel authorization so tests can call it directly.
 */
final class TestBroadcaster extends Broadcaster
{
    public function canAccess(?object $user, string $channel): bool
    {
        $request = new Request;
        $request->setUserResolver(fn () => $user);

        try {
            return (bool) $this->verifyUserCanAccessChannel($request, $channel);
        } catch (AccessDeniedHttpException) {
            return false;
        }
    }

    public function auth($request): mixed
    {
        return null;
    }

    public function validAuthenticationResponse($request, $result): mixed
    {
        return $result;
    }

    public function broadcast(array $channels, $event, array $payload = []): void {}
}
