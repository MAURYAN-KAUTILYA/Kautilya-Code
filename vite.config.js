import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        proxy: {
            '/api/chat': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api/indica': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api': {
                target: 'http://localhost:3002',
                changeOrigin: true,
            }
        }
    }
});
