import { defineConfig } from 'vite'
import path from 'path';

// import mkcert from 'vite-plugin-mkcert';
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'
import { VitePWA } from 'vite-plugin-pwa'

const root = path.resolve(__dirname, '..');

// Address of the Insta360 X5 when connected to its Wi-Fi hotspot.
// Override with CAMERA_URL=http://192.168.42.1 if your camera differs.
const cameraUrl = process.env.CAMERA_URL || 'http://192.168.42.1';

// Path (relative to the app origin) where pending photos are uploaded. Kept
// relative so the service worker's BackgroundSync queue can replay the request.
const uploadPath = process.env.UPLOAD_PATH || '/api/photos';

// Local mock upload server (see server/mock_upload_server.py).
const uploadServer = process.env.UPLOAD_SERVER || 'http://localhost:8090';

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        // https: {
        //     cert: './certs/cert.pem',
        //     key: './certs/dev.pem'
        // }

        // Proxy the camera's OSC API and media files so the browser can reach
        // them without running into CORS / mixed-content restrictions.
        proxy: {
            '/osc': {
                target: cameraUrl,
                changeOrigin: true,
            },
            '/DCIM': {
                target: cameraUrl,
                changeOrigin: true,
            },
            // Photo uploads + serving, handled by the local mock server in dev.
            '/api': {
                target: uploadServer,
                changeOrigin: true,
            },
            '/uploads': {
                target: uploadServer,
                changeOrigin: true,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(root, './src'),
        },

        extensions: ['.js', '.ts', '.json', '.vue', '.css', '.scss', '.sass'],
    },
    optimizeDeps: {
        include: [],
    },
    css: {
        preprocessorOptions: {
            sass: {
                silenceDeprecations: [
                    'legacy-js-api',
                    'mixed-decls',
                ],
            },
        },
    },
    plugins: [
        svgLoader(),
        // mkcert({
        //     savePath: './certs', // save the generated certificate into certs directory
        //     force: true, // force generation of certs even without setting https property in the vite config
        // }),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons.svg'],
            manifest: {
                name: 'Insta360 X5 Remote',
                short_name: 'X5 Remote',
                description:
                    'Connect to an Insta360 X5 over OSC, capture photos and sync them once back online.',
                theme_color: '#aa3bff',
                background_color: '#16171d',
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
                // Don't try to precache/serve the proxied camera endpoints.
                navigateFallbackDenylist: [/^\/osc/, /^\/DCIM/],
                runtimeCaching: [
                    {
                        // Queue photo uploads and retry them via BackgroundSync
                        // when connectivity returns (even if the app is closed).
                        urlPattern: ({ url }) => url.pathname.startsWith(uploadPath),
                        handler: 'NetworkOnly',
                        method: 'POST',
                        options: {
                            backgroundSync: {
                                name: 'photo-upload-queue',
                                options: { maxRetentionTime: 24 * 60 },
                            },
                        },
                    },
                    {
                        // Cache static images at runtime.
                        urlPattern: ({ request }) => request.destination === 'image',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images',
                            expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
                        },
                    },
                ],
            },
            devOptions: {
                enabled: true,
                type: 'module',
            },
        }),
        vue({
            template: {
                compilerOptions: {
                    isCustomElement: tag =>
                        [
                            'LottieAnimation',
                        ].includes(tag),
                },
            },
        }),
    ],
});