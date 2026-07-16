import { defineConfig, mergeConfig, loadEnv } from 'vite';
import common from './vite.config.base.js';

const mode = process.env.NODE_ENV || 'production';
const env = loadEnv(mode, process.cwd(), '');

// https://vitejs.dev/config/
const config = defineConfig({
        base: env.VITE_BASE_URL,
        build: {
            sourcemap: false,
            target: "esnext", //browsers can handle the latest ES features
        },
        plugins: [
            // splitVendorChunkPlugin()
        ],
});

export default defineConfig(() => mergeConfig(common, config));
