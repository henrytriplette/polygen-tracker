import { defineConfig } from 'vite';
import path from 'path';

import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.resolve(__dirname, '..');

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(root, './src'),
            // The package's exports map only exposes its root entry; this
            // opens the compiled internals so src/lib/polyend.ts can reach
            // the buffer-returning serializer classes (not yet public API).
            '@polyend/tracker-lib/dist': path.resolve(root, 'node_modules/@polyend/tracker-lib/dist'),
        },

        extensions: ['.js', '.ts', '.json', '.vue', '.css', '.scss', '.sass'],
    },
    plugins: [
        vue(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            manifest: {
                name: 'Polygen Tracker',
                short_name: 'Polygen',
                description:
                    'Generative chiptune tracker that exports Polyend Tracker compatible projects.',
                theme_color: '#0c0d10',
                background_color: '#0c0d10',
                display: 'standalone',
                icons: [
                    {
                        src: 'favicon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
                cleanupOutdatedCaches: true,
            },
            devOptions: {
                enabled: true,
                type: 'module',
            },
        }),
    ],
});
