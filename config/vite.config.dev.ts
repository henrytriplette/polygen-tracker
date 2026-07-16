import { defineConfig, mergeConfig, loadEnv } from "vite";
import common from "./vite.config.base";

const mode = process.env.NODE_ENV || "development";
const env = loadEnv(mode, process.cwd(), "");

// https://vitejs.dev/config/
const config = defineConfig({
  base: env.VITE_BASE_URL,
  build: {
    sourcemap: true,
    target: "esnext", //browsers can handle the latest ES features
  },
  server: {
    port: 3000,
    allowedHosts: [".ngrok-free.app"],
  },
});

export default defineConfig(() => mergeConfig(common, config));
