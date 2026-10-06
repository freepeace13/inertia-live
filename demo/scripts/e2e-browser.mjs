// Two real browser tabs on one document. Usage: node scripts/e2e-browser.mjs [vue|react]
// Needs `php artisan serve --port=8000`, `php artisan reverb:start --port=8080` and `npm run build`.
import { chromium } from 'playwright';

const variant = process.argv[2] ?? 'vue';
const base = `${process.env.APP_URL ?? 'http://localhost:8000'}${variant === 'react' ? '/react' : ''}`;
let failures = 0;

function check(label, ok, detail = '') {
    console.log(`${ok ? 'PASS' : 'FAIL'}  [${variant}] ${label}${ok ? '' : `  ${detail}`}`);
    if (!ok) failures++;
}

const browser = await chromium.launch();
const context = await browser.newContext(); // one session, two tabs
const errors = [];
const tab = async (name) => {
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    page.on('console', (message) => message.type() === 'error' && errors.push(`${name}: ${message.text()}`));
    return page;
};

const a = await tab('A');
await a.goto(`${base}/documents`);
await a.getByPlaceholder('New document title').fill(`Browser ${variant} ${Date.now()}`);
await a.getByRole('button', { name: 'Create' }).click();
await a.waitForURL(/\/documents\/[0-9a-f-]{36}$/);

const loadedReactEntry = await a.evaluate(() =>
    [...document.querySelectorAll('script[src]')].some((script) => script.src.includes('app-react')),
);
check(`serves the ${variant} frontend`, loadedReactEntry === (variant === 'react'));

const b = await tab('B');
await b.goto(a.url());

const status = (page) => page.getByTestId('live-status');
await status(a).filter({ hasText: 'Live: live' }).waitFor({ timeout: 10000 });
await status(b).filter({ hasText: 'Live: live' }).waitFor({ timeout: 10000 });
check('both tabs report live', true);

const renameInput = (page) => page.locator('main form input').nth(0);
const commentInput = (page) => page.locator('main form input').nth(1);
const waitFor = async (locator, text, timeout = 5000) => {
    try {
        await locator.filter({ hasText: text }).waitFor({ timeout });
        return true;
    } catch {
        return false;
    }
};

// 1. A renames; B updates without any action.
await renameInput(a).fill('Renamed in A');
await a.getByRole('button', { name: 'Rename' }).click();
check('B shows the new title', await waitFor(b.getByTestId('title'), 'Renamed in A'));

// 2. A comments; B shows it.
await commentInput(a).fill('Hello from A');
await a.getByRole('button', { name: 'Post' }).click();
check('B shows the new comment', await waitFor(b.getByTestId('comments'), 'Hello from A'));

// 3. B shows a sync time after the live reload.
check('B shows a synced time', await waitFor(status(b), 'synced'));

// 4. While B is editing (input focused), live reloads are paused...
await renameInput(b).focus();
await renameInput(a).fill('Second rename');
await a.getByRole('button', { name: 'Rename' }).click();
await b.waitForTimeout(1500);
check('B title is held while its input is focused', (await b.getByTestId('title').textContent()) === 'Renamed in A');

// 5. ...and applied once B stops editing.
await b.locator('h2').click(); // blur
check('B applies the held update after blur', await waitFor(b.getByTestId('title'), 'Second rename'));

// 6. B keeps the draft the user was typing in the other field (preserveState).
await commentInput(b).fill('draft in progress');
await renameInput(a).fill('Third rename');
await a.getByRole('button', { name: 'Rename' }).click();
await commentInput(b).blur();
check('B applies the third rename', await waitFor(b.getByTestId('title'), 'Third rename'));
check('B keeps its unsent draft', (await commentInput(b).inputValue()) === 'draft in progress');

check('no console or page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
