import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { echo } from '../echo';
import AppLayout from './AppLayout';

createInertiaApp({
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.jsx', { eager: true });
        const page = pages[`./Pages/${name}.jsx`];

        // Persistent layout: InertiaLiveProvider must live inside the Inertia tree (it reads usePage()).
        page.default.layout ??= (children) => <AppLayout echo={echo}>{children}</AppLayout>;

        return page;
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />);
    },
});
