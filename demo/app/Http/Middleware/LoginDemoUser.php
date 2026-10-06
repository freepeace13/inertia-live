<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Demo only: signs everyone in as one user so private channels can be authorized
 * without building a login screen. Never do this in a real app.
 */
class LoginDemoUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::guest()) {
            Auth::login(User::firstOrCreate(
                ['email' => 'demo@example.com'],
                ['name' => 'Demo', 'password' => Hash::make(str()->random(40))],
            ));
        }

        return $next($request);
    }
}
