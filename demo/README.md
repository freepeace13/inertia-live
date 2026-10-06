# Inertia Live demo

Laravel 13 + Vue 3 app showing Inertia Live Projections. Open one document in two browser tabs: renaming it or adding a comment in one tab updates the other without any page-level WebSocket code.

- `app/Domain/Documents` – stored events (`#[LiveTopic]`), projector (`EmitsLiveChanges`)
- `app/Http/Controllers/DocumentController.php` – `->live("documents.{uuid}", only: [...])`
- `app/Providers/AppServiceProvider.php` – `Live::authorize(...)`
- `resources/js/app.js` – `app.use(InertiaLive, { echo })`
- `resources/js/Pages/Documents/Show.vue` – `useLive()` status and `pause()`/`resume()` while editing

The app signs everyone in as one demo user (`LoginDemoUser`) so private channels work without a login screen. Never do that in a real app.

## Run

The packages are linked from `../packages`, so build the client first.

```bash
(cd ../packages/client && npm install && npm run build)

cp .env.example .env && php artisan key:generate
touch database/database.sqlite
composer install && npm install
php artisan migrate

php artisan reverb:start --port=8080   # terminal 1
php artisan serve --port=8000          # terminal 2
npm run dev                            # terminal 3
```

Open http://localhost:8000, create a document, then open it in a second tab.

## Verify

```bash
php artisan test   # server flow with Live::fake()
npm run e2e        # real Reverb round trip: two Echo clients, sender exclusion, auth refusal
```

`npm run e2e` needs `reverb:start` and `serve` running as above.
