import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            // Two frontends over one backend: Vue (app.js) and React (app-react.jsx).
            input: ['resources/css/app.css', 'resources/js/app.js', 'resources/js/app-react.jsx'],
            refresh: true,
        }),
        vue(),
        react(),
        tailwindcss(),
    ],
    resolve: {
        // The linked client package has its own copies of these; one instance each keeps
        // inject() (Vue) and context (React) working.
        dedupe: ['vue', '@inertiajs/vue3', 'react', 'react-dom', '@inertiajs/react'],
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
