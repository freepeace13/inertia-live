import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            // Two frontends over one backend, one folder each: resources/js/vue and resources/js/react.
            input: ['resources/css/app.css', 'resources/js/vue/app.js', 'resources/js/react/app.jsx'],
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
    build: {
        rollupOptions: {
            output: {
                // Name entry chunks by frontend so builds stay distinguishable (both entries are `app`).
                entryFileNames: (chunk) =>
                    `assets/${chunk.facadeModuleId?.includes('/js/react/') ? 'react' : 'vue'}-[hash].js`,
            },
        },
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
