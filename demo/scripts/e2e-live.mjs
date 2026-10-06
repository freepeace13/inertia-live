// End-to-end check against a running demo (php artisan serve --port=8000 and reverb:start --port=8080).
// Two Echo clients follow one document; a third request changes it. Run: npm run e2e
import { LiveClient } from '@freepeace13/inertia-live-core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Echo looks up window.Pusher; Node has no window, so alias it.
globalThis.window = globalThis;
globalThis.Pusher = Pusher;

const APP = process.env.APP_URL ?? 'http://localhost:8000';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  ${detail}`}`);
    if (!ok) failures++;
}

// Minimal session: cookie jar plus the CSRF token Laravel expects from XHR clients.
const jar = {};
const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
const csrf = () => decodeURIComponent(jar['XSRF-TOKEN'] ?? '');

async function http(method, path, body, headers = {}) {
    const res = await fetch(`${APP}${path}`, {
        method,
        redirect: 'manual',
        headers: {
            Accept: 'text/html',
            Cookie: cookieHeader(),
            'X-XSRF-TOKEN': csrf(),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    for (const line of res.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const [name, ...rest] = pair.split('=');
        jar[name.trim()] = rest.join('=');
    }
    return res;
}

function pageFrom(html) {
    const script = html.match(/<script[^>]*data-page[^>]*>([\s\S]*?)<\/script>/);
    if (script) return JSON.parse(script[1]);
    const attr = html.match(/data-page="([^"]*)"/);
    return JSON.parse(attr[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'));
}

function makeEcho() {
    return new Echo({
        broadcaster: 'reverb',
        key: 'live-demo-key',
        wsHost: 'localhost',
        wsPort: 8080,
        forceTLS: false,
        enabledTransports: ['ws'],
        authEndpoint: `${APP}/broadcasting/auth`,
        auth: { headers: { 'X-XSRF-TOKEN': csrf(), Accept: 'application/json' } }, // demo middleware signs every request in
    });
}

await http('GET', '/documents'); // establishes the session and demo login

const created = await http('POST', '/documents', { title: 'E2E document' });
const uuid = created.headers.get('location').split('/').pop();
check('document created', /^[0-9a-f-]{36}$/.test(uuid), created.headers.get('location'));

const page = pageFrom(await (await http('GET', `/documents/${uuid}`)).text());
const live = page.props._live;
check('page carries _live bindings', live?.bindings?.[0]?.topic === `documents.${uuid}`, JSON.stringify(live));

// A `_live`-only reload is the client re-reading cursors right after subscribing; track it apart.
const reloads = { a: [], b: [] };
const recoveries = { a: 0, b: 0 };
const record = (who) => async (only) => {
    if (only.length === 1 && only[0] === '_live') recoveries[who]++;
    else reloads[who].push(only);
};
const echoA = makeEcho();
const echoB = makeEcho();
const clientA = new LiveClient({ echo: echoA, reload: record('a'), debounceMs: 50 });
const clientB = new LiveClient({ echo: echoB, reload: record('b'), debounceMs: 50 });
clientA.sync(live);
clientB.sync(live);
await sleep(1500); // subscriptions (including private channel auth) settle

check('subscriptions re-read _live once confirmed', recoveries.a >= 1 && recoveries.b >= 1, JSON.stringify(recoveries));

const socketA = echoA.socketId();
check('both clients connected', Boolean(socketA && echoB.socketId()), `socketA=${socketA}`);

// 1. A renames; its own socket is excluded, B must reload only `document`.
await http('PUT', `/documents/${uuid}`, { title: 'Renamed by A' }, { 'X-Socket-ID': socketA });
await sleep(800);
check('B reloads the document prop after A renames', JSON.stringify(reloads.b) === '[["document"]]', JSON.stringify(reloads.b));
check("A's own socket is excluded", reloads.a.length === 0, JSON.stringify(reloads.a));

// 2. A comment from outside any socket reaches both, bound to `comments` only.
await http('POST', `/documents/${uuid}/comments`, { body: 'hello' });
await sleep(800);
check('A reloads comments', JSON.stringify(reloads.a) === '[["comments"]]', JSON.stringify(reloads.a));
check('B reloads comments', JSON.stringify(reloads.b) === '[["document"],["comments"]]', JSON.stringify(reloads.b));

// 3. The data itself comes through the controller, not the socket.
const after = pageFrom(await (await http('GET', `/documents/${uuid}`)).text());
check('controller serves the new title', after.props.document.title === 'Renamed by A', after.props.document.title);
check('cursor advanced past 0', after.props._live.bindings[0].cursor > 0, String(after.props._live.bindings[0].cursor));

// 4. A signal at or below the cursor is stale and ignored.
const reloadsBefore = reloads.b.length;
clientB.afterReload(after.props._live);
await http('GET', `/documents/${uuid}`);
check('no spurious reloads from reads', reloads.b.length === reloadsBefore);

// 5. Authorization fails closed: a private channel for an unknown document is refused.
let refused = false;
echoA.private('live.documents.00000000-0000-0000-0000-000000000000').error(() => {
    refused = true;
});
await sleep(1000);
check('unauthorized channel subscription is refused', refused);

clientA.destroy();
clientB.destroy();
echoA.disconnect();
echoB.disconnect();

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
