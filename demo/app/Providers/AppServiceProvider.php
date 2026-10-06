<?php

namespace App\Providers;

use App\Models\Document;
use Freepeace13\InertiaLive\Facades\Live;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Demo: any signed-in user may follow any document. Real apps check a policy here.
        Live::authorize('documents.{uuid}', fn ($user, string $uuid) => Document::whereKey($uuid)->exists());
    }
}
