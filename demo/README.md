# Inertia Live demo

Laravel 13 app showing Inertia Live Projections with **two frontends over one backend**: Vue 3 at `/documents` and React at `/react/documents`. Open one document in two browser tabs: renaming it or adding a comment in one tab updates the other without any page-level WebSocket code.

An Inertia app uses one client adapter, so each frontend has its own Vite entry and root view (`vue/app.js` + `app.blade.php`, `react/app.jsx` + `app-react.blade.php`). Both share the controllers, events, projector and topics; `HandleInertiaRequests::rootView()` and pick the right one by route name. The controller renders the same component names for both; each app resolves them from its own `Pages` folder.

- `app/Domain/Documents` – stored events (`#[LiveTopic]`), projector (`EmitsLiveChanges`)
- `app/Http/Controllers/DocumentController.php` – `->live("documents.{uuid}", only: [...])`
- `app/Providers/AppServiceProvider.php` – `Live::authorize(...)`
- `resources/js/vue/app.js` – Vue: `app.use(InertiaLive, { echo })`
- `resources/js/vue/Pages/Documents/Show.vue` – Vue: `useLive()` status and `pause()`/`resume()` while editing
- `resources/js/react/app.jsx` + `resources/js/react/AppLayout.jsx` – React: `InertiaLiveProvider` in a persistent layout (it reads `usePage()`, so it must render inside the Inertia tree)
- `resources/js/react/Pages/Documents/Show.jsx` – React: the same page with the `useLive()` hook

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

Open http://localhost:8000 (Vue) or http://localhost:8000/react/documents (React), create a document, then open it in a second tab.

## Verify

```bash
php artisan test   # server flow with Live::fake()
npm run e2e        # real Reverb round trip: two Echo clients, sender exclusion, auth refusal
npx playwright install chromium   # once
npm run build && npm run e2e:browser   # two real browser tabs, Vue then React
```

The e2e scripts need `reverb:start` and `serve` running as above. The browser test also checks that `pause()` holds updates while an input is focused and that an unsent draft survives a live reload.
