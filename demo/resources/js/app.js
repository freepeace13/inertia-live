import { createInertiaApp } from '@inertiajs/vue3';
import { InertiaLive } from '@freepeace13/inertia-live/vue';
import { createApp, h } from 'vue';
import { echo } from './echo';

createInertiaApp({
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.vue', { eager: true });
        return pages[`./Pages/${name}.vue`];
    },
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .use(InertiaLive, { echo, debounceMs: 150 })
            .mount(el);
    },
});
